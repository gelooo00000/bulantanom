"""
Who is told when an account is created or changes status.

One place for it, used by the BulanTanom Account Management API and by the
Django admin alike. The admin used to save status changes without telling
anyone: an officer created there never got a welcome email, and a farmer
approved there never heard they could sign in.
"""

from notifications.emails import (
    email_account_reactivated,
    email_account_suspended,
    email_farmer_approved,
    email_farmer_rejected,
    email_officer_welcome,
)
from notifications.services import (
    notify_account_reactivated,
    notify_account_status_changed,
    notify_farmer_approved,
    notify_officer_created,
)

from .models import AccountStatus, RegistrationNotification


def announce_status_change(user, *, old_status, new_status, actor):
    """Notifications and email for a status the account has just been saved with."""
    if old_status == new_status:
        return

    # Clear the pending-registration notification once acted upon.
    if new_status in (AccountStatus.APPROVED, AccountStatus.REJECTED):
        RegistrationNotification.objects.filter(user=user, is_read=False).update(is_read=True)

    # Approval is announced farm-wide; rejection and suspension are not
    # broadcast to Officers, but the account holder and the Admin group are
    # told — an account that silently stops working is the worst outcome here.
    if new_status == AccountStatus.APPROVED:
        if old_status == AccountStatus.SUSPENDED:
            notify_account_reactivated(user, actor=actor)
            email_account_reactivated(user)
        else:
            notify_farmer_approved(user)
            email_farmer_approved(user)
    else:
        notify_account_status_changed(user, new_status=new_status, actor=actor)
        if new_status == AccountStatus.SUSPENDED:
            email_account_suspended(user)
        elif new_status == AccountStatus.REJECTED:
            email_farmer_rejected(user)


def announce_officer_created(officer, *, actor):
    """An officer has no registration path, so this is their only signal."""
    notify_officer_created(officer, actor=actor)
    email_officer_welcome(officer)
