# Canal Town visual upgrade — verification

Implemented on 2026-10-19 in the existing `codex/canal-town` checkout. The pre-existing work was archived outside the repository before asset regeneration. Implementation and review were performed inline. Nothing was deployed or committed.

## What changed

- Rebuilt the Blender kit with ground-floor entrances/awnings, 48 upper-floor variants with balconies/shutters/flowerboxes, broader eaves, quieter roof courses, paved foundations, real bank coping and railings, richer trees, flowers, market furniture and boats.
- Preserved all 125 ordered solver variants and canonical roof/bridge interfaces. `canal-1` documents remain compatible. The GLB is 6,978,232 bytes; the editable `.blend`, generator script and rendered gallery are included.
- Generated towns have more varied heights and a four-storey focal building on medium/large maps. Default medium `komorebi` has 83 occupied plots and three bridges across 460 cells. The 300-seed planning/solve suite still passes.
- Connected footprints receive deterministic plaster colours. The six-colour paint tool updates an entire footprint, supports undo/redo and persists in the version-1 document's optional `intent.paint` field. Invalid paint data is rejected.
- Added planar water reflections, quiet surface motion, shoreline foam, construction ripples, ambient occlusion, restrained bloom, antialiasing and glowing evening windows. Mobile widths omit ambient occlusion.
- Batched architecture now grows from individual pivots, overshoots and settles. Changed pieces animate; unchanged pieces retain their original timestamps. Removed meshes shrink and retire after 280 ms. Shadow and AO geometry follow the same animation. Reduced motion skips construction and water motion.
- Added opt-in synthesized placement sounds and a palette above the construction dock. Fixed immediate toolbar-to-canvas selection handoff across React roots and accessible names for icon-only mobile controls.

## Checks

| Check | Result |
| --- | --- |
| `npm test` | 29 Vitest cases and seven original topology checks pass |
| Planning coverage | 100 medium seeds per preset, 300 full solves |
| `npm run lint` | Pass; narrow documented exceptions cover imperative Three.js mutation/timestamps |
| `npm run build` | Pass; existing large Three.js bundle warning remains |
| `npm run test:e2e` | All 12 Chrome tests pass |
| Production preview | `/wfc/`, paint controls, evening toggle and `/wfc/learn` load with no JS errors or failed requests |
| Visual review | Daylight, evening, mobile, painting and Blender gallery inspected |

Browser checks exercise build/remove, dragging, complete bridge transactions, paint/undo/redo/reload, JSON import/export, failed-edit rollback, cancellation, missing assets/WebGL, legacy routes, actual solver recovery, mobile touch, focus and reduced motion. Reduced-motion coverage checks that architectural vertices have no active reveal timestamps. Cache tests interrupt removal with undo and verify that transient geometry disappears while unchanged pieces retain their original animation state.

Review corrections included roof surface tessellation for bilinear deformation, a calmer roof pattern, MSAA for the post-processing target, material disposal deduplication, render-state restoration, and avoiding duplicate shadow rendering during the AO pass.

## Measurements

Machine: `DESKTOP-OLTIAJ4`, i7-9700K, RTX 2070 through ANGLE/D3D11, Chrome, 1920×1080, medium `komorebi`.

| Measurement | Observed |
| --- | --- |
| Complete frame draw calls | 372 |
| Complete frame triangles, including repeated passes | 1,987,016 |
| Isolated colour + shadow render | 174 calls / 988,086 triangles |
| Two recorded edits, pointer click to saved commit | 235–270 ms |
| Animation-frame cadence | 30.4 FPS |
| Capture JavaScript errors | None |

The full-frame counters now include reflection, colour, shadow, AO and post-processing work. The old report's 83 calls and 307k triangles counted one render with automatic counter resets, so those figures are not an equivalent comparison. During this pass, batching and removal of a redundant shadow render reduced the new complete-frame count from 838 to 372.

The earlier empty-page control measured approximately 31 Hz in this same remote-display environment. **Native-display 60 FPS and physical-phone performance remain unverified.** The optional synchronous diagnostic in the raw data times an isolated colour/shadow render; its first sample incurs a roughly one-second cold shader/driver stall, followed by 0.4–0.8 ms warm samples. It excludes the other passes and is not an end-to-end frame-time claim. The extra visual detail also makes edits somewhat more expensive than the baseline.

[Raw capture measurements](media/beauty/performance.json). Reproduce the recording with `node tools/capture-canal-demo.mjs docs/media/beauty` while the development server runs.

## Review the result

- [Daylight](media/beauty/daylight.png)
- [Lantern evening](media/beauty/evening.png)
- [Construction](media/beauty/construction.png)
- [Paint controls](media/beauty/paint.png)
- [390px mobile layout](media/beauty/mobile.png)
- [WFC lens](media/beauty/wfc-lens.png)
- [Real backtracking](media/beauty/backtracking.png)
- [Demonstration recording](media/beauty/canal-town-demo.webm)
- [Blender gallery](../art/canal-town/kit-preview.png)

## Remaining limits

The world still uses a finite irregular grid with one solid height column per plot, capped at four floors. It cannot represent free-standing arches, overhangs, suspended rooms or arbitrary occupancy. Those require occupancy/topology work and compatible new mesh families. Joining painted footprints chooses the first explicit colour by cell order; repainting the joined building overrides the whole footprint. Saves retain exact assignments and colours, but not undo history or solver traces.

The reflective-water/lighting treatment is stylized, with one planar reflection and a fixed shadow-map extent. There is no water physics, dynamic global illumination or animated population. The kit is richer but still finite. Broad high-end/native-renderer parity is not established by this pass; the result demonstrates that this project's browser presentation had substantial room to improve.
