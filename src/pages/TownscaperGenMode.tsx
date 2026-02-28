import { useState, useEffect } from 'react';
import { OrganicGrid } from '../core/townscaper/OrganicGrid';
import { OrganicSolver } from '../core/townscaper/OrganicSolver';
import { ORGANIC_TILES } from '../core/townscaper/OrganicTiles';
import { OrganicRenderer } from '../components/OrganicRenderer';

export default function TownscaperGenMode() {
    const [pointCount, setPointCount] = useState(1000);
    const [relaxAmount] = useState(3);
    const [waterLevel, setWaterLevel] = useState(70);
    const [vegetation, setVegetation] = useState(50);
    const [civilization, setCivilization] = useState(50);
    const [clustering, setClustering] = useState(50);
    const [inlandWater, setInlandWater] = useState(0);
    const [beachFormation, setBeachFormation] = useState(70);
    const [pathGeneration, setPathGeneration] = useState(70);
    const [grid, setGrid] = useState<OrganicGrid | null>(null);
    const [solver, setSolver] = useState<OrganicSolver | null>(null);
    const [status, setStatus] = useState('Idle');
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);

    const [tooltipInfo, setTooltipInfo] = useState<{ html: string; x: number; y: number } | null>(null);

    // Initial silent grid setup without triggering auto-generate
    useEffect(() => {
        handleReset(pointCount);
    }, []);

    const handleReset = (count = pointCount) => {
        setIsGenerating(false);
        setProgress(0);
        setStatus('Ready');

        const newGrid = new OrganicGrid(800, 800, count, relaxAmount, ORGANIC_TILES.length);
        const newSolver = new OrganicSolver(newGrid);

        // Build a strong water border with some variance to force a cohesive central island
        // 100% water level = tiny 50px island. 0% = massive 400px island spanning whole grid
        const maxRadius = 400 - (waterLevel / 100) * 350;

        newGrid.cells.forEach(cell => {
            const distFromCenter = Math.sqrt(Math.pow(cell.x - 400, 2) + Math.pow(cell.y - 400, 2));

            // Random noise to make the coastline jagged
            const noise = Math.random() * (40 + (maxRadius * 0.1)) - (20 + (maxRadius * 0.05));

            if (distFromCenter + noise > maxRadius || cell.x < 40 || cell.x > 760 || cell.y < 40 || cell.y > 760) {
                if (cell.options.has(0)) {
                    newSolver.userCollapse(cell, 0, true);
                }
            }
        });

        setGrid(newGrid);
        setSolver(newSolver);
    };

    const handleGenerate = () => {
        if (!grid || !solver) return;

        // Ensure we are operating on a fresh grid so 'Auto Generate' can be clicked multiple times
        let activeGrid = grid;
        let activeSolver = solver;

        // If the current grid is already partially or fully collapsed by a previous generation run, 
        // we must instantly reset the grid behind the scenes before triggering the new run.
        if (grid.collapsedCount > (pointCount * 0.2)) {
            activeGrid = new OrganicGrid(800, 800, pointCount, relaxAmount, ORGANIC_TILES.length);
            activeSolver = new OrganicSolver(activeGrid);

            // Re-apply the island water borders
            const maxRadius = 400 - (waterLevel / 100) * 350;
            activeGrid.cells.forEach(cell => {
                const distFromCenter = Math.sqrt(Math.pow(cell.x - 400, 2) + Math.pow(cell.y - 400, 2));
                const noise = Math.random() * (40 + (maxRadius * 0.1)) - (20 + (maxRadius * 0.05));
                if (distFromCenter + noise > maxRadius || cell.x < 40 || cell.x > 760 || cell.y < 40 || cell.y > 760) {
                    if (cell.options.has(0)) {
                        activeSolver.userCollapse(cell, 0, true);
                    }
                }
            });
            setGrid(activeGrid);
            setSolver(activeSolver);
        }

        setIsGenerating(true);
        setStatus('Synthesizing Terrain...');
        setProgress(0);

        activeSolver.autoGenerate(
            { vegetation, civilization, clustering, inlandWater, beachFormation, pathGeneration },
            (p) => setProgress(p),
            () => {
                setStatus('Generation Complete!');
                setIsGenerating(false);
            }
        );
    };

    const handleCellClick = (_id: number) => {
        // In procedural mode, clicking is disabled to prevent manual overriding during or after generation.
    };

    return (
        <>
            {/* Canvas Area (No Overlay) */}
            <section className="flex-none flex items-center justify-center relative rounded-xl w-[800px] max-w-full aspect-square overflow-hidden bg-[--bg-card]">
                <div className="w-full h-full">
                    <OrganicRenderer
                        grid={grid}
                        onCellClick={handleCellClick}
                        onHoverCell={(_cell, html, x, y) => setTooltipInfo({ html, x: x + 14, y: y + 14 })}
                        onHoverLeave={() => setTooltipInfo(null)}
                    />
                </div>
            </section>

            {tooltipInfo && (
                <div
                    className="fixed z-50 bg-[--bg-card] border border-[--border-light] rounded p-2.5 font-mono text-xs text-[--text-primary] shadow-2xl pointer-events-none backdrop-blur-md"
                    style={{ left: tooltipInfo.x, top: tooltipInfo.y }}
                    dangerouslySetInnerHTML={{ __html: tooltipInfo.html }}
                />
            )}

            <aside className="w-full md:w-[var(--panel-width)] bg-[--bg-secondary] border-l border-[--border] p-4 flex flex-col gap-3.5 overflow-y-auto max-h-[calc(100vh-80px)]">

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-3.5">
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-2.5">Procedural Controls</h2>

                    <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1.5 text-[--text-secondary]">
                            <span>Cell Density</span>
                            <span className="font-mono">{pointCount}</span>
                        </div>
                        <input
                            type="range"
                            min="200"
                            max="2000"
                            step="100"
                            value={pointCount}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setPointCount(val);
                                handleReset(val);
                            }}
                            disabled={isGenerating}
                            className="w-full h-1.5 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]"
                        />
                        <p className="text-[10px] text-[--text-muted] mt-1.5 text-right font-mono text-wrap leading-tight">
                            Warning: High cell capacities may cause temporary UI stutters.
                        </p>
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1.5 text-[--text-secondary]">
                            <span>Water Level</span>
                            <span className="font-mono">{waterLevel}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={waterLevel}
                            onChange={(e) => {
                                setWaterLevel(parseInt(e.target.value));
                                handleReset(); // Rebuild boundaries instantly
                            }}
                            disabled={isGenerating}
                            className="w-full h-1.5 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]"
                        />
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1.5 text-[--text-secondary]">
                            <span>Vegetation</span>
                            <span className="font-mono">{vegetation}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={vegetation}
                            onChange={(e) => setVegetation(parseInt(e.target.value))}
                            disabled={isGenerating}
                            className="w-full h-1.5 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]"
                        />
                    </div>

                    <div className="mb-5">
                        <div className="flex justify-between text-xs mb-1.5 text-[--text-secondary]">
                            <span>Civilization</span>
                            <span className="font-mono">{civilization}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={civilization}
                            onChange={(e) => setCivilization(parseInt(e.target.value))}
                            disabled={isGenerating}
                            className="w-full h-1.5 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]"
                        />
                    </div>

                    <details className="mb-5 group">
                        <summary className="text-[10px] font-bold text-[--accent] cursor-pointer outline-none uppercase tracking-wider mb-3 hover:text-white transition-colors">
                            Experimental Heuristics ▾
                        </summary>
                        <div className="pl-3 border-l border-[--border] space-y-4">
                            <div>
                                <div className="flex justify-between text-[10px] mb-1.5 text-[--text-secondary]">
                                    <span>Biome Clustering</span>
                                    <span className="font-mono">{clustering}%</span>
                                </div>
                                <input type="range" min="0" max="100" value={clustering} onChange={(e) => setClustering(parseInt(e.target.value))} disabled={isGenerating} className="w-full h-1 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] mb-1.5 text-[--text-secondary]">
                                    <span>Inland Water Lakes</span>
                                    <span className="font-mono">{inlandWater}%</span>
                                </div>
                                <input type="range" min="0" max="100" value={inlandWater} onChange={(e) => setInlandWater(parseInt(e.target.value))} disabled={isGenerating} className="w-full h-1 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] mb-1.5 text-[--text-secondary]">
                                    <span>Beach Formation</span>
                                    <span className="font-mono">{beachFormation}%</span>
                                </div>
                                <input type="range" min="0" max="100" value={beachFormation} onChange={(e) => setBeachFormation(parseInt(e.target.value))} disabled={isGenerating} className="w-full h-1 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] mb-1.5 text-[--text-secondary]">
                                    <span>Path Generation</span>
                                    <span className="font-mono">{pathGeneration}%</span>
                                </div>
                                <input type="range" min="0" max="100" value={pathGeneration} onChange={(e) => setPathGeneration(parseInt(e.target.value))} disabled={isGenerating} className="w-full h-1 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]" />
                            </div>
                        </div>
                    </details>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full py-3 font-mono text-sm font-semibold bg-[--accent] text-[#0b0c10] rounded-lg hover:bg-[#52ffd8] hover:shadow-[0_0_20px_rgba(100,255,218,0.4)] transition-all flex items-center justify-center gap-2"
                    >
                        {isGenerating ? 'Generating...' : '▶ Auto-Generate Island'}
                    </button>

                    {isGenerating && (
                        <div className="mt-3">
                            <div className="flex justify-between text-[10px] text-[--text-secondary] font-mono mb-1">
                                <span>Generating...</span>
                                <span>{Math.floor(progress)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-[--bg-primary] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-[--accent] transition-all duration-75"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-3.5">
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-2.5">Status</h2>
                    <div className="flex justify-between items-center py-1.5 border-b border-[--border] text-sm">
                        <span className="text-[--text-secondary]">State:</span>
                        <span className={`font-medium ${status.includes('Error') ? 'text-[--red]' : 'text-[--green]'}`}>
                            {status}
                        </span>
                    </div>
                </div>

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-3.5 bg-gradient-to-br from-[#1e2230] to-[#181a24]">
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-2.5">High Performance Core</h2>
                    <p className="text-xs text-[--text-secondary] leading-relaxed">
                        Procedural mode bypasses the Animation rendering engine. Instead, it utilizes `setTimeout` chunks to process the complex edge matrix operations as quickly as JavaScript permits without deadlocking the browser tab!
                    </p>
                </div>

            </aside>
        </>
    );
}
