import { expect, it } from "vitest";
import { OrganicGrid } from "../core/townscaper/OrganicGrid";
import { OrganicSolver } from "../core/townscaper/OrganicSolver";
it("reports a rejected organic collapse and an error completion outcome", () => {
  const grid = new OrganicGrid(100, 100, 2, 0, 8),
    solver = new OrganicSolver(grid);
  grid.cells[0].options = new Set([0, 2]);
  grid.cells[1].options = new Set([2]);
  expect(solver.userCollapse(grid.cells[0], 0, true)).toBe(false);
  let outcome = "";
  solver.autoGenerate(
    {
      vegetation: 50,
      civilization: 50,
      clustering: 50,
      inlandWater: 0,
      beachFormation: 70,
      pathGeneration: 70,
    },
    () => {},
    (value) => {
      outcome = value;
    },
  );
  expect(outcome).toBe("error");
});
