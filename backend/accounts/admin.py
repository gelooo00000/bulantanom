"""
Django Admin is the official account-management interface for LGU Officers.

There is still one identity model (`accounts.User`). `Farmer` and `LguOfficer`
are proxies over it, so the admin can present role-scoped screens without a
second user table or a second authentication path.

Passwords are handled by Django's own hashing throughout — the creation form
calls `set_password()` and the change form shows only the hash, never a
recoverable value.
"""

from django import forms
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import AdminPasswordChangeForm, ReadOnlyPasswordHashField
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from .models import AccountStatus, Farmer, LguOfficer, RegistrationNotification, User, UserRole


class UserCreationForm(forms.ModelForm):
    """
    Creation form for the email-based user model.

    Django's stock `UserCreationForm` assumes a `username` field, so this is
    the email equivalent: two password entries, run through the project's
    configured validators and stored hashed.
    """

    password1 = forms.CharField(
        label="Password", widget=forms.PasswordInput, strip=False
    )
    password2 = forms.CharField(
        label="Confirm password",
        widget=forms.PasswordInput,
        strip=False,
        help_text="Enter the same password again for verification.",
    )

    class Meta:
        model = User
        fields = ("email", "first_name", "last_name")

    def clean_email(self):
        # Emails are stored lowercase so uniqueness is not case-dependent.
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError("An account with this email already exists.")
        return email

    def clean_password2(self):
        password1 = self.cleaned_data.get("password1")
        password2 = self.cleaned_data.get("password2")
        if password1 and password2 and password1 != password2:
            raise ValidationError("The two password fields do not match.")
        validate_password(password2)
        return password2

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data["email"]
        user.set_password(self.cleaned_data["password2"])
        if commit:
            user.save()
        return user


class UserChangeForm(forms.ModelForm):
    """
    Edit form. The password is shown as its stored hash with a link to the
    admin's own change-password screen — the raw value is never rendered and
    cannot be edited here.
    """

    password = ReadOnlyPasswordHashField(
        label="Password",
        help_text="Passwords are stored hashed. Use the link above to set a new one.",
    )

    class Meta:
        model = User
        fields = "__all__"

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        clash = User.objects.filter(email__iexact=email).exclude(pk=self.instance.pk)
        if clash.exists():
            raise ValidationError("An account with this email already exists.")
        return email


class BaseAccountAdmin(DjangoUserAdmin):
    """Shared configuration for every account screen in the admin."""

    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm

    list_display = (
        "email",
        "get_full_name",
        "role",
        "account_status",
        "is_active",
        "is_staff",
        "date_joined",
    )
    list_filter = ("role", "account_status", "is_active", "is_staff")
    search_fields = ("email", "first_name", "last_name")
    ordering = ("-date_joined",)
    readonly_fields = ("date_joined", "updated_at", "last_login")
    filter_horizontal = ("groups", "user_permissions")

    fieldsets = (
        ("Sign-in", {"fields": ("email", "password")}),
        ("Personal information", {"fields": ("first_name", "last_name")}),
        ("BulanTanom access", {"fields": ("role", "account_status", "is_active")}),
        (
            "Django Admin permissions",
            {
                "classes": ("collapse",),
                "description": (
                    "Leave these off for ordinary accounts. A BulanTanom role of "
                    "LGU Officer does NOT require Django Admin access — grant staff "
                    "status only if this person must also administer Django itself."
                ),
                "fields": ("is_staff", "is_superuser", "groups", "user_permissions"),
            },
        ),
        ("Dates", {"fields": ("date_joined", "updated_at", "last_login")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "first_name", "last_name", "password1", "password2"),
            },
        ),
    )

    @admin.display(description="Full name", ordering="first_name")
    def get_full_name(self, obj):
        return obj.get_full_name()


@admin.register(User)
class UserAdmin(BaseAccountAdmin):
    """Every account, any role. The role-scoped screens below are subsets."""


class RoleScopedAdmin(BaseAccountAdmin):
    """
    A role-locked account screen.

    The queryset only ever shows this role, and `role` is forced on save, so
    an account created or edited here cannot silently become another role.
    """

    role = None
    default_account_status = AccountStatus.APPROVED

    list_display = (
        "email",
        "get_full_name",
        "account_status",
        "is_active",
        "date_joined",
    )
    list_filter = ("account_status", "is_active")

    fieldsets = (
        ("Sign-in", {"fields": ("email", "password")}),
        ("Personal information", {"fields": ("first_name", "last_name")}),
        ("BulanTanom access", {"fields": ("account_status", "is_active")}),
        (
            "Django Admin permissions",
            {
                "classes": ("collapse",),
                "description": (
                    "Not required to use BulanTanom. Grant staff status only if "
                    "this person must also administer Django itself."
                ),
                "fields": ("is_staff", "is_superuser", "groups", "user_permissions"),
            },
        ),
        ("Dates", {"fields": ("date_joined", "updated_at", "last_login")}),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).filter(role=self.role)

    def save_model(self, request, obj, form, change):
        # The role is set by the screen, never by the form, so it cannot be
        # tampered with and cannot drift when an account is edited.
        obj.role = self.role
        if not change and not obj.account_status:
            obj.account_status = self.default_account_status
        super().save_model(request, obj, form, change)


@admin.register(LguOfficer)
class LguOfficerAdmin(RoleScopedAdmin):
    """
    The official way to provision an LGU Officer. There is deliberately no
    public signup for this role.

    New officers are approved and active immediately so they can sign in to
    BulanTanom right away, but they are NOT given Django staff access — see
    the collapsed permissions section for that.
    """

    role = UserRole.LGU_OFFICER

    def save_model(self, request, obj, form, change):
        creating = not change
        if creating:
            obj.account_status = AccountStatus.APPROVED
            obj.is_active = True
            # A BulanTanom role is not a Django Admin role.
            obj.is_staff = False
            obj.is_superuser = False
        super().save_model(request, obj, form, change)
        if creating:
            messages.info(
                request,
                f"{obj.get_full_name() or obj.email} can now sign in to BulanTanom "
                "as an LGU Officer. They do not have Django Admin access.",
            )


@admin.register(Farmer)
class FarmerAdmin(RoleScopedAdmin):
    """
    Farmer accounts. These normally arrive through public signup and are
    approved by an administrator, so new ones added here start PENDING to
    match that workflow rather than bypassing it.
    """

    role = UserRole.FARMER
    default_account_status = AccountStatus.PENDING

    def save_model(self, request, obj, form, change):
        if not change:
            obj.account_status = AccountStatus.PENDING
            obj.is_staff = False
            obj.is_superuser = False
        super().save_model(request, obj, form, change)


@admin.register(RegistrationNotification)
class RegistrationNotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at", "is_read")
    list_filter = ("is_read",)
    readonly_fields = ("user", "created_at")
