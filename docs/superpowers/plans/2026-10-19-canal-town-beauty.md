# Canal Town Beauty Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. User instructions require permission before any subagent; none are used. Steps use checkboxes for tracking.

**Goal:** Make Canal Town a visually rich, responsive browser building toy through better assets, contextual assembly, lighting and motion.

**Architecture:** Preserve the solver/catalog ordering and existing save contract. Add deterministic presentation data around the intent, contextual Blender meshes, animated transient architecture and batched settled geometry. Split scene presentation into focused modules as needed.

**Tech Stack:** TypeScript, React Three Fiber, Three.js 0.183, Blender 5.2, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-canal-town-beauty-design.md`

## Global constraints

- Inline in the current checkout; preserve existing work; no deployment or baseline commit.
- Stable solver module ordering and valid old saves. Connectors retain their existing canonical profiles.
- Connected lanes, supported crossings, deterministic seeds, transactional undo/redo, and reduced motion remain required.
- No extra runtime service. Prefer existing dependencies.

## Review focus

- Old saved documents missing optional presentation fields still load with the same assignments.
- Rapid edits/undo during animation settle to the latest document without stale geometry.
- Bridge landing decoration never blocks the crossing or places a railing across it.
- Materials modified for animation/night/colour are not leaked or shared incorrectly.
- Reduced motion and mobile controls remain operable; scene rendering errors are surfaced.

## Task 1: Preserve baseline and presentation contracts

Files: `src/canal/types.ts`, `src/canal/world.ts`, new `src/canal/appearance.ts` and tests.

- [x] Archive the relevant current source/assets outside the repo and run baseline unit tests.
- [x] Add tested deterministic footprint colour/style selection and optional validated paint data, keeping old documents compatible.
- [x] Test shared footprint identity, seed determinism, colour validation and old-save restoration.

## Task 2: Rebuild the Blender kit

Files: `tools/blender/build_canal_kit.py`, `public/assets/canal-town/*`, `art/canal-town/*`, `src/canal/assets.test.ts`.

- [x] Replace thin repeated lattice/roof noise with readable authored ground floors, upper floors, eaves, roof courses and planted details.
- [x] Build actual contextual assets for railing/coping, market details, flowers, trees and boats; maintain deck/ridge profiles.
- [x] Export GLB and manifest in Blender, save source, render gallery, inspect it, and run connector/asset tests.

## Task 3: Contextual town and richer composition

Files: `src/canal/world.ts`, `src/canal/appearance.ts`, new dressing geometry/component, `src/canal/renderGeometry.ts`, relevant tests.

- [x] Test and implement varied heights and coherent clusters while preserving 300-seed circulation/crossing guarantees.
- [x] Assemble paved quays, exposed masonry/coping, landing-aware railings, flower beds and contextual props in merged/instanced batches.
- [x] Render upper-floor variants and coherent colours; verify old assignments still resolve.

## Task 4: Water, lighting and satisfying construction

Files: `src/canal/CanalScene.tsx`, new water/atmosphere and animation modules, animation tests.

- [x] Implement reflective animated water, shoreline treatment, balanced daylight/evening and ambient depth.
- [x] Test document-diff selection and interrupted transition behavior; animate transient pieces from their foundations with overshoot, stagger and removal.
- [x] Add optional synthesized placement sound; respect reduced motion and browser gesture requirements.
- [x] Inspect daylight/evening/close-up captures and profile render cost, adjusting visual quality to keep interaction responsive.

## Task 5: Controls, visual iteration and verification

Files: `src/canal/CanalTown.tsx`, `src/canal/canal.css`, browser tests/capture tools, docs.

- [x] Refine floating world-focused controls and framing; wire colour and sound controls into persisted/undoable actions where appropriate.
- [x] Exercise build/remove/bridge/paint, undo/redo, save/export, cancellation, lens, night, touch and reduced motion.
- [x] Run `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`; fix regressions.
- [x] Capture the finished town and Blender gallery, record measurements and limitations, and update the implementation ledger.
