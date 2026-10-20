/// <reference lib="webworker" />
import { createTownGrid } from "./grid";
import { buildProblem, planTown, PlanFailure } from "./world";
import { createCatalog } from "./catalog";
import { solveSteps } from "./solver";
import { ringCells } from "./geometry";
import type {
  ModuleDefinition,
  Preset,
  Size,
  SolverEvent,
  TownDocument,
  WorldIntent,
} from "./types";
import { KIT_VERSION } from "./types";

export interface TownRequest {
  revision: number;
  seed: string;
  size: Size;
  preset: Preset;
  intent?: WorldIntent;
  previous?: TownDocument;
  cell?: number;
  modules?: ModuleDefinition[];
  cancel?: boolean;
}
let activeRevision = 0;
self.onmessage = async ({ data }: MessageEvent<TownRequest>) => {
  const revision = data.revision;
  activeRevision = revision;
  if (data.cancel) return;
  try {
    const grid = createTownGrid(data.seed, data.size),
      intent = data.intent ?? planTown(grid, data.seed, data.size, data.preset),
      modules = data.modules ?? createCatalog();
    const count = grid.cells.length;
    for (const radius of data.previous && data.cell !== undefined
      ? [2, 4, Infinity]
      : [Infinity]) {
      const problem = buildProblem(
        grid,
        intent,
        modules,
        data.previous?.assignments,
      );
      if (Number.isFinite(radius) && data.cell !== undefined && data.previous) {
        const region = ringCells(grid, data.cell, radius);
        problem.domains = problem.domains.map((domain, slot) =>
          region.has(slot % count)
            ? domain
            : domain.includes(data.previous!.assignments[slot])
              ? [data.previous!.assignments[slot]]
              : domain,
        );
      }
      const iterator = solveSteps(problem, () => activeRevision !== revision);
      let next = iterator.next(),
        batch: SolverEvent[] = [];
      while (!next.done) {
        const until = performance.now() + 6;
        do {
          batch.push(next.value);
          next = iterator.next();
        } while (!next.done && performance.now() < until && batch.length < 300);
        if (activeRevision !== revision) return;
        self.postMessage({ type: "progress", revision, events: batch });
        batch = [];
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (activeRevision !== revision) return;
      if (next.value.status === "success") {
        const document: TownDocument = {
          version: 1,
          kitVersion: KIT_VERSION,
          intent,
          assignments: next.value.assignments,
          edit: (data.previous?.edit ?? -1) + 1,
        };
        self.postMessage({
          type: "complete",
          revision,
          cell: data.cell,
          state: { grid, document, result: next.value },
        });
        return;
      }
      if (!Number.isFinite(radius)) {
        const failure = [...next.value.events]
          .reverse()
          .find((e) => e.type === "contradiction");
        self.postMessage({
          type: "error",
          revision,
          code: next.value.status.toUpperCase(),
          cell: failure ? failure.slot % count : data.cell,
          message: `Architecture could not resolve (${next.value.status})${failure ? ` at cell ${failure.slot % count}` : ""}. The previous town is preserved.`,
        });
        return;
      }
    }
  } catch (error) {
    if (activeRevision === revision)
      self.postMessage({
        type: "error",
        revision,
        code: error instanceof PlanFailure ? error.code : "SOLVE_FAILED",
        issues: error instanceof PlanFailure ? error.issues : undefined,
        message:
          error instanceof Error ? error.message : "Could not build this town.",
      });
  }
};
