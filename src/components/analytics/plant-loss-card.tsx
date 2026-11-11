"use client";

import {
  Biohazard,
  Bug,
  CircleHelp,
  CloudLightning,
  Droplets,
  FlaskConical,
  Mountain,
  Thermometer,
  UserX,
  type LucideIcon,
} from "lucide-react";

import { CardState, ChartCard } from "@/components/analytics/cards";
import { HorizontalBars } from "@/components/lgu/dashboard-charts";
import { fetchLguPlantLosses, type PlantLosses } from "@/lib/api/lgu-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { useAuth } from "@/lib/auth/auth-context";

const ICON: Record<string, LucideIcon> = {
  CALAMITY: CloudLightning,
  PEST: Bug,
  DISEASE: Biohazard,
  NUTRIENTS: FlaskConical,
  POOR_SOIL: Mountain,
  WATER: Droplets,
  HUMAN_ERROR: UserX,
  EXTREME_TEMP: Thermometer,
  OTHER: CircleHelp,
};

/** Plants that died before harvest, on Agricultural Analytics. */
export function PlantLossCard({ className }: { className?: string }) {
  const query = useAuthedQuery(fetchLguPlantLosses);
  const { currentUser } = useAuth();
  // The Plant Loss page is an Officer's page; an Admin sees the card only.
  const officer = currentUser?.role !== "admin";

  return (
    <ChartCard
      title="Plant losses"
      description="Plants that died before harvest, and what killed them."
      href={officer ? "/lgu/plant-loss" : undefined}
      linkLabel="Plant Loss"
      className={className}
    >
      <CardState
        query={query}
        isEmpty={(d) => d.total === 0}
        emptyText="No plants lost"
        emptyHint="When a Farmer reports that a plant died, it is counted here."
      >
        {(d) => <PlantLossChart data={d} />}
      </CardState>
    </ChartCard>
  );
}

/**
 * Kept simple on purpose: one sentence with the totals, then one bar per
 * cause that took a plant. A single series, so a single colour; each bar is
 * named and has its icon. The months, crops and groups are on Plant Loss.
 */
export function PlantLossChart({ data }: { data: PlantLosses }) {
  const causes = data.causes
    .filter((cause) => cause.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((cause) => ({
      key: cause.value,
      label: cause.label,
      value: cause.count,
      color: "var(--loss-calamity)",
      icon: ICON[cause.value] ?? CircleHelp,
    }));

  const lost = `${data.total} plant${data.total === 1 ? "" : "s"} lost before harvest`;
  const calamity = data.calamity > 0 ? `, ${data.calamity} to a calamity` : "";
  const survival =
    data.survival_rate === null ? "" : ` ${data.survival_rate}% of finished plants were harvested.`;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {lost}
        {calamity}.{survival}
      </p>
      <HorizontalBars rows={causes} unit="plant" label="Plants lost per cause" />
    </div>
  );
}
