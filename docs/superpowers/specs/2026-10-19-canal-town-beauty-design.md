# Canal Town: a living canal miniature

## Intent and scope

The user wants the existing browser toy pushed substantially toward the craft and responsiveness of the Townscaper reference. They authorize planning and implementation, including Blender. Work inline in the existing `codex/canal-town` checkout; preserve the uncommitted baseline, legacy routes, and local saved towns. Do not deploy or commit the baseline.

The chosen approach develops the existing Three.js/Blender pipeline. A rendering-only pass would leave repetitive buildings and flat quays; an engine migration would spend the effort without addressing either. This pass therefore combines authored assets, contextual assembly, deliberate planning, lighting, and motion. It retains the finite solid-column world model; arbitrary arches and unsupported volumes need a separate occupancy design.

## Visual direction

A handcrafted Japanese canal miniature: deep indigo ceramic roofs, generous eaves, cream/apricot/sage plaster, warm cedar, stone paving, planted streets and a turquoise canal. Broad material regions and softened silhouettes replace dense thin roof lines. Waterfront boundaries get masonry, coping, occasional railings, reeds and a bright shallow-water edge. Bridges should feel substantial and deliberate.

Palette: canal turquoise `#579eac`, deep water `#326c80`, indigo `#344f69`, sunlit plaster `#f2d7a4`, persimmon `#d88965`, pine `#527c62`. Existing Shippori Mincho remains the restrained display face, IBM Plex Sans serves controls, IBM Plex Mono serves diagnostics. The world fills the viewport; small floating controls let it carry the identity. Construction is the signature interaction: pieces grow from their base, overshoot and settle, with subtle ripples and optional sound.

## Architecture and assets

- Keep canonical connector coordinates and stable solver module ordering. Refine the canonical GLB geometry and add upper-floor/contextual assets without corrupting saved assignments.
- Build real ground-floor entrances, distinct upper-floor windows/balconies, chunkier eaves, readable roof courses, richer trees, flower planters, boats, market furniture, and waterfront railings in Blender. Save an editable source and updated gallery.
- Derive coherent building colours from connected footprints; optional paint changes must be deterministic, persisted, undoable and validated.
- Derive waterfront/paving/detail geometry from the grid and intent. Keep bridge landings clear and preserve connected circulation.
- Give generated towns purposeful clusters, a varied one-to-four-storey skyline and a few taller focal buildings while keeping distinct footprints and crossing validity.
- Put water/atmosphere, architectural animation, and contextual dressing in focused scene modules. Reuse material/spatial batching for settled geometry.

## Interaction

New and changed architecture animates at the affected cell/layer; unchanged buildings remain still. Removed pieces have a brief exit. Regeneration has a staggered reveal. Interrupted edits, undo/redo, and seed changes must not leak geometry or strand half-scale buildings. Reduced motion resolves directly to the final state. Sound is opt-in and is created only after interaction.

Keep build/remove/bridge, undo/redo, save/open/export, day/evening and WFC diagnostics usable. Add a concise colour selection if the implementation can preserve the transaction and save contracts. Use a quieter floating header/dock and better world framing; retain keyboard focus and 390px touch usability.

## Verification and acceptance

The result must look substantially richer at default zoom and hold up when zoomed in, in daylight and evening. Inspect browser screenshots and the Blender gallery, then iterate. Keep all existing solver, topology, connector, persistence, and browser checks passing. Add meaningful tests for new deterministic assembly/colour semantics, animation selection and interruption, and any changed planning guarantees. Run lint and production build. Record new draw calls, triangles and edit responsiveness with the prior frame-rate limitation accurately stated.
