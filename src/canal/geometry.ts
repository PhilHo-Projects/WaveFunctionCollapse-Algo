import type { TownGrid } from "./types";
export function warpPoint(
  grid: TownGrid,
  cellId: number,
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  const [a, b, c, d] = grid.cells[cellId].vertices.map(
      (id) => grid.vertices[id],
    ),
    u = x + 0.5,
    v = z + 0.5;
  return [
    a.x * (1 - u) * (1 - v) +
      b.x * u * (1 - v) +
      c.x * u * v +
      d.x * (1 - u) * v,
    y,
    a.z * (1 - u) * (1 - v) +
      b.z * u * (1 - v) +
      c.z * u * v +
      d.z * (1 - u) * v,
  ];
}
export function ringCells(
  grid: TownGrid,
  start: number,
  radius: number,
): Set<number> {
  const result = new Set([start]);
  let frontier = [start];
  for (let i = 0; i < radius; i++) {
    const next: number[] = [];
    for (const id of frontier)
      for (const n of grid.cells[id].neighbors)
        if (n >= 0 && !result.has(n)) {
          result.add(n);
          next.push(n);
        }
    frontier = next;
  }
  return result;
}
