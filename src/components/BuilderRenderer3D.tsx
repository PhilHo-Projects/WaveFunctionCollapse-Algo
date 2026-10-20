import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { TopologyCell, TopologyGrid } from '../core/TopologyDeformedQuadGrid';
import type { TopologyBuilderState, TopologyEditKind } from '../core/TopologyBuilder';
import { TOPOLOGY_ANIMATION_MS } from '../core/TopologyBuilder';
import {
    LEVEL_HEIGHT,
    type MeshBatchData,
    resolveTopologyGeometry,
} from '../core/TopologyMeshResolver';

interface BuilderRendererProps {
    builderState: TopologyBuilderState | null;
    onCellEdit: (cellId: number, kind: TopologyEditKind) => void;
}

const createBufferGeometry = (batch: MeshBatchData) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(batch.positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(batch.uvs, 2));
    geometry.setIndex(batch.indices);
    geometry.computeVertexNormals();
    return geometry;
};

const createCellGeometry = (grid: TopologyGrid, cell: TopologyCell) => {
    const geometry = new THREE.BufferGeometry();
    const [nw, ne, se, sw] = cell.vertexIds.map((vertexId) => grid.vertices[vertexId]);
    const positions = new Float32Array([
        nw.x, 0, nw.z,
        sw.x, 0, sw.z,
        se.x, 0, se.z,
        ne.x, 0, ne.z,
    ]);
    const uvs = new Float32Array([
        0, 0,
        0, 1,
        1, 1,
        1, 0,
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();
    return geometry;
};

const createWallTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return new THREE.Texture();
    }

    ctx.fillStyle = '#f4efe4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 320; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const width = 6 + Math.random() * 20;
        const alpha = 0.02 + Math.random() * 0.05;
        ctx.fillStyle = `rgba(148, 132, 108, ${alpha})`;
        ctx.fillRect(x, y, width, 2 + Math.random() * 3);
    }

    for (let y = 18; y < canvas.height; y += 26) {
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y + 4);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
};

const createRoofTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return new THREE.Texture();
    }

    ctx.fillStyle = '#c46346';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < 12; row++) {
        const y = row * 22;
        const offset = row % 2 === 0 ? 0 : 18;
        for (let x = -32; x < canvas.width + 32; x += 36) {
            ctx.fillStyle = 'rgba(112, 48, 32, 0.24)';
            ctx.fillRect(x + offset, y, 28, 12);
            ctx.strokeStyle = 'rgba(255, 220, 192, 0.22)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + offset, y, 28, 12);
        }
    }

    ctx.strokeStyle = 'rgba(86, 32, 20, 0.35)';
    ctx.lineWidth = 3;
    for (let y = 12; y < canvas.height; y += 22) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
};

const AnimatedWater: React.FC<{ geometry: THREE.BufferGeometry }> = ({ geometry }) => {
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    useFrame(({ clock }) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
        }
    });

    return (
        <mesh geometry={geometry} receiveShadow>
            <shaderMaterial
                ref={materialRef}
                transparent
                uniforms={{
                    uTime: { value: 0 },
                    uDeepColor: { value: new THREE.Color('#16456a') },
                    uFoamColor: { value: new THREE.Color('#7bc5d8') },
                }}
                vertexShader={`
                    uniform float uTime;
                    varying vec2 vUv;
                    varying float vWave;

                    void main() {
                        vUv = uv;
                        vec3 transformed = position;
                        float wave = sin((position.x * 0.8) + uTime * 1.3) * 0.06
                            + cos((position.z * 0.95) - uTime * 1.1) * 0.05;
                        transformed.y += wave;
                        vWave = wave;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
                    }
                `}
                fragmentShader={`
                    uniform vec3 uDeepColor;
                    uniform vec3 uFoamColor;
                    varying vec2 vUv;
                    varying float vWave;

                    void main() {
                        float ripples = 0.5 + 0.5 * sin((vUv.x + vUv.y) * 18.0 + vWave * 26.0);
                        float foam = smoothstep(0.62, 1.0, ripples) * 0.3;
                        vec3 color = mix(uDeepColor, uFoamColor, foam + max(vWave, 0.0) * 1.8);
                        gl_FragColor = vec4(color, 0.92);
                    }
                `}
            />
        </mesh>
    );
};

const CellPulse: React.FC<{
    geometry: THREE.BufferGeometry;
    height: number;
    animation: TopologyBuilderState['animations'][number];
}> = ({ geometry, height, animation }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.MeshBasicMaterial>(null);

    useFrame(() => {
        if (!meshRef.current || !materialRef.current) {
            return;
        }

        const now = performance.now();
        const elapsed = now - animation.startedAt;
        const progress = Math.min(Math.max(elapsed / TOPOLOGY_ANIMATION_MS, 0), 1);
        const pulse = Math.sin(progress * Math.PI);
        const scale = 1 + pulse * 0.045 * animation.influence;
        const rise = pulse * (animation.direction > 0 ? 0.2 : 0.12) * animation.influence;

        meshRef.current.scale.set(scale, 1, scale);
        meshRef.current.position.y = height * LEVEL_HEIGHT + 0.05 + rise;
        materialRef.current.opacity = (1 - progress) * 0.28 * animation.influence;
    });

    return (
        <mesh ref={meshRef} geometry={geometry}>
            <meshBasicMaterial
                ref={materialRef}
                color={animation.direction > 0 ? '#ffd3a6' : '#9adcf5'}
                transparent
                opacity={0}
                depthWrite={false}
            />
        </mesh>
    );
};

const InteractiveScene: React.FC<BuilderRendererProps> = ({ builderState, onCellEdit }) => {
    const pointerStart = useRef<{ x: number; y: number; cell: number; button: number } | null>(null);
    const textures = useMemo(() => ({
        wall: createWallTexture(),
        roof: createRoofTexture(),
    }), []);

    useEffect(() => () => {
        textures.wall.dispose();
        textures.roof.dispose();
    }, [textures]);

    const sceneData = useMemo(() => {
        if (!builderState) {
            return null;
        }

        const resolved = resolveTopologyGeometry(builderState);
        const waterGeometry = createBufferGeometry(resolved.water);
        const wallGeometry = createBufferGeometry(resolved.wall);
        const roofGeometry = createBufferGeometry(resolved.roof);
        const hitGeometries = builderState.grid.cells.map((cell) => createCellGeometry(builderState.grid, cell));

        return {
            waterGeometry,
            wallGeometry,
            roofGeometry,
            hitGeometries,
        };
    }, [builderState]);

    useEffect(() => () => {
        if (!sceneData) {
            return;
        }

        sceneData.waterGeometry.dispose();
        sceneData.wallGeometry.dispose();
        sceneData.roofGeometry.dispose();
        sceneData.hitGeometries.forEach((geometry) => geometry.dispose());
    }, [sceneData]);

    if (!builderState || !sceneData) {
        return null;
    }

    const activeAnimations = Object.entries(builderState.animations).filter(
        ([, animation]) => animation !== undefined
    );

    return (
        <>
            <fog attach="fog" args={['#092032', 20, 44]} />
            <AnimatedWater geometry={sceneData.waterGeometry} />

            <mesh geometry={sceneData.wallGeometry} castShadow receiveShadow>
                <meshStandardMaterial
                    color="#f6efe3"
                    map={textures.wall}
                    roughness={0.92}
                    metalness={0.02}
                />
            </mesh>

            <mesh geometry={sceneData.roofGeometry} castShadow receiveShadow>
                <meshStandardMaterial
                    color="#cf6b49"
                    map={textures.roof}
                    roughness={0.82}
                    metalness={0.03}
                />
            </mesh>

            {builderState.grid.cells.map((cell, cellId) => {
                const topY = builderState.columnHeights[cellId] * LEVEL_HEIGHT + 0.06;
                return (
                    <mesh
                        key={`hit-${cellId}`}
                        geometry={sceneData.hitGeometries[cellId]}
                        position={[0, topY, 0]}
                        visible={false}
                        onPointerDown={(event) => {
                            event.stopPropagation();
                            if (event.button !== 0 && event.button !== 2) return;
                            pointerStart.current = {x: event.clientX, y: event.clientY, cell: cellId, button: event.button};
                        }}
                        onPointerUp={(event) => {
                            const start = pointerStart.current;
                            pointerStart.current = null;
                            if (!start || start.cell !== cellId || Math.hypot(event.clientX-start.x,event.clientY-start.y) > 5) return;
                            event.stopPropagation();
                            onCellEdit(cellId, start.button === 2 ? 'remove' : 'build');
                        }}
                        onContextMenu={(event) => {
                            event.stopPropagation();
                        }}
                    >
                        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
                    </mesh>
                );
            })}

            {activeAnimations.map(([cellId, animation]) => (
                <CellPulse
                    key={`pulse-${cellId}-${animation.startedAt}`}
                    geometry={sceneData.hitGeometries[Number(cellId)]}
                    height={builderState.columnHeights[Number(cellId)]}
                    animation={animation}
                />
            ))}
        </>
    );
};

export const BuilderRenderer3D: React.FC<BuilderRendererProps> = ({ builderState, onCellEdit }) => {
    const [isDragging, setIsDragging] = useState(false);

    if (!builderState) {
        return null;
    }

    const cursorSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34"><path d="M17 3 L31 10 L17 17 L3 10 Z" fill="%23fff2db" stroke="%23091d2e" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 10 L17 17 L17 31 L3 24 Z" fill="%23f4e1ba" stroke="%23091d2e" stroke-width="1.6" stroke-linejoin="round"/><path d="M31 10 L17 17 L17 31 L31 24 Z" fill="%23d7aa73" stroke="%23091d2e" stroke-width="1.6" stroke-linejoin="round"/><circle cx="17" cy="10" r="2.7" fill="%23ff7d4f" stroke="%23091d2e" stroke-width="1"/></svg>`;
    const cursorStyle = isDragging ? 'grabbing' : `url('${cursorSvg}') 17 10, pointer`;

    return (
        <div
            className="absolute inset-0 z-0 overflow-hidden"
            style={{ cursor: cursorStyle }}
            onContextMenu={(event) => event.preventDefault()}
        >
            <Canvas
                shadows
                style={{ width: '100%', height: '100%', display: 'block', minHeight: '800px', minWidth: '800px' }}
                camera={{ position: [18, 19, 18], fov: 42, near: 0.1, far: 100 }}
            >
                <color attach="background" args={['#081521']} />
                <ambientLight intensity={0.45} />
                <hemisphereLight intensity={0.55} color="#bfdfff" groundColor="#0b1e26" />
                <directionalLight
                    castShadow
                    position={[14, 24, 12]}
                    intensity={1.35}
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                    shadow-camera-near={1}
                    shadow-camera-far={60}
                    shadow-camera-left={-20}
                    shadow-camera-right={20}
                    shadow-camera-top={20}
                    shadow-camera-bottom={-20}
                />

                <InteractiveScene builderState={builderState} onCellEdit={onCellEdit} />

                <OrbitControls
                    makeDefault
                    target={[0, 2, 0]}
                    minDistance={10}
                    maxDistance={36}
                    minPolarAngle={0.35}
                    maxPolarAngle={Math.PI / 2.05}
                    mouseButtons={{
                        LEFT: undefined,
                        MIDDLE: THREE.MOUSE.DOLLY,
                        RIGHT: THREE.MOUSE.ROTATE,
                    }}
                    onStart={() => setIsDragging(true)}
                    onEnd={() => setIsDragging(false)}
                />
            </Canvas>
        </div>
    );
};
