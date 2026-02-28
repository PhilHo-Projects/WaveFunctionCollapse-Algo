import { useState, useEffect } from 'react';
import { OrganicGrid } from '../core/townscaper/OrganicGrid';
import { OrganicVoxelGrid } from '../core/townscaper/OrganicVoxelGrid';
import { ORGANIC_TILES } from '../core/townscaper/OrganicTiles';
import { BuilderRenderer3D } from '../components/BuilderRenderer3D';

export default function Townscaper3DBuilderLevel() {
    const [pointCount, setPointCount] = useState(400);
    const [relaxAmount] = useState(3);
    const [voxelGrid, setVoxelGrid] = useState<OrganicVoxelGrid | null>(null);

    // Initialize the empty flat grid on mount
    useEffect(() => {
        handleReset(pointCount);
    }, []);

    const handleReset = (count = pointCount) => {
        const newGrid = new OrganicGrid(800, 800, count, relaxAmount, ORGANIC_TILES.length);
        const newVoxelGrid = new OrganicVoxelGrid(newGrid);
        setVoxelGrid(newVoxelGrid);
    };

    const handleCellClick = (cellId: number, type: 'build' | 'destroy') => {
        if (!voxelGrid) return;

        // Clone the grid object to force a React re-render 
        // (React-Three-Fiber needs a new object reference to trigger useMemo updates)
        const updatedVoxelGrid = new OrganicVoxelGrid(voxelGrid.grid2D);

        // Copy existing heightmap
        voxelGrid.heightMap.forEach((height, id) => {
            updatedVoxelGrid.heightMap.set(id, height);
        });

        // Apply new block
        if (type === 'build') {
            updatedVoxelGrid.addBlock(cellId);
        } else {
            updatedVoxelGrid.removeBlock(cellId);
        }

        setVoxelGrid(updatedVoxelGrid);
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 h-full max-h-[800px] w-full max-w-[1200px] mx-auto">

            {/* 3D Canvas Area */}
            <section className="flex-none flex items-center justify-center relative rounded-xl w-[800px] max-w-full aspect-square bg-[#0b0c10] border-2 border-[--border] shadow-[0_0_30px_rgba(100,255,218,0.05)] overflow-hidden">
                <BuilderRenderer3D voxelGrid={voxelGrid} onCellClick={handleCellClick} />
            </section>

            {/* Sidebar Controls */}
            <section className="flex-1 flex flex-col gap-5 min-w-[300px] h-[800px] overflow-y-auto pr-2 custom-scrollbar">

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-5 shadow-lg">
                    <h3 className="text-xs font-bold text-[--text-muted] uppercase tracking-widest mb-4">3D Voxel Builder</h3>

                    <div className="mb-6">
                        <div className="flex justify-between text-xs mb-1.5 text-[--text-secondary]">
                            <span>Foundation Density (Grid Size)</span>
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
                            className="w-full h-1.5 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]"
                        />
                    </div>

                    <button
                        onClick={() => handleReset()}
                        className="w-full py-3 font-mono text-sm font-semibold border border-[--border] text-[--text-primary] rounded-lg hover:bg-[--bg-secondary] hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                        🗑️ Clear Island
                    </button>

                </div>

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-4 shadow-lg border-l-4 border-l-[#52ffd8]">
                    <h3 className="text-[10px] font-bold text-[#52ffd8] uppercase tracking-widest mb-2">How to Build</h3>
                    <p className="text-xs text-[--text-secondary] leading-relaxed">
                        Unlike the automated Procedural generator, this mode gives you full control. It uses the same mathematical <strong>Wave Function Collapse</strong> polygons, but stacks them vertically into 3D Voxels.
                        <br /><br />
                        <span className="text-white">Left Click</span> anywhere on the water to spawn a foundation block. Click the top of a block to build upwards.
                    </p>
                </div>
            </section>
        </div>
    );
}
