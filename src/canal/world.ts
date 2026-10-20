import type {
  Bridge,
  ModuleDefinition,
  Preset,
  Size,
  SolverProblem,
  TownDocument,
  TownGrid,
  WorldIntent,
} from "./types";
import { KIT_VERSION, LAYERS } from "./types";
import { random } from "./random";
import { createTownGrid } from "./grid";
import { createCatalog } from "./catalog";
import { PALETTE } from "./appearance";

export function findBridge(
  grid: TownGrid,
  intent: WorldIntent,
  a: number,
  b: number,
): Bridge | null {
  if (
    !grid.cells[a] ||
    !grid.cells[b] ||
    a === b ||
    intent.ground[a] !== "quay" ||
    intent.ground[b] !== "quay" ||
    intent.heights[a] > 0 ||
    intent.heights[b] > 0
  )
    return null;
  for (let face = 0; face < 4; face++) {
    let previous = a,
      next = grid.cells[a].neighbors[face];
    const cells: number[] = [],
      faces: number[] = [];
    while (next >= 0 && intent.ground[next] === "water" && cells.length < 3) {
      const entry = grid.cells[next].neighbors.indexOf(previous),
        exit = (entry + 2) % 4;
      cells.push(next);
      faces.push(exit);
      previous = next;
      next = grid.cells[next].neighbors[exit];
    }
    if (
      next === b &&
      cells.length &&
      !cells.some((c) =>
        intent.bridges.some((bridge) => bridge.cells.includes(c)),
      )
    )
      return { id: `${a}-${b}`, cells, anchors: [a, b], faces };
  }
  return null;
}
export interface PlanIssue {
  code: "circulation" | "population" | "bridge";
  message: string;
  cell?: number;
}
export class PlanFailure extends Error {
  readonly code = "PLAN_EXHAUSTED";
  readonly issues: PlanIssue[];
  readonly attempts: number;
  constructor(issues: PlanIssue[], attempts: number) {
    super(
      `Town planning exhausted ${attempts} attempts: ${issues.map((i) => i.message).join(" ")}`,
    );
    this.issues = issues;
    this.attempts = attempts;
  }
}
/** Paths use real crossing endpoints, never the sides of an adjacent bridge. */
function circulation(grid: TownGrid, intent: WorldIntent): Set<number>[] {
  const edges = new Map<number, number[]>();
  for (const c of grid.cells)
    if (intent.ground[c.id] === "quay" && !intent.heights[c.id])
      edges.set(
        c.id,
        c.neighbors.filter(
          (n) => n >= 0 && intent.ground[n] === "quay" && !intent.heights[n],
        ),
      );
  for (const b of intent.bridges) {
    const path = [b.anchors[0], ...b.cells, b.anchors[1]];
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i],
        c = path[i + 1];
      edges.set(a, [...(edges.get(a) ?? []), c]);
      edges.set(c, [...(edges.get(c) ?? []), a]);
    }
  }
  const seen = new Set<number>(),
    components: Set<number>[] = [];
  for (const id of edges.keys())
    if (!seen.has(id)) {
      const component = new Set([id]),
        queue = [id];
      seen.add(id);
      for (const p of queue)
        for (const n of edges.get(p) ?? [])
          if (!seen.has(n)) {
            seen.add(n);
            component.add(n);
            queue.push(n);
          }
      components.push(component);
    }
  return components.sort((a, b) => b.size - a.size);
}
export function validatePlan(grid: TownGrid, intent: WorldIntent): PlanIssue[] {
  const issues: PlanIssue[] = [],
    lanes = circulation(grid, intent);
  if (lanes.length !== 1)
    issues.push({
      code: "circulation",
      message: "Quays and lanes must form one connected walking network.",
    });
  const seen = new Set<number>();
  let plots = 0;
  for (const c of grid.cells)
    if (intent.heights[c.id] > 0 && !seen.has(c.id)) {
      plots++;
      const queue = [c.id];
      seen.add(c.id);
      let access = false;
      for (const id of queue)
        for (const n of grid.cells[id].neighbors)
          if (n >= 0) {
            if (intent.heights[n] > 0 && !seen.has(n)) {
              seen.add(n);
              queue.push(n);
            }
            if (intent.ground[n] === "quay" && !intent.heights[n])
              access = true;
          }
      if (!access)
        issues.push({
          code: "circulation",
          cell: c.id,
          message: "A building plot has no lane access.",
        });
    }
  if (plots < (intent.size === "medium" ? 12 : 1))
    issues.push({
      code: "population",
      message: "The town needs more distinct building footprints.",
    });
  if (intent.bridges.length < 2)
    issues.push({
      code: "bridge",
      message: "The town needs at least two crossings.",
    });
  for (const b of intent.bridges)
    if (
      !findBridge(
        grid,
        { ...intent, bridges: intent.bridges.filter((other) => other !== b) },
        ...b.anchors,
      )
    )
      issues.push({
        code: "bridge",
        cell: b.cells[0],
        message: "A crossing has no clear, supported route.",
      });
  return issues;
}
export function planTown(
  grid: TownGrid,
  seed: string,
  size: Size,
  preset: Preset,
): WorldIntent {
  let issues: PlanIssue[] = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    const intent = planTownAttempt(grid, seed, size, preset, attempt);
    issues = validatePlan(grid, intent);
    if (!issues.length) return intent;
  }
  throw new PlanFailure(issues, 8);
}
function planTownAttempt(
  grid: TownGrid,
  seed: string,
  size: Size,
  preset: Preset,
  attempt: number,
): WorldIntent {
  const rng = random(
      `${seed}:planning:${preset}${attempt ? `:retry-${attempt}` : ""}`,
    ),
    phase = rng() * 3;
  const river = (z: number) =>
    Math.sin(z / 4 + phase) * (preset === "market" ? 2.2 : 1.2);
  const intent: WorldIntent = {
    seed,
    size,
    preset,
    ground: grid.cells.map((c) =>
      Math.hypot(c.center.x * 0.9, c.center.z) > grid.radius * 0.79 ||
      Math.abs(c.center.x - river(c.center.z)) < 0.95 ||
      (preset === "bridges" &&
        Math.abs(c.center.z - 3) < 0.75 &&
        c.center.x > 0)
        ? "water"
        : "quay",
    ),
    heights: grid.cells.map(() => 0),
    bridges: [],
  };
  const potential: Bridge[] = [];
  for (const c of grid.cells)
    if (intent.ground[c.id] === "quay")
      for (let face = 0; face < 4; face++) {
        let p = c.id,
          id = c.neighbors[face],
          length = 0;
        while (id >= 0 && intent.ground[id] === "water" && length++ < 3) {
          const entry = grid.cells[id].neighbors.indexOf(p);
          p = id;
          id = grid.cells[id].neighbors[(entry + 2) % 4];
        }
        if (id >= 0 && intent.ground[id] === "quay") {
          const bridge = findBridge(grid, intent, c.id, id);
          if (bridge && c.id < id) potential.push(bridge);
        }
      }
  potential.sort(
    (a, b) =>
      Math.abs(grid.cells[a.cells[0]].center.z) -
      Math.abs(grid.cells[b.cells[0]].center.z),
  );
  for (const b of potential)
    if (
      !intent.bridges.some(
        (other) =>
          b.cells.some((id) => other.cells.includes(id)) ||
          Math.hypot(
            grid.cells[b.cells[0]].center.x -
              grid.cells[other.cells[0]].center.x,
            grid.cells[b.cells[0]].center.z -
              grid.cells[other.cells[0]].center.z,
          ) < 3.7,
      )
    ) {
      intent.bridges.push(b);
      if (intent.bridges.length >= (preset === "bridges" ? 4 : 3)) break;
    }
  // Extremely narrow/small maps still receive two crossings, with explicit quay landings.
  if (intent.bridges.length < 2)
    for (const c of grid.cells) {
      if (
        intent.ground[c.id] !== "water" ||
        Math.hypot(c.center.x, c.center.z) > grid.radius * 0.65 ||
        intent.bridges.some((b) => b.cells.includes(c.id))
      )
        continue;
      const a = c.neighbors[0],
        b = c.neighbors[2];
      if (a < 0 || b < 0) continue;
      intent.ground[a] = intent.ground[b] = "quay";
      intent.bridges.push({
        id: `${a}-${b}`,
        cells: [c.id],
        anchors: [a, b],
        faces: [2],
      });
      if (intent.bridges.length >= 2) break;
    }
  // Prune isolated slivers before placing plots. A canal crossing connects its
  // two banks; disconnected shore fragments should remain water.
  const main = circulation(grid, intent)[0] ?? new Set<number>();
  intent.ground = intent.ground.map((g, id) =>
    g === "quay" && !main.has(id) ? "water" : g,
  );
  intent.bridges = intent.bridges.filter((b) =>
    b.anchors.every((id) => main.has(id)),
  );
  const landings = new Set(intent.bridges.flatMap((b) => b.anchors));
  const candidates = grid.cells
    .filter(
      (c) =>
        intent.ground[c.id] === "quay" &&
        !landings.has(c.id) &&
        c.neighbors.every((n) => n >= 0 && intent.ground[n] === "quay"),
    )
    .map((c) => ({ id: c.id, order: rng() }))
    .sort((a, b) => a.order - b.order);
  const target = Math.round(
    grid.cells.length * (preset === "market" ? 0.225 : 0.18),
  );
  let occupied = 0;
  for (const { id } of candidates) {
    if (occupied >= target) break;
    if (
      intent.heights[id] ||
      grid.cells[id].neighbors.some((n) => n >= 0 && intent.heights[n] > 0)
    )
      continue;
    const heightRoll = rng();
    const height = heightRoll < 0.28 ? 1 : heightRoll < 0.86 ? 2 : 3;
    intent.heights[id] = height;
    if (circulation(grid, intent).length !== 1) {
      intent.heights[id] = 0;
      continue;
    }
    occupied++;
    for (const n of grid.cells[id].neighbors)
      if (
        n >= 0 &&
        candidates.some((c) => c.id === n) &&
        !intent.heights[n] &&
        rng() < 0.55
      ) {
        intent.heights[n] = height;
        if (circulation(grid, intent).length !== 1) intent.heights[n] = 0;
        else occupied++;
      }
  }
  if (occupied < 12)
    for (const { id } of candidates)
      if (
        !intent.heights[id] &&
        grid.cells[id].neighbors.every((n) => n < 0 || !intent.heights[n])
      ) {
        intent.heights[id] = 1;
        if (circulation(grid, intent).length !== 1) intent.heights[id] = 0;
        else if (++occupied >= 12) break;
      }
  // One focal tower gives the low, clustered waterfront a readable silhouette.
  const landmark = grid.cells
    .filter((c) => intent.heights[c.id] > 0)
    .sort(
      (a, b) =>
        Math.hypot(a.center.x, a.center.z + 1.8) -
        Math.hypot(b.center.x, b.center.z + 1.8),
    )[0];
  if (landmark && size !== "small") intent.heights[landmark.id] = 4;
  return intent;
}
export function buildProblem(
  grid: TownGrid,
  intent: WorldIntent,
  modules: ModuleDefinition[],
  preferred?: number[],
): SolverProblem {
  const count = grid.cells.length,
    bridgeCells = new Set(intent.bridges.flatMap((b) => b.cells));
  const domains: number[][] = [],
    links: SolverProblem["links"] = [];
  const constraintReasons: string[] = [];
  for (let layer = 0; layer < LAYERS; layer++)
    for (const cell of grid.cells) {
      const height = intent.heights[cell.id],
        ground = intent.ground[cell.id];
      const category =
        layer === 0
          ? "ground"
          : bridgeCells.has(cell.id) && layer === 1
            ? "bridge"
            : layer <= height
              ? "room"
              : layer === height + 1 && height > 0
                ? "roof"
                : "air";
      constraintReasons.push(
        category === "ground"
          ? `Planner: ${ground} at cell ${cell.id}; ${height ? "support the occupied volume" : "leave the quay or water surface open"}.`
          : category === "room"
            ? `Occupied volume: floor ${layer} at cell ${cell.id}. Close exposed walls; keep shared room faces open.`
            : category === "roof"
              ? `Supported roof above ${height} floors. Ridge ports may only meet roofs at the same height.`
              : category === "bridge"
                ? "Planner crossing: align the deck with this supported, clear bridge path."
                : "Unoccupied volume: this slot must remain air.",
      );
      domains.push(
        modules.flatMap((m, id) => {
          if (m.category !== category) return [];
          if (category === "bridge") {
            const bridge = intent.bridges.find((b) =>
              b.cells.includes(cell.id),
            )!;
            const index = bridge.cells.indexOf(cell.id),
              connected = [bridge.cells[index - 1], bridge.cells[index + 1]];
            const mask = cell.neighbors.reduce(
              (bits, n, face) =>
                connected.includes(n) ? bits | (1 << face) : bits,
              0,
            );
            if (m.mask !== mask) return [];
            if (
              mask === 0 &&
              m.rotation !==
                (bridge.faces[bridge.cells.indexOf(cell.id)] + 2) % 4
            )
              return [];
          }
          if (category === "ground")
            return m.sockets[5] === (height > 0 ? "floor" : "air") ? [id] : [];
          if (category === "room") {
            if (m.sockets[5] !== (layer === height ? "roofbase" : "floor"))
              return [];
            for (let face = 0; face < 4; face++) {
              const n = cell.neighbors[face];
              const occupied = n >= 0 && intent.heights[n] >= layer;
              if (m.sockets[face] !== (occupied ? "room" : "air")) return [];
            }
          }
          if (category === "roof")
            for (let face = 0; face < 4; face++) {
              const n = cell.neighbors[face];
              const roofNeighbor = n >= 0 && intent.heights[n] === height;
              if (!roofNeighbor && m.sockets[face] !== "air") return [];
            }
          return [id];
        }),
      );
      const slotLinks: SolverProblem["links"][number] = [];
      cell.neighbors.forEach((n, face) => {
        if (n >= 0) {
          // At roof/room terraces, the wall closes the exposed interface. Their sockets are
          // constrained independently; no roof port may run into a different-height neighbor.
          const neighborCategory =
            layer === 0
              ? "ground"
              : bridgeCells.has(n) && layer === 1
                ? "bridge"
                : layer <= intent.heights[n]
                  ? "room"
                  : layer === intent.heights[n] + 1 && intent.heights[n] > 0
                    ? "roof"
                    : "air";
          if (
            (category === "roof" && neighborCategory === "room") ||
            (category === "room" && neighborCategory === "roof")
          )
            return;
          slotLinks.push({
            to: layer * count + n,
            face,
            otherFace: cell.neighborFaces[face],
          });
        }
      });
      if (
        layer > 0 &&
        !(category === "bridge" || (layer === 1 && ground === "water"))
      )
        slotLinks.push({
          to: (layer - 1) * count + cell.id,
          face: 4,
          otherFace: 5,
        });
      if (
        layer + 1 < LAYERS &&
        !(layer === 0 && (ground === "water" || bridgeCells.has(cell.id)))
      )
        slotLinks.push({
          to: (layer + 1) * count + cell.id,
          face: 5,
          otherFace: 4,
        });
      links.push(slotLinks);
    }
  return {
    modules,
    domains,
    links,
    seed: `${intent.seed}:architecture`,
    preferred,
    constraintReasons,
  };
}
export function applyEdit(
  intent: WorldIntent,
  cell: number,
  kind: "build" | "remove",
): WorldIntent {
  if (cell < 0 || cell >= intent.heights.length)
    throw new Error("Choose a cell inside the town.");
  const crossing = intent.bridges.find(
    (b) => b.cells.includes(cell) || b.anchors.includes(cell),
  );
  if (crossing) {
    if (kind === "remove")
      return {
        ...intent,
        bridges: intent.bridges.filter((b) => b !== crossing),
      };
    throw new Error("Keep bridge crossings and landings clear.");
  }
  if (kind === "build" && intent.heights[cell] >= 4)
    throw new Error("This plot already has four floors.");
  if (kind === "remove" && intent.heights[cell] === 0) return intent;
  const ground = [...intent.ground],
    heights = [...intent.heights];
  if (kind === "build") {
    ground[cell] = "quay";
    heights[cell] = Math.min(4, heights[cell] + 1);
  } else heights[cell] = Math.max(0, heights[cell] - 1);
  return { ...intent, ground, heights };
}
export function readDocument(source: string): TownDocument {
  if (source.length > 3_000_000) throw new Error("Town file is too large.");
  const doc: TownDocument = JSON.parse(source);
  if (!doc || typeof doc !== "object")
    throw new Error("Choose a Canal Town JSON file.");
  if (doc.version !== 1 || doc.kitVersion !== KIT_VERSION)
    throw new Error("This town uses a different kit version.");
  const intent = doc.intent;
  if (
    !intent ||
    typeof intent.seed !== "string" ||
    intent.seed.length > 120 ||
    !["small", "medium", "large"].includes(intent.size) ||
    !["village", "market", "bridges"].includes(intent.preset)
  )
    throw new Error("Invalid town settings.");
  const grid = createTownGrid(intent.seed, intent.size),
    count = grid.cells.length;
  if (
    intent.paint !== undefined &&
    (!Array.isArray(intent.paint) ||
      intent.paint.length !== count ||
      intent.paint.some(
        (p) => !Number.isInteger(p) || p < -1 || p >= PALETTE.length,
      ))
  )
    throw new Error("Invalid building colours.");
  if (
    !Array.isArray(intent.ground) ||
    intent.ground.length !== count ||
    intent.ground.some((g) => !["water", "quay"].includes(g)) ||
    !Array.isArray(intent.heights) ||
    intent.heights.length !== count ||
    intent.heights.some((h) => !Number.isInteger(h) || h < 0 || h > 4) ||
    !Array.isArray(intent.bridges)
  )
    throw new Error("Invalid occupied volumes.");
  if (intent.heights.some((h, id) => h > 0 && intent.ground[id] !== "quay"))
    throw new Error("A building needs a foundation.");
  const crossingCells = new Set<number>();
  for (const bridge of intent.bridges) {
    if (
      !bridge ||
      !Array.isArray(bridge.anchors) ||
      bridge.anchors.length !== 2 ||
      !Array.isArray(bridge.cells) ||
      !Array.isArray(bridge.faces)
    )
      throw new Error("Invalid bridge.");
    const valid = findBridge(
      grid,
      { ...intent, bridges: [] },
      ...bridge.anchors,
    );
    if (
      !valid ||
      JSON.stringify(valid.cells) !== JSON.stringify(bridge.cells) ||
      JSON.stringify(valid.faces) !== JSON.stringify(bridge.faces) ||
      bridge.cells.some((id) => intent.heights[id] > 0) ||
      bridge.anchors.some((id) => intent.heights[id] > 0)
    )
      throw new Error(
        "A bridge requires a clear crossing and supported landings.",
      );
    if (bridge.cells.some((id) => crossingCells.has(id)))
      throw new Error("Bridge crossings cannot overlap.");
    bridge.cells.forEach((id) => crossingCells.add(id));
  }
  const problem = buildProblem(grid, intent, createCatalog());
  if (
    !Array.isArray(doc.assignments) ||
    doc.assignments.length !== count * LAYERS ||
    doc.assignments.some(
      (v, slot) => !Number.isInteger(v) || !problem.domains[slot].includes(v),
    )
  )
    throw new Error("Invalid architectural assignments.");
  doc.assignments.forEach((v, slot) =>
    problem.links[slot].forEach((link) => {
      if (
        problem.modules[v].sockets[link.face] !==
        problem.modules[doc.assignments[link.to]].sockets[link.otherFace]
      )
        throw new Error("Incompatible architectural connectors.");
    }),
  );
  if (!Number.isSafeInteger(doc.edit) || doc.edit < 0)
    throw new Error("Invalid edit history.");
  return doc;
}
