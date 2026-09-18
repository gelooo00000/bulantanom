"""
Crop variety and planting-season tests.

Two things are worth pinning here. First, that recording a variety actually
changes the harvest window — the whole reason varieties carry their own
durations is that Sweet Corn and Yellow Corn are weeks apart, and a window
that ignored the variety would be quietly wrong. Second, that the season
guidance stays advisory: it must never move a harvest date, and it must stay
silent rather than invent a window for a crop that has none on record.

No AI is involved in any of this, so nothing here is mocked.
"""

from datetime import date

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AccountStatus, User, UserRole

from . import crop_calendar
from .models import Crop, CropVariant, Plant

CROPS_URL = "/api/farmer/crops/"
PLANTS_URL = "/api/farmer/plants/"
FARMER_LOGIN_URL = "/api/auth/farmer/login/"
PW = "SecurePassword123!"


class CropCalendarLogicTests(APITestCase):
    """The month evaluator itself, independent of the database."""

    def test_preferred_month_is_good_and_carries_the_reason(self):
        advice = crop_calendar.evaluate_month("eggplant", 3)
        self.assertEqual(advice["status"], crop_calendar.GOOD)
        self.assertEqual(advice["month_name"], "March")
        self.assertIn("February-May", advice["preferred_label"])
        self.assertTrue(advice["detail"])

    def test_wet_season_month_is_poor_and_carries_the_risk(self):
        advice = crop_calendar.evaluate_month("eggplant", 10)
        self.assertEqual(advice["status"], crop_calendar.POOR)
        # The warning has to say what actually goes wrong, not just "avoid".
        self.assertIn("bacterial wilt", advice["detail"])

    def test_transition_month_is_caution_and_names_a_mitigation(self):
        advice = crop_calendar.evaluate_month("eggplant", 7)
        self.assertEqual(advice["status"], crop_calendar.CAUTION)
        self.assertIn("drainage", advice["detail"])

    def test_crop_with_no_window_on_record_returns_nothing(self):
        self.assertIsNone(crop_calendar.evaluate(None, 5))
        self.assertIsNone(crop_calendar.evaluate({"preferred": [], "caution": []}, 5))

    def test_out_of_range_month_returns_nothing(self):
        self.assertIsNone(crop_calendar.evaluate_month("eggplant", 0))
        self.assertIsNone(crop_calendar.evaluate_month("eggplant", 13))

    def test_month_range_label_wraps_across_december(self):
        self.assertEqual(
            crop_calendar.month_range_label([12, 1, 2]), "December-February"
        )
        self.assertEqual(crop_calendar.month_range_label([2, 3, 4, 5]), "February-May")
        self.assertEqual(crop_calendar.month_range_label(list(range(1, 13))), "year-round")
        self.assertEqual(crop_calendar.month_range_label([]), "no recommended window on record")

    def test_every_seeded_window_uses_real_months_and_explains_itself(self):
        for crop_id, entry in crop_calendar.PLANTING_CALENDAR.items():
            with self.subTest(crop=crop_id):
                months = list(entry.get("preferred") or []) + list(
                    entry.get("caution") or []
                )
                self.assertTrue(months, "a window with no months is not a window")
                self.assertEqual(len(months), len(set(months)), "month listed twice")
                for m in months:
                    self.assertIn(m, range(1, 13))
                # A preferred window with no stated reason is a bare verdict.
                if entry.get("preferred"):
                    self.assertTrue(entry.get("reason"))
                # Anything with an out-of-season month must say what goes wrong.
                if len(set(months)) < 12:
                    self.assertTrue(entry.get("risk"))


class HarvestWindowFromVariantTests(APITestCase):
    """The variety has to drive the dates, not just the label."""

    def setUp(self):
        self.corn = Crop.objects.get(id="corn")
        self.planting_date = date(2026, 3, 1)

    def test_variant_durations_override_the_crop(self):
        sweet = CropVariant.objects.get(id="corn-sweet")
        grain = CropVariant.objects.get(id="corn-yellow-field")

        sweet_start, _ = Plant.calculate_harvest_window(
            self.corn, self.planting_date, sweet
        )
        grain_start, _ = Plant.calculate_harvest_window(
            self.corn, self.planting_date, grain
        )

        self.assertLess(sweet_start, grain_start)
        self.assertEqual(
            (sweet_start - self.planting_date).days, sweet.growing_duration_days
        )

    def test_no_variant_falls_back_to_the_crop(self):
        start, end = Plant.calculate_harvest_window(self.corn, self.planting_date)
        self.assertEqual(
            (start - self.planting_date).days, self.corn.growing_duration_days
        )
        self.assertEqual((end - start).days, self.corn.harvest_window_days)


class CropVarietyApiTests(APITestCase):
    def setUp(self):
        self.farmer = User.objects.create_user(
            email="farmer@example.com",
            password=PW,
            first_name="Test",
            last_name="Farmer",
            role=UserRole.FARMER,
            account_status=AccountStatus.APPROVED,
        )
        res = self.client.post(
            FARMER_LOGIN_URL, {"email": "farmer@example.com", "password": PW}, format="json"
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")

    def _crop(self, payload, crop_id):
        return next(c for c in payload if c["id"] == crop_id)

    def test_crop_list_carries_variants_and_the_planting_window(self):
        res = self.client.get(CROPS_URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        corn = self._crop(res.data, "corn")
        names = [v["name"] for v in corn["variants"]]
        self.assertIn("Sweet Corn", names)

        window = self._crop(res.data, "eggplant")["planting_window"]
        self.assertEqual(window["preferred_months"], [2, 3, 4, 5])
        self.assertEqual(window["preferred_label"], "February-May")
        self.assertTrue(window["risk"])

    def test_planting_a_variety_uses_its_harvest_window(self):
        sweet = CropVariant.objects.get(id="corn-sweet")
        res = self.client.post(
            PLANTS_URL,
            {
                "crop_id": "corn",
                "variant_id": sweet.id,
                "planting_date": "2026-03-01",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["variant"]["name"], "Sweet Corn")
        self.assertEqual(res.data["expected_harvest_start"], "2026-05-15")
        # Unlabelled plants of a variety are named for the variety.
        self.assertEqual(res.data["display_name"], "Sweet Corn")

    def test_variety_is_optional(self):
        res = self.client.post(
            PLANTS_URL,
            {"crop_id": "corn", "planting_date": "2026-03-01"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertIsNone(res.data["variant"])
        self.assertEqual(res.data["display_name"], "Corn")

    def test_variety_from_another_crop_is_rejected(self):
        res = self.client.post(
            PLANTS_URL,
            {
                "crop_id": "eggplant",
                "variant_id": "corn-sweet",
                "planting_date": "2026-03-01",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("variant_id", res.data)

    def test_plant_reports_the_season_it_was_planted_in(self):
        in_season = self.client.post(
            PLANTS_URL,
            {"crop_id": "eggplant", "planting_date": "2026-03-01"},
            format="json",
        )
        self.assertEqual(in_season.data["planting_advice"]["status"], "good")

        out_of_season = self.client.post(
            PLANTS_URL,
            {"crop_id": "eggplant", "planting_date": "2025-10-01"},
            format="json",
        )
        self.assertEqual(out_of_season.data["planting_advice"]["status"], "poor")
        self.assertTrue(out_of_season.data["planting_advice"]["detail"])

    def test_season_guidance_never_changes_the_harvest_window(self):
        """
        The point of the feature is advice, not arithmetic. An out-of-season
        planting must produce exactly the same dates as an in-season one.
        """
        good = self.client.post(
            PLANTS_URL,
            {"crop_id": "eggplant", "planting_date": "2026-03-01"},
            format="json",
        ).data
        poor = self.client.post(
            PLANTS_URL,
            {"crop_id": "eggplant", "planting_date": "2025-10-01"},
            format="json",
        ).data

        crop = Crop.objects.get(id="eggplant")
        for row, planted in ((good, date(2026, 3, 1)), (poor, date(2025, 10, 1))):
            expected_start, expected_end = Plant.calculate_harvest_window(crop, planted)
            self.assertEqual(row["expected_harvest_start"], expected_start.isoformat())
            self.assertEqual(row["expected_harvest_end"], expected_end.isoformat())


class VarietyCatalogIntegrityTests(APITestCase):
    """
    Guards the seeded catalog itself. These would have caught a variety
    filed under the wrong crop, a duplicated id, or a day count typo'd by
    an order of magnitude — all of which silently produce a wrong harvest
    window rather than an error.
    """

    # Duhat is knowingly varietyless: a minor, largely unimproved backyard
    # crop with no split worth recording. Listed here so that stays a
    # decision rather than something that quietly rots into an oversight.
    CROPS_WITHOUT_VARIETIES = {"java-plum"}

    def test_every_crop_either_has_varieties_or_is_a_known_exception(self):
        for crop in Crop.objects.filter(is_active=True).prefetch_related("variants"):
            with self.subTest(crop=crop.id):
                count = crop.variants.filter(is_active=True).count()
                if crop.id in self.CROPS_WITHOUT_VARIETIES:
                    self.assertEqual(count, 0, "exception list is out of date")
                else:
                    # One variety is not a choice, so it is not worth offering.
                    self.assertGreaterEqual(count, 2)

    def test_variety_durations_are_plausible(self):
        for variant in CropVariant.objects.select_related("crop"):
            with self.subTest(variant=variant.id):
                self.assertGreater(variant.growing_duration_days, 0)
                self.assertGreater(variant.harvest_window_days, 0)
                # Nothing in this catalog is faster than a two-week mushroom
                # flush or slower than a seedling avocado at five years.
                self.assertGreaterEqual(variant.growing_duration_days, 14)
                self.assertLessEqual(variant.growing_duration_days, 1825)

                # A variety should be recognisably the same crop as its
                # parent, so an order-of-magnitude slip stands out. The
                # deliberate conflation fixes are the documented exceptions.
                if variant.crop_id not in {
                    "purple-sweet-potato",
                    "radish-jicama",
                    "lemongrass",
                    "rambutan-lychee",
                }:
                    ratio = variant.growing_duration_days / variant.crop.growing_duration_days
                    self.assertGreater(ratio, 0.35)
                    self.assertLess(ratio, 2.2)

    def test_every_variety_names_and_explains_itself(self):
        for variant in CropVariant.objects.all():
            with self.subTest(variant=variant.id):
                self.assertTrue(variant.name.strip())
                # A bare name is not enough to choose between two varieties.
                self.assertGreater(len(variant.description.strip()), 40)
                self.assertTrue(variant.search_terms)

    def test_variety_ids_are_unique_and_slug_shaped(self):
        ids = list(CropVariant.objects.values_list("id", flat=True))
        self.assertEqual(len(ids), len(set(ids)))
        for vid in ids:
            with self.subTest(variant=vid):
                self.assertRegex(vid, r"^[a-z0-9]+(-[a-z0-9]+)*$")

    def test_the_conflated_rows_are_actually_split(self):
        """
        The rows holding two different plants are the whole reason the
        harvest window needed a variety. Pin that the split survives.
        """
        pairs = {
            "purple-sweet-potato": ("ube-purple-yam", "kamote-sweet-potato"),
            "radish-jicama": ("radish-labanos", "jicama-singkamas"),
            "rambutan-lychee": ("rambutan-maharlika", "lychee-mauritius"),
            "lemongrass": ("lemongrass-tanglad", "greens-pechay"),
        }
        for crop_id, (slow_or_a, fast_or_b) in pairs.items():
            with self.subTest(crop=crop_id):
                a = CropVariant.objects.get(id=slow_or_a)
                b = CropVariant.objects.get(id=fast_or_b)
                self.assertEqual(a.crop_id, crop_id)
                self.assertEqual(b.crop_id, crop_id)
                # Measured as an absolute gap, not a ratio. Rambutan and
                # lychee are both slow trees - a whole extra year of waiting
                # is only 1.25x - while kamote against ube is 2.25x but a
                # smaller gap in days. Two months apart is the thing that
                # makes recording the variety worth the farmer's time.
                gap = abs(a.growing_duration_days - b.growing_duration_days)
                self.assertGreaterEqual(gap, 60)
