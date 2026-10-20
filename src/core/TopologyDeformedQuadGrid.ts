export type TopologyNeighborDirection = 'north' | 'east' | 'south' | 'west';

export interface TopologyVertex {
    id: number;
    x: number;
    z: number;
    cellIds: number[];
}

export interface TopologyEdge {
    id: number;
    a: number;
    b: number;
    cellIds: number[];
    orientation: 'horizontal' | 'vertical';
}

export interface TopologyCell {
    id: number;
    row: number;
    col: number;
    vertexIds: [number, number, number, number];
    edgeIds: [number, number, number, number];
    neighbors: Record<TopologyNeighborDirection, number | null>;
    center: { x: number; z: number };
}

export interface TopologyGrid {
    rows: number;
    cols: number;
    size: number;
    seed: number;
    distortion: number;
    vertices: TopologyVertex[];
    edges: TopologyEdge[];
    cells: TopologyCell[];
}

const MAX_JITTER_RATIO = 0.34;

const hash01 = (seed: number, x: number, y: number, salt: number) => {
    let value = seed ^ (x * 374761393) ^ (y * 668265263) ^ (salt * 1274126177);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    value ^= value >>> 16;
    return (value >>> 0) / 4294967295;
};

const createVertexKey = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;

export const createDeformedQuadGrid = (
    resolution: number,
    distortionPercent: number,
    seed: number,
    size = 24
): TopologyGrid => {
    const rows = resolution;
    const cols = resolution;
    const stepX = size / cols;
    const stepZ = size / rows;
    const halfSize = size / 2;
    const distortionStrength = Math.min(Math.max(distortionPercent, 0), 100) / 100;
    const jitterX = stepX * MAX_JITTER_RATIO * distortionStrength;
    const jitterZ = stepZ * MAX_JITTER_RATIO * distortionStrength;

    const vertices: TopologyVertex[] = [];
    const vertexIndex = (row: number, col: number) => row * (cols + 1) + col;

    for (let row = 0; row <= rows; row++) {
        for (let col = 0; col <= cols; col++) {
            const baseX = -halfSize + col * stepX;
            const baseZ = -halfSize + row * stepZ;
            const edgeFadeX = Math.sin((col / cols) * Math.PI);
            const edgeFadeZ = Math.sin((row / rows) * Math.PI);
            const edgeFade = edgeFadeX * edgeFadeZ;
            const offsetX = (hash01(seed, row, col, 11) * 2 - 1) * jitterX * edgeFade;
            const offsetZ = (hash01(seed, row, col, 23) * 2 - 1) * jitterZ * edgeFade;

            vertices.push({
                id: vertexIndex(row, col),
                x: baseX + offsetX,
                z: baseZ + offsetZ,
                cellIds: [],
            });
        }
    }

    const edges: TopologyEdge[] = [];
    const edgeIdsByKey = new Map<string, number>();
    const cells: TopologyCell[] = [];

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const id = row * cols + col;
            const nw = vertexIndex(row, col);
            const ne = vertexIndex(row, col + 1);
            const se = vertexIndex(row + 1, col + 1);
            const sw = vertexIndex(row + 1, col);
            const vertexIds: [number, number, number, number] = [nw, ne, se, sw];

            vertexIds.forEach((vertexId) => {
                vertices[vertexId].cellIds.push(id);
            });

            const edgePairs: Array<[number, number, 'horizontal' | 'vertical']> = [
                [nw, ne, 'horizontal'],
                [ne, se, 'vertical'],
                [sw, se, 'horizontal'],
                [nw, sw, 'vertical'],
            ];

            const edgeIds = edgePairs.map(([a, b, orientation]) => {
                const key = createVertexKey(a, b);
                const existing = edgeIdsByKey.get(key);
                if (existing !== undefined) {
                    edges[existing].cellIds.push(id);
                    return existing;
                }

                const edgeId = edges.length;
                edges.push({ id: edgeId, a, b, cellIds: [id], orientation });
                edgeIdsByKey.set(key, edgeId);
                return edgeId;
            }) as [number, number, number, number];

            const centerX =
                (vertices[nw].x + vertices[ne].x + vertices[se].x + vertices[sw].x) / 4;
            const centerZ =
                (vertices[nw].z + vertices[ne].z + vertices[se].z + vertices[sw].z) / 4;

            cells.push({
                id,
                row,
                col,
                vertexIds,
                edgeIds,
                neighbors: {
                    north: row > 0 ? (row - 1) * cols + col : null,
                    east: col < cols - 1 ? row * cols + col + 1 : null,
                    south: row < rows - 1 ? (row + 1) * cols + col : null,
                    west: col > 0 ? row * cols + col - 1 : null,
                },
                center: { x: centerX, z: centerZ },
            });
        }
    }

    return {
        rows,
        cols,
        size,
        seed,
        distortion: distortionPercent,
        vertices,
        edges,
        cells,
    };
};
