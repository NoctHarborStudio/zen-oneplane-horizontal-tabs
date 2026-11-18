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
