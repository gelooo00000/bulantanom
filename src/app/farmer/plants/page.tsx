"use client";

import Link from "next/link";
import {
  CircleCheck,
  CircleHelp,
  LoaderCircle,
  Plus,
  Sprout,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AddPlantButton } from "@/components/farmer/add-plant-button";
import { AddPlantTile } from "@/components/farmer/add-plant-tile";
import { MyPlantsGuide } from "@/components/farmer/my-plants-guide";
import { PlantCard } from "@/components/farmer/plant-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deletePlant, fetchPlants, type BackendPlant } from "@/lib/api/plants-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { useAuth } from "@/lib/auth/auth-context";
import { useLanguage } from "@/lib/i18n";
import { plantTitle } from "@/lib/plant-summary";

/**
 * Remembers, per device, that the farmer hid the "How to use" guide. A
 * convenience only: storage can throw in private modes, and then the guide
 * simply shows again.
 */
const GUIDE_HIDDEN_KEY = "bulantanom_my_plants_guide_hidden";

function guideHidden(): boolean {
  try {
    return window.localStorage.getItem(GUIDE_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberGuideHidden(hidden: boolean) {
  try {
    if (hidden) window.localStorage.setItem(GUIDE_HIDDEN_KEY, "1");
    else window.localStorage.removeItem(GUIDE_HIDDEN_KEY);
  } catch {
    // Storage unavailable — the guide just reappears next visit.
  }
}

export default function MyPlantsPage() {
  const { accessToken } = useAuth();
  const { t } = useLanguage();
  const { data: plants, loading, error, refetch } = useAuthedQuery(fetchPlants);

  // Open on a farmer's first visit, until they hide it. Read after mount,
  // because the server cannot see localStorage; null renders nothing, so a
  // farmer who hid it never sees it flash open.
  const [showGuide, setShowGuide] = useState<boolean | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a one-time read of browser-only storage
    setShowGuide(!guideHidden());
  }, []);

  function toggleGuide(show: boolean) {
    setShowGuide(show);
    rememberGuideHidden(!show);
  }

  // Selection mode: tapping a card ticks it; the bar offers actions on the
  // ticked plants. Off by default, so a tap still opens a plant.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const chosen: BackendPlant[] = (plants ?? []).filter((p) => selected.has(p.id));
  const allSelected = !!plants && plants.length > 0 && selected.size === plants.length;

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  async function deleteChosen() {
    if (!accessToken || chosen.length === 0) return;
    setDeleting(true);
    setDeleteError(null);
    // One request per plant; every one is attempted, so a single failure
    // does not leave the rest undone, and the farmer is told which failed.
    const results = await Promise.allSettled(chosen.map((p) => deletePlant(accessToken, p.id)));
    const failed = chosen.filter((_, i) => results[i].status === "rejected");
    const deleted = chosen.length - failed.length;
    setDeleting(false);

    if (failed.length > 0) {
      setSelected(new Set(failed.map((p) => p.id)));
      setDeleteError(
        t("myPlants.deleteFailed", {
          failed: failed.length,
          total: chosen.length,
          names: failed.map(plantTitle).join(", "),
        }),
      );
      if (deleted > 0) refetch();
      return;
    }

    setConfirming(false);
    stopSelecting();
    setNotice(deleted === 1 ? t("myPlants.deletedOne") : t("myPlants.deletedMany", { n: deleted }));
    refetch();
  }

  // The empty state keeps a plain button: with no plants yet there is
  // nothing to select.
  const firstPlantButton = (
    <Button nativeButton={false} render={<Link href="/farmer/plants/new" />}>
      <Plus className="size-4" />
      {t("addPlant.button")}
    </Button>
  );

  const hasPlants = !!plants && plants.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("myPlants.title")}
        description={
          plants
            ? plants.length === 1
              ? t("myPlants.countOne")
              : t("myPlants.count", { n: plants.length })
            : t("myPlants.description")
        }
        action={
          <div className="flex items-center gap-2">
            {showGuide === false && !selecting && (
              <Button variant="ghost" className="h-11 px-3" onClick={() => toggleGuide(true)}>
                <CircleHelp className="size-4" />
                {t("plantsGuide.open")}
              </Button>
            )}
            {hasPlants && !selecting && (
              <Button
                variant="outline"
                className="h-11 px-4"
                onClick={() => {
                  setNotice(null);
                  setSelecting(true);
                }}
              >
                <CircleCheck className="size-4" />
                {t("myPlants.select")}
              </Button>
            )}
            <AddPlantButton />
          </div>
        }
      />

      {showGuide && !selecting && <MyPlantsGuide onClose={() => toggleGuide(false)} />}

      {notice && (
        <p
          role="status"
          className="border-risk-low/30 bg-risk-low/10 text-risk-low flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          <CircleCheck className="size-4 shrink-0" />
          {notice}
        </p>
      )}

      {/* The selection bar: what is ticked, and what can be done with it.
          Sticky, so the actions stay in reach while scrolling a long grid. */}
      {selecting && hasPlants && (
        <div
          role="toolbar"
          aria-label={t("myPlants.toolbar")}
          className="bg-card border-border sticky top-[calc(env(safe-area-inset-top,0px)+0.5rem)] z-20 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 shadow-sm"
        >
          <span className="text-sm font-medium" role="status">
            {selected.size === 0
              ? t("myPlants.tapToSelect")
              : t("myPlants.selected", { n: selected.size })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setSelected(allSelected ? new Set() : new Set(plants!.map((p) => p.id)))
            }
          >
            {allSelected ? t("myPlants.clearAll") : t("myPlants.selectAll")}
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={selected.size === 0}
              onClick={() => {
                setDeleteError(null);
                setConfirming(true);
              }}
            >
              <Trash2 className="size-4" />
              {t("common.delete")}
              {selected.size > 0 ? ` (${selected.size})` : ""}
            </Button>
            <Button variant="outline" size="sm" onClick={stopSelecting}>
              <X className="size-4" />
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3">
          <LoaderCircle className="text-primary size-6 animate-spin" />
          <p className="text-muted-foreground text-sm">{t("myPlants.loading")}</p>
        </div>
      ) : error ? (
        <div className="border-risk-high/30 bg-risk-high/5 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
          <TriangleAlert className="text-risk-high size-5" />
          <p className="text-sm font-medium">{t("dash.cantConnect")}</p>
          <p className="text-muted-foreground max-w-sm text-sm">{error}</p>
          <Button onClick={refetch}>{t("common.tryAgain")}</Button>
        </div>
      ) : !hasPlants ? (
        <EmptyState
          icon={Sprout}
          title={t("myPlants.emptyTitle")}
          description={t("dash.emptyText")}
          action={firstPlantButton}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plants!.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              selected={selected.has(plant.id)}
              onToggle={selecting ? () => toggle(plant.id) : undefined}
            />
          ))}
          {/* Closes the grid, so adding another is where the farmer's eye
              already is after reading the last card. Hidden while
              selecting, where it would be one more thing to tap by mistake. */}
          {!selecting && <AddPlantTile />}
        </div>
      )}

      {/* "Are you sure?" — mounted only while a delete is pending. */}
      {confirming && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open && !deleting) setConfirming(false);
          }}
          destructive
          busy={deleting}
          error={deleteError}
          title={
            chosen.length === 1
              ? t("myPlants.confirmTitleOne")
              : t("myPlants.confirmTitleMany", { n: chosen.length })
          }
          description={t("myPlants.confirmText")}
          details={
            <ul className="border-border bg-muted/40 max-h-40 overflow-y-auto rounded-lg border px-3 py-2 text-sm">
              {chosen.map((p) => (
                <li key={p.id} className="truncate py-0.5">
                  <span aria-hidden="true">{p.crop.emoji}</span> {plantTitle(p)}
                </li>
              ))}
            </ul>
          }
          confirmLabel={
            deleting
              ? t("myPlants.deleting")
              : chosen.length === 1
                ? t("myPlants.confirmOne")
                : t("myPlants.confirmMany", { n: chosen.length })
          }
          onConfirm={deleteChosen}
        />
      )}
    </div>
  );
}
