import type {
    TopologyCell,
    TopologyGrid,
    TopologyNeighborDirection,
} from './TopologyDeformedQuadGrid.js';
import type { TopologyBuilderState } from './TopologyBuilder.js';

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export interface MeshBatchData {
    positions: number[];
    uvs: number[];
    indices: number[];
}

export interface WaterFaceDebug {
    cellId: number;
    positions: [Vec3, Vec3, Vec3, Vec3];
}

export interface RoofTopFaceDebug {
    cellId: number;
    height: number;
    positions: [Vec3, Vec3, Vec3, Vec3];
    center: Vec3;
    exposedEdges: TopologyNeighborDirection[];
}

export interface VerticalFaceDebug {
    cellId: number;
    edge: TopologyNeighborDirection;
    kind: 'wall' | 'roof-side';
    fromHeight: number;
    toHeight: number;
    positions: [Vec3, Vec3, Vec3, Vec3];
}

export interface ResolvedTopologyGeometry {
    water: MeshBatchData;
    wall: MeshBatchData;
    roof: MeshBatchData;
    debug: {
        waterFaces: WaterFaceDebug[];
        roofTopFaces: RoofTopFaceDebug[];
        wallFaces: VerticalFaceDebug[];
        roofSideFaces: VerticalFaceDebug[];
    };
}

export const LEVEL_HEIGHT = 1.1;
export const ROOF_BAND_HEIGHT = 0.22;

const ROOF_CENTER_LIFT_MIN = 0.02;
const ROOF_CENTER_LIFT_MAX = 0.18;
const UV_SCALE = 0.42;

const DIRECTIONS: TopologyNeighborDirection[] = ['north', 'east', 'south', 'west'];

const createBatch = (): MeshBatchData => ({
    positions: [],
    uvs: [],
    indices: [],
});

const cloneVec3 = (point: Vec3): Vec3 => ({ x: point.x, y: point.y, z: point.z });

const averageVec3 = (points: Vec3[]): Vec3 => {
    const total = points.reduce(
        (acc, point) => {
            acc.x += point.x;
            acc.y += point.y;
            acc.z += point.z;
            return acc;
        },
        { x: 0, y: 0, z: 0 }
    );

    return {
        x: total.x / points.length,
        y: total.y / points.length,
        z: total.z / points.length,
    };
};

const pushVertex = (batch: MeshBatchData, point: Vec3, uvX: number, uvY: number) => {
    batch.positions.push(point.x, point.y, point.z);
    batch.uvs.push(uvX, uvY);
    return batch.positions.length / 3 - 1;
};

const pushTriangle = (
    batch: MeshBatchData,
    a: Vec3,
    b: Vec3,
    c: Vec3,
    uvA: [number, number],
    uvB: [number, number],
    uvC: [number, number]
) => {
    const startIndex = batch.positions.length / 3;
    pushVertex(batch, a, uvA[0], uvA[1]);
    pushVertex(batch, b, uvB[0], uvB[1]);
    pushVertex(batch, c, uvC[0], uvC[1]);
    batch.indices.push(startIndex, startIndex + 1, startIndex + 2);
};

const addTopQuad = (batch: MeshBatchData, corners: [Vec3, Vec3, Vec3, Vec3], center: Vec3) => {
    const orderedCorners: [Vec3, Vec3, Vec3, Vec3] = [corners[0], corners[3], corners[2], corners[1]];
    const orderedUvs = orderedCorners.map((point) => [point.x * UV_SCALE, point.z * UV_SCALE] as [number, number]);
    const centerUv: [number, number] = [center.x * UV_SCALE, center.z * UV_SCALE];

    pushTriangle(batch, orderedCorners[0], orderedCorners[1], center, orderedUvs[0], orderedUvs[1], centerUv);
    pushTriangle(batch, orderedCorners[1], orderedCorners[2], center, orderedUvs[1], orderedUvs[2], centerUv);
    pushTriangle(batch, orderedCorners[2], orderedCorners[3], center, orderedUvs[2], orderedUvs[3], centerUv);
    pushTriangle(batch, orderedCorners[3], orderedCorners[0], center, orderedUvs[3], orderedUvs[0], centerUv);
};

const addQuad = (
    batch: MeshBatchData,
    a: Vec3,
    b: Vec3,
    c: Vec3,
    d: Vec3,
    uvs: [[number, number], [number, number], [number, number], [number, number]]
) => {
    pushTriangle(batch, a, b, c, uvs[0], uvs[1], uvs[2]);
    pushTriangle(batch, a, c, d, uvs[0], uvs[2], uvs[3]);
};

const addVerticalQuad = (
    batch: MeshBatchData,
    direction: TopologyNeighborDirection,
    bottomA: Vec3,
    bottomB: Vec3,
    topA: Vec3,
    topB: Vec3
) => {
    const edgeLength = Math.hypot(topB.x - topA.x, topB.z - topA.z);
    const minY = Math.min(bottomA.y, bottomB.y);
    const maxY = Math.max(topA.y, topB.y);
    const uvs: [[number, number], [number, number], [number, number], [number, number]] = [
        [0, minY * UV_SCALE],
        [edgeLength * UV_SCALE, minY * UV_SCALE],
        [edgeLength * UV_SCALE, maxY * UV_SCALE],
        [0, maxY * UV_SCALE],
    ];

    if (direction === 'north' || direction === 'east') {
        addQuad(batch, bottomA, topA, topB, bottomB, uvs);
        return;
    }

    addQuad(batch, bottomA, bottomB, topB, topA, uvs);
};

const getCellCornerPositions = (
    grid: TopologyGrid,
    cell: TopologyCell,
    y: number
): [Vec3, Vec3, Vec3, Vec3] => {
    const [nw, ne, se, sw] = cell.vertexIds.map((vertexId) => grid.vertices[vertexId]);
    return [
        { x: nw.x, y, z: nw.z },
        { x: ne.x, y, z: ne.z },
        { x: se.x, y, z: se.z },
        { x: sw.x, y, z: sw.z },
    ];
};

const getNeighborHeight = (
    grid: TopologyGrid,
    columnHeights: number[],
    cell: TopologyCell,
    direction: TopologyNeighborDirection
) => {
    const neighborId = cell.neighbors[direction];
    return neighborId === null ? 0 : columnHeights[neighborId] ?? 0;
};

const getEdgePoints = (
    corners: [Vec3, Vec3, Vec3, Vec3],
    direction: TopologyNeighborDirection
): [Vec3, Vec3] => {
    switch (direction) {
        case 'north':
            return [corners[0], corners[1]];
        case 'east':
            return [corners[1], corners[2]];
        case 'south':
            return [corners[3], corners[2]];
        case 'west':
            return [corners[0], corners[3]];
    }
};

export const resolveTopologyGeometry = (
    state: TopologyBuilderState
): ResolvedTopologyGeometry => {
    const { grid, columnHeights } = state;
    const water = createBatch();
    const wall = createBatch();
    const roof = createBatch();
    const waterFaces: WaterFaceDebug[] = [];
    const roofTopFaces: RoofTopFaceDebug[] = [];
    const wallFaces: VerticalFaceDebug[] = [];
    const roofSideFaces: VerticalFaceDebug[] = [];

    grid.cells.forEach((cell) => {
        const height = columnHeights[cell.id] ?? 0;
        if (height === 0) {
            const corners = getCellCornerPositions(grid, cell, 0);
            addQuad(
                water,
                corners[0],
                corners[3],
                corners[2],
                corners[1],
                [
                    [corners[0].x * UV_SCALE, corners[0].z * UV_SCALE],
                    [corners[3].x * UV_SCALE, corners[3].z * UV_SCALE],
                    [corners[2].x * UV_SCALE, corners[2].z * UV_SCALE],
                    [corners[1].x * UV_SCALE, corners[1].z * UV_SCALE],
                ]
            );
            waterFaces.push({
                cellId: cell.id,
                positions: corners.map(cloneVec3) as [Vec3, Vec3, Vec3, Vec3],
            });
            return;
        }

        const roofTopY = height * LEVEL_HEIGHT;
        const bodyTopY = Math.max(roofTopY - ROOF_BAND_HEIGHT, 0);
        const roofCorners = getCellCornerPositions(grid, cell, roofTopY);
        const exposedEdges = DIRECTIONS.filter(
            (direction) => getNeighborHeight(grid, columnHeights, cell, direction) < height
        );
        const centerLift =
            ROOF_CENTER_LIFT_MIN +
            (ROOF_CENTER_LIFT_MAX - ROOF_CENTER_LIFT_MIN) * (exposedEdges.length / 4);
        const center = {
            ...averageVec3(roofCorners),
            y: roofTopY + centerLift,
        };

        addTopQuad(roof, roofCorners, center);
        roofTopFaces.push({
            cellId: cell.id,
            height,
            positions: roofCorners.map(cloneVec3) as [Vec3, Vec3, Vec3, Vec3],
            center: cloneVec3(center),
            exposedEdges,
        });

        DIRECTIONS.forEach((direction) => {
            const neighborHeight = getNeighborHeight(grid, columnHeights, cell, direction);
            if (neighborHeight >= height) {
                return;
            }

            const lowerTopY = neighborHeight * LEVEL_HEIGHT;
            const [roofTopA, roofTopB] = getEdgePoints(roofCorners, direction);
            const roofBottomA = { ...roofTopA, y: bodyTopY };
            const roofBottomB = { ...roofTopB, y: bodyTopY };

            addVerticalQuad(roof, direction, roofBottomA, roofBottomB, roofTopA, roofTopB);
            roofSideFaces.push({
                cellId: cell.id,
                edge: direction,
                kind: 'roof-side',
                fromHeight: bodyTopY,
                toHeight: roofTopY,
                positions: [
                    cloneVec3(roofBottomA),
                    cloneVec3(roofBottomB),
                    cloneVec3(roofTopB),
                    cloneVec3(roofTopA),
                ],
            });

            if (bodyTopY <= lowerTopY + 1e-6) {
                return;
            }

            const wallBottomCorners = getCellCornerPositions(grid, cell, lowerTopY);
            const wallTopCorners = getCellCornerPositions(grid, cell, bodyTopY);
            const [wallBottomA, wallBottomB] = getEdgePoints(wallBottomCorners, direction);
            const [wallTopA, wallTopB] = getEdgePoints(wallTopCorners, direction);

            addVerticalQuad(wall, direction, wallBottomA, wallBottomB, wallTopA, wallTopB);
            wallFaces.push({
                cellId: cell.id,
                edge: direction,
                kind: 'wall',
                fromHeight: lowerTopY,
                toHeight: bodyTopY,
                positions: [
                    cloneVec3(wallBottomA),
                    cloneVec3(wallBottomB),
                    cloneVec3(wallTopB),
                    cloneVec3(wallTopA),
                ],
            });
        });
    });

    return {
        water,
        wall,
        roof,
        debug: {
            waterFaces,
            roofTopFaces,
            wallFaces,
            roofSideFaces,
        },
    };
};
