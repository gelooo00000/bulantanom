from rest_framework.permissions import BasePermission

from .models import AccountStatus, UserRole


class _RolePermission(BasePermission):
    """
    Base for role checks. Requires an authenticated user whose account is
    APPROVED *and* whose role matches — so a suspended/rejected user is
    locked out of every protected endpoint even if they still hold a
    technically-valid access token.
    """

    role = None

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.account_status == AccountStatus.APPROVED
            and user.role == self.role
        )


class IsFarmer(_RolePermission):
    role = UserRole.FARMER
    message = "This action is only available to approved Farmer accounts."


class IsLguOfficer(_RolePermission):
    role = UserRole.LGU_OFFICER
    message = "This action is only available to approved LGU Officer accounts."


class IsAdmin(_RolePermission):
    role = UserRole.ADMIN
    message = "This action is only available to Admin accounts."


class IsApproved(BasePermission):
    """Any role, but the account must be active and approved."""

    message = "Your account is not currently approved for access."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.can_sign_in)
