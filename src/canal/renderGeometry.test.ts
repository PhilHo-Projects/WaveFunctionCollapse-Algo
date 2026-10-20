import * as THREE from "three";
import { expect, it } from "vitest";
import { TownGeometryCache } from "./renderGeometry";
import { createCatalog } from "./catalog";
import { createTownGrid } from "./grid";
import type { TownDocument, TownGrid } from "./types";

it("keeps unchanged pieces settled and retires interrupted removals after undo", () => {
  const grid = createTownGrid("animation", "small"),
    modules = createCatalog();
  const room = modules.findIndex((m) => m.category === "room");
  const air = modules.findIndex((m) => m.category === "air");
  const source = new THREE.BoxGeometry(0.9, 1, 0.9).toNonIndexed();
  const material = new THREE.MeshStandardMaterial();
  const cache = new TownGeometryCache(
    new Map([[modules[room].mesh, [{ geometry: source, material }]]]),
    grid,
  );
  const count = grid.cells.length;
  const a = 0,
    b = grid.cells.find((c) => c.id !== a && !c.neighbors.includes(a))!.id;
  const doc: TownDocument = {
    version: 1,
    kitVersion: "canal-1",
    edit: 0,
    intent: {
      seed: "animation",
      size: "small",
      preset: "village",
      ground: grid.cells.map(() => "quay"),
      heights: grid.cells.map((c) => (c.id === a || c.id === b ? 1 : 0)),
      bridges: [],
    },
    assignments: Array(count * 2).fill(air),
  };
  doc.assignments[count + a] = room;
  doc.assignments[count + b] = room;
  const original = cache.update(doc, { time: 10, animate: true });
  const births = (batches: typeof original) =>
    batches
      .filter((batch) => !batch.key.startsWith("exit:"))
      .flatMap((batch) =>
        Array.from(batch.geometry.getAttribute("townBirth").array),
      );
  const initialBirths = births(original);
  expect(
    births(cache.update({ ...doc, edit: 1 }, { time: 12, animate: true })),
  ).toEqual(initialBirths);
  const removed = structuredClone(doc);
  removed.assignments[count + a] = air;
  removed.intent.heights[a] = 0;
  const removing = cache.update(removed, { time: 12.1, animate: true });
  expect(removing.some((batch) => batch.key.startsWith("exit:"))).toBe(true);
  cache.update(doc, { time: 12.15, animate: true });
  const settled = cache.update(doc, { time: 13, animate: true });
  expect(cache.hasOutgoing).toBe(false);
  expect(
    settled.reduce(
      (sum, batch) => sum + batch.geometry.getAttribute("position").count,
      0,
    ),
  ).toBe(source.getAttribute("position").count * 2);
  const finalBirths = births(settled);
  expect(finalBirths.some((v) => v > 12)).toBe(true);
  expect(finalBirths.some((v) => v < 11)).toBe(true);
  cache.flush();
  cache.dispose();
  source.dispose();
  material.dispose();
});

it("reduced motion commits additions and removals without transient geometry", () => {
  const grid = createTownGrid("still", "small"),
    modules = createCatalog();
  const room = modules.findIndex((m) => m.category === "room"),
    air = modules.findIndex((m) => m.category === "air");
  const source = new THREE.BoxGeometry(),
    material = new THREE.MeshStandardMaterial();
  const cache = new TownGeometryCache(
    new Map([[modules[room].mesh, [{ geometry: source, material }]]]),
    grid,
  );
  const doc: TownDocument = {
    version: 1,
    kitVersion: "canal-1",
    edit: 0,
    intent: {
      seed: "still",
      size: "small",
      preset: "village",
      ground: grid.cells.map(() => "quay"),
      heights: grid.cells.map((c) => (c.id === 0 ? 1 : 0)),
      bridges: [],
    },
    assignments: Array(grid.cells.length * 2).fill(air),
  };
  doc.assignments[grid.cells.length] = room;
  expect(
    cache
      .update(doc, { time: 1, animate: false })[0]
      .geometry.getAttribute("townBirth")
      .getX(0),
  ).toBe(-100);
  doc.assignments[grid.cells.length] = air;
  doc.intent.heights[0] = 0;
  expect(cache.update(doc, { time: 1.1, animate: false })).toHaveLength(0);
  expect(cache.hasOutgoing).toBe(false);
  cache.dispose();
  source.dispose();
  material.dispose();
});

it("rotates normals with the authored bridge before applying an irregular prism transform", () => {
  const grid: TownGrid = {
    radius: 1,
    vertices: [
      { x: 0, z: 0 },
      { x: 2, z: 0.2 },
      { x: 2.3, z: 1.5 },
      { x: -0.1, z: 1.2 },
    ],
    cells: [
      {
        id: 0,
        vertices: [0, 1, 2, 3],
        neighbors: [-1, -1, -1, -1],
        neighborFaces: [-1, -1, -1, -1],
        center: { x: 1.05, z: 0.725 },
      },
    ],
  };
  const source = new THREE.BufferGeometry();
  source.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [-0.2, 0, -0.3, 0.2, 0, -0.3, -0.2, 0.2, 0.3],
      3,
    ),
  );
  source.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial(),
    kit = new Map([["bridge_end", [{ geometry: source, material }]]]),
    modules = createCatalog();
  for (let rotation = 0; rotation < 4; rotation++) {
    const module = modules.findIndex(
      (m) => m.mesh === "bridge_end" && m.rotation === rotation,
    );
    const doc: TownDocument = {
      version: 1,
      kitVersion: "canal-1",
      edit: 0,
      intent: {
        seed: "normal",
        size: "small",
        preset: "village",
        ground: ["water"],
        heights: [0],
        bridges: [],
      },
      assignments: [0, module],
    };
    const cache = new TownGeometryCache(kit, grid),
      g = cache.update(doc)[0].geometry,
      p = g.getAttribute("position"),
      n = g.getAttribute("normal");
    // A warped surface is bilinear: compare the transformed normal at each
    // vertex with a differential tangent there, rather than a flat face normal.
    for (let i = 0; i < 3; i++) {
      const x = source.getAttribute("position").getX(i),
        z = source.getAttribute("position").getZ(i),
        a = (rotation * Math.PI) / 2;
      const u = x * Math.cos(a) - z * Math.sin(a) + 0.5,
        v = x * Math.sin(a) + z * Math.cos(a) + 0.5;
      const [A, B, C, D] = grid.vertices,
        dxdu = (B.x - A.x) * (1 - v) + (C.x - D.x) * v,
        dzdu = (B.z - A.z) * (1 - v) + (C.z - D.z) * v,
        dxdv = (D.x - A.x) * (1 - u) + (C.x - B.x) * u,
        dzdv = (D.z - A.z) * (1 - u) + (C.z - B.z) * u;
      const tangent = (sx: number, sy: number, sz: number) => {
        const tx = sx * Math.cos(a) - sz * Math.sin(a),
          tz = sx * Math.sin(a) + sz * Math.cos(a);
        return new THREE.Vector3(
          dxdu * tx + dxdv * tz,
          1.4 * sy,
          dzdu * tx + dzdv * tz,
        );
      };
      const expected = tangent(0.4, 0, 0)
        .cross(tangent(0, 0.2, 0.6))
        .normalize();
      expect(
        new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i)).dot(expected),
      ).toBeCloseTo(1, 6);
    }
    expect(p.count).toBe(3);
    cache.dispose();
  }
  source.dispose();
  material.dispose();
});
