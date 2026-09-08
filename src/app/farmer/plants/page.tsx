"use client";

import Link from "next/link";
import { LoaderCircle, Plus, Sprout, TriangleAlert } from "lucide-react";

import { PlantCard } from "@/components/farmer/plant-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { fetchPlants } from "@/lib/api/plants-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";

export default function MyPlantsPage() {
  const { data: plants, loading, error, refetch } = useAuthedQuery(fetchPlants);

  const addButton = (
    <Button nativeButton={false} render={<Link href="/farmer/plants/new" />}>
      <Plus className="size-4" />
      Add Plant
    </Button>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="My Plants"
        description={
          plants ? `${plants.length} plants tracked at Layuan Farm.` : "Your crops at Layuan Farm."
        }
        action={addButton}
      />

      {loading ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3">
          <LoaderCircle className="text-primary size-6 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading your plants…</p>
        </div>
      ) : error ? (
        <div className="border-risk-high/30 bg-risk-high/5 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
          <TriangleAlert className="text-risk-high size-5" />
          <p className="text-sm font-medium">Unable to connect to BulanTanom.</p>
          <p className="text-muted-foreground max-w-sm text-sm">{error}</p>
          <Button onClick={refetch}>Try again</Button>
        </div>
      ) : !plants || plants.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title="No plants added yet"
          description="Add your first plant to start tracking its growth, risk, and harvest window."
          action={addButton}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plants.map((plant) => (
            <PlantCard key={plant.id} plant={plant} />
          ))}
        </div>
      )}
    </div>
  );
}
