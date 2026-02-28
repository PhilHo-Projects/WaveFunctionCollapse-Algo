import React, { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { OrganicVoxelGrid } from '../core/townscaper/OrganicVoxelGrid';
import type { OrganicCell } from '../core/townscaper/OrganicGrid';

// Simple colors for our interactive voxels
const COLOR_FOUNDATION = '#ffffff'; // White blocks like Townscaper
const COLOR_ROOF = '#d16245';       // Red terracotta roofs

interface BuilderRendererProps {
    voxelGrid: OrganicVoxelGrid | null;
    onCellClick: (cellId: number, type: 'build' | 'destroy') => void;
}

const VOXEL_DEPTH = 1.0;

// Inner component to handle WebGL logic so Canvas works correctly
const InteractiveScene: React.FC<BuilderRendererProps> = ({ voxelGrid, onCellClick }) => {

    // 1. Raycast Catchers (Invisble Water Planes)
    // We generate a flat plane for every cell in the 2D grid so the user can click them.
    const waterPlanes = useMemo(() => {
        if (!voxelGrid) return null;
        const scale = 0.05;

        return voxelGrid.grid2D.cells.map(cell => {
            const shape = new THREE.Shape();
            const poly = cell.polygon;

            shape.moveTo((poly[0][0] - 400) * scale, -(poly[0][1] - 400) * scale);
            for (let i = 1; i < poly.length; i++) {
                shape.lineTo((poly[i][0] - 400) * scale, -(poly[i][1] - 400) * scale);
            }

            // A perfectly flat ShapeGeometry to catch clicks on the "Water"
            const geometry = new THREE.ShapeGeometry(shape);

            return (
                <mesh
                    key={`water-${cell.id}`}
                    geometry={geometry}
                    position={[0, 0, 0]}
                    onClick={(e) => {
                        e.stopPropagation(); // Stop raycast from hitting things behind this
                        onCellClick(cell.id, 'build');
                    }}
                    onContextMenu={(e) => {
                        e.stopPropagation();
                        // Ignore right clicks on flat water (nothing to destroy)
                    }}
                >
                    {/* Make it slightly transparent blue so we can see the grid layout */}
                    <meshBasicMaterial color="#1e3a8a" opacity={0.3} transparent side={THREE.DoubleSide} />
                </mesh>
            );
        });

    }, [voxelGrid, onCellClick]);

    // 2. The Buildings (Solid Voxels)
    // We mathematically merge all walls on the same Z layer into one giant smooth mesh.
    // We merge all roofs into another mesh.
    const [wallGeometry, roofGeometry] = useMemo(() => {
        if (!voxelGrid) return [null, null];
        const scale = 0.05;

        const wallGeoms: THREE.BufferGeometry[] = [];
        const roofGeoms: THREE.BufferGeometry[] = [];

        voxelGrid.grid2D.cells.forEach(cell => {
            const height = voxelGrid.heightMap.get(cell.id) || 0;
            if (height === 0) return; // Empty water

            const shape = new THREE.Shape();
            const poly = cell.polygon;

            shape.moveTo((poly[0][0] - 400) * scale, -(poly[0][1] - 400) * scale);
            for (let i = 1; i < poly.length; i++) {
                shape.lineTo((poly[i][0] - 400) * scale, -(poly[i][1] - 400) * scale);
            }

            // Create Wall Extrusions for every layer EXCEPT the top
            for (let z = 0; z < height - 1; z++) {
                const geom = new THREE.ExtrudeGeometry(shape, { depth: VOXEL_DEPTH, bevelEnabled: false, curveSegments: 1, steps: 1 });
                geom.translate(0, 0, z * VOXEL_DEPTH);
                wallGeoms.push(geom);
            }

            // The TOP block gets a Roof Extrusion
            const topZ = (height - 1) * VOXEL_DEPTH;
            const roofGeom = new THREE.ExtrudeGeometry(shape, { depth: VOXEL_DEPTH, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.2, bevelThickness: 0.2, curveSegments: 1, steps: 1 });
            roofGeom.translate(0, 0, topZ);
            roofGeoms.push(roofGeom);
        });

        // Merge to prevent GPU crash
        const mergedWalls = wallGeoms.length > 0 ? mergeGeometries(wallGeoms, false) : null;
        const mergedRoofs = roofGeoms.length > 0 ? mergeGeometries(roofGeoms, false) : null;

        // Cleanup intermediate geometries
        wallGeoms.forEach(g => g.dispose());
        roofGeoms.forEach(g => g.dispose());

        return [mergedWalls, mergedRoofs];

    }, [voxelGrid, voxelGrid?.heightMap]); // Re-calculate when the heightMap changes


    return (
        <group rotation={[-Math.PI / 2, 0, 0]}>
            {/* The Invisible Click Grid */}
            {waterPlanes}

            {/* The Rendered Buildings */}
            {wallGeometry && (
                <mesh geometry={wallGeometry}>
                    <meshStandardMaterial color={COLOR_FOUNDATION} roughness={0.9} />
                </mesh>
            )}

            {roofGeometry && (
                <mesh geometry={roofGeometry}>
                    <meshStandardMaterial color={COLOR_ROOF} roughness={0.7} />
                </mesh>
            )}
        </group>
    );
};

export const BuilderRenderer3D: React.FC<BuilderRendererProps> = ({ voxelGrid, onCellClick }) => {
    const [isDragging, setIsDragging] = useState(false);

    if (!voxelGrid) return null;

    // Custom 3D isometric block cursor to impress the user, hotspot at (16,9) where the neon dot is.
    const cursorSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M16 2 L30 9 L16 16 L2 9 Z" fill="%23ffffff" stroke="%230b0c10" stroke-width="1.5" stroke-linejoin="round"/><path d="M2 9 L16 16 L16 30 L2 23 Z" fill="%23e2e8f0" stroke="%230b0c10" stroke-width="1.5" stroke-linejoin="round"/><path d="M30 9 L16 16 L16 30 L30 23 Z" fill="%23cbd5e1" stroke="%230b0c10" stroke-width="1.5" stroke-linejoin="round"/><circle cx="16" cy="9" r="2.5" fill="%2352ffd8" stroke="%230b0c10" stroke-width="1"/></svg>`;
    const cursorStyle = isDragging ? 'grabbing' : `url('${cursorSvg}') 16 9, pointer`;

    return (
        <div
            className="absolute inset-0 z-0 bg-[#0b0c10] overflow-hidden"
            style={{ cursor: cursorStyle }}
        >
            <Canvas
                style={{ width: '100%', height: '100%', display: 'block', minHeight: '800px', minWidth: '800px' }}
                camera={{ position: [0, 30, 40], fov: 45 }}
            >
                <color attach="background" args={['#0f172a']} />
                <ambientLight intensity={0.7} />
                <directionalLight position={[20, 40, 20]} intensity={1.5} />

                <InteractiveScene voxelGrid={voxelGrid} onCellClick={onCellClick} />

                <OrbitControls
                    makeDefault
                    minPolarAngle={0}
                    maxPolarAngle={Math.PI / 2 - 0.05} // No looking from underneath
                    mouseButtons={{
                        LEFT: undefined, // Free up left click for interaction mode
                        MIDDLE: THREE.MOUSE.DOLLY,
                        RIGHT: THREE.MOUSE.ROTATE
                    }}
                    onStart={() => setIsDragging(true)}
                    onEnd={() => setIsDragging(false)}
                />
            </Canvas>
        </div>
    );
};
