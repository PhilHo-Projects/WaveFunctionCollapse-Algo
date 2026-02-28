import React, { useState, useEffect } from 'react';
import { OrganicGrid } from '../core/townscaper/OrganicGrid';
import { OrganicSolver } from '../core/townscaper/OrganicSolver';
import { ORGANIC_TILES } from '../core/townscaper/OrganicTiles';
import { OrganicRenderer } from '../components/OrganicRenderer';

export default function TownscaperMode() {
    const [pointCount, setPointCount] = useState(1000);
    const [relaxAmount, setRelaxAmount] = useState(3);
    const [selectedToolId, setSelectedToolId] = useState(2); // Grass
    const [grid, setGrid] = useState<OrganicGrid | null>(null);
    const [solver, setSolver] = useState<OrganicSolver | null>(null);
    const [status, setStatus] = useState('Generating Grid...');
    const [collapsedCount, setCollapsedCount] = useState(0);

    const [tooltipInfo, setTooltipInfo] = useState<{ html: string; x: number; y: number } | null>(null);

    useEffect(() => {
        handleReset();
    }, [pointCount, relaxAmount]);

    const handleReset = () => {
        setStatus('Generating Grid...');
        // Small timeout to allow React to render "Generating"
        setTimeout(() => {
            const newGrid = new OrganicGrid(800, 800, pointCount, relaxAmount, ORGANIC_TILES.length);
            const newSolver = new OrganicSolver(newGrid);

            // Auto-collapse edges to Deep Water to create an island effect!
            newGrid.cells.forEach(cell => {
                // The grid is 800x800, so edge bounds remain similar but denser
                if (cell.x < 30 || cell.x > 770 || cell.y < 30 || cell.y > 770) {
                    if (cell.options.has(0)) {
                        newSolver.userCollapse(cell, 0);
                    }
                }
            });

            setGrid(newGrid);
            setSolver(newSolver);
            updateStatus(newGrid, newSolver);
        }, 10);
    };

    const updateStatus = (g: OrganicGrid, s: OrganicSolver) => {
        const stateMap: Record<string, string> = {
            idle: 'Ready to build',
            propagating: 'Propagating…',
            error: '✗ Contradiction Reached',
        };
        setStatus(stateMap[s.state] || s.state);
        setCollapsedCount(g.collapsedCount);
    };

    const handleCellClick = (id: number) => {
        if (!grid || !solver || solver.state === 'error') return;
        const cell = grid.cells[id];
        if (cell && !cell.collapsed) {
            const success = solver.userCollapse(cell, selectedToolId);
            if (success) {
                updateStatus(grid, solver);
            }
        }
    };

    return (
        <>
            <OrganicRenderer
                grid={grid}
                selectedToolId={selectedToolId}
                onCellClick={handleCellClick}
                onHoverCell={(cell, html, x, y) => setTooltipInfo({ html, x: x + 14, y: y + 14 })}
                onHoverLeave={() => setTooltipInfo(null)}
            />

            {tooltipInfo && (
                <div
                    className="fixed z-50 bg-[--bg-card] border border-[--border-light] rounded p-2.5 font-mono text-xs text-[--text-primary] shadow-2xl pointer-events-none backdrop-blur-md"
                    style={{ left: tooltipInfo.x, top: tooltipInfo.y }}
                    dangerouslySetInnerHTML={{ __html: tooltipInfo.html }}
                />
            )}

            <aside className="w-full md:w-[var(--panel-width)] bg-[--bg-secondary] border-l border-[--border] p-4 flex flex-col gap-3.5 overflow-y-auto max-h-[calc(100vh-80px)]">

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-3.5">
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-2.5">Organic Tools</h2>
                    <div className="flex flex-col gap-2">
                        {ORGANIC_TILES.map(tool => (
                            <button
                                key={tool.id}
                                onClick={() => setSelectedToolId(tool.id)}
                                className={`flex items-center gap-3 w-full p-2.5 text-sm font-medium rounded-lg border transition-all ${selectedToolId === tool.id
                                    ? 'bg-[--accent-dim] border-[--accent] text-[--accent] shadow-[0_0_0_1px_var(--accent)]'
                                    : 'bg-[--bg-primary] border-[--border] text-[--text-primary] hover:bg-[--bg-card-hover] hover:border-[--border-light]'
                                    }`}
                            >
                                <div className="w-4 h-4 rounded border border-white/15 shrink-0" style={{ background: tool.color }} />
                                {tool.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-3.5">
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-2.5">Status</h2>
                    <div className="flex justify-between items-center py-1.5 border-b border-[--border] text-sm">
                        <span className="text-[--text-secondary]">State:</span>
                        <span className={`font-medium ${status.includes('✗') ? 'text-[--red]' : 'text-[--green]'}`}>
                            {status}
                        </span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 text-sm">
                        <span className="text-[--text-secondary]">Placed:</span>
                        <span className="font-mono text-[--text-primary]">{collapsedCount} / {pointCount}</span>
                    </div>
                </div>

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-3.5">
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-2.5">Actions</h2>
                    <button onClick={handleReset} className="w-full py-2.5 font-mono text-xs font-medium bg-[--bg-primary] border border-[--border-light] text-[--text-primary] rounded-lg hover:bg-[--bg-card-hover] hover:border-[--accent] hover:text-[--accent] transition-all">
                        ↺ Re-Roll Organic Grid
                    </button>
                </div>

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-3.5 bg-gradient-to-br from-[#1e2230] to-[#181a24]">
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-2.5">Townscaper Details</h2>
                    <p className="text-xs text-[--text-secondary] leading-relaxed">
                        This mode generates an irregular <em>Relaxed Voronoi</em> graph.<br /><br />
                        Because polygons share raw sequential edges rather than strict N/E/S/W "sockets", the WFC uses a universal adjacency matrix resulting in fluid, organic island growth!
                    </p>
                </div>

            </aside>
        </>
    );
}
