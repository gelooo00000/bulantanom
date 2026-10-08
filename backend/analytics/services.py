"""
Agricultural Analytics aggregations.

Every number is counted from the database at request time, for approved
Farmers only; nothing is cached, estimated or invented. Where the database
does not record something (yield in kilograms, plot coordinates, a soil
type on detector readings), the payload says so instead of filling the gap:

- Harvests are counted (plants marked Harvested, dated by `harvested_at`),
  not weighed.
- The map has one real location, the farm itself; soil records are listed
  under it rather than scattered at invented positions.
- Soil type comes from the records that captured one; the rest are
  "Not recorded".
- A crop's "recommendation rate" is the share of analysed soil records that
  recommended it. It is a frequency, not an agronomic suitability score.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, timedelta

from django.conf import settings
from django.db.models import Count, Q
from django.utils import timezone

from accounts.lgu_reports import FARM_LOCATION, FARM_NAME
from accounts.models import AccountStatus, User, UserRole

from .filters import NOT_RECORDED, NOT_RECORDED_LABEL, SEASON_LABELS, Filters, range_q, season_of

APPROVED = {"role": UserRole.FARMER, "account_status": AccountStatus.APPROVED}

# Which global filters each aggregation honours, so the UI can say when one
# does not apply to a card instead of implying a narrowing that did not happen.
APPLIES = {
    "farmers": ["date", "farmer"],
    "plants": ["date", "season", "crop", "farmer"],
    "soil": ["date", "season", "soil_type", "crop", "farmer"],
    "harvest": ["date", "season", "crop", "farmer"],
    "assessments": ["date", "season", "crop", "farmer"],
}


# ---------------------------------------------------------------------------
# Scoped querysets
# ---------------------------------------------------------------------------


def farmers_qs(f: Filters, *, dates=True):
    qs = User.objects.filter(**APPROVED)
    if f.farmer_id:
        qs = qs.filter(pk=f.farmer_id)
    if dates:
        qs = f.dates(qs, "date_joined", season=False, is_datetime=True)
    return qs


def plants_qs(f: Filters, *, dates=True):
    from plants.models import Plant

    qs = Plant.objects.filter(farmer__role=UserRole.FARMER, farmer__account_status=AccountStatus.APPROVED)
    if f.farmer_id:
        qs = qs.filter(farmer_id=f.farmer_id)
    if f.crop_id:
        qs = qs.filter(crop_id=f.crop_id)
    if dates:
        qs = f.dates(qs, "planting_date")
    return qs


def harvested_qs(f: Filters, *, dates=True):
    from plants.models import PlantStatus

    qs = plants_qs(f, dates=False).filter(status=PlantStatus.HARVESTED, harvested_at__isnull=False)
    if dates:
        qs = f.dates(qs, "harvested_at", is_datetime=True)
    return qs


def assessments_qs(f: Filters, *, dates=True):
    from plants.models import Assessment

    qs = Assessment.objects.filter(
        plant__farmer__role=UserRole.FARMER, plant__farmer__account_status=AccountStatus.APPROVED
    )
    if f.farmer_id:
        qs = qs.filter(plant__farmer_id=f.farmer_id)
    if f.crop_id:
        qs = qs.filter(plant__crop_id=f.crop_id)
    if dates:
        qs = f.dates(qs, "assessment_date")
    return qs


def soil_qs(f: Filters, *, dates=True):
    from plants.models import SoilRecommendation

    qs = SoilRecommendation.objects.filter(
        farmer__role=UserRole.FARMER, farmer__account_status=AccountStatus.APPROVED
    ).select_related("farmer")
    if f.farmer_id:
        qs = qs.filter(farmer_id=f.farmer_id)
    if f.soil_type == NOT_RECORDED:
        qs = qs.filter(legacy_soil_type__in=["unknown", "other"])
    elif f.soil_type:
        qs = qs.filter(legacy_soil_type=f.soil_type)
    if dates:
        qs = f.dates(qs, "created_at", is_datetime=True)
    return qs


def soil_records(f: Filters, *, dates=True, limit=None):
    """Soil records as a list, with the crop filter applied (it lives in JSON)."""
    rows = list(soil_qs(f, dates=dates).order_by("-created_at")[:limit] if limit else soil_qs(f, dates=dates).order_by("-created_at"))
    if f.crop_id:
        rows = [r for r in rows if f.crop_id in recommended_ids(r)]
    return rows


# ---------------------------------------------------------------------------
# Soil record helpers
# ---------------------------------------------------------------------------


def recommended_items(record) -> list[dict]:
    """Every crop a record recommended, across the fruit, vegetable and crop lists."""
    seen = set()
    out = []
    for key in ("suitable_fruits", "suitable_vegetables", "suitable_crops"):
        for item in getattr(record, key, None) or []:
            if isinstance(item, dict) and item.get("id") and item["id"] not in seen:
                seen.add(item["id"])
                out.append(item)
    return out


def recommended_ids(record) -> set[str]:
    return {item["id"] for item in recommended_items(record)}


def soil_type_of(record) -> tuple[str, str]:
    value = record.legacy_soil_type
    if value in ("unknown", "other", "", None):
        return NOT_RECORDED, NOT_RECORDED_LABEL
    return value, record.get_legacy_soil_type_display()


def moisture_of(record) -> str:
    if record.soil_moisture is not None:
        return f"{float(record.soil_moisture):g}%"
    if record.legacy_soil_moisture not in ("unknown", ""):
        return record.get_legacy_soil_moisture_display()
    return NOT_RECORDED_LABEL


def texture_of(record) -> str:
    if record.legacy_soil_texture not in ("unknown", ""):
        return record.get_legacy_soil_texture_display()
    return NOT_RECORDED_LABEL


def ph_of(record):
    return float(record.soil_ph) if record.soil_ph is not None else None


def _name(user) -> str:
    return user.get_full_name() or user.email


# ---------------------------------------------------------------------------
# Filter options
# ---------------------------------------------------------------------------


def filter_options() -> dict:
    from plants.models import Crop, SoilRecommendation

    soil_types = [
        {"key": key, "label": label}
        for key, label in SoilRecommendation.SoilType.choices
        if key not in ("unknown", "other")
    ] + [{"key": NOT_RECORDED, "label": NOT_RECORDED_LABEL}]
    return {
        "seasons": [{"key": k, "label": v} for k, v in SEASON_LABELS.items()],
        "soil_types": soil_types,
        "crops": [
            {"id": c.id, "name": c.name, "emoji": c.emoji}
            for c in Crop.objects.filter(is_active=True).order_by("name")
        ],
        "farmers": [
            {"id": u.id, "name": _name(u)}
            for u in User.objects.filter(**APPROVED).order_by("first_name", "last_name", "email")
        ],
    }


# ---------------------------------------------------------------------------
# KPI row
# ---------------------------------------------------------------------------


def _between(qs, field, start, end, is_datetime):
    return qs.filter(range_q(field, start, end, is_datetime)).count()


def _trend(qs_undated, field, f: Filters, is_datetime=False) -> dict:
    (c0, c1), (p0, p1) = f.window()
    current = _between(qs_undated, field, c0, c1, is_datetime)
    previous = _between(qs_undated, field, p0, p1, is_datetime)
    return {
        "current": current,
        "previous": previous,
        "period": {"from": c0.isoformat(), "to": c1.isoformat()},
        "previous_period": {"from": p0.isoformat(), "to": p1.isoformat()},
    }


def summary(f: Filters) -> dict:
    soil = soil_records(f)
    analysed = [r for r in soil if r.ai_generated]
    rec_counts = Counter(i for r in analysed for i in recommended_ids(r))
    top = rec_counts.most_common(1)
    most = None
    if top:
        from plants.models import Crop

        crop = Crop.objects.filter(pk=top[0][0]).first()
        if crop:
            most = {"id": crop.id, "name": crop.name, "emoji": crop.emoji, "count": top[0][1], "of": len(analysed)}

    # Trends: the same filters except the date range, counted in the current
    # window and the window before it. Soil trends need the crop filter in
    # Python, so they are counted from the undated list.
    no_dates = Filters(None, None, f.season, f.soil_type, f.crop_id, f.farmer_id)
    soil_all = soil_records(no_dates)
    (c0, c1), (p0, p1) = f.window()

    def soil_trend(only_analysed):
        rows = [r for r in soil_all if r.ai_generated] if only_analysed else soil_all
        cur = sum(1 for r in rows if c0 <= timezone.localtime(r.created_at).date() <= c1)
        prev = sum(1 for r in rows if p0 <= timezone.localtime(r.created_at).date() <= p1)
        return {
            "current": cur,
            "previous": prev,
            "period": {"from": c0.isoformat(), "to": c1.isoformat()},
            "previous_period": {"from": p0.isoformat(), "to": p1.isoformat()},
        }

    return {
        "kpis": {
            "farmers": {"value": farmers_qs(f).count(), "trend": _trend(farmers_qs(f, dates=False), "date_joined", f, True), "applies": APPLIES["farmers"]},
            "plants": {"value": plants_qs(f).count(), "trend": _trend(plants_qs(f, dates=False), "planting_date", f), "applies": APPLIES["plants"]},
            "soil_records": {"value": len(soil), "trend": soil_trend(False), "applies": APPLIES["soil"]},
            "recommendations": {"value": len(analysed), "trend": soil_trend(True), "applies": APPLIES["soil"]},
            "harvests": {"value": harvested_qs(f).count(), "trend": _trend(harvested_qs(f, dates=False), "harvested_at", f, True), "applies": APPLIES["harvest"]},
            "most_recommended": {"value": most, "applies": APPLIES["soil"]},
        },
        "filters": f.as_params(),
    }


# ---------------------------------------------------------------------------
# The four original dashboard cards, now filtered
# ---------------------------------------------------------------------------

TREND_WEEKS = 8


def overview(f: Filters) -> dict:
    from plants.models import PlantStatus

    # Plant risk: the latest assessment (within the filters) per plant.
    plants = plants_qs(f, dates=False).exclude(status=PlantStatus.ARCHIVED)
    plant_ids = set(plants.values_list("id", flat=True))
    latest = {}
    for a in assessments_qs(f).select_related("risk").order_by("plant_id", "-assessment_date", "-created_at"):
        if a.plant_id in plant_ids and a.plant_id not in latest:
            latest[a.plant_id] = a
    risk = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "unassessed": 0}
    for a in latest.values():
        r = getattr(a, "risk", None)
        level = r.risk_level if r and r.risk_level in ("LOW", "MEDIUM", "HIGH") else None
        risk[level or "unassessed"] += 1
    risk["unassessed"] += len(plant_ids) - len(latest)

    # Weekly assessments: the last 8 weeks, or the weeks of the chosen range.
    today = timezone.localdate()
    end = min(f.date_to or today, today)
    end_week = end - timedelta(days=end.weekday())
    first_week = end_week - timedelta(weeks=TREND_WEEKS - 1)
    if f.date_from and f.date_from > first_week:
        first_week = f.date_from - timedelta(days=f.date_from.weekday())
    weeks = {}
    w = first_week
    while w <= end_week:
        weeks[w] = 0
        w += timedelta(weeks=1)
    for day in assessments_qs(f, dates=False).filter(assessment_date__gte=first_week, assessment_date__lte=end).values_list("assessment_date", flat=True):
        if f.season and season_of(day) != f.season:
            continue
        key = day - timedelta(days=day.weekday())
        if key in weeks:
            weeks[key] += 1

    crops = (
        plants_qs(f)
        .exclude(status=PlantStatus.ARCHIVED)
        .values("crop__name", "crop__emoji")
        .annotate(count=Count("id"))
        .order_by("-count", "crop__name")
    )

    farmers = User.objects.filter(role=UserRole.FARMER)
    if f.farmer_id:
        farmers = farmers.filter(pk=f.farmer_id)
    farmers = f.dates(farmers, "date_joined", season=False, is_datetime=True)
    accounts = farmers.aggregate(
        total=Count("id"),
        approved=Count("id", filter=Q(account_status=AccountStatus.APPROVED)),
        rejected=Count("id", filter=Q(account_status=AccountStatus.REJECTED)),
        suspended=Count("id", filter=Q(account_status=AccountStatus.SUSPENDED)),
    )

    return {
        "risk": risk,
        "assessment_trend": [{"week_start": k.isoformat(), "count": v} for k, v in weeks.items()],
        "crops": [{"name": c["crop__name"], "emoji": c["crop__emoji"], "count": c["count"]} for c in crops],
        "farmers": accounts,
        "applies": {
            "risk": APPLIES["assessments"],
            "assessment_trend": APPLIES["assessments"],
            "crops": APPLIES["plants"],
            "farmers": APPLIES["farmers"],
        },
    }


# ---------------------------------------------------------------------------
# Crop recommendations
# ---------------------------------------------------------------------------


def crop_recommendations(f: Filters, *, rows_limit=500) -> dict:
    from plants.models import Crop

    analysed = [r for r in soil_records(f) if r.ai_generated]
    total = len(analysed)
    by_crop: dict[str, dict] = {}
    table = []
    for r in analysed:
        soil_key, soil_label = soil_type_of(r)
        day = timezone.localtime(r.created_at).date()
        season = season_of(day)
        for item in recommended_items(r):
            if f.crop_id and item["id"] != f.crop_id:
                continue
            entry = by_crop.setdefault(
                item["id"],
                {"id": item["id"], "name": item.get("name", item["id"]), "emoji": item.get("emoji", ""), "count": 0,
                 "by_soil": Counter(), "by_season": {"wet": 0, "dry": 0}},
            )
            entry["count"] += 1
            entry["by_soil"][soil_label] += 1
            entry["by_season"][season] += 1
            table.append({
                "record_id": r.id, "crop_id": item["id"], "crop": entry["name"], "emoji": entry["emoji"],
                "soil_type": soil_label, "soil_key": soil_key, "season": SEASON_LABELS[season],
                "date": day.isoformat(), "farmer": _name(r.farmer), "reason": item.get("reason", ""),
            })

    ranked = sorted(by_crop.values(), key=lambda e: (-e["count"], e["name"]))
    for e in ranked:
        e["rate"] = round(100 * e["count"] / total) if total else 0
        e["by_soil"] = [{"label": k, "count": v} for k, v in e["by_soil"].most_common()]
    rates = {e["id"]: e["rate"] for e in ranked}
    for row in table:
        row["rate"] = rates.get(row["crop_id"], 0)

    catalog = {c.id: c for c in Crop.objects.filter(pk__in=list(by_crop))}
    durations = []
    for e in ranked:
        c = catalog.get(e["id"])
        if not c:
            continue
        durations.append({
            "id": c.id, "name": c.name, "emoji": c.emoji,
            "growing_days": c.growing_duration_days,
            "harvest_window_days": c.harvest_window_days,
            "total_days": c.growing_duration_days + c.harvest_window_days,
            "planting_months": c.planting_months or [],
        })

    return {
        "analysed_records": total,
        "crops": ranked,
        "rows": table[:rows_limit],
        "row_count": len(table),
        "durations": durations,
        "applies": APPLIES["soil"],
    }


# ---------------------------------------------------------------------------
# Recommended vs planted
# ---------------------------------------------------------------------------


def recommended_vs_planted(f: Filters) -> dict:
    from plants.models import PlantStatus

    analysed = [r for r in soil_records(f, dates=False) if r.ai_generated]
    by_farmer = defaultdict(list)
    for r in analysed:
        by_farmer[r.farmer_id].append((timezone.localtime(r.created_at).date(), recommended_ids(r)))

    in_range = [r for r in analysed if (not f.date_from or timezone.localtime(r.created_at).date() >= f.date_from)
                and (not f.date_to or timezone.localtime(r.created_at).date() <= f.date_to)
                and (not f.season or season_of(timezone.localtime(r.created_at).date()) == f.season)]
    recommended = Counter(i for r in in_range for i in recommended_ids(r))

    planted = Counter()
    followed = Counter()
    with_advice = 0
    names = {}
    for p in plants_qs(f).exclude(status=PlantStatus.ARCHIVED).select_related("crop"):
        planted[p.crop_id] += 1
        names[p.crop_id] = (p.crop.name, p.crop.emoji)
        # The Farmer's most recent analysed soil record on or before planting.
        prior = [ids for day, ids in by_farmer.get(p.farmer_id, []) if day <= p.planting_date]
        if prior:
            with_advice += 1
            if p.crop_id in prior[0]:
                followed[p.crop_id] += 1

    from plants.models import Crop

    missing = set(recommended) - set(names)
    for c in Crop.objects.filter(pk__in=missing):
        names[c.id] = (c.name, c.emoji)

    crops = []
    for cid in set(recommended) | set(planted):
        name, emoji = names.get(cid, (cid, ""))
        crops.append({"id": cid, "name": name, "emoji": emoji, "recommended": recommended[cid],
                      "planted": planted[cid], "followed": followed[cid]})
    crops.sort(key=lambda c: (-(c["recommended"] + c["planted"]), c["name"]))
    total_followed = sum(followed.values())
    return {
        "crops": crops,
        "plants_with_advice": with_advice,
        "followed": total_followed,
        "follow_rate": round(100 * total_followed / with_advice) if with_advice else None,
        "applies": ["date", "season", "crop", "farmer", "soil_type"],
    }


# ---------------------------------------------------------------------------
# Harvest and productivity
# ---------------------------------------------------------------------------


def _months(start: date, end: date) -> list[date]:
    out = []
    m = date(start.year, start.month, 1)
    while m <= end:
        out.append(m)
        m = date(m.year + (m.month // 12), m.month % 12 + 1, 1)
    return out


def harvest_trends(f: Filters) -> dict:
    from plants.models import PlantStatus

    today = timezone.localdate()
    end = f.date_to or today
    start = f.date_from or date(end.year - 1, end.month, 1)
    months = _months(start, end)[-24:]
    index = {m: i for i, m in enumerate(months)}

    planted = [0] * len(months)
    for d in plants_qs(f).values_list("planting_date", flat=True):
        k = date(d.year, d.month, 1)
        if k in index:
            planted[index[k]] += 1

    harvested = [0] * len(months)
    per_crop = defaultdict(lambda: [0] * len(months))
    crop_names = {}
    for p in harvested_qs(f).select_related("crop"):
        d = timezone.localtime(p.harvested_at).date()
        k = date(d.year, d.month, 1)
        if k in index:
            harvested[index[k]] += 1
            per_crop[p.crop_id][index[k]] += 1
            crop_names[p.crop_id] = p.crop.name

    top_crops = sorted(per_crop, key=lambda c: -sum(per_crop[c]))[:5]

    # Productivity per crop: how much of what was planted reached harvest,
    # and how long it took.
    table = []
    stats = defaultdict(lambda: {"planted": 0, "harvested": 0, "ready": 0, "days": []})
    meta = {}
    for p in plants_qs(f).exclude(status=PlantStatus.ARCHIVED).select_related("crop"):
        s = stats[p.crop_id]
        meta[p.crop_id] = p.crop
        s["planted"] += 1
        if p.status == PlantStatus.READY_FOR_HARVEST:
            s["ready"] += 1
        if p.status == PlantStatus.HARVESTED and p.harvested_at:
            s["harvested"] += 1
            s["days"].append((timezone.localtime(p.harvested_at).date() - p.planting_date).days)
    for cid, s in stats.items():
        c = meta[cid]
        table.append({
            "id": cid, "name": c.name, "emoji": c.emoji, "planted": s["planted"], "harvested": s["harvested"],
            "ready": s["ready"], "harvest_rate": round(100 * s["harvested"] / s["planted"]) if s["planted"] else 0,
            "avg_days_to_harvest": round(sum(s["days"]) / len(s["days"])) if s["days"] else None,
            "expected_days": c.growing_duration_days,
        })
    table.sort(key=lambda r: (-r["harvested"], -r["planted"], r["name"]))

    return {
        "months": [m.strftime("%Y-%m") for m in months],
        "planted": planted,
        "harvested": harvested,
        "by_crop": [{"id": c, "name": crop_names[c], "data": per_crop[c]} for c in top_crops],
        "table": table,
        "total_harvests": sum(harvested),
        "applies": APPLIES["harvest"],
        "unit": "harvests",
    }


# ---------------------------------------------------------------------------
# Soil map
# ---------------------------------------------------------------------------


def soil_map(f: Filters) -> dict:
    records = soil_records(f, limit=None)
    counts = Counter()
    items = []
    for r in records[:300]:
        key, label = soil_type_of(r)
        counts[(key, label)] += 1
        items.append({
            "id": r.id, "farmer": _name(r.farmer), "soil_type": label, "soil_key": key,
            "ph": ph_of(r), "moisture": moisture_of(r), "texture": texture_of(r),
            "recommended": [i.get("name", i["id"]) for i in recommended_items(r)][:6],
            "updated": timezone.localtime(r.updated_at).date().isoformat(),
            "date": timezone.localtime(r.created_at).date().isoformat(),
        })
    for r in records[300:]:
        counts[soil_type_of(r)] += 1
    dominant = counts.most_common(1)[0][0] if counts else None
    return {
        "farm": {
            "name": FARM_NAME, "location": FARM_LOCATION,
            "lat": settings.FARM_LATITUDE, "lng": settings.FARM_LONGITUDE,
            "dominant_soil": {"key": dominant[0], "label": dominant[1]} if dominant else None,
        },
        "soil_types": [{"key": k, "label": l, "count": c} for (k, l), c in counts.most_common()],
        "records": items,
        "record_count": len(records),
        "located_by": "farm",
        "applies": APPLIES["soil"],
    }


# ---------------------------------------------------------------------------
# Soil records table
# ---------------------------------------------------------------------------


def soil_record_rows(f: Filters, limit=500) -> dict:
    records = soil_records(f)
    return {
        "count": len(records),
        "rows": [
            {
                "id": r.id, "farmer": _name(r.farmer), "location": FARM_NAME,
                "soil_type": soil_type_of(r)[1], "ph": ph_of(r), "moisture": moisture_of(r),
                "date": timezone.localtime(r.created_at).date().isoformat(),
            }
            for r in records[:limit]
        ],
        "applies": APPLIES["soil"],
    }


# ---------------------------------------------------------------------------
# Insights: plain-language observations, each backed by a count
# ---------------------------------------------------------------------------


def insights(f: Filters) -> dict:
    out = []

    harvest = harvest_trends(f)
    if harvest["table"] and harvest["table"][0]["harvested"] > 0:
        top = harvest["table"][0]
        out.append({
            "kind": "harvest",
            "text": f"{top['name']} has the most harvests in this period: {top['harvested']} of {harvest['total_harvests']}.",
        })
        timed = [r for r in harvest["table"] if r["avg_days_to_harvest"] is not None]
        if len(timed) >= 2:
            fastest = min(timed, key=lambda r: r["avg_days_to_harvest"])
            out.append({
                "kind": "harvest",
                "text": f"{fastest['name']} reached harvest fastest, in {fastest['avg_days_to_harvest']} days on average from planting.",
            })

    rvp = recommended_vs_planted(f)
    if rvp["plants_with_advice"]:
        rate = rvp["follow_rate"]
        lead = "Most farmers followed" if rate >= 50 else "Fewer than half of plantings followed"
        out.append({
            "kind": "recommendation",
            "text": f"{lead} the recommended crop: {rvp['followed']} of {rvp['plants_with_advice']} plantings made after a soil recommendation ({rate}%) were a recommended crop.",
        })

    recs = crop_recommendations(f, rows_limit=0)
    if recs["crops"]:
        top = recs["crops"][0]
        out.append({
            "kind": "recommendation",
            "text": f"{top['name']} is the most recommended crop, suggested in {top['count']} of {recs['analysed_records']} analysed soil records.",
        })

    ov = overview(f)
    assessed = ov["risk"]["LOW"] + ov["risk"]["MEDIUM"] + ov["risk"]["HIGH"]
    if assessed:
        high = ov["risk"]["HIGH"]
        out.append({
            "kind": "risk",
            "text": (f"{high} plant{'s' if high != 1 else ''} read high risk on the latest check."
                     if high else f"No plant reads high risk on its latest check ({assessed} assessed)."),
        })

    weeks = [w["count"] for w in ov["assessment_trend"]]
    if len(weeks) >= 8:
        recent, before = sum(weeks[-4:]), sum(weeks[-8:-4])
        if recent and before:
            change = round(100 * (recent - before) / before)
            if change:
                out.append({
                    "kind": "monitoring",
                    "text": f"Weekly checks are {'up' if change > 0 else 'down'} {abs(change)}% over the last four weeks ({recent} against {before}).",
                })

    return {"insights": out[:5]}


# ---------------------------------------------------------------------------
# Audit analytics: incomplete inputs and recent activity
# ---------------------------------------------------------------------------

SENSOR_FIELDS = [
    ("soil_temperature", "temperature"), ("soil_moisture", "moisture"), ("soil_conductivity", "conductivity"),
    ("soil_ph", "pH"), ("nitrogen", "nitrogen"), ("phosphorus", "phosphorus"), ("potassium", "potassium"),
    ("soil_fertility", "fertility"),
]


def audit(f: Filters) -> dict:
    from plants.models import PlantStatus

    from .models import ReportLog

    soil_issues = []
    for r in soil_records(f):
        problems = []
        if not r.has_sensor_readings:
            problems.append("No soil-detector readings (recorded before the detector)")
        else:
            missing = [label for field, label in SENSOR_FIELDS if getattr(r, field) is None]
            if missing:
                problems.append("Missing " + ", ".join(missing))
        if not r.ai_generated:
            problems.append("No recommendation generated" + (f": {r.failure_reason}" if r.failure_reason else ""))
        if problems:
            soil_issues.append({"id": r.id, "farmer": _name(r.farmer), "date": timezone.localtime(r.created_at).date().isoformat(), "issues": problems})

    assessment_issues = []
    for a in assessments_qs(f).select_related("plant__crop", "plant__farmer", "risk").order_by("-assessment_date")[:400]:
        problems = []
        if not a.evidence_image:
            problems.append("No evidence photo")
        risk = getattr(a, "risk", None)
        if risk is None:
            problems.append("No AI risk reading")
        elif risk.status != "completed":
            problems.append("AI risk reading failed" + (f": {risk.failure_reason}" if risk.failure_reason else ""))
        if problems:
            assessment_issues.append({"id": a.id, "farmer": _name(a.plant.farmer), "plant": f"{a.plant.crop.name} - {a.plant.display_name}",
                                      "date": a.assessment_date.isoformat(), "issues": problems})

    today = timezone.localdate()
    unassessed = []
    for p in plants_qs(f).filter(status__in=[PlantStatus.GROWING, PlantStatus.READY_FOR_HARVEST], assessments__isnull=True, planting_date__lte=today - timedelta(days=7)).select_related("crop", "farmer").distinct():
        unassessed.append({"id": p.id, "farmer": _name(p.farmer), "plant": f"{p.crop.name} - {p.display_name}",
                           "date": p.planting_date.isoformat(), "issues": [f"No weekly check in {(today - p.planting_date).days} days since planting"]})

    idle = [{"id": u.id, "farmer": _name(u), "date": u.date_joined.date().isoformat(), "issues": ["No plants recorded"]}
            for u in farmers_qs(f).annotate(n=Count("plants")).filter(n=0)]

    # Recent activity, newest first, from the records themselves.
    events = []
    for u in farmers_qs(f).order_by("-date_joined")[:15]:
        events.append((u.date_joined, "registration", f"{_name(u)} registered as a farmer"))
    for p in plants_qs(f, dates=False).select_related("crop", "farmer").order_by("-created_at")[:15]:
        events.append((p.created_at, "plant", f"{_name(p.farmer)} added {p.crop.name} ({p.display_name})"))
    for p in harvested_qs(f, dates=False).select_related("crop", "farmer").order_by("-harvested_at")[:15]:
        events.append((p.harvested_at, "harvest", f"{_name(p.farmer)} harvested {p.crop.name} ({p.display_name})"))
    for a in assessments_qs(f, dates=False).select_related("plant__crop", "plant__farmer").order_by("-created_at")[:15]:
        events.append((a.created_at, "assessment", f"{_name(a.plant.farmer)} submitted a weekly check for {a.plant.crop.name}"))
    for r in soil_qs(f, dates=False).order_by("-created_at")[:15]:
        events.append((r.created_at, "soil", f"{_name(r.farmer)} submitted a soil record"))
    for log in ReportLog.objects.select_related("user").order_by("-created_at")[:15]:
        events.append((log.created_at, "report", f"{_name(log.user) if log.user else 'Someone'} exported {log.title} ({log.export_format.upper()})"))
    events.sort(key=lambda e: e[0], reverse=True)

    return {
        "incomplete": [
            {"key": "soil", "label": "Soil records", "count": len(soil_issues), "rows": soil_issues[:100]},
            {"key": "assessments", "label": "Weekly checks", "count": len(assessment_issues), "rows": assessment_issues[:100]},
            {"key": "unassessed", "label": "Plants never checked", "count": len(unassessed), "rows": unassessed[:100]},
            {"key": "farmers", "label": "Farmers with no plants", "count": len(idle), "rows": idle[:100]},
        ],
        "activity": [
            {"at": timezone.localtime(at).isoformat(), "kind": kind, "text": text} for at, kind, text in events[:40]
        ],
    }
