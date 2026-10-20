import { useEffect, useState } from "react";
import { OrganicGrid } from "./OrganicGrid";
import { OrganicSolver } from "./OrganicSolver";
import { ORGANIC_TILES } from "./OrganicTiles";

function island(count: number, water: number) {
  const grid = new OrganicGrid(800, 800, count, 3, ORGANIC_TILES.length),
    solver = new OrganicSolver(grid),
    radius = 400 - (water / 100) * 350;
  for (const cell of grid.cells) {
    const noise = Math.random() * (40 + radius * 0.1) - (20 + radius * 0.05);
    if (
      Math.hypot(cell.x - 400, cell.y - 400) + noise > radius ||
      cell.x < 40 ||
      cell.x > 760 ||
      cell.y < 40 ||
      cell.y > 760
    )
      if (cell.options.has(0)) solver.userCollapse(cell, 0, true);
  }
  return { grid, solver };
}
export function useOrganicGeneration(initialCount: number) {
  const [pointCount, setPointCount] = useState(initialCount),
    [waterLevel, setWaterLevel] = useState(70);
  const [vegetation, setVegetation] = useState(50),
    [civilization, setCivilization] = useState(50),
    [clustering, setClustering] = useState(50),
    [inlandWater, setInlandWater] = useState(0),
    [beachFormation, setBeachFormation] = useState(70),
    [pathGeneration, setPathGeneration] = useState(70);
  const [world, setWorld] = useState(() => island(initialCount, 70)),
    [status, setStatus] = useState("Ready"),
    [isGenerating, setIsGenerating] = useState(false),
    [progress, setProgress] = useState(0);
  const { grid, solver } = world;
  useEffect(() => () => solver.cancelGeneration(), [solver]);
  const handleReset = (count = pointCount, water = waterLevel) => {
    solver.cancelGeneration();
    setWorld(island(count, water));
    setIsGenerating(false);
    setProgress(0);
    setStatus("Ready");
  };
  const handleGenerate = () => {
    solver.cancelGeneration();
    const next = island(pointCount, waterLevel);
    setWorld(next);
    setIsGenerating(true);
    setStatus("Synthesizing Terrain…");
    setProgress(0);
    next.solver.autoGenerate(
      {
        vegetation,
        civilization,
        clustering,
        inlandWater,
        beachFormation,
        pathGeneration,
      },
      setProgress,
      (outcome) => {
        setStatus(
          outcome === "complete"
            ? "Generation Complete!"
            : "Error: incompatible terrain constraints",
        );
        setIsGenerating(false);
      },
    );
  };
  return {
    grid,
    solver,
    pointCount,
    setPointCount,
    waterLevel,
    setWaterLevel,
    vegetation,
    setVegetation,
    civilization,
    setCivilization,
    clustering,
    setClustering,
    inlandWater,
    setInlandWater,
    beachFormation,
    setBeachFormation,
    pathGeneration,
    setPathGeneration,
    status,
    isGenerating,
    progress,
    handleReset,
    handleGenerate,
  };
}
