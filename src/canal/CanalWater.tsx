import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { SceneProps } from "./CanalScene";

/** A planar reflection using the actual orthographic camera, with a quiet stylized surface. */
export function CanalWater({
  night,
  reducedMotion,
  pulse,
  state,
}: Pick<SceneProps, "night" | "reducedMotion" | "pulse" | "state">) {
  const camera = useThree((s) => s.camera);
  const water = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(512, 512, {
      type: THREE.HalfFloatType,
    });
    const reflected: THREE.Camera = camera.clone();
    const textureMatrix = new THREE.Matrix4();
    const material = new THREE.ShaderMaterial({
      uniforms: {
        reflection: { value: target.texture },
        textureMatrix: { value: textureMatrix },
        time: { value: 0 },
        night: { value: 0 },
        ripple: { value: new THREE.Vector3(0, 0, -100) },
        dayColour: { value: new THREE.Color("#5c9faa") },
        duskColour: { value: new THREE.Color("#294c66") },
      },
      vertexShader: `uniform mat4 textureMatrix;varying vec3 vWorld;varying vec4 vReflection;
        void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;vReflection=textureMatrix*world;gl_Position=projectionMatrix*viewMatrix*world;}`,
      fragmentShader: `uniform sampler2D reflection;uniform float time;uniform float night;uniform vec3 dayColour;uniform vec3 duskColour;uniform vec3 ripple;varying vec3 vWorld;varying vec4 vReflection;
      void main(){
        vec2 p=vWorld.xz;
        float a=sin(p.x*1.7+p.y*.8+time*.7), b=sin(p.y*2.1-p.x*.4-time*.5);
        vec2 drift=vec2(a,b)*.0018;
        vec3 reflected=texture2D(reflection,vReflection.xy/vReflection.w+drift).rgb;
        vec3 base=mix(dayColour,duskColour,night);
        float rippleAge=time-ripple.z;float d=length(p-ripple.xy);
        float ring=exp(-pow((d-rippleAge*2.)*4.,2.))*max(0.,1.-rippleAge/2.2)*step(0.,rippleAge);
        float glint=pow(max(0.,sin(p.x*5.+p.y*2.+a*.35+time*.5)),48.)*.008*smoothstep(.35,.85,sin(p.y*.7-time*.12)*cos(p.x*.5));
        vec3 colour=mix(base,reflected,.18)+vec3((a*b)*.009+glint+ring*.05)*(1.-night*.6);
        float distanceFade=smoothstep(18.,90.,length(p));
        colour=mix(colour,mix(vec3(.32,.57,.58),vec3(.035,.065,.11),night),distanceFade*.55);
        gl_FragColor=vec4(colour,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.28;
    mesh.receiveShadow = true;
    mesh.name = "Canal water";
    return { mesh, material, target, reflected, textureMatrix };
  }, [camera]);
  useEffect(
    () => () => {
      water.mesh.geometry.dispose();
      water.material.dispose();
      water.target.dispose();
    },
    [water],
  );
  useEffect(() => {
    if (pulse && !pulse.failed && !reducedMotion) {
      const cell = state.grid.cells[pulse.cell];
      if (cell)
        water.material.uniforms.ripple.value.set(
          cell.center.x,
          cell.center.z,
          water.material.uniforms.time.value,
        );
    }
  }, [pulse, state.grid, reducedMotion, water]);
  const vectors = useMemo(
    () => ({
      position: new THREE.Vector3(),
      target: new THREE.Vector3(),
      up: new THREE.Vector3(),
      direction: new THREE.Vector3(),
    }),
    [],
  );
  useFrame(({ gl, scene, clock }) => {
    water.material.uniforms.time.value = reducedMotion ? 0 : clock.elapsedTime;
    water.material.uniforms.night.value = night ? 1 : 0;
    const { position, target, up, direction } = vectors;
    camera.getWorldPosition(position);
    camera.getWorldDirection(direction);
    target.copy(position).add(direction);
    position.y = -position.y - 0.56;
    target.y = -target.y - 0.56;
    up.copy(camera.up);
    up.y = -up.y;
    water.reflected.copy(camera, false);
    water.reflected.position.copy(position);
    water.reflected.up.copy(up);
    water.reflected.lookAt(target);
    water.reflected.updateMatrixWorld();
    water.textureMatrix
      .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(water.reflected.projectionMatrix)
      .multiply(water.reflected.matrixWorldInverse);
    const previousTarget = gl.getRenderTarget(),
      shadows = gl.shadowMap.autoUpdate;
    const override = scene.overrideMaterial;
    water.mesh.visible = false;
    gl.shadowMap.autoUpdate = false;
    scene.overrideMaterial = null;
    try {
      gl.setRenderTarget(water.target);
      gl.clear();
      gl.render(scene, water.reflected);
    } finally {
      gl.setRenderTarget(previousTarget);
      gl.shadowMap.autoUpdate = shadows;
      scene.overrideMaterial = override;
      water.mesh.visible = true;
    }
  });
  return <primitive object={water.mesh} dispose={null} />;
}
