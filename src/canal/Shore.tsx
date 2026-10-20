/* eslint-disable react-hooks/immutability -- Shader uniforms are GPU resources updated by the render loop. */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { TownState } from "./types";
import type { KitPart } from "./renderGeometry";
import { warpGeometry } from "./renderGeometry";
import { shoreEdges } from "./dressing";
import { hash } from "./random";
import { animateMaterial, motionAttributes } from "./motion";
import { revealBirth } from "./reveal";
import type { RevealPlayback } from "./reveal";

export function Shore({
  state,
  kit,
  night,
  reducedMotion,
  playback,
}: {
  state: TownState;
  kit: Map<string, KitPart[]>;
  night: boolean;
  reducedMotion: boolean;
  playback: RevealPlayback;
}) {
  const waterline = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      night: { value: 0 },
      townTime: playback.clock,
    }),
    [playback],
  );
  const depthMaterial = useMemo(
    () =>
      animateMaterial(
        new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }),
        playback.clock,
      ),
    [playback],
  );
  useEffect(() => () => depthMaterial.dispose(), [depthMaterial]);
  const { batches, foam } = useMemo(() => {
    const {
      grid,
      document: { intent },
    } = state;
    const groups = new Map<
      string,
      { material: THREE.Material; geometries: THREE.BufferGeometry[] }
    >();
    const positions: number[] = [],
      uvs: number[] = [],
      births: number[] = [];
    const add = (name: string, cell: number, rotation: number) => {
      for (const part of kit.get(name) ?? []) {
        const geometry = warpGeometry(part.geometry, grid, cell, 0, rotation);
        const center = grid.cells[cell].center;
        motionAttributes(
          geometry,
          new THREE.Vector3(center.x, 0, center.z),
          revealBirth(playback.plan, cell, 1),
        );
        const group = groups.get(part.material.uuid) ?? {
          material: animateMaterial(part.material.clone(), playback.clock),
          geometries: [],
        };
        group.geometries.push(geometry);
        groups.set(part.material.uuid, group);
      }
    };
    for (const edge of shoreEdges(grid, intent)) {
      const cell = grid.cells[edge.cell];
      if (!edge.landing) {
        add("bank_edge", edge.cell, edge.face);
        if (
          !intent.heights[edge.cell] &&
          hash(`${intent.seed}:rail:${edge.cell}`) % 5 !== 0
        )
          add("railing", edge.cell, edge.face);
      }
      const a = grid.vertices[cell.vertices[edge.face]],
        b = grid.vertices[cell.vertices[(edge.face + 1) % 4]];
      const outward = new THREE.Vector2(
        (a.x + b.x) / 2 - cell.center.x,
        (a.z + b.z) / 2 - cell.center.z,
      ).normalize();
      const points = [
        [a.x, a.z],
        [b.x, b.z],
        [b.x + outward.x * 0.35, b.z + outward.y * 0.35],
        [a.x + outward.x * 0.35, a.z + outward.y * 0.35],
      ];
      const uv = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];
      for (const i of [0, 2, 1, 0, 3, 2]) {
        positions.push(points[i][0], -0.265, points[i][1]);
        uvs.push(...uv[i]);
        births.push(revealBirth(playback.plan, edge.cell, 0));
      }
    }
    const batches = [...groups].map(([key, g]) => {
      const geometry = mergeGeometries(g.geometries, false)!;
      g.geometries.forEach((part) => part.dispose());
      return { key, geometry, material: g.material };
    });
    const foam = new THREE.BufferGeometry();
    foam.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    foam.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    foam.setAttribute("townBirth", new THREE.Float32BufferAttribute(births, 1));
    return { batches, foam };
  }, [state, kit, playback]);
  useEffect(
    () => () => {
      batches.forEach((b) => {
        b.geometry.dispose();
        b.material.dispose();
      });
      foam.dispose();
    },
    [batches, foam],
  );
  useFrame(({ clock }) => {
    uniforms.time.value = reducedMotion ? 0 : clock.elapsedTime;
    uniforms.night.value = night ? 1 : 0;
  });
  return (
    <group>
      {batches.map((batch) => (
        <mesh
          key={batch.key}
          geometry={batch.geometry}
          material={batch.material}
          customDepthMaterial={depthMaterial}
          castShadow
          receiveShadow
          dispose={null}
        />
      ))}
      <mesh geometry={foam} renderOrder={2}>
        {/* A fresh material binds the new clock into Three's cached uniforms. */}
        <shaderMaterial
          key={foam.uuid}
          ref={waterline}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          vertexShader={`varying vec2 vUv; varying vec3 vWorld;varying float vReveal;attribute float townBirth;uniform float townTime; void main(){vUv=uv;vWorld=position;vReveal=smoothstep(0.,.4,townTime-townBirth);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
          fragmentShader={`uniform float time;uniform float night;varying vec2 vUv;varying vec3 vWorld;varying float vReveal;
          void main(){float wave=sin(vWorld.x*4.+vWorld.z*3.+time*.8)*.06;
          float edge=1.-smoothstep(.02,.9,vUv.y+wave);float line=exp(-pow((vUv.y-.24-wave)*17.,2.));
          gl_FragColor=vec4(mix(vec3(.69,.87,.79),vec3(.24,.45,.49),night), (edge*.24+line*.20)*(1.-night*.4)*vReveal);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`}
        />
      </mesh>
    </group>
  );
}
