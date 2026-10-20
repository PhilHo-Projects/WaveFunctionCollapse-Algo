import { useState } from 'react';
import { BuilderRenderer3D } from '../components/BuilderRenderer3D';
import {
    applyTopologyEdit,
    clearTopologyBuilder,
    countOccupiedColumns,
    createTopologyBuilderState,
    getMaxUsedHeight,
    type TopologyBuilderState,
} from '../core/TopologyBuilder';

const randomSeed = () => Math.floor(Math.random() * 1_000_000);

export default function Townscaper3DBuilderLevel() {
    const [gridResolution, setGridResolution] = useState(18);
    const [distortion, setDistortion] = useState(34);
    const [seed, setSeed] = useState(() => randomSeed());
    const [builderState, setBuilderState] = useState<TopologyBuilderState | null>(() =>
        createTopologyBuilderState({
            resolution: 18,
            distortion: 34,
            seed,
        })
    );

    const rebuild = (resolution = gridResolution, amount = distortion, nextSeed = seed) => {
        setGridResolution(resolution);
        setDistortion(amount);
        setSeed(nextSeed);
        setBuilderState(
            createTopologyBuilderState({
                resolution,
                distortion: amount,
                seed: nextSeed,
            })
        );
    };

    const handleCellEdit = (cellId: number, kind: 'build' | 'remove') => {
        setBuilderState((currentState) =>
            currentState ? applyTopologyEdit(currentState, cellId, kind, performance.now()) : currentState
        );
    };

    const occupiedCount = builderState ? countOccupiedColumns(builderState) : 0;
    const maxHeight = builderState ? getMaxUsedHeight(builderState) : 0;
    const cellCount = builderState?.grid.cells.length ?? gridResolution * gridResolution;

    return (
        <div className="flex flex-col md:flex-row gap-6 h-full max-h-[800px] w-full max-w-[1200px] mx-auto">
            <section className="flex-none flex items-center justify-center relative rounded-xl w-[800px] max-w-full aspect-square bg-[#081521] border-2 border-[--border] shadow-[0_0_34px_rgba(82,255,216,0.08)] overflow-hidden">
                <BuilderRenderer3D builderState={builderState} onCellEdit={handleCellEdit} />
            </section>

            <section className="flex-1 flex flex-col gap-5 min-w-[300px] h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-5 shadow-lg">
                    <h3 className="text-xs font-bold text-[--text-muted] uppercase tracking-widest mb-4">Topology 3D Builder</h3>

                    <div className="mb-5">
                        <div className="flex justify-between text-xs mb-1.5 text-[--text-secondary]">
                            <span>Grid Resolution</span>
                            <span className="font-mono">{gridResolution} x {gridResolution}</span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="28"
                            step="1"
                            value={gridResolution}
                            onChange={(event) => rebuild(parseInt(event.target.value))}
                            className="w-full h-1.5 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]"
                        />
                        <p className="text-[10px] text-[--text-muted] mt-1.5 text-right font-mono leading-tight">
                            Higher resolutions add more cells but make rebuilds heavier.
                        </p>
                    </div>

                    <div className="mb-6">
                        <div className="flex justify-between text-xs mb-1.5 text-[--text-secondary]">
                            <span>Distortion</span>
                            <span className="font-mono">{distortion}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="70"
                            step="1"
                            value={distortion}
                            onChange={(event) => rebuild(gridResolution, parseInt(event.target.value))}
                            className="w-full h-1.5 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => rebuild(gridResolution, distortion, randomSeed())}
                            className="py-3 font-mono text-sm font-semibold bg-[--accent] text-[#081521] rounded-lg hover:bg-[#52ffd8] hover:shadow-[0_0_20px_rgba(82,255,216,0.35)] transition-all"
                        >
                            Reroll Seed
                        </button>
                        <button
                            onClick={() => setBuilderState((state) => (state ? clearTopologyBuilder(state) : state))}
                            className="py-3 font-mono text-sm font-semibold border border-[--border] text-[--text-primary] rounded-lg hover:bg-[--bg-secondary] hover:text-white transition-all"
                        >
                            Clear Build
                        </button>
                    </div>
                </div>

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-4 shadow-lg">
                    <h3 className="text-[10px] font-bold text-[--text-muted] uppercase tracking-widest mb-2">Topology Stats</h3>
                    <div className="grid grid-cols-2 gap-3 text-xs font-mono text-[--text-secondary]">
                        <div className="rounded-md border border-[--border] bg-[--bg-secondary]/55 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-[--text-muted]">Seed</div>
                            <div className="mt-1 text-[--text-primary]">{seed}</div>
                        </div>
                        <div className="rounded-md border border-[--border] bg-[--bg-secondary]/55 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-[--text-muted]">Cells</div>
                            <div className="mt-1 text-[--text-primary]">{cellCount}</div>
                        </div>
                        <div className="rounded-md border border-[--border] bg-[--bg-secondary]/55 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-[--text-muted]">Occupied</div>
                            <div className="mt-1 text-[--text-primary]">{occupiedCount}</div>
                        </div>
                        <div className="rounded-md border border-[--border] bg-[--bg-secondary]/55 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-[--text-muted]">Peak Height</div>
                            <div className="mt-1 text-[--text-primary]">{maxHeight}</div>
                        </div>
                    </div>
                </div>

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-4 shadow-lg border-l-4 border-l-[#ff7d4f]">
                    <h3 className="text-[10px] font-bold text-[#ff7d4f] uppercase tracking-widest mb-2">How It Works</h3>
                    <p className="text-xs text-[--text-secondary] leading-relaxed">
                        This mode now builds on a deformed shared-vertex quad grid. Clicks only change column occupancy, and the scene auto-resolves connected walls, terraces, roof caps, and shore faces from topology.
                        <br /><br />
                        <span className="text-white">Left Click</span> adds one level. <span className="text-white">Right Click</span> removes one level. <span className="text-white">Right Drag</span> rotates the camera. Scroll zooms.
                    </p>
                </div>

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-4 shadow-lg border-l-4 border-l-[#52ffd8]">
                    <h3 className="text-[10px] font-bold text-[#52ffd8] uppercase tracking-widest mb-2">Current Scope</h3>
                    <p className="text-xs text-[--text-secondary] leading-relaxed">
                        V1 focuses on continuous structure: shoreline walls, terraces, flat roof caps with crown, and seamless joins between adjacent cells. Decorative props and special pieces are intentionally deferred.
                    </p>
                </div>
            </section>
        </div>
    );
}
