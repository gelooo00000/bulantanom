from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .email_check import email_problem
from .invites import awaiting_password
from .text_validation import clean, name_problem
from .models import AccountStatus, User, UserRole


class UserSerializer(serializers.ModelSerializer):
    """Safe representation of a user. Never exposes password/hash."""

    full_name = serializers.CharField(source="get_full_name", read_only=True)
    # True only for a Farmer an Admin created who has not opened the invite
    # and chosen a password yet.
    invite_pending = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "gender",
            "role",
            "account_status",
            "email_verified",
            "invite_pending",
            "date_joined",
        ]
        read_only_fields = fields

    def get_invite_pending(self, user):
        return awaiting_password(user)


class FarmerCreateSerializer(serializers.ModelSerializer):
    """
    Admin-only creation of a Farmer account: name and email only. The Farmer
    chooses their own password from the invite email (accounts.invites), so
    no password is taken here. Neither `role` nor `account_status` is a
    declared field, so a client cannot set them; `create()` does.
    """

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "gender"]
        # Our own duplicate-email check and message, not DRF's.
        extra_kwargs = {
            "email": {"validators": []},
            "gender": {"required": False},
            "last_name": {"required": False},
        }

    def validate_first_name(self, value):
        problem = name_problem(value, "First name")
        if problem:
            raise serializers.ValidationError(problem)
        return clean(value)

    def validate_last_name(self, value):
        problem = name_problem(value, "Last name", required=False)
        if problem:
            raise serializers.ValidationError(problem)
        return clean(value)

    def validate_email(self, value):
        normalized = value.strip().lower()
        # An old sign-up nobody finished does not hold the address.
        if User.objects.filter(email__iexact=normalized, pending_signup=False).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        problem = email_problem(normalized)
        if problem:
            raise serializers.ValidationError(problem)
        return normalized

    def create(self, validated_data):
        User.objects.filter(
            email__iexact=validated_data["email"], pending_signup=True, role=UserRole.FARMER
        ).delete()
        # No usable password until the Farmer sets one from the invite, so
        # nobody can sign in to the account before then. Opening the link
        # proves the inbox, which is when the email counts as verified.
        return User.objects.create_user(
            password=None,
            role=UserRole.FARMER,
            account_status=AccountStatus.APPROVED,
            email_verified=False,
            pending_signup=False,
            **validated_data,
        )


class SetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField(max_length=64)
    token = serializers.CharField(max_length=128)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return attrs


class MeUpdateSerializer(serializers.ModelSerializer):
    """What a signed-in user may change about themselves: only their gender."""

    class Meta:
        model = User
        fields = ["gender"]


class VerifyCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=12)


class ResendCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=12)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return attrs


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class LoginCodeResendSerializer(serializers.Serializer):
    email = serializers.EmailField()
    challenge = serializers.CharField(max_length=500)


class LoginCodeSerializer(LoginCodeResendSerializer):
    code = serializers.CharField(max_length=12)


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
        fields = ["first_name", "last_name", "email", "gender", "password"]
        extra_kwargs = {"email": {"validators": []}, "gender": {"required": False}}

    def validate_first_name(self, value):
        problem = name_problem(value, "First name")
        if problem:
            raise serializers.ValidationError(problem)
        return clean(value)

    def validate_last_name(self, value):
        problem = name_problem(value, "Last name", required=True)
        if problem:
            raise serializers.ValidationError(problem)
        return clean(value)

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
