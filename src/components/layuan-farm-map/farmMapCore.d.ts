export type FarmKeyItem = {
  n: number;
  /** Exactly as printed on the map key. */
  name: string;
  /** The name without "(future development)". */
  title: string;
  type: string;
  future?: boolean;
};

export type FarmPinInfo = {
  n?: number;
  title: string;
  name?: string;
  type: string;
  future?: boolean;
  note: string;
};

export type FarmPin = {
  id: string;
  kind: "facility" | "water" | "flower" | "recycle";
  n?: number;
  u: number;
  v: number;
  z: number;
  layer: string;
};

export const KEY: FarmKeyItem[];
export const INFO: Record<string, FarmPinInfo>;
export const PINS: FarmPin[];

export function buildFarmMap(
  tilt?: number,
  height?: number,
): { width: number; height: number; inner: string };
