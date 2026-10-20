import { expect, it } from "vitest";
import { shoreEdges } from "./dressing";
import { createTownGrid } from "./grid";
import { planTown } from "./world";

it("adds shore detail only on exposed banks and keeps bridge approaches open", () => {
  const grid = createTownGrid("komorebi");
  const intent = planTown(grid, "komorebi", "medium", "village");
  const edges = shoreEdges(grid, intent);
  expect(edges.length).toBeGreaterThan(20);
  for (const edge of edges) {
    expect(intent.ground[edge.cell]).toBe("quay");
    const next = grid.cells[edge.cell].neighbors[edge.face];
    expect(next < 0 || intent.ground[next] === "water").toBe(true);
  }
  for (const bridge of intent.bridges)
    for (const anchor of bridge.anchors) {
      const face = grid.cells[anchor].neighbors.findIndex((n) =>
        bridge.cells.includes(n),
      );
      expect(
        edges.find((e) => e.cell === anchor && e.face === face)?.landing,
      ).toBe(true);
    }
});
