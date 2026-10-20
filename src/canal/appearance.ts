import { hash } from "./random";
import type { TownGrid, WorldIntent } from "./types";

export const PALETTE = [
  { name: "Rice paper", colour: "#f0ddb4" },
  { name: "Persimmon", colour: "#db936f" },
  { name: "Buttercup", colour: "#e6bf68" },
  { name: "Sea glass", colour: "#a8c6b1" },
  { name: "Rain blue", colour: "#a2becb" },
  { name: "Cherry blossom", colour: "#d6aaad" },
] as const;

export interface BuildingAppearance {
  root: number;
  colour: number;
}

/** A footprint is one visual building even when its rooms have different heights. */
export function buildingAppearance(
  grid: TownGrid,
  intent: WorldIntent,
): BuildingAppearance[] {
  const result = grid.cells.map((c) => ({ root: c.id, colour: 0 }));
  const seen = new Set<number>();
  for (const cell of grid.cells) {
    if (!intent.heights[cell.id] || seen.has(cell.id)) continue;
    const cells = [cell.id];
    seen.add(cell.id);
    for (const id of cells)
      for (const n of grid.cells[id].neighbors) {
        if (n >= 0 && intent.heights[n] > 0 && !seen.has(n)) {
          seen.add(n);
          cells.push(n);
        }
      }
    const root = Math.min(...cells);
    const painted = cells
      .sort((a, b) => a - b)
      .find((id) => (intent.paint?.[id] ?? -1) >= 0);
    const colour =
      painted === undefined
        ? hash(`${intent.seed}:plaster:${root}`) % PALETTE.length
        : intent.paint![painted];
    cells.forEach((id) => {
      result[id] = { root, colour };
    });
  }
  return result;
}

export function paintBuilding(
  grid: TownGrid,
  intent: WorldIntent,
  cell: number,
  colour: number,
): WorldIntent {
  if (!Number.isInteger(colour) || colour < 0 || colour >= PALETTE.length)
    throw new Error("Choose a building colour from the palette.");
  if (!grid.cells[cell] || !intent.heights[cell]) return intent;
  const appearances = buildingAppearance(grid, intent);
  const root = appearances[cell].root;
  const paint = intent.paint ? [...intent.paint] : grid.cells.map(() => -1);
  let changed = false;
  appearances.forEach((appearance, id) => {
    if (
      intent.heights[id] &&
      appearance.root === root &&
      paint[id] !== colour
    ) {
      paint[id] = colour;
      changed = true;
    }
  });
  return changed ? { ...intent, paint } : intent;
}
