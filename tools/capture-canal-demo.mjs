import { chromium } from "@playwright/test";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { cpus, hostname } from "node:os";

const output = resolve(process.argv[2] ?? "docs/media");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: output, size: { width: 1920, height: 1080 } },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function rootReady() {
  await page.getByText("Saved on this device", { exact: true }).waitFor();
  await page.waitForFunction(async () => {
    const url = performance
      .getEntriesByType("resource")
      .map((r) => r.name)
      .find((u) => u.includes("@react-three_fiber.js"));
    if (!url) return false;
    const f = await import(url);
    return (
      f._roots.get(document.querySelector("canvas"))?.store.getState().internal
        .interaction.length > 0
    );
  });
  await page.waitForTimeout(500);
}
async function target(kind) {
  return page.evaluate(async (kind) => {
    const url = performance
      .getEntriesByType("resource")
      .map((r) => r.name)
      .find((u) => u.includes("@react-three_fiber.js"));
    const f = await import(url),
      doc = JSON.parse(localStorage.getItem("canal-town:v1")),
      canvas = document.querySelector("canvas"),
      s = f._roots.get(canvas).store.getState(),
      box = canvas.getBoundingClientRect();
    const { createTownGrid } = await import("/wfc/src/canal/grid.ts"),
      grid = createTownGrid(doc.intent.seed, doc.intent.size);
    const surface = s.internal.interaction.find(
        (o) => o.geometry?.userData.cellByFace,
      ),
      positions = surface.geometry.getAttribute("position"),
      metadata = surface.geometry.userData.cellByFace;
    for (const c of grid.cells) {
      const h = doc.intent.heights[c.id];
      if (
        kind === "stack"
          ? h !== 1
          : h !== 0 ||
            doc.intent.ground[c.id] !== "quay" ||
            !c.neighbors.some((n) => n >= 0 && doc.intent.heights[n] === 1) ||
            doc.intent.bridges.some((b) => b.anchors.includes(c.id))
      )
        continue;
      for (let face = 0; face < metadata.length; face++)
        if (metadata[face] === c.id) {
          const i = face * 3;
          if (
            h > 0 &&
            Math.min(
              positions.getY(i),
              positions.getY(i + 1),
              positions.getY(i + 2),
            ) <=
              h * 1.4
          )
            continue;
          const v = s.camera.position
            .clone()
            .set(
              (positions.getX(i) +
                positions.getX(i + 1) +
                positions.getX(i + 2)) /
                3,
              (positions.getY(i) +
                positions.getY(i + 1) +
                positions.getY(i + 2)) /
                3,
              (positions.getZ(i) +
                positions.getZ(i + 1) +
                positions.getZ(i + 2)) /
                3,
            )
            .project(s.camera);
          const ray = new s.raycaster.constructor();
          ray.setFromCamera(s.pointer.clone().set(v.x, v.y), s.camera);
          const hit = ray.intersectObjects(s.internal.interaction, false)[0];
          const x = box.x + ((v.x + 1) / 2) * box.width,
            y = box.y + ((1 - v.y) / 2) * box.height;
          if (
            hit?.object.geometry.userData.cellByFace[hit.faceIndex] === c.id &&
            x > 200 &&
            x < 1500 &&
            y > 270 &&
            y < 800 &&
            document.elementFromPoint(x, y) === canvas
          )
            return { x, y, cell: c.id, edit: doc.edit };
        }
    }
    throw new Error("No visible construction target");
  }, kind);
}
async function construct(kind) {
  const p = await target(kind);
  await page.mouse.move(p.x, p.y, { steps: 18 });
  await page.waitForTimeout(300);
  const t = performance.now();
  await page.mouse.click(p.x, p.y);
  await page.waitForFunction(
    (edit) => JSON.parse(localStorage.getItem("canal-town:v1")).edit === edit,
    p.edit + 1,
  );
  return performance.now() - t;
}
try {
  await page.goto("http://127.0.0.1:5173/wfc/");
  await rootReady();
  const profile = await page.evaluate(async () => {
    const url = performance
        .getEntriesByType("resource")
        .map((r) => r.name)
        .find((u) => u.includes("@react-three_fiber.js")),
      f = await import(url),
      s = f._roots.get(document.querySelector("canvas")).store.getState();
    const frames = [],
      renderMs = [];
    let last = performance.now();
    await new Promise((resolve) => {
      function frame(t) {
        frames.push(t - last);
        last = t;
        if (frames.length >= 120) resolve();
        else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    const frameTotals = {
      drawCalls: s.gl.info.render.calls,
      triangles: s.gl.info.render.triangles,
    };
    const gl = s.gl.getContext();
    const mainPass = [];
    for (let i = 0; i < 20; i++) {
      s.gl.info.reset();
      const t = performance.now();
      s.gl.render(s.scene, s.camera);
      gl.finish();
      renderMs.push(performance.now() - t);
      mainPass.push({
        drawCalls: s.gl.info.render.calls,
        triangles: s.gl.info.render.triangles,
      });
    }
    return {
      fps: 1000 / (frames.slice(20).reduce((a, b) => a + b, 0) / 100),
      ...frameTotals,
      measurement:
        "All frame passes: reflection, colour, shadows, AO and post-processing",
      mainPass: mainPass[mainPass.length - 1],
      renderer: gl.getParameter(
        gl.getExtension("WEBGL_debug_renderer_info")?.UNMASKED_RENDERER_WEBGL ??
          gl.RENDERER,
      ),
      synchronousColourAndShadowMs: renderMs,
    };
  });
  await page.screenshot({ path: resolve(output, "daylight.png") });
  await page.waitForTimeout(700);
  const timings = [await construct("join")];
  await page.screenshot({ path: resolve(output, "construction.png") });
  await page.waitForTimeout(700);
  timings.push(await construct("stack"));
  await page.waitForTimeout(700);
  await page.mouse.move(700, 650);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(830, 680, { steps: 40 });
  await page.mouse.up({ button: "right" });
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Switch to lantern evening" }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve(output, "evening.png") });
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "WFC lens", exact: false }).click();
  await page
    .getByRole("slider", { name: "Solver replay position" })
    .fill(
      await page
        .getByRole("slider", { name: "Solver replay position" })
        .getAttribute("max"),
    );
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(output, "wfc-lens.png") });
  await page
    .getByRole("button", { name: "Recovery study", exact: true })
    .click();
  await page.getByRole("button", { name: "Pause solver replay" }).click();
  for (let i = 0; i < 40; i++) {
    if (
      (await page.locator(".event-card").getAttribute("class")).includes(
        "event-backtrack",
      )
    )
      break;
    await page.getByRole("button", { name: "Step solver replay" }).click();
    await page.waitForTimeout(160);
  }
  await page.screenshot({ path: resolve(output, "backtracking.png") });
  await page.waitForTimeout(1200);
  await writeFile(
    resolve(output, "performance.json"),
    JSON.stringify(
      {
        machine: hostname(),
        cpu: cpus()[0].model,
        viewport: "1920x1080",
        seed: "komorebi",
        ...profile,
        editMs: timings,
        errors,
      },
      null,
      2,
    ),
  );
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  const video = page.video();
  await context.close();
  if (video)
    await rename(await video.path(), resolve(output, "canal-town-demo.webm"));
  await browser.close();
}
console.log(`Canal Town captures: ${output}`);
