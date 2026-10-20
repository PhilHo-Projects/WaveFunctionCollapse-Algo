import type { TownGrid, WorldIntent } from "./types";

export interface ShoreEdge {
  cell: number;
  face: number;
  landing: boolean;
}
export function shoreEdges(grid: TownGrid, intent: WorldIntent): ShoreEdge[] {
  const edges: ShoreEdge[] = [];
  for (const cell of grid.cells) {
    if (intent.ground[cell.id] !== "quay") continue;
    cell.neighbors.forEach((n, face) => {
      if (n >= 0 && intent.ground[n] !== "water") return;
      const landing = intent.bridges.some(
        (b) => b.anchors.includes(cell.id) && b.cells.includes(n),
      );
      edges.push({ cell: cell.id, face, landing });
    });
  }
  return edges;
}
