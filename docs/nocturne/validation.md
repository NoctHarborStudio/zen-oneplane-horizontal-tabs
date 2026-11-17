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
