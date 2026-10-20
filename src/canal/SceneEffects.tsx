/* eslint-disable react-hooks/immutability -- EffectComposer and its passes expose an imperative Three.js API. */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { Vector2, WebGLRenderTarget, HalfFloatType } from "three";
import { animateMaterial } from "./motion";

class TownAOPass extends GTAOPass {
  override render(...args: Parameters<GTAOPass["render"]>) {
    // The colour pass already updated the shadow map. Normal/depth rendering
    // needs the same animated vertices, but no second shadow-map render.
    const renderer = args[0],
      previous = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    try {
      super.render(...args);
    } finally {
      renderer.shadowMap.autoUpdate = previous;
    }
  }
}

export function SceneEffects({
  night,
  clock,
}: {
  night: boolean;
  clock: { value: number };
}) {
  const { gl, scene, camera, size } = useThree();
  const effects = useMemo(() => {
    const target = new WebGLRenderTarget(512, 512, {
      type: HalfFloatType,
      samples: 4,
    });
    const composer = new EffectComposer(gl, target);
    const render = new RenderPass(scene, camera);
    const ao = new TownAOPass(scene, camera, 512, 512);
    animateMaterial(ao.normalMaterial, clock);
    ao.blendIntensity = 0.48;
    ao.updateGtaoMaterial({
      radius: 0.65,
      thickness: 0.8,
      distanceExponent: 1.5,
      scale: 1,
    });
    const bloom = new UnrealBloomPass(new Vector2(512, 512), 0.1, 0.5, 1.2);
    const output = new OutputPass();
    composer.addPass(render);
    composer.addPass(ao);
    composer.addPass(bloom);
    composer.addPass(output);
    return { composer, render, ao, bloom, output, clock };
  }, [gl, scene, camera, clock]);
  useEffect(() => {
    effects.composer.setSize(size.width, size.height);
    effects.ao.setSize(
      Math.round(size.width * 0.65),
      Math.round(size.height * 0.65),
    );
    effects.ao.enabled = size.width >= 700;
  }, [effects, size]);
  useEffect(
    () => () => {
      effects.composer.dispose();
      effects.ao.dispose();
      effects.bloom.dispose();
      effects.output.dispose();
    },
    [effects],
  );
  useEffect(() => {
    const previous = gl.info.autoReset;
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = previous;
    };
  }, [gl]);
  useFrame(() => {
    gl.info.reset();
  }, -100);
  useFrame((_, delta) => {
    effects.bloom.strength = night ? 0.22 : 0.035;
    effects.composer.render(delta);
  }, 1);
  return null;
}
