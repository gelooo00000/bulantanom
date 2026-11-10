from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import AuthenticationFailed, Throttled
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from notifications.emails import (
    email_account_deleted,
    email_farmer_welcome,
    email_password_changed,
)
from notifications.services import notify_account_deleted, notify_farmer_registered

from .devices import (
    forget_devices,
    is_trusted,
    make_challenge,
    read_challenge,
    trust_device,
)
from .lifecycle import announce_officer_created, announce_status_change
from .usage import record_minute
from .sessions import (
    SID_CLAIM,
    SIGNED_IN_ELSEWHERE,
    SIGNED_IN_ELSEWHERE_MESSAGE,
    is_current,
    start_session,
)
from .models import AccountStatus, RegistrationNotification, User, UserRole
from .permissions import IsAdmin, IsApproved
from .serializers import (
    FarmerSignupSerializer,
    LguOfficerCreateSerializer,
    LoginCodeResendSerializer,
    LoginCodeSerializer,
    LoginSerializer,
    MeUpdateSerializer,
    ResendCodeSerializer,
    ResetPasswordSerializer,
    UserSerializer,
    VerifyCodeSerializer,
)
from .throttles import LOGIN_THROTTLES, RESEND_THROTTLES, SIGNUP_THROTTLES, VERIFY_THROTTLES
from .verification import (
    RESEND_COOLDOWN,
    CodeSendFailed,
    ResendTooSoon,
    check_code,
    send_code,
)

CODE_SEND_FAILED = (
    "We couldn't send a verification code to this email right now. "
    "Please check the address and try again in a few minutes."
)
CODE_MESSAGES = {
    "invalid": "That code is not correct. Check the email we sent and try again.",
    "expired": 'That code has expired. Tap "Resend code" to get a new one.',
    "locked": 'Too many wrong codes. Tap "Resend code" to get a new one.',
}


def _verification_pending(user, *, status_code, detail):
    """The body the sign-up page and login page both turn into the code step."""
    return Response(
        {
            "detail": detail,
            "code": "email_not_verified",
            "email": user.email,
            "resend_after": int(RESEND_COOLDOWN.total_seconds()),
        },
        status=status_code,
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


def _set_refresh_cookie(response, refresh_token):
    # Deliberately a session cookie: no max_age or expires, so the browser
    # drops it when it closes and reopening lands signed out instead of back
    # inside a Farmer, LGU or Admin account nobody logged out of. The token
    # itself still expires after REFRESH_TOKEN_LIFETIME, enforced server-side.
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=str(refresh_token),
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


def _tokens_response(user, status_code=status.HTTP_200_OK, *, session_key=None):
    """
    Access token in the JSON body only (held in memory by the frontend).
    Refresh token in an HttpOnly cookie, never exposed to JavaScript.

    Without `session_key` this is a new sign-in, which starts a new session
    and so signs the account out everywhere else (accounts.sessions). A
    refresh passes the session it is continuing.
    """
    refresh = RefreshToken.for_user(user)
    refresh[SID_CLAIM] = session_key if session_key is not None else start_session(user)
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

    Creates an approved but unverified FARMER account and emails it a
    one-time code (accounts.verification). No tokens yet: the farmer is
    signed in by FarmerVerifyView once the code comes back, which proves the
    address is real. If the code cannot be sent, nothing is kept.

    An Admin can still suspend or reject the account afterwards, and the
    status check in `_authenticate_for_role` will refuse the next sign-in.
    """

    queryset = User.objects.all()
    serializer_class = FarmerSignupSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = SIGNUP_THROTTLES

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                user = serializer.save()
                send_code(user, enforce_cooldown=False)
        except CodeSendFailed:
            return Response(
                {"detail": CODE_SEND_FAILED}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        return _verification_pending(
            user,
            status_code=status.HTTP_201_CREATED,
            detail=f"We sent a 6-digit code to {user.email}.",
        )


def _unverified_farmer(email):
    return User.objects.filter(
        email__iexact=(email or "").strip().lower(),
        role=UserRole.FARMER,
        email_verified=False,
    ).first()


class FarmerVerifyView(APIView):
    """
    POST /api/auth/farmer/verify/ {email, code}

    Checks the emailed code; on success the account is verified, announced
    (welcome email, LGU and Admin notices - never for an address nobody
    proved) and signed in with the same token shape as login.
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = VERIFY_THROTTLES

    def post(self, request):
        serializer = VerifyCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = _unverified_farmer(serializer.validated_data["email"])
        if user is None:
            # Same answer for an unknown address as for a wrong code.
            return Response(
                {"detail": CODE_MESSAGES["invalid"]}, status=status.HTTP_400_BAD_REQUEST
            )

        result = check_code(user, serializer.validated_data["code"])
        if result != "ok":
            return Response(
                {"detail": CODE_MESSAGES[result]}, status=status.HTTP_400_BAD_REQUEST
            )

        if not user.can_sign_in:
            raise AuthenticationFailed(
                STATUS_MESSAGES.get(user.account_status, "Your account cannot sign in right now.")
            )
        # Announced once. An older account re-verifying its email was
        # announced when it first signed up, so nobody is told it is new.
        if not RegistrationNotification.objects.filter(user=user).exists():
            RegistrationNotification.objects.create(user=user)
            # Welcome notice + an LGU heads-up that a new Farmer has joined.
            # Both are queued until this transaction commits.
            notify_farmer_registered(user)
            email_farmer_welcome(user)
        # The code just proved this browser reads the inbox, so the next
        # sign-in here does not ask for another one.
        response = _tokens_response(user)
        trust_device(request, response, user)
        return response


def _send_code_or_error(user, *, purpose="signup"):
    """Sends a code; the Response to return instead if it could not go."""
    try:
        send_code(user, purpose=purpose)
    except ResendTooSoon as exc:
        return Response(
            {
                "detail": f"Please wait {exc.wait_seconds} seconds before asking for another code.",
                "resend_after": exc.wait_seconds,
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    except CodeSendFailed:
        return Response({"detail": CODE_SEND_FAILED}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return None


class FarmerResendCodeView(APIView):
    """
    POST /api/auth/farmer/resend-code/ {email}

    A fresh code for an unfinished sign-up. Answers the same whether or not
    the address has one, so it cannot be used to discover accounts.
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = RESEND_THROTTLES

    def post(self, request):
        serializer = ResendCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        user = _unverified_farmer(email)
        if user is not None:
            error = _send_code_or_error(user)
            if error is not None:
                return error
        return Response(
            {
                "detail": f"We sent a new code to {email}.",
                "resend_after": int(RESEND_COOLDOWN.total_seconds()),
            }
        )


def _resettable_farmer(email):
    """A finished Farmer account allowed to sign in; only these reset a password."""
    return User.objects.filter(
        email__iexact=(email or "").strip().lower(),
        role=UserRole.FARMER,
        pending_signup=False,
        is_active=True,
        account_status=AccountStatus.APPROVED,
    ).first()


class FarmerForgotPasswordView(APIView):
    """
    POST /api/auth/farmer/forgot-password/ {email}

    Emails a one-time code for FarmerResetPasswordView. Answers the same
    whether or not the address has an account. LGU Officers and Admins are
    not served here: their passwords are reset by an Admin.
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = RESEND_THROTTLES

    def post(self, request):
        serializer = ResendCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        user = _resettable_farmer(email)
        if user is not None:
            error = _send_code_or_error(user, purpose="reset")
            if error is not None:
                return error
        return Response(
            {
                "detail": f"If {email} has an account, we sent it a 6-digit code.",
                "resend_after": int(RESEND_COOLDOWN.total_seconds()),
            }
        )


class FarmerResetPasswordView(APIView):
    """
    POST /api/auth/farmer/reset-password/ {email, code, password, password_confirm}

    Sets a new password and ends every session of the account, so anyone
    already signed in with the old password is signed out too. The Farmer
    then signs in as usual.
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = VERIFY_THROTTLES

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = _resettable_farmer(data["email"])
        if user is None:
            # Same answer for an unknown address as for a wrong code.
            return Response(
                {"detail": CODE_MESSAGES["invalid"]}, status=status.HTTP_400_BAD_REQUEST
            )

        # Before the code is checked, so a weak password does not spend it.
        try:
            validate_password(data["password"], user)
        except DjangoValidationError as exc:
            return Response({"password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            result = check_code(user, data["code"], purpose="reset")
            if result != "ok":
                return Response(
                    {"detail": CODE_MESSAGES[result]}, status=status.HTTP_400_BAD_REQUEST
                )
            user.set_password(data["password"])
            user.save(update_fields=["password", "updated_at"])
            for token in OutstandingToken.objects.filter(user=user):
                BlacklistedToken.objects.get_or_create(token=token)
            # Whoever knew the old password may have trusted a device with
            # it; every device proves itself again with a new code.
            forget_devices(user)
            # So the owner hears about a reset they did not ask for.
            email_password_changed(user)
        return Response({"detail": "Your password has been changed. Please sign in."})


NEW_DEVICE_MESSAGE = (
    "You are signing in on a new device. To make sure it is you, we sent a "
    "6-digit code to {email}."
)
CHALLENGE_EXPIRED = "This sign-in has expired. Please sign in again."


def _finish_login(request, user):
    """
    Signs in a user whose password, role and status all checked out - unless
    this browser is new to the account, in which case a code is emailed and
    the answer is a challenge for LoginCodeVerifyView (see accounts.devices).
    """
    if not settings.NEW_DEVICE_CHECK or is_trusted(request, user):
        return _tokens_response(user)
    try:
        send_code(user, purpose="login")
    except ResendTooSoon:
        pass  # One went less than a minute ago; that code still works.
    except CodeSendFailed:
        return Response({"detail": CODE_SEND_FAILED}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return Response(
        {
            "detail": NEW_DEVICE_MESSAGE.format(email=user.email),
            "code": "new_device",
            "email": user.email,
            "challenge": make_challenge(user),
            "resend_after": int(RESEND_COOLDOWN.total_seconds()),
        },
        status=status.HTTP_403_FORBIDDEN,
    )


def _challenged_user(data):
    """The user behind a challenge, if it is valid and matches the email sent."""
    user = read_challenge(data["challenge"])
    if user is None or user.email.lower() != data["email"].strip().lower():
        return None
    return user


class LoginCodeVerifyView(APIView):
    """
    POST /api/auth/login/verify/ {email, challenge, code}

    Second step of a sign-in on a new device, for every role: the challenge
    proves the password was right, the code proves the inbox is theirs. On
    success the browser is trusted and signed in.
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = VERIFY_THROTTLES

    def post(self, request):
        serializer = LoginCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = _challenged_user(serializer.validated_data)
        if user is None:
            return Response({"detail": CHALLENGE_EXPIRED}, status=status.HTTP_400_BAD_REQUEST)

        # Suspended while the code was on its way: refused like a login.
        if not user.can_sign_in:
            raise AuthenticationFailed(
                STATUS_MESSAGES.get(user.account_status, "Your account cannot sign in right now.")
            )

        result = check_code(user, serializer.validated_data["code"], purpose="login")
        if result != "ok":
            return Response({"detail": CODE_MESSAGES[result]}, status=status.HTTP_400_BAD_REQUEST)

        response = _tokens_response(user)
        trust_device(request, response, user)
        return response


class LoginCodeResendView(APIView):
    """POST /api/auth/login/resend-code/ {email, challenge} - a fresh new-device code."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = RESEND_THROTTLES

    def post(self, request):
        serializer = LoginCodeResendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = _challenged_user(serializer.validated_data)
        if user is None:
            return Response({"detail": CHALLENGE_EXPIRED}, status=status.HTTP_400_BAD_REQUEST)
        error = _send_code_or_error(user, purpose="login")
        if error is not None:
            return error
        return Response(
            {
                "detail": f"We sent a new code to {user.email}.",
                "resend_after": int(RESEND_COOLDOWN.total_seconds()),
            }
        )


class _LoginThrottleMixin:
    """Rate-limits a sign-in view (see accounts.throttles) with a plain message."""

    throttle_classes = LOGIN_THROTTLES

    def throttled(self, request, wait):
        minutes = max(1, -(-int(wait or 60) // 60))
        exc = Throttled(
            detail=(
                "Too many sign-in attempts. Please wait "
                f"{minutes} minute{'s' if minutes != 1 else ''} and try again."
            ),
        )
        # Set after construction: passed in, DRF would append its own
        # "Expected available in N seconds." to the message. The
        # Retry-After header still comes from it.
        exc.wait = wait
        raise exc


class FarmerLoginView(_LoginThrottleMixin, APIView):
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
        if not user.email_verified:
            # Right password, unfinished sign-up: send a code (unless one
            # just went) and ask for it instead of signing in.
            try:
                send_code(user)
            except ResendTooSoon:
                pass
            except CodeSendFailed:
                return Response(
                    {"detail": CODE_SEND_FAILED}, status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            return _verification_pending(
                user,
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Please verify your email first. We sent a 6-digit code to {user.email}.",
            )
        return _finish_login(request, user)


class LguLoginView(_LoginThrottleMixin, APIView):
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
        return _finish_login(request, user)


class AdminLoginView(_LoginThrottleMixin, APIView):
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
        return _finish_login(request, user)


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

        # An email not yet verified (an older account asked to confirm its
        # address) ends the session here; signing in again asks for the code.
        if not user.email_verified:
            response = Response(
                {"detail": "Please sign in again to verify your email."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            try:
                old_refresh.blacklist()
            except AttributeError:
                pass
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

        # Another device signed in since: this one's session is over.
        if not is_current(user, old_refresh):
            response = Response(
                {"detail": SIGNED_IN_ELSEWHERE_MESSAGE, "code": SIGNED_IN_ELSEWHERE},
                status=status.HTTP_401_UNAUTHORIZED,
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

        return _tokens_response(user, session_key=user.session_key)


class MeView(generics.RetrieveAPIView):
    """
    GET /api/auth/me/ — the signed-in user.
    PATCH /api/auth/me/ — change what a user may change about themselves
    (only `gender`); answers with the whole user, as GET does.
    IsApproved re-reads account_status from the database on every request,
    so revoking access takes effect immediately rather than when the
    15-minute access token expires.
    """

    serializer_class = UserSerializer
    permission_classes = [IsApproved]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user

    def patch(self, request):
        serializer = MeUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class LogoutView(APIView):
    """POST /api/auth/logout/ — blacklists the refresh token and clears the cookie."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        raw_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if raw_token:
            try:
                token = RefreshToken(raw_token)
                # Takes the user offline for the LGU at once, rather than
                # leaving them "online" until the presence window lapses.
                User.objects.filter(pk=token[api_settings.USER_ID_CLAIM]).update(
                    last_logout_at=timezone.now()
                )
                token.blacklist()
            except (TokenError, InvalidToken, AttributeError, KeyError):
                pass

        response = Response({"detail": "Logged out."}, status=status.HTTP_200_OK)
        _clear_refresh_cookie(response)
        return response


class HeartbeatView(APIView):
    """
    POST /api/auth/heartbeat/ — "this user still has BulanTanom open".

    The work is done by `PresenceJWTAuthentication`, which stamps
    `last_seen_at` while authenticating the request; the view only has to
    exist and succeed.
    """

    def post(self, request):
        # Each heartbeat is a minute of BulanTanom open on screen.
        record_minute(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


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

    def list(self, request, *args, **kwargs):
        """
        Each account plus what an Admin needs to act on it: the Farmer's
        records (what a deletion would destroy), and whether the person is
        using BulanTanom right now or when they last were.
        """
        from django.db.models import Count
        from django.utils import timezone

        from .presence import is_online

        accounts = self.filter_queryset(self.get_queryset()).annotate(
            plant_count=Count("plants", distinct=True),
            assessment_count=Count("plants__assessments", distinct=True),
            soil_record_count=Count("soil_recommendations", distinct=True),
        )
        now = timezone.now()
        rows = []
        for user in accounts:
            row = self.get_serializer(user).data
            row["plant_count"] = user.plant_count
            row["assessment_count"] = user.assessment_count
            row["soil_record_count"] = user.soil_record_count
            row["is_online"] = is_online(user, now)
            row["last_seen_at"] = user.last_seen_at.isoformat() if user.last_seen_at else None
            rows.append(row)
        return Response(rows)

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

    old_status = user.account_status
    user.account_status = new_status
    user.save(update_fields=["account_status", "updated_at"])
    announce_status_change(
        user, old_status=old_status, new_status=new_status, actor=request.user
    )

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


@api_view(["PATCH"])
@permission_classes([IsAdmin])
def set_gender(request, user_id):
    """
    PATCH /api/admin/accounts/{id}/gender/ — {"gender": "MALE" | "FEMALE" |
    "UNDISCLOSED" | ""}. Only Farmer and LGU Officer accounts; the user can
    still change it themselves afterwards.
    """
    user = User.objects.filter(
        pk=user_id, role__in=[UserRole.FARMER, UserRole.LGU_OFFICER]
    ).first()
    if user is None:
        return Response({"detail": "Account not found."}, status=status.HTTP_404_NOT_FOUND)
    serializer = MeUpdateSerializer(user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(UserSerializer(user).data)


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
        announce_officer_created(user, actor=request.user)
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

    `Plant.farmer`, `SoilRecommendation.farmer` and `Notification.recipient`
    all cascade, so deleting a Farmer who has records also destroys their
    plants, weekly assessments, risk history and evidence photos — history
    the farm cannot recreate.

    So an account with records is refused (409, with the counts) unless the
    request carries `?include_records=true`, which the Admin screen sends
    only after a confirmation that lists what will be lost and asks for the
    account's email to be typed. Suspending remains the way to lock an
    account out while keeping its history.

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

    # An account that owns farm records is deleted only when the Admin has
    # explicitly confirmed losing them (`?include_records=true`, sent after
    # the confirmation that lists exactly what goes). Without it the request
    # is refused with the counts, so a mis-click or an old client can never
    # wipe a Farmer's history silently.
    history = _history_counts(user)
    include_records = request.query_params.get("include_records") == "true"
    if any(history.values()) and not include_records:
        return Response(
            {
                "detail": (
                    "This account has farm records. Deleting it also permanently "
                    "deletes them — confirm that to continue, or suspend the "
                    "account instead to keep its history."
                ),
                "history": history,
            },
            status=status.HTTP_409_CONFLICT,
        )

    # Evidence photos are files, not rows: the cascade removes the
    # assessments but would leave their images behind in storage.
    if history["assessments"]:
        from plants.models import Assessment

        for assessment in Assessment.objects.filter(plant__farmer=user).exclude(
            evidence_image=""
        ):
            if assessment.evidence_image:
                assessment.evidence_image.delete(save=False)

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
    # Tell the person too — by email, since their in-app inbox went with the
    # account. Sent after commit, from the snapshot taken above.
    email_account_deleted(
        name=deleted["name"], email=deleted["email"], role=deleted["role"], history=history
    )
    return Response(
        {"detail": f"{deleted['email']} has been deleted."}, status=status.HTTP_200_OK
    )
