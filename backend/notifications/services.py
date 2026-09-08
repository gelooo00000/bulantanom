"""
The only place notifications are created.

Views call an event function here (`notify_plant_added`, ...); they never
build a Notification themselves. That keeps recipient rules, wording and
deduplication in one auditable place.

Two rules run through everything:

* Recipients are derived from the event, never from the request. A Farmer
  gets the personal message about their own record; approved LGU Officers
  get the operational message about farm activity.
* Every notification is written inside `transaction.on_commit`, so a
  notification can never describe a database change that was rolled back.
"""

from __future__ import annotations

from uuid import uuid4

from django.db import transaction

from accounts.models import AccountStatus, User, UserRole

from .models import Notification, NotificationSeverity, NotificationType, RelatedType

# Risk level -> (type, severity) for the Farmer-facing and LGU-facing rows.
RISK_TYPES = {
    "LOW": (NotificationType.RISK_LOW, NotificationSeverity.SUCCESS),
    "MEDIUM": (NotificationType.RISK_MEDIUM, NotificationSeverity.WARNING),
    "HIGH": (NotificationType.RISK_HIGH, NotificationSeverity.CRITICAL),
}


def _crop_name(plant) -> str:
    return plant.crop.name


def _plant_label(plant) -> str:
    return plant.display_name


def active_lgu_officers():
    """
    The Layuan Farm operational group.

    The system is single-farm and has no officer-to-farm assignment table, so
    every approved, active officer is a recipient. If per-officer scoping is
    ever added, this is the only function that needs to change.
    """
    return User.objects.filter(
        role=UserRole.LGU_OFFICER,
        account_status=AccountStatus.APPROVED,
        is_active=True,
    )


def active_admins():
    """
    Every active Administrator.

    Admins are the approval authority, so they receive account-lifecycle
    events. Kept as its own function for the same reason as
    `active_lgu_officers` — if admin scoping is ever narrowed, this is the
    only place that changes.
    """
    return User.objects.filter(
        role=UserRole.ADMIN,
        account_status=AccountStatus.APPROVED,
        is_active=True,
    )


def create_notification(
    *,
    recipient,
    notification_type,
    title,
    message,
    severity=NotificationSeverity.INFO,
    related_type=RelatedType.NONE,
    related_id=None,
    metadata=None,
    dedupe_key="",
):
    """
    Create one notification, or return the existing one for the same event.

    `dedupe_key` identifies the underlying event for this recipient. With a
    key set, calling this twice is a no-op — a DB unique constraint backs the
    same guarantee if two requests race.
    """
    fields = {
        "notification_type": notification_type,
        "severity": severity,
        "title": title,
        "message": message,
        "related_type": related_type,
        "related_id": related_id,
        "metadata": metadata or {},
    }

    # Every row carries a key so uniqueness can be a plain DB constraint.
    # Without a caller-supplied one, a random key makes the row unique to
    # itself — i.e. not deduplicated.
    if not dedupe_key:
        dedupe_key = f"adhoc:{uuid4().hex}"

    notification, _ = Notification.objects.get_or_create(
        recipient=recipient, dedupe_key=dedupe_key, defaults=fields
    )
    return notification


def notify_farmer(farmer, **kwargs):
    """Personal notification to one Farmer about their own record."""
    return create_notification(recipient=farmer, **kwargs)


def notify_lgu_officers(*, dedupe_key="", **kwargs):
    """
    Operational notification to every active LGU Officer.

    Each officer gets their own row so read state is per-officer. The dedupe
    key is namespaced per recipient by the unique constraint, so one officer
    marking it read does not affect another.
    """
    created = []
    for officer in active_lgu_officers():
        created.append(create_notification(recipient=officer, dedupe_key=dedupe_key, **kwargs))
    return created


def notify_admins(*, dedupe_key="", **kwargs):
    """
    Account-lifecycle notification to every active Administrator.

    Each Admin gets their own row, so one Admin reading a registration alert
    does not clear it for the others. The dedupe key is namespaced per
    recipient by the unique constraint, exactly as for Officers.
    """
    return [
        create_notification(recipient=admin, dedupe_key=dedupe_key, **kwargs)
        for admin in active_admins()
    ]


def _on_commit(fn):
    """Run after the surrounding transaction commits, so rollbacks notify nothing."""
    transaction.on_commit(fn)


# --------------------------------------------------------------------------
# Account events
# --------------------------------------------------------------------------


def notify_farmer_registered(farmer):
    """Farmer signed up. The account is not approved yet — say exactly that."""

    def run():
        notify_farmer(
            farmer,
            notification_type=NotificationType.ACCOUNT_CREATED,
            title="Registration Submitted",
            message=(
                "Your Farmer account has been created and is waiting for "
                "administrator approval."
            ),
            dedupe_key=f"account_created:{farmer.pk}",
        )
        notify_lgu_officers(
            notification_type=NotificationType.ACCOUNT_CREATED,
            title="New Farmer Registered",
            message=(
                f"{farmer.get_full_name()} has registered in BulanTanom and is "
                "awaiting account processing."
            ),
            related_type=RelatedType.FARMER,
            related_id=farmer.pk,
            metadata={"farmer_name": farmer.get_full_name()},
            dedupe_key=f"account_created:{farmer.pk}",
        )
        # Admins are the ones who can actually act on this.
        notify_admins(
            notification_type=NotificationType.ACCOUNT_CREATED,
            title="New Farmer Registration",
            message=(
                f"{farmer.get_full_name()} has registered and is waiting for "
                "administrator approval."
            ),
            severity=NotificationSeverity.WARNING,
            related_type=RelatedType.FARMER,
            related_id=farmer.pk,
            metadata={
                "farmer_name": farmer.get_full_name(),
                "farmer_email": farmer.email,
            },
            dedupe_key=f"account_created:{farmer.pk}",
        )

    _on_commit(run)


def notify_account_deleted(*, name, email, role, actor=None, deleted_id=None):
    """
    Records that an Admin permanently deleted an account.

    Takes plain values rather than a user object on purpose: the row is gone
    by the time this runs after commit, so anything read from the instance
    would be stale or raise. The caller snapshots the details first.

    Admin-only by definition — the deleted account cannot receive anything,
    and its own notifications cascade away with it. Deletion was previously
    the one destructive action leaving no trace at all, which made it
    impossible to answer "who removed this account?" after the fact.
    """
    actor_name = actor.get_full_name() if actor is not None else "An administrator"
    role_word = {
        UserRole.FARMER: "Farmer",
        UserRole.LGU_OFFICER: "LGU Officer",
        UserRole.ADMIN: "Administrator",
    }.get(role, "Account")

    def run():
        notify_admins(
            notification_type=NotificationType.ACCOUNT_DELETED,
            title=f"{role_word} Account Deleted",
            message=f"{actor_name} permanently deleted {name} ({email}).",
            severity=NotificationSeverity.WARNING,
            related_type=RelatedType.NONE,
            related_id=deleted_id,
            metadata={
                "deleted_name": name,
                "deleted_email": email,
                "deleted_role": role,
                "deleted_id": deleted_id,
                "actor": actor_name,
            },
            # No dedupe key: the id is freed on delete and could be reused,
            # so a stable key would suppress a later, genuinely different
            # deletion.
        )

    _on_commit(run)


def notify_officer_created(officer, *, actor=None):
    """
    An Admin provisioned a new LGU Officer account.

    Officers have no public registration path, so this is the only signal
    they get that an account now exists for them. The password is never
    included — it was never readable after hashing and must not travel
    through a notification.
    """
    actor_name = actor.get_full_name() if actor is not None else "An administrator"

    def run():
        notify_farmer(
            officer,
            notification_type=NotificationType.ACCOUNT_CREATED,
            title="Account Created",
            message=(
                "Your BulanTanom LGU Officer account has been created by an "
                "administrator. You can sign in with the credentials you were given."
            ),
            severity=NotificationSeverity.SUCCESS,
            related_type=RelatedType.NONE,
            related_id=officer.pk,
            metadata={"role": officer.role},
            dedupe_key=f"officer_created:{officer.pk}",
        )
        notify_admins(
            notification_type=NotificationType.ACCOUNT_CREATED,
            title="LGU Officer Created",
            message=f"{actor_name} created an LGU Officer account for {officer.get_full_name()}.",
            severity=NotificationSeverity.INFO,
            related_type=RelatedType.NONE,
            related_id=officer.pk,
            metadata={
                "officer_name": officer.get_full_name(),
                "officer_email": officer.email,
                "actor": actor_name,
            },
            dedupe_key=f"officer_created:{officer.pk}",
        )

    _on_commit(run)


def notify_account_reactivated(user, *, actor=None):
    """
    An Admin restored a suspended account.

    Applies to Farmers and Officers alike — both lose access the moment they
    are suspended, so both need telling when it is given back.
    """
    actor_name = actor.get_full_name() if actor is not None else "An administrator"
    is_officer = user.role == UserRole.LGU_OFFICER
    role_word = "LGU Officer" if is_officer else "Farmer"

    def run():
        notify_farmer(
            user,
            notification_type=NotificationType.ACCOUNT_APPROVED,
            title="Account Reactivated",
            message=(
                f"Your BulanTanom {role_word} account has been reactivated. "
                "You can sign in again."
            ),
            severity=NotificationSeverity.SUCCESS,
            related_type=RelatedType.FARMER,
            related_id=user.pk,
            metadata={"role": user.role},
        )
        notify_admins(
            notification_type=NotificationType.ACCOUNT_APPROVED,
            title=f"{role_word} Account Reactivated",
            message=f"{actor_name} reactivated {user.get_full_name()}'s account.",
            severity=NotificationSeverity.INFO,
            related_type=RelatedType.FARMER,
            related_id=user.pk,
            metadata={"actor": actor_name, "role": user.role},
        )

    _on_commit(run)


def notify_account_status_changed(farmer, *, new_status, actor=None):
    """
    An Admin changed a Farmer's account status.

    Approval is already announced by `notify_farmer_approved`; this covers
    the outcomes that previously told the Farmer nothing at all — a rejected
    or suspended account simply stopped working with no explanation.

    Admins are copied so the action is visible to the whole approval group,
    which is the closest thing the current architecture has to an audit
    trail for these transitions.
    """
    if new_status not in (AccountStatus.REJECTED, AccountStatus.SUSPENDED):
        return

    suspended = new_status == AccountStatus.SUSPENDED
    actor_name = actor.get_full_name() if actor is not None else "An administrator"

    def run():
        notify_farmer(
            farmer,
            notification_type=NotificationType.ACCOUNT_SUSPENDED
            if suspended
            else NotificationType.ACCOUNT_REJECTED,
            title="Account Suspended" if suspended else "Registration Not Approved",
            message=(
                "Your BulanTanom account has been suspended. Contact your "
                "administrator if you believe this is a mistake."
                if suspended
                else (
                    "Your BulanTanom registration was not approved. Contact "
                    "your administrator for details."
                )
            ),
            severity=NotificationSeverity.CRITICAL
            if suspended
            else NotificationSeverity.WARNING,
            related_type=RelatedType.FARMER,
            related_id=farmer.pk,
            metadata={"new_status": new_status},
            dedupe_key=f"account_status:{farmer.pk}:{new_status}",
        )
        notify_admins(
            notification_type=NotificationType.ACCOUNT_SUSPENDED
            if suspended
            else NotificationType.ACCOUNT_REJECTED,
            title="Farmer Account Suspended" if suspended else "Farmer Registration Rejected",
            message=(
                f"{actor_name} {'suspended' if suspended else 'rejected'} "
                f"{farmer.get_full_name()}'s account."
            ),
            severity=NotificationSeverity.WARNING,
            related_type=RelatedType.FARMER,
            related_id=farmer.pk,
            metadata={
                "farmer_name": farmer.get_full_name(),
                "farmer_email": farmer.email,
                "new_status": new_status,
                "actor": actor_name,
            },
            dedupe_key=f"account_status:{farmer.pk}:{new_status}",
        )

    _on_commit(run)


def notify_farmer_approved(farmer):
    def run():
        notify_farmer(
            farmer,
            notification_type=NotificationType.ACCOUNT_APPROVED,
            title="Account Approved",
            message="Your Farmer account has been approved. You can now sign in to BulanTanom.",
            severity=NotificationSeverity.SUCCESS,
            dedupe_key=f"account_approved:{farmer.pk}",
        )
        notify_lgu_officers(
            notification_type=NotificationType.ACCOUNT_APPROVED,
            title="Farmer Account Approved",
            message=f"The Farmer account for {farmer.get_full_name()} has been approved.",
            related_type=RelatedType.FARMER,
            related_id=farmer.pk,
            metadata={"farmer_name": farmer.get_full_name()},
            dedupe_key=f"account_approved:{farmer.pk}",
        )

    _on_commit(run)


# --------------------------------------------------------------------------
# Plant events
# --------------------------------------------------------------------------


def notify_plant_added(plant):
    farmer = plant.farmer
    crop = _crop_name(plant)

    def run():
        notify_farmer(
            farmer,
            notification_type=NotificationType.PLANT_ADDED,
            title="Plant Added Successfully",
            message=f"Your {crop} plant has been added to My Plants.",
            severity=NotificationSeverity.SUCCESS,
            related_type=RelatedType.PLANT,
            related_id=plant.pk,
            metadata={"crop_name": crop, "plant_name": _plant_label(plant)},
            dedupe_key=f"plant_added:{plant.pk}",
        )
        notify_lgu_officers(
            notification_type=NotificationType.PLANT_ADDED,
            title="New Plant Added",
            message=(
                f"{farmer.get_full_name()} added a {crop} plant to Layuan Farm."
            ),
            related_type=RelatedType.PLANT,
            related_id=plant.pk,
            metadata={
                "farmer_name": farmer.get_full_name(),
                "farmer_id": farmer.pk,
                "crop_name": crop,
                "plant_name": _plant_label(plant),
                "planting_date": plant.planting_date.isoformat(),
            },
            dedupe_key=f"plant_added:{plant.pk}",
        )

    _on_commit(run)


def notify_plant_updated(plant):
    """
    Farmer-only: an edit to a plant's own record is not farm-wide news, so
    the LGU is not notified for it.
    """
    farmer = plant.farmer
    crop = _crop_name(plant)

    def run():
        notify_farmer(
            farmer,
            notification_type=NotificationType.PLANT_UPDATED,
            title="Plant Updated",
            message=f"Your {crop} plant information has been successfully updated.",
            related_type=RelatedType.PLANT,
            related_id=plant.pk,
            metadata={"crop_name": crop, "plant_name": _plant_label(plant)},
            # Updates are a repeatable event, so this is keyed by the moment
            # of the edit rather than by the plant.
            dedupe_key=f"plant_updated:{plant.pk}:{plant.updated_at.isoformat()}",
        )

    _on_commit(run)


# --------------------------------------------------------------------------
# Assessment + evidence events
# --------------------------------------------------------------------------


def notify_evidence_result(plant, *, accepted: bool):
    """
    The pre-submission evidence check finished. Nothing is stored for a
    rejected photo, so these are keyed by plant + outcome + day: a farmer who
    retries the same rejected photo repeatedly gets one notification, not one
    per attempt.
    """
    from django.utils import timezone

    farmer = plant.farmer
    crop = _crop_name(plant)
    today = timezone.localdate().isoformat()

    def run():
        if accepted:
            notify_farmer(
                farmer,
                notification_type=NotificationType.EVIDENCE_ACCEPTED,
                title="Plant Evidence Verified",
                message=f"Your uploaded photo appears to match your {crop} plant.",
                severity=NotificationSeverity.SUCCESS,
                related_type=RelatedType.PLANT,
                related_id=plant.pk,
                metadata={"crop_name": crop},
                dedupe_key=f"evidence_accepted:{plant.pk}:{today}",
            )
        else:
            notify_farmer(
                farmer,
                notification_type=NotificationType.EVIDENCE_REJECTED,
                title="Evidence Needs Attention",
                message=(
                    f"The uploaded photo could not be verified as a {crop} plant. "
                    "Please upload a clearer or correct plant photo."
                ),
                severity=NotificationSeverity.WARNING,
                related_type=RelatedType.PLANT,
                related_id=plant.pk,
                metadata={"crop_name": crop},
                dedupe_key=f"evidence_rejected:{plant.pk}:{today}",
            )
            notify_lgu_officers(
                notification_type=NotificationType.EVIDENCE_REJECTED,
                title="Evidence Verification Failed",
                message=(
                    f"The evidence submitted for {farmer.get_full_name()}'s {crop} "
                    "could not be verified."
                ),
                related_type=RelatedType.PLANT,
                related_id=plant.pk,
                metadata={"farmer_name": farmer.get_full_name(), "crop_name": crop},
                dedupe_key=f"evidence_rejected:{plant.pk}:{today}",
            )

    _on_commit(run)


def notify_assessment_submitted(assessment, eligibility):
    """
    The assessment row exists. Covers submission, the resulting 7-day lock,
    and the evidence that came with it — all keyed by assessment id, so they
    are created once when the assessment is saved and never on page views.
    """
    plant = assessment.plant
    farmer = plant.farmer
    crop = _crop_name(plant)
    next_date = eligibility.get("next_assessment_date")
    has_evidence = bool(assessment.evidence_image)

    def run():
        next_sentence = (
            f" Your next assessment will be available on {next_date}."
            if next_date
            else ""
        )
        notify_farmer(
            farmer,
            notification_type=NotificationType.ASSESSMENT_SUBMITTED,
            title="Assessment Submitted",
            message=(
                f"Your weekly assessment for {crop} has been submitted successfully."
                f"{next_sentence}"
            ),
            severity=NotificationSeverity.SUCCESS,
            related_type=RelatedType.ASSESSMENT,
            related_id=assessment.pk,
            metadata={
                "crop_name": crop,
                "plant_id": plant.pk,
                "assessment_date": assessment.assessment_date.isoformat(),
                "next_assessment_date": next_date,
            },
            dedupe_key=f"assessment_submitted:{assessment.pk}",
        )

        if next_date:
            notify_farmer(
                farmer,
                notification_type=NotificationType.ASSESSMENT_LOCKED,
                title="Weekly Assessment Completed",
                message=(
                    f"Your assessment for {crop} is complete. Your next assessment "
                    f"will be available in {eligibility.get('interval_days', 7)} days."
                ),
                related_type=RelatedType.PLANT,
                related_id=plant.pk,
                metadata={
                    "crop_name": crop,
                    "next_assessment_date": next_date,
                    "days_remaining": eligibility.get("days_remaining"),
                },
                dedupe_key=f"assessment_locked:{assessment.pk}",
            )

        if has_evidence:
            notify_farmer(
                farmer,
                notification_type=NotificationType.EVIDENCE_UPLOADED,
                title="Plant Evidence Uploaded",
                message=(
                    f"Your evidence photo for {crop} has been uploaded with this "
                    "week's assessment."
                ),
                related_type=RelatedType.ASSESSMENT,
                related_id=assessment.pk,
                metadata={"crop_name": crop},
                dedupe_key=f"evidence_uploaded:{assessment.pk}",
            )
            notify_lgu_officers(
                notification_type=NotificationType.EVIDENCE_UPLOADED,
                title="Plant Evidence Uploaded",
                message=(
                    f"{farmer.get_full_name()} uploaded new evidence for {crop}."
                ),
                related_type=RelatedType.ASSESSMENT,
                related_id=assessment.pk,
                metadata={"farmer_name": farmer.get_full_name(), "crop_name": crop},
                dedupe_key=f"evidence_uploaded:{assessment.pk}",
            )

        notify_lgu_officers(
            notification_type=NotificationType.ASSESSMENT_SUBMITTED,
            title="Assessment Submitted",
            message=(
                f"{farmer.get_full_name()} submitted a weekly assessment for {crop} "
                f"on {assessment.assessment_date.isoformat()}."
            ),
            related_type=RelatedType.ASSESSMENT,
            related_id=assessment.pk,
            metadata={
                "farmer_name": farmer.get_full_name(),
                "farmer_id": farmer.pk,
                "crop_name": crop,
                "assessment_date": assessment.assessment_date.isoformat(),
            },
            dedupe_key=f"assessment_submitted:{assessment.pk}",
        )

    _on_commit(run)


def notify_assessment_evaluated(assessment, risk):
    """
    The AI evaluation finished and its result is already stored.

    Reads the stored risk level — it never calls Gemini. A failed evaluation
    produces no risk notification at all, because there is no level to report.
    """
    if risk is None or not risk.risk_level:
        return

    level = risk.risk_level
    if level not in RISK_TYPES:
        return

    plant = assessment.plant
    farmer = plant.farmer
    crop = _crop_name(plant)
    risk_type, severity = RISK_TYPES[level]
    has_evidence = bool(assessment.evidence_image)

    farmer_messages = {
        "LOW": (
            f"Low Risk — {crop}",
            f"Your {crop} plant is currently assessed as low risk. "
            "Continue your current care routine.",
        ),
        "MEDIUM": (
            f"Medium Risk — {crop}",
            f"Your {crop} plant requires additional attention. "
            "Review your latest assessment for details.",
        ),
        "HIGH": (
            f"High Risk Alert — {crop}",
            f"Your {crop} plant has been assessed as high risk. Please review "
            "the latest assessment and recommended actions.",
        ),
    }

    lgu_messages = {
        "LOW": (
            "Assessment Completed",
            f"{farmer.get_full_name()}'s {crop} assessment has been evaluated as LOW risk.",
        ),
        "MEDIUM": (
            "Medium-Risk Plant",
            f"{farmer.get_full_name()}'s {crop} plant has been assessed as MEDIUM risk.",
        ),
        "HIGH": (
            "High-Risk Plant Detected" if not has_evidence else "High-Risk Plant Evidence Available",
            (
                f"{farmer.get_full_name()}'s {crop} plant has been assessed as HIGH risk. "
                + (
                    "New plant evidence is available for review."
                    if has_evidence
                    else "Review the assessment for details."
                )
            ),
        ),
    }

    def run():
        notify_farmer(
            farmer,
            notification_type=NotificationType.AI_EVALUATION_COMPLETED,
            title="Plant Assessment Evaluated",
            message=(
                f"Your {crop} assessment has been evaluated by the crop "
                "intelligence system."
            ),
            related_type=RelatedType.ASSESSMENT,
            related_id=assessment.pk,
            metadata={"crop_name": crop},
            dedupe_key=f"ai_evaluated:{assessment.pk}",
        )

        title, message = farmer_messages[level]
        notify_farmer(
            farmer,
            notification_type=risk_type,
            title=title,
            message=message,
            severity=severity,
            related_type=RelatedType.ASSESSMENT,
            related_id=assessment.pk,
            metadata={
                "crop_name": crop,
                "risk_level": level,
                "plant_id": plant.pk,
                # The AI's own summary, already stored — not regenerated.
                "summary": risk.summary,
            },
            dedupe_key=f"risk:{assessment.pk}",
        )

        title, message = lgu_messages[level]
        notify_lgu_officers(
            notification_type=risk_type,
            title=title,
            message=message,
            severity=severity,
            related_type=RelatedType.ASSESSMENT,
            related_id=assessment.pk,
            metadata={
                "farmer_name": farmer.get_full_name(),
                "farmer_id": farmer.pk,
                "crop_name": crop,
                "risk_level": level,
                "has_evidence": has_evidence,
            },
            dedupe_key=f"risk:{assessment.pk}",
        )

    _on_commit(run)


# --------------------------------------------------------------------------
# Harvest events
# --------------------------------------------------------------------------


# Ordered worst-last, so a simple index comparison says whether a plant got
# better or worse without a table of every pairing.
_RISK_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}


def notify_risk_level_changed(assessment, risk):
    """
    Raised only when a plant's risk level actually *moved* between its last
    two completed evaluations.

    This is deliberately separate from `notify_assessment_evaluated`, which
    reports every reading. A transition is the thing an Officer needs to act
    on — "still LOW" is noise, "MEDIUM -> HIGH" is not.

    Silent on a plant's first reading (there is nothing to compare against)
    and when the level is unchanged. Keyed on the assessment, so re-running a
    failed evaluation cannot raise it twice.
    """
    if risk is None or risk.risk_level not in _RISK_ORDER:
        return

    from plants.models import RiskAssessment, RiskStatus

    plant = assessment.plant
    previous = (
        RiskAssessment.objects.filter(
            assessment__plant=plant, status=RiskStatus.COMPLETED
        )
        .exclude(pk=risk.pk)
        .exclude(risk_level="")
        .order_by("-assessment__assessment_date", "-assessment__created_at")
        .first()
    )
    if previous is None or previous.risk_level == risk.risk_level:
        return

    old, new = previous.risk_level, risk.risk_level
    worsened = _RISK_ORDER[new] > _RISK_ORDER[old]
    crop = _crop_name(plant)
    farmer = plant.farmer
    reason = (risk.summary or "").strip()

    if new == "HIGH":
        severity = NotificationSeverity.CRITICAL
        lgu_title = "Risk Level Increased"
    elif worsened:
        severity = NotificationSeverity.WARNING
        lgu_title = "Risk Level Updated"
    else:
        severity = NotificationSeverity.SUCCESS
        lgu_title = "Plant Risk Improved"

    direction = "changed from" if worsened else "improved from"
    detail = f" Reason: {reason}" if worsened and reason else ""

    def run():
        notify_farmer(
            farmer,
            notification_type=NotificationType.RISK_CHANGED,
            title=(
                f"Risk Increased — {crop}" if worsened else f"Risk Improved — {crop}"
            ),
            message=(
                f"Your {crop} plant {direction} {old} risk to {new} risk.{detail}"
            ),
            severity=severity,
            related_type=RelatedType.ASSESSMENT,
            related_id=assessment.pk,
            metadata={
                "crop_name": crop,
                "previous_risk": old,
                "current_risk": new,
                "worsened": worsened,
            },
            dedupe_key=f"risk_changed:{assessment.pk}",
        )
        notify_lgu_officers(
            notification_type=NotificationType.RISK_CHANGED,
            title=lgu_title,
            message=(
                f"{farmer.get_full_name()}'s {crop} {direction} {old} risk "
                f"to {new} risk.{detail}"
            ),
            severity=severity,
            related_type=RelatedType.ASSESSMENT,
            related_id=assessment.pk,
            metadata={
                "farmer_name": farmer.get_full_name(),
                "farmer_id": farmer.pk,
                "crop_name": crop,
                "previous_risk": old,
                "current_risk": new,
                "worsened": worsened,
            },
            dedupe_key=f"risk_changed:{assessment.pk}",
        )

    _on_commit(run)


def soil_concerns(soil) -> list[str]:
    """
    Objectively concerning conditions in what the Farmer actually reported.

    Deliberately derived from the Farmer's own numbers rather than from
    Gemini's prose: every analysed assessment carries a warnings section —
    including the reassuring "no major warnings" line — so keying an alert off
    that text would either misfire or need brittle string matching. These
    thresholds are explainable and produce the same answer every time.

    Kept narrow on purpose. A routine assessment must not page an Officer.
    """
    concerns = []

    # Outside roughly 5.0-8.0 most crops struggle to take up nutrients.
    if soil.ph_level is not None:
        ph = float(soil.ph_level)
        if ph < 5.0:
            concerns.append(f"strongly acidic soil (pH {ph:g})")
        elif ph > 8.0:
            concerns.append(f"strongly alkaline soil (pH {ph:g})")

    # Poor drainage matters most when the soil is already holding water.
    wet = {soil.SoilMoisture.MOIST, soil.SoilMoisture.VERY_WET}
    if soil.drainage == soil.Drainage.POOR and soil.soil_moisture in wet:
        concerns.append("poor drainage with wet soil, a waterlogging risk")

    return concerns


def notify_soil_warning(soil):
    """
    Alerts Officers when a soil assessment reports conditions worth a look.

    LGU-only: the Farmer already sees the AI's own warnings on their result
    page, so notifying them again would just duplicate it.
    """
    concerns = soil_concerns(soil)
    if not concerns:
        return

    farmer = soil.farmer
    soil_type = soil.get_soil_type_display()
    detail = "; ".join(concerns)

    def run():
        notify_lgu_officers(
            notification_type=NotificationType.SOIL_WARNING,
            title="Soil Warning",
            message=(
                f"{farmer.get_full_name()}'s {soil_type} soil assessment reports "
                f"{detail}. Review the soil record."
            ),
            severity=NotificationSeverity.WARNING,
            related_type=RelatedType.NONE,
            related_id=soil.pk,
            metadata={
                "farmer_name": farmer.get_full_name(),
                "farmer_id": farmer.pk,
                "soil_type": soil_type,
                "concerns": concerns,
            },
            dedupe_key=f"soil_warning:{soil.pk}",
        )

    _on_commit(run)


def notify_soil_recommendation(soil, *, analyzed: bool):
    """
    A Farmer saved a soil assessment.

    `analyzed` separates the two genuinely different outcomes: Gemini
    returned crop suggestions, or the assessment was stored without them.
    The message never claims advice exists when it does not.

    LGU Officers are told as well, since soil records are farm-wide
    monitoring data they are expected to review.
    """
    farmer = soil.farmer
    soil_type = soil.get_soil_type_display()

    def run():
        notify_farmer(
            farmer,
            notification_type=(
                NotificationType.SOIL_RECOMMENDATION_READY
                if analyzed
                else NotificationType.SOIL_ASSESSMENT_SAVED
            ),
            title=(
                "Soil Recommendation Ready" if analyzed else "Soil Assessment Saved"
            ),
            message=(
                f"Your {soil_type} soil assessment has AI crop suggestions ready."
                if analyzed
                else (
                    f"Your {soil_type} soil assessment was saved. "
                    "No AI recommendation was generated."
                )
            ),
            severity=(
                NotificationSeverity.SUCCESS if analyzed else NotificationSeverity.INFO
            ),
            related_type=RelatedType.NONE,
            related_id=soil.pk,
            metadata={"soil_type": soil_type, "analyzed": analyzed},
            dedupe_key=f"soil_recommendation:{soil.pk}",
        )
        notify_lgu_officers(
            notification_type=(
                NotificationType.SOIL_RECOMMENDATION_READY
                if analyzed
                else NotificationType.SOIL_ASSESSMENT_SAVED
            ),
            title="New Soil Assessment",
            message=(
                f"{farmer.get_full_name()} submitted a {soil_type} soil assessment."
            ),
            related_type=RelatedType.NONE,
            related_id=soil.pk,
            metadata={
                "farmer_name": farmer.get_full_name(),
                "farmer_id": farmer.pk,
                "soil_type": soil_type,
                "analyzed": analyzed,
            },
            dedupe_key=f"soil_recommendation:{soil.pk}",
        )

    _on_commit(run)


def notify_harvest_window(plant, *, ready: bool):
    """
    Raised from the `notify_harvest_windows` management command, using the
    plant's stored expected_harvest_start. Keyed by plant + stage so a plant
    is announced once per stage no matter how often the command runs.
    """
    farmer = plant.farmer
    crop = _crop_name(plant)
    stage = "ready" if ready else "approaching"

    def run():
        if ready:
            title = "Harvest Ready"
            message = f"Your {crop} has reached its expected harvest period."
            notification_type = NotificationType.HARVEST_READY
        else:
            title = "Harvest Approaching"
            message = f"Your {crop} is approaching its expected harvest period."
            notification_type = NotificationType.HARVEST_APPROACHING

        notify_farmer(
            farmer,
            notification_type=notification_type,
            title=title,
            message=message,
            related_type=RelatedType.PLANT,
            related_id=plant.pk,
            metadata={
                "crop_name": crop,
                "expected_harvest_start": plant.expected_harvest_start.isoformat(),
                "expected_harvest_end": plant.expected_harvest_end.isoformat(),
            },
            dedupe_key=f"harvest_{stage}:{plant.pk}",
        )

    _on_commit(run)
