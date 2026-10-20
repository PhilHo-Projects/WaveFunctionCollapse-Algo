import { expect, it } from "vitest";
import { createTownGrid } from "./grid";
import { warpPoint, ringCells } from "./geometry";
it("deforms both sides of every shared interface to the same world position", () => {
  const grid = createTownGrid("join");
  const coords = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ];
  let compared = 0;
  for (const cell of grid.cells)
    cell.neighbors.forEach((neighbor, face) => {
      if (neighbor < 0) return;
      const f = cell.neighborFaces[face],
        a = coords[face],
        b = coords[(face + 1) % 4],
        c = coords[f],
        d = coords[(f + 1) % 4];
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const p = warpPoint(
          grid,
          cell.id,
          a[0] * (1 - t) + b[0] * t,
          2,
          a[1] * (1 - t) + b[1] * t,
        );
        const q = warpPoint(
          grid,
          neighbor,
          d[0] * (1 - t) + c[0] * t,
          2,
          d[1] * (1 - t) + c[1] * t,
        );
        expect(p[0]).toBeCloseTo(q[0], 7);
        expect(p[2]).toBeCloseTo(q[2], 7);
        compared++;
      }
    });
  expect(compared).toBeGreaterThan(1000);
  const corner = grid.cells[0].vertices[0];
  expect(warpPoint(grid, 0, -0.5, 0, -0.5)).toEqual([
    grid.vertices[corner].x,
    0,
    grid.vertices[corner].z,
  ]);
});
it("expands a repair neighborhood without dropping its center", () => {
  const grid = createTownGrid("repair");
  const region = ringCells(grid, 100, 2);
  expect(region.size).toBeGreaterThan(4);
  expect(region.has(100)).toBe(true);
});
