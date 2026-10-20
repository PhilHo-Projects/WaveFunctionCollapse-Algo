import assert from 'node:assert/strict';
import {
    applyTopologyEdit,
    createTopologyBuilderState,
    type TopologyBuilderState,
} from '../src/core/TopologyBuilder.js';
import {
    LEVEL_HEIGHT,
    ROOF_BAND_HEIGHT,
    resolveTopologyGeometry,
    type Vec3,
} from '../src/core/TopologyMeshResolver.js';

const makeState = (resolution = 2) =>
    createTopologyBuilderState({
        resolution,
        distortion: 0,
        seed: 12345,
    });

const withHeights = (state: TopologyBuilderState, heights: number[]) => ({
    ...state,
    columnHeights: heights,
});

const expectVec3Close = (actual: Vec3, expected: Vec3, epsilon = 1e-6) => {
    assert.ok(Math.abs(actual.x - expected.x) < epsilon, `x mismatch ${actual.x} vs ${expected.x}`);
    assert.ok(Math.abs(actual.y - expected.y) < epsilon, `y mismatch ${actual.y} vs ${expected.y}`);
    assert.ok(Math.abs(actual.z - expected.z) < epsilon, `z mismatch ${actual.z} vs ${expected.z}`);
};

const cases: Array<{ name: string; run: () => void }> = [
    {
        name: 'isolated block resolves four wall faces and four roof fascia faces',
        run: () => {
            const resolved = resolveTopologyGeometry(withHeights(makeState(), [1, 0, 0, 0]));

            assert.equal(resolved.debug.roofTopFaces.length, 1);
            assert.equal(resolved.debug.wallFaces.length, 4);
            assert.equal(resolved.debug.roofSideFaces.length, 4);
        },
    },
    {
        name: 'same-height neighbors remove internal wall faces and share top-edge vertices',
        run: () => {
            const resolved = resolveTopologyGeometry(withHeights(makeState(), [1, 1, 0, 0]));

            assert.equal(resolved.debug.wallFaces.length, 6);
            assert.equal(resolved.debug.roofSideFaces.length, 6);
            assert.equal(resolved.debug.wallFaces.find((face) => face.cellId === 0 && face.edge === 'east'), undefined);
            assert.equal(resolved.debug.wallFaces.find((face) => face.cellId === 1 && face.edge === 'west'), undefined);

            const cell0Roof = resolved.debug.roofTopFaces.find((face) => face.cellId === 0);
            const cell1Roof = resolved.debug.roofTopFaces.find((face) => face.cellId === 1);
            assert.ok(cell0Roof);
            assert.ok(cell1Roof);

            expectVec3Close(cell0Roof.positions[1], cell1Roof.positions[0]);
            expectVec3Close(cell0Roof.positions[2], cell1Roof.positions[3]);
        },
    },
    {
        name: '2x2 plateau only emits outer perimeter faces',
        run: () => {
            const resolved = resolveTopologyGeometry(withHeights(makeState(), [1, 1, 1, 1]));

            assert.equal(resolved.debug.wallFaces.length, 8);
            assert.equal(resolved.debug.roofSideFaces.length, 8);
            assert.equal(resolved.debug.roofTopFaces.length, 4);
        },
    },
    {
        name: 'stacked column stays a single continuous shell instead of per-level walls',
        run: () => {
            const resolved = resolveTopologyGeometry(withHeights(makeState(), [3, 0, 0, 0]));

            assert.equal(resolved.debug.wallFaces.length, 4);
            assert.equal(resolved.debug.roofSideFaces.length, 4);
            resolved.debug.wallFaces.forEach((face) => {
                assert.equal(face.fromHeight, 0);
                assert.equal(face.toHeight, 3 * LEVEL_HEIGHT - ROOF_BAND_HEIGHT);
            });
        },
    },
    {
        name: 'terrace step emits an exposed wall only on the higher column',
        run: () => {
            const resolved = resolveTopologyGeometry(withHeights(makeState(), [2, 1, 0, 0]));

            const higherEastFace = resolved.debug.wallFaces.find((face) => face.cellId === 0 && face.edge === 'east');
            const lowerWestFace = resolved.debug.wallFaces.find((face) => face.cellId === 1 && face.edge === 'west');

            assert.ok(higherEastFace);
            assert.equal(lowerWestFace, undefined);
            assert.equal(higherEastFace.fromHeight, 1 * LEVEL_HEIGHT);
            assert.equal(higherEastFace.toHeight, 2 * LEVEL_HEIGHT - ROOF_BAND_HEIGHT);
        },
    },
    {
        name: 'shoreline edges resolve against water neighbors inside the grid',
        run: () => {
            const state = makeState(3);
            const heights = Array(state.grid.cells.length).fill(0);
            heights[4] = 1;
            const resolved = resolveTopologyGeometry(withHeights(state, heights));

            assert.equal(resolved.debug.wallFaces.length, 4);
            assert.deepEqual(
                resolved.debug.wallFaces.map((face) => face.edge).sort(),
                ['east', 'north', 'south', 'west']
            );
        },
    },
    {
        name: 'remove-to-reresolve restores the exposed join face',
        run: () => {
            let state = makeState();
            state = applyTopologyEdit(state, 0, 'build', 100);
            state = applyTopologyEdit(state, 1, 'build', 200);

            let resolved = resolveTopologyGeometry(state);
            assert.equal(resolved.debug.wallFaces.find((face) => face.cellId === 0 && face.edge === 'east'), undefined);

            state = applyTopologyEdit(state, 1, 'remove', 300);
            resolved = resolveTopologyGeometry(state);
            assert.ok(resolved.debug.wallFaces.find((face) => face.cellId === 0 && face.edge === 'east'));
        },
    },
];

let failures = 0;

cases.forEach(({ name, run }) => {
    try {
        run();
        console.log(`PASS ${name}`);
    } catch (error) {
        failures += 1;
        console.error(`FAIL ${name}`);
        throw error;
    }
});

if (failures > 0) {
    process.exitCode = 1;
}
