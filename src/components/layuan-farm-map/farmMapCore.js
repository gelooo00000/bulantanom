/**
 * Layuan Nature Integrated Farm as an isometric site map.
 *
 * Pure data and string building: no DOM, no React. `buildFarmMap(tilt, height)`
 * returns an SVG fragment that LayuanFarmMap.tsx drops into its <svg>.
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
  for (let i = 0; i < 4200 && trees.length < 330; i++) {
    const u = 1.6 + rand() * (LAND_U - 3.2);
    const v = 1.6 + rand() * (LAND_V - 3.2);
    if (OCCUPIED.some((r) => inRect(u, v, r, 0.55))) continue;
    if (trees.some((t) => Math.abs(t.u - u) < 0.95 && Math.abs(t.v - v) < 0.95)) continue;
    trees.push({ u, v, palm: rand() < 0.45, s: 0.75 + rand() * 0.5, hue: rand() });
  }
  return trees;
})();

const TUFTS = (() => {
  const rand = mulberry32(77);
  const out = [];
  for (let i = 0; i < 1200 && out.length < 240; i++) {
    const u = 1.4 + rand() * (LAND_U - 2.8);
    const v = 1.4 + rand() * (LAND_V - 2.8);
    if (OCCUPIED.some((r) => inRect(u, v, r, 0.2))) continue;
    out.push([u, v]);
  }
  return out;
})();

const FLOWER_DOTS = (() => {
  const rand = mulberry32(5);
  return ORNAMENTALS.map((o) => {
    const [u0, v0, u1, v1] = o.rect;
    return Array.from({ length: 26 }, () => [u0 + 0.25 + rand() * (u1 - u0 - 0.5), v0 + 0.25 + rand() * (v1 - v0 - 0.5), rand()]);
  });
})();

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

const r1 = (n) => Math.round(n * 10) / 10;
const col = (name) => `var(--lfm-${name})`;
const dark = (name, pct) => `color-mix(in srgb,var(--lfm-${name}) ${pct}%,#000)`;
const lite = (name, pct) => `color-mix(in srgb,var(--lfm-${name}) ${pct}%,#fff)`;

/**
 * Builds the map for a camera tilt (pitch) and a height scale for solids.
 * Returns { width, height, inner } where inner is the SVG markup.
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
  const quad = (u0, v0, u1, v1, z, fill, extra) => face([P(u0, v0, z), P(u1, v0, z), P(u1, v1, z), P(u0, v1, z)], fill, extra);
  const line = (a, b, style) => `<line x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}" style="${style}"/>`;

  /** Box with a lit top, a lighter +V face and a darker +U face. */
  const prism = (u0, v0, u1, v1, z0, z1, top, side = top) =>
    face([P(u0, v1, z0), P(u1, v1, z0), P(u1, v1, z1), P(u0, v1, z1)], dark(side, 86)) +
    face([P(u1, v0, z0), P(u1, v1, z0), P(u1, v1, z1), P(u1, v0, z1)], dark(side, 70)) +
    quad(u0, v0, u1, v1, z1, col(top));

  /** Rectangle drawn onto the +V face (v = const). */
  const onV = (v, ua, ub, za, zb, fill) => face([P(ua, v, za), P(ub, v, za), P(ub, v, zb), P(ua, v, zb)], fill);
  /** Rectangle drawn onto the +U face (u = const). */
  const onU = (u, va, vb, za, zb, fill) => face([P(u, va, za), P(u, vb, za), P(u, vb, zb), P(u, va, zb)], fill);

  const softShadow = (u0, v0, u1, v1, grow = 0.35) =>
    face(
      [P(u0 + 0.5 - grow, v0 + 0.15 - grow), P(u1 + 0.9 + grow, v0 + 0.15 - grow), P(u1 + 0.9 + grow, v1 + 0.35 + grow), P(u0 + 0.5 - grow, v1 + 0.35 + grow)],
      col("shadow"),
      ' filter="url(#lfm-soft)"',
    );

  const ground = [];
  const objects = []; // { d: depth, svg }

  // --- Land slab ----------------------------------------------------------
  const landShadow = face(
    SHORE.map(([u, v]) => P(u + 1.8, v + 1.8, -SLAB_DEPTH)),
    col("shadow"),
    ' filter="url(#lfm-soft-lg)"',
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
    if (nu + nv > 0) edges.push({ a, b, d: mu + mv });
  }
  edges.sort((x, y) => x.d - y.d);
  let slab = "";
  const bands = [
    [0, -0.35, "grass-lip"],
    [-0.35, -1.3, "soil"],
    [-1.3, -SLAB_DEPTH, "soil-2"],
  ];
  for (const { a, b } of edges) {
    for (const [zt, zb, c] of bands) {
      slab += face([P(a[0], a[1], zt), P(b[0], b[1], zt), P(b[0], b[1], zb), P(a[0], a[1], zb)], col(c));
    }
  }
  const landTop = `<polygon points="${pts(SHORE.map(([u, v]) => P(u, v, 0)))}" style="fill:url(#lfm-grass-grad)"/>`;
  ground.push(landShadow, slab, landTop);

  // Grass tufts.
  let tufts = "";
  for (const [u, v] of TUFTS) {
    const [x, y] = P(u, v, 0);
    tufts += `M${r1(x - 2)} ${r1(y)}l1 -2.6l1 2.6l1 -3.2l1 3.2`;
  }
  ground.push(`<path data-layer="trees" d="${tufts}" style="fill:none;stroke:${col("tuft")};stroke-width:.8;stroke-linecap:round"/>`);

  // --- Flat ground features ----------------------------------------------
  // Open field: dark soil with furrows.
  {
    const [u0, v0, u1, v1] = OPEN_FIELD;
    let g = prism(u0, v0, u1, v1, 0, 0.08, "field", "soil");
    for (let v = v0 + 0.6; v < v1 - 0.3; v += 0.7) g += line(P(u0 + 0.3, v, 0.08), P(u1 - 0.3, v, 0.08), `stroke:${col("field-furrow")};stroke-width:1.1`);
    ground.push(g);
  }

  // Farm-to-market road.
  {
    const [u0, v0, u1, v1] = ROAD;
    let g = quad(u0, v0, u1, v1, 0.03, col("road"));
    g += line(P(u0 + 0.5, (v0 + v1) / 2, 0.03), P(u1 - 0.5, (v0 + v1) / 2, 0.03), `stroke:${col("road-line")};stroke-width:1;stroke-dasharray:6 6`);
    ground.push(g);
  }

  // Irrigation canal with an animated flow.
  {
    const { u0, u1, v0, v1, water0, water1 } = CANAL;
    let g = quad(u0, v0, u1, v1, 0.02, col("bank"));
    g += onV(water0, u0, u1, -0.2, 0.02, dark("bank", 75));
    g += quad(u0, water0, u1, water1, -0.2, col("water"));
    const mid = (water0 + water1) / 2;
    g += line(P(u0 + 0.3, mid, -0.2), P(u1 - 0.3, mid, -0.2), `stroke:${col("water-hi")};stroke-width:1.4;stroke-linecap:round;stroke-dasharray:5 11`).replace("<line", '<line class="lfm-flow"');
    ground.push(`<g data-layer="water">${g}</g>`);
  }

  // Walkways.
  ground.push(WALKWAYS.map(([u0, v0, u1, v1]) => quad(u0, v0, u1, v1, 0.04, col("path"))).join(""));

  // Rice paddies: sunken, tan bund, golden rows and dots.
  {
    let g = "";
    for (const [u0, v0, u1, v1] of PADDIES) {
      g += prism(u0, v0, u1, v1, 0, 0.18, "bund");
      const i = 0.4;
      const [a0, b0, a1, b1] = [u0 + i, v0 + i, u1 - i, v1 - i];
      g += onV(b0, a0, a1, -0.15, 0.18, dark("bund", 80));
      g += onU(a0, b0, b1, -0.15, 0.18, dark("bund", 68));
      g += quad(a0, b0, a1, b1, -0.15, col("rice"));
      for (let v = b0 + 0.45; v < b1 - 0.2; v += 0.6) {
        g += line(P(a0 + 0.2, v, -0.15), P(a1 - 0.2, v, -0.15), `stroke:${col("rice-row")};stroke-width:.7`);
        g += line(P(a0 + 0.3, v, -0.15), P(a1 - 0.3, v, -0.15), `stroke:${col("rice-dot")};stroke-width:1.9;stroke-linecap:round;stroke-dasharray:0 4.2`);
      }
    }
    ground.push(`<g data-layer="rice">${g}</g>`);
  }

  // Vegetable plots and the garden plot beds: green with dotted rows.
  const vegPlot = (u0, v0, u1, v1, z = 0.2) => {
    let g = prism(u0, v0, u1, v1, 0, z, "veg", "veg-soil");
    for (let u = u0 + 0.35; u < u1 - 0.2; u += 0.55) {
      g += line(P(u, v0 + 0.25, z), P(u, v1 - 0.25, z), `stroke:${col("veg-row")};stroke-width:1.7;stroke-linecap:round;stroke-dasharray:0 3.6`);
    }
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
      g += prism(su0, sv0, su1, sv1, 0, z, "veg", "terrace-soil");
      for (let v = sv0 + 0.35; v < sv1 - 0.15; v += 0.45) {
        g += line(P(su0 + 0.3, v, z), P(su1 - 0.3, v, z), `stroke:${col("veg-row")};stroke-width:1.6;stroke-linecap:round;stroke-dasharray:0 3.4`);
      }
    }
    ground.push(`<g data-layer="veg">${g}</g>`);
  }

  // Ornamental beds.
  ORNAMENTALS.forEach((o, idx) => {
    const [u0, v0, u1, v1] = o.rect;
    let g = prism(u0, v0, u1, v1, 0, 0.18, "bed-soil");
    for (const [u, v, k] of FLOWER_DOTS[idx]) {
      const [x, y] = P(u, v, 0.18);
      g += `<circle cx="${r1(x)}" cy="${r1(y - 1)}" r="${k > 0.6 ? 1.9 : 1.4}" style="fill:${k > 0.3 ? col(o.color) : lite(o.color, 55)}"/>`;
    }
    ground.push(`<g data-layer="trees">${g}</g>`);
  });

  // Tree planting / cassava area: tilled plot (saplings come with the trees).
  {
    const [u0, v0, u1, v1] = SAPLINGS;
    ground.push(`<g data-layer="trees">${quad(u0, v0, u1, v1, 0.03, col("plot-soil"))}</g>`);
  }

  // Paddock floor and camp ground.
  ground.push(quad(...PADDOCK, 0.03, col("paddock")));
  ground.push(quad(...CAMP, 0.03, col("camp")));
  // Practical area pad.
  {
    const b = BUILDINGS.find((x) => x.id === "f11");
    ground.push(quad(b.u0 - 0.2, b.v0 - 0.2, b.u1 + 0.2, b.v1 + 0.2, 0.05, col("concrete")));
  }

  // Fishpond (future): translucent water in a dashed amber outline.
  {
    const [u0, v0, u1, v1] = FISHPOND;
    const corners = [P(u0, v0, 0.05), P(u1, v0, 0.05), P(u1, v1, 0.05), P(u0, v1, 0.05)];
    ground.push(
      `<g data-layer="water"><polygon points="${pts(corners)}" style="fill:${col("future")};fill-opacity:.18;stroke:${col("future")};stroke-width:1.6;stroke-dasharray:5 4"/>` +
        `<polygon points="${pts([P(u0 + 0.7, v0 + 0.7, 0.05), P(u1 - 0.7, v0 + 0.7, 0.05), P(u1 - 0.7, v1 - 0.7, 0.05), P(u0 + 0.7, v1 - 0.7, 0.05)])}" style="fill:${col("water")};fill-opacity:.35"/></g>`,
    );
  }

  // Entrance arrow and label.
  {
    const v = ENTRANCE_V;
    const arrow = [P(-4.6, v - 0.45, 0.05), P(-1.4, v - 0.45, 0.05), P(-1.4, v - 1.1, 0.05), P(0.4, v, 0.05), P(-1.4, v + 1.1, 0.05), P(-1.4, v + 0.45, 0.05), P(-4.6, v + 0.45, 0.05)];
    const [lx, ly] = P(-4.2, v + 2.4, 0);
    ground.push(
      `<polygon points="${pts(arrow)}" style="fill:${col("accent")};stroke:${col("panel")};stroke-width:1"/>` +
        `<text x="${r1(lx)}" y="${r1(ly)}" class="lfm-label" text-anchor="middle">Entrance</text>`,
    );
  }

  // --- Solids, drawn back to front ---------------------------------------
  const add = (d, svg) => objects.push({ d, svg });

  // Bridges over the canal.
  for (const u of BRIDGES) {
    const u0 = u - 0.6;
    const u1 = u + 0.6;
    let g = prism(u0, CANAL.v0 - 0.15, u1, CANAL.v1 + 0.15, 0.05, 0.3, "wood");
    for (let v = CANAL.v0; v < CANAL.v1 + 0.1; v += 0.3) g += line(P(u0, v, 0.3), P(u1, v, 0.3), `stroke:${dark("wood", 70)};stroke-width:.6`);
    g += prism(u0, CANAL.v0 - 0.15, u0 + 0.12, CANAL.v1 + 0.15, 0.3, 0.75, "wood");
    g += prism(u1 - 0.12, CANAL.v0 - 0.15, u1, CANAL.v1 + 0.15, 0.3, 0.75, "wood");
    add(u + (CANAL.v0 + CANAL.v1) / 2, `<g data-layer="water">${g}</g>`);
  }

  // Vermibit: low concrete bins of dark compost.
  {
    const [u0, v0, u1, v1] = VERMI;
    let g = "";
    const n = 3;
    const w = (v1 - v0 - 0.4 * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const b0 = v0 + i * (w + 0.4);
      g += softShadow(u0, b0, u1, b0 + w, 0.1);
      g += prism(u0, b0, u1, b0 + w, 0, 0.55, "concrete");
      g += quad(u0 + 0.2, b0 + 0.2, u1 - 0.2, b0 + w - 0.2, 0.55, col("compost"));
    }
    add((u0 + u1 + v0 + v1) / 2, `<g data-layer="buildings">${g}</g>`);
  }

  // Water tanks.
  for (const t of TANKS) {
    const s = 0.55;
    let g = softShadow(t.u - s, t.v - s, t.u + s, t.v + s, 0.05);
    g += prism(t.u - s, t.v - s, t.u + s, t.v + s, 0, 0.35, "concrete");
    g += prism(t.u - s + 0.08, t.v - s + 0.08, t.u + s - 0.08, t.v + s - 0.08, 0.35, 1.45, "tank");
    g += line(P(t.u - s + 0.08, t.v + s - 0.08, 0.9), P(t.u + s - 0.08, t.v + s - 0.08, 0.9), `stroke:${lite("tank", 50)};stroke-width:.8`);
    add(t.u + t.v, `<g data-layer="water">${g}</g>`);
  }

  // Buildings.
  for (const b of BUILDINGS) {
    add((b.u0 + b.u1 + b.v0 + b.v1) / 2, `<g data-layer="buildings">${drawBuilding(b)}</g>`);
  }

  // Ranging paddock fence (back sides first, front sides in front).
  {
    const [u0, v0, u1, v1] = PADDOCK;
    const fence = (a, b) => {
      let g = "";
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.round(len / 1));
      for (let i = 0; i <= n; i++) {
        const u = a[0] + ((b[0] - a[0]) * i) / n;
        const v = a[1] + ((b[1] - a[1]) * i) / n;
        g += line(P(u, v, 0), P(u, v, 0.85), `stroke:${col("fence")};stroke-width:1.3`);
      }
      for (const z of [0.35, 0.75]) g += line(P(a[0], a[1], z), P(b[0], b[1], z), `stroke:${col("fence")};stroke-width:.8`);
      return g;
    };
    add(u0 + v0, fence([u0, v1], [u0, v0]) + fence([u0, v0], [u1, v0]));
    // Chickens ranging inside.
    const rand = mulberry32(18);
    let hens = "";
    for (let i = 0; i < 14; i++) {
      const [x, y] = P(u0 + 0.8 + rand() * (u1 - u0 - 1.6), v0 + 0.8 + rand() * (v1 - v0 - 1.6), 0.05);
      hens += `<ellipse cx="${r1(x)}" cy="${r1(y - 1.4)}" rx="2" ry="1.5" style="fill:${rand() > 0.4 ? col("hen") : col("hen-2")}"/>`;
    }
    add(u0 + v0 + 0.5, hens);
    add(u1 + v1, fence([u0, v1], [u1, v1]) + fence([u1, v0], [u1, v1]));
  }

  // Camping tents.
  {
    const [u0, v0] = CAMP;
    const spots = [[1, 1], [3.6, 1.4], [1.4, 4], [4.4, 4.2], [2.6, 6]];
    spots.forEach(([du, dv], i) => {
      const t0 = u0 + du;
      const s0 = v0 + dv;
      add(t0 + s0 + 1.6, `<g data-layer="buildings">${drawTent(t0, s0, t0 + 1.7, s0 + 1.3, `tent-${(i % 3) + 1}`)}</g>`);
    });
    // Campfire.
    const [fx, fy] = P(u0 + 4.6, v0 + 2.9, 0.05);
    add(u0 + v0 + 7.5, `<circle cx="${r1(fx)}" cy="${r1(fy)}" r="2.6" style="fill:${col("orange")}"/><circle cx="${r1(fx)}" cy="${r1(fy - 1)}" r="1.3" style="fill:#ffd36b"/>`);
  }

  // Saplings in a grid (tree planting / cassava).
  {
    const [u0, v0, u1, v1] = SAPLINGS;
    for (let u = u0 + 0.6; u < u1 - 0.3; u += 1.1) {
      for (let v = v0 + 0.6; v < v1 - 0.3; v += 1.1) {
        const [x, y] = P(u, v, 0.03);
        const [, ty] = P(u, v, 0.75);
        add(u + v, `<g data-layer="trees"><line x1="${r1(x)}" y1="${r1(y)}" x2="${r1(x)}" y2="${r1(ty)}" style="stroke:${col("trunk")};stroke-width:1"/><circle cx="${r1(x)}" cy="${r1(ty)}" r="2.6" style="fill:${col("sapling")}"/></g>`);
      }
    }
  }

  // Trees.
  for (const t of TREES) add(t.u + t.v, `<g data-layer="trees">${drawTree(t)}</g>`);

  objects.sort((a, b) => a.d - b.d);

  // --- Pins -----------------------------------------------------------------
  const pinSvg = [...PINS]
    .sort((a, b) => a.u + a.v - (b.u + b.v))
    .map((p) => {
      const [ax, ay] = P(p.u, p.v, p.z);
      const hx = ax;
      const hy = ay - 30;
      const info = INFO[p.id];
      const label = p.n ? `${p.n}. ${info.title}${info.future ? " (future development)" : ""}` : info.title;
      let head = "";
      if (p.kind === "facility") {
        head =
          `<circle class="lfm-pin-disc" r="10" style="fill:${info.future ? col("future") : col("pin-facility")}"/>` +
          `<text class="lfm-pin-num" y="3.6" text-anchor="middle">${p.n}</text>`;
      } else if (p.kind === "water") {
        head =
          `<circle class="lfm-pin-disc" r="10" style="fill:${col("pin-water")}"/>` +
          `<path d="M0 -6C3 -2 4.6 0.6 4.6 2.4A4.6 4.6 0 0 1 -4.6 2.4C-4.6 0.6 -3 -2 0 -6Z" style="fill:#fff"/>`;
      } else if (p.kind === "flower") {
        head = `<circle class="lfm-pin-disc" r="10" style="fill:${col("pin-flower")}"/>`;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          head += `<circle cx="${r1(Math.cos(a) * 3.6)}" cy="${r1(Math.sin(a) * 3.6)}" r="2.4" style="fill:#fff"/>`;
        }
        head += `<circle r="1.8" style="fill:${col("pin-flower")}"/>`;
      } else {
        head =
          `<circle class="lfm-pin-disc" r="10" style="fill:${col("pin-recycle")}"/>` +
          `<path d="M-4.4 1.6A4.8 4.8 0 0 1 2.2 -4.3M4.6 -1.2A4.8 4.8 0 0 1 -1.6 4.6" style="fill:none;stroke:#fff;stroke-width:1.6;stroke-linecap:round"/>` +
          `<path d="M1.2 -6.4L3.6 -4.1L0.7 -2.6ZM-0.6 6.6L-3 4.3L0 2.8Z" style="fill:#fff"/>`;
      }
      return (
        `<g class="lfm-pin lfm-pin--${p.kind}" data-pin="${p.id}"${p.layer ? ` data-layer="${p.layer}"` : ""} tabindex="0" role="button" aria-label="${label}">` +
        `<line class="lfm-pin-leader" x1="${r1(hx)}" y1="${r1(hy + 10)}" x2="${r1(ax)}" y2="${r1(ay)}"/>` +
        `<circle class="lfm-pin-foot" cx="${r1(ax)}" cy="${r1(ay)}" r="1.8"/>` +
        `<g transform="translate(${r1(hx)} ${r1(hy)})"><circle class="lfm-pin-hit" r="14"/>${head}</g>` +
        `</g>`
      );
    })
    .join("");

  // --- Assemble ---------------------------------------------------------------
  const pad = 24;
  const top = minY - 44; // room for the pin heads above the tallest roofs
  const width = Math.ceil(maxX - minX + pad * 2);
  const heightPx = Math.ceil(maxY - top + pad * 2);
  const tx = r1(pad - minX);
  const ty = r1(pad - top);

  const defs =
    `<defs>` +
    `<filter id="lfm-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2"/></filter>` +
    `<filter id="lfm-soft-lg" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="9"/></filter>` +
    `<linearGradient id="lfm-grass-grad" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" style="stop-color:var(--lfm-grass-2)"/><stop offset="1" style="stop-color:var(--lfm-grass)"/>` +
    `</linearGradient>` +
    `</defs>`;

  const inner =
    defs +
    `<g transform="translate(${tx} ${ty})">` +
    ground.join("") +
    objects.map((o) => o.svg).join("") +
    `<g class="lfm-pins">${pinSvg}</g>` +
    `</g>`;

  return { width, height: heightPx, inner };

  // --- Helpers that need P -------------------------------------------------

  function gableRoof(u0, v0, u1, v1, h, rise, roofCol, extra = "") {
    const e = 0.25; // eaves
    const [a0, b0, a1, b1] = [u0 - e, v0 - e, u1 + e, v1 + e];
    if (u1 - u0 >= v1 - v0) {
      const vm = (v0 + v1) / 2;
      return (
        face([P(a0, b0, h), P(a1, b0, h), P(a1, vm, h + rise), P(a0, vm, h + rise)], dark(roofCol, 78), extra) +
        face([P(u1, v0, h), P(u1, v1, h), P(u1, vm, h + rise)], dark("wall", 72), extra) +
        face([P(a0, b1, h), P(a1, b1, h), P(a1, vm, h + rise), P(a0, vm, h + rise)], col(roofCol), extra) +
        line(P(a0, vm, h + rise), P(a1, vm, h + rise), `stroke:${lite(roofCol, 70)};stroke-width:.8`)
      );
    }
    const um = (u0 + u1) / 2;
    return (
      face([P(a0, b0, h), P(a0, b1, h), P(um, b1, h + rise), P(um, b0, h + rise)], lite(roofCol, 88), extra) +
      face([P(u0, v1, h), P(u1, v1, h), P(um, v1, h + rise)], dark("wall", 86), extra) +
      face([P(a1, b0, h), P(a1, b1, h), P(um, b1, h + rise), P(um, b0, h + rise)], dark(roofCol, 80), extra) +
      line(P(um, b0, h + rise), P(um, b1, h + rise), `stroke:${lite(roofCol, 70)};stroke-width:.8`)
    );
  }

  function hipRoof(u0, v0, u1, v1, h, rise, roofCol) {
    const e = 0.3;
    const [a0, b0, a1, b1] = [u0 - e, v0 - e, u1 + e, v1 + e];
    const apex = P((u0 + u1) / 2, (v0 + v1) / 2, h + rise);
    return (
      face([P(a0, b0, h), P(a1, b0, h), apex], dark(roofCol, 80)) +
      face([P(a0, b0, h), P(a0, b1, h), apex], dark(roofCol, 88)) +
      face([P(a0, b1, h), P(a1, b1, h), apex], col(roofCol)) +
      face([P(a1, b0, h), P(a1, b1, h), apex], dark(roofCol, 74))
    );
  }

  function drawBuilding(b) {
    const { u0, v0, u1, v1 } = b;
    const base = b.stilts || 0;
    const h = base + b.h;
    const rise = Math.min(1.4, Math.min(u1 - u0, v1 - v0) * 0.38);
    let g = softShadow(u0, v0, u1, v1);

    if (b.future) {
      // Planned, not built: a translucent dashed outline.
      const dash = ` style="fill:${col("future")};fill-opacity:.16;stroke:${col("future")};stroke-width:1.3;stroke-dasharray:4 3;stroke-linejoin:round"`;
      const poly = (list) => `<polygon points="${pts(list)}"${dash}/>`;
      g = poly([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)]);
      g += poly([P(u0, v1, 0), P(u1, v1, 0), P(u1, v1, h), P(u0, v1, h)]);
      g += poly([P(u1, v0, 0), P(u1, v1, 0), P(u1, v1, h), P(u1, v0, h)]);
      const vm = (v0 + v1) / 2;
      g += poly([P(u0, v1, h), P(u1, v1, h), P(u1, vm, h + rise), P(u0, vm, h + rise)]);
      g += poly([P(u1, v0, h), P(u1, v1, h), P(u1, vm, h + rise)]);
      return g;
    }

    if (b.roof === "open") {
      // Posts and a roof, no walls.
      for (const [pu, pv] of [[u0, v1], [u1, v1], [u1, v0], [(u0 + u1) / 2, v1]]) {
        g += line(P(pu, pv, 0), P(pu, pv, h), `stroke:${col("wood")};stroke-width:2`);
      }
      // A few benches under the roof.
      for (let u = u0 + 0.8; u < u1 - 0.5; u += 1.4) g += prism(u, v0 + 1, u + 0.9, v1 - 1, 0, 0.35, "wood");
      return g + gableRoof(u0, v0, u1, v1, h, rise, b.roofColor);
    }

    if (base) {
      for (const [pu, pv] of [[u0 + 0.15, v1 - 0.15], [u1 - 0.15, v1 - 0.15], [u1 - 0.15, v0 + 0.15]]) {
        g += line(P(pu, pv, 0), P(pu, pv, base), `stroke:${col("wood")};stroke-width:1.6`);
      }
      g += prism(u0 - 0.15, v0 - 0.15, u1 + 0.15, v1 + 0.15, base - 0.12, base, "wood");
    }

    if (b.glass) {
      // Greenhouse: beds inside, then translucent glass.
      g += quad(u0 + 0.3, v0 + 0.3, u1 - 0.3, v1 - 0.3, 0.05, col("veg"));
      const glass = (list) => `<polygon points="${pts(list)}" style="fill:${col("glass")};fill-opacity:.42;stroke:${col("glass-edge")};stroke-width:.8;stroke-linejoin:round"/>`;
      g += glass([P(u0, v1, 0), P(u1, v1, 0), P(u1, v1, h), P(u0, v1, h)]);
      g += glass([P(u1, v0, 0), P(u1, v1, 0), P(u1, v1, h), P(u1, v0, h)]);
      const vm = (v0 + v1) / 2;
      g += glass([P(u0, v1, h), P(u1, v1, h), P(u1, vm, h + rise), P(u0, vm, h + rise)]);
      g += glass([P(u1, v0, h), P(u1, v1, h), P(u1, vm, h + rise)]);
      for (let u = u0 + 1; u < u1; u += 1) g += line(P(u, v1, 0), P(u, v1, h), `stroke:${col("glass-edge")};stroke-width:.6`) + line(P(u, v1, h), P(u, vm, h + rise), `stroke:${col("glass-edge")};stroke-width:.6`);
      return g;
    }

    const wall = b.wall === "bamboo" ? "bamboo" : b.wall === "mesh" ? "mesh" : "wall";
    g += prism(u0, v0, u1, v1, base, h, wall);

    // Door on the +V face and windows on both faces.
    const um = (u0 + u1) / 2;
    const dh = Math.min(1.15, b.h * 0.6);
    g += onV(v1, um - 0.32, um + 0.32, base, base + dh, col("door"));
    const winZ0 = base + b.h * 0.45;
    const winZ1 = base + b.h * 0.75;
    for (let u = u0 + 0.5; u < u1 - 0.6; u += 1.3) {
      if (Math.abs(u + 0.25 - um) < 0.7) continue;
      g += onV(v1, u, u + 0.5, winZ0, winZ1, col("window"));
    }
    for (let v = v0 + 0.5; v < v1 - 0.6; v += 1.3) g += onU(u1, v, v + 0.5, winZ0, winZ1, dark("window", 80));

    if (b.roof === "flat") {
      g += prism(u0 - 0.1, v0 - 0.1, u1 + 0.1, v1 + 0.1, h, h + 0.18, b.roofColor);
      g += quad(u0 + 0.15, v0 + 0.15, u1 - 0.15, v1 - 0.15, h + 0.18, dark(b.roofColor, 90));
    } else if (b.roof === "hip") {
      g += hipRoof(u0, v0, u1, v1, h, rise + 0.3, b.roofColor);
    } else {
      g += gableRoof(u0, v0, u1, v1, h, rise, b.roofColor);
    }
    return g;
  }

  function drawTent(u0, v0, u1, v1, c) {
    const vm = (v0 + v1) / 2;
    const h = 1.1;
    let g = softShadow(u0, v0, u1, v1, 0.05);
    g += face([P(u0, v0, 0), P(u1, v0, 0), P(u1, vm, h), P(u0, vm, h)], dark(c, 75));
    g += face([P(u1, v0, 0), P(u1, v1, 0), P(u1, vm, h)], dark(c, 62));
    g += face([P(u0, v1, 0), P(u1, v1, 0), P(u1, vm, h), P(u0, vm, h)], col(c));
    g += face([P(u1, v1 - 0.3, 0), P(u1, v0 + 0.3, 0), P(u1, vm, h * 0.7)], dark(c, 40));
    return g;
  }

  function drawTree(t) {
    const [x, y] = P(t.u, t.v, 0);
    const s = t.s;
    let g = `<ellipse cx="${r1(x + 3 * s)}" cy="${r1(y + 0.5)}" rx="${r1(6 * s)}" ry="${r1(2.6 * s * tilt)}" style="fill:${col("shadow")}"/>`;
    if (t.palm) {
      const [, ty] = P(t.u, t.v, 3.4 * s);
      const tx = x + 2.2 * s;
      g += `<path d="M${r1(x)} ${r1(y)}Q${r1(x + 0.4)} ${r1((y + ty) / 2)} ${r1(tx)} ${r1(ty)}" style="fill:none;stroke:${col("palm-trunk")};stroke-width:${r1(1.6 * s)};stroke-linecap:round"/>`;
      const frondCol = t.hue > 0.5 ? col("palm") : dark("palm", 85);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + t.hue;
        const len = 7.5 * s;
        const ex = tx + Math.cos(a) * len;
        const ey = ty + Math.sin(a) * len * 0.55 + 2.4 * s;
        const cx = tx + Math.cos(a) * len * 0.55;
        const cy = ty + Math.sin(a) * len * 0.3 - 2.4 * s;
        g += `<path d="M${r1(tx)} ${r1(ty)}Q${r1(cx)} ${r1(cy)} ${r1(ex)} ${r1(ey)}" style="fill:none;stroke:${frondCol};stroke-width:${r1(2.1 * s)};stroke-linecap:round"/>`;
      }
      return g;
    }
    const [, cy] = P(t.u, t.v, 1.9 * s);
    const r = 5.4 * s;
    const base = t.hue > 0.66 ? "tree-2" : "tree";
    g += `<line x1="${r1(x)}" y1="${r1(y)}" x2="${r1(x)}" y2="${r1(cy)}" style="stroke:${col("trunk")};stroke-width:${r1(1.6 * s)}"/>`;
    g += `<circle cx="${r1(x)}" cy="${r1(cy)}" r="${r1(r)}" style="fill:${dark(base, 82)}"/>`;
    g += `<circle cx="${r1(x - r * 0.18)}" cy="${r1(cy - r * 0.2)}" r="${r1(r * 0.78)}" style="fill:${col(base)}"/>`;
    g += `<circle cx="${r1(x - r * 0.38)}" cy="${r1(cy - r * 0.42)}" r="${r1(r * 0.3)}" style="fill:${lite(base, 70)}"/>`;
    return g;
  }
}
