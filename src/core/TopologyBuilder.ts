import {
    createDeformedQuadGrid,
    type TopologyGrid,
    type TopologyNeighborDirection,
} from './TopologyDeformedQuadGrid.js';

export const TOPOLOGY_MAX_HEIGHT = 8;
export const TOPOLOGY_ANIMATION_MS = 520;

export type TopologyEditKind = 'build' | 'remove';

export interface TopologyCellAnimation {
    startedAt: number;
    direction: 1 | -1;
    influence: number;
}

export interface TopologyBuilderState {
    grid: TopologyGrid;
    columnHeights: number[];
    maxHeight: number;
    resolution: number;
    distortion: number;
    seed: number;
    animations: Record<number, TopologyCellAnimation>;
}

export interface TopologyBuilderOptions {
    resolution: number;
    distortion: number;
    seed: number;
    maxHeight?: number;
}

const cleanupAnimations = (
    animations: Record<number, TopologyCellAnimation>,
    now: number
) => {
    const next: Record<number, TopologyCellAnimation> = {};

    Object.entries(animations).forEach(([cellId, animation]) => {
        if (now - animation.startedAt < TOPOLOGY_ANIMATION_MS) {
            next[Number(cellId)] = animation;
        }
    });

    return next;
};

const getNeighborIds = (
    grid: TopologyGrid,
    cellId: number
) => {
    const cell = grid.cells[cellId];
    const directions: TopologyNeighborDirection[] = ['north', 'east', 'south', 'west'];
    return directions
        .map((direction) => cell.neighbors[direction])
        .filter((neighborId): neighborId is number => neighborId !== null);
};

export const createTopologyBuilderState = ({
    resolution,
    distortion,
    seed,
    maxHeight = TOPOLOGY_MAX_HEIGHT,
}: TopologyBuilderOptions): TopologyBuilderState => {
    const grid = createDeformedQuadGrid(resolution, distortion, seed);

    return {
        grid,
        columnHeights: Array(grid.cells.length).fill(0),
        maxHeight,
        resolution,
        distortion,
        seed,
        animations: {},
    };
};

export const clearTopologyBuilder = (
    state: TopologyBuilderState
): TopologyBuilderState => ({
    ...state,
    columnHeights: state.columnHeights.map(() => 0),
    animations: {},
});

export const applyTopologyEdit = (
    state: TopologyBuilderState,
    cellId: number,
    kind: TopologyEditKind,
    now: number
): TopologyBuilderState => {
    const currentHeight = state.columnHeights[cellId] ?? 0;
    const nextHeight =
        kind === 'build'
            ? Math.min(state.maxHeight, currentHeight + 1)
            : Math.max(0, currentHeight - 1);

    if (nextHeight === currentHeight) {
        return {
            ...state,
            animations: cleanupAnimations(state.animations, now),
        };
    }

    const columnHeights = [...state.columnHeights];
    columnHeights[cellId] = nextHeight;

    const animations = cleanupAnimations(state.animations, now);
    const affectedIds = [cellId, ...getNeighborIds(state.grid, cellId)];

    affectedIds.forEach((affectedId, index) => {
        animations[affectedId] = {
            startedAt: now,
            direction: kind === 'build' ? 1 : -1,
            influence: index === 0 ? 1 : 0.58,
        };
    });

    return {
        ...state,
        columnHeights,
        animations,
    };
};

export const countOccupiedColumns = (state: TopologyBuilderState) =>
    state.columnHeights.filter((height) => height > 0).length;

export const getMaxUsedHeight = (state: TopologyBuilderState) =>
    state.columnHeights.reduce((maxHeight, height) => Math.max(maxHeight, height), 0);
