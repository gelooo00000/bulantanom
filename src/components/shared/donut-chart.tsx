import { cn } from "@/lib/utils";

type SegmentTone = "risk-low" | "risk-medium" | "risk-high";

const SEGMENT_COLOR: Record<SegmentTone, string> = {
  "risk-low": "var(--risk-low)",
  "risk-medium": "var(--risk-medium)",
  "risk-high": "var(--risk-high)",
};

export type DonutSegment = {
  label: string;
  value: number;
  tone: SegmentTone;
};

type DonutChartProps = {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string | number;
  className?: string;
};

export function DonutChart({
  segments,
  size = 100,
  strokeWidth = 12,
  centerLabel,
  centerValue,
  className,
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  let cumulativeFraction = 0;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {total === 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />
        ) : (
          segments
            .filter((segment) => segment.value > 0)
            .map((segment) => {
              const fraction = segment.value / total;
              const dash = circumference * fraction;
              const gap = circumference - dash;
              const offset = circumference * (1 - cumulativeFraction);
              cumulativeFraction += fraction;
              return (
                <circle
                  key={segment.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={SEGMENT_COLOR[segment.tone]}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={offset}
                />
              );
            })
        )}
      </svg>
      {(centerLabel || centerValue !== undefined) && (
        <div className="absolute flex flex-col items-center justify-center text-center">
          {centerValue !== undefined && <span className="text-lg font-medium">{centerValue}</span>}
          {centerLabel && <span className="text-muted-foreground text-[11px]">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}
