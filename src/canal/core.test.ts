import { describe, expect, it } from "vitest";
import { solve, solveSteps } from "./solver";
import { createTownGrid } from "./grid";
import type { ModuleDefinition, SolverProblem } from "./types";

const tile = (id: string, socket: string): ModuleDefinition => ({
  id,
  family: id,
  mesh: id,
  rotation: 0,
  category: "room",
  sockets: [socket, socket, socket, socket, socket, socket],
  weight: 1,
  mask: 0,
  variant: 0,
});
describe("constraint solving", () => {
  it("propagates a pinned choice through a connected graph", () => {
    const p: SolverProblem = {
      modules: [tile("a", "a"), tile("b", "b")],
      links: [
        [{ to: 1, face: 0, otherFace: 2 }],
        [{ to: 0, face: 2, otherFace: 0 }],
      ],
      domains: [[1], [0, 1]],
      seed: "pin",
    };
    const r = solve(p);
    expect(r.status).toBe("success");
    expect(r.assignments).toEqual([1, 1]);
    expect(r.events.some((e) => e.type === "propagate")).toBe(true);
  });
  it("reports incompatible pinned neighbors rather than success", () => {
    const r = solve({
      modules: [tile("a", "a"), tile("b", "b")],
      links: [
        [{ to: 1, face: 0, otherFace: 2 }],
        [{ to: 0, face: 2, otherFace: 0 }],
      ],
      domains: [[0], [1]],
      seed: "bad",
    });
    expect(r.status).toBe("contradiction");
    expect(r.events.some((e) => e.type === "contradiction")).toBe(true);
  });
  it("backtracks out of an odd alternating cycle and finds the valid third state", () => {
    const a = tile("a", "a"),
      b = tile("b", "b"),
      c = tile("c", "c");
    a.sockets[2] = "b";
    b.sockets[2] = "a";
    a.weight = b.weight = 100;
    const links = [0, 1, 2].map((i) => [
      { to: (i + 1) % 3, face: 0, otherFace: 2 },
      { to: (i + 2) % 3, face: 2, otherFace: 0 },
    ]);
    const r = solve({
      modules: [a, b, c],
      links,
      domains: [
        [0, 1, 2],
        [0, 1, 2],
        [0, 1, 2],
      ],
      seed: "recovery",
    });
    expect(r.status).toBe("success");
    expect(r.assignments).toEqual([2, 2, 2]);
    expect(r.backtracks).toBeGreaterThan(0);
    expect(r.events.some((e) => e.type === "backtrack")).toBe(true);
    const exhausted = solve({
      modules: [a, b, c],
      links,
      domains: [
        [0, 1, 2],
        [0, 1, 2],
        [0, 1, 2],
      ],
      seed: "recovery",
      maxBacktracks: 0,
    });
    expect(exhausted.status).toBe("exhausted");
  });
  it("supports tiles beyond the first bitset word and explicit cancellation", () => {
    const modules = Array.from({ length: 70 }, (_, i) => tile(`${i}`, `${i}`));
    const p: SolverProblem = {
      modules,
      links: [
        [{ to: 1, face: 0, otherFace: 2 }],
        [{ to: 0, face: 2, otherFace: 0 }],
      ],
      domains: [[69], modules.map((_, i) => i)],
      seed: "wide",
    };
    expect(solve(p).assignments).toEqual([69, 69]);
    const gen = solveSteps(p, () => true);
    let next = gen.next();
    while (!next.done) next = gen.next();
    expect(next.value.status).toBe("cancelled");
  });
});
describe("organic shared topology", () => {
  it("creates a reproducible medium quad mesh with reciprocal shared edges", () => {
    const grid = createTownGrid("canal");
    expect(grid.cells.length).toBeGreaterThan(380);
    expect(grid.cells.length).toBeLessThan(550);
    expect(grid).toEqual(createTownGrid("canal"));
    for (const c of grid.cells) {
      const points = c.vertices.map((id) => grid.vertices[id]);
      let area = 0;
      for (let i = 0; i < 4; i++) {
        const a = points[i],
          b = points[(i + 1) % 4];
        area += a.x * b.z - b.x * a.z;
      }
      expect(area).toBeGreaterThan(0.001);
      c.neighbors.forEach((id, face) => {
        if (id < 0) return;
        const other = grid.cells[id];
        const f = c.neighborFaces[face];
        expect(other.neighbors[f]).toBe(c.id);
        expect(other.vertices[f]).toBe(c.vertices[(face + 1) % 4]);
        expect(other.vertices[(f + 1) % 4]).toBe(c.vertices[face]);
      });
    }
  });
});
