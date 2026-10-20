import type { Category, ModuleDefinition } from "./types";
export function createCatalog(): ModuleDefinition[] {
  const modules: ModuleDefinition[] = [];
  const add = (
    family: string,
    category: Category,
    sockets: string[],
    mask = 0,
    variant = 0,
    rotation = 0,
    weight = 1,
    mesh = family,
  ) => {
    const anchors: NonNullable<ModuleDefinition["anchors"]> = [];
    if (category === "ground")
      anchors.push({ kind: "quay prop", position: [0, 0, 0] });
    if (category === "room")
      for (let face = 0; face < 4; face++)
        if (mask & (1 << face)) {
          const [x, z] = [
            [-0.33, -0.56],
            [0.56, -0.33],
            [0.33, 0.56],
            [-0.56, 0.33],
          ][face];
          anchors.push({ kind: "wall lantern", position: [x, 0.55, z], face });
        }
    modules.push({
      id: `${family}-${mask}-${variant}-${rotation}`,
      family,
      category,
      sockets: sockets as ModuleDefinition["sockets"],
      mask,
      variant,
      rotation,
      weight,
      mesh,
      anchors,
    });
  };
  add("air", "air", ["air", "air", "air", "air", "air", "air"]);
  for (const up of ["air", "floor"])
    add(
      "foundation",
      "ground",
      ["base", "base", "base", "base", "base", up],
      0,
      up === "floor" ? 1 : 0,
    );
  for (let mask = 0; mask < 16; mask++)
    for (let variant = 0; variant < 3; variant++)
      for (const top of [false, true]) {
        const walls = [0, 1, 2, 3].filter((face) => mask & (1 << face)).length;
        const profile =
          walls === 0
            ? "open bay"
            : walls === 1
              ? "wall bay"
              : walls === 2
                ? mask === 5 || mask === 10
                  ? "through bay"
                  : "corner bay"
                : walls === 3
                  ? "end bay"
                  : "enclosed bay";
        add(
          `${["lattice", "plaster", "shopfront"][variant]} ${profile}`,
          "room",
          [
            ...Array.from({ length: 4 }, (_, face) =>
              mask & (1 << face) ? "air" : "room",
            ),
            "floor",
            top ? "roofbase" : "floor",
          ],
          mask,
          variant,
          0,
          variant === 0 ? 3 : 2,
          `room_${mask}_${variant}`,
        );
      }
  // Roof ports describe real ridge cross-sections; closed eaves mate with outside air.
  const families = [
    "hip cap",
    "gable end",
    "gable run",
    "roof corner",
    "roof junction",
    "roof crossing",
  ];
  for (let mask = 0; mask < 16; mask++) {
    const degree = [0, 1, 2, 3].filter((f) => mask & (1 << f)).length;
    const family =
      degree === 0
        ? families[0]
        : degree === 1
          ? families[1]
          : degree === 2
            ? mask === 5 || mask === 10
              ? families[2]
              : families[3]
            : degree === 3
              ? families[4]
              : families[5];
    add(
      family,
      "roof",
      [
        ...Array.from({ length: 4 }, (_, f) =>
          mask & (1 << f) ? "ridge" : "air",
        ),
        "roofbase",
        "air",
      ],
      mask,
      0,
      0,
      degree === 2 ? 8 : degree === 1 ? 5 : degree === 0 ? 0.5 : 2,
      `roof_${mask}`,
    );
  }
  for (let rotation = 0; rotation < 4; rotation++) {
    add(
      "single bridge",
      "bridge",
      ["air", "air", "air", "air", "air", "air"],
      0,
      0,
      rotation,
      1,
      "bridge_single",
    );
    const mask = 1 << ((2 + rotation) % 4);
    add(
      "bridge landing",
      "bridge",
      [
        ...Array.from({ length: 4 }, (_, f) =>
          mask & (1 << f) ? "deck" : "air",
        ),
        "air",
        "air",
      ],
      mask,
      0,
      rotation,
      1,
      "bridge_end",
    );
  }
  for (let rotation = 0; rotation < 2; rotation++) {
    const mask = rotation === 0 ? 5 : 10;
    add(
      "bridge span",
      "bridge",
      [
        ...Array.from({ length: 4 }, (_, f) =>
          mask & (1 << f) ? "deck" : "air",
        ),
        "air",
        "air",
      ],
      mask,
      0,
      rotation,
      1,
      "bridge_span",
    );
  }
  return modules;
}
