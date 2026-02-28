import { Grid } from './Grid';
import { Cell } from './Cell';
import { TILES, DIRS, DIR_OFFSETS, validNeighbors } from './Tiles';

export type SolverState = 'idle' | 'observing' | 'propagating' | 'done' | 'error';

export class WFCSolver {
    grid: Grid;
    propagationStack: { x: number; y: number }[];
    state: SolverState;
    stepCount: number;
    lastCollapsed: Cell | null;
    lastPropagated: Cell[];
    retryCount: number;
    maxRetries: number;

    constructor(grid: Grid) {
        this.grid = grid;
        this.propagationStack = [];
        this.state = 'idle';
        this.stepCount = 0;
        this.lastCollapsed = null;
        this.lastPropagated = [];
        this.retryCount = 0;
        this.maxRetries = 10;
    }

    step(): SolverState {
        if (this.state === 'done' || this.state === 'error') return this.state;

        if (this.propagationStack.length > 0) {
            this._propagate();
            this.stepCount++;
            return this.state;
        }

        if (this.grid.isFullyCollapsed) {
            this.state = 'done';
            return this.state;
        }

        this._observe();
        this.stepCount++;
        return this.state;
    }

    _observe() {
        this.state = 'observing';
        this.lastPropagated = [];

        const uncollapsed = this.grid.cells.filter((c) => !c.collapsed);
        if (uncollapsed.length === 0) {
            this.state = 'done';
            return;
        }

        let minEntropy = Infinity;
        for (const c of uncollapsed) {
            if (c.entropy < minEntropy) minEntropy = c.entropy;
        }

        const candidates = uncollapsed.filter((c) => c.entropy === minEntropy);
        const cell = candidates[Math.floor(Math.random() * candidates.length)];

        if (cell.options.size === 0) {
            this._handleContradiction();
            return;
        }

        cell.collapse(TILES);
        this.lastCollapsed = cell;

        this.propagationStack.push({ x: cell.x, y: cell.y });
        this.state = 'propagating';
    }

    _propagate() {
        this.state = 'propagating';
        this.lastPropagated = [];

        const batchSize = Math.min(this.propagationStack.length, 40);

        for (let i = 0; i < batchSize; i++) {
            if (this.propagationStack.length === 0) break;
            const { x, y } = this.propagationStack.pop()!;
            const cell = this.grid.get(x, y);
            if (!cell) continue;

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
                    this._handleContradiction();
                    return;
                }

                if (neighbor.options.size < before) {
                    neighbor.flash = { type: 'propagate', timer: 1.0 };
                    this.lastPropagated.push(neighbor);
                    this.propagationStack.push({ x: neighbor.x, y: neighbor.y });

                    if (neighbor.options.size === 1) {
                        neighbor.collapsed = true;
                        neighbor.flash = { type: 'collapse', timer: 1.0 };
                    }
                }
            }
        }

        if (this.propagationStack.length === 0) {
            this.state = this.grid.isFullyCollapsed ? 'done' : 'observing';
        }
    }

    _handleContradiction() {
        this.retryCount++;
        if (this.retryCount <= this.maxRetries) {
            this.grid.reset(TILES.length);
            this.propagationStack = [];
            this.stepCount = 0;
            this.state = 'idle';
            this.lastCollapsed = null;
            this.lastPropagated = [];
        } else {
            this.state = 'error';
        }
    }
}
