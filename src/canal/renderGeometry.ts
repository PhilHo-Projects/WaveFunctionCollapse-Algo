import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createCatalog } from "./catalog";
import { FLOOR_HEIGHT } from "./types";
import type { TownDocument, TownGrid } from "./types";
import { warpPoint } from "./geometry";
import { buildingAppearance, PALETTE } from "./appearance";
import { animateMaterial, motionAttributes, REMOVE_SECONDS } from "./motion";

export interface RenderBatch {
  key: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}
export interface KitPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}
export function readKit(root: THREE.Group): Map<string, KitPart[]> {
  root.updateMatrixWorld(true);
  const kit = new Map<string, KitPart[]>();
  const materials = new Map<string, THREE.Material>();
  for (const node of root.children) {
    const parts: KitPart[] = [];
    node.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const geometry = child.geometry.clone().applyMatrix4(child.matrixWorld);
      const original = child.material as THREE.MeshStandardMaterial;
      let material = materials.get(original.uuid);
      if (!material) {
        material = original.clone();
        if (
          material instanceof THREE.MeshStandardMaterial &&
          /plaster/i.test(material.name)
        ) {
          material.color.set("#ffffff");
          material.vertexColors = true;
        }
        materials.set(original.uuid, material);
      }
      parts.push({ geometry, material });
    });
    if (parts.length) kit.set(node.name, parts);
  }
  return kit;
}
export function warpGeometry(
  source: THREE.BufferGeometry,
  grid: TownGrid,
  cellId: number,
  layer: number,
  rotation = 0,
) {
  const geometry = source.clone(),
    position = geometry.getAttribute("position"),
    normal = geometry.getAttribute("normal");
  const matrix = new THREE.Matrix3(),
    vector = new THREE.Vector3();
  const [a, b, c, d] = grid.cells[cellId].vertices.map(
    (id) => grid.vertices[id],
  );
  const angle = (rotation * Math.PI) / 2;
  for (let i = 0; i < position.count; i++) {
    const sx = position.getX(i),
      sy = position.getY(i),
      sz = position.getZ(i);
    const x = sx * Math.cos(angle) - sz * Math.sin(angle),
      z = sx * Math.sin(angle) + sz * Math.cos(angle);
    const p = warpPoint(
      grid,
      cellId,
      x,
      (layer > 0 ? layer - 1 : 0) * FLOOR_HEIGHT + sy * FLOOR_HEIGHT,
      z,
    );
    position.setXYZ(i, ...p);
    const u = x + 0.5,
      v = z + 0.5,
      dxdu = (b.x - a.x) * (1 - v) + (c.x - d.x) * v,
      dzdu = (b.z - a.z) * (1 - v) + (c.z - d.z) * v,
      dxdv = (d.x - a.x) * (1 - u) + (c.x - b.x) * u,
      dzdv = (d.z - a.z) * (1 - u) + (c.z - b.z) * u;
    matrix
      .set(dxdu, 0, dxdv, 0, FLOOR_HEIGHT, 0, dzdu, 0, dzdv)
      .invert()
      .transpose();
    vector
      .set(normal.getX(i), normal.getY(i), normal.getZ(i))
      .applyAxisAngle(THREE.Object3D.DEFAULT_UP, -angle)
      .applyMatrix3(matrix)
      .normalize();
    normal.setXYZ(i, vector.x, vector.y, vector.z);
  }
  geometry.computeBoundingSphere();
  return geometry;
}

export class TownGeometryCache {
  private warped = new Map<string, KitPart[]>();
  private chunks = new Map<
    string,
    { signature: string; batches: RenderBatch[] }
  >();
  private retired: THREE.BufferGeometry[] = [];
  private outgoing: { until: number; key: string; parts: KitPart[] }[] = [];
  private motionMaterials = new Map<string, THREE.Material>();
  readonly clock = { value: 0 };
  readonly depthMaterial = animateMaterial(
    new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }),
    this.clock,
  );
  private generation = 0;
  private kit: Map<string, KitPart[]>;
  private grid: TownGrid;
  constructor(kit: Map<string, KitPart[]>, grid: TownGrid) {
    this.kit = kit;
    this.grid = grid;
  }
  update(
    doc: TownDocument,
    options?: { time: number; animate: boolean },
  ): RenderBatch[] {
    const time = options?.time ?? 0;
    const animate = options?.animate ?? false;
    this.clock.value = time;
    const appearance = buildingAppearance(this.grid, doc.intent);
    const first = this.generation++ === 0;
    this.outgoing = this.outgoing.filter((entry) => {
      if (entry.until > time && animate) return true;
      entry.parts.forEach((p) => this.retired.push(p.geometry));
      return false;
    });
    const modules = createCatalog(),
      count = this.grid.cells.length;
    const groups = new Map<
        string,
        { key: string; slot: number; module: number }[]
      >(),
      used = new Set<string>();
    doc.assignments.forEach((module, slot) => {
      if (module < 0) return;
      const definition = modules[module],
        cellId = slot % count;
      if (
        definition.category === "air" ||
        (definition.category === "ground" &&
          doc.intent.ground[cellId] === "water")
      )
        return;
      const c = this.grid.cells[cellId],
        chunk = `${Math.floor(c.center.x / 16)}:${Math.floor(c.center.z / 16)}`,
        key = `${slot}:${module}:${definition.category === "room" ? appearance[cellId].colour : 0}`;
      groups.set(chunk, [...(groups.get(chunk) ?? []), { key, slot, module }]);
      used.add(key);
    });
    for (const [chunk, entries] of groups) {
      const signature = entries.map((e) => e.key).join(",");
      if (this.chunks.get(chunk)?.signature === signature) continue;
      const materialGroups = new Map<
        string,
        { material: THREE.Material; geometries: THREE.BufferGeometry[] }
      >();
      for (const entry of entries) {
        const cellId = entry.slot % count,
          layer = Math.floor(entry.slot / count),
          definition = modules[entry.module];
        let parts = this.warped.get(entry.key);
        if (!parts) {
          const source = this.kit.get(
            definition.category === "room" &&
              layer > 1 &&
              this.kit.has(`${definition.mesh}_upper`)
              ? `${definition.mesh}_upper`
              : definition.mesh,
          );
          if (!source)
            throw new Error(`The Blender kit is missing ${definition.mesh}.`);
          parts = source.map((part) => {
            const geometry = warpGeometry(
              part.geometry,
              this.grid,
              cellId,
              layer,
              definition.rotation,
            );
            if (
              part.material instanceof THREE.MeshStandardMaterial &&
              part.material.vertexColors
            ) {
              const tint = new THREE.Color(
                PALETTE[appearance[cellId].colour].colour,
              );
              const colour = new Float32Array(
                geometry.getAttribute("position").count * 3,
              );
              for (let i = 0; i < colour.length; i += 3)
                tint.toArray(colour, i);
              geometry.setAttribute(
                "color",
                new THREE.BufferAttribute(colour, 3),
              );
            }
            const center = this.grid.cells[cellId].center;
            const delay = first
              ? Math.hypot(center.x, center.z) * 0.018 + layer * 0.045
              : layer * 0.022;
            motionAttributes(
              geometry,
              new THREE.Vector3(
                center.x,
                Math.max(0, layer - 1) * FLOOR_HEIGHT,
                center.z,
              ),
              animate ? time + delay : -100,
            );
            geometry.computeBoundingSphere();
            let material = this.motionMaterials.get(part.material.uuid);
            if (!material) {
              material = animateMaterial(part.material.clone(), this.clock);
              this.motionMaterials.set(part.material.uuid, material);
            }
            return { geometry, material };
          });
          this.warped.set(entry.key, parts);
        }
        for (const part of parts) {
          const key = part.material.uuid;
          const group = materialGroups.get(key) ?? {
            material: part.material,
            geometries: [],
          };
          group.geometries.push(part.geometry);
          materialGroups.set(key, group);
        }
      }
      const batches = [...materialGroups].map(([id, g]) => ({
        key: `${chunk}:${id}`,
        geometry: mergeGeometries(g.geometries, false)!,
        material: g.material,
      }));
      this.chunks
        .get(chunk)
        ?.batches.forEach((b) => this.retired.push(b.geometry));
      this.chunks.set(chunk, { signature, batches });
    }
    for (const [chunk, old] of this.chunks)
      if (!groups.has(chunk)) {
        old.batches.forEach((b) => this.retired.push(b.geometry));
        this.chunks.delete(chunk);
      }
    for (const [key, parts] of this.warped)
      if (!used.has(key)) {
        const slot = Number(key.split(":")[0]);
        if (animate && Math.floor(slot / count) > 0) {
          const copies = parts.map((part) => {
            const geometry = part.geometry.clone();
            const pivot = geometry.getAttribute("townPivot");
            motionAttributes(
              geometry,
              new THREE.Vector3(pivot.getX(0), pivot.getY(0), pivot.getZ(0)),
              time,
              true,
            );
            return { geometry, material: part.material };
          });
          this.outgoing.push({
            until: time + REMOVE_SECONDS,
            key: `${key}:${time}`,
            parts: copies,
          });
        }
        parts.forEach((p) => this.retired.push(p.geometry));
        this.warped.delete(key);
      }
    return [...this.chunks.values()]
      .flatMap((c) => c.batches)
      .concat(
        this.outgoing.flatMap((entry) =>
          entry.parts.map((part, i) => ({
            ...part,
            key: `exit:${entry.key}:${i}`,
          })),
        ),
      );
  }
  setNight(night: boolean) {
    for (const material of this.motionMaterials.values()) {
      if (
        material instanceof THREE.MeshStandardMaterial &&
        material.name === "Window glass"
      ) {
        material.emissive.set("#ffc478");
        material.emissiveIntensity = night ? 1.1 : 0;
      }
    }
  }
  get hasOutgoing() {
    return this.outgoing.length > 0;
  }
  flush() {
    this.retired.forEach((g) => g.dispose());
    this.retired = [];
  }
  dispose() {
    this.flush();
    this.outgoing.forEach((entry) =>
      entry.parts.forEach((part) => part.geometry.dispose()),
    );
    this.motionMaterials.forEach((material) => material.dispose());
    this.depthMaterial.dispose();
    this.warped.forEach((parts) => parts.forEach((p) => p.geometry.dispose()));
    this.chunks.forEach((c) => c.batches.forEach((b) => b.geometry.dispose()));
  }
}
export function makePickingGeometry(grid: TownGrid, doc: TownDocument) {
  const positions: number[] = [],
    cellByFace: number[] = [];
  const modules = createCatalog();
  const triangle = (cell: number, a: number[], b: number[], c: number[]) => {
    positions.push(...a, ...b, ...c);
    cellByFace.push(cell);
  };
  grid.cells.forEach((cell) => {
    const height = doc.intent.heights[cell.id],
      y = height * FLOOR_HEIGHT;
    const corners = cell.vertices.map((id) => grid.vertices[id]);
    if (height > 0) {
      const roof =
          modules[doc.assignments[(height + 1) * grid.cells.length + cell.id]],
        mask = roof?.mask ?? 0;
      const center = [cell.center.x, y + 0.52 * FLOOR_HEIGHT, cell.center.z];
      for (let f = 0; f < 4; f++) {
        const a = corners[f],
          b = corners[(f + 1) % 4],
          left = [a.x, y + 0.04 * FLOOR_HEIGHT, a.z],
          right = [b.x, y + 0.04 * FLOOR_HEIGHT, b.z],
          mid = [
            (a.x + b.x) / 2,
            y + (mask & (1 << f) ? 0.52 : 0.04) * FLOOR_HEIGHT,
            (a.z + b.z) / 2,
          ];
        triangle(cell.id, right, mid, center);
        triangle(cell.id, mid, left, center);
        const neighbor = cell.neighbors[f],
          bottom =
            (neighbor >= 0 ? doc.intent.heights[neighbor] : 0) * FLOOR_HEIGHT;
        if (bottom < y) {
          triangle(cell.id, [a.x, bottom, a.z], [a.x, y, a.z], [b.x, y, b.z]);
          triangle(
            cell.id,
            [a.x, bottom, a.z],
            [b.x, y, b.z],
            [b.x, bottom, b.z],
          );
        }
      }
    } else {
      const bridge = doc.intent.bridges.find((b) => b.cells.includes(cell.id));
      if (bridge) {
        const module = modules[doc.assignments[grid.cells.length + cell.id]],
          angle = ((module?.rotation ?? 0) * Math.PI) / 2;
        const map = (x: number, sy: number, z: number) =>
          warpPoint(
            grid,
            cell.id,
            x * Math.cos(angle) - z * Math.sin(angle),
            sy * FLOOR_HEIGHT,
            x * Math.sin(angle) + z * Math.cos(angle),
          );
        const deck = (z: number) =>
          module?.mesh === "bridge_span"
            ? 0.18
            : module?.mesh === "bridge_end"
              ? 0.055 + 0.125 * (z + 0.5)
              : 0.055 + 0.125 * Math.sin((z + 0.5) * Math.PI);
        for (let i = 0; i < 12; i++) {
          const z = -0.5 + i / 12,
            zz = z + 1 / 12,
            a = map(-0.41, deck(z) + 0.02, z),
            b = map(0.41, deck(z) + 0.02, z),
            c = map(0.41, deck(zz) + 0.02, zz),
            d = map(-0.41, deck(zz) + 0.02, zz);
          triangle(cell.id, a, c, b);
          triangle(cell.id, a, d, c);
        }
      } else
        for (const face of [
          [0, 2, 1],
          [0, 3, 2],
        ])
          triangle(
            cell.id,
            ...(face.map((i) => [corners[i].x, 0.015, corners[i].z]) as [
              number[],
              number[],
              number[],
            ]),
          );
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  geometry.userData.cellByFace = cellByFace;
  return { geometry, cellByFace };
}
