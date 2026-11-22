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

A5.7a canonical source/CI closure: [CI 45059536163](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45059536163) PASS (743 Node tests, 15 Python, deterministic build and published package). Exact native gesture token/monotonic restore ticket protects against stale 80 ms search reopens; native Zen behavior remains unverified.

A5.7b (preview.122): the cross-window native tab drop into an empty active Workspace is admitted only against Zen's connected regular-tabs container and the real painted strip/new-tab hit region; native `moveTabToWorkspace` owns placement after `gBrowser.adoptTab` without a fabricated tab index. Existing incoming source lease now captures destination Workspace identity. Unsupported roles and unclear native state fail closed; eleven source-backed fixtures cover success/rejection/partial result. Native Gecko/Zen acceptance pending.

A5.7b source/CI closure (preview.122): [CI 45061035123](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45061035123) PASS (754 Node / 15 Python / generated artifacts). The required active Workspace/`moveTabToWorkspace` API is confirmed in the official Zen 1.24.2b source tag; native Gecko OS drag/drop and visual acceptance remain unverified.

A5.7c (preview.123): the existing drag lifecycle now carries an ephemeral Zen-native structural snapshot (tab order/group/pinned/parent/Workspace) and retires its exact source gesture before Tab Sync changes mirrored DOM after a native structural mutation. Legitimate accepted local native TabMove remains owned by the existing commit path. Foreign delivered drops reject stale source topology; insertion tail invalidation remains local and non-mutating. Ten source-backed regression fixtures PASS; native Gecko/Zen acceptance remains pending.

A5.7c canonical source/CI closure (preview.123): [CI 45062577060](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45062577060) PASS (764 Node, 15 Python, reproducible generated runtime and package). The initial frozen-sync fixture was updated to evaluate the actual idle-safe topology fence; production runtime is unchanged by the repair. Native Zen/Gecko acceptance remains pending.

A7 / NC4-021-R (preview.128): native History search first primes Gecko PlacesQuery cachedHistoryOptions with getHistory(), then checks its existing epoch before searchHistory(); no second cache/owner. Independent Smart Search entrypoint restores its UTF-8 workspace/container detail separator. Source-backed regression fixtures cover both.

A7 / NC4-024-R (preview.129): independent Page Progress entrypoint carries the latest native nsIRequest per browser, ignoring mismatched late STOP/progress during overlapping top-level network loads. The existing WeakMap owns only an ephemeral reference and releases it at STOP/unload; no visual/animation redesign. Request-less Gecko events keep the prior fallback behavior. Native identity acceptance remains open.

A7 / NC4-024-R2 (preview.130): Page Progress corrects the preview.129 overly strict request correlation. Gecko's total-progress callbacks can come from subrequests and NETWORK STOP may have a different request object. Only explicitly retired native NETWORK START identities are rejected; a bounded per-load set is cleared on terminal STOP/unload. Three production-entrypoint regression cases cover aggregate total progress and overlapping requests. Real Zen acceptance remains open.

A7 / NC4-024-R2 canonical source/CI closure (preview.130): [CI 45067485982](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45067485982) PASS (777/777 Node, 15/15 Python, generated bundle, parser, metadata and Raw/codeload package). The production Page Progress entrypoint now accepts legitimate Gecko aggregate subrequest progress and mismatched network STOP while ignoring only known superseded START identities; native Zen graphical/OS acceptance still OPEN.

A7 / NC4-022-S1 (preview.131): existing Library controller now defers its media preference-triggered reload via a coalesced microtask, after the independent services observer has invalidated old sessions. Tested both Sine observer registration orders with the real media-service implementation, plus disposal and file-drag gates. No new service, native scanner, layout mode or timer; decoded-pixel memory and scanner memory remain independent OPEN gates.

A7 / NC4-084 (preview.132): Library History range clear and Remove/Forget now reuse the existing Library `clearing`/action generation so native destructive commands cannot run concurrently from the same shell. A pending native action temporarily blocks duplicate range or row removal, preserves Copy, and clears its gate on normal result or throw. Two source-extracted handler fixtures cover busy state, failure, and recovery; native Zen acceptance remains OPEN.

A7 / NC4-076 (preview.133): existing Downloads service bulk clear counts `requested/removed/skipped/failed`, preserving the sequential native removal semantics and eligibility guards; Library displays partial completion when a record becomes ineligible before removal. Three regressions cover skip/error/UI feedback. This is a result-contract correction, not a new clear path or any disk-file deletion. Native Zen acceptance remains OPEN.

A7 canonical stabilization after preview.133: NC4-084 [CI 45069305572](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45069305572) PASS (781 Node, 15 Python); NC4-076 [CI 45069727199](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45069727199) PASS (784 Node, 15 Python), with parser, generated outputs and public package verification. Source/CI closed, native Zen acceptance OPEN. No additional feature or runtime release in this docs-only update.

A7 / NC4-090 (preview.134): Dock bulk clearing has been switched to the existing DownloadsService.clearCompleted owner. Same-window Library/Dock overlap returns an explicit busy outcome; same Download identity cannot be removed twice during its pending native Promise, and Dock epoch/teardown still cancels subsequent items. Existing Library busy feedback and content-free counts remain. No new feature/service/timer; source regressions cover contention, row action, cancellation, and UI, with native Zen and cross-window acceptance OPEN.

A7 / NC4-090-R2 (preview.135): independent reproduction showed that the preview.134 shared bulk guard could still race across Sine hot-reload generations if a native `remove` Promise outlived DownloadsService.dispose. The same existing service now retains and awaits outstanding removal Promises before detaching its view/lease, using the established replacement barrier. Two source regressions cover pending resolution/rejection and replacement acquisition. No new owner/timer/UI/feature. Native window and cross-window acceptance OPEN.

A7 / NC4-090-R2 publication correction (preview.136): the first preview.135 CI rejected stale generated `library-services.uc.mjs`, and a subsequent same-version generated-file correction was correctly rejected by release-history monotonicity. Preview.136 reissues the same in-flight native removal disposal fix with deterministic generated output and an advanced release version; no additional runtime features. Native Zen and multiwindow acceptance remain OPEN.

A7 NC4-090-R2 canonical publication preview.136: [CI 45074815964](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45074815964) PASS, 791 Node / 15 Python, build/check parser, immutable/current public package. Same-window and hot-reload Downloads destructive operation serialization source/CI closed; actual Zen/Gecko and multiwindow acceptance OPEN. No code or version change in this docs-only checkpoint.

A7 / NC4-077 + NC4-092 canonical preview.137: local MediaService stages complete cache/handles and preserves the prior committed state on metadata/scan failure; every successful scan rotates opaque file-action IDs while unchanged normalized paths reuse only a session-local `viewKey`. Existing Library file DOM/focus now key by view identity, actions still revalidate the current capability. Existing `library.media.refresh` trace records section/status/count only. Three new regressions; [CI 45077039287](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45077039287) PASS (794 Node, 15 Python, all generated fragments/parser/public package). Source/CI CLOSED; actual Zen/Gecko, cloud file races, native scanning/memory and multiwindow acceptance OPEN. No new feature, service or native mutation.

A7 / NC4-083 preview.138: existing `createMediaService` coalesces repeated `refresh()` within a live session while its outstanding native-scan Promise and hot-reload barrier remain authoritative. Library's existing query scheduler owns a single 15s UI-only wait; timeout changes the notice, not Gecko scan ownership. A late current result/error reconciles; stop cancels only UI timer/old callbacks. Four source-backed regressions; [CI 45078211906](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45078211906) PASS (798 Node / 15 Python, 12 parsers, deterministic build and public Sine package). NC4-083 UI source/CI CLOSED, native Gecko pending/hung callback OPEN. NC4-022 thumbnail decoded-memory and NC4-082 upstream C++ pre-truncation accumulation remain OPEN. No new UI feature, native API, data store or process owner.
