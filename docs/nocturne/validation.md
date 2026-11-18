# Nocturne — verification and exit gates

Planning checklist. All new integration/native verification items are pending.

## G0 — baseline

- [ ] Pin both source commits; record build/test output and known issues.
- [ ] Capture runtime with current two mods in a disposable profile on target Zen 1.24.2b / Sine 2.3.3 (and user's installed build if different).
- [ ] Preserve user preference keys, native workspace UUIDs, selected tabs, split memberships, pinned/folders and session state.

## G1 — package parity

- [ ] Deterministic build; syntax-check every runtime script; both existing test suites pass or documented pre-existing failures resolved separately.
- [ ] No duplicated bookmarks code/CSS, preference properties or providers. Script and CSS order audited. Compare runtime package and computed style against both-mod baseline.
- [ ] Home startup, Home explicit trigger, Escape, cancel animation, pins/workspaces reveal, result selection, initial about:blank race; no Home flash or focus stealing.
- [ ] Smart Search first open, 6+6 when available, current tab, native typed results, arrow/Tab/Enter, exact tab/container identity and private separation.
- [ ] Horizontal width/portrait adaptive rows, two cards each side where possible, plus/slider, drag on Fade only, tab reorder, split, window drag, move across monitors, native context menus.
- [ ] Magnetic Bookmarks stable contour, hover, text, folders, native commands; downloads recent/full, flight, source-aware hold, clear list without deleting files; Page Progress; Center Assembly/Disassembly; Workspace Transition.
- [ ] Startup Free, Trash, Hub, projection and native workspace sync preserved. No unsolicited workspace creation on reload/switch.
- [ ] Sine test package update in separate profile, with old Refined disabled.

## G1.1 — Package Stabilization

- [x] Audit register and priorities recorded (see [audit.md](audit.md)).
- [x] Narrow horizontal downloads host uses readiness, not width; source-level regression tests.
- [x] Startup preference owner transfers between live windows; source-level regression tests.
- [x] Read-only legacy Refined warning; no silent mod changes. Coexistence remains unsupported.
- [ ] Real Zen checks for these fixes, CSS parity and legacy-disabled migration/rollback.
- [ ] Resolve legacy coexistence / distribution policy before broad promotion.

## G1.2 — full audit / second stabilization gate

- [x] Verify exact runtime import parity and missing Downloads host.
- [x] Record reproduced races/faults NC-009/010/011/012/016.
- [x] Add regression tests and source fixes for NC-009/010/011/012/016.
- [x] Implement initial compact Downloads slot, idle access, host hold, anchor and fixed width.
- [ ] Verify actual Zen idle/active button, Compact hold through close, narrow width, fullscreen/customization, focus and overflow; full lower Utility Dock remains planned.
- [ ] Profile inherited jerk; unify contour and motion ownership based on evidence. Confirm current Home and address visuals, Split View and drag.
- [ ] Confirm runtime native fallback, Sine reload, multi-window and workspace transitions after fixes.

## G2 — ownership and lifecycle

- [ ] One per-window Home, Hub, bookmark indicator, download dock, progress line and motion owner; one provider per native provider manager. Count after multiple windows/reloads.
- [ ] Test enable/disable, both legacy load orders and disable orders, cold start, hot reload, normal close, global quit, OS shutdown; old callbacks cannot tear down new instance.
- [ ] Inject missing native node/API and failed async initialization. Optional feature failure is local; layout fallback restores native toolbar and owned prefs.
- [ ] Before/after native settings: retain user edits, restore user-vs-default accurately; no duplicate snapshots or stale holds/listeners/timers/frames.
- [ ] Legacy enabled conflicts handled safely or documented opt-in branch only; no forced uninstall.

## G3 — layout contract

- [ ] Horizontal parity again after extraction. Shared features mount once, survive orientation change; stale generations cannot publish ready.
- [ ] Preserve selection and model identity across switching. No Home startup repeat, Free init repeat, lost input, duplicate tabs, accidental close or session writes.
- [ ] Busy drag, search popup, workspace transition, resize, fullscreen, customization, multiwindow and failure during switch. Native fallback and pref rollback verified.
- [ ] Profile-wide orientation initially; explicitly test all windows on global native pref change. No claim of per-window orientation without separate validation.

## G4 — vertical

- [ ] Native folder/Essentials/pin/split/drag/context behavior; actual sidebar slots and native address bar. Left/right, mini/expanded, compact/persistent, native resize.
- [ ] Side Fade ends softly, no invisible hit layer, no window drag over Home/content, actual controls remain interactive. Test narrow/portrait and mixed DPI.
- [ ] Shared features and motion target routing; accessibility/focus, keyboard, high contrast/light/dark, reduced motion/transparency, fullscreen/native fallback.
- [ ] Performance: compare real Gecko profiler/Browser Console against baseline. Track frame gaps, layout/reflow, observers/RAF counts, no page-wide writes per frame, no duplicate provider. No arbitrary claim of FPS or RAM improvements.

## G5 — public migration

- [ ] Exact Sine manifest, source and codeload archive checked; ID and URL stable; version and updatedAt monotonic.
- [ ] Test current two-mod install -> unified -> rollback; test old Refined absent/disabled/enabled scenarios. Publish migration/rollback instructions and known limitations.
- [ ] Only then promote from integration; repository rename separate opt-in verification; archive old repo only after migration accepted.

Existing regression sources: OnePlane tests and docs/known-issues.md; Refined docs/validation.md and six test files at pinned commit. This checklist extends them, not replaces them. Runtime Windows/Zen behavior cannot be confirmed by a source fixture alone.

## Package Fusion implementation note

0.3.0-preview.1 imports the runtime, CSS suffix and tests; copied scripts parse and the six Refined test files (including the existing shared bookmarks test) pass 39 callback fixtures in a V8 harness with Node/console stubs. This is not a full Node test invocation or native Zen validation. The public preview workflow runs the actual full Node suite and checks the served package. Legacy coexistence is not supported for this first preview; disable Refined and restart before updating.

### Preview.4 focused native acceptance

- [x] Preview.3 user smoke test: Downloads host, idle/active access, progress/hold, search, narrow geometry, window drag and workspace selection functional.
- [x] Source fixes and fixtures for Downloads opacity, workspace stable surface, Escape and handoff (NC-023/024).
- [ ] Verify empty text does not brighten at end of animation; compare workspace transition in wide/narrow/Compact and Escape before/during/after native swap. Distinguish web-page flash from toolbar flash.
- [ ] Profile remaining visual stutter and contour ownership (NC-013/014/015); no assertion of improvement without real browser evidence.

### Preview.5 acceptance

- [x] Preview.4 user confirms Downloads color, tab/page flicker and Escape fixed.
- [x] Source changes and targeted fixtures for NC-025–027.
- [ ] Cold startup repeated at least three times, including slow session restore; no replay on Sine reload, no long blank chrome.
- [ ] Switch between spaces with one and two rows in both directions, in Compact and persistent mode; no abrupt shelf height, no overlap, page remains opaque, motion visible.
- [ ] Escape and quick switches do not leave temporary height, transform or hidden chrome. Home retains normal coverage and interaction.

### Preview.6 diagnostic gate

- [x] Instrument startup/closing, native tab/workspace, mirror, geometry, fade, drag, address, Home/Hub, bookmarks, downloads and remaining script lifecycle.
- [ ] Capture actual Zen traces for each reported issue; verify local JSON persistence, privacy and bounded overhead.
- [ ] Fix confirmed issues and revalidate with diagnostics disabled.

## Magnetic Bloom startup gates

Planning only; all boxes below are open for this workstream. See [B.7](migration.md#b7-magnetic-bloom-startup-stabilization-approved) and [MB-001–015](../known-issues.md#nocturne--magnetic-bloom-startup-audit-2026-11-17). Existing CI successes and Chromium Lab tests do not satisfy these native gates.

- [ ] MB0: capture comparable baseline cold/warm starts; separate pre-Sine paint, Boot/preflight, reveal, handoff, first workspace and close. Record profile/window/display refresh and diagnostics on/off.
- [ ] MB1: both script injection orders, missing/late prelude or coordinator, stale generation, duplicate adoption/finish, disable/re-enable, hot reload, multiple windows, unload/close, timeout and thrown exception at every resource acquisition. Zero orphaned cover, style sheet, flags, holds, timers, observers or frame callbacks.
- [ ] MB2: delayed/failed native search initialization; initial Home or ordinary page; placeholder commit, skipped/fallback Home, projection/private/unsynced/special window; absent, failed, delayed and changing favicon; no waiting for network pages. Home must not pop in from a stale startup callback.
- [ ] MB3: deterministic shared timing in Lab and generated runtime; 0/1/5/100+ items, Split groups, hidden/overflow nodes, varied scale and reduced motion/no splash. Finite nonnegative delays, minimum per-item duration within window, exact final pose, shared epoch and hard fail-open.
- [ ] MB4: stable home center, two-row/overflow/portrait and mixed DPI geometry; no overlap or clipping regressions. Verify actual computed transform, scale, translate, opacity and important CSS in Gecko; no unnecessary per-frame layout or clone workload.
- [ ] MB5: compare approved Lab and Zen appearance; Home Island shape then label, centered wave, search, pins, workspace cards and footer; no DOM replacement during reveal, icon pop, focus flash or premature group reveal. Ordinary Home open/close and native search return (Escape/outside click) still work.
- [ ] MB6: before/during/after reveal test trusted pointer/keyboard, tab select, search, workspace, resize, Compact/persistent, fullscreen/customization, drag, Hub/Downloads/Library and native close. No lost input, duplicate operation, session mutation, stale overlay or intermediate visible frame; flush pending structural data exactly once. Compare last effect and first real frame.
- [ ] MB7: full reproducible build and regression suite, exact Sine manifest/archive and monotonic runtime release metadata. Repeat cold starts at least three times per representative configuration including 100+ tabs; collect p50/p95/p99/max frame gaps, gaps above refresh budget, preparation/reveal durations, Gecko profiler layout/paint/composite, active effects and observer counts. Compare diagnostics off/on; distinguish callback intervals from actual presented FPS. No performance claim without native evidence and user acceptance.
- [ ] MB8 (separate): trace gray native window, Zen first paint, earliest Sine CSS/script, cover mount and handoff. Compare supported settings in disposable profile; do not change Windhawk or native placeholder preferences as part of Bloom. Document what precedes the mod's controllable boundary.

### Preview.53 — partial native lifecycle smoke

See [A0.4 / A1.6 checkpoint](pipeline-0.4.0.md#a04--a16--native-smoke-checkpoint-preview53-2026-11-18). Three real recorder sessions confirm Layout acquisition/readiness, shared lease acquisition, 28 matching tab syncs and four noncancelled/nonsuperseded workspace native-end events. User reports no visible regression. Terminal cleanup/release and exact native preference restoration are not present in the saved file. G0/G2 remain open; no full acceptance or performance claim.

A1.7a preview.54: source/fixture candidate only; verify terminal order and cleanup in a surviving normal window after A1.7b/A1.8, including disable/re-enable and close. Expect layout.cleanup.end, diagnostics.quiesce and diagnostics.dispose where persistence completes; absence on process exit is not proof of failure. Existing G0/G2 remain open.

A1.7a-R preview.55: preview.54 CI 342/343 (Bookmarks source lock mismatch; build/parser passed). Lock corrected against exact runtime blob. 26 targeted isolated fixtures passed; full Node/CI and native confirmation pending. Include single-window same-version reload, delayed flush and stale Center handle checks in the next surviving-window checkpoint after A1.7b/A1.8.
