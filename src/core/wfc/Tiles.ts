import type { Tile, Sockets } from './Cell';

// ── Drawing helpers ──────────────────────────
export function drawWater(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
    ctx.fillStyle = '#3478b2';
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = '#4090cc';
    ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
    ctx.strokeStyle = 'rgba(200,230,255,0.2)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
        const wy = y + (s / 4) * i;
        ctx.beginPath();
        ctx.moveTo(x + 3, wy);
        ctx.quadraticCurveTo(x + s * 0.3, wy - 2.5, x + s * 0.5, wy);
        ctx.quadraticCurveTo(x + s * 0.7, wy + 2.5, x + s - 3, wy);
        ctx.stroke();
    }
}

export function drawSand(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
    ctx.fillStyle = '#c6a84b';
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = '#dbbf66';
    ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
    ctx.fillStyle = 'rgba(160,130,60,0.35)';
    const seed = ((x * 7 + y * 13) & 0xffff) % 97;
    for (let i = 0; i < 5; i++) {
        const dx = ((seed + i * 17) % (s - 6)) + 3;
        const dy = ((seed + i * 23) % (s - 6)) + 3;
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, 1, 0, Math.PI * 2);
        ctx.fill();
    }
}

export function drawGrass(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
    ctx.fillStyle = '#3fa85e';
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = '#58c478';
    ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
    ctx.strokeStyle = 'rgba(30,80,40,0.3)';
    ctx.lineWidth = 1;
    const seed = ((x * 11 + y * 7) & 0xffff) % 97;
    for (let i = 0; i < 4; i++) {
        const bx = x + ((seed + i * 19) % (s - 8)) + 4;
        const by = y + s - 5;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (i % 2 === 0 ? 2 : -2), by - 5);
        ctx.stroke();
    }
}

export function drawForest(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
    ctx.fillStyle = '#1b5e35';
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = '#236b40';
    ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
    const cx = x + s / 2;
    ctx.fillStyle = '#2d8c52';
    ctx.beginPath();
    ctx.moveTo(cx, y + 4);
    ctx.lineTo(cx + s * 0.3, y + s - 7);
    ctx.lineTo(cx - s * 0.3, y + s - 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4a3020';
    ctx.fillRect(cx - 1.5, y + s - 7, 3, 4);
}

export function drawMountain(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
    ctx.fillStyle = '#5a5a6e';
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = '#6a6a7e';
    ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
    const cx = x + s * 0.5;
    ctx.fillStyle = '#7e7e90';
    ctx.beginPath();
    ctx.moveTo(cx, y + 3);
    ctx.lineTo(cx + s * 0.36, y + s - 4);
    ctx.lineTo(cx - s * 0.36, y + s - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c8c8d8';
    ctx.beginPath();
    ctx.moveTo(cx, y + 3);
    ctx.lineTo(cx + s * 0.11, y + s * 0.28);
    ctx.lineTo(cx - s * 0.11, y + s * 0.28);
    ctx.closePath();
    ctx.fill();
}

function makeTransitionDraw(color1: string, color2: string, gradDir: 'h' | 'v') {
    return function (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
        let grad;
        if (gradDir === 'h') {
            grad = ctx.createLinearGradient(x, y, x + s, y);
        } else {
            grad = ctx.createLinearGradient(x, y, x, y + s);
        }
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, s, s);
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        if (gradDir === 'h') {
            ctx.beginPath();
            ctx.moveTo(x + s * 0.5, y);
            ctx.lineTo(x + s * 0.5, y + s);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(x, y + s * 0.5);
            ctx.lineTo(x + s, y + s * 0.5);
            ctx.stroke();
        }
    };
}

export const TERRAIN_COLORS: Record<number, string> = {
    0: '#4090cc', // water
    1: '#dbbf66', // sand
    2: '#58c478', // grass
    3: '#236b40', // forest
    4: '#6a6a7e', // mountain
};

export const TERRAIN_NAMES: Record<number, string> = {
    0: 'Water',
    1: 'Sand',
    2: 'Grass',
    3: 'Forest',
    4: 'Mountain',
};

const TERRAIN_DRAWS: Record<number, Tile['draw']> = {
    0: drawWater,
    1: drawSand,
    2: drawGrass,
    3: drawForest,
    4: drawMountain,
};

export const TILES: Tile[] = [];
export const BASE_TERRAIN_TO_TILE_IDX: Record<number, number> = {};

let tileId = 0;
function addTile(name: string, sockets: Sockets, drawFn: Tile['draw'], weight = 1, baseTerrainId: number | null = null) {
    TILES.push({ id: tileId++, name, sockets, draw: drawFn, weight, baseTerrainId });
}

for (let t = 0; t <= 4; t++) {
    BASE_TERRAIN_TO_TILE_IDX[t] = tileId;
    addTile(TERRAIN_NAMES[t], { north: t, east: t, south: t, west: t }, TERRAIN_DRAWS[t], 3, t);
}

const TRANSITIONS = [
    [0, 1], // water ↔ sand
    [1, 2], // sand  ↔ grass
    [2, 3], // grass ↔ forest
    [3, 4], // forest ↔ mountain
];

for (const [a, b] of TRANSITIONS) {
    const nameAB = `${TERRAIN_NAMES[a]}→${TERRAIN_NAMES[b]}`;
    const cA = TERRAIN_COLORS[a];
    const cB = TERRAIN_COLORS[b];

    addTile(nameAB, { north: a, east: b, south: a, west: a }, makeTransitionDraw(cA, cB, 'h'), 1);
    addTile(nameAB, { north: b, east: b, south: b, west: a }, makeTransitionDraw(cA, cB, 'h'), 1);
    addTile(nameAB, { north: a, east: a, south: a, west: b }, makeTransitionDraw(cB, cA, 'h'), 1);
    addTile(nameAB, { north: b, east: a, south: b, west: b }, makeTransitionDraw(cB, cA, 'h'), 1);

    addTile(nameAB, { north: a, east: a, south: b, west: a }, makeTransitionDraw(cA, cB, 'v'), 1);
    addTile(nameAB, { north: a, east: b, south: b, west: b }, makeTransitionDraw(cA, cB, 'v'), 1);
    addTile(nameAB, { north: b, east: a, south: a, west: a }, makeTransitionDraw(cB, cA, 'v'), 1);
    addTile(nameAB, { north: b, east: b, south: a, west: b }, makeTransitionDraw(cB, cA, 'v'), 1);
}

export const OPPOSITE: Record<keyof Sockets, keyof Sockets> = { north: 'south', south: 'north', east: 'west', west: 'east' };
export const DIRS = ['north', 'east', 'south', 'west'] as const;
export const DIR_OFFSETS: Record<string, [number, number]> = {
    north: [0, -1],
    east: [1, 0],
    south: [0, 1],
    west: [-1, 0],
};

export const validNeighbors = TILES.map((tile) => {
    const map: Record<string, Set<number>> = {};
    for (const dir of DIRS) {
        map[dir] = new Set();
        const mySocket = tile.sockets[dir];
        const oppDir = OPPOSITE[dir];
        for (let j = 0; j < TILES.length; j++) {
            if (TILES[j].sockets[oppDir] === mySocket) {
                map[dir].add(j);
            }
        }
    }
    return map;
});
