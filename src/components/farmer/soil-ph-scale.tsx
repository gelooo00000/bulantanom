import { formatShortDate } from "@/components/ui/date-picker";
import type { SoilReadingHistory } from "@/lib/api/dashboard-api";

/**
 * Where this farm's soil sits on the pH scale.
 *
 * WHY A SCALE AND NOT A TREND LINE
 * --------------------------------
 * The previous version plotted readings against time, which failed at the
 * only job that mattered. Soil readings here are taken weeks or months
 * apart and there are usually two or three of them, so a time axis carried
 * almost no information — and when two readings landed on the same day both
 * ends of the axis read "Sep 14", which looks broken. Worse, a bare dot at
 * some height told the farmer nothing about whether 8.9 is good or bad.
 *
 * The question a farmer actually has is "is my soil in the right range",
 * and that is a position on a fixed scale, not a direction over time. So
 * the scale is the chart, the ideal band is drawn on it, and the reading is
 * marked against it with its number written out.
 *
 * THE BANDS ARE REAL
 * ------------------
 * Standard soil chemistry, not a house opinion: most vegetables do best
 * between pH 6.0 and 7.0. Below about 5.5 the soil is strongly acidic and
 * aluminium and manganese become available enough to harm roots; above
 * about 7.5 iron, zinc and phosphorus lock up and show as deficiency even
 * when present in the soil. Crops differ at the edges, so the wording says
 * "most vegetables" rather than pretending one range suits everything.
 */

const SCALE_MIN = 4;
const SCALE_MAX = 9;
const IDEAL_MIN = 6;
const IDEAL_MAX = 7;

const TICKS = [4, 5, 6, 7, 8, 9];

/** Position on the drawn scale, 0-100, clamped so an outlier stays visible. */
function position(ph: number): number {
  const clamped = Math.min(Math.max(ph, SCALE_MIN), SCALE_MAX);
  return ((clamped - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
}

type Verdict = { label: string; detail: string; tone: "good" | "warn" | "bad" };

export function readingVerdict(ph: number): Verdict {
  if (ph < 5.5) {
    return {
      label: "Strongly acidic",
      tone: "bad",
      detail:
        "Below 5.5 roots struggle and aluminium becomes available enough to damage them. Liming is the usual correction.",
    };
  }
  if (ph < IDEAL_MIN) {
    return {
      label: "Slightly acidic",
      tone: "warn",
      detail: "A little below the range most vegetables prefer, but workable.",
    };
  }
  if (ph <= IDEAL_MAX) {
    return {
      label: "Ideal for most crops",
      tone: "good",
      detail: "Nutrients are at their most available to the plant in this range.",
    };
  }
  if (ph <= 7.5) {
    return {
      label: "Slightly alkaline",
      tone: "warn",
      detail: "A little above the preferred range; most crops still cope.",
    };
  }
  return {
    label: "Strongly alkaline",
    tone: "bad",
    detail:
      "Above 7.5, iron, zinc and phosphorus lock up in the soil and show as deficiency in the leaves even when the nutrients are present.",
  };
}

const TONE_TEXT: Record<Verdict["tone"], string> = {
  good: "text-risk-low",
  warn: "text-risk-medium",
  bad: "text-risk-high",
};

type SoilPhScaleProps = {
  ph: number;
  recordedOn: string;
  /** Earlier readings, oldest first. Used only to show what changed. */
  history: SoilReadingHistory[];
};

export function SoilPhScale({ ph, recordedOn, history }: SoilPhScaleProps) {
  const verdict = readingVerdict(ph);

  // The most recent earlier reading that is genuinely a different measurement.
  const previous = history.filter((h) => h.ph !== null).slice(0, -1).at(-1) ?? null;
  const change = previous?.ph != null ? Number((ph - previous.ph).toFixed(1)) : null;

  return (
    <div className="border-border/60 mt-3 border-t pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">
          pH {ph}{" "}
          <span className={`text-xs font-normal ${TONE_TEXT[verdict.tone]}`}>
            · {verdict.label}
          </span>
        </p>
        <p className="text-muted-foreground shrink-0 text-[11px]">
          {formatShortDate(recordedOn)}
        </p>
      </div>

      {/* The scale itself. The ideal band is drawn so "is this good" is
          answered by where the marker sits, not by reading a number. */}
      <div
        className="relative mt-3 h-7"
        role="img"
        aria-label={`Soil pH ${ph}, ${verdict.label.toLowerCase()}. Most vegetables prefer ${IDEAL_MIN} to ${IDEAL_MAX}.`}
      >
        <div className="bg-muted absolute inset-x-0 top-2 h-2.5 rounded-full" />
        <div
          className="bg-risk-low/45 border-risk-low/60 absolute top-2 h-2.5 border-x-2"
          style={{
            left: `${position(IDEAL_MIN)}%`,
            width: `${position(IDEAL_MAX) - position(IDEAL_MIN)}%`,
          }}
        />

        {/* Earlier readings, faint, so a change is visible without a second
            chart. */}
        {history
          .filter((h) => h.ph !== null)
          .slice(0, -1)
          .map((h) => (
            <span
              key={h.id}
              className="bg-muted-foreground/50 absolute top-1.5 h-4 w-0.5 rounded-full"
              style={{ left: `${position(h.ph!)}%` }}
              title={`${formatShortDate(h.date)}: pH ${h.ph}`}
            />
          ))}

        {/* The current reading. */}
        <span
          className="border-background bg-foreground absolute top-0.5 size-5 -translate-x-1/2 rounded-full border-2 shadow"
          style={{ left: `${position(ph)}%` }}
        />
      </div>

      <div className="text-muted-foreground relative mt-1 h-4 text-[11px]">
        {TICKS.map((tick) => (
          <span
            key={tick}
            className="absolute -translate-x-1/2 tabular-nums"
            style={{ left: `${position(tick)}%` }}
          >
            {tick}
          </span>
        ))}
      </div>

      <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
        {verdict.detail}
      </p>

      {previous?.ph != null && change !== null && (
        <p className="text-muted-foreground mt-1.5 text-xs">
          {change === 0
            ? `Unchanged from your reading on ${formatShortDate(previous.date)}.`
            : `${change > 0 ? "Up" : "Down"} ${Math.abs(change)} from pH ${previous.ph} on ${formatShortDate(previous.date)}.`}
        </p>
      )}

      <p className="text-muted-foreground/70 mt-1.5 text-[11px]">
        Green band is pH {IDEAL_MIN}–{IDEAL_MAX}, where most vegetables do best.
        Some crops prefer otherwise.
      </p>
    </div>
  );
}
