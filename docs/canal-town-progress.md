# Canal Town implementation ledger

Accepted specification: the Canal Town plan in this chat, 2026-10-19.

Work remains inline. Existing uncommitted topology work is the baseline and must be preserved. No deployment, Unity, or subagents.

## Decisions

- Reuse the current checkout on `codex/canal-town`, as authorized; do not create another worktree or commit the user's baseline changes.
- Use the installed Blender 5.2.2 at `F:/Blender Foundation/Blender 5.2/blender.exe` with a dedicated background MCP instance.
- Keep legacy experiments working; introduce a separate pure TypeScript canal subsystem.
- Architectural connector profiles and Blender geometry come from one generated manifest. Roof connections are solved, rather than chosen by the renderer.

## Progress

- Baseline audit: seven passing topology tests, a passing build, and 26 pre-existing lint errors. The existing topology work was preserved.
- Milestone 1: pure solver, real backtracking fixture, 125-module Blender export, browser scene implemented. Roof winding regression found with a GLB normal test and fixed.
- Milestone 2: paired-triangle/shared-quad topology, convex relaxation, bilinear deformation, transformed normals, material/chunk cache, and merged picking implemented. Shared edge and rotated normal tests pass. Medium town measures 83 draw calls / 307k triangles.
- Milestone 3: build/remove, local repair (2/4/full), undo/redo, persistence and bridge creation/removal implemented. Initial three browser tests passed. Pointer gesture checks cover camera orbit without edits.
- Milestone 4: three presets implemented. 100 seeds for EACH preset (300 full solves) passed, including minimum 12 distinct footprints and two bridges. This suite found overlapping planned bridge crossings; selection now excludes shared span cells.
- Milestone 5: full-screen UI, bundled fonts, daylight/evening, semantic lantern anchors, construction feedback, crossing preview, event replay, candidate ghosts, connector inspection and real backtracking implemented. Blender source opens into a rendered 28-family gallery.
- Legacy fixes: organic failure outcome regression passes; shared generation hook now cancels old frames. Type-safe hover interfaces replace `any`. Initial grid reset effects replaced with explicit event actions. ESLint is clean without disabling rules.

## Final verification

- 23 unit cases, all seven original topology tests, and all 11 Chrome browser checks pass. All 300 medium seed solves pass. Lint and production build pass.
- Production preview routes and asset loading pass. Production dependency audit reports zero vulnerabilities.
- Review found and fixed a roof winding defect, rotated normal mismatch, overlapping planned crossings, disconnected lanes, stale shader uniform references, and omitted frozen domains during local repair replay.
- The browser harness now selects roof triangle interiors: aiming at the exact roof silhouette was sensitive to native pointer float rounding. Camera drags still commit no construction.
- Final warm edits measured 119–155 ms. The 60 FPS target remains unverified because this remote-display session caps both the town and an empty page near 31 FPS.
- Screenshots, demonstration video, raw measurements and limitations are documented in `canal-town-verification.md`.
- Review was performed inline; no subagent permission was requested or used. Branch remains local and changes remain uncommitted for review.
