import type { Point, QuadCell, Size, TownGrid } from "./types";
import { random } from "./random";
const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
export function createTownGrid(seed: string, size: Size = "medium"): TownGrid {
  const rng = random(`${seed}:topology`),
    radius = { small: 4, medium: 6, large: 8 }[size];
  const vertices: Point[] = [],
    byAxial = new Map<string, number>();
  for (let q = -radius; q <= radius; q++)
    for (let r = -radius; r <= radius; r++)
      if (Math.abs(q + r) <= radius) {
        byAxial.set(`${q}:${r}`, vertices.length);
        vertices.push({
          x: (q + r / 2) * 2.5,
          z: ((r * Math.sqrt(3)) / 2) * 2.5,
        });
      }
  const triangles: number[][] = [];
  for (let q = -radius; q < radius; q++)
    for (let r = -radius; r <= radius; r++)
      for (const coords of [
        [
          [q, r],
          [q + 1, r],
          [q, r + 1],
        ],
        [
          [q + 1, r],
          [q + 1, r + 1],
          [q, r + 1],
        ],
      ]) {
        const ids = coords.map(([a, b]) => byAxial.get(`${a}:${b}`));
        if (ids.every((v) => v !== undefined)) triangles.push(ids as number[]);
      }
  const edgeTriangles = new Map<string, number[]>();
  triangles.forEach((tri, id) =>
    tri.forEach((a, i) => {
      const key = edgeKey(a, tri[(i + 1) % 3]);
      edgeTriangles.set(key, [...(edgeTriangles.get(key) ?? []), id]);
    }),
  );
  const paired = new Set<number>(),
    polygons: number[][] = [];
  const shared = [...edgeTriangles.values()]
    .filter((v) => v.length === 2)
    .map((ids) => ({ ids, sort: rng() }))
    .sort((a, b) => a.sort - b.sort);
  for (const {
    ids: [a, b],
  } of shared)
    if (!paired.has(a) && !paired.has(b)) {
      paired.add(a);
      paired.add(b);
      const ids = [...new Set([...triangles[a], ...triangles[b]])];
      const center = ids.reduce(
        (p, id) => ({
          x: p.x + vertices[id].x / 4,
          z: p.z + vertices[id].z / 4,
        }),
        { x: 0, z: 0 },
      );
      ids.sort(
        (a, b) =>
          Math.atan2(vertices[a].z - center.z, vertices[a].x - center.x) -
          Math.atan2(vertices[b].z - center.z, vertices[b].x - center.x),
      );
      polygons.push(ids);
    }
  triangles.forEach((t, i) => {
    if (!paired.has(i)) polygons.push(t);
  });
  const midpoints = new Map<string, number>(),
    quads: number[][] = [];
  const midpoint = (a: number, b: number) => {
    const key = edgeKey(a, b);
    if (midpoints.has(key)) return midpoints.get(key)!;
    const id = vertices.length;
    vertices.push({
      x: (vertices[a].x + vertices[b].x) / 2,
      z: (vertices[a].z + vertices[b].z) / 2,
    });
    midpoints.set(key, id);
    return id;
  };
  for (const poly of polygons) {
    const centerId = vertices.length;
    vertices.push(
      poly.reduce(
        (p, id) => ({
          x: p.x + vertices[id].x / poly.length,
          z: p.z + vertices[id].z / poly.length,
        }),
        { x: 0, z: 0 },
      ),
    );
    poly.forEach((v, i) =>
      quads.push([
        v,
        midpoint(v, poly[(i + 1) % poly.length]),
        centerId,
        midpoint(poly[(i + poly.length - 1) % poly.length], v),
      ]),
    );
  }
  const edges = new Map<string, { cell: number; face: number }[]>();
  quads.forEach((quad, cell) =>
    quad.forEach((v, face) => {
      const key = edgeKey(v, quad[(face + 1) % 4]);
      edges.set(key, [...(edges.get(key) ?? []), { cell, face }]);
    }),
  );
  const boundary = new Set<number>();
  for (const [key, faces] of edges)
    if (faces.length === 1)
      key.split(":").forEach((v) => boundary.add(Number(v)));
  const positive = (positions: Point[]) =>
    quads.every((q) =>
      q.every((v, i) => {
        const a = positions[v],
          b = positions[q[(i + 1) % 4]],
          c = positions[q[(i + 2) % 4]];
        return (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x) > 1e-5;
      }),
    );
  for (let iter = 0; iter < 10; iter++) {
    const sums = vertices.map(() => ({ x: 0, z: 0, n: 0 }));
    for (const q of quads) {
      const center = q.reduce(
        (p, id) => ({
          x: p.x + vertices[id].x / 4,
          z: p.z + vertices[id].z / 4,
        }),
        { x: 0, z: 0 },
      );
      let rx = 0,
        rz = 0;
      q.forEach((id, i) => {
        const angle = (-i * Math.PI) / 2,
          dx = vertices[id].x - center.x,
          dz = vertices[id].z - center.z;
        rx += (dx * Math.cos(angle) - dz * Math.sin(angle)) / 4;
        rz += (dx * Math.sin(angle) + dz * Math.cos(angle)) / 4;
      });
      q.forEach((id, i) => {
        const angle = (i * Math.PI) / 2;
        sums[id].x += center.x + rx * Math.cos(angle) - rz * Math.sin(angle);
        sums[id].z += center.z + rx * Math.sin(angle) + rz * Math.cos(angle);
        sums[id].n++;
      });
    }
    let strength = 0.45;
    for (let attempt = 0; attempt < 8; attempt++) {
      const next = vertices.map((v, i) =>
        boundary.has(i) || !sums[i].n
          ? v
          : {
              x: v.x + (sums[i].x / sums[i].n - v.x) * strength,
              z: v.z + (sums[i].z / sums[i].n - v.z) * strength,
            },
      );
      if (positive(next)) {
        vertices.splice(0, vertices.length, ...next);
        break;
      }
      strength *= 0.5;
    }
  }
  const cells: QuadCell[] = quads.map((quad, id) => ({
    id,
    vertices: quad as QuadCell["vertices"],
    neighbors: [-1, -1, -1, -1],
    neighborFaces: [-1, -1, -1, -1],
    center: quad.reduce(
      (p, v) => ({ x: p.x + vertices[v].x / 4, z: p.z + vertices[v].z / 4 }),
      { x: 0, z: 0 },
    ),
  }));
  for (const faces of edges.values())
    if (faces.length === 2) {
      const [a, b] = faces;
      cells[a.cell].neighbors[a.face] = b.cell;
      cells[a.cell].neighborFaces[a.face] = b.face;
      cells[b.cell].neighbors[b.face] = a.cell;
      cells[b.cell].neighborFaces[b.face] = a.face;
    }
  return { vertices, cells, radius: radius * 2.5 };
}
