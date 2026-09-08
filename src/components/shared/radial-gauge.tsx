import { cn } from "@/lib/utils";

type Tone = "primary" | "risk-low" | "risk-medium" | "risk-high";

const TONE_COLOR: Record<Tone, string> = {
  primary: "var(--primary)",
  "risk-low": "var(--risk-low)",
  "risk-medium": "var(--risk-medium)",
  "risk-high": "var(--risk-high)",
};

type RadialGaugeProps = {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  tone?: Tone;
  className?: string;
};

export function RadialGauge({
  value,
  size = 88,
  strokeWidth = 8,
  label,
  sublabel,
  tone = "primary",
  className,
}: RadialGaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={TONE_COLOR[tone]}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-lg font-medium">{label ?? `${clamped}%`}</span>
        {sublabel && <span className="text-muted-foreground text-[11px]">{sublabel}</span>}
      </div>
    </div>
  );
}
