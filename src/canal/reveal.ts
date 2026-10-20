import type { TownGrid, WorldIntent } from "./types";
import { REVEAL_SECONDS } from "./motion";

export const BUILD_SPEEDS = [
  { value: 0, label: "Instant" },
  { value: 30, label: "Fast · 0.03 s" },
  { value: 100, label: "Steady · 0.10 s" },
  { value: 250, label: "Slow · 0.25 s" },
] as const;
const STEP_SECONDS = 0.1;
export interface RevealPlan {
  steps: number[];
  starts: number[];
  end: number;
}
export interface RevealProgress {
  active: boolean;
  shown: number;
  total: number;
}

/** Stable breadth-first growth across the actual quay/crossing graph. */
export function createRevealPlan(
  grid: TownGrid,
  intent: WorldIntent,
): RevealPlan {
  const visible = new Set(
    intent.ground.flatMap((ground, id) => (ground === "quay" ? [id] : [])),
  );
  intent.bridges.forEach((bridge) =>
    bridge.cells.forEach((id) => visible.add(id)),
  );
  const distance = (id: number) =>
    Math.hypot(grid.cells[id].center.x, grid.cells[id].center.z);
  const ordered = [...visible].sort(
    (a, b) => distance(a) - distance(b) || a - b,
  );
  const steps: number[] = [],
    seen = new Set<number>();
  for (const root of ordered) {
    if (seen.has(root)) continue;
    const queue = [root];
    seen.add(root);
    for (const id of queue) {
      steps.push(id);
      for (const n of [...grid.cells[id].neighbors]
        .filter((n) => visible.has(n))
        .sort((a, b) => distance(a) - distance(b) || a - b)) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
  }
  const starts = grid.cells.map(() => -1);
  steps.forEach((id, i) => {
    starts[id] = i * STEP_SECONDS;
  });
  // Boats follow their nearest bank; open water itself has no reveal step.
  grid.cells.forEach((cell) => {
    if (visible.has(cell.id)) return;
    const neighbors = cell.neighbors.filter((n) => visible.has(n));
    starts[cell.id] = neighbors.length
      ? Math.min(...neighbors.map((n) => starts[n]))
      : 0;
  });
  const end = Math.max(
    0,
    ...steps.map(
      (id) =>
        starts[id] +
        Math.max(3, intent.heights[id] + 1) * 0.08 +
        REVEAL_SECONDS,
    ),
  );
  return { steps, starts, end };
}

export function revealBirth(
  plan: RevealPlan | null,
  cell: number,
  layer = 0,
): number {
  return plan ? (plan.starts[cell] ?? 0) + layer * 0.08 : -100;
}

/** One virtual clock drives batched geometry; a speed change never rebuilds it. */
export class RevealPlayback {
  readonly clock = { value: 0 };
  private previous: number | null = null;
  readonly plan: RevealPlan | null;
  constructor(plan: RevealPlan | null) {
    this.plan = plan;
  }
  get progress(): RevealProgress {
    const total = this.plan?.steps.length ?? 0;
    return {
      active: !!this.plan && this.clock.value < this.plan.end,
      shown: this.plan
        ? Math.min(
            total,
            Math.max(0, Math.ceil(this.clock.value / STEP_SECONDS)),
          )
        : total,
      total,
    };
  }
  finish() {
    this.clock.value = Math.max(this.clock.value, this.plan?.end ?? 0);
  }
  advance(now: number, intervalMs: number) {
    const delta =
      this.previous === null
        ? 0
        : Math.min(0.1, Math.max(0, now - this.previous));
    this.previous = now;
    if (intervalMs === 0) this.finish();
    this.clock.value += delta * (this.progress.active ? 100 / intervalMs : 1);
  }
}
