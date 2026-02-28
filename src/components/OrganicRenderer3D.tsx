import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { OrganicGrid } from '../core/townscaper/OrganicGrid';
import { ORGANIC_TILES } from '../core/townscaper/OrganicTiles';



const TILE_DEPTHS: Record<number, number> = {
    0: 0.2,  // Water
    1: 0.3,  // Sand
    2: 0.5,  // Grass
    3: 0.7,  // Rock
    4: 1.2,  // Wood
    5: 2.5,  // Brick (tall)
    6: 1.0,  // Roof
    7: 0.4,  // Cobblestone
};

const TILE_ELEVATIONS: Record<number, number> = {
    0: 0.0,
    1: 0.1,
    2: 0.1,
    3: 0.1,
    4: 0.2,
    5: 0.2, // Base of the brick
    6: 2.7, // Roof sits on top of brick (2.5 + 0.2)
    7: 0.2,
};

import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const TileGroup: React.FC<{ grid: OrganicGrid | null, isGenerating: boolean }> = ({ grid, isGenerating }) => {
    const [geometries, setGeometries] = React.useState<(THREE.BufferGeometry | null)[]>(Array(8).fill(null));

    React.useEffect(() => {
        if (!grid || isGenerating) return;

        const newGeometries: (THREE.BufferGeometry | null)[] = Array(8).fill(null);
        const geometriesByTile: THREE.BufferGeometry[][] = Array.from({ length: 8 }, () => []);
        const scale = 0.05;

        for (const cell of grid.cells) {
            if (!cell.collapsed) continue;
            const tileId = Array.from(cell.options)[0];
            if (tileId === undefined || tileId === -1 || !ORGANIC_TILES[tileId]) continue;

            const shape = new THREE.Shape();
            const poly = cell.polygon;

            shape.moveTo((poly[0][0] - 400) * scale, -(poly[0][1] - 400) * scale);
            for (let i = 1; i < poly.length; i++) {
                shape.lineTo((poly[i][0] - 400) * scale, -(poly[i][1] - 400) * scale);
            }

            const depth = TILE_DEPTHS[tileId] || 1;
            const elevation = TILE_ELEVATIONS[tileId] || 0;

            const geom = new THREE.ExtrudeGeometry(shape, {
                depth: depth,
                bevelEnabled: false,
                curveSegments: 1,
                steps: 1
            });

            geom.translate(0, 0, elevation);
            geometriesByTile[tileId].push(geom);
        }

        for (let i = 0; i < 8; i++) {
            if (geometriesByTile[i].length > 0) {
                newGeometries[i] = mergeGeometries(geometriesByTile[i], false);
            }
            // Dispose intermediate geometries directly out of memory
            geometriesByTile[i].forEach(g => g.dispose());
        }

        setGeometries(prev => {
            // Explicitly dispose old WebGL BufferGeometries to prevent GPU Memory Leaks
            prev.forEach(g => {
                if (g) g.dispose();
            });
            return newGeometries;
        });

        // Cleanup on unmount
        return () => {
            newGeometries.forEach(g => g && g.dispose());
        };

    }, [grid, isGenerating]);

    return (
        <group rotation={[-Math.PI / 2, 0, 0]}>
            {geometries.map((geom, idx) => {
                if (!geom) return null;
                const tile = ORGANIC_TILES[idx];
                return (
                    <mesh key={idx} geometry={geom}>
                        <meshStandardMaterial color={tile.color} roughness={0.8} />
                    </mesh>
                );
            })}
        </group>
    );
};

export const OrganicRenderer3D: React.FC<{ grid: OrganicGrid | null, isGenerating: boolean }> = ({ grid, isGenerating }) => {
    const [isDragging, setIsDragging] = useState(false);

    return (
        <div className="absolute inset-0 z-0 bg-[#0b0c10] overflow-hidden" style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
            <Canvas
                style={{ width: '100%', height: '100%', display: 'block', minHeight: '800px', minWidth: '800px' }}
                camera={{ position: [0, 30, 40], fov: 45 }}
            >
                <color attach="background" args={['#0f172a']} />

                <ambientLight intensity={0.6} />
                <directionalLight position={[20, 40, 20]} intensity={1.5} />

                <TileGroup grid={grid} isGenerating={isGenerating} />

                <OrbitControls
                    makeDefault
                    minPolarAngle={0}
                    maxPolarAngle={Math.PI / 2 - 0.05} // Prevent camera going below floor
                    autoRotate={true}
                    autoRotateSpeed={0.5}
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
