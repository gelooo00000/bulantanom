from django.db import migrations


def backfill_account_status(apps, schema_editor):
    """
    Rows that predate the account_status field all defaulted to PENDING.
    Admin and LGU Officer accounts are never publicly registered, so they
    are approved by definition — without this they'd be locked out.
    Farmers correctly stay PENDING and must be approved by an Admin.
    """
    User = apps.get_model("accounts", "User")
    User.objects.filter(role__in=["ADMIN", "LGU_OFFICER"]).update(account_status="APPROVED")


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_user_account_status_registrationnotification"),
    ]

    operations = [
        migrations.RunPython(backfill_account_status, noop),
    ]
