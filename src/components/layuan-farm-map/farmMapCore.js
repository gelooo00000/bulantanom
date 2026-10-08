/**
 * Layuan Nature Integrated Farm as an isometric site map.
 *
 * Pure data and string building: no DOM, no React. `buildFarmMap(tilt, height)`
 * returns an SVG fragment that LayuanFarmMap.tsx drops into its <svg>, plus
 * the point each pin stands on; the pins themselves are HTML buttons laid
 * over the map so they stay the same size at any zoom.
 *
 * The layout follows the farm's Site Development Map (its positions and map
 * key) but every shape here is drawn from scratch in BulanTanom's own style.
 *
 * Grid: u runs right (east), v runs down (south); the land is about 68 x 46.
 * Projection: X = (u - v) * 10, Y = (u + v) * 5 * tilt - z * 7.5 * height.
 * Colours are CSS variables (--lfm-*) so the theme can change without a
 * re-render.
 */

const LAND_U = 68;
const LAND_V = 46;
const SLAB_DEPTH = 2.6;

// ---------------------------------------------------------------------------
// Map key and pin details
// ---------------------------------------------------------------------------

export const KEY = [
  { n: 1, name: "Multi-purpose hall (future development)", title: "Multi-purpose hall", type: "Building", future: true },
  { n: 2, name: "Farm cafe", title: "Farm cafe", type: "Building" },
  { n: 3, name: "Storage facility", title: "Storage facility", type: "Building" },
  { n: 4, name: "Concoction & extraction laboratory", title: "Concoction & extraction laboratory", type: "Building" },
  { n: 5, name: "Restroom", title: "Restroom", type: "Building" },
  { n: 6, name: "Fertilizer preparation house", title: "Fertilizer preparation house", type: "Production" },
  { n: 7, name: "Fishpond (future development)", title: "Fishpond", type: "Aquaculture", future: true },
  { n: 8, name: "Greenhouse/nursery", title: "Greenhouse/nursery", type: "Production" },
  { n: 9, name: "Vermibit", title: "Vermibit", type: "Production" },
  { n: 10, name: "Garden plot", title: "Garden plot", type: "Crops" },
  { n: 11, name: "Practical area", title: "Practical area", type: "Training" },
  { n: 12, name: "Lecture room", title: "Lecture room", type: "Training" },
  { n: 13, name: "Kubo", title: "Kubo", type: "Rest area" },
  { n: 14, name: "Accommodation (Gueta residence)", title: "Accommodation (Gueta residence)", type: "Lodging" },
  { n: 15, name: "Hog house (Baboyang walang amoy)", title: "Hog house (Baboyang walang amoy)", type: "Livestock" },
  { n: 16, name: "Small ruminants", title: "Small ruminants", type: "Livestock" },
  { n: 17, name: "Poultry house", title: "Poultry house", type: "Livestock" },
  { n: 18, name: "Ranging area", title: "Ranging area", type: "Livestock" },
  { n: 19, name: "Camping grounds", title: "Camping grounds", type: "Recreation" },
  { n: 20, name: "Tree planting area / cassava production", title: "Tree planting area / cassava production", type: "Crops" },
];

const NOTES = {
  1: "Planned hall for trainings, meetings and community events.",
  2: "Serves visitors and trainees with food from the farm.",
  3: "Holds tools, seed stock and harvested produce.",
  4: "Prepares natural concoctions and plant extracts used across the farm.",
  5: "Restrooms for visitors and trainees.",
  6: "Mixes and cures organic fertilizer for the fields.",
  7: "Planned fishpond, part of the farm's integrated system.",
  8: "Raises seedlings under cover before they go out to the plots.",
  9: "Vermicomposting beds that turn farm waste into fertilizer.",
  10: "Raised beds for vegetables and herbs.",
  11: "Open, covered area for hands-on farm training.",
  12: "Classroom for lectures and seminars.",
  13: "Native hut for resting and small group talks.",
  14: "Lodging for guests and trainees.",
  15: "Odour-free hog raising on a deep-litter system.",
  16: "Housing for goats and sheep.",
  17: "Housing for laying and broiler chickens.",
  18: "Fenced paddock where the poultry range outdoors.",
  19: "Tent sites for campers and student groups.",
  20: "Tree planting and cassava production area.",
};

/** Every pin's details, keyed by pin id. */
export const INFO = {
  ...Object.fromEntries(
    KEY.map((k) => [
      `f${k.n}`,
      { n: k.n, title: k.title, name: k.name, type: k.type, future: Boolean(k.future), note: NOTES[k.n] },
    ]),
  ),
  w1: { title: "Water source", type: "Water", note: "Storage tank feeding the west cluster." },
  w2: { title: "Water source", type: "Water", note: "Storage tank for the accommodation and terraces." },
  w3: { title: "Water source", type: "Water", note: "Storage tank for the livestock area." },
  w4: { title: "Water source", type: "Water", note: "Storage tank for the south garden row." },
  w5: { title: "Water source", type: "Water", note: "Storage tank at the end of the irrigation canal." },
  o1: { title: "Ornamental plants", type: "Ornamentals", note: "Bed of purple flowering ornamentals." },
  o2: { title: "Ornamental plants", type: "Ornamentals", note: "Bed of orange flowering ornamentals." },
  mrf: { title: "Material recovery facility", type: "Waste management", note: "Sorts recyclables and biodegradable waste." },
};

// ---------------------------------------------------------------------------
// Layout (grid units)
// ---------------------------------------------------------------------------

/** Buildings and other solids. roof: gable | flat | hip | open | none. */
const BUILDINGS = [
  { id: "f12", u0: 3.5, v0: 8.8, u1: 8.2, v1: 12.8, h: 2.2, roof: "gable", roofColor: "roof" },
  { id: "f13", u0: 12.6, v0: 9.8, u1: 14.3, v1: 11.6, h: 1.5, roof: "hip", roofColor: "thatch", stilts: 0.5, wall: "bamboo" },
  { id: "f1", u0: 3.5, v0: 14.8, u1: 9.8, v1: 19.8, h: 2.8, roof: "gable", roofColor: "roof", future: true },
  { id: "f2", u0: 12.4, v0: 15, u1: 16.2, v1: 18.6, h: 2, roof: "gable", roofColor: "roof-green" },
  { id: "f3", u0: 17, v0: 15, u1: 20.2, v1: 18.2, h: 2, roof: "gable", roofColor: "roof-red" },
  { id: "f4", u0: 3.5, v0: 22, u1: 7.8, v1: 25.5, h: 2.1, roof: "flat", roofColor: "concrete" },
  { id: "f5", u0: 8.8, v0: 22.3, u1: 10.5, v1: 24.3, h: 1.6, roof: "flat", roofColor: "roof" },
  { id: "mrf", u0: 12.3, v0: 22.3, u1: 14.6, v1: 24.6, h: 1.6, roof: "flat", roofColor: "roof-green" },
  { id: "f11", u0: 15.5, v0: 22, u1: 20.5, v1: 25.8, h: 1.9, roof: "open", roofColor: "roof" },
  { id: "f6", u0: 3, v0: 31, u1: 7, v1: 34.6, h: 1.9, roof: "gable", roofColor: "roof" },
  { id: "f8", u0: 16.5, v0: 31, u1: 22, v1: 35, h: 1.9, roof: "gable", roofColor: "glass", glass: true },
  { id: "f14", u0: 25, v0: 3, u1: 33, v1: 8.5, h: 2.8, roof: "gable", roofColor: "roof-red" },
  { id: "f15", u0: 51, v0: 2.8, u1: 57.5, v1: 7, h: 1.8, roof: "gable", roofColor: "roof-dark" },
  { id: "f16", u0: 59, v0: 2.8, u1: 64, v1: 7, h: 1.6, roof: "gable", roofColor: "roof", stilts: 0.6, wall: "bamboo" },
  { id: "f17", u0: 51, v0: 10, u1: 58, v1: 13.2, h: 1.4, roof: "gable", roofColor: "roof-green", wall: "mesh" },
];

/** Water tanks, one per water-source pin. */
const TANKS = [
  { id: "w1", u: 21.2, v: 13.8 },
  { id: "w2", u: 34.3, v: 9.3 },
  { id: "w3", u: 50.3, v: 16 },
  { id: "w4", u: 37.2, v: 33 },
  { id: "w5", u: 43.5, v: 41.5 },
];

const PADDIES = [
  [3, 39.6, 14, 44.6],
  [15.5, 39.6, 26, 44.6],
  [27.5, 39.6, 38, 44.6],
];

const VEG_PLOTS = [
  [40, 31, 43.4, 35],
  [44, 31, 47.4, 35],
  [48, 31, 51.4, 35],
  [52, 31, 55.4, 35],
];

const GARDEN_BEDS = [
  [8.6, 31.2, 10.2, 34.8],
  [10.8, 31.2, 12.4, 34.8],
  [13, 31.2, 14.8, 34.8],
];

const TERRACE = { u0: 35.5, u1: 47, v0: 2, v1: 10 };
const OPEN_FIELD = [24, 13, 44, 28];
const ROAD = [0.2, 35.9, 67.8, 37.3];
const CANAL = { u0: 1, u1: 46, v0: 37.7, v1: 39.1, water0: 37.95, water1: 38.85 };
const BRIDGES = [14.7, 26.85];
const FISHPOND = [28.5, 31, 35, 35];
const VERMI = [23.5, 31, 27, 35];
const ORNAMENTALS = [
  { id: "o1", rect: [15, 9.6, 17.4, 12], color: "purple" },
  { id: "o2", rect: [17.9, 9.6, 20.5, 12], color: "orange" },
];
const PADDOCK = [59.5, 10, 66, 18];
const CAMP = [50, 19, 57, 26];
const SAPLINGS = [58.5, 21, 66, 34];
const ENTRANCE_V = 29.5;

const WALKWAYS = [
  [0.4, 29, 58, 30], // entrance road
  [10.8, 8.5, 11.8, 29], // west spine
  [3, 20.6, 22, 21.4], // west cluster cross path
  [22, 6, 23, 29], // to the accommodation
  [23, 6, 25, 6.9],
  [22, 10.6, 49, 11.4], // north path
  [48, 3, 49, 29], // east spine
  [49, 8.4, 66, 9.2], // livestock path
];

/** Pins: id, kind, anchor (u, v, z) and the layer they belong to. */
export const PINS = (() => {
  const pins = [];
  const centre = (b) => [(b.u0 + b.u1) / 2, (b.v0 + b.v1) / 2];
  for (const b of BUILDINGS) {
    const [u, v] = centre(b);
    const roofTop = b.h + (b.stilts || 0) + (b.roof === "flat" ? 0 : 0.9);
    pins.push({
      id: b.id,
      kind: b.id === "mrf" ? "recycle" : "facility",
      n: b.id.startsWith("f") ? Number(b.id.slice(1)) : undefined,
      u, v, z: roofTop,
      layer: "buildings",
    });
  }
  const area = (id, rect, z, layer) => {
    const [u0, v0, u1, v1] = rect;
    pins.push({ id, kind: "facility", n: Number(id.slice(1)), u: (u0 + u1) / 2, v: (v0 + v1) / 2, z, layer });
  };
  area("f7", FISHPOND, 0.2, "water");
  area("f9", VERMI, 0.8, "buildings");
  area("f10", [8.6, 31.2, 14.8, 34.8], 0.4, "veg");
  area("f18", PADDOCK, 0.9, "");
  area("f19", CAMP, 1.3, "");
  area("f20", SAPLINGS, 1.2, "trees");
  for (const t of TANKS) pins.push({ id: t.id, kind: "water", u: t.u, v: t.v, z: 1.6, layer: "water" });
  for (const o of ORNAMENTALS) {
    const [u0, v0, u1, v1] = o.rect;
    pins.push({ id: o.id, kind: "flower", u: (u0 + u1) / 2, v: (v0 + v1) / 2, z: 0.4, layer: "trees" });
  }
  return pins;
})();

// ---------------------------------------------------------------------------
// Deterministic scatter (trees, tufts) so the map is the same every render
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Irregular organic shoreline around the land, clockwise on screen. */
const SHORE = (() => {
  const pts = [];
  const r = 3.2; // corner rounding
  const path = [];
  const steps = 26;
  // Walk a rounded rectangle, then push each point in or out a little.
  const corners = [
    [r, r, Math.PI, 1.5 * Math.PI],
    [LAND_U - r, r, 1.5 * Math.PI, 2 * Math.PI],
    [LAND_U - r, LAND_V - r, 0, 0.5 * Math.PI],
    [r, LAND_V - r, 0.5 * Math.PI, Math.PI],
  ];
  for (const [cu, cv, a0, a1] of corners) {
    for (let i = 0; i <= 4; i++) {
      const a = a0 + ((a1 - a0) * i) / 4;
      path.push([cu + Math.cos(a) * r, cv + Math.sin(a) * r]);
    }
    path.push(null); // edge marker
  }
  // Densify the straight edges between corners.
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (p) {
      pts.push(p);
      continue;
    }
    const a = path[i - 1];
    const b = path[(i + 1) % path.length];
    for (let s = 1; s < steps; s++) pts.push([a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps]);
  }
  const cu = LAND_U / 2;
  const cv = LAND_V / 2;
  return pts.map(([u, v], i) => {
    const t = i / pts.length;
    const n = 0.65 * Math.sin(t * Math.PI * 14) + 0.45 * Math.sin(t * Math.PI * 31 + 1.3) + 0.25 * Math.sin(t * Math.PI * 57 + 0.4);
    const du = u - cu;
    const dv = v - cv;
    const len = Math.hypot(du, dv) || 1;
    return [u + (du / len) * n, v + (dv / len) * n];
  });
})();

function inRect(u, v, [u0, v0, u1, v1], m = 0) {
  return u > u0 - m && u < u1 + m && v > v0 - m && v < v1 + m;
}

/** Everything trees and tufts must stay off. */
const OCCUPIED = [
  ...BUILDINGS.map((b) => [b.u0, b.v0, b.u1, b.v1]),
  ...TANKS.map((t) => [t.u - 0.7, t.v - 0.7, t.u + 0.7, t.v + 0.7]),
  ...PADDIES,
  ...VEG_PLOTS,
  ...GARDEN_BEDS,
  [TERRACE.u0, TERRACE.v0, TERRACE.u1, TERRACE.v1],
  OPEN_FIELD,
  ROAD,
  [CANAL.u0, CANAL.v0, CANAL.u1, CANAL.v1],
  FISHPOND,
  VERMI,
  ...ORNAMENTALS.map((o) => o.rect),
  PADDOCK,
  CAMP,
  SAPLINGS,
  ...WALKWAYS,
  [-1, ENTRANCE_V - 1.4, 3, ENTRANCE_V + 1.4],
];

const TREES = (() => {
  const rand = mulberry32(20261008);
  const trees = [];
  for (let i = 0; i < 4800 && trees.length < 360; i++) {
    const u = 1.6 + rand() * (LAND_U - 3.2);
    const v = 1.6 + rand() * (LAND_V - 3.2);
    if (OCCUPIED.some((r) => inRect(u, v, r, 0.5))) continue;
    if (trees.some((t) => Math.abs(t.u - u) < 0.9 && Math.abs(t.v - v) < 0.9)) continue;
    const roll = rand();
    trees.push({
      u,
      v,
      kind: roll < 0.4 ? "palm" : roll < 0.78 ? "round" : "shrub",
      s: 0.78 + rand() * 0.45,
      hue: rand(),
    });
  }
  return trees;
})();

const TUFTS = (() => {
  const rand = mulberry32(77);
  const out = [];
  for (let i = 0; i < 1400 && out.length < 260; i++) {
    const u = 1.4 + rand() * (LAND_U - 2.8);
    const v = 1.4 + rand() * (LAND_V - 2.8);
    if (OCCUPIED.some((r) => inRect(u, v, r, 0.2))) continue;
    out.push([u, v]);
  }
  return out;
})();

/** Soft patches of lighter and darker grass, so the lawn is not one flat tone. */
const GRASS_PATCHES = (() => {
  const rand = mulberry32(4242);
  return Array.from({ length: 46 }, () => ({
    u: 2 + rand() * (LAND_U - 4),
    v: 2 + rand() * (LAND_V - 4),
    r: 2 + rand() * 4.5,
    light: rand() > 0.5,
  }));
})();

const FLOWER_DOTS = (() => {
  const rand = mulberry32(5);
  return ORNAMENTALS.map((o) => {
    const [u0, v0, u1, v1] = o.rect;
    return Array.from({ length: 30 }, () => [u0 + 0.25 + rand() * (u1 - u0 - 0.5), v0 + 0.25 + rand() * (v1 - v0 - 0.5), rand()]);
  });
})();

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

const r1 = (n) => Math.round(n * 10) / 10;
const col = (name) => `var(--lfm-${name})`;
const dark = (name, pct) => `color-mix(in srgb,var(--lfm-${name}) ${pct}%,#000)`;
const lite = (name, pct) => `color-mix(in srgb,var(--lfm-${name}) ${pct}%,#fff)`;

/** Sun from the west (-u) and a little south: shadows fall toward +u, -v. */
const SUN_U = 0.62;
const SUN_V = -0.34;

/** Convex hull (monotone chain) of screen points. */
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/**
 * Builds the map for a camera tilt (pitch) and a height scale for solids.
 *
 * Returns { width, height, inner, anchors }: inner is the SVG markup for a
 * viewBox of 0 0 width height, and anchors maps each pin id to the [x, y]
 * point (in the same units) where its pin stands.
 */
export function buildFarmMap(tilt = 1, height = 1) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const P = (u, v, z = 0) => {
    const x = (u - v) * 10;
    const y = (u + v) * 5 * tilt - z * 7.5 * height;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    return [x, y];
  };
  const pts = (list) => list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(" ");
  const face = (list, fill, extra = "") =>
    `<polygon points="${pts(list)}" style="fill:${fill};stroke:${fill};stroke-width:.5;stroke-linejoin:round"${extra}/>`;
  const overlay = (list, fill) => `<polygon points="${pts(list)}" style="fill:${fill}"/>`;
  const quad = (u0, v0, u1, v1, z, fill, extra) => face([P(u0, v0, z), P(u1, v0, z), P(u1, v1, z), P(u0, v1, z)], fill, extra);
  const line = (a, b, style, cls = "") =>
    `<line${cls ? ` class="${cls}"` : ""} x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}" style="${style}"/>`;

  const vFace = (u0, u1, v, z0, z1) => [P(u0, v, z0), P(u1, v, z0), P(u1, v, z1), P(u0, v, z1)];
  const uFace = (u, v0, v1, z0, z1) => [P(u, v0, z0), P(u, v1, z0), P(u, v1, z1), P(u, v0, z1)];

  /** Box with a lit top, a lighter +V face and a darker +U face. */
  const prism = (u0, v0, u1, v1, z0, z1, top, side = top, ao = false) => {
    const fv = vFace(u0, u1, v1, z0, z1);
    const fu = uFace(u1, v0, v1, z0, z1);
    let g = face(fv, dark(side, 88)) + face(fu, dark(side, 70));
    if (ao) g += overlay(fv, "url(#lfm-ao)") + overlay(fu, "url(#lfm-ao)");
    return g + quad(u0, v0, u1, v1, z1, col(top));
  };

  /** Rectangle drawn onto the +V face (v = const) / the +U face (u = const). */
  const onV = (v, ua, ub, za, zb, fill) => face(vFace(ua, ub, v, za, zb), fill);
  const onU = (u, va, vb, za, zb, fill) => face(uFace(u, va, vb, za, zb), fill);

  // Shadows are collected and drawn as one blurred layer on the ground, under
  // every solid, which is both cheaper and closer to how light falls.
  const shadows = [];
  const castShadow = (u0, v0, u1, v1, h, layer = "") => {
    const corners = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    const list = [];
    for (const [u, v] of corners) {
      list.push(P(u, v, 0));
      list.push(P(u + h * SUN_U, v + h * SUN_V, 0));
    }
    shadows.push(`<polygon${layer ? ` data-layer="${layer}"` : ""} points="${pts(hull(list))}"/>`);
  };

  const ground = [];
  const objects = []; // { d: depth, svg }
  const add = (d, svg) => objects.push({ d, svg });

  // --- Land slab ----------------------------------------------------------
  const shoreTop = SHORE.map(([u, v]) => P(u, v, 0));
  ground.push(
    `<polygon points="${pts(SHORE.map(([u, v]) => P(u + 2, v + 2, -SLAB_DEPTH - 0.5)))}" style="fill:${col("shadow")}" filter="url(#lfm-blur-lg)"/>`,
  );
  const cu = LAND_U / 2;
  const cv = LAND_V / 2;
  const edges = [];
  for (let i = 0; i < SHORE.length; i++) {
    const a = SHORE[i];
    const b = SHORE[(i + 1) % SHORE.length];
    let nu = b[1] - a[1];
    let nv = -(b[0] - a[0]);
    const mu = (a[0] + b[0]) / 2;
    const mv = (a[1] + b[1]) / 2;
    if (nu * (mu - cu) + nv * (mv - cv) < 0) {
      nu = -nu;
      nv = -nv;
    }
    if (nu + nv > 0) edges.push({ a, b, d: mu + mv, lit: nv > nu });
  }
  edges.sort((x, y) => x.d - y.d);
  let slab = "";
  const bands = [
    [0, -0.32, "grass-lip"],
    [-0.32, -0.9, "soil"],
    [-0.9, -1.75, "soil-2"],
    [-1.75, -SLAB_DEPTH, "soil-3"],
  ];
  for (const { a, b, lit } of edges) {
    for (const [zt, zb, c] of bands) {
      // Faces turned to the sun are a touch brighter, as on the buildings.
      slab += face([P(a[0], a[1], zt), P(b[0], b[1], zt), P(b[0], b[1], zb), P(a[0], a[1], zb)], lit ? col(c) : dark(c, 84));
    }
  }
  // Soil strata: a few thin lines across the cut.
  let strata = "";
  for (const z of [-0.6, -1.3, -2.1]) {
    strata += edges.map(({ a, b }) => `M${pts([P(a[0], a[1], z)])}L${pts([P(b[0], b[1], z)])}`).join("");
  }
  slab += `<path d="${strata}" style="fill:none;stroke:${col("soil-line")};stroke-width:.6;stroke-opacity:.5"/>`;
  ground.push(slab);
  ground.push(`<clipPath id="lfm-land"><polygon points="${pts(shoreTop)}"/></clipPath>`);
  ground.push(`<polygon points="${pts(shoreTop)}" style="fill:url(#lfm-grass-grad)"/>`);

  // Lawn variation, then a fine grain over everything green.
  let patches = "";
  for (const p of GRASS_PATCHES) {
    const [x, y] = P(p.u, p.v, 0);
    patches += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(p.r * 11)}" ry="${r1(p.r * 5.5 * tilt)}" style="fill:${p.light ? col("grass-light") : col("grass-dark")}"/>`;
  }
  ground.push(`<g clip-path="url(#lfm-land)" filter="url(#lfm-blur-lg)" opacity=".55">${patches}</g>`);
  ground.push(`<polygon points="${pts(shoreTop)}" style="fill:url(#lfm-grain)"/>`);

  // Grass tufts.
  let tufts = "";
  for (const [u, v] of TUFTS) {
    const [x, y] = P(u, v, 0);
    tufts += `M${r1(x - 2)} ${r1(y)}l1 -2.6l1 2.6l1 -3.4l1 3.4l1 -2.4`;
  }
  ground.push(`<path data-layer="trees" d="${tufts}" style="fill:none;stroke:${col("tuft")};stroke-width:.8;stroke-linecap:round;stroke-linejoin:round"/>`);

  // --- Flat ground features ----------------------------------------------
  // Open field: tilled soil with ridges and furrows.
  {
    const [u0, v0, u1, v1] = OPEN_FIELD;
    let g = prism(u0, v0, u1, v1, 0, 0.1, "field", "soil");
    g += quad(u0, v0, u1, v1, 0.1, "url(#lfm-field-grad)");
    let ridges = "";
    let furrows = "";
    for (let v = v0 + 0.5; v < v1 - 0.2; v += 0.6) {
      const a = P(u0 + 0.3, v, 0.1);
      const b = P(u1 - 0.3, v, 0.1);
      furrows += `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`;
      ridges += `M${r1(a[0])} ${r1(a[1] - 1.1)}L${r1(b[0])} ${r1(b[1] - 1.1)}`;
    }
    g += `<path d="${furrows}" style="fill:none;stroke:${col("field-furrow")};stroke-width:1.3"/>`;
    g += `<path d="${ridges}" style="fill:none;stroke:${col("field-ridge")};stroke-width:.7"/>`;
    ground.push(g);
  }

  // Farm-to-market road: asphalt, white edges, a yellow centre line.
  {
    const [u0, v0, u1, v1] = ROAD;
    let g = quad(u0, v0 - 0.12, u1, v1 + 0.12, 0.02, col("road-shoulder"));
    g += quad(u0, v0, u1, v1, 0.03, "url(#lfm-road-grad)");
    for (const v of [v0 + 0.12, v1 - 0.12]) g += line(P(u0 + 0.2, v, 0.03), P(u1 - 0.2, v, 0.03), `stroke:${col("road-edge")};stroke-width:.8;stroke-opacity:.8`);
    g += line(P(u0 + 0.5, (v0 + v1) / 2, 0.03), P(u1 - 0.5, (v0 + v1) / 2, 0.03), `stroke:${col("road-line")};stroke-width:1.1;stroke-dasharray:7 7`);
    ground.push(g);
  }

  // Irrigation canal with an animated flow.
  {
    const { u0, u1, v0, v1, water0, water1 } = CANAL;
    let g = quad(u0, v0, u1, v1, 0.02, col("bank"));
    g += onV(water0, u0, u1, -0.24, 0.02, dark("bank", 70));
    g += quad(u0, water0, u1, water1, -0.24, "url(#lfm-water-grad)");
    const mid = (water0 + water1) / 2;
    g += line(P(u0 + 0.3, mid - 0.15, -0.24), P(u1 - 0.3, mid - 0.15, -0.24), `stroke:${col("water-hi")};stroke-width:1.3;stroke-linecap:round;stroke-dasharray:5 13`, "lfm-flow");
    g += line(P(u0 + 0.3, mid + 0.2, -0.24), P(u1 - 0.3, mid + 0.2, -0.24), `stroke:${col("water-hi")};stroke-width:.8;stroke-linecap:round;stroke-dasharray:3 17;stroke-opacity:.7`, "lfm-flow lfm-flow--slow");
    ground.push(`<g data-layer="water">${g}</g>`);
  }

  // Walkways: slightly raised, with a soft edge.
  ground.push(WALKWAYS.map(([u0, v0, u1, v1]) => prism(u0, v0, u1, v1, 0, 0.06, "path", "path-edge")).join(""));

  // Rice paddies: sunken, tan bund, golden rows and dots.
  {
    let g = "";
    for (const [u0, v0, u1, v1] of PADDIES) {
      g += prism(u0, v0, u1, v1, 0, 0.2, "bund");
      const i = 0.4;
      const [a0, b0, a1, b1] = [u0 + i, v0 + i, u1 - i, v1 - i];
      g += onV(b0, a0, a1, -0.15, 0.2, dark("bund", 78));
      g += onU(a0, b0, b1, -0.15, 0.2, dark("bund", 66));
      g += quad(a0, b0, a1, b1, -0.15, "url(#lfm-rice-grad)");
      let rows = "";
      for (let v = b0 + 0.45; v < b1 - 0.2; v += 0.55) {
        const a = P(a0 + 0.2, v, -0.15);
        const b = P(a1 - 0.2, v, -0.15);
        rows += `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`;
      }
      g += `<path d="${rows}" style="fill:none;stroke:${col("rice-row")};stroke-width:.8"/>`;
      g += `<path d="${rows}" style="fill:none;stroke:${col("rice-dot")};stroke-width:2;stroke-linecap:round;stroke-dasharray:0 4"/>`;
    }
    ground.push(`<g data-layer="rice">${g}</g>`);
  }

  // Vegetable plots and the garden plot beds: green with dotted rows.
  const vegPlot = (u0, v0, u1, v1, z = 0.22) => {
    let g = prism(u0, v0, u1, v1, 0, z, "veg", "veg-soil");
    let rows = "";
    for (let u = u0 + 0.35; u < u1 - 0.2; u += 0.5) {
      const a = P(u, v0 + 0.25, z);
      const b = P(u, v1 - 0.25, z);
      rows += `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`;
    }
    g += `<path d="${rows}" style="fill:none;stroke:${col("veg-row")};stroke-width:2.2;stroke-linecap:round;stroke-dasharray:0 3.4"/>`;
    g += `<path d="${rows}" style="fill:none;stroke:${col("veg-leaf")};stroke-width:1.1;stroke-linecap:round;stroke-dasharray:0 3.4"/>`;
    return g;
  };
  ground.push(`<g data-layer="veg">${[...VEG_PLOTS, ...GARDEN_BEDS].map((r) => vegPlot(...r)).join("")}</g>`);

  // Terraced vegetable plots: 7 strips, stepping up and shortening to the back.
  {
    const { u0, u1, v0, v1 } = TERRACE;
    const n = 7;
    const dv = (v1 - v0) / n;
    let g = "";
    for (let i = n - 1; i >= 0; i--) {
      const sv1 = v1 - i * dv;
      const sv0 = sv1 - dv;
      const shrink = i * 0.55;
      const su0 = u0 + shrink;
      const su1 = u1 - shrink;
      const z = 0.3 + i * 0.42;
      g += prism(su0, sv0, su1, sv1, 0, z, "veg", "terrace-soil", true);
      let rows = "";
      for (let v = sv0 + 0.35; v < sv1 - 0.15; v += 0.42) {
        const a = P(su0 + 0.3, v, z);
        const b = P(su1 - 0.3, v, z);
        rows += `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`;
      }
      g += `<path d="${rows}" style="fill:none;stroke:${col("veg-row")};stroke-width:2;stroke-linecap:round;stroke-dasharray:0 3.2"/>`;
    }
    ground.push(`<g data-layer="veg">${g}</g>`);
  }

  // Ornamental beds.
  ORNAMENTALS.forEach((o, idx) => {
    const [u0, v0, u1, v1] = o.rect;
    let g = prism(u0, v0, u1, v1, 0, 0.2, "bed-soil", "bed-soil");
    for (const [u, v, k] of FLOWER_DOTS[idx]) {
      const [x, y] = P(u, v, 0.2);
      g += `<circle cx="${r1(x)}" cy="${r1(y - 1.2)}" r="${k > 0.6 ? 2 : 1.5}" style="fill:${k > 0.82 ? col("leaf") : k > 0.3 ? col(o.color) : lite(o.color, 55)}"/>`;
    }
    ground.push(`<g data-layer="trees">${g}</g>`);
  });

  // Tree planting / cassava area: tilled plot.
  {
    const [u0, v0, u1, v1] = SAPLINGS;
    ground.push(`<g data-layer="trees">${quad(u0, v0, u1, v1, 0.03, col("plot-soil"))}</g>`);
  }

  // Paddock floor and camp ground.
  ground.push(quad(...PADDOCK, 0.03, col("paddock")));
  ground.push(quad(...CAMP, 0.03, col("camp")));
  {
    const b = BUILDINGS.find((x) => x.id === "f11");
    ground.push(quad(b.u0 - 0.2, b.v0 - 0.2, b.u1 + 0.2, b.v1 + 0.2, 0.05, col("concrete")));
  }

  // Fishpond (future): translucent water in a dashed amber outline.
  {
    const [u0, v0, u1, v1] = FISHPOND;
    const corners = [P(u0, v0, 0.05), P(u1, v0, 0.05), P(u1, v1, 0.05), P(u0, v1, 0.05)];
    const inner = [P(u0 + 0.7, v0 + 0.7, 0.05), P(u1 - 0.7, v0 + 0.7, 0.05), P(u1 - 0.7, v1 - 0.7, 0.05), P(u0 + 0.7, v1 - 0.7, 0.05)];
    ground.push(
      `<g data-layer="water"><polygon points="${pts(corners)}" style="fill:${col("future")};fill-opacity:.16;stroke:${col("future")};stroke-width:1.6;stroke-dasharray:5 4"/>` +
        `<polygon points="${pts(inner)}" style="fill:url(#lfm-water-grad);fill-opacity:.45"/></g>`,
    );
  }

  // Entrance arrow and label.
  {
    const v = ENTRANCE_V;
    const arrow = [P(-4.6, v - 0.45, 0.05), P(-1.4, v - 0.45, 0.05), P(-1.4, v - 1.1, 0.05), P(0.4, v, 0.05), P(-1.4, v + 1.1, 0.05), P(-1.4, v + 0.45, 0.05), P(-4.6, v + 0.45, 0.05)];
    const [lx, ly] = P(-4.2, v + 2.4, 0);
    ground.push(
      `<polygon points="${pts(arrow)}" style="fill:${col("accent")};stroke:#fff;stroke-width:1.2;stroke-linejoin:round"/>` +
        `<text x="${r1(lx)}" y="${r1(ly)}" class="lfm-label" text-anchor="middle">Entrance</text>`,
    );
  }

  // --- Solids, drawn back to front ---------------------------------------

  // Bridges over the canal.
  for (const u of BRIDGES) {
    const u0 = u - 0.6;
    const u1 = u + 0.6;
    let g = prism(u0, CANAL.v0 - 0.15, u1, CANAL.v1 + 0.15, 0.05, 0.3, "wood");
    let planks = "";
    for (let v = CANAL.v0; v < CANAL.v1 + 0.1; v += 0.25) {
      const a = P(u0, v, 0.3);
      const b = P(u1, v, 0.3);
      planks += `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`;
    }
    g += `<path d="${planks}" style="stroke:${dark("wood", 68)};stroke-width:.6"/>`;
    g += prism(u0, CANAL.v0 - 0.15, u0 + 0.12, CANAL.v1 + 0.15, 0.3, 0.8, "wood");
    g += prism(u1 - 0.12, CANAL.v0 - 0.15, u1, CANAL.v1 + 0.15, 0.3, 0.8, "wood");
    castShadow(u0, CANAL.v0, u1, CANAL.v1, 0.3, "water");
    add(u + (CANAL.v0 + CANAL.v1) / 2, `<g data-layer="water">${g}</g>`);
  }

  // Vermibit: low concrete bins of dark compost under a light shed roof.
  {
    const [u0, v0, u1, v1] = VERMI;
    let g = "";
    const n = 3;
    const w = (v1 - v0 - 0.4 * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const b0 = v0 + i * (w + 0.4);
      castShadow(u0, b0, u1, b0 + w, 0.55, "buildings");
      g += prism(u0, b0, u1, b0 + w, 0, 0.55, "concrete", "concrete", true);
      g += quad(u0 + 0.2, b0 + 0.2, u1 - 0.2, b0 + w - 0.2, 0.55, col("compost"));
    }
    add((u0 + u1 + v0 + v1) / 2, `<g data-layer="buildings">${g}</g>`);
  }

  // Water tanks: a cylinder on a concrete stand.
  for (const t of TANKS) {
    const s = 0.55;
    castShadow(t.u - s, t.v - s, t.u + s, t.v + s, 1.5, "water");
    let g = prism(t.u - s, t.v - s, t.u + s, t.v + s, 0, 0.32, "concrete", "concrete", true);
    g += drawCylinder(t.u, t.v, 0.48, 0.32, 1.5, "tank");
    add(t.u + t.v, `<g data-layer="water">${g}</g>`);
  }

  // Buildings.
  for (const b of BUILDINGS) {
    if (!b.future) castShadow(b.u0, b.v0, b.u1, b.v1, (b.stilts || 0) + b.h + (b.roof === "flat" ? 0.2 : 0.6), "buildings");
    add((b.u0 + b.u1 + b.v0 + b.v1) / 2, `<g data-layer="buildings">${drawBuilding(b)}</g>`);
  }

  // Ranging paddock fence (back sides first, front sides in front).
  {
    const [u0, v0, u1, v1] = PADDOCK;
    const fence = (a, b) => {
      let posts = "";
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.round(len / 1));
      for (let i = 0; i <= n; i++) {
        const u = a[0] + ((b[0] - a[0]) * i) / n;
        const v = a[1] + ((b[1] - a[1]) * i) / n;
        const p0 = P(u, v, 0);
        const p1 = P(u, v, 0.9);
        posts += `M${r1(p0[0])} ${r1(p0[1])}L${r1(p1[0])} ${r1(p1[1])}`;
      }
      let rails = "";
      for (const z of [0.38, 0.8]) {
        const p0 = P(a[0], a[1], z);
        const p1 = P(b[0], b[1], z);
        rails += `M${r1(p0[0])} ${r1(p0[1])}L${r1(p1[0])} ${r1(p1[1])}`;
      }
      return `<path d="${posts}" style="stroke:${col("fence")};stroke-width:1.4"/><path d="${rails}" style="stroke:${lite("fence", 80)};stroke-width:.8"/>`;
    };
    add(u0 + v0, fence([u0, v1], [u0, v0]) + fence([u0, v0], [u1, v0]));
    const rand = mulberry32(18);
    let hens = "";
    for (let i = 0; i < 16; i++) {
      const [x, y] = P(u0 + 0.8 + rand() * (u1 - u0 - 1.6), v0 + 0.8 + rand() * (v1 - v0 - 1.6), 0.05);
      const c = rand() > 0.4 ? col("hen") : col("hen-2");
      hens += `<ellipse cx="${r1(x + 1)}" cy="${r1(y)}" rx="2.2" ry=".8" style="fill:${col("shadow")}"/><ellipse cx="${r1(x)}" cy="${r1(y - 1.6)}" rx="2" ry="1.5" style="fill:${c}"/><circle cx="${r1(x - 1.6)}" cy="${r1(y - 2.6)}" r=".9" style="fill:${c}"/><circle cx="${r1(x - 1.9)}" cy="${r1(y - 3.3)}" r=".45" style="fill:#d4372b"/>`;
    }
    add(u0 + v0 + 0.5, hens);
    add(u1 + v1, fence([u0, v1], [u1, v1]) + fence([u1, v0], [u1, v1]));
  }

  // Camping tents and a campfire.
  {
    const [u0, v0] = CAMP;
    const spots = [[1, 1], [3.6, 1.4], [1.4, 4], [4.4, 4.2], [2.6, 6]];
    spots.forEach(([du, dv], i) => {
      const t0 = u0 + du;
      const s0 = v0 + dv;
      castShadow(t0, s0, t0 + 1.7, s0 + 1.3, 0.8, "buildings");
      add(t0 + s0 + 1.6, `<g data-layer="buildings">${drawTent(t0, s0, t0 + 1.7, s0 + 1.3, `tent-${(i % 3) + 1}`)}</g>`);
    });
    const [fx, fy] = P(u0 + 4.6, v0 + 2.9, 0.05);
    add(
      u0 + v0 + 7.5,
      `<circle cx="${r1(fx)}" cy="${r1(fy)}" r="7" style="fill:${col("fire-glow")}" filter="url(#lfm-blur)"/>` +
        `<circle cx="${r1(fx)}" cy="${r1(fy)}" r="2.8" style="fill:${col("orange")}"/><circle cx="${r1(fx)}" cy="${r1(fy - 1)}" r="1.4" style="fill:#ffd36b"/>`,
    );
  }

  // Saplings in a grid (tree planting / cassava).
  {
    const [u0, v0, u1, v1] = SAPLINGS;
    for (let u = u0 + 0.6; u < u1 - 0.3; u += 1.1) {
      for (let v = v0 + 0.6; v < v1 - 0.3; v += 1.1) {
        const [x, y] = P(u, v, 0.03);
        const [, ty] = P(u, v, 0.8);
        shadows.push(`<ellipse data-layer="trees" cx="${r1(x + 3)}" cy="${r1(y)}" rx="3" ry="1.3"/>`);
        add(
          u + v,
          `<g data-layer="trees"><line x1="${r1(x)}" y1="${r1(y)}" x2="${r1(x)}" y2="${r1(ty)}" style="stroke:${col("trunk")};stroke-width:1"/>` +
            `<circle cx="${r1(x)}" cy="${r1(ty)}" r="2.8" style="fill:${dark("sapling", 82)}"/><circle cx="${r1(x - 0.6)}" cy="${r1(ty - 0.7)}" r="2" style="fill:${col("sapling")}"/></g>`,
        );
      }
    }
  }

  // Trees.
  for (const t of TREES) add(t.u + t.v, `<g data-layer="trees">${drawTree(t)}</g>`);

  objects.sort((a, b) => a.d - b.d);

  // --- Pin anchors --------------------------------------------------------
  const anchorsRaw = {};
  for (const p of PINS) anchorsRaw[p.id] = P(p.u, p.v, p.z);

  // --- Assemble ---------------------------------------------------------------
  const pad = 30;
  const top = minY - 30; // room for the pin heads above the tallest roofs
  const width = Math.ceil(maxX - minX + pad * 2);
  const heightPx = Math.ceil(maxY - top + pad * 2);
  const tx = r1(pad - minX);
  const ty = r1(pad - top);

  const anchors = {};
  for (const [id, [x, y]] of Object.entries(anchorsRaw)) anchors[id] = [r1(x + tx), r1(y + ty)];

  const defs =
    `<defs>` +
    `<filter id="lfm-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>` +
    `<filter id="lfm-blur-lg" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="8"/></filter>` +
    `<filter id="lfm-shadow" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.6"/></filter>` +
    `<linearGradient id="lfm-grass-grad" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" style="stop-color:var(--lfm-grass-2)"/><stop offset=".55" style="stop-color:var(--lfm-grass)"/><stop offset="1" style="stop-color:var(--lfm-grass-3)"/>` +
    `</linearGradient>` +
    `<linearGradient id="lfm-ao" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".55" stop-color="#000" stop-opacity=".04"/><stop offset="1" stop-color="#000" stop-opacity=".3"/>` +
    `</linearGradient>` +
    `<linearGradient id="lfm-eave" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#000" stop-opacity=".32"/><stop offset="1" stop-color="#000" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<linearGradient id="lfm-sheen" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".5" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".12"/>` +
    `</linearGradient>` +
    `<radialGradient id="lfm-canopy" cx=".34" cy=".3" r=".75">` +
    `<stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/>` +
    `</radialGradient>` +
    `<linearGradient id="lfm-water-grad" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" style="stop-color:var(--lfm-water-2)"/><stop offset="1" style="stop-color:var(--lfm-water)"/>` +
    `</linearGradient>` +
    `<linearGradient id="lfm-rice-grad" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" style="stop-color:var(--lfm-rice-2)"/><stop offset="1" style="stop-color:var(--lfm-rice)"/>` +
    `</linearGradient>` +
    `<linearGradient id="lfm-field-grad" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".18"/>` +
    `</linearGradient>` +
    `<linearGradient id="lfm-road-grad" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" style="stop-color:var(--lfm-road)"/><stop offset="1" style="stop-color:var(--lfm-road-2)"/>` +
    `</linearGradient>` +
    `<pattern id="lfm-grain" width="17" height="11" patternUnits="userSpaceOnUse">` +
    `<ellipse cx="3" cy="2" rx="1.6" ry=".7" fill="#000" fill-opacity=".05"/><ellipse cx="11" cy="7" rx="1.9" ry=".8" fill="#fff" fill-opacity=".06"/>` +
    `<ellipse cx="14" cy="2.5" rx="1" ry=".5" fill="#000" fill-opacity=".04"/><ellipse cx="6" cy="9" rx="1.2" ry=".5" fill="#fff" fill-opacity=".05"/>` +
    `</pattern>` +
    `</defs>`;

  const inner =
    defs +
    `<g transform="translate(${tx} ${ty})">` +
    ground.join("") +
    `<g filter="url(#lfm-shadow)" style="fill:${col("cast")}">${shadows.join("")}</g>` +
    objects.map((o) => o.svg).join("") +
    `</g>`;

  return { width, height: heightPx, inner, anchors };

  // --- Helpers that need P -------------------------------------------------

  function drawCylinder(u, v, r, z0, z1, c) {
    // Approximated by a 12-sided prism: the visible half, then the lid.
    const n = 12;
    const ring = (z) => Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return [u + Math.cos(a) * r, v + Math.sin(a) * r, z];
    });
    const lo = ring(z0);
    const hi = ring(z1);
    let g = "";
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const mu = (lo[i][0] + lo[j][0]) / 2 - u;
      const mv = (lo[i][1] + lo[j][1]) / 2 - v;
      if (mu + mv <= 0) continue; // back side
      const shade = 64 + Math.round(((mv - mu) / (r * 2) + 0.5) * 32);
      g += face([P(...lo[i]), P(...lo[j]), P(...hi[j]), P(...hi[i])], dark(c, Math.min(100, shade)));
    }
    g += face(hi.map((p) => P(...p)), lite(c, 88));
    g += face(ring(z1 + 0.12).map(([a, b, z]) => P(u + (a - u) * 0.35, v + (b - v) * 0.35, z)), dark(c, 80));
    for (const z of [z0 + (z1 - z0) * 0.35, z0 + (z1 - z0) * 0.7]) {
      const left = P(u - r * 0.72, v + r * 0.72, z);
      const right = P(u + r * 0.72, v - r * 0.72, z);
      const front = P(u + r * 0.7, v + r * 0.7, z - 0.05);
      g += `<path d="M${r1(left[0])} ${r1(left[1])}Q${r1(front[0])} ${r1(front[1] + 3)} ${r1(right[0])} ${r1(right[1])}" style="fill:none;stroke:${dark(c, 60)};stroke-width:.7;stroke-opacity:.6"/>`;
    }
    return g;
  }

  /** Front/back slopes, the gable end and corrugation, for a ridge along u or v. */
  function gableRoof(u0, v0, u1, v1, h, rise, roofCol, glass = false) {
    const e = 0.28; // eaves
    const [a0, b0, a1, b1] = [u0 - e, v0 - e, u1 + e, v1 + e];
    const plane = (list, fill, ribs) => {
      if (glass) return `<polygon points="${pts(list)}" style="fill:${col("glass")};fill-opacity:.4;stroke:${col("glass-edge")};stroke-width:.8;stroke-linejoin:round"/>`;
      return face(list, fill) + (ribs || "") + overlay(list, "url(#lfm-sheen)");
    };
    const ribs = (from, to, steps, z0, z1, axis) => {
      let d = "";
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const s = from + (to - from) * t;
        const [p, q] = axis === "u" ? [P(s, z0.v, z0.z), P(s, z1.v, z1.z)] : [P(z0.u, s, z0.z), P(z1.u, s, z1.z)];
        d += `M${r1(p[0])} ${r1(p[1])}L${r1(q[0])} ${r1(q[1])}`;
      }
      return `<path d="${d}" style="fill:none;stroke:#000;stroke-opacity:.12;stroke-width:.6"/>`;
    };
    if (u1 - u0 >= v1 - v0) {
      const vm = (v0 + v1) / 2;
      const steps = Math.round((a1 - a0) / 0.35);
      const back = [P(a0, b0, h), P(a1, b0, h), P(a1, vm, h + rise), P(a0, vm, h + rise)];
      const front = [P(a0, b1, h), P(a1, b1, h), P(a1, vm, h + rise), P(a0, vm, h + rise)];
      let g = plane(back, dark(roofCol, 76));
      g += glass ? "" : face([P(u1, v0, h), P(u1, v1, h), P(u1, vm, h + rise)], dark("wall", 72));
      g += plane(front, col(roofCol), ribs(a0, a1, steps, { v: b1, z: h }, { v: vm, z: h + rise }, "u"));
      g += face([P(a0, b1, h), P(a1, b1, h), P(a1, b1, h - 0.08), P(a0, b1, h - 0.08)], dark(roofCol, 55));
      g += line(P(a0, vm, h + rise), P(a1, vm, h + rise), `stroke:${lite(roofCol, 65)};stroke-width:1.1;stroke-linecap:round`);
      return g;
    }
    const um = (u0 + u1) / 2;
    const steps = Math.round((b1 - b0) / 0.35);
    const left = [P(a0, b0, h), P(a0, b1, h), P(um, b1, h + rise), P(um, b0, h + rise)];
    const right = [P(a1, b0, h), P(a1, b1, h), P(um, b1, h + rise), P(um, b0, h + rise)];
    let g = plane(left, lite(roofCol, 90));
    g += glass ? "" : face([P(u0, v1, h), P(u1, v1, h), P(um, v1, h + rise)], dark("wall", 86));
    g += plane(right, dark(roofCol, 80), ribs(b0, b1, steps, { u: a1, z: h }, { u: um, z: h + rise }, "v"));
    g += face([P(a1, b0, h), P(a1, b1, h), P(a1, b1, h - 0.08), P(a1, b0, h - 0.08)], dark(roofCol, 50));
    g += line(P(um, b0, h + rise), P(um, b1, h + rise), `stroke:${lite(roofCol, 65)};stroke-width:1.1;stroke-linecap:round`);
    return g;
  }

  function hipRoof(u0, v0, u1, v1, h, rise, roofCol) {
    const e = 0.32;
    const [a0, b0, a1, b1] = [u0 - e, v0 - e, u1 + e, v1 + e];
    const apex = P((u0 + u1) / 2, (v0 + v1) / 2, h + rise);
    const f1 = [P(a0, b1, h), P(a1, b1, h), apex];
    const f2 = [P(a1, b0, h), P(a1, b1, h), apex];
    let g = face([P(a0, b0, h), P(a1, b0, h), apex], dark(roofCol, 80));
    g += face([P(a0, b0, h), P(a0, b1, h), apex], dark(roofCol, 88));
    g += face(f1, col(roofCol)) + overlay(f1, "url(#lfm-sheen)");
    g += face(f2, dark(roofCol, 74));
    // Thatch texture: short strokes down the slopes.
    let d = "";
    for (let i = 1; i < 8; i++) {
      const t = i / 8;
      for (const [a, b] of [[P(a0, b1, h), P(a1, b1, h)], [P(a1, b1, h), P(a1, b0, h)]]) {
        const x = a[0] + (b[0] - a[0]) * t;
        const y = a[1] + (b[1] - a[1]) * t;
        d += `M${r1(x)} ${r1(y)}L${r1(x + (apex[0] - x) * 0.35)} ${r1(y + (apex[1] - y) * 0.35)}`;
      }
    }
    return g + `<path d="${d}" style="fill:none;stroke:#000;stroke-opacity:.15;stroke-width:.7"/>`;
  }

  /** A window or door with a frame and a glint. */
  function opening(list, fill, frame, glint = true) {
    let g = `<polygon points="${pts(list)}" style="fill:${fill};stroke:${frame};stroke-width:.9;stroke-linejoin:round"/>`;
    if (glint) {
      const [a, b, , d] = list;
      const p = [a[0] + (b[0] - a[0]) * 0.15 + (d[0] - a[0]) * 0.8, a[1] + (b[1] - a[1]) * 0.15 + (d[1] - a[1]) * 0.8];
      const q = [a[0] + (b[0] - a[0]) * 0.55 + (d[0] - a[0]) * 0.35, a[1] + (b[1] - a[1]) * 0.55 + (d[1] - a[1]) * 0.35];
      g += `<line x1="${r1(p[0])}" y1="${r1(p[1])}" x2="${r1(q[0])}" y2="${r1(q[1])}" style="stroke:#fff;stroke-opacity:.55;stroke-width:.8"/>`;
    }
    return g;
  }

  function drawBuilding(b) {
    const { u0, v0, u1, v1 } = b;
    const base = b.stilts || 0;
    const h = base + b.h;
    const rise = Math.min(1.4, Math.min(u1 - u0, v1 - v0) * 0.38);

    if (b.future) {
      // Planned, not built: a translucent dashed outline.
      const dash = ` style="fill:${col("future")};fill-opacity:.14;stroke:${col("future")};stroke-width:1.3;stroke-dasharray:4 3;stroke-linejoin:round"`;
      const poly = (list) => `<polygon points="${pts(list)}"${dash}/>`;
      const vm = (v0 + v1) / 2;
      return (
        poly([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)]) +
        poly(vFace(u0, u1, v1, 0, h)) +
        poly(uFace(u1, v0, v1, 0, h)) +
        poly([P(u0, v1, h), P(u1, v1, h), P(u1, vm, h + rise), P(u0, vm, h + rise)]) +
        poly([P(u1, v0, h), P(u1, v1, h), P(u1, vm, h + rise)])
      );
    }

    let g = "";
    if (b.roof === "open") {
      // Posts, benches and a roof; no walls.
      let posts = "";
      for (const [pu, pv] of [[u0, v1], [u1, v1], [u1, v0], [(u0 + u1) / 2, v1]]) {
        const p = P(pu, pv, 0);
        const q = P(pu, pv, h);
        posts += `M${r1(p[0])} ${r1(p[1])}L${r1(q[0])} ${r1(q[1])}`;
      }
      for (let u = u0 + 0.8; u < u1 - 0.5; u += 1.4) g += prism(u, v0 + 1, u + 0.9, v1 - 1, 0, 0.35, "wood");
      g += `<path d="${posts}" style="stroke:${dark("wood", 85)};stroke-width:2.2"/>`;
      return g + gableRoof(u0, v0, u1, v1, h, rise, b.roofColor);
    }

    // Foundation plinth.
    if (!base) g += prism(u0 - 0.1, v0 - 0.1, u1 + 0.1, v1 + 0.1, 0, 0.14, "plinth");

    if (base) {
      let posts = "";
      for (const [pu, pv] of [[u0 + 0.15, v1 - 0.15], [u1 - 0.15, v1 - 0.15], [u1 - 0.15, v0 + 0.15], [(u0 + u1) / 2, v1 - 0.15]]) {
        const p = P(pu, pv, 0);
        const q = P(pu, pv, base);
        posts += `M${r1(p[0])} ${r1(p[1])}L${r1(q[0])} ${r1(q[1])}`;
      }
      g += `<path d="${posts}" style="stroke:${dark("wood", 80)};stroke-width:1.8"/>`;
      g += prism(u0 - 0.15, v0 - 0.15, u1 + 0.15, v1 + 0.15, base - 0.12, base, "wood");
    }

    if (b.glass) {
      // Greenhouse: beds inside, then translucent glass and its frame.
      g += quad(u0 + 0.3, v0 + 0.3, u1 - 0.3, v1 - 0.3, 0.15, col("veg"));
      const glass = (list) => `<polygon points="${pts(list)}" style="fill:${col("glass")};fill-opacity:.38;stroke:${col("glass-edge")};stroke-width:.9;stroke-linejoin:round"/>`;
      g += glass(vFace(u0, u1, v1, 0.14, h));
      g += glass(uFace(u1, v0, v1, 0.14, h));
      g += gableRoof(u0, v0, u1, v1, h, rise, "glass", true);
      const vm = (v0 + v1) / 2;
      let d = "";
      for (let u = u0 + 0.9; u < u1 - 0.2; u += 0.9) {
        const a = P(u, v1, 0.14);
        const bb = P(u, v1, h);
        const c = P(u, vm, h + rise);
        d += `M${r1(a[0])} ${r1(a[1])}L${r1(bb[0])} ${r1(bb[1])}L${r1(c[0])} ${r1(c[1])}`;
      }
      return g + `<path d="${d}" style="fill:none;stroke:${col("glass-edge")};stroke-width:.7;stroke-opacity:.9"/>`;
    }

    const wall = b.wall === "bamboo" ? "bamboo" : b.wall === "mesh" ? "mesh" : "wall";
    const z0 = base || 0.14;
    const fv = vFace(u0, u1, v1, z0, h);
    const fu = uFace(u1, v0, v1, z0, h);
    g += face(fv, dark(wall, 94)) + face(fu, dark(wall, 74));
    if (wall === "bamboo" || wall === "mesh") {
      // Vertical slats or mesh lines.
      let d = "";
      for (let u = u0 + 0.22; u < u1; u += 0.22) {
        const p = P(u, v1, z0);
        const q = P(u, v1, h);
        d += `M${r1(p[0])} ${r1(p[1])}L${r1(q[0])} ${r1(q[1])}`;
      }
      for (let v = v0 + 0.22; v < v1; v += 0.22) {
        const p = P(u1, v, z0);
        const q = P(u1, v, h);
        d += `M${r1(p[0])} ${r1(p[1])}L${r1(q[0])} ${r1(q[1])}`;
      }
      g += `<path d="${d}" style="fill:none;stroke:#000;stroke-opacity:${wall === "mesh" ? 0.18 : 0.14};stroke-width:.6"/>`;
    }
    g += overlay(fv, "url(#lfm-ao)") + overlay(fu, "url(#lfm-ao)");
    g += quad(u0, v0, u1, v1, h, col(wall));

    // Door on the +V face and windows on both faces.
    const um = (u0 + u1) / 2;
    const dh = Math.min(1.2, b.h * 0.62);
    g += opening(vFace(um - 0.34, um + 0.34, v1, z0, z0 + dh), col("door"), lite("wall", 70), false);
    const winZ0 = z0 + b.h * 0.42;
    const winZ1 = z0 + b.h * 0.74;
    if (wall !== "mesh") {
      for (let u = u0 + 0.5; u < u1 - 0.6; u += 1.3) {
        if (Math.abs(u + 0.25 - um) < 0.75) continue;
        g += opening(vFace(u, u + 0.52, v1, winZ0, winZ1), col("window"), lite("wall", 60));
      }
      for (let v = v0 + 0.5; v < v1 - 0.6; v += 1.3) {
        g += opening(uFace(u1, v, v + 0.52, winZ0, winZ1), dark("window", 78), lite("wall", 40));
      }
    }

    if (b.roof === "flat") {
      g += prism(u0 - 0.12, v0 - 0.12, u1 + 0.12, v1 + 0.12, h, h + 0.2, b.roofColor);
      g += quad(u0 + 0.15, v0 + 0.15, u1 - 0.15, v1 - 0.15, h + 0.2, dark(b.roofColor, 90));
      // A rooftop unit.
      const cu0 = u0 + (u1 - u0) * 0.55;
      const cv0 = v0 + (v1 - v0) * 0.3;
      g += prism(cu0, cv0, cu0 + 0.6, cv0 + 0.5, h + 0.2, h + 0.5, "concrete");
    } else {
      // Shade under the eaves on the visible walls.
      g += overlay(vFace(u0, u1, v1, h - 0.35, h), "url(#lfm-eave)") + overlay(uFace(u1, v0, v1, h - 0.35, h), "url(#lfm-eave)");
      g += b.roof === "hip" ? hipRoof(u0, v0, u1, v1, h, rise + 0.3, b.roofColor) : gableRoof(u0, v0, u1, v1, h, rise, b.roofColor);
    }
    return g;
  }

  function drawTent(u0, v0, u1, v1, c) {
    const vm = (v0 + v1) / 2;
    const h = 1.1;
    const front = [P(u0, v1, 0), P(u1, v1, 0), P(u1, vm, h), P(u0, vm, h)];
    let g = face([P(u0, v0, 0), P(u1, v0, 0), P(u1, vm, h), P(u0, vm, h)], dark(c, 72));
    g += face([P(u1, v0, 0), P(u1, v1, 0), P(u1, vm, h)], dark(c, 60));
    g += face(front, col(c)) + overlay(front, "url(#lfm-sheen)");
    g += face([P(u1, v1 - 0.32, 0), P(u1, v0 + 0.32, 0), P(u1, vm, h * 0.7)], dark(c, 35));
    g += line(P(u0, vm, h), P(u1, vm, h), `stroke:${lite(c, 60)};stroke-width:.9`);
    return g;
  }

  function drawTree(t) {
    const [x, y] = P(t.u, t.v, 0);
    const s = t.s;
    if (t.kind === "shrub") {
      shadows.push(`<ellipse data-layer="trees" cx="${r1(x + 3.4 * s)}" cy="${r1(y - 0.5)}" rx="${r1(4.6 * s)}" ry="${r1(2 * s * tilt)}"/>`);
      const cy = y - 2.6 * s * height;
      const base = t.hue > 0.5 ? "tree-2" : "tree";
      return (
        `<ellipse cx="${r1(x)}" cy="${r1(cy)}" rx="${r1(4.4 * s)}" ry="${r1(3.2 * s)}" style="fill:${dark(base, 80)}"/>` +
        `<ellipse cx="${r1(x - 0.8 * s)}" cy="${r1(cy - 0.9 * s)}" rx="${r1(3.2 * s)}" ry="${r1(2.3 * s)}" style="fill:${col(base)}"/>` +
        `<ellipse cx="${r1(x)}" cy="${r1(cy)}" rx="${r1(4.4 * s)}" ry="${r1(3.2 * s)}" style="fill:url(#lfm-canopy)"/>`
      );
    }
    if (t.kind === "palm") {
      const th = 3.6 * s;
      shadows.push(`<ellipse data-layer="trees" cx="${r1(x + th * 9 * SUN_U * height)}" cy="${r1(y - 1)}" rx="${r1(7 * s)}" ry="${r1(2.6 * s * tilt)}"/>`);
      const [, ty] = P(t.u, t.v, th);
      const tx = x + 2.4 * s;
      let g = `<path d="M${r1(x)} ${r1(y)}Q${r1(x + 0.5)} ${r1((y + ty) / 2)} ${r1(tx)} ${r1(ty)}" style="fill:none;stroke:${col("palm-trunk")};stroke-width:${r1(1.8 * s)};stroke-linecap:round"/>`;
      g += `<path d="M${r1(x)} ${r1(y)}Q${r1(x + 0.5)} ${r1((y + ty) / 2)} ${r1(tx)} ${r1(ty)}" style="fill:none;stroke:${dark("palm-trunk", 70)};stroke-width:${r1(1.8 * s)};stroke-dasharray:.6 1.8"/>`;
      // Under-fronds dark, top fronds light, with coconuts in the crown.
      for (const [layer, colour, lift] of [[0, dark("palm", 72), 0.6], [1, col("palm"), 0]]) {
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + t.hue * 3 + layer * 0.45;
          const len = (layer ? 7 : 8) * s;
          const ex = tx + Math.cos(a) * len;
          const ey = ty + Math.sin(a) * len * 0.5 + (2.8 - lift) * s;
          const cx = tx + Math.cos(a) * len * 0.55;
          const cy = ty + Math.sin(a) * len * 0.28 - 2.6 * s;
          g += `<path d="M${r1(tx)} ${r1(ty)}Q${r1(cx)} ${r1(cy)} ${r1(ex)} ${r1(ey)}" style="fill:none;stroke:${colour};stroke-width:${r1((layer ? 2 : 2.4) * s)};stroke-linecap:round"/>`;
        }
      }
      g += `<circle cx="${r1(tx - 0.8)}" cy="${r1(ty + 1.2)}" r="${r1(1 * s)}" style="fill:${col("coconut")}"/><circle cx="${r1(tx + 0.9)}" cy="${r1(ty + 1.4)}" r="${r1(0.9 * s)}" style="fill:${col("coconut")}"/>`;
      return g;
    }
    const trunkH = 1.9 * s;
    shadows.push(`<ellipse data-layer="trees" cx="${r1(x + trunkH * 7 * SUN_U * height)}" cy="${r1(y - 1)}" rx="${r1(6.4 * s)}" ry="${r1(3 * s * tilt)}"/>`);
    const [, cy] = P(t.u, t.v, trunkH);
    const r = 5.6 * s;
    const base = t.hue > 0.66 ? "tree-2" : t.hue < 0.18 ? "tree-3" : "tree";
    let g = `<line x1="${r1(x)}" y1="${r1(y)}" x2="${r1(x)}" y2="${r1(cy)}" style="stroke:${col("trunk")};stroke-width:${r1(1.8 * s)};stroke-linecap:round"/>`;
    g += `<circle cx="${r1(x + r * 0.3)}" cy="${r1(cy + r * 0.05)}" r="${r1(r * 0.8)}" style="fill:${dark(base, 78)}"/>`;
    g += `<circle cx="${r1(x - r * 0.35)}" cy="${r1(cy + r * 0.1)}" r="${r1(r * 0.75)}" style="fill:${dark(base, 90)}"/>`;
    g += `<circle cx="${r1(x - r * 0.05)}" cy="${r1(cy - r * 0.35)}" r="${r1(r * 0.78)}" style="fill:${col(base)}"/>`;
    g += `<circle cx="${r1(x)}" cy="${r1(cy - r * 0.1)}" r="${r1(r * 1.05)}" style="fill:url(#lfm-canopy)"/>`;
    return g;
  }
}
