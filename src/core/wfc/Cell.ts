import { animate } from 'animejs';

export interface Sockets {
    north: number;
    east: number;
    south: number;
    west: number;
}

export interface Tile {
    id: number;
    name: string;
    sockets: Sockets;
    draw: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => void;
    weight: number;
    baseTerrainId: number | null;
}

export type FlashAnimation = { type: 'collapse' | 'propagate' | 'error'; timer: number } | null;

export class Cell {
    x: number;
    y: number;
    collapsed: boolean;
    options: Set<number>;
    flash: FlashAnimation;

    // Visual presentation state (driven by Anime.js)
    renderScale: number;
    renderXOffset: number;
    renderYOffset: number;
    isAnimating: boolean;

    constructor(x: number, y: number, totalTiles: number) {
        this.x = x;
        this.y = y;
        this.collapsed = false;
        this.options = new Set();
        for (let i = 0; i < totalTiles; i++) this.options.add(i);
        this.flash = null;
        this.renderScale = 1.0;
        this.renderXOffset = 0.0;
        this.renderYOffset = 0.0;
        this.isAnimating = false;
    }

    get entropy(): number {
        return this.collapsed ? Infinity : this.options.size;
    }

    collapse(tiles: Tile[]): number {
        const arr = Array.from(this.options);
        const totalWeight = arr.reduce((sum, idx) => sum + tiles[idx].weight, 0);
        let r = Math.random() * totalWeight;
        let pick = arr[0];
        for (const idx of arr) {
            r -= tiles[idx].weight;
            if (r <= 0) {
                pick = idx;
                break;
            }
        }
        this.options = new Set([pick]);
        this.collapsed = true;
        this.flash = { type: 'collapse', timer: 1.0 };

        this.isAnimating = true;
        animate(this, {
            renderScale: [0, 1.2, 1],
            renderYOffset: [-10, 0],
            duration: 600,
            ease: 'outElastic(1, .5)',
            onComplete: () => { this.isAnimating = false; }
        });

        return pick;
    }

    forceCollapse(pick: number): number {
        this.options = new Set([pick]);
        this.collapsed = true;
        this.flash = { type: 'collapse', timer: 1.0 };

        this.isAnimating = true;
        animate(this, {
            renderScale: [0, 1.2, 1],
            renderYOffset: [-10, 0],
            duration: 600,
            ease: 'outElastic(1, .5)',
            onComplete: () => { this.isAnimating = false; }
        });

        return pick;
    }

    reset(totalTiles: number) {
        this.collapsed = false;
        this.options = new Set();
        for (let i = 0; i < totalTiles; i++) this.options.add(i);
        this.flash = null;
        this.renderScale = 1.0;
        this.renderXOffset = 0.0;
        this.renderYOffset = 0.0;
        this.isAnimating = false;
    }

    animateHover(isHovering: boolean) {
        if (this.collapsed) return;
        this.isAnimating = true;
        animate(this, {
            renderScale: isHovering ? 1.08 : 1.0,
            duration: isHovering ? 200 : 300,
            ease: 'outQuad',
            onComplete: () => { this.isAnimating = false; }
        });
    }

    shake() {
        this.flash = { type: 'error', timer: 1.0 };
        this.isAnimating = true;
        animate(this, {
            renderXOffset: [-6, 6, -4, 4, -2, 2, 0],
            duration: 400,
            ease: 'outQuad',
            onComplete: () => { this.isAnimating = false; }
        });
    }
}
