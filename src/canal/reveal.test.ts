import { expect, it } from "vitest";
import { createTownGrid } from "./grid";
import { planTown } from "./world";
import { createRevealPlan, RevealPlayback, revealBirth } from "./reveal";

it("schedules every quay and bridge once in a deterministic connected walk", () => {
  const grid = createTownGrid("reveal", "medium"),
    intent = planTown(grid, "reveal", "medium", "village");
  const plan = createRevealPlan(grid, intent);
  const visible = new Set(
    intent.ground
      .flatMap((g, cell) => (g === "quay" ? [cell] : []))
      .concat(intent.bridges.flatMap((b) => b.cells)),
  );
  expect(new Set(plan.steps)).toEqual(visible);
  expect(plan.steps.length).toBe(visible.size);
  expect(createRevealPlan(grid, intent)).toEqual(plan);
  const seen = new Set<number>();
  for (const cell of plan.steps) {
    if (seen.size)
      expect(grid.cells[cell].neighbors.some((n) => seen.has(n))).toBe(true);
    expect(revealBirth(plan, cell, 2)).toBeGreaterThan(
      revealBirth(plan, cell, 1),
    );
    seen.add(cell);
  }
  expect(
    revealBirth(plan, plan.steps[1], 0) - revealBirth(plan, plan.steps[0], 0),
  ).toBeCloseTo(0.1);
});

it("changes pace continuously and finishes instantly without moving time backwards", () => {
  const grid = createTownGrid("pace", "small"),
    intent = planTown(grid, "pace", "small", "village");
  const playback = new RevealPlayback(createRevealPlan(grid, intent));
  playback.advance(10, 100);
  playback.advance(10.1, 100);
  expect(playback.clock.value).toBeCloseTo(0.1);
  const shown = playback.progress.shown;
  playback.advance(10.2, 250);
  expect(playback.clock.value).toBeCloseTo(0.14);
  expect(playback.progress.shown).toBeGreaterThanOrEqual(shown);
  playback.advance(10.3, 30);
  expect(playback.clock.value).toBeCloseTo(0.14 + 1 / 3);
  playback.advance(10.4, 0);
  expect(playback.progress.active).toBe(false);
  expect(playback.progress.shown).toBe(playback.progress.total);
  const finished = playback.clock.value;
  playback.advance(10.5, 250);
  expect(playback.clock.value).toBeCloseTo(finished + 0.1);
});

it("replacement playback starts cleanly and an instant presentation stays complete", () => {
  const grid = createTownGrid("repeat-reveal", "small"),
    intent = planTown(grid, "repeat-reveal", "small", "village");
  const plan = createRevealPlan(grid, intent),
    old = new RevealPlayback(plan);
  old.finish();
  const replacement = new RevealPlayback(plan);
  expect(replacement.clock.value).toBe(0);
  expect(replacement.progress.active).toBe(true);
  expect(old.progress.active).toBe(false);
  const instant = new RevealPlayback(null);
  instant.advance(0, 100);
  instant.advance(0.1, 100);
  expect(instant.progress.active).toBe(false);
  expect(revealBirth(null, 0, 1)).toBe(-100);
});
