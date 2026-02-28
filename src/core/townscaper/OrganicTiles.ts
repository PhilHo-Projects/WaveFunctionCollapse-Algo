export interface OrganicTile {
    id: number;
    name: string;
    color: string;
    allowedNeighbors: number[];
    draw: (ctx: CanvasRenderingContext2D, polygon: [number, number][]) => void;
    weight: number;
}

const colors = {
    0: '#4090cc', // Water
    1: '#e8cfa6', // Sand
    2: '#58c478', // Grass
    3: '#8c8c9e', // Rock
    4: '#b58e60', // Wood Floor
    5: '#a34844', // Brick Wall
    6: '#d16245', // Tile Roof
    7: '#6a6b75', // Cobblestone Path
};

const drawSolid = (color: string) => (ctx: CanvasRenderingContext2D, polygon: [number, number][]) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(polygon[0][0], polygon[0][1]);
    for (let j = 1; j < polygon.length; j++) {
        ctx.lineTo(polygon[j][0], polygon[j][1]);
    }
    ctx.closePath();
    ctx.fill();

    // Outer Bevel for organic feel
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
};

export const ORGANIC_TILES: OrganicTile[] = [
    // Environment
    { id: 0, name: 'Water', color: colors[0], allowedNeighbors: [0, 1, 3], draw: drawSolid(colors[0]), weight: 3 },
    { id: 1, name: 'Sand', color: colors[1], allowedNeighbors: [0, 1, 2, 3, 4, 7], draw: drawSolid(colors[1]), weight: 2 },
    { id: 2, name: 'Grass', color: colors[2], allowedNeighbors: [1, 2, 3, 4, 5, 7], draw: drawSolid(colors[2]), weight: 4 },
    { id: 3, name: 'Rock', color: colors[3], allowedNeighbors: [0, 1, 2, 3, 5, 7], draw: drawSolid(colors[3]), weight: 2 },

    // Construction
    { id: 4, name: 'Wood', color: colors[4], allowedNeighbors: [1, 2, 4, 5, 7], draw: drawSolid(colors[4]), weight: 1 },
    { id: 5, name: 'Brick', color: colors[5], allowedNeighbors: [2, 3, 4, 5, 6, 7], draw: drawSolid(colors[5]), weight: 1 },
    { id: 6, name: 'Roof', color: colors[6], allowedNeighbors: [5, 6], draw: drawSolid(colors[6]), weight: 1 },
    { id: 7, name: 'Cobblestone', color: colors[7], allowedNeighbors: [1, 2, 3, 4, 5, 7], draw: drawSolid(colors[7]), weight: 1 },
];
