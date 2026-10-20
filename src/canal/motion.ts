import * as THREE from "three";

export const REVEAL_SECONDS = 0.72;
export const REMOVE_SECONDS = 0.28;

export function revealScale(age: number): number {
  if (age <= 0) return 0;
  if (age >= REVEAL_SECONDS) return 1;
  return (
    1 - Math.exp(-9 * age) * (Math.cos(12 * age) + 0.25 * Math.sin(12 * age))
  );
}

/** All settled meshes share a clock. Per-vertex pivots keep batched pieces independent. */
export function animateMaterial<T extends THREE.Material>(
  material: T,
  clock: { value: number },
): T {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.townTime = clock;
    shader.vertexShader =
      `uniform float townTime;
attribute vec3 townPivot;
attribute float townBirth;
attribute float townExit;
float townScale() {
  float age = townTime - townBirth;
  if (townExit > .5) return 1. - smoothstep(0., .28, age);
  if (age <= 0.) return 0.;
  if (age >= .72) return 1.;
  return max(.001, 1. - exp(-9. * age) * (cos(12. * age) + .25 * sin(12. * age)));
}
` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      #include <begin_vertex>
      float growth = townScale();
      float width = growth <= 0. ? 0. : townExit > .5 ? growth : mix(.78, 1., min(growth, 1.)) - max(growth-1.,0.)*.35;
      transformed = townPivot + (transformed-townPivot)*vec3(width,growth,width);
    `,
    );
  };
  material.customProgramCacheKey = () => "canal-construction-v2";
  return material;
}

export function motionAttributes(
  geometry: THREE.BufferGeometry,
  pivot: THREE.Vector3,
  birth: number,
  exit = false,
) {
  const count = geometry.getAttribute("position").count;
  const pivots = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) pivot.toArray(pivots, i * 3);
  geometry.setAttribute("townPivot", new THREE.BufferAttribute(pivots, 3));
  geometry.setAttribute(
    "townBirth",
    new THREE.BufferAttribute(new Float32Array(count).fill(birth), 1),
  );
  geometry.setAttribute(
    "townExit",
    new THREE.BufferAttribute(new Float32Array(count).fill(exit ? 1 : 0), 1),
  );
}

/** Props share geometry per family; reveal dates advance once per instance. */
export function instanceMotionAttributes(
  geometry: THREE.BufferGeometry,
  births: number[],
) {
  geometry.setAttribute(
    "townBirth",
    new THREE.InstancedBufferAttribute(new Float32Array(births), 1),
  );
  geometry.setAttribute(
    "townPivot",
    new THREE.InstancedBufferAttribute(new Float32Array(births.length * 3), 3),
  );
  geometry.setAttribute(
    "townExit",
    new THREE.InstancedBufferAttribute(new Float32Array(births.length), 1),
  );
}
