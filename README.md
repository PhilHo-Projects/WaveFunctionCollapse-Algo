# Canal Town

A small Japanese canal town built from a Blender kit and a real, reversible 3D Wave Function Collapse solver. Shape building volumes, connect waterfronts with footbridges, and open the WFC lens to inspect the architectural decisions.

## Run locally

```sh
npm ci
npm run dev
```

Open **http://localhost:5173/wfc/**. Direct links and assets use the same `/wfc/` base. `npm run build` creates `dist`; `npm run preview` serves the production build locally.

- **Build:** click water or a quay for a foundation and first room; click a building for another floor, up to four.
- **Remove:** remove a top floor or a complete bridge. Right-click also removes.
- **Bridge:** select two empty quays across one to three water cells. A ghost previews the complete crossing.
- **Paint:** choose one of six plaster colours, then click a building. Connected rooms share a colour; painting supports undo/redo and JSON saves.
- Architecture grows into place with staggered spring motion and shrinks on removal. Reduced motion skips these transitions. Placement sounds are opt-in through the speaker button.
- Drag to orbit; scroll to zoom. Gestures moving more than five pixels never construct anything. Touch uses the selected tool.
- Undo/redo apply whole transactions. Shortcuts: `Ctrl/Cmd+Z`, `Shift+Ctrl/Cmd+Z`, `I` for the lens, and `Escape`.
- Choose Canal village, Market bend, or Bridge quarter under **Make a town**. Seeds reproduce topology, planning, and architecture independently of decoration.
- The town saves locally. **Export/Open** round-trip versioned JSON, including exact resolved assignments. No account or server is required.
- **Learn WFC** retains the six earlier experiments, including the existing topology builder.

## Architecture

| Source | Responsibility |
| --- | --- |
| `src/canal/types.ts` | Manifest, intent, ordered solver events, versioned document contracts |
| `src/canal/grid.ts` | Triangle pairing, shared quad subdivision, convexity-preserving relaxation, reciprocal local edges |
| `src/canal/world.ts` | Guided planning, connected walking network, plot access, supported crossings, occupied volumes, persistence validation |
| `src/canal/solver.ts` | Dynamic bitsets, compiled compatibility, weighted Shannon entropy, propagation, reversible history, backtracking |
| `src/canal/worker.ts` | Revisioned cancellation; repairs within two rings, four rings, then the finite world, preferring previous choices |
| `src/canal/renderGeometry.ts` | Bilinear prism deformation, inverse-transpose normals, geometry cache, material/spatial chunks, merged picking surface |
| `src/canal/CanalScene.tsx` | GLB architecture, instanced props, semantic lantern anchors, water, lighting, camera and gestures |
| `src/canal/appearance.ts`, `dressing.ts`, `Shore.tsx` | Coherent footprint colours, exposed banks, paving/coping and landing-aware railings |
| `src/canal/motion.ts`, `CanalWater.tsx`, `SceneEffects.tsx` | Batched construction animation, planar reflections, ambient occlusion, bloom and antialiasing |
| `src/canal/replay.ts` | Domain reconstruction from actual events, including restored backtracking domains |

The planner fixes canals, quays, circulation, plots and crossings; WFC chooses room treatments and compatible roof profiles across seven vertical layers. Completed assignments are checked against every graph edge. Failed edits retain the previous valid document. Planner exhaustion, contradiction, operation exhaustion and cancellation are distinct outcomes.

The lens replays the latest solve: candidate counts, selectable ghost modules, orientation, six connectors, event entropy, propagation causes, contradictions and backtracks. The recovery study runs a difficult three-slot problem through the same solver. Loading a saved town restores its exact assembly; regenerate or edit to record a new trace.

## Blender source and export

Open **`art/canal-town/canal-kit.blend`**, authored with Blender **5.2.2 LTS** through a dedicated MCP instance. **Canal Kit Gallery** presents the catalog; **Canal Kit Library** holds canonical export meshes. `art/canal-town/kit-preview.png` is the rendered contact sheet.

The kit retains **125 solver variants**, adds **48 contextual upper-floor meshes**, and includes **ten prop families** plus authored bank coping and railings. Ground floors have entrances and awnings; upper floors have shutters, balconies and flowerboxes. Roof masks expose geometric ridge ports; bridge landing/span ports share a continuous deck profile. Baked neutral plaster is packed into the library and GLB, then tinted per connected footprint. Original module ordering and `canal-1` saves remain compatible.

Rebuild from the repository root:

```sh
npm run assets:catalog
blender --background --python tools/blender/build_canal_kit.py
```

Through Blender MCP, execute the script with `CANAL_ROOT` set to the checkout's absolute path. It replaces only its named kit/gallery collections, writes GLB/manifest/texture to `public/assets/canal-town/`, saves the editable library, and renders the gallery. Runtime browsers do not need Blender.

Canonical geometry: Y up, X/Z in `[-0.5, 0.5]`, faces **Z−, X+, Z+, X−, below, above**. Blender stores `(x, -z, y)`; glTF's Y-up export restores canonical coordinates. Shared edges reverse their local perimeter direction. Symmetric sockets match by identity; bridge rotations transform geometry and connector masks together. Roof geometry covers every legal four-edge mask.

## Verify

```sh
npm test
npm run lint
npm run build
npm run test:e2e
```

Browser tests use installed Chrome and Playwright FFmpeg (`npx playwright install ffmpeg` if needed). Captures and recordings go to ignored `test-results/`.

Coverage includes 100 medium seeds per preset (300 complete solves), connected lanes, 12 distinct footprints and two crossings, supported adjacency, bitsets beyond 32 modules, contradiction/recovery/exhaustion, reproducible edit sequences, shared deformed boundaries, rotated normals, exported connector profiles, save validation, bridge transactions, camera/touch gestures, cancellation, unavailable GLB/WebGL, legacy routes, 390-pixel layout, focus and reduced motion. All seven pre-existing topology tests are included in `npm test`.

See [the beauty-pass verification](docs/canal-town-beauty-verification.md) for current measurements and captures, and `docs/canal-town-verification.md` for the earlier baseline. Performance depends on hardware and world size. The full frame now includes reflections, shadows and post-processing; its counters are not directly comparable to the baseline's single-render counters. Lens playback deliberately reconstructs geometry. Generation and long repairs stay in the cancellable worker.

## References and portability

Conceptual references: [Townscaper](https://oskarstalberg.com/Townscaper/), [Sylves' shared quad grid](https://github.com/BorisTheBrave/sylves/blob/main/src/Sylves/Grid/Extras/TownscaperGrid.cs), [Marian Kleineberg's Blender-module WFC](https://marian42.de/article/wfc/), and [Maxim Gumin's WFC](https://github.com/mxgmn/WaveFunctionCollapse). This project uses its own TypeScript implementation and original generated Blender geometry.

Portable GLB assets and versioned town data can support a later Unity prototype. Unity, infinite generation and multiplayer remain outside this build. The public deployment is [philippeho.dev/wfc](https://philippeho.dev/wfc/); see [deployment notes](docs/deployment.md). Bundled Shippori Mincho and IBM Plex font licenses are in `public/assets/fonts/`.
