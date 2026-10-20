# Sequential town reveal

The generated result is committed and saved once; playback only changes presentation. A deterministic connected traversal schedules one plot every 100 ms by default, with floors and details staggered within the plot. Fast (30 ms), Steady (100 ms), Slow (250 ms) and Instant are available before generation and during playback. Finish now skips to the completed town. Reduced motion and loading an existing save display the completed town immediately.

Use one virtual presentation clock shared by architecture, shadows/AO, instanced props and shoreline details. Speed changes advance that clock at a different rate without rebuilding geometry or restarting the reveal. Regenerating the same seed gets a new presentation identity. Camera orbit remains available; editing is held until completion, while generation, import and inspection safely finish or replace playback.

Keep the existing cream/cedar/indigo UI, Shippori Mincho headings and IBM Plex controls. Add a restrained speed selector to Make a town and a compact progress strip above the construction dock during playback. The emerging town is the visual focus.

- [x] Test deterministic connected ordering, speed changes, instant completion and independent replacement timelines.
- [x] Implement shared shader playback for architecture, props, banks, reflections and AO without per-step geometry rebuilds.
- [x] Add speed preferences, live progress and Finish now; preserve edit/save/undo behavior and reduced motion.
- [x] Verify same-seed replay, speed changes, Instant, interruption, persistence and mobile layout in the browser; run the required checks.

Release through the existing manual static deployment documented in `docs/deployment.md`. The published source commit is recorded at `/wfc/release.json` after deployment.

Verification: 32 Vitest tests and seven topology checks pass; lint and production build pass. All 15 browser scenarios pass across the full run and targeted cancellation rerun. The cancellation harness now holds a real worker completion until after Cancel, removing a race with fast solves and explicitly checking a stale result. Browser assertions compare the actual GPU shoreline/lantern-reflection clock with the presentation clock, confirm geometry identities remain unchanged across speed changes, and compare saved documents before and after playback. Desktop day/evening and 390-pixel mobile captures were inspected.
