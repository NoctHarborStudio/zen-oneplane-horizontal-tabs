# OnePlane source layout — migration stage 1

Edit source here; do not hand-edit the generated root layout.uc.mjs or chrome.css.

- core: lifecycle, window scope and preference snapshot.
- native: native tab identity and split helpers.
- layout: geometry, panel visibility, shared surface and contour.
- toolbar: address, tab strip, indicator, hover, mirrored tabs.
- interactions: drag and drop, Bunny ghost, Split View.
- algorithms: standalone ESM pure functions (Node tests; no browser globals).
- styles: ordered CSS source sections, preserving selector nesting and cascade.

The .js.part and .css.part files are **transitional source sections**, not independently executable modules. They retain the existing shared installTabStrip closure and stylesheet nesting. The build plan deliberately preserves lexical order; it is not a general ESM bundler. Pure .mjs modules are directly importable for tests and inlined into the generated bundle. Do not register source modules individually with Sine.

Run npm run build, then npm run verify. There are no external npm dependencies.

Active development: Nocturne 0.4.0 stabilization, see [architecture](../docs/nocturne/architecture.md) and [pipeline](../docs/nocturne/pipeline-0.4.0.md). Hub and native workspace integration already exist. Shared synchronous DisposableScope is in core/disposable-scope.mjs and inlined into Layout and Library Services; use per-owner instances, not a global registry. Other lifecycle owners remain in migration.

Workspace commands: `core/workspace-commands.mjs` is a named-export pure/testable module inlined before Home and Hub. It owns mod-origin command leases and native structural verification; do not call native workspace selection independently from a new Nocturne view. WorkspaceTransition receives the same lease. Native state remains in Zen.

Startup Animation is now generated from `algorithms/startup-timeline.mjs` and `core/startup-animation.js.part` by the same build plan. Edit these sources, not `startup-animation.uc.mjs`; its Sine registration is unchanged.

Motion math: `algorithms/magnetic-fold.mjs` is inlined before Center Motion and also in the generated comparison Lab. `algorithms/startup-bloom.mjs` is shared by the isolated Center Motion and Home candidates, the Startup timing selector and the comparison Lab. Startup contains the integrated candidate behind the disabled source-only BLOOM_CANDIDATE switch; no installed session selects Bloom. The build plan generates `docs/nocturne/labs/startup-motion.html` from `labs/` sections and the shared pure modules; no new Sine entry. Edit sources, not the generated Lab.


A4.1: `src/algorithms/contour.mjs` owns pure contour preferences, visible/stable envelope math, deterministic key, renderer and ordinary transactional mask commit. `src/layout/contour-controller.js.part` reads DOM and consumes visible mode; legacy `bookmarks.uc.mjs` stable override is still active until A4.2. Preserve pinned provenance and explicit mixed-version fallback during provider migration.


Active scope (2026-11-19): Nocturne-only. The independent Refined package is not a supported runtime peer; A4.2 needs internal Sine ordering and lifecycle fallback, not a second renderer for Refined. Retain source provenance and existing preference identifiers.


A4.2: Layout owns the only contour mask and cache. Magnetic Bookmarks is an internal resting envelope provider via the existing window registry. No secondary SVG renderer or CSS override; source provenance remains recorded in the lock. A4.2-R and native evidence pending.


A4.2-R: revision-2 internal bookmark registry fences install/release and old-owner upgrades. Layout keeps one renderer and acknowledges existing invalidation revisions after a valid stable paint; clean prehover can reuse it. A4.3 geometry coordinator next after CI.
