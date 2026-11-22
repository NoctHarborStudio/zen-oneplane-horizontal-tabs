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


A4.3a: Layout geometry owns a single height/contour dirty RAF, pass-local row rectangles and synchronous preflight. Existing direct centering/feature motion paths remain; do not cache rectangles across structural writes or frames. Next integrated audit and remaining resting geometry consolidation.


A4.3b: geometry coordinator uses CENTER/HEIGHT/CONTOUR bits and exact callback tickets. Immediate native centering can request height-only follow-up without erasing pending center; forced preflight rejects reentry and preserves new requests. No persistent rectangle cache. Remaining explicit preflight outcome integration and resting centering/partition consolidation belong to A4.3c.


A4.3c1: synchronous geometry preflight returns a versioned success boolean; active Startup/Workspace consume rejection and release their existing visual gates. Resting partition extraction remains A4.3c2.


A4.3c2: `src/algorithms/toolbar-center.mjs` owns pure resting budget and partition metrics (imports existing island-boundary/tab-overflow algorithms; build order already satisfies dependencies). Layout measures/applies; tab-sync projects from its native snapshot. No new runtime entry or persistent geometry cache. A4.3-R next.


A4.3-R: Layout force preflight checks the exact native/mirror topology and phase around center/height/contour. Failed force retains pending work; projection sync and lane mounting reject stale callback/owner state. Keep existing physical measurements and feature motion ownership. A4.4 next after CI.


A4.4a: Layout resting gate is shared by center/height/contour, projection and ordinary overflow interaction. Existing drag and cascade owners schedule replay on release; hidden cascade is stable. Explicit Split pull and lane autoscroll remain owner-specific exceptions. Native hit-region work follows in A4.4b.


A4.4b: contour is visual-only; actual Home wrapper, spacer and resting strip own native window drag, control/no-drag exclusions and phase gates apply. Split Drop and address shield are active content owners, not window handles. Local tab drag viewport capture belongs to existing Drag Engine lifecycle; cancellation never synthesizes drop. A4.4-R next.


A4.4-R1: foreign-window strip preview is a destination-local lease within existing drag fragments, not a new owner/scheduler. The exact source controller/token and viewport are required at drop; resize/phase invalidation releases preview, fresh trusted dragover re-admits. Source completion clears only matching previews. Native event identity remains A5.


A4.4-R2: native tab input shares one local phase gate, and native edge-control X geometry is an ephemeral snapshot validated at commits and existing geometry observers. No new scheduler, observer, renderer or persistent chrome geometry cache. Source fixture coverage is distinct from Zen native acceptance; A5 owns irreversible split/drag command outcomes.


A5.1a: `src/native/tab-adapter.js.part` is the sole existing custom-flavor source-resolution path. Protected Gecko dragover fallback returns a tab only if one valid active controller/token exists; explicit trusted payload is preferred. The controller token does not certify native OS DataTransfer identity. Never add a separate source registry to emulate native tabs.


A5.1b1: native tab/group postconditions are ephemeral reads in `src/native/tab-adapter.js.part` and checked by existing drag consumers. Rejected or partial delivered custom drop still settles the exact source lifecycle token, without pretending a native mutation was successful or launching a second window. No new module/owner/observer/RAF or speculative rollback. True OS drag session identity remains a separate A5.1b2 gate.


A5.2a: `src/interactions/split-drop.js.part` owns native Split custom drag admission and exact-token terminal cleanup. It reads ephemeral live native tabs/pin roles/Split groups, revalidates command identity after native selection callbacks and never duplicates a native tab just to simulate a successful move. Reuse existing Drag Engine lifecycle and `sourceHandled` optional expected token; do not introduce a second Split session registry or unverified rollback.


A5.2b1 (preview.116): the existing Split Drop owner reads exact native `TabGroup.tabs` and returned Zen `splitTabs().tabs` for synchronous postconditions; preflight rejects inconsistent native group topology. Unsplit confirms native size-two dissolution or exact surviving members for larger groups. No additional Split registry, native cache, rollback, observer or animation engine; async native convergence, folders and OS session identity need native acceptance. Canonical preview.116 CI 45045274006 PASS (726 Node, 15 Python, reproducible build/published artifacts); native acceptance still pending.


A5.3a (preview.117): the existing one-native-list Downloads service admits exact current Download objects for Dock via `dragNative`, while Library continues using `drag(id)`. Both reuse the sole synchronous native Gecko payload constructor in `src/services/library-services-runtime.js.part`, with an explicit Dock-private vs Library-public policy. The Dock retains the same Bunny native image and lifecycle. Do not reintroduce a second payload builder or download list. Canonical CI 45054533303 PASS (728 Node, 15 Python); native Gecko/OS drag handoff remains unverified.


A5.4a (preview.118): Hub workspace drag and native tab Bunny already use the single Display Engine `placementAt`/native monitor policy; unreachable alternative `hubSnapRect` and `hubOtherDisplay` pure exports were deleted. The existing `displayPreviewKey` pure function now validates the work-area/target presentation cache. The XUL preview reflows and moves only when its actual full/work/target geometry or anchor changes. Do not reintroduce a second snap policy in Hub. Canonical CI 45055890065 PASS (728 Node, 15 Python, deterministic build and served package); native DPI/multi-monitor and actual OS acceptance remain pending.


A5.5a (preview.119): `src/interactions/drag-engine.js.part` keeps one token-owned Gecko native tab session watcher and now handles absent vs unavailable `getCurrentSession` observations with bounded local cancellation. The independent `downloads-indicator.uc.mjs` root entrypoint now arms one native file source watcher before optional Bunny graphics and uses it for popup-readiness checks; popup hiding stops visual work, not the native data payload. `src/library/controller.js.part` has a scoped watchdog only when Dock rejects/unavailable and the Library falls back to direct native service file payload. Do not add a second observer or timer to accepted Dock-owned drags. Generated `layout.uc.mjs` and `library.uc.mjs` are assembled from these owners; OS acceptance, session identity and performance remain native gates.


A5.5a canonical CI: `preview.119` [run 45057503562](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45057503562) PASS (734 Node, 15 Python, deterministic build, runtime and served package). This is source and package verification, not native OS DragSession or file-drop acceptance.


A5.6a (preview.120): Downloads Dock's native OLE file artwork timer stays at 16 ms, but only visibly changed relative poses incur style/layout flush. Native popup position, source lifecycle and OS payload are unchanged. Tab Bunny retains a sticky `outside` image ownership latch; the formerly unreachable outside-to-local image clearing branch is removed. Actual Gecko reentry, file OS drop and performance still require native validation.

A5.6a canonical source/CI closure (preview.120): [CI 45058630741](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45058630741) PASS (737 Node, 15 Python, runtime/package); standalone bookmarks provenance lock refreshed in a docs-only follow-up after its diagnostic version label changed. Native drag-image and OLE visual fidelity still require Zen acceptance.


A5.7a (preview.121): Startup Search restore uses the existing native Drag Engine gesture token and an exact timeout generation, invalidating on new trusted input/drag, native selection, navigation, and teardown. Native URLbar remains authoritative. Six source-backed regression cases cover stale timer reentry and replacement without introducing a new scheduler. NC4-065 empty strip native adoption and NC4-066 topology change remain independent native evidence gates.
