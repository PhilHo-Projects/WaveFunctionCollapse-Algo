import { expect, it } from "vitest";
import { createTownGrid } from "./grid";
import { planTown, buildProblem, validatePlan } from "./world";
import { createCatalog } from "./catalog";
import { solve } from "./solver";
import type { Preset } from "./types";

it("solves 100 medium seeds for each preset with populated plots and supported crossings", () => {
  const modules = createCatalog();
  for (const preset of ["village", "market", "bridges"] as Preset[])
    for (let i = 0; i < 100; i++) {
      const seed = `acceptance-${i}`,
        grid = createTownGrid(seed),
        intent = planTown(grid, seed, "medium", preset);
      expect(
        validatePlan(grid, intent),
        `${preset}/${seed}: circulation`,
      ).toEqual([]);
      const seen = new Set<number>();
      let plots = 0;
      for (const cell of grid.cells)
        if (intent.heights[cell.id] > 0 && !seen.has(cell.id)) {
          plots++;
          const queue = [cell.id];
          seen.add(cell.id);
          for (const id of queue)
            for (const n of grid.cells[id].neighbors)
              if (n >= 0 && intent.heights[n] > 0 && !seen.has(n)) {
                seen.add(n);
                queue.push(n);
              }
        }
      expect(
        plots,
        `${preset}/${seed}: distinct footprints`,
      ).toBeGreaterThanOrEqual(12);
      expect(intent.bridges.length).toBeGreaterThanOrEqual(2);
      expect(Math.max(...intent.heights)).toBe(4);
      expect(intent.heights.filter((h) => h >= 2).length).toBeGreaterThan(4);
      const result = solve(buildProblem(grid, intent, modules));
      expect(result.status, `${preset}/${seed}`).toBe("success");
    }
}, 60_000);
