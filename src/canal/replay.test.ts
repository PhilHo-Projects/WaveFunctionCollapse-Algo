import { expect, it } from "vitest";
import { solve } from "./solver";
import { recoveryProblem } from "./recovery";
import { replay } from "./replay";
import { createTownGrid } from "./grid";
import { buildProblem, planTown, applyEdit } from "./world";
import { createCatalog } from "./catalog";
import { ringCells } from "./geometry";
it("retains frozen architecture when replaying a local repair with singleton setup events hidden", () => {
  const grid = createTownGrid("repair-replay", "small"),
    modules = createCatalog(),
    intent = planTown(grid, "repair-replay", "small", "village");
  const previous = solve(buildProblem(grid, intent, modules));
  const cell = intent.heights.findIndex((h) => h === 1),
    next = applyEdit(intent, cell, "build"),
    problem = buildProblem(grid, next, modules, previous.assignments),
    region = ringCells(grid, cell, 2);
  problem.domains = problem.domains.map((domain, slot) =>
    !region.has(slot % grid.cells.length) &&
    domain.includes(previous.assignments[slot])
      ? [previous.assignments[slot]]
      : domain,
  );
  const result = solve(problem),
    events = result.events.filter(
      (e) => e.type !== "constraint" || e.remaining > 1,
    );
  expect(result.status).toBe("success");
  expect(
    replay(result.initialDomains!, events, events.length - 1).assignments,
  ).toEqual(result.assignments);
  expect(
    result.initialDomains!.filter((d) => d.length === 1).length,
  ).toBeGreaterThan(
    buildProblem(grid, next, modules).domains.filter((d) => d.length === 1)
      .length,
  );
});
it("replays actual reductions and restores backtracked domains", () => {
  const problem = recoveryProblem(),
    result = solve(problem);
  const last = replay(problem.domains, result.events, result.events.length - 1);
  expect(last.assignments).toEqual([2, 2, 2]);
  const index = result.events.findIndex((e) => e.type === "backtrack");
  const restored = replay(problem.domains, result.events, index);
  expect(restored.counts.some((c) => c > 1)).toBe(true);
  expect(result.backtracks).toBeGreaterThan(0);
});
