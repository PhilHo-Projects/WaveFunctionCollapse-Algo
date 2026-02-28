import { useState, useEffect } from 'react';
import { OrganicGrid } from '../core/townscaper/OrganicGrid';
import { OrganicSolver } from '../core/townscaper/OrganicSolver';
import { ORGANIC_TILES } from '../core/townscaper/OrganicTiles';
import { OrganicRenderer3D } from '../components/OrganicRenderer3D';

export default function Townscaper3DProcedural() {
    const [pointCount, setPointCount] = useState(400);
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

    useEffect(() => {
        handleReset(pointCount);
    }, []);

    const handleReset = (count = pointCount) => {
        setIsGenerating(false);
        setProgress(0);
        setStatus('Ready');

        const newGrid = new OrganicGrid(800, 800, count, relaxAmount, ORGANIC_TILES.length);
        const newSolver = new OrganicSolver(newGrid);

        const maxRadius = 400 - (waterLevel / 100) * 350;

        newGrid.cells.forEach(cell => {
            const distFromCenter = Math.sqrt(Math.pow(cell.x - 400, 2) + Math.pow(cell.y - 400, 2));
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

        let activeGrid = grid;
        let activeSolver = solver;

        if (grid.collapsedCount > (pointCount * 0.2)) {
            activeGrid = new OrganicGrid(800, 800, pointCount, relaxAmount, ORGANIC_TILES.length);
            activeSolver = new OrganicSolver(activeGrid);

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
                setStatus('Generation Complete! (3D Renderer)');
                setIsGenerating(false);
            }
        );
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 h-full max-h-[800px] w-full max-w-[1200px] mx-auto">

            {/* 3D Canvas Area */}
            <section className="flex-none flex items-center justify-center relative rounded-xl w-[800px] max-w-full aspect-square bg-[#0b0c10] border-2 border-[--border] shadow-[0_0_30px_rgba(100,255,218,0.05)] overflow-hidden">
                <OrganicRenderer3D grid={grid} isGenerating={isGenerating} />
            </section>

            {/* Sidebar Controls */}
            <section className="flex-1 flex flex-col gap-5 min-w-[300px] h-[800px] overflow-y-auto pr-2 custom-scrollbar">

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-5 shadow-lg">
                    <h3 className="text-xs font-bold text-[--text-muted] uppercase tracking-widest mb-4">3D Procedural Controls</h3>

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
                            Warning: 3D geometry generation is expensive. Keep density low if lagging.
                        </p>
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1.5 text-[--text-secondary]">
                            <span>Water Level</span>
                            <span className="font-mono">{waterLevel}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={waterLevel} onChange={(e) => { setWaterLevel(parseInt(e.target.value)); handleReset(); }} disabled={isGenerating} className="w-full h-1.5 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]" />
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1.5 text-[--text-secondary]">
                            <span>Vegetation</span>
                            <span className="font-mono">{vegetation}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={vegetation} onChange={(e) => setVegetation(parseInt(e.target.value))} disabled={isGenerating} className="w-full h-1.5 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]" />
                    </div>

                    <div className="mb-5">
                        <div className="flex justify-between text-xs mb-1.5 text-[--text-secondary]">
                            <span>Civilization</span>
                            <span className="font-mono">{civilization}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={civilization} onChange={(e) => setCivilization(parseInt(e.target.value))} disabled={isGenerating} className="w-full h-1.5 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]" />
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
                        {isGenerating ? 'Generating...' : '▶ Auto-Generate 3D Island'}
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
                    <h3 className="text-[10px] font-bold text-[--text-muted] uppercase tracking-widest mb-1.5">Status</h3>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${status.includes('Error') ? 'bg-red-500' : isGenerating ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}></div>
                        <span className={`text-xs font-mono ${isGenerating ? 'text-yellow-400/90' : 'text-[--text-secondary]'}`}>{status}</span>
                    </div>
                </div>

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-4 shadow-lg border-l-4 border-l-[#d16245]">
                    <h3 className="text-[10px] font-bold text-[#d16245] uppercase tracking-widest mb-2">React Three Fiber Core</h3>
                    <p className="text-xs text-[--text-secondary] leading-relaxed">
                        Procedural 3D Mode mathematically maps the internal Wave Function Collapse topology directly to <code className="text-[#d16245] bg-[#d16245]/10 px-1 py-0.5 rounded">THREE.ExtrudeGeometry</code>. The solver engine remains 2-Dimensional, but the skin is rendered using full 3D lighting, shadows, and orbit controls.
                        <br /><br />
                        Drag the 3D canvas to <strong className="text-[--text-primary]">Rotate</strong>. Use scroll wheel to <strong className="text-[--text-primary]">Zoom</strong>.
                    </p>
                </div>
            </section>
        </div>
    );
}
