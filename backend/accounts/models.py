from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone


class UserRole(models.TextChoices):
    FARMER = "FARMER", "Farmer"
    LGU_OFFICER = "LGU_OFFICER", "LGU Officer"
    ADMIN = "ADMIN", "Admin"


class AccountStatus(models.TextChoices):
    """
    Explicit account lifecycle. Deliberately not a boolean — the system has
    to tell "waiting for approval" apart from "rejected" and "suspended",
    each of which produces a different login message.
    """

    PENDING = "PENDING", "Pending approval"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"
    SUSPENDED = "SUSPENDED", "Suspended"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", UserRole.FARMER)
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        # Public Farmer registration always starts unapproved; callers that
        # legitimately create pre-approved accounts (Admin creating an LGU
        # Officer, createsuperuser) pass account_status explicitly.
        extra_fields.setdefault("account_status", AccountStatus.PENDING)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", UserRole.ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("account_status", AccountStatus.APPROVED)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Single identity model for every BulanTanom role. Authorization is done
    by `role` + `account_status`, never by the client — see
    `accounts.permissions` and the login views.

    Future Farmer-owned models (Plant, Assessment, Harvest, ...) attach to
    this model with `models.ForeignKey(settings.AUTH_USER_MODEL, ...)` so
    every record has an owner and can be filtered by `request.user`.
    """

    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.FARMER)
    account_status = models.CharField(
        max_length=20, choices=AccountStatus.choices, default=AccountStatus.PENDING
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    date_joined = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        ordering = ["-date_joined"]

    def __str__(self):
        return self.email

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def get_short_name(self):
        return self.first_name

    @property
    def can_sign_in(self):
        return self.is_active and self.account_status == AccountStatus.APPROVED


class FarmerManager(UserManager):
    def get_queryset(self):
        return super().get_queryset().filter(role=UserRole.FARMER)


class LguOfficerManager(UserManager):
    def get_queryset(self):
        return super().get_queryset().filter(role=UserRole.LGU_OFFICER)


class Farmer(User):
    """
    Proxy over `User`, scoped to Farmers.

    Proxy models add no table and no columns — this is purely so Django Admin
    can present "Farmers" and "LGU Officers" as separate, role-scoped screens
    over the one identity table. There is still exactly one user model.
    """

    objects = FarmerManager()

    class Meta:
        proxy = True
        verbose_name = "Farmer"
        verbose_name_plural = "Farmers"


class LguOfficer(User):
    """
    Proxy over `User`, scoped to LGU Officers. See `Farmer` — same table,
    same authentication, only a role-scoped admin view.
    """

    objects = LguOfficerManager()

    class Meta:
        proxy = True
        verbose_name = "LGU Officer"
        verbose_name_plural = "LGU Officers"


class RegistrationNotification(models.Model):
    """
    In-system notification raised for Admins when a Farmer registers.
    Deliberately DB-backed (not email/SMS) for this milestone.
    """

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="registration_notifications"
    )
    created_at = models.DateTimeField(default=timezone.now)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Registration: {self.user.email}"
