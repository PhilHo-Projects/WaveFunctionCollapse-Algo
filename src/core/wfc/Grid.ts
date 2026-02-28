import { Cell } from './Cell';

export class Grid {
    width: number;
    height: number;
    cells: Cell[];

    constructor(width: number, height: number, totalTiles: number) {
        this.width = width;
        this.height = height;
        this.cells = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                this.cells.push(new Cell(x, y, totalTiles));
            }
        }
    }

    get(x: number, y: number): Cell | undefined {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return undefined;
        return this.cells[y * this.width + x];
    }

    get isFullyCollapsed(): boolean {
        return this.cells.every((c) => c.collapsed);
    }

    get collapsedCount(): number {
        let n = 0;
        for (const c of this.cells) if (c.collapsed) n++;
        return n;
    }

    reset(totalTiles: number) {
        for (const c of this.cells) c.reset(totalTiles);
    }
}
