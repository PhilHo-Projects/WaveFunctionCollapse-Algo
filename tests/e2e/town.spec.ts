import { expect, test, type Page } from "@playwright/test";

const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("canal-town:v1")!));
async function ready(page: Page) {
  await expect(page.getByTestId("town-counts")).toContainText(
    /[1-9]\d* cells/,
    {
      timeout: 30_000,
    },
  );
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(async () => {
    const f =
      await import("/wfc/node_modules/.vite/deps/@react-three_fiber.js");
    return (
      f._roots.get(document.querySelector("canvas"))?.store.getState()
        .internal.interaction.length > 0
    );
  });
  await page.evaluate(
    () =>
      new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      ),
  );
  // The camera and controls mount after the GLB suspense boundary. Wait for
  // their initial pose before projecting test gestures into screen space.
  await page.waitForTimeout(400);
}
async function projectCell(page: Page, requested?: number) {
  return page.evaluate(async (id) => {
    const fiber =
      await import("/wfc/node_modules/.vite/deps/@react-three_fiber.js");
    const doc = JSON.parse(localStorage.getItem("canal-town:v1")!);
    const canvas = document.querySelector("canvas")!,
      state = fiber._roots.get(canvas).store.getState(),
      box = canvas.getBoundingClientRect();
    const surface = state.internal.interaction.find(
      (object: { geometry?: { userData: { cellByFace?: number[] } } }) =>
        object.geometry?.userData.cellByFace,
    );
    const positions = surface.geometry.getAttribute("position"),
      metadata: number[] = surface.geometry.userData.cellByFace;
    let fallback = { cell: id ?? -1, x: 0, y: 0, visible: false };
    const choices =
      id === undefined
        ? doc.intent.heights.flatMap((h: number, c: number) =>
            h === 1 ? [c] : [],
          )
        : [id];
    for (const cell of choices)
      for (let face = 0; face < metadata.length; face++)
        if (metadata[face] === cell) {
          const i = face * 3,
            h = doc.intent.heights[cell];
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
          // Click a triangle interior. A roof apex lies on its screen silhouette;
          // browser pointer coordinates round to floats and may land above it.
          const v = state.camera.position
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
            .project(state.camera);
          const x = box.x + ((v.x + 1) / 2) * box.width,
            y = box.y + ((1 - v.y) / 2) * box.height;
          const ray = new state.raycaster.constructor();
          ray.setFromCamera(
            state.pointer.clone().set(v.x, v.y),
            state.camera,
          );
          const hit = ray.intersectObjects(
            state.internal.interaction,
            false,
          )[0];
          fallback = {
            cell,
            x,
            y,
            visible:
              hit?.object.geometry.userData.cellByFace[hit.faceIndex] ===
                cell && document.elementFromPoint(x, y) === canvas,
          };
          if (fallback.visible) return fallback;
        }
    if (id === undefined) throw new Error("No visible one-floor building");
    return fallback;
  }, requested);
}
test("builds, removes, restores, and never edits while orbiting", async ({
  page,
}) => {
  await page.goto("./");
  await ready(page);
  const before = await saved(page),
    point = await projectCell(page);
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(async () => (await saved(page)).intent.heights[point.cell])
    .toBe(before.intent.heights[point.cell] + 1);
  const built = await saved(page);
  await page.screenshot({ path: test.info().outputPath("construction.png") });
  const top = await projectCell(page, point.cell);
  await page.mouse.move(top.x, top.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(top.x + 90, top.y + 30, { steps: 12 });
  await page.mouse.up({ button: "right" });
  expect((await saved(page)).intent.heights).toEqual(built.intent.heights);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).intent.heights[point.cell])
    .toBe(before.intent.heights[point.cell]);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).intent.heights[point.cell])
    .toBe(built.intent.heights[point.cell]);
  await page
    .getByRole("button", { name: "Reset camera", exact: true })
    .click();
  await ready(page);
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  const removing = await projectCell(page, point.cell);
  await page.mouse.click(removing.x, removing.y);
  await expect
    .poll(async () => (await saved(page)).intent.heights[point.cell])
    .toBe(before.intent.heights[point.cell]);
  await page.reload();
  await ready(page);
  expect((await saved(page)).intent.heights).toEqual(before.intent.heights);
});
test("paints a whole building, persists its colour, and restores it with undo", async ({
  page,
}) => {
  await page.goto("./");
  await ready(page);
  const before = await saved(page),
    point = await projectCell(page);
  await page.getByRole("button", { name: "Paint", exact: true }).click();
  await page
    .getByRole("button", { name: "Paint with Sea glass", exact: true })
    .click();
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(async () => (await saved(page)).intent.paint?.[point.cell])
    .toBe(3);
  const painted = await saved(page);
  expect(painted.assignments).toEqual(before.assignments);
  expect(painted.intent.heights).toEqual(before.intent.heights);
  expect(painted.edit).toBe(before.edit + 1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).intent.paint)
    .toEqual(before.intent.paint);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).intent.paint)
    .toEqual(painted.intent.paint);
  await page.getByRole("button", { name: "Enable placement sounds" }).click();
  await expect(
    page.getByRole("button", { name: "Mute placement sounds" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await ready(page);
  expect((await saved(page)).intent.paint).toEqual(painted.intent.paint);
  await expect(
    page.getByRole("button", { name: "Enable placement sounds" }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("creates and removes a complete bridge transaction", async ({
  page,
}) => {
  await page.goto("./");
  await ready(page);
  // Import a valid waterfront fixture with clear landings. Architecture can
  // legitimately occlude a crossing in the generated, oblique town view.
  const fixture = await page.evaluate(async () => {
    const { createTownGrid } = await import("/wfc/src/canal/grid.ts");
    const { buildProblem } = await import("/wfc/src/canal/world.ts");
    const { createCatalog } = await import("/wfc/src/canal/catalog.ts");
    const { solve } = await import("/wfc/src/canal/solver.ts");
    const doc = JSON.parse(localStorage.getItem("canal-town:v1")!);
    doc.intent.heights.fill(0);
    const result = solve(
      buildProblem(
        createTownGrid(doc.intent.seed, doc.intent.size),
        doc.intent,
        createCatalog(),
      ),
    );
    if (result.status !== "success")
      throw new Error("Invalid bridge fixture");
    return { ...doc, assignments: result.assignments };
  });
  await page.locator("input[type=file]").setInputFiles({
    name: "waterfront.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await ready(page);
  const before = await saved(page);
  let bridge = before.intent.bridges[0],
    span = await projectCell(page, bridge.cells[0]);
  for (const b of before.intent.bridges) {
    const a = await projectCell(page, b.anchors[0]),
      end = await projectCell(page, b.anchors[1]);
    if (!a.visible || !end.visible) continue;
    for (const cell of b.cells) {
      const p = await projectCell(page, cell);
      if (p.visible) {
        bridge = b;
        span = p;
        break;
      }
    }
    if (span.visible) break;
  }
  expect(span.visible).toBe(true);
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  span = await projectCell(page, span.cell);
  await page.mouse.click(span.x, span.y);
  await expect
    .poll(async () => (await saved(page)).intent.bridges.length)
    .toBe(before.intent.bridges.length - 1);
  await page.getByRole("button", { name: "Bridge", exact: true }).click();
  const a = await projectCell(page, bridge.anchors[0]),
    b = await projectCell(page, bridge.anchors[1]);
  await page.mouse.click(a.x, a.y);
  await page.mouse.move(b.x, b.y);
  await page.screenshot({
    path: test.info().outputPath("bridge-preview.png"),
  });
  await page.mouse.click(b.x, b.y);
  await expect
    .poll(async () => (await saved(page)).intent.bridges.length)
    .toBe(before.intent.bridges.length);
});
test("round-trips JSON and rejects an incompatible save without losing the town", async ({
  page,
}) => {
  await page.goto("./");
  await ready(page);
  const doc = await saved(page);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe(
    "canal-town-komorebi.json",
  );
  await page.locator("input[type=file]").setInputFiles({
    name: "town.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(doc)),
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect((await saved(page)).assignments).toEqual(doc.assignments);
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...doc, kitVersion: "missing" })),
  });
  await expect(page.getByRole("alert")).toContainText(
    "different kit version",
  );
  expect((await saved(page)).assignments).toEqual(doc.assignments);
});
test("rolls back a contradictory edit and identifies its conflicting cell", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(
        message: Record<string, unknown>,
        options?: StructuredSerializeOptions,
      ) {
        // Fault injection: the editing job receives a kit with no legal pieces.
        super.postMessage(
          message.previous ? { ...message, modules: [] } : message,
          options ?? {},
        );
      }
    };
  });
  await page.goto("./");
  await ready(page);
  const before = await saved(page),
    p = await projectCell(page);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByRole("alert")).toContainText("at cell");
  expect(await saved(page)).toEqual(before);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
});
test("cancels a generation without committing a stale response", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        let released = false;
        this.addEventListener("message", (event) => {
          if (
            !released &&
            event.data.type === "complete" &&
            event.data.state.document.intent.seed === "cancelled-river"
          ) {
            // Hold the real result so the test does not race a fast solve;
            // deliver it after Cancel to exercise the stale-response guard.
            event.stopImmediatePropagation();
            document.documentElement.dataset.heldTown = "yes";
            window.addEventListener(
              "release-held-worker",
              () => {
                released = true;
                this.dispatchEvent(
                  new MessageEvent("message", { data: event.data }),
                );
              },
              { once: true },
            );
          }
        });
      }
    };
  });
  await page.goto("./");
  await ready(page);
  const doc = await saved(page);
  await page.getByRole("button", { name: "Make a town" }).click();
  await page.getByLabel("Town size", { exact: true }).selectOption("large");
  await page.getByLabel("Seed", { exact: true }).fill("cancelled-river");
  await page
    .getByRole("button", { name: "Generate town", exact: true })
    .click();
  await page.waitForFunction(
    () => document.documentElement.dataset.heldTown === "yes",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("release-held-worker")),
  );
  // Give the old worker several animation frames to prove it cannot commit after cancellation.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let n = 0;
        function frame() {
          if (++n === 30) resolve();
          else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }),
  );
  expect((await saved(page)).intent.seed).toBe(doc.intent.seed);
});
async function generateTown(page: Page, interval?: string, seed?: string) {
  await page.getByRole("button", { name: "Make a town" }).click();
  if (interval !== undefined)
    await page
      .getByLabel("Build speed", { exact: true })
      .selectOption(interval);
  if (seed !== undefined)
    await page.getByLabel("Seed", { exact: true }).fill(seed);
  await page
    .getByRole("button", { name: "Generate town", exact: true })
    .click();
}

// Replacing uniforms on regeneration must also update Three's GPU clock.
async function revealResources(page: Page) {
  return page.evaluate(async () => {
    const { _roots } =
      await import("/wfc/node_modules/.vite/deps/@react-three_fiber.js");
    const state = _roots
      .get(document.querySelector("canvas"))
      .store.getState();
    const gl = state.gl.getContext();
    const geometry: string[] = [],
      clocks: { js: number; gpu: number }[] = [];
    state.scene.traverse(
      (object: {
        geometry?: { uuid: string; attributes: Record<string, unknown> };
        material?: { uniforms?: { townTime?: { value: number } } };
      }) => {
        if (object.geometry?.attributes.townBirth)
          geometry.push(object.geometry.uuid);
        if (object.material?.uniforms?.townTime) {
          const program = state.gl.properties.get(
            object.material,
          ).currentProgram;
          if (program)
            clocks.push({
              js: object.material.uniforms.townTime.value,
              gpu: gl.getUniform(
                program.program,
                gl.getUniformLocation(program.program, "townTime"),
              ),
            });
        }
      },
    );
    return { geometry: geometry.sort(), clocks };
  });
}

test("reveals the same town sequentially, retimes existing geometry, and finishes immediately", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await ready(page);
  const before = await saved(page);
  await page
    .getByRole("button", { name: "Switch to lantern evening" })
    .click();
  await generateTown(page);
  const panel = page.getByRole("region", {
    name: "Town construction playback",
  });
  const progress = page.getByRole("progressbar", {
    name: "Town construction progress",
  });
  const shown = async () => Number(await progress.getAttribute("value"));
  await expect(panel).toBeVisible();
  await expect(page.getByLabel("Playback speed")).toHaveValue("100");
  await expect.poll(shown).toBeGreaterThan(3);
  expect(await shown()).toBeLessThan(
    Number(await progress.getAttribute("max")),
  );
  expect(await saved(page)).toEqual(before);
  const initial = await revealResources(page),
    initialShown = await shown();
  expect(initial.clocks.length).toBe(2);
  for (const clock of initial.clocks)
    expect(clock.gpu).toBeCloseTo(clock.js, 3);
  await page.getByLabel("Playback speed").selectOption("250");
  await expect.poll(shown).toBeGreaterThan(initialShown + 2);
  const slowShown = await shown();
  await page.getByLabel("Playback speed").selectOption("30");
  await expect.poll(shown).toBeGreaterThan(slowShown + 10);
  expect((await revealResources(page)).geometry).toEqual(initial.geometry);
  await page.mouse.move(1050, 550);
  await page.mouse.down();
  await page.mouse.move(1150, 580, { steps: 10 });
  await page.mouse.up();
  expect(await saved(page)).toEqual(before);
  await page.screenshot({
    path: test.info().outputPath("sequential-build.png"),
  });
  await page.getByRole("button", { name: "Finish now", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await ready(page);
  expect(await saved(page)).toEqual(before);

  // Identical solver assignments still get a fresh presentation identity.
  await generateTown(page, "250");
  await expect(panel).toBeVisible();
  await expect.poll(shown).toBeGreaterThan(2);
  expect(await shown()).toBeLessThan(15);
  const replay = await revealResources(page);
  expect(replay.geometry).not.toEqual(initial.geometry);
  for (const clock of replay.clocks)
    expect(clock.gpu).toBeCloseTo(clock.js, 3);
  await page.getByLabel("Playback speed").selectOption("0");
  await expect(panel).toHaveCount(0);
  await ready(page);
  expect(await saved(page)).toEqual(before);
  await page.reload();
  await ready(page);
  await expect(panel).toHaveCount(0);
  await page.getByRole("button", { name: "Make a town" }).click();
  await expect(page.getByLabel("Build speed", { exact: true })).toHaveValue(
    "0",
  );
  expect(errors).toEqual([]);
});

test("replaces a running reveal, completes naturally, and persists a full instant town", async ({
  page,
}) => {
  await page.goto("./");
  await ready(page);
  await generateTown(page, "250");
  const panel = page.getByRole("region", {
    name: "Town construction playback",
  });
  await expect(panel).toBeVisible();
  await generateTown(page, "30", "replacement-river");
  await expect
    .poll(async () => (await saved(page)).intent.seed)
    .toBe("replacement-river");
  await expect(panel).toBeVisible();
  const generated = await saved(page);
  await expect(panel).toHaveCount(0, { timeout: 25_000 });
  await ready(page);
  expect(await saved(page)).toEqual(generated);
  const point = await projectCell(page);
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(async () => (await saved(page)).edit)
    .toBe(generated.edit + 1);
  await generateTown(page, "0", "instant-river");
  await expect
    .poll(async () => (await saved(page)).intent.seed)
    .toBe("instant-river");
  await ready(page);
  await expect(panel).toHaveCount(0);
  const instant = await saved(page);
  await page.reload();
  await ready(page);
  expect(await saved(page)).toEqual(instant);
});

test("keeps mobile playback controls reachable and skips reveals for reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await ready(page);
  await generateTown(page, "250");
  const panel = page.getByRole("region", {
    name: "Town construction playback",
  });
  await expect(panel).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBe(390);
  await page.screenshot({
    path: test.info().outputPath("mobile-reveal.png"),
  });
  await page.getByRole("button", { name: "Finish now", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await ready(page);
  await generateTown(page, "100", "quiet-river");
  await expect
    .poll(async () => (await saved(page)).intent.seed)
    .toBe("quiet-river");
  await ready(page);
  await expect(panel).toHaveCount(0);
});

test("shows a useful failure when the Blender asset is unavailable", async ({
  page,
}) => {
  await page.route("**/canal-kit.glb", (route) => route.abort());
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "The town couldn’t load" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Explore the 2D demos" }),
  ).toBeVisible();
});
test("offers a learning route when WebGL is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      id: string,
      options?: unknown,
    ) {
      if (id === "webgl" || id === "webgl2") return null;
      return Reflect.apply(original, this, [id, options]);
    } as typeof original;
  });
  await page.goto("./");
  await expect(
    page.getByText("This town needs WebGL 2.", { exact: false }),
  ).toBeVisible();
});
test("keeps every earlier experiment directly reachable under the base path", async ({
  page,
}) => {
  for (const [path, heading] of [
    ["learn", "Playback"],
    ["builder", "Paint Tools"],
    ["townscaper", "Organic Tools"],
    ["townscaper-gen", "Procedural Controls"],
    ["townscaper-builder-3d", "Topology 3D Builder"],
    ["townscaper-procedural-3d", "3D Procedural Controls"],
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();
  }
});
test("records frame and edit timings on the current desktop", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("./");
  await ready(page);
  const sample = await page.evaluate(async () => {
    const { _roots } =
      await import("/wfc/node_modules/.vite/deps/@react-three_fiber.js");
    const state = _roots
      .get(document.querySelector("canvas"))
      .store.getState();
    const frames: number[] = [];
    let last = performance.now();
    await new Promise<void>((resolve) => {
      function frame(now: number) {
        frames.push(now - last);
        last = now;
        if (frames.length >= 90) resolve();
        else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    return {
      fps: 1000 / (frames.slice(10).reduce((s, v) => s + v, 0) / 80),
      calls: state.gl.info.render.calls,
      triangles: state.gl.info.render.triangles,
      renderer: state.gl
        .getContext()
        .getParameter(
          state.gl.getContext().getExtension("WEBGL_debug_renderer_info")
            ?.UNMASKED_RENDERER_WEBGL ?? state.gl.getContext().RENDERER,
        ),
    };
  });
  // Includes reflection, colour, shadow, AO and post-processing passes. The
  // earlier renderer counter reset on each pass and reported only one render.
  expect(sample.calls).toBeLessThan(420);
  const timings: number[] = [];
  for (let i = 0; i < 5; i++) {
    const p = await projectCell(page),
      doc = await saved(page),
      t = performance.now();
    await page.mouse.click(p.x, p.y);
    await page.waitForFunction(
      (edit) =>
        JSON.parse(localStorage.getItem("canal-town:v1")!).edit === edit,
      doc.edit + 1,
    );
    timings.push(performance.now() - t);
  }
  await info.attach("performance", {
    body: JSON.stringify({ ...sample, editsMs: timings }, null, 2),
    contentType: "application/json",
  });
});
test("captures daylight, evening and real backtracking in the lens", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await ready(page);
  await page.screenshot({ path: info.outputPath("daylight.png") });
  const pixel = async () => {
    const buffer = await page.screenshot({
      clip: { x: 10, y: 300, width: 1, height: 1 },
    });
    return page.evaluate(
      async (bytes) => {
        const image = await createImageBitmap(
          new Blob([new Uint8Array(bytes)], { type: "image/png" }),
        );
        const canvas = new OffscreenCanvas(1, 1),
          ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0);
        image.close();
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return (r + g + b) / 3;
      },
      [...buffer],
    );
  };
  const daylight = await pixel();
  await page
    .getByRole("button", { name: "Switch to lantern evening" })
    .click();
  await page.evaluate(
    () =>
      new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      ),
  );
  await page.screenshot({ path: info.outputPath("evening.png") });
  expect(await pixel()).toBeLessThan(daylight * 0.7);
  await page.getByRole("button", { name: "WFC lens", exact: false }).click();
  await expect(
    page.getByRole("complementary", { name: "WFC inspector" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Recovery study", exact: true })
    .click();
  await page.getByRole("button", { name: "Pause solver replay" }).click();
  let sawBacktrack = false;
  for (let i = 0; i < 40; i++) {
    if (
      await page
        .locator(".event-card")
        .getAttribute("class")
        .then((c) => c?.includes("event-backtrack"))
    ) {
      sawBacktrack = true;
      break;
    }
    await page.getByRole("button", { name: "Step solver replay" }).click();
  }
  expect(sawBacktrack).toBe(true);
  await page.screenshot({ path: info.outputPath("wfc-lens.png") });
  expect(errors).toEqual([]);
});
test.describe("touch controls", () => {
  test.use({ hasTouch: true });
  test("supports mobile controls, direct learning navigation, and accessible focus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await ready(page);
    const animatedVertices = await page.evaluate(async () => {
      const fiber =
        await import("/wfc/node_modules/.vite/deps/@react-three_fiber.js");
      const scene = fiber._roots
        .get(document.querySelector("canvas"))
        .store.getState().scene;
      let active = 0;
      scene.traverse(
        (object: {
          geometry?: {
            getAttribute(name: string): { array: Float32Array } | undefined;
          };
        }) => {
          const birth = object.geometry?.getAttribute("townBirth");
          if (birth) for (const time of birth.array) if (time > 0) active++;
        },
      );
      return active;
    });
    expect(animatedVertices).toBe(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
    const before = await saved(page),
      p = await projectCell(page);
    await page.touchscreen.tap(p.x, p.y);
    await expect
      .poll(async () => (await saved(page)).edit)
      .toBe(before.edit + 1);
    const after = await saved(page),
      next = await projectCell(page, p.cell),
      cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: next.x, y: next.y }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: next.x + 60, y: next.y + 15 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    expect((await saved(page)).edit).toBe(after.edit);
    await page
      .getByRole("button", { name: "Reset camera", exact: true })
      .click();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Build", exact: true }),
    ).toBeFocused();
    expect(
      await page
        .getByRole("button", { name: "Build", exact: true })
        .evaluate((e) => getComputedStyle(e).outlineStyle),
    ).toBe("solid");
    await page.getByRole("button", { name: "Make a town" }).click();
    await expect(
      page.getByRole("region", { name: "Town generation" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close generation controls" })
      .click();
    await page.screenshot({ path: test.info().outputPath("mobile.png") });
    await page.goto("learn");
    await expect(
      page.getByRole("heading", { name: "Playback" }),
    ).toBeVisible();
  });
});
