import { describe, expect, it } from "vitest";
import { createTownGrid } from "./grid";
import {
  planTown,
  buildProblem,
  findBridge,
  applyEdit,
  readDocument,
  validatePlan,
  PlanFailure,
} from "./world";
import { solve } from "./solver";
import { createCatalog } from "./catalog";

describe("guided town planning and editing", () => {
  it("caps floors and ignores removal of an empty plot", () => {
    const grid = createTownGrid("limits", "small"),
      intent = planTown(grid, "limits", "small", "village"),
      cell = intent.heights.findIndex((h) => h > 0);
    const full = { ...intent, heights: [...intent.heights] };
    full.heights[cell] = 4;
    expect(() => applyEdit(full, cell, "build")).toThrow("four floors");
    const empty = grid.cells.find(
      (c) =>
        !intent.heights[c.id] &&
        !intent.bridges.some(
          (b) => b.cells.includes(c.id) || b.anchors.includes(c.id),
        ),
    )!.id;
    expect(applyEdit(intent, empty, "remove")).toBe(intent);
  });
  it("reproduces the same town after an identical sequence of edits", () => {
    const run = () => {
      const grid = createTownGrid("repeat", "small"),
        modules = createCatalog();
      let intent = planTown(grid, "repeat", "small", "village"),
        result = solve(buildProblem(grid, intent, modules));
      const cell = intent.heights.findIndex((h) => h === 1);
      for (const edit of ["build", "build", "remove"] as const) {
        intent = applyEdit(intent, cell, edit);
        result = solve(buildProblem(grid, intent, modules, result.assignments));
        expect(result.status).toBe("success");
      }
      return { intent, assignments: result.assignments };
    };
    expect(run()).toEqual(run());
  });
  it("reports invalid plans and bounded planning exhaustion explicitly", () => {
    const grid = createTownGrid("invalid", "small"),
      intent = planTown(grid, "invalid", "small", "village");
    expect(
      validatePlan(grid, { ...intent, bridges: [] }).some(
        (i) => i.code === "bridge",
      ),
    ).toBe(true);
    expect(() =>
      planTown(
        { cells: [], vertices: [], radius: 1 },
        "empty",
        "small",
        "village",
      ),
    ).toThrow(PlanFailure);
  });
  it("creates populated connected towns across 100 seeds", () => {
    for (let i = 0; i < 100; i++) {
      const grid = createTownGrid(`town-${i}`);
      const intent = planTown(grid, `town-${i}`, "medium", "village");
      expect(intent.heights.filter((h) => h > 0).length).toBeGreaterThanOrEqual(
        12,
      );
      expect(intent.bridges.length).toBeGreaterThanOrEqual(2);
      intent.bridges.forEach((b) => {
        expect(b.cells.length).toBeGreaterThan(0);
        expect(b.cells.length).toBeLessThanOrEqual(3);
        expect(b.anchors.every((a) => intent.ground[a] === "quay")).toBe(true);
      });
    }
  });
  it("solves supported rooms and roofs with all shared interfaces compatible", () => {
    const grid = createTownGrid("river", "small"),
      intent = planTown(grid, "river", "small", "market");
    const problem = buildProblem(grid, intent, createCatalog());
    const result = solve(problem);
    expect(result.status).toBe("success");
    result.assignments.forEach((v, slot) =>
      problem.links[slot].forEach((link) =>
        expect(problem.modules[v].sockets[link.face]).toBe(
          problem.modules[result.assignments[link.to]].sockets[link.otherFace],
        ),
      ),
    );
    const room = intent.heights.findIndex((h) => h > 0);
    const edited = applyEdit(intent, room, "build");
    expect(edited.heights[room]).toBe(Math.min(4, intent.heights[room] + 1));
    expect(intent.heights[room]).toBeGreaterThan(0);
    expect(
      solve(buildProblem(grid, edited, createCatalog(), result.assignments))
        .status,
    ).toBe("success");
  });
  it("restores versioned documents and rejects malformed assignments", () => {
    expect(() =>
      readDocument('{"version":1,"kitVersion":"unknown"}'),
    ).toThrow();
    expect(() =>
      readDocument('{"version":1,"kitVersion":"canal-1","intent":{}}'),
    ).toThrow();
    const grid = createTownGrid("roundtrip", "small"),
      intent = planTown(grid, "roundtrip", "small", "village"),
      result = solve(buildProblem(grid, intent, createCatalog()));
    const doc = {
      version: 1,
      kitVersion: "canal-1",
      intent,
      assignments: result.assignments,
      edit: 0,
    };
    expect(readDocument(JSON.stringify(doc))).toEqual(doc);
    const painted = {
      ...doc,
      intent: { ...intent, paint: intent.heights.map((h) => (h ? 3 : -1)) },
    };
    expect(readDocument(JSON.stringify(painted))).toEqual(painted);
    for (const paint of [
      [3],
      intent.heights.map(() => 6),
      intent.heights.map(() => 1.5),
    ]) {
      expect(() =>
        readDocument(JSON.stringify({ ...doc, intent: { ...intent, paint } })),
      ).toThrow();
    }
    const invalid = { ...doc, assignments: [...doc.assignments] };
    invalid.assignments[0] = 99999;
    expect(() => readDocument(JSON.stringify(invalid))).toThrow();
  });
  it("never accepts a bridge without two valid quay anchors", () => {
    const grid = createTownGrid("bridge", "small"),
      intent = planTown(grid, "bridge", "small", "village");
    expect(findBridge(grid, intent, -1, 100000)).toBeNull();
    const bridge = intent.bridges[0];
    const blocked = { ...intent, bridges: [], heights: [...intent.heights] };
    blocked.heights[bridge.anchors[0]] = 1;
    expect(findBridge(grid, blocked, ...bridge.anchors)).toBeNull();
    const removed = applyEdit(intent, bridge.cells[0], "remove");
    expect(removed.bridges).toHaveLength(intent.bridges.length - 1);
  });
});
