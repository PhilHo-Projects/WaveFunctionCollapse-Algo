import { expect, it } from "vitest";
import { buildingAppearance, paintBuilding, PALETTE } from "./appearance";
import { createTownGrid } from "./grid";
import type { WorldIntent } from "./types";

const grid = createTownGrid("appearance", "small");
const a = grid.cells.find((c) => c.neighbors.every((n) => n >= 0))!;
const b = a.neighbors[0];
const intent: WorldIntent = {
  seed: "appearance",
  size: "small",
  preset: "village",
  ground: grid.cells.map(() => "quay"),
  heights: grid.cells.map((c) => (c.id === a.id ? 2 : c.id === b ? 1 : 0)),
  bridges: [],
};

it("gives a connected building a coherent, deterministic colour", () => {
  const first = buildingAppearance(grid, intent);
  expect(first[a.id].colour).toBe(first[b].colour);
  expect(first[a.id].root).toBe(first[b].root);
  expect(first).toEqual(buildingAppearance(grid, structuredClone(intent)));
  expect(first[a.id].colour).toBeGreaterThanOrEqual(0);
  expect(first[a.id].colour).toBeLessThan(PALETTE.length);
});

it("paints the complete footprint without mutating the saved intent", () => {
  const painted = paintBuilding(grid, intent, a.id, 3);
  expect(intent.paint).toBeUndefined();
  expect(painted.paint?.[a.id]).toBe(3);
  expect(painted.paint?.[b]).toBe(3);
  expect(buildingAppearance(grid, painted)[b].colour).toBe(3);
  expect(paintBuilding(grid, painted, b, 3)).toBe(painted);
  expect(() => paintBuilding(grid, intent, a.id, 99)).toThrow();
  const empty = intent.heights.findIndex((h) => !h);
  expect(paintBuilding(grid, intent, empty, 1)).toBe(intent);
});
