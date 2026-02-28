import React, { useState, useEffect } from 'react';
import { Grid } from '../core/wfc/Grid';
import { InteractiveWFCSolver } from '../core/wfc/InteractiveWFCSolver';
import { TILES, TERRAIN_COLORS } from '../core/wfc/Tiles';
import { CanvasRenderer } from '../components/CanvasRenderer';

export default function BuilderMode() {
    const [gridSize, setGridSize] = useState(15);
    const [selectedToolId, setSelectedToolId] = useState(2); // Default Grass
    const [grid, setGrid] = useState<Grid | null>(null);
    const [solver, setSolver] = useState<InteractiveWFCSolver | null>(null);
    const [status, setStatus] = useState('Ready to build');
    const [collapsedCount, setCollapsedCount] = useState(0);
    const [stepCount, setStepCount] = useState(0);

    const [tooltipInfo, setTooltipInfo] = useState<{ html: string; x: number; y: number } | null>(null);

    useEffect(() => {
        const newGrid = new Grid(gridSize, gridSize, TILES.length);
        const newSolver = new InteractiveWFCSolver(newGrid);
        setGrid(newGrid);
        setSolver(newSolver);
        updateStatus(newGrid, newSolver);
        setStepCount(0); // Reset total steps
    }, [gridSize]);

    const updateStatus = (g: Grid, s: InteractiveWFCSolver) => {
        const stateMap: Record<string, string> = {
            idle: 'Ready to build',
            propagating: 'Propagating…',
            error: '✗ Contradiction Reached',
        };
        setStatus(stateMap[s.state] || s.state);
        setCollapsedCount(g.collapsedCount);
        // Accumulate step count in builder mode correctly
        setStepCount(prev => prev + s.stepCount);
    };

    const handleCellClick = (x: number, y: number) => {
        if (!grid || !solver || solver.state === 'error') return;
        const cell = grid.get(x, y);
        if (cell && !cell.collapsed) {
            solver.stepCount = 0; // reset local solver step count for this click burst
            const success = solver.userCollapse(cell, selectedToolId);
            if (success) {
                updateStatus(grid, solver);
            }
        }
    };

    const handleReset = () => {
        const newGrid = new Grid(gridSize, gridSize, TILES.length);
        const newSolver = new InteractiveWFCSolver(newGrid);
        setGrid(newGrid);
        setSolver(newSolver);
        setStepCount(0);
        updateStatus(newGrid, newSolver);
    };

    const tools = [
        { id: 0, name: 'Water', color: TERRAIN_COLORS[0] },
        { id: 1, name: 'Sand', color: TERRAIN_COLORS[1] },
        { id: 2, name: 'Grass', color: TERRAIN_COLORS[2] },
        { id: 3, name: 'Forest', color: TERRAIN_COLORS[3] },
        { id: 4, name: 'Mountain', color: TERRAIN_COLORS[4] },
    ];

    return (
        <>
            <CanvasRenderer
                grid={grid}
                isBuilderMode={true}
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
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-2.5">Paint Tools</h2>
                    <div className="flex flex-col gap-2">
                        {tools.map(tool => (
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
                    <div className="flex justify-between items-center py-1.5 border-b border-[--border] text-sm">
                        <span className="text-[--text-secondary]">Placed:</span>
                        <span className="font-mono text-[--text-primary]">{collapsedCount} / {gridSize * gridSize}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 text-sm">
                        <span className="text-[--text-secondary]">Propagations:</span>
                        <span className="font-mono text-[--text-primary]">{stepCount}</span>
                    </div>
                </div>

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-3.5">
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-2.5">Actions</h2>
                    <button onClick={handleReset} className="w-full py-2.5 font-mono text-xs font-medium bg-[--bg-primary] border border-[--border-light] text-[--text-primary] rounded-lg hover:bg-[--bg-card-hover] hover:border-[--accent] hover:text-[--accent] transition-all">
                        ↺ Clear Grid
                    </button>
                </div>

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-3.5">
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-2.5">Grid Size</h2>
                    <div className="flex flex-wrap gap-1.5">
                        {[10, 15, 20, 30].map(size => (
                            <button
                                key={size}
                                onClick={() => setGridSize(size)}
                                className={`flex-1 min-w-[30%] py-2 px-1 font-mono text-xs font-medium border rounded-lg transition-all ${gridSize === size
                                        ? 'bg-[--accent-dim] border-[--accent] text-[--accent]'
                                        : 'bg-[--bg-primary] border-[--border-light] text-[--text-primary] hover:bg-[--bg-card-hover] hover:border-[--accent] hover:text-[--accent]'
                                    }`}
                            >
                                {size}×{size}
                            </button>
                        ))}
                    </div>
                </div>
            </aside>
        </>
    );
}
