import React, { useState, useEffect, useRef } from 'react';
import { Grid } from '../core/wfc/Grid';
import { WFCSolver } from '../core/wfc/WFCSolver';
import { TILES } from '../core/wfc/Tiles';
import { CanvasRenderer } from '../components/CanvasRenderer';

export default function ExplainerMode() {
    const [gridSize, setGridSize] = useState(10);
    const [speed, setSpeed] = useState(200);
    const [playing, setPlaying] = useState(false);
    const [grid, setGrid] = useState<Grid | null>(null);
    const [solver, setSolver] = useState<WFCSolver | null>(null);
    const [status, setStatus] = useState('Ready');
    const [collapsedCount, setCollapsedCount] = useState(0);
    const [stepCount, setStepCount] = useState(0);

    const [tooltipInfo, setTooltipInfo] = useState<{ html: string; x: number; y: number } | null>(null);

    const playingRef = useRef(playing);
    const lastAutoStepRef = useRef(performance.now());
    const rafRef = useRef<number>();

    useEffect(() => {
        playingRef.current = playing;
    }, [playing]);

    // Init Grid
    useEffect(() => {
        const newGrid = new Grid(gridSize, gridSize, TILES.length);
        const newSolver = new WFCSolver(newGrid);
        setGrid(newGrid);
        setSolver(newSolver);
        setPlaying(false);
        updateStatus(newGrid, newSolver);
    }, [gridSize]);

    const updateStatus = (g: Grid, s: WFCSolver) => {
        const stateMap: Record<string, string> = {
            idle: 'Ready',
            observing: 'Observing…',
            propagating: 'Propagating…',
            done: '✓ Complete!',
            error: '✗ Contradiction (max retries)',
        };
        setStatus(stateMap[s.state] || s.state);
        setCollapsedCount(g.collapsedCount);
        setStepCount(s.stepCount);
        if (s.state === 'done' || s.state === 'error') {
            setPlaying(false);
        }
    };

    // Main Loop
    useEffect(() => {
        const loop = (now: number) => {
            if (playingRef.current && solver && grid) {
                if (now - lastAutoStepRef.current >= speed) {
                    solver.step();
                    updateStatus(grid, solver);
                    lastAutoStepRef.current = now;
                }
            }
            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [solver, grid, speed]);

    const handlePlay = () => {
        if (solver?.state === 'done' || solver?.state === 'error') return;
        setPlaying(!playing);
        lastAutoStepRef.current = performance.now();
    };

    const handleStep = () => {
        if (solver?.state === 'done' || solver?.state === 'error') return;
        setPlaying(false);
        solver!.step();
        updateStatus(grid!, solver!);
    };

    const handleReset = () => {
        const newGrid = new Grid(gridSize, gridSize, TILES.length);
        const newSolver = new WFCSolver(newGrid);
        setGrid(newGrid);
        setSolver(newSolver);
        setPlaying(false);
        updateStatus(newGrid, newSolver);
    };

    return (
        <>
            <CanvasRenderer
                grid={grid}
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
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-2.5">Status</h2>
                    <div className="flex justify-between items-center py-1.5 border-b border-[--border] text-sm">
                        <span className="text-[--text-secondary]">State:</span>
                        <span className={`font-medium ${status.includes('✓') ? 'text-[--green]' : status.includes('✗') ? 'text-[--red]' : 'text-[--text-primary]'}`}>
                            {status}
                        </span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-[--border] text-sm">
                        <span className="text-[--text-secondary]">Collapsed:</span>
                        <span className="font-mono text-[--text-primary]">{collapsedCount} / {gridSize * gridSize}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 text-sm">
                        <span className="text-[--text-secondary]">Step:</span>
                        <span className="font-mono text-[--text-primary]">{stepCount}</span>
                    </div>
                </div>

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-3.5">
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-2.5">Playback</h2>
                    <div className="flex gap-1.5">
                        <button
                            onClick={handlePlay}
                            className={`flex-1 py-2 px-1.5 font-mono text-xs font-medium border rounded-lg transition-all ${playing ? 'bg-[--accent-dim] border-[--accent] text-[--accent]' : 'bg-[--bg-primary] border-[--border-light] text-[--text-primary] hover:bg-[--bg-card-hover] hover:border-[--accent] hover:text-[--accent]'
                                }`}
                        >
                            {playing ? '⏸ Pause' : '▶ Play'}
                        </button>
                        <button onClick={handleStep} className="flex-1 py-2 px-1.5 font-mono text-xs font-medium bg-[--bg-primary] border border-[--border-light] text-[--text-primary] rounded-lg hover:bg-[--bg-card-hover] hover:border-[--accent] hover:text-[--accent] transition-all">⏭ Step</button>
                        <button onClick={handleReset} className="flex-1 py-2 px-1.5 font-mono text-xs font-medium bg-[--bg-primary] border border-[--border-light] text-[--text-primary] rounded-lg hover:bg-[--bg-card-hover] hover:border-[--accent] hover:text-[--accent] transition-all">↺ Reset</button>
                    </div>
                </div>

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-3.5">
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-2.5">Speed</h2>
                    <div className="flex items-center gap-2.5">
                        <span className="text-xs text-[--text-muted]">Slow</span>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            className="flex-1 h-1 bg-[--border] rounded-full appearance-none outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[--accent] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[--bg-primary]"
                            onChange={(e) => {
                                const v = parseInt(e.target.value);
                                let newSpeed = Math.round(1000 * Math.pow(0.954, v));
                                if (newSpeed < 10) newSpeed = 10;
                                setSpeed(newSpeed);
                            }}
                            defaultValue={50}
                        />
                        <span className="text-xs text-[--text-muted]">Fast</span>
                    </div>
                    <div className="text-center text-xs text-[--text-muted] mt-1 font-mono">{speed >= 1000 ? (speed / 1000).toFixed(1) + ' s' : speed + ' ms'}</div>
                </div>

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-3.5">
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-2.5">Grid Size</h2>
                    <div className="flex gap-1.5">
                        {[10, 15, 20].map(size => (
                            <button
                                key={size}
                                onClick={() => setGridSize(size)}
                                className={`flex-1 py-2 px-1.5 font-mono text-xs font-medium border rounded-lg transition-all ${gridSize === size ? 'bg-[--accent-dim] border-[--accent] text-[--accent]' : 'bg-[--bg-primary] border-[--border-light] text-[--text-primary] hover:bg-[--bg-card-hover] hover:border-[--accent] hover:text-[--accent]'
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
