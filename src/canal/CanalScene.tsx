import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { Bridge, SolverEvent, TownState } from "./types";
import { FLOOR_HEIGHT } from "./types";
import {
  makePickingGeometry,
  readKit,
  TownGeometryCache,
} from "./renderGeometry";
import { hash } from "./random";
import { warpPoint } from "./geometry";
import { createTownGrid } from "./grid";
import { createCatalog } from "./catalog";
import { CanalWater } from "./CanalWater";
import { Shore } from "./Shore";
import { SceneEffects } from "./SceneEffects";
import { RevealPlayback, revealBirth } from "./reveal";
import type { RevealPlan, RevealProgress } from "./reveal";
import { animateMaterial, instanceMotionAttributes } from "./motion";

export interface SceneProps {
  state: TownState;
  night: boolean;
  lens: boolean;
  counts?: number[];
  selected: number | null;
  bridgeStart: number | null;
  crossingPreview: Bridge | null;
  pulse: { cell: number; revision: number; failed?: boolean } | null;
  event?: SolverEvent;
  ghostMesh?: string;
  ghostLayer: number;
  ghostRotation: number;
  tool: "build" | "remove" | "bridge" | "paint";
  onPick: (cell: number, remove: boolean) => void;
  onHover: (cell: number | null) => void;
  onStats: (stats: { calls: number; triangles: number; fps: number }) => void;
  view: number;
  reducedMotion: boolean;
  presentation: { id: number; plan: RevealPlan | null };
  buildInterval: number;
  finishPresentation: number;
  revealing: boolean;
  onRevealProgress: (id: number, progress: RevealProgress) => void;
}
const KIT_URL = `${import.meta.env.BASE_URL}assets/canal-town/canal-kit.glb`;

function CameraRig({ radius, view }: { radius: number; view: number }) {
  const size = useThree((state) => state.size);
  return (
    <OrthographicCamera
      key={`${radius}:${view}`}
      makeDefault
      position={[radius * 1.7, radius * 1.45, radius * 1.8]}
      zoom={Math.min(size.width * 0.83, size.height * 1.02) / (radius * 1.65)}
      near={0.1}
      far={250}
    />
  );
}
function Stats({ report }: { report: SceneProps["onStats"] }) {
  const frames = useRef(0),
    elapsed = useRef(0);
  useFrame(({ gl }, delta) => {
    frames.current++;
    elapsed.current += delta;
    if (elapsed.current > 0.8) {
      report({
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        fps: Math.round(frames.current / elapsed.current),
      });
      frames.current = 0;
      elapsed.current = 0;
    }
  }, 2);
  return null;
}
function Architecture({
  state,
  kit,
  night,
  reducedMotion,
  lens,
  playback,
}: {
  state: TownState;
  kit: ReturnType<typeof readKit>;
  night: boolean;
  reducedMotion: boolean;
  lens: boolean;
  playback: RevealPlayback;
}) {
  const seed = state.document.intent.seed,
    size = state.document.intent.size;
  const grid = useMemo(() => createTownGrid(seed, size), [seed, size]);
  const cache = useMemo(
    () => new TownGeometryCache(kit, grid, playback.clock),
    [kit, grid, playback],
  );
  const [settled, setSettled] = useState(0);
  const batches = useMemo(() => {
    void settled;
    return cache.update(state.document, {
      time: playback.clock.value,
      animate: !reducedMotion && !lens,
      reveal: playback.plan,
      instantInitial: !playback.plan,
    });
  }, [cache, state.document, reducedMotion, lens, settled, playback]);
  useEffect(() => {
    cache.setNight(night);
  }, [cache, night, batches]);
  useEffect(() => {
    if (!cache.hasOutgoing) return;
    const timer = setTimeout(() => setSettled((v) => v + 1), 350);
    return () => clearTimeout(timer);
  }, [cache, batches]);
  useEffect(() => {
    cache.flush();
  }, [cache, batches]);
  useEffect(() => () => cache.dispose(), [cache]);
  return (
    <group>
      {batches.map((batch) => (
        <mesh
          key={batch.key}
          geometry={batch.geometry}
          material={batch.material}
          customDepthMaterial={cache.depthMaterial}
          castShadow
          receiveShadow
          dispose={null}
        />
      ))}
    </group>
  );
}
interface PropPlacement {
  matrix: THREE.Matrix4;
  cell: number;
}
function Props({
  state,
  kit,
  night,
  reducedMotion,
  playback,
}: {
  state: TownState;
  kit: ReturnType<typeof readKit>;
  night: boolean;
  reducedMotion: boolean;
  playback: RevealPlayback;
}) {
  const instances = useMemo(() => {
    const data = new Map<string, PropPlacement[]>(),
      {
        grid,
        document: { intent, assignments },
      } = state,
      modules = createCatalog();
    const push = (
      name: string,
      id: number,
      scale: number,
      y = 0,
      offset = 0,
    ) => {
      const c = grid.cells[id];
      const angle =
        (hash(`${intent.seed}:${id}:angle`) / 4294967296) * Math.PI * 2;
      const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(
          c.center.x + Math.sin(angle) * offset,
          y,
          c.center.z + Math.cos(angle) * offset,
        ),
        new THREE.Quaternion().setFromAxisAngle(
          THREE.Object3D.DEFAULT_UP,
          angle,
        ),
        new THREE.Vector3(scale, scale, scale),
      );
      data.set(name, [...(data.get(name) ?? []), { matrix, cell: id }]);
    };
    grid.cells.forEach((c) => {
      const h = hash(`${intent.seed}:${c.id}:decoration`),
        bank = c.neighbors.some((n) => n >= 0 && intent.ground[n] === "water");
      if (intent.heights[c.id]) {
        const module = modules[assignments[grid.cells.length + c.id]],
          anchors =
            module?.anchors?.filter((a) => a.kind === "wall lantern") ?? [];
        if (anchors.length && h % 3 === 0) {
          const anchor = anchors[h % anchors.length],
            position = warpPoint(
              grid,
              c.id,
              anchor.position[0],
              anchor.position[1] * FLOOR_HEIGHT,
              anchor.position[2],
            );
          const matrix = new THREE.Matrix4().compose(
            new THREE.Vector3(...position),
            new THREE.Quaternion().setFromAxisAngle(
              THREE.Object3D.DEFAULT_UP,
              (-(anchor.face ?? 0) * Math.PI) / 2,
            ),
            new THREE.Vector3(1.25, 1.25, 1.25),
          );
          data.set("lantern", [
            ...(data.get("lantern") ?? []),
            { matrix, cell: c.id },
          ]);
        }
        return;
      }
      if (
        intent.bridges.some(
          (b) => b.cells.includes(c.id) || b.anchors.includes(c.id),
        )
      )
        return;
      if (intent.ground[c.id] === "quay") {
        if (bank && h % 5 === 0) push("lantern", c.id, 1.55);
        else if (h % 9 === 0) push(h % 4 ? "willow" : "sakura", c.id, 1.25);
        else if (h % 7 === 0) push("planter", c.id, 1.55, 0.02, 0.16);
        else if (h % 17 === 0) push("market_umbrella", c.id, 1.35);
        else if (h % 19 === 0) push("bench", c.id, 1.4);
        else if (h % 23 === 0) push("crates", c.id, 1.3);
        if (bank && h % 11 === 0) push("planter", c.id, 1.2, 0.02, 0.38);
      } else if (
        h % 29 === 0 &&
        c.neighbors.some((n) => n >= 0 && intent.ground[n] === "quay")
      )
        push("boat", c.id, 1.3, -0.24);
    });
    return data;
  }, [state]);
  const reflections = useMemo(
    () =>
      (instances.get("lantern") ?? []).flatMap(({ matrix, cell }) => {
        const p = new THREE.Vector3().setFromMatrixPosition(matrix);
        const nearest = state.grid.cells
          .filter((c) => state.document.intent.ground[c.id] === "water")
          .map((c) => ({
            c,
            d: Math.hypot(c.center.x - p.x, c.center.z - p.z),
          }))
          .sort((a, b) => a.d - b.d)[0];
        return nearest && nearest.d < 2.5
          ? [
              {
                matrix: matrix
                  .clone()
                  .setPosition(nearest.c.center.x, 0, nearest.c.center.z),
                cell,
              },
            ]
          : [];
      }),
    [instances, state.grid, state.document.intent],
  );
  const lights = (instances.get("lantern") ?? []).slice(0, 8);
  return (
    <group>
      {[...instances].flatMap(([name, matrices]) =>
        (kit.get(name) ?? []).map((part, i) => (
          <PropInstances
            key={`${name}:${i}`}
            geometry={part.geometry}
            material={part.material}
            matrices={matrices}
            night={night}
            name={name}
            playback={playback}
          />
        )),
      )}
      {lights.map((placement, i) => (
        <LanternLight
          key={i}
          placement={placement}
          night={night}
          playback={playback}
        />
      ))}
      {night && (
        <LanternReflections
          matrices={reflections}
          reducedMotion={reducedMotion}
          playback={playback}
        />
      )}
    </group>
  );
}
function PropInstances({
  geometry,
  material,
  matrices,
  night,
  name,
  playback,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: PropPlacement[];
  night: boolean;
  name: string;
  playback: RevealPlayback;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const instanceMaterial = useMemo(() => {
    const copy = material.clone();
    if (
      copy instanceof THREE.MeshStandardMaterial &&
      copy.name === "Lantern paper"
    )
      copy.emissiveIntensity = night ? 3 : 0.4;
    return animateMaterial(copy, playback.clock);
  }, [material, night, playback]);
  const animatedGeometry = useMemo(() => {
    const copy = geometry.clone();
    instanceMotionAttributes(
      copy,
      matrices.map((p) => revealBirth(playback.plan, p.cell, 3)),
    );
    return copy;
  }, [geometry, matrices, playback]);
  const depthMaterial = useMemo(
    () =>
      animateMaterial(
        new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }),
        playback.clock,
      ),
    [playback],
  );
  useEffect(() => {
    if (!ref.current) return;
    matrices.forEach((p, i) => ref.current!.setMatrixAt(i, p.matrix));
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [matrices, instanceMaterial]);
  useEffect(() => () => instanceMaterial.dispose(), [instanceMaterial]);
  useEffect(() => () => animatedGeometry.dispose(), [animatedGeometry]);
  useEffect(() => () => depthMaterial.dispose(), [depthMaterial]);
  return (
    <instancedMesh
      ref={ref}
      args={[animatedGeometry, instanceMaterial, matrices.length]}
      customDepthMaterial={depthMaterial}
      castShadow={name !== "lantern"}
      receiveShadow
      dispose={null}
    />
  );
}
function LanternLight({
  placement,
  night,
  playback,
}: {
  placement: PropPlacement;
  night: boolean;
  playback: RevealPlayback;
}) {
  const light = useRef<THREE.PointLight>(null);
  const position = new THREE.Vector3()
    .setFromMatrixPosition(placement.matrix)
    .add(new THREE.Vector3(0, 0.4, 0));
  const birth = revealBirth(playback.plan, placement.cell, 3);
  useFrame(() => {
    if (light.current)
      light.current.intensity = night
        ? 4 * THREE.MathUtils.smoothstep(playback.clock.value - birth, 0, 0.4)
        : 0;
  });
  return (
    <pointLight
      ref={light}
      position={position}
      color="#ffc77d"
      intensity={0}
      distance={4}
      decay={2}
    />
  );
}
function LanternReflections({
  matrices,
  reducedMotion,
  playback,
}: {
  matrices: PropPlacement[];
  reducedMotion: boolean;
  playback: RevealPlayback;
}) {
  const ref = useRef<THREE.InstancedMesh>(null),
    material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ time: { value: 0 }, townTime: playback.clock }),
    [playback],
  );
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1, 1);
    instanceMotionAttributes(
      plane,
      matrices.map((p) => revealBirth(playback.plan, p.cell, 3)),
    );
    return plane;
  }, [matrices, playback]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    if (!ref.current) return;
    matrices.forEach((source, i) => {
      const p = new THREE.Vector3().setFromMatrixPosition(source.matrix);
      p.y = -0.267;
      const m = new THREE.Matrix4().compose(
        p,
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          -Math.PI / 2,
        ),
        new THREE.Vector3(1.3, 1.9, 1),
      );
      ref.current!.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [matrices]);
  useFrame(({ clock }) => {
    if (material.current)
      material.current.uniforms.time.value = reducedMotion
        ? 0
        : clock.getElapsedTime();
  });
  return (
    <instancedMesh
      ref={ref}
      geometry={geometry}
      args={[geometry, undefined, matrices.length]}
    >
      <shaderMaterial
        key={geometry.uuid}
        ref={material}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`varying vec2 vUv;varying float vReveal;attribute float townBirth;uniform float townTime;void main(){vUv=uv;vReveal=smoothstep(0.,.4,townTime-townBirth);gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`}
        fragmentShader={`varying vec2 vUv;varying float vReveal;uniform float time;void main(){vec2 p=(vUv-.5)*2.;float glow=exp(-dot(p*vec2(2.,1.),p*vec2(2.,1.))*3.);float waves=.65+.35*sin(p.y*22.+time*1.3+sin(p.x*5.));gl_FragColor=vec4(1.,.63,.3,glow*waves*.10*vReveal);}`}
      />
    </instancedMesh>
  );
}
function Picking({
  state,
  onPick,
  onHover,
  lens,
  counts,
  event,
  selected,
  bridgeStart,
}: {
  state: TownState;
  onPick: SceneProps["onPick"];
  onHover: SceneProps["onHover"];
  lens: boolean;
  counts?: number[];
  event?: SolverEvent;
  selected: number | null;
  bridgeStart: number | null;
}) {
  const data = useMemo(
    () => makePickingGeometry(state.grid, state.document),
    [state.grid, state.document],
  );
  const down = useRef<{
    x: number;
    y: number;
    cell: number;
    button: number;
  } | null>(null);
  useEffect(() => () => data.geometry.dispose(), [data]);
  const cellFor = (e: ThreeEvent<PointerEvent>) =>
    data.cellByFace[e.faceIndex ?? -1];
  const highlighted =
    selected ??
    (event && event.slot >= 0 ? event.slot % state.grid.cells.length : null);
  const overlay = useMemo(() => {
    const positions: number[] = [],
      colors: number[] = [];
    for (const cell of state.grid.cells) {
      if (!lens && cell.id !== highlighted && cell.id !== bridgeStart) continue;
      const y =
        state.document.intent.heights[cell.id] * FLOOR_HEIGHT +
        (lens ? 0.85 : 0.09);
      const choices =
        counts?.[
          (state.document.intent.heights[cell.id] > 0
            ? state.document.intent.heights[cell.id] + 1
            : 0) *
            state.grid.cells.length +
            cell.id
        ] ?? 1;
      const color = new THREE.Color(
        cell.id === bridgeStart
          ? "#e3ab57"
          : cell.id === highlighted
            ? "#efad76"
            : choices > 5
              ? "#edb36d"
              : choices > 1
                ? "#b5ce77"
                : "#74d9be",
      );
      const corners = cell.vertices.map((id) => state.grid.vertices[id]);
      for (const face of [
        [0, 2, 1],
        [0, 3, 2],
      ])
        for (const i of face) {
          positions.push(corners[i].x, y, corners[i].z);
          colors.push(color.r, color.g, color.b);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return g;
  }, [state, lens, counts, highlighted, bridgeStart]);
  useEffect(() => () => overlay.dispose(), [overlay]);
  return (
    <>
      <mesh
        geometry={data.geometry}
        visible={false}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (e.button !== 0 && e.button !== 2) return;
          down.current = {
            x: e.clientX,
            y: e.clientY,
            cell: cellFor(e),
            button: e.button,
          };
        }}
        onPointerUp={(e) => {
          const d = down.current;
          down.current = null;
          if (
            !d ||
            Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5 ||
            d.cell !== cellFor(e)
          )
            return;
          e.stopPropagation();
          onPick(d.cell, d.button === 2);
        }}
        onPointerMove={(e) => {
          onHover(cellFor(e) ?? null);
        }}
        onPointerOut={() => onHover(null)}
      >
        <meshBasicMaterial side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={overlay}>
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={lens ? 0.13 : 0.22}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}
function Ghost({
  mesh,
  kit,
  state,
  selected,
  layer = 1,
  rotation = 0,
}: {
  mesh: string;
  kit: ReturnType<typeof readKit>;
  state: TownState;
  selected: number;
  layer?: number;
  rotation?: number;
}) {
  const geometries = useMemo(
    () =>
      (kit.get(mesh) ?? []).map((part) => {
        const g = part.geometry.clone();
        const p = g.getAttribute("position");
        for (let i = 0; i < p.count; i++) {
          const a = (rotation * Math.PI) / 2,
            x = p.getX(i),
            z = p.getZ(i);
          const point = warpPoint(
            state.grid,
            selected,
            x * Math.cos(a) - z * Math.sin(a),
            Math.max(0, layer - 1) * FLOOR_HEIGHT +
              p.getY(i) * FLOOR_HEIGHT +
              0.025,
            x * Math.sin(a) + z * Math.cos(a),
          );
          p.setXYZ(i, ...point);
        }
        g.computeVertexNormals();
        return g;
      }),
    [mesh, kit, state, selected, layer, rotation],
  );
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  return (
    <group>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial
            color="#e3be79"
            wireframe
            transparent
            opacity={0.7}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
function ConstructionPulse({
  state,
  cell,
  failed,
}: {
  state: TownState;
  cell: number;
  failed?: boolean;
}) {
  const line = useRef<THREE.LineLoop>(null),
    elapsed = useRef(0);
  const geometry = useMemo(() => {
    const c = state.grid.cells[cell],
      y = state.document.intent.heights[cell] * FLOOR_HEIGHT + 0.77;
    const points = c.vertices.map(
      (id) =>
        new THREE.Vector3(
          state.grid.vertices[id].x,
          y,
          state.grid.vertices[id].z,
        ),
    );
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [state, cell]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, delta) => {
    elapsed.current += delta;
    if (!line.current) return;
    const m = line.current.material as THREE.LineBasicMaterial;
    m.opacity = Math.max(0, 1 - elapsed.current / 0.6) * 0.8;
    line.current.visible = elapsed.current < 0.6;
  });
  return (
    <lineLoop ref={line} geometry={geometry}>
      <lineBasicMaterial
        color={failed ? "#df704f" : "#f1c58a"}
        transparent
        opacity={0.8}
        depthTest={false}
      />
    </lineLoop>
  );
}
function Scene(props: SceneProps) {
  const gltf = useGLTF(KIT_URL),
    kit = useMemo(() => readKit(gltf.scene), [gltf.scene]);
  const playback = useMemo(
    () => new RevealPlayback(props.presentation.plan),
    [props.presentation],
  );
  const lastProgress = useRef("");
  useFrame(() => {
    if (
      props.finishPresentation === props.presentation.id ||
      props.lens ||
      props.reducedMotion
    )
      playback.finish();
    playback.advance(performance.now() / 1000, props.buildInterval);
    const progress = playback.progress;
    const signature = `${props.presentation.id}:${progress.shown}:${progress.active}`;
    if (signature !== lastProgress.current) {
      lastProgress.current = signature;
      props.onRevealProgress(props.presentation.id, progress);
    }
  }, -90);
  useEffect(
    () => () => {
      const materials = new Set<THREE.Material>();
      kit.forEach((parts) =>
        parts.forEach((p) => {
          p.geometry.dispose();
          materials.add(p.material);
        }),
      );
      materials.forEach((material) => material.dispose());
    },
    [kit],
  );
  return (
    <>
      <color attach="background" args={[props.night ? "#21364d" : "#a8d4d0"]} />
      <fog attach="fog" args={[props.night ? "#21364d" : "#a8d4d0", 50, 145]} />
      <ambientLight
        intensity={props.night ? 0.45 : 0.55}
        color={props.night ? "#8babdb" : "#fff3df"}
      />
      <hemisphereLight
        args={["#d4eaff", "#8e8065", props.night ? 0.65 : 1.25]}
      />
      <directionalLight
        castShadow
        position={[-16, 28, 14]}
        intensity={props.night ? 1.1 : 3.5}
        color={props.night ? "#abc3ff" : "#fff1d6"}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-bias={-0.0003}
        shadow-normalBias={0.025}
      />
      <CanalWater {...props} />
      <Shore
        state={props.state}
        kit={kit}
        night={props.night}
        reducedMotion={props.reducedMotion}
        playback={playback}
      />
      <Architecture
        state={props.state}
        kit={kit}
        night={props.night}
        reducedMotion={props.reducedMotion}
        lens={props.lens}
        playback={playback}
      />
      <Props
        state={props.state}
        kit={kit}
        night={props.night}
        reducedMotion={props.reducedMotion}
        playback={playback}
      />
      {!props.revealing && <Picking {...props} />}
      {props.lens && props.ghostMesh && props.selected !== null && (
        <Ghost
          mesh={props.ghostMesh}
          kit={kit}
          state={props.state}
          selected={props.selected}
          layer={props.ghostLayer}
          rotation={props.ghostRotation}
        />
      )}
      {props.crossingPreview?.cells.map((cell, i) => {
        const length = props.crossingPreview!.cells.length;
        return (
          <Ghost
            key={cell}
            mesh={
              length === 1
                ? "bridge_single"
                : i === 0 || i === length - 1
                  ? "bridge_end"
                  : "bridge_span"
            }
            kit={kit}
            state={props.state}
            selected={cell}
            rotation={
              (props.crossingPreview!.faces[i] +
                (i === length - 1 && length > 1 ? 0 : 2)) %
              4
            }
          />
        );
      })}
      {props.pulse && !props.reducedMotion && (
        <ConstructionPulse
          key={props.pulse.revision}
          state={props.state}
          cell={props.pulse.cell}
          failed={props.pulse.failed}
        />
      )}
      <CameraRig radius={props.state.grid.radius} view={props.view} />
      <OrbitControls
        makeDefault
        target={[0, 0.4, 0]}
        minPolarAngle={0.35}
        maxPolarAngle={1.38}
        minZoom={12}
        maxZoom={100}
        enableDamping={!props.reducedMotion}
        dampingFactor={0.15}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
      />
      <Stats report={props.onStats} />
      <SceneEffects night={props.night} clock={playback.clock} />
    </>
  );
}
export default function CanalScene(props: SceneProps) {
  const [supported] = useState(() => {
    try {
      const probe = document.createElement("canvas"),
        gl = probe.getContext("webgl2");
      if (!gl) return false;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
    } catch {
      return false;
    }
  });
  if (!supported)
    return (
      <div className="canal-canvas">
        <div className="canvas-fallback">
          This town needs WebGL 2. You can still explore the{" "}
          <a href={`${import.meta.env.BASE_URL}learn`}>2D learning demos</a>.
        </div>
      </div>
    );
  return (
    <div
      className={`canal-canvas tool-${props.tool}`}
      data-testid="town-canvas"
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        orthographic
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={[1, 1.5]}
        camera={{ position: [25, 25, 30], zoom: 26, near: 0.1, far: 250 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        fallback={
          <div className="canvas-fallback">
            This town needs WebGL 2. You can still explore the{" "}
            <a href={`${import.meta.env.BASE_URL}learn`}>2D learning demos</a>.
          </div>
        }
      >
        <Suspense fallback={null}>
          <Scene {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}
