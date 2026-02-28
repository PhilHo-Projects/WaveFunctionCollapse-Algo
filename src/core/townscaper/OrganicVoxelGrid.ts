import { OrganicGrid } from './OrganicGrid';

/**
 * Extends the 2D OrganicGrid with a Z-axis height map.
 * This allows us to track vertical voxel stacks for the 3D Builder Mode.
 */
export class OrganicVoxelGrid {
    grid2D: OrganicGrid;

    // Maps a cell.id to its current vertical block count (height)
    // 0 = Empty Water
    // 1 = Single Block (Foundation)
    // 2 = Two Blocks High, etc.
    heightMap: Map<number, number>;

    constructor(grid2D: OrganicGrid) {
        this.grid2D = grid2D;
        this.heightMap = new Map();

        // Initialize all cells to height 0 (Water)
        for (const cell of this.grid2D.cells) {
            this.heightMap.set(cell.id, 0);
        }
    }

    getHeight(cellId: number): number {
        return this.heightMap.get(cellId) || 0;
    }

    addBlock(cellId: number) {
        const currentHeight = this.getHeight(cellId);
        this.heightMap.set(cellId, currentHeight + 1);
    }

    removeBlock(cellId: number) {
        const currentHeight = this.getHeight(cellId);
        if (currentHeight > 0) {
            this.heightMap.set(cellId, currentHeight - 1);
        }
    }

    clear() {
        for (const cell of this.grid2D.cells) {
            this.heightMap.set(cell.id, 0);
        }
    }
}
