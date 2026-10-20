import { Grid } from './Grid';
import { Cell } from './Cell';
import { DIRS, DIR_OFFSETS, validNeighbors, BASE_TERRAIN_TO_TILE_IDX } from './Tiles';
import { animate } from 'animejs';

export type InteractiveSolverState = 'idle' | 'propagating' | 'error';

export class InteractiveWFCSolver {
    grid: Grid;
    propagationStack: { x: number; y: number }[];
    state: InteractiveSolverState;
    stepCount: number;

    constructor(grid: Grid) {
        this.grid = grid;
        this.propagationStack = [];
        this.state = 'idle';
        this.stepCount = 0;
    }

    userCollapse(cell: Cell, terrainId: number): boolean {
        const tileIdx = BASE_TERRAIN_TO_TILE_IDX[terrainId];

        if (!cell.options.has(tileIdx)) {
            cell.shake();
            return false;
        }

        cell.forceCollapse(tileIdx);

        this.propagationStack.push({ x: cell.x, y: cell.y });
        this.state = 'propagating';

        this._propagateAll();
        return true;
    }

    _propagateAll() {
        this.stepCount = 0;
        while (this.propagationStack.length > 0) {
            if (this.state === 'error') break;
            this._propagateStep();
            this.stepCount++;
            if (this.stepCount > 100000) {
                console.error("Propagation loop exceeded limit.");
                break;
            }
        }

        if (this.state !== 'error') {
            this.state = 'idle';
        }
    }

    _propagateStep() {
        const { x, y } = this.propagationStack.pop()!;
        const cell = this.grid.get(x, y);
        if (!cell) return;

        for (const dir of DIRS) {
            const [dx, dy] = DIR_OFFSETS[dir];
            const neighbor = this.grid.get(x + dx, y + dy);
            if (!neighbor || neighbor.collapsed) continue;

            const allowed = new Set<number>();
            for (const optIdx of cell.options) {
                for (const nIdx of validNeighbors[optIdx][dir]) {
                    allowed.add(nIdx);
                }
            }

            const before = neighbor.options.size;
            const newOptions = new Set<number>();
            for (const idx of neighbor.options) {
                if (allowed.has(idx)) newOptions.add(idx);
            }
            neighbor.options = newOptions;

            if (neighbor.options.size === 0) {
                this.state = 'error';
                neighbor.flash = { type: 'error', timer: 1.0 };
                console.error("Contradiction reached at", neighbor.x, neighbor.y);
                return;
            }

            if (neighbor.options.size < before) {
                neighbor.flash = { type: 'propagate', timer: 0.5 };

                neighbor.isAnimating = true;
                animate(neighbor, {
                    renderScale: [1.1, 1.0],
                    duration: 300,
                    ease: 'outQuad',
                    onComplete: () => { neighbor.isAnimating = false; }
                });

                this.propagationStack.push({ x: neighbor.x, y: neighbor.y });

                if (neighbor.options.size === 1) {
                    neighbor.collapsed = true;
                    neighbor.flash = { type: 'collapse', timer: 0.8 };

                    neighbor.isAnimating = true;
                    animate(neighbor, {
                        renderScale: [0, 1.2, 1],
                        renderYOffset: [-10, 0],
                        duration: 600,
                        ease: 'outElastic(1, .5)',
                        onComplete: () => { neighbor.isAnimating = false; }
                    });
                }
            }
        }
    }
}
