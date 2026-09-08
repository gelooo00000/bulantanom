from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import AccountStatus, User, UserRole


class UserSerializer(serializers.ModelSerializer):
    """Safe representation of a user. Never exposes password/hash."""

    full_name = serializers.CharField(source="get_full_name", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "role",
            "account_status",
            "date_joined",
        ]
        read_only_fields = fields


class FarmerSignupSerializer(serializers.ModelSerializer):
    """
    Registration is scoped to exactly these fields. Neither `role` nor
    `account_status` is a declared field, so a client sending
    `"role": "ADMIN"` or `"account_status": "APPROVED"` has those keys
    silently dropped by DRF — `create()` below is the only thing that sets
    them. The backend is the sole authority on role and status.
    """

    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "password", "password_confirm"]
        # Disable DRF's auto-generated UniqueValidator (from the model's
        # `unique=True`) so duplicate-email always goes through our own
        # validate_email() below, with our own message.
        extra_kwargs = {"email": {"validators": []}}

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return normalized

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        try:
            validate_password(attrs["password"])
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        return User.objects.create_user(
            password=password,
            role=UserRole.FARMER,
            account_status=AccountStatus.PENDING,
            **validated_data,
        )


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class LguOfficerCreateSerializer(serializers.ModelSerializer):
    """
    Admin-only creation of LGU Officer accounts. There is no public
    registration path to this serializer — it is reachable only through an
    IsAdmin-guarded endpoint. Role/status are set server-side, exactly as
    with Farmer signup.
    """

    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "password"]
        extra_kwargs = {"email": {"validators": []}}

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return normalized

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(
            password=password,
            role=UserRole.LGU_OFFICER,
            account_status=AccountStatus.APPROVED,
            **validated_data,
        )
