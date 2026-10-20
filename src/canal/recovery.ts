import type { ModuleDefinition, SolverProblem } from "./types";
export function recoveryProblem(): SolverProblem {
  const modules: ModuleDefinition[] = ["Indigo", "Cedar", "Jade"].map(
    (name, i) => ({
      id: name,
      family: name,
      mesh: "roof_0",
      category: "roof",
      sockets: [
        `${i}`,
        `${i}`,
        `${i === 0 ? 1 : i === 1 ? 0 : 2}`,
        `${i}`,
        `${i}`,
        `${i}`,
      ],
      weight: i === 2 ? 1 : 100,
      mask: 0,
      variant: 0,
      rotation: 0,
    }),
  );
  return {
    modules,
    links: [0, 1, 2].map((i) => [
      { to: (i + 1) % 3, face: 0, otherFace: 2 },
      { to: (i + 2) % 3, face: 2, otherFace: 0 },
    ]),
    domains: [
      [0, 1, 2],
      [0, 1, 2],
      [0, 1, 2],
    ],
    seed: "recovery",
  };
}
