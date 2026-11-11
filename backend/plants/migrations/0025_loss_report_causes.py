"""
The plant-died causes widen: plants die from more than calamities, so the
Farmer now picks from calamity, pest infestation, plant disease, lack of
nutrients, poor soil, lack of water, human error and extreme temperature.

Reports already filed move to the nearest new cause: a flood or typhoon and
a drought (both calamities) to Calamity, and animals (crop pests) to Pest
infestation. "Other / not sure" and Pests / Disease keep their values.
"""

from django.db import migrations, models

OLD_TO_NEW = {"FLOOD_TYPHOON": "CALAMITY", "DROUGHT_HEAT": "CALAMITY", "ANIMALS": "PEST"}
NEW_TO_OLD = {"CALAMITY": "FLOOD_TYPHOON"}


def forwards(apps, schema_editor):
    LossReport = apps.get_model("plants", "LossReport")
    for old, new in OLD_TO_NEW.items():
        LossReport.objects.filter(cause=old).update(cause=new)


def backwards(apps, schema_editor):
    LossReport = apps.get_model("plants", "LossReport")
    for new, old in NEW_TO_OLD.items():
        LossReport.objects.filter(cause=new).update(cause=old)
    LossReport.objects.filter(
        cause__in=["NUTRIENTS", "POOR_SOIL", "WATER", "HUMAN_ERROR", "EXTREME_TEMP"]
    ).update(cause="OTHER")


class Migration(migrations.Migration):
    dependencies = [("plants", "0024_vegetables_label")]

    operations = [
        migrations.AlterField(
            model_name="lossreport",
            name="cause",
            field=models.CharField(
                choices=[
                    ("CALAMITY", "Calamity"),
                    ("PEST", "Pest infestation"),
                    ("DISEASE", "Plant disease"),
                    ("NUTRIENTS", "Lack of nutrients"),
                    ("POOR_SOIL", "Poor soil condition"),
                    ("WATER", "Lack of water"),
                    ("HUMAN_ERROR", "Human error"),
                    ("EXTREME_TEMP", "Extreme temperature"),
                    ("OTHER", "Other / not sure"),
                ],
                max_length=16,
            ),
        ),
        migrations.RunPython(forwards, backwards),
    ]
