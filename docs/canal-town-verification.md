# Canal Town verification

This is the pre-beauty-pass baseline. See [the current visual upgrade and verification](canal-town-beauty-verification.md) for the updated kit, rendering, tests and captures.

Local build on 2026-10-19, branch `codex/canal-town`. Existing uncommitted topology work was retained. No deployment, Unity work, external services or subagents.

## Implementation

All five planned milestones are implemented: Blender-authored architecture and headless WFC, shared irregular quads and deformation, transactional construction and bridges, guided seeded planning and persistence, and the diorama/lens interface.

The `komorebi` medium default has 460 ground cells, 67 occupied building cells and three bridges. There are seven vertical slots per cell, supporting four room floors. The GLB has 125 solver variants across 28 architectural families, plus six prop families. The editable Blender source includes a gallery scene and a rendered contact sheet.

The 300-seed suite checks each of the three presets across 100 medium seeds. It requires at least 12 distinct connected building footprints, two supported crossings, connected walking circulation, lane access, and a successful architectural solve. Every successful assignment is validated against every supplied graph interface.

Regression coverage includes pinned incompatible neighbors, dynamic bitsets beyond 32 modules, genuine backtracking/recovery, impossible and exhausted problems, cancellation, reproducible edits, JSON restoration and rejection, shared quad boundaries, roof connector profiles, bridge ports through every supported rotation, inverse-transpose normals, and replay of frozen local repair domains.

## Automated checks

- `npm test`: 23 Vitest cases passing, including the 300 full medium solves; all seven original topology tests passing.
- `npm run lint`: clean, with no disabled rules.
- `npm run build`: TypeScript and Vite production build passing.
- All 11 Chrome browser checks passing: construction, camera drags, complete bridge transactions, undo/redo/reload, import/export, contradictory edit rollback, cancellation, missing GLB, missing WebGL, legacy direct routes, evening rendered color, true backtracking playback, 390-pixel touch input, keyboard focus and reduced motion. [Recorded outcomes](media/browser-checks.json).
- Production preview smoke check at `/wfc/` and `/wfc/learn`: passing, no JavaScript errors or failed asset requests.
- `npm audit --omit=dev`: zero vulnerabilities. Seven development-tool advisories remain in the Tailwind 3 toolchain; resolving them requires an unrelated major toolchain migration. Vite reports its standard large Three.js chunk warning.

## Desktop measurements

Machine: `DESKTOP-OLTIAJ4`, Intel i7-9700K, NVIDIA RTX 2070 through ANGLE/D3D11, Chrome, 1920×1080 viewport, medium `komorebi`, lens closed.

| Measurement | Observed | Target |
| --- | --- | --- |
| Draw calls | 83 | Fewer than 150 |
| Visible triangles | 307,251 | Recorded for reference |
| Warm edit to saved commit, final five-sample browser run | 119–155 ms | Usually below 250 ms |
| Animation-frame cadence | 30.4 FPS | 60 FPS |
| Empty-page animation-frame cadence in the same session | 30.5 FPS | Control measurement |
| Synchronous `render + gl.finish`, 20 samples | 0.2–0.6 ms | Diagnostic only |

**The 60 FPS acceptance target is unverified in this remote-display session.** An empty browser page has the same approximately 31 Hz cadence. The synchronous rendering sample excludes animation, UI and compositor overhead and does not establish end-to-end 60 FPS. Recheck on the desktop's native display before claiming that target.

Raw data is in [browser-performance.json](media/browser-performance.json) and [showcase performance.json](media/performance.json). The recording utility is `node tools/capture-canal-demo.mjs`; it uses the running development server, creates a fresh town, performs actual edits, orbits, changes lighting and opens both solver views. It records JavaScript errors and fails if any occur.

## Captures

- [Daylight](media/daylight.png)
- [Lantern evening](media/evening.png)
- [Construction](media/construction.png)
- [Town WFC lens](media/wfc-lens.png)
- [Actual backtracking](media/backtracking.png)
- [Bridge preview](media/bridge-preview.png)
- [390-pixel touch layout](media/mobile.png)
- [Short demonstration recording](media/canal-town-demo.webm)
- [Blender kit gallery](../art/canal-town/kit-preview.png)

The Playwright suite also produces bridge-preview and mobile captures in ignored `test-results/`.

## Practical limits

The world is finite, and architectural diversity comes from the current kit. Roof connectors are symmetric cross-sections; bridge orientation is encoded by rotated masks. Future asymmetric modules would need richer connector symmetry metadata. Local repairs freeze valid previous choices outside the repair radius and prefer old choices inside it, then expand to the full world if required.

Saved documents retain resolved assignments and kit version; they do not persist the complete solver trace or undo stack. Edit position is retained. Loading restores the exact town; an edit or generation records a new trace. The lens is a replay of those actual solver events, including the worker's original fixed domains.

Portable GLB, canonical coordinates, intent and versioned assignments are available for later reuse. No Unity prototype or deployment was performed.
