from django.conf import settings
from django.contrib.auth.hashers import check_password
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from notifications.emails import (
    email_account_reactivated,
    email_account_suspended,
    email_farmer_approved,
    email_farmer_rejected,
    email_officer_welcome,
)
from notifications.services import (
    notify_account_deleted,
    notify_account_reactivated,
    notify_officer_created,
    notify_account_status_changed,
    notify_farmer_approved,
    notify_farmer_registered,
)

from .models import AccountStatus, RegistrationNotification, User, UserRole
from .permissions import IsAdmin, IsApproved
from .serializers import (
    FarmerSignupSerializer,
    LguOfficerCreateSerializer,
    LoginSerializer,
    UserSerializer,
)

# Exact, user-facing messages for each non-approved account state.
STATUS_MESSAGES = {
    AccountStatus.PENDING: "Your account is still waiting for administrator approval.",
    AccountStatus.REJECTED: (
        "Your account registration was not approved. Please contact the administrator."
    ),
    AccountStatus.SUSPENDED: (
        "Your account has been suspended. Please contact the administrator."
    ),
}


def _refresh_max_age():
    return int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())


def _set_refresh_cookie(response, refresh_token):
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=str(refresh_token),
        max_age=_refresh_max_age(),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=settings.REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response):
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        path=settings.REFRESH_COOKIE_PATH,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
    )


def _tokens_response(user, status_code=status.HTTP_200_OK):
    """
    Access token in the JSON body only (held in memory by the frontend).
    Refresh token in an HttpOnly cookie, never exposed to JavaScript.
    """
    refresh = RefreshToken.for_user(user)
    response = Response(
        {"access": str(refresh.access_token), "user": UserSerializer(user).data},
        status=status_code,
    )
    _set_refresh_cookie(response, refresh)
    return response


def _authenticate_for_role(email, password, expected_role):
    """
    Shared credential + role + account-status gate. Every rejection path
    raises AuthenticationFailed so the caller can't tell an unknown email
    from a wrong password.
    """
    email = (email or "").strip().lower()

    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        # Dummy hash comparison so a missing account costs roughly the same
        # time as a wrong password — avoids user enumeration by timing.
        check_password(password, "!")
        raise AuthenticationFailed("Invalid email or password.")

    if not user.check_password(password):
        raise AuthenticationFailed("Invalid email or password.")

    # Role is checked only after the password verifies, so the role-specific
    # message can never be used to probe which accounts exist.
    if user.role != expected_role:
        raise AuthenticationFailed(
            "This account is not registered for this sign-in option. "
            "Use the sign-in option for your role."
        )

    if not user.is_active:
        raise AuthenticationFailed(STATUS_MESSAGES[AccountStatus.SUSPENDED])

    if user.account_status != AccountStatus.APPROVED:
        raise AuthenticationFailed(
            STATUS_MESSAGES.get(user.account_status, "Your account cannot sign in right now.")
        )

    return user


class FarmerSignupView(generics.CreateAPIView):
    """
    POST /api/auth/farmer/signup/
    Creates a FARMER account with account_status=PENDING and raises an
    in-system notification for Admins. Deliberately does NOT return tokens —
    a new Farmer cannot access anything until an Admin approves.
    """

    queryset = User.objects.all()
    serializer_class = FarmerSignupSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        RegistrationNotification.objects.create(user=user)
        # Personal 'waiting for approval' notice + an LGU heads-up. Both
        # are queued until this transaction commits.
        notify_farmer_registered(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "detail": (
                    "Registration submitted. Your Farmer account is waiting for "
                    "administrator approval."
                ),
            },
            status=status.HTTP_201_CREATED,
        )


class FarmerLoginView(APIView):
    """POST /api/auth/farmer/login/"""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = _authenticate_for_role(
            serializer.validated_data["email"],
            serializer.validated_data["password"],
            UserRole.FARMER,
        )
        return _tokens_response(user)


class LguLoginView(APIView):
    """
    POST /api/auth/lgu/login/
    There is no LGU signup endpoint anywhere — Officer accounts exist only
    because an Admin created them.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = _authenticate_for_role(
            serializer.validated_data["email"],
            serializer.validated_data["password"],
            UserRole.LGU_OFFICER,
        )
        return _tokens_response(user)


class AdminLoginView(APIView):
    """POST /api/auth/admin/login/ — Admin accounts come from createsuperuser."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = _authenticate_for_role(
            serializer.validated_data["email"],
            serializer.validated_data["password"],
            UserRole.ADMIN,
        )
        return _tokens_response(user)


class RefreshView(APIView):
    """
    POST /api/auth/refresh/
    Reads the refresh token from the HttpOnly cookie, re-checks the account
    status against the database, and rotates the token. A Farmer suspended
    mid-session cannot renew their session here.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        raw_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not raw_token:
            return Response({"detail": "No active session."}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            old_refresh = RefreshToken(raw_token)
            user = User.objects.get(pk=old_refresh.payload.get("user_id"))
        except (TokenError, InvalidToken, User.DoesNotExist):
            response = Response(
                {"detail": "Session expired. Please sign in again."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            _clear_refresh_cookie(response)
            return response

        if not user.can_sign_in:
            response = Response(
                {
                    "detail": STATUS_MESSAGES.get(
                        user.account_status, "Your account cannot sign in right now."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )
            try:
                old_refresh.blacklist()
            except AttributeError:
                pass
            _clear_refresh_cookie(response)
            return response

        try:
            old_refresh.blacklist()
        except AttributeError:
            pass

        return _tokens_response(user)


class MeView(generics.RetrieveAPIView):
    """
    GET /api/auth/me/
    IsApproved re-reads account_status from the database on every request,
    so revoking access takes effect immediately rather than when the
    15-minute access token expires.
    """

    serializer_class = UserSerializer
    permission_classes = [IsApproved]

    def get_object(self):
        return self.request.user


class LogoutView(APIView):
    """POST /api/auth/logout/ — blacklists the refresh token and clears the cookie."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        raw_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if raw_token:
            try:
                RefreshToken(raw_token).blacklist()
            except (TokenError, InvalidToken, AttributeError):
                pass

        response = Response({"detail": "Logged out."}, status=status.HTTP_200_OK)
        _clear_refresh_cookie(response)
        return response


# --------------------------------------------------------------------------
# Admin account management. Every view below is IsAdmin-guarded.
# --------------------------------------------------------------------------


class AdminUserListView(generics.ListAPIView):
    """
    GET /api/admin/users/            — all accounts
    GET /api/admin/users/?role=FARMER&status=PENDING — filtered
    """

    serializer_class = UserSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        queryset = User.objects.all()
        role = self.request.query_params.get("role")
        account_status = self.request.query_params.get("status")
        if role in UserRole.values:
            queryset = queryset.filter(role=role)
        if account_status in AccountStatus.values:
            queryset = queryset.filter(account_status=account_status)
        return queryset


def _transition(request, user_id, allowed_from, new_status, role=UserRole.FARMER):
    """
    Shared status-transition handler for the Admin actions below.

    `role` scopes which account type an endpoint may touch, so the Farmer
    routes can never be pointed at an Officer (or an Admin) by changing the
    id in the URL. The role and the current status both come from the stored
    row — never from the request body.
    """
    label = "Farmer" if role == UserRole.FARMER else "LGU Officer"
    try:
        user = User.objects.get(pk=user_id, role=role)
    except User.DoesNotExist:
        return Response(
            {"detail": f"{label} account not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if user.account_status not in allowed_from:
        return Response(
            {
                "detail": (
                    f"Cannot change an account from {user.get_account_status_display()} "
                    f"to {AccountStatus(new_status).label}."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    was_suspended = user.account_status == AccountStatus.SUSPENDED
    user.account_status = new_status
    user.save(update_fields=["account_status", "updated_at"])

    # Clear the pending-registration notification once acted upon.
    if new_status in (AccountStatus.APPROVED, AccountStatus.REJECTED):
        RegistrationNotification.objects.filter(user=user, is_read=False).update(is_read=True)

    # Approval is announced farm-wide; rejection and suspension are not
    # broadcast to Officers, but the Farmer and the Admin group are told —
    # an account that silently stops working is the worst outcome here.
    if new_status == AccountStatus.APPROVED:
        if was_suspended:
            notify_account_reactivated(user, actor=request.user)
            email_account_reactivated(user)
        else:
            notify_farmer_approved(user)
            email_farmer_approved(user)
    else:
        notify_account_status_changed(user, new_status=new_status, actor=request.user)
        if new_status == AccountStatus.SUSPENDED:
            email_account_suspended(user)
        elif new_status == AccountStatus.REJECTED:
            email_farmer_rejected(user)

    return Response(UserSerializer(user).data, status=status.HTTP_200_OK)


@api_view(["PATCH"])
@permission_classes([IsAdmin])
def approve_farmer(request, user_id):
    """
    PATCH /api/admin/farmers/{id}/approve/

    Approves from PENDING (normal path), SUSPENDED (reactivation), or
    REJECTED (an Admin reversing a mistaken rejection). Approving an
    already-APPROVED account is refused as a no-op.
    """
    return _transition(
        request,
        user_id,
        {AccountStatus.PENDING, AccountStatus.SUSPENDED, AccountStatus.REJECTED},
        AccountStatus.APPROVED,
    )


@api_view(["PATCH"])
@permission_classes([IsAdmin])
def reject_farmer(request, user_id):
    """PATCH /api/admin/farmers/{id}/reject/ — PENDING -> REJECTED."""
    return _transition(request, user_id, {AccountStatus.PENDING}, AccountStatus.REJECTED)


@api_view(["PATCH"])
@permission_classes([IsAdmin])
def suspend_farmer(request, user_id):
    """PATCH /api/admin/farmers/{id}/suspend/ — APPROVED -> SUSPENDED."""
    return _transition(request, user_id, {AccountStatus.APPROVED}, AccountStatus.SUSPENDED)


class AdminCreateLguOfficerView(generics.CreateAPIView):
    """POST /api/admin/lgu-officers/ — the only way an LGU Officer account can exist."""

    serializer_class = LguOfficerCreateSerializer
    permission_classes = [IsAdmin]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        # The officer has no registration path, so this is their only signal
        # that an account exists. Admins get an audit copy.
        notify_officer_created(user, actor=request.user)
        email_officer_welcome(user)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAdmin])
def pending_registrations(request):
    """
    GET /api/admin/notifications/
    Unread in-system notifications for new Farmer registrations.
    """
    notifications = RegistrationNotification.objects.filter(
        is_read=False, user__account_status=AccountStatus.PENDING
    ).select_related("user")
    return Response(
        [
            {
                "id": n.id,
                "created_at": n.created_at,
                "user": UserSerializer(n.user).data,
            }
            for n in notifications
        ]
    )


@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_dashboard(request):
    """
    GET /api/admin/dashboard/ — account figures for the Admin overview.

    Every number is counted in MySQL. Nothing here is estimated, cached or
    passed in by the client, so the Admin screen cannot drift from the
    database the way a hardcoded figure would.
    """
    from notifications.models import Notification

    farmers = User.objects.filter(role=UserRole.FARMER)
    by_status = {
        status_value: farmers.filter(account_status=status_value).count()
        for status_value, _ in AccountStatus.choices
    }

    return Response(
        {
            "farmers": {
                "total": farmers.count(),
                "pending": by_status[AccountStatus.PENDING],
                "approved": by_status[AccountStatus.APPROVED],
                "rejected": by_status[AccountStatus.REJECTED],
                "suspended": by_status[AccountStatus.SUSPENDED],
            },
            "lgu_officers": User.objects.filter(
                role=UserRole.LGU_OFFICER, account_status=AccountStatus.APPROVED
            ).count(),
            "admins": User.objects.filter(role=UserRole.ADMIN).count(),
            # This Admin's own unread count — never a global total.
            "unread_notifications": Notification.objects.filter(
                recipient=request.user, is_read=False
            ).count(),
        }
    )


@api_view(["PATCH"])
@permission_classes([IsAdmin])
def suspend_officer(request, user_id):
    """PATCH /api/admin/officers/{id}/suspend/ — APPROVED -> SUSPENDED."""
    return _transition(
        request,
        user_id,
        {AccountStatus.APPROVED},
        AccountStatus.SUSPENDED,
        role=UserRole.LGU_OFFICER,
    )


@api_view(["PATCH"])
@permission_classes([IsAdmin])
def reactivate_officer(request, user_id):
    """PATCH /api/admin/officers/{id}/reactivate/ — SUSPENDED -> APPROVED."""
    return _transition(
        request,
        user_id,
        {AccountStatus.SUSPENDED},
        AccountStatus.APPROVED,
        role=UserRole.LGU_OFFICER,
    )


# Records that represent real agricultural history. An account that owns any
# of these is never hard-deleted — see `delete_account`.
def _history_counts(user):
    from plants.models import Assessment, Plant, SoilRecommendation

    return {
        "plants": Plant.objects.filter(farmer=user).count(),
        "assessments": Assessment.objects.filter(plant__farmer=user).count(),
        "soil_recommendations": SoilRecommendation.objects.filter(farmer=user).count(),
    }


@api_view(["DELETE"])
@permission_classes([IsAdmin])
def delete_account(request, user_id):
    """
    DELETE /api/admin/accounts/{id}/ — permanently remove an account.

    Deliberately conservative. `Plant.farmer`, `SoilRecommendation.farmer` and
    `Notification.recipient` all cascade, so deleting an active Farmer would
    silently destroy their plants, weekly assessments, risk history and
    evidence photos. That is agricultural history the farm cannot recreate,
    and losing it to a mis-click is far worse than leaving a disabled account
    in the table.

    So deletion is allowed only for accounts that own no such history —
    typically a registration that was never approved. Anything else is
    refused with 409 and the Admin is told to suspend instead, which the
    permission layer already treats as a full lockout.

    An Admin can never delete their own account, and never another Admin.
    """
    if user_id == request.user.pk:
        return Response(
            {"detail": "Your current administrator account cannot be deleted."},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response(
            {"detail": "Account not found."}, status=status.HTTP_404_NOT_FOUND
        )

    if user.role == UserRole.ADMIN:
        return Response(
            {"detail": "Administrator accounts cannot be deleted from here."},
            status=status.HTTP_403_FORBIDDEN,
        )

    history = _history_counts(user)
    if any(history.values()):
        return Response(
            {
                "detail": (
                    "This account has farm records and cannot be deleted. "
                    "Suspend it instead — a suspended account loses access "
                    "immediately while its history is kept."
                ),
                "history": history,
            },
            status=status.HTTP_409_CONFLICT,
        )

    # Snapshot before deleting — the row is gone by the time the audit
    # notification is emitted after commit.
    deleted = {
        "name": user.get_full_name(),
        "email": user.email,
        "role": user.role,
        "deleted_id": user.pk,
    }
    user.delete()
    notify_account_deleted(actor=request.user, **deleted)
    return Response(
        {"detail": f"{deleted['email']} has been deleted."}, status=status.HTTP_200_OK
    )
