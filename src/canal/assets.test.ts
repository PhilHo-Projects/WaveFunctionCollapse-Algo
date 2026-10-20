import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createCatalog } from "./catalog";
const binary = readFileSync("public/assets/canal-town/canal-kit.glb");
const jsonSize = binary.readUInt32LE(12);
const gltf = JSON.parse(binary.subarray(20, 20 + jsonSize).toString());
const start = 20 + jsonSize + 8;
it("keeps every rotated bridge deck port on the shared height and boundary", () => {
  for (const module of createCatalog().filter(
    (m) => m.category === "bridge" && m.mask,
  )) {
    const mesh = gltf.meshes.find(
        (m: { name: string }) => m.name === module.mesh,
      ),
      a = (module.rotation * Math.PI) / 2;
    const primitive = mesh.primitives.find(
      (p: { material: number }) =>
        gltf.materials[p.material].name === "Cedar cut edges",
    );
    const accessor = gltf.accessors[primitive.attributes.POSITION],
      view = gltf.bufferViews[accessor.bufferView];
    const positions = Array.from({ length: accessor.count }, (_, i) => {
      const read = (j: number) =>
        binary.readFloatLE(
          start +
            (view.byteOffset ?? 0) +
            (accessor.byteOffset ?? 0) +
            i * (view.byteStride ?? 12) +
            j * 4,
        );
      const x = read(0),
        z = read(2);
      return [
        x * Math.cos(a) - z * Math.sin(a),
        read(1),
        x * Math.sin(a) + z * Math.cos(a),
      ];
    });
    for (let face = 0; face < 4; face++)
      if (module.sockets[face] === "deck") {
        const profile = positions.filter(
          (p) =>
            Math.abs([p[2] + 0.5, p[0] - 0.5, p[2] - 0.5, p[0] + 0.5][face]) <
            1e-6,
        );
        expect(profile.length, module.id).toBeGreaterThan(0);
        expect(Math.min(...profile.map((p) => p[1])), module.id).toBeCloseTo(
          0.16,
          6,
        );
        expect(Math.max(...profile.map((p) => p[1])), module.id).toBeCloseTo(
          0.2,
          6,
        );
      }
  }
});
it("exports the same connector metadata used by the solver", () => {
  const manifest = JSON.parse(
    readFileSync("public/assets/canal-town/manifest.json", "utf8"),
  );
  expect(manifest.modules).toEqual(createCatalog());
  expect(manifest.props).toContain("sakura");
  expect(manifest.props).toContain("market_umbrella");
  expect(manifest.details).toEqual(["bank_edge", "railing"]);
  expect(manifest.families.length).toBeGreaterThanOrEqual(24);
  for (const module of manifest.modules)
    if (module.category !== "air")
      expect(
        gltf.nodes.some((node: { name: string }) => node.name === module.mesh),
      ).toBe(true);
  for (let mask = 0; mask < 16; mask++)
    for (let variant = 0; variant < 3; variant++)
      expect(gltf.nodes.some((node: { name: string }) => node.name === `room_${mask}_${variant}_upper`)).toBe(true);
});
it("exports all roof connector profiles on their declared prism planes", () => {
  for (let mask = 0; mask < 16; mask++) {
    const mesh = gltf.meshes.find(
      (m: { name: string }) => m.name === `roof_${mask}`,
    );
    const primitive = mesh.primitives.find(
      (p: { material: number }) =>
        gltf.materials[p.material].name === "Blue ceramic",
    );
    const accessor = gltf.accessors[primitive.attributes.POSITION],
      view = gltf.bufferViews[accessor.bufferView];
    const positions = Array.from({ length: accessor.count }, (_, i) =>
      Array.from({ length: 3 }, (_, j) =>
        binary.readFloatLE(
          start +
            (view.byteOffset ?? 0) +
            (accessor.byteOffset ?? 0) +
            i * (view.byteStride ?? 12) +
            j * 4,
        ),
      ),
    );
    for (let face = 0; face < 4; face++) {
      const onFace = (p: number[]) =>
        Math.abs([p[2] + 0.5, p[0] - 0.5, p[2] - 0.5, p[0] + 0.5][face]) < 1e-6;
      const along = (p: number[]) => [p[0], p[2], -p[0], -p[2]][face];
      const profile = positions.filter(onFace);
      for (const t of [-0.5, 0, 0.5]) {
        const samples = profile.filter((p) => Math.abs(along(p) - t) < 1e-6);
        expect(samples.length).toBeGreaterThan(0);
        for (const p of samples)
          expect(p[1]).toBeCloseTo(
            t === 0 && mask & (1 << face) ? 0.52 : 0.04,
            6,
          );
      }
    }
  }
});
it("exports upward-facing roof surfaces rather than invisible backfaces", () => {
  const mesh = gltf.meshes.find((m: { name: string }) => m.name === "roof_0");
  const primitive = mesh.primitives.find(
    (p: { material: number }) =>
      gltf.materials[p.material].name === "Blue ceramic",
  );
  const accessor = gltf.accessors[primitive.attributes.NORMAL],
    view = gltf.bufferViews[accessor.bufferView];
  let y = 0;
  for (let i = 0; i < accessor.count; i++)
    y += binary.readFloatLE(
      start +
        (view.byteOffset ?? 0) +
        (accessor.byteOffset ?? 0) +
        i * (view.byteStride ?? 12) +
        4,
    );
  expect(y / accessor.count).toBeGreaterThan(0.4);
});
