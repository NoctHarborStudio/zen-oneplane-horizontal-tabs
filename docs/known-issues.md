# Known issues

## OP-001 — UI jumps for one frame when activating an unloaded tab

- Reported against 0.2.0-preview.1 / 0.1.0-preview.32 runtime.
- Trigger: click a pending/discarded tab. Intermittent one-frame toolbar/UI displacement; difficult to capture.
- Suspected code paths: the lazy linked browser's provisional about:blank URI collapses the compact address slot via data-op-empty; native page actions can also change measured widths during selection.
- Preview.2 mitigation: explicit native empty-tab remains authoritative; suppress provisional blank classification for pending/discarded or recently activated unloaded tabs (bounded 1.5s guard); defer geometry recentering through the existing 180ms switch window.
- Status: **fixed in the user's live test on 0.2.0-preview.3** (preview.2 runtime). Keep regression coverage for restoration, Ctrl+Tab, true empty tabs and both toolbar modes. Reopen if reproducible.

## OP-002 — Address opening animation is not fluid / low apparent frame rate

- Reported on installed 0.2.0-preview.1 (same address animation as preview.2).
- Opening the inline address bar does not look fluid. Apparent animation FPS is lower than the monitor refresh rate. Closing is reported to look normal.
- Investigation candidates: width writes followed by synchronous layout reads in drawAddress(), per-frame clip-path regeneration, native result population and overlapping layout/geometry observers. These are hypotheses, not measured causes.
- Acceptance: opening and closing should feel equally smooth; profile frame intervals on the actual monitor (including high-refresh displays), test cold/warm suggestions and interrupted/reversed animations. Preserve native search and keyboard input.
- Preview.4 mitigation: lay out the opening popover at its final width once; animate the visible clip using rAF timestamps and cache height via ResizeObserver. Closing retains real shrinking width. Filter irrelevant suggestion-tree mutations. Actual high-refresh performance remains unmeasured.
- Preview.5 follow-up: user reports both opening and closing still lack fluidity and appear near 60 FPS on preview.4. Replace normal per-frame script rendering with fixed-width WAAPI shape/polygon interpolation, smooth shared timing, and optional refresh-callback diagnostics. Complex clips may still paint on Gecko's main thread; actual presented FPS is unverified.
- Status: **fixed to the user's satisfaction in live preview.5/6 testing**. User approved the native address animation; do not change its curve for Bunny Cascade. Exact presented FPS remains unmeasured.

## OP-003 — Abrupt disappearance of selected URL text on close

- Reported on installed 0.2.0-preview.1.
- When closing the inline address editor, the highlighted URL selection disappears unattractively, even though the overall closing animation is acceptable.
- Investigate native blur/selection timing relative to the closing wave. Do not replace the native text input or interfere with actual selection, clipboard or keyboard behavior.
- Acceptance: selection visually settles without a sudden flash or jump; retain the existing good closing motion.
- Preview.4 mitigation: fade the native selection highlight during the closing wave before blur, without changing selection range. Reopening restores highlight.
- Preview.5 animates the registered selection-alpha CSS property and retains native selection range until dismissal.
- Status: visual confirmation pending.

## OP-004 — Sine intermittently does not discover published updates

- Reported repeatedly; screenshot shows installed 0.2.0-preview.1 while preview.2 is published.
- Verified preview.2 raw manifest (with and without cache-busting query), GitHub branch head, increasing updatedAt, stable ID/homepage and successful archive verification.
- Sine 2.3.3 compares updatedAt, skips disabled/no-updates mods, and processes the installed list sequentially without a per-mod catch in updateMods. Its fetch helper uses ordinary fetch without explicit cache bypass. The crossed-arrow icon is also used for enabled updates; the highlighted button state and tooltip distinguish opt-out.
- Next diagnostic: inspect only the local OnePlane entry in chrome/sine-mods/mods.json (version, updatedAt, homepage, enabled, no-updates, origin), and browser console errors during manual update. A stale response or failure in another mod is possible, but unconfirmed.
- Preview.16 → .19 reproduced a confirmed repository-side regression: .16 updatedAt was 2026-11-16T16:32:00.000Z and .19 was 16:28:00.000Z. Failed intermediate builds prevented their metadata checks from running; checking HEAD^ alone missed the earlier high-water mark. Preview.20 restores a strictly newer timestamp (16:33 UTC), runs metadata checks before the build and checks the entire manifest history. Runtime update confirmation pending; do not edit the local database or reinstall for this confirmed metadata regression.

## OP-005 — Horizontal toolbar fails to fit on portrait monitors

- Reported on the 0.2.0-preview.3 baseline. On a portrait monitor the OnePlane menu has too little horizontal space and works very poorly. Portrait mode was not included in earlier live testing.
- First proposed mitigation: portrait-only adaptive two-row icon layout when the primary row cannot fit its icons. Keep one primary icon row if it fits; use measured available width, not only monitor orientation. The separate planned lower-left Extension Dock is not itself the portrait wrap solution; exact combined row geometry remains unresolved. Audit the current 900px CSS/JS activation boundary and overflow behavior.
- Acceptance: no inaccessible icons, clipped controls or overlapping navigation; maintain Hub/extension access, tab interactions, address expansion, bookmarks, captions and compact/persistent behavior. Validate resize, scaling, high icon counts and orientation changes. Decide exact row contents during prototype.
- Landscape overflow/redesign is explicitly deferred; do not change it as part of this issue.
- Status: open; proposed design only, not implemented or tested.

## OP-006 — First-click horizontal tab strip jumps right, then returns

- Report: after startup, the first toolbar/tab click moves the whole strip right then back. User suspects the initially hidden address bar; not reproduced in live Zen here.
- Concrete code risk: the empty-address slot changes width immediately, but the 180ms selection guard freezes the old spacer bias. A floating search can also collapse the anchor on a real page. The prior observer watched spacer outputs, contributing to delayed feedback.
- Preview.4 mitigation: synchronize center bias with the empty-state change; compensate independent edge resize before paint; keep only vertical geometry/contour guarded. Preserve the real-page address anchor during floating search. Regression test covers the centering invariant with changing left width.
- Status: **fixed in the user's live test on 0.2.0-preview.4**. Keep OP-001 and first-click centering regression coverage.

## OP-007 — Toggle Compact Mode vanishes after toggling

- Report: the left native toggle exists after startup; switching off hides it, and turning Compact Mode on again does not bring it back until restart.
- Source cause: ZenVerticalTabsManager reparents zen-sidebar-top-buttons between nav-bar and navigator-toolbox based on mode and native caption/sidebar conditions. OnePlane hides the toolbox, so the original widget may become inaccessible.
- Preview.4 mitigation: stable OnePlane temporary toolbarbutton uses the existing cmd_toggleCompactModeIgnoreHover native command; do not move the registered native widget. Suppress the original only within the active OnePlane layout, restore by removing CSS/temporary proxy. Future Hub will replace this temporary button and expose the same native action.
- Status: **fixed in the user's live test on 0.2.0-preview.4**. Keep repeated-toggle and native fallback regression coverage.

## OP-008 — Bunny Cascade cards overlap and impulses merge

- Reported on preview.7 in both opening and closing; 107%/112% uniform scale can exceed 3px gaps, especially for expanded tabs and the title island. Several early opening animations also had identical delays.
- Preview.8: shared geometric partitions, bounded horizontal growth, translation, vertical spring, distinct bounded stagger for visible cards. Algorithm tests cover mixed widths and split-member bounds. Live verification pending, especially at clipped lane edges.

## OP-009 — Bunny Cascade flicker during reveal

- Reported on preview.7. Possible causes: cancelling native animation fill while restoring hover transitions, unfinished hover widths, stationary pointer retargets, indicator geometry and newly inserted tab mirrors. Exact source of observed flicker not captured.
- Preview.8: freeze current hover slot geometry, stage handoff, suppress indicator until settled, gate stationary hover, fade late cards, preserve current scale on interruption. Live verification pending.

## OP-010 — Split View outline changes corner radius during cascade

- Reported on preview.7. Original container uses 8px radius; temporary ::before copied inherited radius and replaced background/outline. Exact computed-style conflict not measured.
- Preview.8: remove temporary layer, animate alpha on the original surface and enforce consistent 8px radius. Live verification pending.

## OP-011 — Severe Bunny Cascade performance regression

- User reports whole-browser lag on preview.8 in both phases; previous fixes otherwise work technically. Bunny effect during opening is not useful visually.
- Code analysis: common keyframe times multiplied by every visible card produce quadratic-size animation data. Group alpha animated an inherited CSS property feeding background and shadow painting. Slot snapshots and freeze/release add synchronous style/layout work. These are credible causes, not a captured profiler trace.
- Preview.9 removes all opening card animations, replaces closing with three keyframes per card and uses group opacity. Synthetic keyframe counts: 8 cards 584→24; 16 cards 2320→48; 32 cards 9216→96; 64 cards 36864→192. Actual FPS unmeasured.
- Status: mitigation published; live validation pending.

## OP-012 — Active-tab underline appears after entire cascade

- User reports the slider below the selected Steam tab is delayed until all cards reappear. Preview.8 deliberately hid indicator until final handoff.
- Preview.9 schedules indicator opacity with the selected card's own delay (+28ms, 105ms fade), stops native spring during the cascade, and resumes normal indicator at handoff.
- Status: mitigation published; live validation pending.

## OP-013 — Remaining visual overlap and abrupt hiding in Preview 9

- User reports Bunny still overlaps despite horizontal gap limit. The vertical overshoot and cross-region bounds are possible contributors, but no captured live trace.
- Preview.10 limits both scale axes to 100%, removes overshoot, and fades items progressively during opening. Bookmarks share the address trajectory with depth-aware timing; native text is opacity-only.
- Shared Magnetic Bookmarks controller replaces duplicate ownership; both updated mods needed for reliable two-way unload handoff. Contour recalculation suspended during wave.
- Status: mitigation prepared; live visual/FPS and integration validation pending.

## OP-014 — Hub foundation visual and Compact Mode issues

- User confirmed creating/switching native workspaces works in preview.11. Hub icon not painted; popup closes on Compact toggle; width and left edge do not align with navigation and color differs.
- Preview.12 explicit SVG trigger, measured compact address edge, shared address surface token, non-arrow popup, retained Compact toggle intent; pending visual verification. Right-click deletion added with explicit confirmation and safe preservation when supported.

## OP-015 — Hub hit target and workspace reuse

- Preview.12 user reports first click intermittent, double click maximizes/restores window, missing hover and icon misalignment/brightness. Preview.13 uses explicit no-drag, centered native-sized SVG, hover surface and in-document manual panel. Cause hypothesis: titlebar dragging/native popup rollup; no runtime trace. Live verification pending.
- Zen natively searches all spaces for existing settings/URL tabs. Preview.13 scopes reuse to active workspace/current window (visible Essentials preserved); native explicit workspace selection unaffected. Test about:preferences and URL bar, private/container context, cross-window and cleanup.

## OP-016 — Hub continuity and synced favicon

Preview.13 user confirms workspace-local opening, Compact retention and existing animations; trigger accepted. Reports background mismatch, closing after select/create, auto-switch after create, uncentered Delete, system confirmation and no Hub motion. Synced second monitor shows a dot for newly opened tab. Preview.14 mitigations and experimental projection require live verification.

## OP-017 — cross-monitor drag and Hub speed

User reports ghost duplication on re-entry, overlapping drag motion, missing monitor placement preview, unwanted startup New Tab and too-fast Hub. Preview.15–16 include single external drag image, bounded reinsertion, empty-page drop, snap-style monitor preview, carry badge, slower Hub and guarded startup cleanup. Runtime checks pending. True live two-window same-tab rendering is not implemented.

## OP-018 — stale drag state after OS screenshot / lost release

Reported in preview.16: a workspace drag survives system screenshot capture, preview stays on screen and the carried badge follows the pointer after release until a second click. Preview.17 separates gesture ownership from display placement, invalidates tokens before cleanup, cancels pointer gestures on missing primary button, capture loss, window blur/deactivation, OS screenshot shortcut, new pointer press and teardown. Native tab drag uses native dragend/drop fallback and a bounded active-only session check. Live Windows test pending; do not mark fixed yet.

## OP-019 — mixed-DPI monitor preview/placement

Preview.16 user reports opaque oversized preview, incorrect side/corner/monitor, and maximized drop opening an off-screen window. Likely coordinate-unit and popup/window contract mismatch; not yet measured on actual displays. Preview.17 disables custom Snap preview/forced placement temporarily; ordinary native window opening remains. Display & Snap Engine is the next dedicated milestone, not fixed in preview.17.

## OP-020 — remaining Split View drag overlap

User reports slider/cards still overlap during Split View drag. Previous mitigation did not resolve it. User explicitly requested deferral rather than another animation rewrite; leave Split View logic/animation unchanged until Fluid UI/final polish.

### OP-019 update (preview.21)

First experimental Windows Display Engine: correct CSS/desktop/device coordinate boundaries, full-monitor edge classification, work-area geometry and compact source preview, guarded native positioning. Previous XUL desktop overlay removed. Runtime validation still pending; if native screen/placement is not verified, open ordinary native window. OP-018 and OP-020 remain open. Sine update delivery from .16 remains unconfirmed despite .20 metadata correction.

### OP-019 update (preview.22)

User confirmed screen classification improved in .21, but destination placement still on source, preview on source, and edge band too narrow. .22 stages native positioning and verifies monitor; compact target-screen popup, broader zones. Runtime verification pending.

## OP-021 — returning a detached tab to toolbar accidentally splits

Preview.21 report: top Split View claims tab strip on return. Preview.22 reserves expanded toolbar geometry during drag and explicitly cancels detached same-window return without changing tab order; direct reorder and content split retained. Live verification pending.

### OP-019 update (preview.23)

Persistent primary-monitor placement reported in .22. Pass converted target geometry directly to native window creation, then verify final placement, bounded chrome move fallback, refuse unknown external targets instead of silently opening on source; log local placement diagnostics. Real monitor test pending.

### OP-019 update (preview.24)

User confirms correct monitor in .23, but all snap modes retain the centered startup seed. .24 uses the selected target rectangle at window creation and independent native maximization/verification. Exact failure of the old post-startup path not confirmed without console logs. Runtime confirmation pending.

### OP-019 update (preview.26)

User confirms correct monitor and non-maximize placements in .25. Maximize still normal window. Wait for Zen startup and retry native maximize; live verification pending. Projection adds blank New Tab: use native transparent placeholder and floating search, exact safe startup cleanup only. Underline return delay requested: separate 2000ms timer, no change to expansion speed.

### OP-019 / projection startup update (preview.27)

Preview.26 user reports maximize and startup still fail; indicator cooldown confirmed working. Native selectEmptyTab fallback addressed with temporary projection-only guard, canonical SessionStore import, independent search and bounded maximize readiness. Exact remaining runtime cause not yet established; diagnostic stage logs added. Do not mark fixed until physical test.

### OP-019 / projection startup update (preview.28)

User-provided console identifies premature startup cancellation: Error: Window closed before Zen restore begins. Both tasks had unconditional document unload handlers. Replace with native domwindowclosed notifications, closed-state checks and bounded readiness; preserve startup guard through document replacement. Correct destination and geometry confirmed by log; indicator confirmed by user. Runtime retest pending.

### OP-019 update (preview.29)

User reports .28 generally works. Search appears when projecting inactive Work, but already-active Space can show only transparent placeholder. Latest pasted console lacks OnePlane projection stages; exact cause unconfirmed. .29 verifies actual native search view rather than zen-newtab flag alone, resumes stale native session after placement and skips redundant native workspace switch. Runtime retest pending; keep geometry and accepted indicator unchanged.

## OP-022 — floating search surface color/translucency

User reports near-black native floating search mismatches muted blue-gray OnePlane toolbar. Approved shared visual pipeline in OnePlane and Zen Refined, including standalone compatibility; not implemented yet. See roadmap.

### OP-019 user acceptance (preview.29)

User confirms the previously failing workspace projection/search now appears correctly. Accept the tested behavior; do not claim exhaustive mixed-DPI, disconnect, cancellation or simultaneous live-page validation. A missing Center Assembly animation on projected window creation is separately tracked in Zen Refined, not a placement regression.

## Workspace Engine preview.30 limitations

First native Trash/Free candidate, not live-validated. Native Trash visible in Zen native UI; no automatic expiration. Multiwindow/group/Split/Glance preservation blocked rather than closing tabs; Clear retains Recently Closed semantics. Free cold-start routing, broader transfer and native theme color pending.

### Preview.31 Hub visual candidate

Approved prototype implemented; runtime verification pending. Trash restore via drag only as requested; keyboard-only restore deferred. Native favicon may be unavailable or nonlocal, in which case use fallback glyph. Free startup intentionally skips ambiguous same-name spaces, projected/private/unsynced windows and live reload; confirm cold start and session restoration on Windows. Native drag image is OS-controlled after lift, not a custom cross-monitor ghost.

### Preview.32 Trash polish

User confirms .31 drawer/clear/drag restoration; reports uneven header and native age selection dismisses Hub. Inline picker and aligned controls address suspected native popup deactivation; exact event sequence unlogged. Fluid lift/suction visuals require live verification; native transfer unchanged. No cross-window transfer change.

### Preview.35 — user-reported double Trash card and Free startup

Screenshot confirms native drag image duplicates the card; user wants actual card extraction. Replace with shared pointer-driven real row; no ghost. Console confirms hiddenDOMWindow NS_ERROR_FAILURE; replace process claim storage. Visual and cold-start verification required. Zen Refined Smart Search .22 logs report provider ready and 12 results; no change here.

## Nocturne — Magnetic Bloom startup audit (2026-11-17)

Baseline: source review at 0.3.0-preview.38 (`829da11ac680d1deaa7c1bf9f6e3a3153dcb097d`), rechecked against 0.3.0-preview.40 (`d11319f36a61cd92f812965195e620b46b557d66`). Relevant startup/Home/geometry logic is unchanged; intervening startup entrypoint changes are trace-version metadata, and the CSS change concerns Downloads drag. The user chose Startup Motion Lab option 01, Magnetic Bloom. Reported symptoms: original Zen flashes before the branded splash, occasional appearance flicker, insufficiently smooth cold-start icon reveal, abrupt Home Island and unsatisfactory search/Pinned/Workspaces entrances. These are observed symptoms; the source-level races below are credible risks, not individually proven causes in native Gecko. No fixes are claimed by this documentation update.

Priority: P0 blocks startup redesign; P1 must be addressed or explicitly mitigated before native acceptance; P2 is independent follow-up. All entries remain open. Related existing issues: OP-008/009/011/012, NC-013/014/015/019/020/025/028/030 in [the audit register](nocturne/audit.md). Implementation order and acceptance: [B.7 migration gate](nocturne/migration.md#b7-magnetic-bloom-startup-stabilization-approved), [validation](nocturne/validation.md#magnetic-bloom-startup-gates).

| ID | Priority | Source finding / risk | Required mitigation and acceptance |
| --- | --- | --- | --- |
| MB-001 | P0 | Boot Prelude writes startup phase and has its own watchdog; Startup Assembly adopts it, also sets phase and can independently finish. Eligibility and deadlines differ. | One per-window startup transaction and generation. Prelude is an unclaimed cover lease only, with bounded orphan cleanup; transfer the same node and absolute deadline, cancel old timer, never replay on hot reload. Test both script orders, missing/late coordinator, duplicate adoption and old callbacks. |
| MB-002 | P0 | `playing`, `settling`, `bootPreparing`, `nativeReady`, `settled`, `dead` and DOM flags can disagree. Multiple completion paths/timers may release ownership early. | Explicit finite state machine; DOM flags are coordinator-owned projections, not independent lifecycle writers. One idempotent terminal path; token-owned effects, geometry and cleanup. Test invalid transitions, repeated finish, failures at each acquisition and stale asynchronous work. |
| MB-003 | P0 | `oneplane-trigger.js.part` awaits `Services.search.init()` before auto-opening Home, while Assembly can start after layout readiness. `ensurePrimaryHome()` and startup leases can also open Home independently. | Explicit Home readiness (pending/ready/skipped/fallback) and one startup-open claim; bounded waits, eligibility and generation recheck after await; no late automatic Home replay after handoff. Preserve native tab/page selection, actual placeholder behavior and projected/private/special-window rules. |
| MB-004 | P0 | Shared Home `render()` replaces children during preference or workspace updates, invalidating prepared effects. Its own `finished` callback and `stopMotion()` may remove startup gating independently. | Freeze structural identity for the startup lease; update icons and selection in place, coalesce structural changes, replay latest state at a safe boundary. User search/navigation/close must interrupt via coordinator, not be blocked. Test replacement during preparation, reveal and handoff. |
| MB-005 | P1 | `complete`/ `naturalWidth` and decode do not prove paintable favicons or stable source; missing/failed images may prolong readiness or pop in. Existing proxy may perform its own asynchronous load. | Bounded local chrome icon preflight with stable size placeholders; classify missing/failed as nonblocking after budget, allow icon-only refresh. No network/site-load/session-wide favicon dependency. Verify first visible and final icon frames in Gecko. |
| MB-006 | P1 | Existing Magnetic Fold clones each card deeply, copies computed styles, draws canvas favicons, attaches per-icon observers/listeners, generates 41 frames. Bloom does not require travel through a shared portal. | Benchmark real-slot visual-layer Bloom first; avoid unnecessary cloning and per-frame geometry work. Retain existing Fold for closing/workspace. If proxy required, bound count/work and document why. Test 0/1/100+ tabs, Split View and overflow. |
| MB-007 | P1 | Lab timing formula can yield too-short or negative item durations for large collections; fixed five-pin example is not a general algorithm. | Bounded adaptive stagger with finite nonnegative durations, minimum duration within group window, deterministic order from Home, visible items only where appropriate, Split group as unit. Handle zero/one items and reduced motion. |
| MB-008 | P0 | Separate `.play()` calls, fixed finish timers and mutable `window.__nocturneStartupTimeline` do not guarantee a shared clock; late effects can extend timers. Lab assumes resources already exist. | Immutable pure timing plan + one transaction epoch on document.timeline, prepared effects share start time. Extend only Boot hold within deadline; do not stretch/restart Bloom. Explicit total deadline, late-target policy and bounded fallback. Synchronize generated lab and runtime from one source. |
| MB-009 | P0 | Finish/settle cancels WAAPI effects, releases proxy/real-card gates, CSS and Home in separate steps; pending structural sync or mismatched geometry may produce a final-frame flash. | Seal at resting pose; reconcile dirty geometry/data while covered or in a safe atomic boundary; match last animated/first native frame; release proxies and gates with transition suppression, then restore interaction. If topology changes substantially, settle/fallback rather than expose mismatched proxies. |
| MB-010 | P1 | Sine USER_SHEET `!important` rules may beat WAAPI/inline styles; transform/translate/scale may already position Home Island, tabs or URL bar. Custom-property animation is not automatically compositor-only. | Per-target property ownership audit, preserve resting transforms and slot geometry. Prefer dedicated visual surface or safely composed properties, verify computed style in Gecko; avoid parent+child double fades. Compare frame intervals with diagnostics off/on. |
| MB-011 | P0 | Geometry/contour/tab sync can race preparation, especially before Center Motion owner exists. Home subscription can recenter; resize and workspace/close/drag/search/overlay can supersede reveal. | One tokenized geometry lease across preparation through handoff; drain pending sync before capture, coalesce structural dirtiness, permit safe icon updates. Gate competing motion and route trusted input/resize/close/reload through unified abort. No global freeze, no lost input or native data mutation. |
| MB-012 | P1 | The 190 ms Home Island fade is abrupt; Home groups currently share generic section timing. HTML and Zen are separate implementations. | Approved Magnetic Bloom: reveal Home Island shape then label, wave from center into fixed tab slots, search expands from 86%, individual Pinned/Workspace stagger, footer last. Shared timing module generated into both outputs; preserve normal Home open/search/drag behavior. |
| MB-013 | P1 | Diagnostics, repeated style reads, many effects and icon preparation may cause cold-start frame gaps; source fixtures or Chromium lab are not native performance proof. | Measure preflight and reveal separately, p50/p95/p99/max frame gaps and presented frames where available, layout/paint/compositor costs, effect counts, observers and cleanup. Compare same Zen/profile/display with diagnostics enabled/disabled, cold/warm and 100+ tabs. No FPS claim before measurement. |
| MB-014 | P2 (independent native investigation) | Original Zen/gray Windows frame occurs before Nocturne/Sine can mount. Manifest order is not a prepaint guarantee; startup placeholder suppression and Windhawk may affect what is visible. | Investigate Sine injection, Gecko paint suppression, native blank/skeleton prefs and Windows compositor separately. Capture timing from window creation through earliest script/CSS/first paint. Do not globally change native prefs, Windhawk or OS behavior as part of Bloom; do not promise removal before earliest injection. |
| MB-015 | P1 (release engineering) | Migration policy says docs-only changes do not bump runtime version, while preview CI requires a strict manifest increase relative to HEAD^ on every push. | Keep planning separate from runtime releases. Future CI change must classify documentation-only changes safely, validate the last actual manifest revision, and retain full monotonic checks for runtime releases (including multi-commit pushes). This audit does not change CI behavior. |

Do not close these issues on source tests alone. Keep current Magnetic Bunny, Downloads/Library, Hub, native search, workspace transitions and closing behavior unchanged unless an explicit ownership integration requires a separately tested change. No new Sine runtime entrypoint or independent startup controller.

## Nocturne Library functional preview — 0.3.0-preview.42
- All five views implemented; live Zen/Sine acceptance not yet run. Keep experimental settings off until tested.
- Native DownloadsCommon includes Places-only historical records; Library uses current shared Downloads list, native Downloads button remains available for full history.
- Library drag uses native file payload; Dock retains Bunny. Shared Bunny animation on Library rows is not yet integrated.
- Local folders opt-in only; scanner defaults to bounded system roots, no custom picker. Native scan cannot be canceled once dispatched, stale results are ignored. Verify Windows cloud files, DPI, Gecko image decoding and file drag.
- Verify focus, command order, top-layer hit testing, private windows and real startup/shutdown; automatic tests do not replace runtime testing.

### Library preview.44 follow-up
Shared Bunny bridge, moving active-section indicator, explicit extra-folder picker and confirmed history actions are implemented. The remaining release gates are real Gecko runtime validation, historical-only download parity and performance measurement; prior preview.42 limitations for these implemented items are superseded. The native Downloads view remains accessible for Places-only records. Test folder picker, consent toggle, scan reload barrier, OS-level drag including cancellation/return, History deletion on a disposable profile, command fallback and DPI. Do not enable experimental features by default until accepted.

### Library shortcut recovery — 0.3.0-preview.46
- Report: Ctrl+H opened nothing in preview.44. Exact cause not captured by old diagnostics. Added keydown route, fixed surface fallback, guarded open and Library-specific telemetry. Verify both opt-ins and native fallback; live test pending.

### Bunny live drag popup — screen-edge snapping (0.3.0-preview.47)
User reports the invisible native frame is magnetically constrained to screen edges. Gecko `nsMenuPopupFrame` applies screen constraints unless a chrome panel declares `flip="none"`; `nsBaseDragSession::DragMoved` calls the same popup positioning path. Set the attribute before attachment, preserving the existing single native drag widget and motion. Source and regression checks do not establish Windows runtime acceptance; verify edges, taskbar, adjacent monitors and cancellation. No new controller or cursor polling.


## Nocturne 0.4.0 — cross-feature audit (open)

Baseline preview.47; audit HEAD 39459794addcc0e0236edd12cd8a636d3b714265. All NC4 entries remain open. S = source-confirmed structure/defect, R = risk not reproduced in live Zen, V = verification gap. P0 = native data/lifecycle safety, P1 = architecture/UX, P2 = maintenance. Full evidence, prerequisites and exit criteria: [0.4.0 audit and pipeline](nocturne/pipeline-0.4.0.md). Existing OP/NC/MB records remain historical evidence; these cross-feature IDs do not imply new independent implementations or verified native bugs.

### Initial inventory (NC4-001–032)

| ID | Open issue / risk | Pipeline |
| --- | --- | --- |
| NC4-001 | Dual contour renderer | A4 |
| NC4-002 | Fragmented startup readiness | A3 |
| NC4-003 | Motion ownership gap | A3 |
| NC4-004 | Independent geometry readers | A4 |
| NC4-005 | Manual lifecycle cleanup | A1 |
| NC4-006 | Process preference lease risk | A1 |
| NC4-007 | Free startup claim consumed early | A2 |
| NC4-008 | Workspace commands bypass shared queue | A2 |
| NC4-009 | Partial Trash transfer | A2 |
| NC4-010 | Projection and Trash native identity races | A2/A5 |
| NC4-011 | Home subtree recreation | A3/A6 |
| NC4-012 | URLbar presentation ownership | A3/A6 |
| NC4-013 | Tab topology during motion | A4/A5 |
| NC4-014 | Drag identity/visual separation | A5 |
| NC4-015 | Multiple drag lifecycles | A5 |
| NC4-016 | Duplicate file transfer payload | A5/A7 |
| NC4-017 | Snap/coordinate policy overlap | A5 |
| NC4-018 | Native hit regions | A4/A5/A6 |
| NC4-019 | Partial overlay handoff | A6 |
| NC4-020 | Downloads projections and list leases | A7 |
| NC4-021 | Library history/pagination limits | A7 |
| NC4-022 | Decoded image/file scan budget | A7 |
| NC4-023 | Smart Search manager lifecycle | A6 |
| NC4-024 | Page Progress request ordering | A7 |
| NC4-025 | Diagnostics schema/budget | A0/A8 |
| NC4-026 | Runtime version metadata drift | A0 |
| NC4-027 | Documentation-only CI failure (A0.3 implementation verified in initial CI) | A0 |
| NC4-028 | Native validation gap | A0/A8 |
| NC4-029 | Close lifecycle overlap | A1/A3/A8 |
| NC4-030 | Implicit build dependencies | A1 |
| NC4-031 | Focus and reduced motion | A6/A8 |
| NC4-032 | Vertical host assumptions | A9 |

### Deep source checkpoint — NC4-033–046

#### NC4-033 — Native switch result is not a success certificate (S/R/P0)

Zen 1.24.2b ZenSpaceManager.mjs:1962–2010 catches errors in changeWorkspace, resolves and returns the requested workspace; #performWorkspaceChange assigns activeWorkspace before containers are reconciled. Hub:958–971 checks only ID, Home:947–954 does not check native outcome, WorkspaceTransition:205–250 starts incoming after promise + quiet interval. The native semantics are source-confirmed; a failed live switch is not reproduced.

**Required:** A2/A3: validate destination container and tab selection/topology plus native completion, distinguish partial/failed/pending. Inject failure after activeWorkspace assignment; no successful incoming motion based only on ID.

#### NC4-034 — Native workspace deletion closes remaining owned tabs (S/R/P0)

ZenSpaceManager.mjs:1487–1504 and 1743–1752: removeWorkspace calls #deleteWorkspaceOwnedTabs -> gBrowser.removeTabs before removal. Hub:341–365 correctly checks no owned tabs remain; native allStoredTabs is cached (3443–3494) and moveTabsToWorkspace invalidates cached tabs (1837–1885). Current guard is necessary, not evidence of present loss. Verify physical destination, exact ownership and cache freshness before invoking destructive native API.

**Required:** A2: preserve guard, use native adapter and journal; assert zero real owned tabs before native deletion and verify actual outcome. Fault-inject partial move, stale cache, group and external tab changes.

#### NC4-035 — Trash purge silently reports partial execution (S/P0)

Hub:529–540 clears purgePlan, rechecks candidates, then breaks without reporting when single-window/eligibility changes; removeTab is not followed by result validation. Actual function fixture: three approved tabs, simulated second window after first remove -> only first invoked, result undefined. This is a confirmed partial-result gap, not proof of unexpected native deletion.

**Required:** A2: report attempted/confirmed/retained/failed tabs and reasons; respect native beforeunload, avoid retries against stale approval; verify real removal, preserve remaining tabs.

#### NC4-036 — Old Free initialization continues after disposal (S/P0)

Bootstrap:34–58 claims startup, awaits createAndSaveWorkspace, then writes FREE_PREF and reorders before checking disposed. Actual extracted function with deferred mock native create: dispose before resolve -> pref write and reorder still happen, switch skipped. Zen's dontChange=true body normally performs save synchronously before promise resolution, so exact native race frequency unknown.

**Required:** A1/A2: check generation after every await and before each native mutation; process command lease survives view disposal only for explicitly authorized in-flight action; reconcile partial native creation without deleting it.

#### NC4-037 — One failed preference restoration blocks unrelated settings (S/P0)

preferences.js.part:54–69 loops without per-key try/catch. Actual restorePrefs fixture: first native setter throws locked error -> later key not restored; backup not cleared. startup.uc.mjs handles keys individually, duplicate lifecycle policy.

**Required:** A1: acquire/restore per-key with ownership journal, isolate failures and retain unresolved backup; locked pref, user edit and multiwindow tests. Do not clear backup until reconciliation.

#### NC4-038 — Layout closing flag is never reset after cancelled close (S/R/P1)

preferences.js.part:71–74 markClosing sets closing=true; bootstrap cleanup:26 skips ZenCompactMode:LayoutUpdate when closing. No reset in layout; startup.uc.mjs:93–97 has separate 1s reset. Native cancellation sequence pending.

**Required:** A1: one lifecycle state distinguishes close intent, actual unload and cancelled close; verify beforeunload cancel then mod disable/reload, no native layout stale state.

#### NC4-039 — Overlapping bookmark animation handles restore stale CSS state (S/P1)

center-motion.js.part:288–300 bookmarks() snapshots shared CSS property and marker independently of active tab owner. Actual function fixture starts two handles, releases older then newer: after first release marker removed while second live; after both, marker=true and --zr-fold-bookmark-progress=1 remain. Not a live reproduction of overlapping callers.

**Required:** A3: per-surface generation lease, cancel old handle before snapshot of next; stale release no-op, baseline restored exactly once. Add overlap and out-of-order release fixtures; verify startup/close/workspace/disable.

#### NC4-040 — Projection input guard does not gate workspace switch (S/R/P1)

Hub:874–939 records trusted pointer/keydown to set interacted and stop empty guard. After waitForProjectionReady, it still calls child.changeWorkspaceWithID before prepareProjectionStart checks interacted (765–766). A user who interacts before readiness can still be redirected; native occurrence pending.

**Required:** A2/A5: distinguish explicit request to open requested workspace from user takeover, check intent/generation before changing child selection; don't steal focus or close child automatically; test manual input before/after ready.

#### NC4-041 — Visual timeout does not resolve a stuck workspace command queue (S/R/P1)

workspace-transition:21–31 gate.pending cleared only when native settles; run:196 waits in while loop; perform:217 watchdog cleans visuals only. This intentionally avoids overlapping native changes, but permanently unresolved native promise blocks later Home/Hub requests. Zen also waits its internal switch context (1967).

**Required:** A2/A3: expose command pending/unknown state and recovery diagnostics; bounded UI wait and explicit native reconciliation, never clear live gate and start second mutation merely on visual timeout.

#### NC4-042 — Unsplit happens before fallible reorder/adoption/window creation (S/R/P0)

drag-controller:168–183, drag-end:33–36 call unsplitTab before moveNativeNextTo/adoptTab/replaceTabWithWindow, which may fail. Native ZenViewSplitter.mjs:211–255 removes entire group when fewer than 3 tabs. On failure split topology may already be changed; no live failure reproduced.

**Required:** A5: preflight target, capability and identity before unsplit; native outcome and partial-result handling, no unsafe automatic rollback; test rejected adoption/missing move method/window creation failure with two- and multi-pane groups.

#### NC4-043 — Temporary cross-window getter override needs failure-isolated cleanup (S/R/P1)

Hub:1052–1149 installWorkspaceLinkScope replaces allUsedBrowsers on every live manager for synchronous URI lookup and patches UrlbarParentController prototype. Zen URILoadingHelper patch:27 uses this getter. A throwing restore can stop subsequent restores in reverse loop; full upstream UrlbarParentController implementation not reviewed, synchronous contract requires verification.

**Required:** A1/A6: explicit native capability and narrow scoped lookup; per-manager try/finally restoration, reentrancy/foreign wrapper identity tests; verify native provider/URI helper path before deciding whether hook can be removed.

#### NC4-044 — Layout resources are acquired before guarded mount block (S/R/P1)

Build concatenates Hub controller initialization (hub/controller:1046; listeners registered 1041–1042), tab-state ResizeObserver construction (18), drag-controller global publication (drag-end) before window-lifecycle:129 try. If evaluation throws before that try, installTabStrip never returns destroy, bootstrap cleanup cannot release partial resources. Actual failure not injected yet.

**Required:** A1: create acquisition scope before first side effect; register immediate rollback for every global/listener/observer; fail at each pre-mount site and check cleanup and fallback.

#### NC4-045 — Projection diagnostics bypass unified JSON recorder (S/P2)

Hub:689–698 projectionLog writes console.info only; key stages (opened, ready, start-prepared, failed, search-result) are not sent through __nocturneTrace by this function. Error String may contain arbitrary content in console. No demonstrated sensitive JSON leakage.

**Required:** A0/A8: route bounded phase/result metadata through existing trace with transaction/window IDs, error name/reason enum, no URLs/paths/queries; verify local JSON persistence and privacy.

#### NC4-046 — Close animation can overlap active interaction surfaces (R/P1)

closing-animation:176–185 eligible checks startup/workspace/customization/fullscreen, but not tab drag, file drag, overlay, or URLbar morph; begin starts CenterMotion and bookmark handle. No native overlap reproduction, and trusted OS quit may bypass wrapper.

**Required:** A3/A5/A6: terminal priority policy; cancel/settle visual owners without suppressing native close or forcing drop. Test close while drag/search/Library active, second close, cancellation, global quit.

Four extracted-source mock fixtures confirmed NC4-035/036/037/039, not live Zen. Do not close these issues until relevant regression and native validation gates pass. No runtime changes in this audit.


### Motion and geometry checkpoint — NC4-047–060

#### NC4-047 — Startup interruption uses inconsistent settlement (S/R/P1)

startup-animation.uc.mjs:179–207 seals/releases CenterMotion and bookmarks immediately while other effects interpolate for 120ms. Visible discontinuity is a risk, not native reproduced.

**Required:** A3: shared current-progress settlement for all surfaces; resize/input during each phase; match last/first paint.

#### NC4-048 — Proxy topology can diverge from live tabs at handoff (S/R/P1)

center-motion.js.part:215–285 freezes proxy slots; tab-sync.js.part:8–14 allows only icon refresh while center owner active; topology changes reconcile after release. No end-position equivalence check.

**Required:** A3/A4: record topology generation, reconcile under gate, retarget or settle on incompatible geometry; test open/close/split/resize during motion.

#### NC4-049 — Startup effects may target detached Home nodes (S/R/P1)

shared-home.js.part:341–354 stores startupEffects on content children; render:899–908 replaces content; workspace/pref events trigger render while open; playStartupHome refuses if effects array nonempty. New nodes can miss choreography. Actual event overlap pending.

**Required:** A3/A6: freeze structural render or keyed nodes and generation-aware retarget; test pref/workspace updates during staged and active Home entry.

#### NC4-050 — Address reverse can retain old cascade timeline (S/R/P1)

address-controller.js.part:62–127 restarts main effect; address-cascade.js.part:109–114 returns early if requested direction already hiding/showing. Reopening a close while first hide remains active can leave old cascade timings unrelated to new address phase. Exact user sequence pending.

**Required:** A3/A6: cascade keyed by transaction generation and sampled progress, not direction alone; test rapid open-close-open and fallback.

#### NC4-051 — Address phase may be stranded by external WAAPI cancellation (S/R/P1)

address-controller.js.part:108 sets onfinish only; no oncancel terminal path for unexpected external cancellation and no normal-phase watchdog. stopAddressAnimations clears handles intentionally; updateAddressAnimation may return while addressWasOpen true. Native external cancellation not demonstrated.

**Required:** A3: bounded transaction completion, explicit unexpected cancellation recovery; distinguish own cancel from stale callbacks; test native element replacement/theme/disable.

#### NC4-052 — Geometry freeze still writes bias and lane layout (S/R/P1)

geometry.js.part:48–118 sets frozen during drag/cascade but still calculates bias, writes center spacers and left room, syncs lane scroll and refreshes slider. This is partial rather than complete geometry freeze.

**Required:** A4/A5: specify which geometry is immutable vs live; snapshot committed slot coordinates, test edge controls changing during Bunny/address motion.

#### NC4-053 — Contour cache committed before successful rendering (S/R/P1)

contour-controller.js.part:78–83 sets contourKey before style writes and contourImage generation; bookmarks.uc.mjs:179–185 similarly stores key before render. A throw can suppress retry for same geometry.

**Required:** A4: compute mask then commit/cache only after success, preserve last valid surface; fault-injection for generator or style failure.

#### NC4-054 — Bookmark suspension omits startup and closing phases (S/R/P1)

bookmarks.uc.mjs:51–68 syncAddressState checks address wave and workspace only; root observer:827–830 observes those but not startup/closing/center. Hover/FLIP and reserve may run while parent fold controls scale/opacity. Need inspect actual eligible/pointer guard before calling a reproduced conflict.

**Required:** A3/A4: explicit motion surface permissions, suspend/reconcile before geometry snapshots; native pointer/focus/resize during startup/close.

#### NC4-055 — Home search snapshot is expensive on mutation-heavy results (S/R/P1)

shared-home.js.part:580–645 recursively copies up to 900 nodes, computed style longhands and pseudos, repeated capture via 80ms timer. Budget caps nodes not style calls, decode or total time; return writes per-card styles each RAF (556–578,721–733). No measured regression yet.

**Required:** A6/A8: profile capture and return separately, cap time/bytes and capture frequency; compare stable snapshot vs lightweight render, preserve visual approval.

#### NC4-056 — Home search animation readiness is frame-count based (S/R/P1)

shared-home.js.part:457–490 retries up to 120 RAF callbacks waiting for results; elapsed time varies with display rate/background throttling. It can release visual gate before late results at high refresh or hold it longer at low refresh.

**Required:** A6: monotonic deadline plus native result readiness; test 60/144Hz, background, slow provider and focus interruption.

#### NC4-057 — Home search return geometry can become stale (S/R/P1)

shared-home.js.part:680–738 snapshots result box and destination then drives height/top/width per RAF; window resize ends visual immediately (1023–1031). Other content layout/font/viewport changes during return are not explicitly retargeted. Native scenario pending.

**Required:** A6/A4: geometry revision, bounded settle on invalid destination, verify return-to-source under font/size/workspace changes.

#### NC4-058 — Center Motion proxy setup scales with all visible DOM descendants (S/R/P2)

center-motion.js.part:115–192 clones each subtree, copies computed paint properties, creates per-icon canvas, MutationObserver and four listeners, sets willChange for every proxy. Bounded by visible cards but no explicit total budget. No native profiling yet.

**Required:** A3/A8: measure snapshot acquisition and compositor memory at 1/30/100+ tabs, compare shared icon observation and real-slot animation; retain fallback if budget exceeded.

#### NC4-059 — Workspace settlement uses quiet interval rather than readiness contract (S/R/P1)

workspace-transition.uc.mjs:155–179 waits mutation quiet up to 400ms, warms icons only first sequence; later transitions can still have late decode, and quiet does not prove native structure readiness. Related NC4-033, not independent replacement.

**Required:** A2/A3: structural ready + bounded asset readiness, explicit timeout outcome; test slow icon on later workspace and delayed native container.

#### NC4-060 — Address cascade captures only currently mounted visible slots (S/R/P1)

address-cascade.js.part:70–108 takes a fixed snapshot of tab and bookmark nodes; tab-sync can still reparent/remove nodes outside center owner. CSS hides unmarked new nodes until gate release; new nodes may appear abruptly.

**Required:** A3/A4: topology lease or reconcile newly added nodes under existing wave progress; test native tab open/close and bookmark overflow during search.

Source-only checkpoint. Native reproduction and performance evidence pending; all findings remain open. See the surface ownership matrix in the [0.4.0 pipeline](nocturne/pipeline-0.4.0.md).


### Interaction checkpoint — NC4-061–075

#### NC4-061 — Strip drop ignores rejected or unavailable native move (S/P0)

drag-controller.js.part:129–135 returns false if move method unavailable; onStripDrop:153–181 ignores return and calls markHandled. Actual extracted-source fixture with missing moveTabBefore: handled and schedule invoked, no move. Handled currently suppresses fallback detach; not itself proof of native success.

**Required:** A5: distinguish handled event from successful native outcome; preflight capability and verify ordering/group/adoption; preserve no-op and suppress unintended detach on rejected drop.

#### NC4-062 — Native dragend identity does not encode gesture generation (S/R/P1)

drag-lifecycle.mjs:32–34 compares target and tab only; drag-engine:54–57 finishes current token after that check. Extracted-source predicate fixture accepts old event for the same tab/node after a new token starts; native ordering feasibility unverified.

**Required:** A5: bind native session identity where Gecko supports it, fence callbacks by token and reject ambiguous old events; test repeated same-card drag and delayed release.

#### NC4-063 — Split side classifier accepts points outside its hit rectangle (S/R/P1)

split-drop.js.part:1–10 normalizes coordinates but does not reject x/y outside [0,1]. Actual function fixture: rect (100,100,400,300), point (90,250) -> left. Event routing may prevent this in normal native use; no unintended split reproduced.

**Required:** A5: validate finite inside point and real drop target, test boundary/negative/retargeted events and native split hit regions.

#### NC4-064 — Tab OS image ownership is one-way within a gesture (S/R/P1)

native-drag-image.js.part:176–181 returns immediately if current mode is outside; later else-if previous outside:199–202 is unreachable. strip-drag:274–278 uses external image plus reorder preview on return. This may be intentional to avoid duplicate OS image, but cannot restore local Bunny curve after real external handoff.

**Required:** A5: explicitly model outside-reentry policy, confirm actual Gecko image update ability on Windows; retain one visual owner, no blank/duplicate image; remove unreachable branch only after validation.

#### NC4-065 — Incoming tab into empty strip has no destination command (S/R/P1)

strip-drag.js.part:108–110 returns null if stripNodes empty; native/tab-adapter dropTarget also returns null when no children; drag-controller:148–152 handles local no-destination only, never adopts incoming into empty target. Native drop event may still be prevented, source remains under OS drag semantics.

**Required:** A5: explicit empty-strip destination (native active Workspace and insertion contract), verify incoming tab adoption into zero-tab Home/Free without unintended detach or duplicate window.

#### NC4-066 — Mirror sync can remove or reparent native drag source during active session (S/R/P1)

tab-sync.js.part:8–14 freezes structural changes only for center-motion; normal sync removes entries and applies partition; reorder.js.part:1–2 explicitly requires stable drag source. Native tab close/workspace/group changes can invalidate snapshot; no explicit drag topology generation.

**Required:** A4/A5: source-node lease with native validity, cancel safely if source gone, defer or reconcile other topology, test external events during drag and insertion tail.

#### NC4-067 — Session watchdog treats API error as ongoing drag (S/R/P1)

drag-engine.js.part:18–26 resets missing count on exceptions or does not advance if getCurrentSession unavailable; downloads-indicator:646–648,754–760 returns undefined on exception and resets missing. Both can keep scheduling if dragend lost and capability fails; not proven in native Gecko.

**Required:** A5: shared tri-state session probe, error threshold/terminal recovery with no fake drop, source identity and interruption signals; test missing API, repeated throws and lost dragend.

#### NC4-068 — Library fallback file drag has no independent end recovery (S/R/P1)

library/controller.js.part:187–204 falls back to downloads.drag when Dock bridge unavailable; only node dragend releases dragSource. onPref/onTab/onWorkspace defer close while dragSource set; fallback has no watchdog/blur recovery. Native lost event pending.

**Required:** A5/A7: lease owned by shared file adapter even with no animated Dock, bounded native session recovery and exactly-once callback; test Dock disabled, service reload and lost dragend.

#### NC4-069 — File Bunny setup failure can strand source lease without watchdog (S/R/P1)

downloads-indicator.uc.mjs:815–837 sets fileDragSource before beginFileBunny; catch clears artwork but returns true. Watchdog is created near end of beginFileBunny:730–763; early failure leaves no q/watch, only dragend. Native payload may still be valid so do not abort export merely because art fails.

**Required:** A5: native file lifecycle independent of artwork; acquire watcher before optional visual setup, terminal path for fallback and failure; fault-inject card/popup construction.

#### NC4-070 — File popup hidden does not stop animation loop (S/R/P1)

downloads-indicator.uc.mjs:678–684 popuphidden only logs, tickFilePopup:712–725 continues as long as q.shown and not ending, without checking popup state. If widget hides unexpectedly while native session stays live, timer/layout flush continues on hidden art.

**Required:** A5/A8: explicit native artwork visibility state, stop or bounded recovery on hidden, keep native drag separate; verify external Windows drop and popup rollup.

#### NC4-071 — File Bunny tick forces style/layout every 16ms (S/R/P1)

downloads-indicator.uc.mjs:687–695 updates width/height/transform; tickFilePopup:712–725 reads popup screen rect then writes artwork and forces getBoundingClientRect. This is intentionally designed for Windows nested OLE loop where RAF may stall; cost and presented frames not measured.

**Required:** A5/A8: profile actual nested native loop, compare fixed-size stage + transform/dirty updates/adaptive cadence; keep live outside-window animation if native evidence supports it.

#### NC4-072 — Snap preference also controls coordinate validation and ordinary detachment (S/R/P1)

display-engine.js.part:12–49 gates displayEventPoint on experimental-display-snap; pointInSourceWindow:50–55 falls back to CSS coordinates when disabled/unverified. drag-end:29–36 refuses detach if snap enabled and no verified seed. preferences.json:540 default true. Current intended monitor placement is separate from unwanted ghost edge constraints fixed earlier.

**Required:** A5: separate coordinate conversion/validation from snap policy; explicitly approve default behavior and safe native detach fallback, verify mixed DPI, negative monitors, target disconnect, pref off/on. Do not silently change current defaults.

#### NC4-073 — Delayed startup search restoration is not gesture-scoped (S/R/P1)

startup-search.js.part:14–35 schedules restore after 80ms; checks same selected tab and native URLbar closed but no gesture generation/user intent; endDragVisual calls it on normal release. New drag begin does not universally invalidate prior restore timer (cancelNativeDrag does). Could reopen stale search mid next gesture.

**Required:** A5/A6: bind restore to native search token and completed gesture generation, invalidate on new input/navigation; test fast repeat drag, Escape and native newtab session.

#### NC4-074 — Legacy drag implementations remain unreferenced in generated layout (S/P2)

Pinned layout.uc.mjs identifier scan: captureGroupPull, previewGroupPull, dragPaintedBox, markDrop each occur once (definition only); group-pull helper and older state branches coexist with magnetic anchor path. No claim that all group-pull helpers are unused (clearGroupPull/setPull remain live).

**Required:** A5: build call graph incl dynamic references and tests, remove proven dead paths only after replacement parity; keep native group behavior and regression fixtures.

#### NC4-075 — Full content split overlay and broad toolbar return use different hit contracts (S/R/P1)

split-drop.css.part:2–7 absolute inset:0 z-index:101 pointer-events:auto while dragging; strip-drag:225–234 uses max of measured/painted/nav/row heights +4, unlike toolbarContainsPoint in reorder:55–59. These are deliberate separate surfaces but can overlap or accept invisible portions during resize/compact transition; not proof of earlier invisible rectangle cause.

**Required:** A4/A5: define source card, native hit rect, return zone and decorative ghost separately; native point tests in compact/2-row/search, outside-window and no-drag baseline; do not use full-window transparent hitbox unless native operation requires it.

Three extracted-source experiments confirmed missing-method handling, same-target identity predicate limitation and outside-rectangle split classification. Native event reachability and Windows drag behavior are unverified. All findings open; see [pipeline](nocturne/pipeline-0.4.0.md).


### Shared services checkpoint — NC4-076–092

#### NC4-076 — Downloads bulk clear omits skipped records (S/P1)

downloads-service.mjs:83–87 increments removed on true and failed on throw, not on false. Extracted-source fixture: two initially clearable entries, second becomes partial after first remove; result removed=1 failed=0 with one remaining. Safe skip is correct; summary is incomplete.

**Required:** A7: shared native operation result requested/completed/skipped/failed, preserve eligibility and never delete files; test disposal and changed eligibility.

#### NC4-077 — Media refresh invalidates old handles before new cache is ready (S/P1)

media-service.mjs:31–46 deletes owned handles, mutates new handles per item, commits cache only at end. Extracted-source fixture: describe throws on second item of second refresh; old rows stay visible but old ID action returns false; partial new handles remain.

**Required:** A7: stage complete immutable cache/handle map, commit after success and generation check; preserve previous valid cache on failure.

#### NC4-078 — Closed tabs disposal stops after failing unsubscribe (S/P1)

closed-tabs-service.mjs:26–30 release removes itself before off; dispose loops without per-release isolation. Fixture: first off throws, second never runs, subsequent dispose no-op. Native observer callback checks dead but observer may retain old closure.

**Required:** A1/A7: failure-isolated scope, report per-resource failure and retry where safe; test two subscriptions and throwing native removal.

#### NC4-079 — Overlay partial handoff reproduced (S/P1)

Refines NC4-019. overlay-coordinator.mjs:14–28 preflights canYield then yields sequentially. Actual fixture: owner A yields, B returns false, request denied, A inactive. This is non-atomic handoff, not evidence of native data loss.

**Required:** A6: document partial result and safe recovery or implement prepare/commit if supported; no automatic reopening native popups or forced drag cancellation.

#### NC4-080 — Failed Downloads removeView releases reload barrier (S/R/P1)

downloads-service.mjs:32–35 clears source before await and catches removal failure; dispose:89–95 resolves barrier. Fixture: native removeView throws, replacement start succeeds, native mock retains two views. Old callback is dead-guarded, so not duplicate active processing, but old view remains retained.

**Required:** A1/A7: report detach outcome, preserve retryable handle; replacement policy must explicitly address retained subscription rather than assert exclusive native view; test native failure and teardown.

#### NC4-081 — Oversized startup archive prevents diagnostic file update (S/P1)

diagnostics.js.part:39–56 trims only events with more than one entry, never startup. Synthetic ASCII packSessions fixture with 100 startup items and one event returns 2304335 bytes > 2000000. Persist:78 rejects rather than writing oversize; cap is enforced but recording can fail entirely. Refines NC4-025.

**Required:** A0/A8: enforce per-event/startup and total byte budget, preserve minimal keyframes and newest evidence; test oversized archive and old malformed persisted data, Unicode bytes.

#### NC4-082 — Native scan result limit is not a traversal or memory budget (S/R/P1)

Zen 1.24.2b nsZenLibraryFiles.cpp WalkFolder accumulates every matching entry and child directory before recursion; ScanMedia sorts all found entries then truncates to maxItems. Nocturne requests depth=2 folders=60 items=300. One huge folder can still enumerate and allocate many entries; earlier roots can exhaust global folder budget. Native scan is background but resource cost is not bounded by 300.

**Required:** A7/A8: document actual output cap, measure large and network folders; narrow/explicit root policy, consider native API improvement only if supported upstream; no replacement JS recursive scanner by default.

#### NC4-083 — Native scan has no cancellation or timeout contract (S/R/P1)

nsIZenLibraryFiles.idl scanMedia returns void and callback only; media-service.mjs:27–34 serializes pending promises, runtime:41–48 wraps callback without deadline. Closing suppresses stale results but a stalled native scan can block later requests and reload barrier. No native stall reproduced.

**Required:** A7: separate UI deadline from native outstanding ownership, expose busy/unknown and safe retry, do not start overlapping walks merely on timeout; test delayed/missing callback.

#### NC4-084 — History clear operations can overlap destructive commands (S/R/P0)

library/controller.js.part:148–155 checks clearing but does not set it or acquire actionSerial; clearRecentHistory invokes native removal after confirmation, other clear or row actions can still start. Each action is explicitly confirmed; no unexpected deletion proven.

**Required:** A7: one destructive-command gate with exact scope, confirmation generation and native result; define close behavior during accepted operation; test duplicate range clear and row deletion while pending.

#### NC4-085 — History result updates recreate date heading nodes (S/R/P2)

library/controller.js.part:247–277 reuses row DOM by ID but creates a new h3 per day each render; unchanged comparison then fails even with same row order. Potential DOM churn/focus scroll cost, not measured.

**Required:** A7: stable group keys and keyed heading reconciliation; measure native history updates and preserve focus.

#### NC4-086 — Smart Search manager state fallback needs exact controller identity (S/R/P1)

smart-search.uc.mjs:145–152 resolves window from controller then registry.windows/byId/controllers, replaces win with state.win. Missing or stale controller metadata can resolve a previous state if manager/controller replaced; disposal unregisters original references only. Existing tests cover normal exact-window and partial install, not manager replacement; no cross-window/private leak established.

**Required:** A6: verify live window/controller/manager generation on query and engagement; fail closed on conflicting identity, keep private guard; test replaced manager, stale controller and same URL across windows.

#### NC4-087 — Page Progress ignores request identity across overlapping loads (S/R/P1)

page-progress.uc.mjs:162–182 uses one active flag per browser and ignores request. Actual listener fixture START A, START B, STOP A, PROGRESS B -> active=false, progress=null, finish(true). Native Gecko ordering/reachability not verified; refines NC4-024.

**Required:** A7: validate real nsIWebProgress network event semantics (redirect, request replacement, cancel) before changing aggregation; test matching native trace and no false completion.

#### NC4-088 — Diagnostics disabled state does not gate pending persistence (S/R/P1)

diagnostics.js.part:93–118 record gates enabled, but flush/persist do not recheck enabled; already queued write can occur after pref off. Private check remains. Whether opt-out should finish previously captured local records is not specified.

**Required:** A0: define disable semantics explicitly, cancel or complete preauthorized flush consistently; test pref flip during queued/write and no new capture; do not claim old files are deleted.

#### NC4-089 — Diagnostics accepts arbitrary event keys and user mark strings (S/R/P1)

diagnostics.js.part:26–34 truncates string values but not key names; record:101–118 accepts caller event/options.key, last map has no cap; api.mark:198–199 stores arbitrary label. Existing producers mostly use fixed names/counts; no demonstrated private data leak. String truncation is not redaction.

**Required:** A0/A8: fixed event schemas, bounded key cardinality and mark enum or explicit safe label policy; audit all producers, no query/path/title/URL payload, test adversarial detail and keys.

#### NC4-090 — Dock and Library duplicate bulk removal orchestration (S/R/P1)

downloads-indicator.uc.mjs:473–493 captures targets and checks generation per entry; library/controller:125–133 calls service.clearCompleted with different result semantics. Both use same native service, not duplicate native data ownership. Independent clear operations can interleave across UI/windows.

**Required:** A7: shared operation service and result contract, explicit scope and concurrency policy; preserve different confirmations and native list-only behavior.

#### NC4-091 — Smart Search collects recent native tabs twice per zero-prefix query (S/R/P2)

smart-search.uc.mjs:394–399 wrapped startQuery collects to set budget; provider.startQuery:175–187 collects again and sorts. Both traverse all stored/native tabs and lazy metadata. Correctness of fresh collection is valuable; cost not measured.

**Required:** A6/A8: profile large tab sets; if justified use query-scoped immutable candidate snapshot keyed by live window/manager generation, revalidate selection; avoid persistent URL database.

#### NC4-092 — Media IDs are regenerated on every refresh (S/R/P1)

media-service.mjs:35–45 assigns new serial ID to every unchanged path on each successful scan. Library render keyed by ID loses stable row/focus identity. Old IDs intentionally invalidated, but no stable view identity separate from capability handle.

**Required:** A7: separate stable opaque view key within session from generation-validated action capability; test same files refresh, rename, removal, focus and stale action rejection.

Seven extracted-source experiments in this checkpoint; NC4-081 uses synthetic ASCII archive and NC4-087 uses synthetic network event order, not native event evidence. All issues remain open. Existing NC4-019/024/025 are refined by NC4-079/087/081, not independent replacement projects. See [pipeline](nocturne/pipeline-0.4.0.md).


### Build, release and consolidation checkpoint — NC4-093–100

#### NC4-093 — Build inliner silently erases unresolved or aliased imports (S/P1)

scripts/build.mjs:19–25 strips every one-line import before checking unsupported declarations; does not resolve symbols/modules, check graph/order, or enforce the comment's named-only subset. Extracted transform fixture: import { missing as renamed } from './absent.mjs'; export function read(){return renamed;} -> syntactically valid output, ReferenceError on call. Current modules use a compatible subset; no existing unresolved production import established.

**Required:** A0/A1: validate exact supported grammar, dependencies, symbols/order/cycles per output; fail closed for unsupported imports, verify both pure module and bundle semantics; retain deterministic no-dependency build unless justified.

#### NC4-094 — Build check cannot detect omitted source fragments (S/R/P1)

build.mjs:12–31 validates listed paths and compares generated bytes; no inventory check against all production src JS/ESM/CSS fragments. Current tree: all 90 unique fragments accounted for, one intentional media-service reuse. New unlisted fragment could silently remain out of runtime.

**Required:** A0: validate source inventory, intentional multi-output reuse and exact output-to-manifest mapping; fixture omitted/duplicate/unknown fragment and invalid plan schema.

#### NC4-095 — Version high-water and timestamp high-water use different histories (S/R/P1)

verify-release.py:38–60 checks timestamps over manifest ancestry but version monotonicity in verify-preview.yml uses HEAD^ only. A prior larger version can be missed in unusual histories/rollback; docs-only failure NC4-027 is related. Existing baseline version regression not established.

**Required:** A0.3: identify last actual publication and historical maxima for both version and timestamp within stable Sine ID; classify full push range, reject runtime changes without new metadata, explicitly define rollback and prerelease/stable policy.

#### NC4-096 — Moving preview endpoints can invalidate a correct older CI checkout (S/R/P1)

verify-release.py:20–25,74–81 downloads branch Raw manifest and branch codeload archive, while CI compares them to checked-out SHA. Concurrent push can supersede checkout during retries. No historical false failure confirmed.

**Required:** A0.3: verify immutable commit artifact separately, check current mutable preview only while expected HEAD remains current; distinguish superseded publication from failure, do not hide true mismatch.

#### NC4-097 — Startup duration migration overwrites an ambiguous user choice (S/R/P1)

startup-animation.uc.mjs:49–58 maps 760 to 1050 once if migration flag missing; preferences.json still offers 760. Extracted migration fixture with existing 760 sets 1050 and flag. Intent is upgrading old Sine default saved as user value; code cannot distinguish old default from explicit choice.

**Required:** A1: document ambiguous legacy migration and preserve explicit settings; introduce versioned preference ownership, avoid repeating migration; fixtures legacy/default/user/locked values. Do not reset existing users or change accepted duration silently.

#### NC4-098 — Package validation lacks complete manifest/preference and CSS contract checks (V/P1)

check-runtime.mjs invokes Node --check only for script names; package test checks exact owner names, count/keys, version and CSS fragment presence, not include values, supportsUnload, preference type/default/option validity, or Gecko CSS parsing. Current manifest has 12 browser.xhtml entries, supportsUnload=true; 37 unique prefs with valid enumerated defaults. Dynamic prefix and CSS-only readers must be included in audit.

**Required:** A0/A8: schema and runtime entrypoint contract tests, preference inventory and migrations, validate CSS syntax/computed behavior in actual Gecko; no Chromium equivalence.

#### NC4-099 — Source-shape tests can preserve superseded duplication instead of behavior (S/R/P2)

window-geometry.test.mjs includes a test explicitly named 'both contour owners use a fixed row-independent trim'; startup-transparency and workspace-transition tests include many source assertions. These are valuable guards today but implementation-shape assertions must be revised with owner cutover. A source match is not proof of one runtime owner.

**Required:** A0/A4/A8: retain invariants, add behavioral overlap/cancel/failure fixtures before replacing source-shape assertions; never delete a regression merely to make new architecture green.

#### NC4-100 — Active source guidance points to historical architecture (S/P2)

src/README.md:17 describes Hub/native Zen Spaces as future work and links docs/architecture.md (historical OnePlane 0.2 baseline), while active Nocturne architecture and migration live in docs/nocturne. Migration historical release numbering still proposes 0.4.x vertical; current audit proposes stabilization gates before any vertical scope. Historical records are not wrong when clearly marked.

**Required:** A0: mark active owner documents and historical snapshots, reconcile roadmap and release scope without rewriting evidence; vertical implementation still requires explicit decision.

Primary static audit checkpoints complete: 100 evidence IDs, 16 extracted-source experiments (not permanent tests/native PASS). Every ID has one primary workstream in the [consolidated implementation ownership table](nocturne/pipeline-0.4.0.md#consolidated-implementation-ownership-100-evidence-ids-not-100-fixes); cross-links are dependencies, not duplicate implementations. P0 risks are prioritized before broad visual refactors. A0.3 release CI implemented; native baseline and actual acceptance pending. No runtime/version change.


### A0.3 — release infrastructure implementation and verification

Implementation: [084a90b](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/commit/084a90b586b6140558215fc38b128d19530d8d04), with follow-up publication-snapshot checks in this checkpoint. [CI 44212872005](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44212872005) passed release-policy fixtures, metadata, npm verify (generated build, runtime syntax, existing Node regressions), immutable/archive and public endpoint verification. Runtime and manifest remain preview.47; no artificial version bump. Follow-up adds intermediate package.json/file checks and two tests; the resulting commit must pass CI as well. NC4-027/095/096 implementation addressed; closure is infrastructure evidence only, not native Sine installation PASS. Other A0 findings remain open.

Contract: an installed-package change is a change to theme.json or manifest-declared CSS/preferences/scripts (including additions/removals). Each package-changing first-parent commit must atomically advance version and updatedAt, with package.json synchronized. Docs/infra-only commits retain metadata and still run the full suite. On push check all package-changing commits from the event's before SHA; on dispatch check current publication boundary against earlier manifest high-water in the retained first-parent lineage. No force-push; history removed by external rewriting cannot be reconstructed by this check. Preview version grammar remains unchanged; rollback publishes restored payload under new metadata. A stable-release grammar is not introduced in A0.3. Immutable Raw manifest and codeload archive must match checkout; moving preview checks may report superseded only after immutable verification and public ref movement, never hide a mismatch at unchanged HEAD. No claim that post-push CI prevents a bad commit being temporarily served; protected/pre-publication workflow would be separate policy.

Regression suite: python -m unittest discover -s tests -p 'test_release.py' (15 cases after follow-up); temporary real Git histories plus mocked endpoint responses. Both existing workflows run it; npm verify remains the existing Node-only command. Native baseline A0.4 and remaining build/import/diagnostic contracts pending. Local full checkout unavailable (GitHub DNS), so CI is the actual executable evidence.


### A0.4 / A1.1 — baseline and narrow lifecycle safety release (preview.48)

Baseline: b33f9921619072d405b7a260f63a8df272691578 (runtime preview.47); [CI 44213024376](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44213024376) passed. No native Zen instance or new baseline trace available in this environment; A0.4 native visual/performance baseline remains open. Do not block isolated source-proven safety guards on broad visual baseline, but capture native evidence before broad cutover.

A1.1 changes NC4-037: per-key preference restoration continues on errors, retains complete snapshot if any key fails, reports aggregate restore/skip/failure. Existing external-value guard and snapshot schema remain. Retained snapshot retry may still have ownership ambiguity when a value equals the mod target; process-wide lease and exact original user/default reconciliation (NC4-006) remain open. NC4-036: Free creation continuation revalidates disposal, closed/projection/private/sync and manager identity before writing ID/reordering and before selection. Already-started native actions are not rolled back; stale creation can leave a real unclaimed Free workspace, claim/reconciliation NC4-007 stays open. No native data deletion or visual change. Four new regression fixtures (three stale Free, one preference failure/retry); source version tags synchronized including Library/Library Services (NC4-026). Tests and actual runtime acceptance tracked separately.

A1.2 next: self-review this release (including exact source/build/manifest/CI and failure scenarios), then design and adopt scoped acquisition for early layout resources and closed-tabs unsubscribe (NC4-044/078); do not add unused abstractions. A1 remains open. User requests a separate self-check every other substantive working response.


### A1.2 — independent self-review and correction (preview.49)

Pinned preview.48 at 6bf2a94db3455634097f9fc53f53e53fc8efbc18; [CI 44213861519](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44213861519) completed successfully, including served artifacts. No parallel HEAD change at start. Diff and actual functions reviewed, two additional extracted-source experiments reproduced incomplete guards in previous release: (1) after partial restore, a released key explicitly set by user to old TARGET was reset on retry; (2) a Free target removed during reorder was passed to native selection. Native event reachability not proven, but both source sequences demonstrated. Native Zen 1.24.2b changeWorkspaceWithID resolves ID then forwards to changeWorkspace; do not invoke stale target deliberately.

NC4-037 refinement: retain optional per-key released marker in existing complete snapshot on partial restoration or failed backup removal, skip already released keys on retry, recapture released keys from current user/default on next activation. Legacy snapshot schema remains readable. New trace fields alreadyReleased/checkpointFailed. Checkpoint write can itself fail; old backup remains, exact ownership recovery cannot be guaranteed across restart/rollback or concurrent process ownership; NC4-006 remains open. Do not describe this as full process preference lease. NC4-036 refinement: recheck native identity, current designation and target presence before reorder/selection; do not overwrite changed designation on create continuation, log bounded stale stages. No compensation/delete for completed native operations; NC4-007 and authoritative native result NC4-033 still open. Six additional test cases plus strengthened old retry case; direct extracted-source corrected retry experiment PASS before commit. No visual/default changes. Version stamps synchronized across entrypoints. Native baseline A0.4 remains pending.

Next A1.3: adopt real acquisition scope for the early mount and Closed Tabs cleanup, with failure injection and incremental cutover. Next alternating self-review after A1.3. No extra runtime owner merely for documentation.


### A1.3 — scoped resource acquisition (preview.50)

Pinned preview.49 at a37f0ea8599418d48391dab1992715ae61742572; [CI 44214897470](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44214897470) PASS. AGENTS re-read. NC4-044: Hub factory creates detached nodes and listener descriptors only; global Hub overlay registration/listeners and drag-controller publication move into the existing guarded strip mount after all lexical declarations initialize. Layout mountScope owns Hub disposal and drag publication, preserves identity guard and existing teardown sequence. Hub scope owns exact event listener release and overlay release (including rebinding); Hub visual cleanup steps isolated. Early MutationObserver/ResizeObserver constructors remain before mount but observation starts in the guarded path. No claim that all later partial mount resources or every controller are now scope-owned.

NC4-078: Closed Tabs subscriptions use the same pure synchronous scope module in Library Services; release deactivates callback before attempting native remove, remaining subscriptions still release after failure, late synchronous acquisition after disposal releases immediately. Scope is LIFO, at-most-once cleanup attempt, explicit boolean/aggregate failure and safe error reporter; no implicit retry for uncertain native release. A failed observer removal can still retain a native reference; callback is inert. NC4-080 Downloads async detach barrier remains separate/open. Shared code is inlined into layout and libraryServices bundles, with independent local instances, no new Sine entrypoint. Eight tests (4 pure scope, 3 Closed Tabs, 1 guarded placement source assertion); native fault injection and real Sine lifecycle remain pending. No intended visual changes. A1.4 next: alternating self-review, especially reentrancy, listener capture, rollback order and native detach failures. Then continue A1 process/window ownership and pending early safety gates. A0.4 native baseline still open.


### A1.4 — independent scope self-review (preview.51)

Pinned preview.50 at 6ff322e177ea48fbcc36650d53e16d569b49670d; [CI 44219818626](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44219818626) PASS. Source experiments on original production functions: failed release returned false then true and still delivered a native listener callback; nested failing release counted as zero failures; cancellation during installTabStrip returned an active strip, set oneplane-active and queued RAF. These are source/mock failures, native reachability of injected errors not proven. Refines NC4-044/078, no new duplicate IDs. Corrected scope fixture passes before commit.

Scope now stores first boolean outcome; guarded listener invalidated before removal, preserves receiver and capture, compensating remove attempted if add throws. Disposal counts nested and late release attempts during that disposal, not earlier manual releases (those report separately). Reentrant disposal itself remains a no-op. No automatic retry of uncertain native detach. Hub overlay generation guards stale callback/rebinding. Closed Tabs consumer callback exception isolated during subscription acquisition, callback reference dropped on release. Activation checks live controller/closed/disposed around prefs/native/mount boundaries, discards stale returned strip and skips readiness. Strip checks cancellation at key synchronous handoffs and existing rollback path handles partial mount. Six new tests plus strengthened existing fixtures. Remaining: full process preference lease NC4-006, beforeunload reset NC4-038, all early resources and native reentrancy not exhaustively proven; uncertain native detach may retain inactive listener. No visual or preference-default changes intended; native baseline A0.4 pending. A1.5 next: process/window ownership design and scoped implementation; A1.6 alternating self-review. No expansion to async Downloads barrier in this patch.


### A1.5 — Layout process/window preference ownership (preview.52)

Pinned preview.51 at ee722b3d7676fc174c39f703b4bdb01560d52c7b; [CI 44220408884](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44220408884) completed PASS. NC4-006: separate window lease from UI active/disposed state; retain lease during synchronous local teardown, first live owner applies global Layout overrides and joining windows do not rewrite them. Last lease restores existing backup. New backups add optional owned flag to distinguish actual writes from no-op acquisition, checkpoint before writes, preserve explicit user/default state when still distinguishable; legacy schema remains supported. Startup placeholder preferences have a different persistence policy and existing observer lease; unchanged except diagnostic version. No new native preference identifiers or process singleton. Remaining: mixed old/new controllers, indistinguishable same-value user edits, snapshot write failure and native reentrancy during process writes; no claim of complete atomic native transaction.

NC4-038: beforeunload is a tentative close hint, expires after 1000 ms; native unload explicitly distinguished. If Sine calls cleanup during the hint, schedule one bounded native LayoutUpdate fallback only if no replacement is registered and window survives, not shutting down. Source verification of [Sine 2.3.3 manager](https://github.com/CosmoCreeper/Sine/blob/v2.3.3/src/core/manager.sys.mjs): beforeunload invokes removeListenersForDOM, which invokes unload callbacks and removes them; cancellation may therefore leave mods unloaded even if the window survives. Nocturne cannot guarantee remount, and does not modify Sine or reinstall scripts. Timer is a fallback, not a cancellation proof. Actual native close, global quit, Sine update/reload and cancel require native validation. Seven new regression tests exercise shared ownership, nested teardown, no-op keys, external changes, close fallback and native unload. A1.6 next: independent self-review of lease handoff, reentrant snapshot writes and exact preference ownership; then next A1 lifecycle block. Native baseline A0.4 open.


### A1.6 — independent preference lease self-review (preview.53)

Pinned preview.52 at 98eb78231c2d91ce8950e6c5702c830c7b23296d; [CI 44222452118](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44222452118) PASS. Two source experiments reproduced gaps: a joining window calling native hideToolbar rewrote user Compact Mode hide choices, and cancellation during first backup write left an unowned backup. Verified Zen 1.24.2b [Compact Mode source](https://github.com/zen-browser/desktop/blob/1.24.2b/src/zen/compact-mode/ZenCompactMode.mjs): hideToolbar sets both native hide prefs then dispatches ZenCompactMode:LayoutUpdate. TARGET already writes these prefs, so replace duplicate setter with its notification (before mount, existing after-mount notification retained). Native manager capability guard remains. This does not constrain native Zen's own policy or user actions.

NC4-006 refinement: hold window lease through synchronous snapshot/native preference mutation; local cleanup invalidates immediately, final lease release and fallback occur once mutation returns, including observer-driven cancellation. Snapshot validation failure does not restore invalid backup. Five additional tests, all twelve ownership fixtures executed against extracted updated source before publication. No new runtime preference identifiers or intended visual changes. Limits: partial write of backup followed by throw, indistinguishable same-value edits, mixed-version windows, and further native observer reentrancy remain risks; A0.4 native verification pending. Sine beforeunload cancellation caveat remains NC4-038. Next A1.7: remaining lifecycle cleanup (NC4-080 async Downloads detach, NC4-043 native prototype ownership), with independent review A1.8. Request a bounded native checkpoint for preview.53 after CI: clean test profile/legacy Refined disabled, two normal windows, close one, verify remaining interface and normal disable/re-enable/restart, collect diagnostic file; no manual native preference mutation or destructive data action. Do not require a fresh user test for every intermediate commit.


### A0.4 / A1.6 — native smoke checkpoint (preview.53, 2026-11-18)

User reports normal operation and no visible difference after the requested lifecycle smoke test. Analyzed the entire supplied schema-2 JSON locally; retain only aggregate evidence here, not the raw user diagnostic file or window identifiers. Runtime pinned to 1d177a677263aa3829194049b9e894054bc9539d; [CI 44223228519](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44223228519) completed PASS. The actual installed Zen/Sine versions and exact user actions are not independently established by this file.

- Three distinct preview.53 recorder sessions, 955934 bytes total, 672 unique events (deduplicated by per-session sequence across startup and ring). First session ring trimmed 274 events; no missing-file/byte-cap claim. Each session records layout native ready, lease acquire (shared true once, false twice), strip installed and layout ready. Confirms acquisition paths, not complete process ownership release. One early Closed Tabs scope-dispose event reports released=0, failed=0; no nonzero detach proof.
- All 28 retained tabs.sync records match native/mirror counts; four retained workspace.native.end events report cancelled=false, superseded=false. Two recorded startup icon readiness events show 16/16, no pending/missing/failed/timeout. These are trace observations, not proof of every native mutation or visual frame.
- 198 frame-summary samples, 6204 recorded RAF intervals, 28 above 25 ms, max 84.77 ms (per session 84.77/62.59/44.44 ms). Not presented FPS, no full interval distribution or matched diagnostics-off baseline, no before/after performance claim. Preserve this post-change reference for A3/A4/A8, not a replacement for missing preview.47 native baseline.
- All three traces end at disassembly.native.before; no retained layout.cleanup.begin, lease release, prefs.restore, window.unload or diagnostics.dispose events. This is a concrete terminal-evidence gap, not proof that native cleanup failed. Existing recorder closes with Sine/unload and queues async file writes; source permits order-dependent loss of later producer events and process exit before persistence. Sine 2.3.3 also calls cleanup from beforeunload. Exact loss mechanism not established in this trace. Refines NC4-025/028 and NC4-006/037/038/044/078 verification gaps; no duplicate issue IDs. Native smoke accepted as partial evidence; A0.4 and G2 remain open. Do not request identical close/restart test again until terminal collection is improved or an explicit surviving-window flush can capture a different observable outcome.

Next A1.7: prioritize terminal lifecycle evidence contract together with remaining native resource cleanup (NC4-080, NC4-043); avoid a second logger, artificial delay of native shutdown, or unbounded buffers. Record aggregate release outcomes with existing diagnostics where possible while window survives; verify Sine ordering and native close best-effort limitations. Next alternating review A1.8. Documentation-only checkpoint; no runtime version bump.

### A1.7a — Layout terminal lifecycle ownership (preview.54)

Pinned preview.53 at 88c61b52699a988f796b10fdbbb02f24f5cd182d. [Sine 2.3.3 manager](https://github.com/CosmoCreeper/Sine/blob/v2.3.3/src/core/manager.sys.mjs) addUnloadListener stores exactly one callback per script/window (Map.set); Layout's earlier boot/diagnostics/Center Motion registrations are overwritten by its final bootstrap registration. This is source-confirmed ownership loss on Sine disable; exact cause of missing native terminal writes remains unproven. Final Layout cleanup now explicitly releases captured boot and Center Motion resources, then strip/native prefs, emits layout.cleanup.end and quiesces the captured recorder. Recorder stops sampling immediately and keeps the trace for one microtask of synchronous terminal producers; no shutdown delay or guarantee of subsequent async producers/disk writes. Failed cleanup steps and coalesced write failures are reported; startup archive now shares the byte budget (120,000 bytes per session archive, startupDropped), preserving the existing 2 MB/three-session limit. No new preference IDs, visual redesign or second logger. Sine beforeunload cancellation remains open. Early fragment registrations remain partial-initialization fallbacks; later native entrypoints and active closing handoff are not redesigned. 21 existing/new diagnostic and lease fixtures passed in an isolated JS harness with mocked browser services (four added); changed runtime scripts parsed in V8, not a full Node/CI build or native acceptance. NC4-025/028/037/038/044 refined; A1.7b (NC4-080 Downloads and NC4-043 Hub native overrides) and A1.8 independent review remain open. Do not repeat the full native test until the complete candidate is ready.


### A1.7a-R — Terminal lifecycle self-review (preview.55)

Preview.54 (55205b8acd9e7f394fe4a46b0b3d7407a8121b7e) CI [44227352921](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44227352921) failed: 342/343 Node tests passed, the Magnetic Bookmarks provenance lock was not updated with the version-only change. Build and runtime parser passed; served package check was skipped. The review corrects the lock against the exact preview.55 runtime commit (b4b01ba6a53076031a35ba7f66389bc2a436c0f6), not by weakening the provenance test.

NC4-025/044/081 refinements: same-window reload reused neither the diagnostic write queue nor the old session coordinator; concurrent pending writes could race. Reuse the existing coordinator even when the last window reloads; concurrent flush callers join the actual follow-up write. A failed native listener removal must not re-arm sampling. Finish the old Layout before new fragments mount, preserve startup/reload identity, and compose fallback Sine callbacks for partial initialization. Center Motion stale handles cannot clear replacement markers or schedule a dead handoff; isolate cleanup steps and log aggregate failures. Delegated closing effects remain owned by the existing close transaction; this is not proof of correct native close cancellation.

Five added regression fixtures; 26 targeted cases executed against updated source in an isolated JS harness (11 diagnostics, 13 lease ownership, two new Center/prelude cases). Runtime parser checked. Full Node/CI and native validation pending at publication. Retain NC4-038 and terminal IO best-effort caveats: the recorder's microtask is not a guarantee of later asynchronous or sequential Sine unload producers; no shutdown delay. No new preferences or intended UX changes. User requests independent self-review after every substantive implementation response. A1.7b (NC4-080/043) remains next only after CI passes; A1.8 final cross-owner review remains open.


### A1.7b — Native resource cleanup (preview.56)

Pinned preview.55 45ff7e247385d8a2c63e99ac3c48d1754f672142: [CI 44230406959](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44230406959) PASS, 348/348 Node tests and immutable/current served archives verified. Native target [Zen 1.24.2b surfer.json](https://github.com/zen-browser/desktop/blob/1.24.2b/surfer.json) pins Firefox 160.0. Verified [DownloadList](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_160_0_RELEASE/toolkit/components/downloads/DownloadList.sys.mjs) addView uses Set.add and synchronous replay; removeView uses Set.delete of exact identity (safe retry). No Zen DownloadList patch in tagged tree. [URILoadingHelper](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_160_0_RELEASE/browser/modules/URILoadingHelper.sys.mjs) returns boolean synchronously, [UrlbarParentController](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_160_0_RELEASE/browser/components/urlbar/UrlbarParentController.sys.mjs) switchToTab calls it synchronously and unregisters a false-result open-tab entry; [Zen URI patch](https://github.com/zen-browser/desktop/blob/1.24.2b/src/browser/modules/URILoadingHelper-sys-mjs.patch) substitutes allUsedBrowsers and switchIfNeeded, not the split-view index branch.

NC4-080: a stable per-window lease retains the exact failed native view, rejects new acquisition while detach fails, and retries only on an explicit subsequent acquisition/disposal. Invalidate callbacks before removal and on add failure; serialize pending add with release. Retain legacy pending Promise barriers across intermediate unstarted generations. An unrecoverable native remove failure intentionally leaves the Downloads projection unavailable rather than adding a second view. Native list data/files are untouched. No guarantee for old versions that already lost the reference or unresolved native promises. Aggregate library.downloads.detach event (released/retained). Five new tests including failure, partial add, concurrent replacement, false legacy barrier and multi-generation legacy barrier.

NC4-043: invalidate all temporary getters before isolated reverse restoration, preserve foreign getter identity and native outcome even if restoration fails. A stranded getter delegates to native original state rather than stale filtered snapshot; do not layer further scopes over an unresolved getter. Suppress synchronous reentrant reuse; isolate URL-bar prototype and window-wrapper release, preserve foreign wrappers. Six fault-injection fixtures. New source-confirmed risk within NC4-043: upstream split-view path uses gBrowser.tabs[i] after indexing Zen allUsedBrowsers. Filtered indices can select/move an unrelated tab. Guard exact tab identity alignment; on mismatch use existing local-open fallback, never invoke native split move with wrong indices. This exceptional fallback is an explicit behavior choice; A6 native integration must revisit a narrower correct split-aware API. Native open-tab provider race and arbitrary foreign/native reentrancy remain open; no native test proof.

Eleven new fixtures; fourteen targeted extracted-source cases passed (eight Downloads including legacy migration, six Hub), changed generated runtime scripts parsed. Node CI and native acceptance pending at publication. Existing UX/prefs preserved on normal paths; no new preference IDs or independent logger. A1.7b-R is next (independent self-review after each substantive implementation), followed by A1.8 cross-owner review; all existing issue IDs remain open pending acceptance.


### A1.7b-R — Independent native resource cleanup review (preview.57)

Pinned preview.56 6e1970ff71c034d0d49bb518d486314cc73f98d5: [CI 44232630465](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44232630465) PASS, 359/359 Node tests and immutable/current served archives verified. Two regressions reproduced in isolated JS against actual preview.56 source: (1) pending loadList with no native view left disposal and replacement start unresolved after 25 microtask turns, zero addView calls; (2) reentry from first allUsedBrowsers getter triggered two native lookup calls before first scoped getter existed. These are synthetic fault-injection results, not proof of frequency in Gecko.

NC4-080 refinement: dispose invalidates the generation and releases its lease immediately if no native view has been acquired (including pending legacy barrier or loadList); a late resolution checks dead and cannot attach or clear another generation's lease. Once source exists, still await the pending addView/rollback before removing exact view. Native addView/removeView promises that never settle can still block exclusive acquisition; do not fabricate timeout success. Two new fixtures.

NC4-043 refinement: shared synchronous URI transaction token on the imported native helper, acquired before any temporary manager getter and retained through rollback; block nested scoped calls and URL-bar calls even for an unregistered client while token live. Restore descriptors independently, invalidate token and respect foreign identity. Cancellation during getter acquisition or throwing getter cannot dispatch another native lookup/open. Source review of Firefox 160 [UrlbarParentController](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_160_0_RELEASE/browser/components/urlbar/UrlbarParentController.sys.mjs) and [UrlbarShared](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_160_0_RELEASE/browser/components/urlbar/content/UrlbarShared.mjs): prior local precheck plus original switchToTab could still unregister a valid provider entry if native match subsequently failed. Use native URILoadingHelper matcher once with openNew=false; preserve successful empty-tab removal (only distinct connected previous tab, no split) and non-heuristic adaptive history. Preserve existing local new-tab fallback on miss; do not invoke provider unregister on scoped misses because they do not prove global absence. Genuine stale provider entries may therefore persist until native maintenance; revisit narrower native integration at A6. Context sentinel follows native != -1 semantics; split-index safety guard retained. Six additional Hub fixtures. No new prefs, no new logger, no normal-path visual redesign.

Eight added regression tests; 21 focused source fixtures passed in isolated JS (nine Downloads and twelve Hub), runtime parser passed. Full Node CI/served artifact and real Zen validation pending at publication. Arbitrary direct helper calls outside the installed wrappers, native cross-compartment identity, unknown foreign wrappers and permanently unresolved native promises remain limitations. A1.8 cross-owner review next after CI; keep all issue IDs open pending required validation.


### A1.8a — Cross-owner startup lifecycle checkpoint (preview.58)

Pinned preview.57 1b7b4781bc73382baf98d0f100356ffe10c5afaf: [CI 44233842195](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44233842195) PASS, 367/367 Node tests and current/immutable served archive verification. AGENTS re-read in full; source/architecture/pipeline/validation reviewed. A1.8 review identifies incomplete startup and preference lifecycle ownership, not a completed A1 gate.

NC4-097: remove ambiguous 760-to-1050 rewrite in startup-animation.uc.mjs. Preserve all supported existing values, including 760; manifest default remains 1050. Leave the historical migration flag untouched; cannot reconstruct an already overwritten user choice. No profile data migration. One regression fixture.

NC4-037/006: Startup Placeholder sync now holds its active lease through synchronous native preference writes, defers final release during reentrant cleanup, checks disposal before each write, and reconciles a reentrant option change after current sync. If an interrupted owner transfers to a surviving window, the successor reconciles the current option. Existing native close versus mod disable distinction retained. Two regression fixtures. This is not a unified process-wide preference coordinator; final restoration, same-window replacement during a synchronous observer, mixed-version windows, and callback/backup write faults warrant independent review. No new preference keys.

NC4-005/044: Layout cleanup stops active Assembly before releasing Center Motion and strip hosts. Assembly isolates cleanup calls (timers, observers, animation handles, Home handoff, owned styles/marks and listeners), logs aggregate failures; Boot separately isolates removal and avoids clearing a replacement's marker. Preserve normal close visual delegation, no new motion timeline or synthetic delay. Three additional fixtures, including ordered cross-owner Layout teardown. Native unload order, reentrant replacement of shared DOM owners and arbitrary failed native removals remain open.

Six new regression tests. Eleven focused extracted-source checks executed in isolated JS (eight startup preference tests, three Assembly/Boot tests); new Layout order fixture awaits full Node CI. Changed runtime parser checked. CI/native acceptance pending at publication. NC4-005/030 remaining scope/dependency extraction, startup and workspace/close ownership interactions, diagnostics terminal persistence and process/window permutations require A1.8-R independent review and potentially further A1.8 checkpoints; A1 remains open. Do not request a native smoke test until candidate and scope are checked; retain the intended multiwindow/user preference/Downloads/URI/Split View checkpoint.


A1.8a CI correction: preview.58 initial [CI 44234515670](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44234515670) passed 372/373 tests; the remaining source assertion required the old literal `bootPreparing=false;removeBoot();` even though the new failure-isolated `step(removeBoot)` executes the same cleanup. Update the assertion to the new contract; retain the executable cleanup fault-injection tests. Test/docs-only correction, no runtime or manifest changes; rerun full CI before proceeding.

### A1.8-R — Startup preference ownership independent review (preview.59)

Pinned preview.58 74261e6750e4d9c86dfd32c70bc46062beb032d2: [CI 44234637741](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44234637741) completed successfully after the test-only correction. Two source-level fault injections against actual preview.58 reproduced defects: same-window reload during final restore yielded [false,true], absent backup and one observer; malformed JSON backup was replaced and both native preferences changed to false. These are synthetic observer/fault scenarios, not user profile observations.

NC4-037/006: keep the last active Startup Placeholder lease published throughout synchronous restoration, then check for a successor again; new windows join without racing restoration. Same-window replacements use one cancellable pending identity, register unload before releasing the old lease, and install after the synchronous stack unwinds if needed. A cancelled pending replacement never acquires preferences. Validate legacy backup shape and known keys before mutation; invalid backup is preserved and the feature fails closed. Checkpoint per-key released progress and avoid restoring a default value no longer carrying the mod's user value. No new preference IDs; the existing journal gains optional released boolean, no automatic correction of corrupt profiles. Six new fixtures; all fourteen startup ownership tests passed in isolated JS, runtime parser passed. Full CI and native confirmation pending. Failure of both native restore and persistent checkpoint, unobservable same-value user edits, mixed old/new script versions, and arbitrary native observer behavior remain limitations.

Cross-owner review also inspected workspace-transition.uc.mjs cleanup/cancelEffects/releaseGeometry and closing-animation.uc.mjs restore/dispose. Concrete source risks: workspace cleanup sets cancelled before center release, but a throwing release/DOM restore can prevent waiter resolution, active=null, phase/geometry removal and listener teardown; close restore similarly can skip remaining style/marker cleanup and dispose can skip wrapper/listener release after a throwing step. Record under NC4-005/044/003/038; next A1.8b fault-injection and failure-isolated workspace/close cleanup, preserve native command gate and sealed close delegation. Do not claim these paths corrected in preview.59. A1.8b-R independent review then bounded native checkpoint. A1/G2 remain open.


### A1.8b — Workspace and Closing lifecycle cleanup (preview.60)

Pinned preview.59 3462acf50f2cf4fb5e523550f232497ac596333c: [CI 44235040575](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44235040575) PASS, 379/379. NC4-005/044/003/038: isolate Workspace geometry release, style restoration, animation/center cancellation, timer clearing, waiter resolution and listener removal. Cleanup invalidates the transaction before releasing resources and blocks synchronous recursive cleanup; an intent arriving during cleanup resumes at the microtask boundary. Cancelled waiters resolve even if timer clearing fails. Guard outgoing/incoming continuations after cancellation and preserve native return value when post-native visual work fails; native rejection remains authoritative. Watchdog acquisition failure falls back to the native command once. Existing command gate remains independent of visual lifetime; no extra concurrent native commands or forced cancellation.

Closing: bind seal and dwell timer callbacks to the exact request; failed timer cancellation cannot revive a stale request, and failed terminal dwell scheduling proceeds with native close. Keep normal 650+110 ms timing and sealed frame delegation through synchronous native close. Restore remaining effects, attributes, style properties, sheet, wrapper and observers even after another cleanup step throws. Do not claim a failed native removal succeeded; emit aggregate failure counts. No new prefs, redesign or synthetic wait.

Seven new regression fixtures (four Workspace, three Closing). 23 focused runtime/extracted-source checks passed in isolated JS (12 Workspace, 11 Closing); changed runtime parser passed. Full CI/native acceptance pending at publication. Residual cross-owner risks: reentrant generation replacement during native DOM/style operations, arbitrary unrecoverable native removals, cancelled close with Sine callback disposal, and cross-surface bookmark handle ownership (A3) remain open. A1.8b-R independent review next; verify reentrant close begin/clear, Workspace phase dispatch and late callbacks, and bounded native checkpoint before closing A1. Keep A1/G2 and issue IDs open until acceptance. 


### A1.8b-R — Workspace and Closing independent review (preview.61)

Pinned preview.60 f084a2f977f4e4238a05298d668fbf6bf2f7bb83: [CI 44235710058](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44235710058) PASS, 386/386, current and immutable archives verified. Two synthetic reentry scenarios reproduced against actual source: idle dispatch during cleanup triggered nested and superseded outer native Workspace callbacks (["nested","second"]); nested close request during clear invoked native close twice. Not observed in a real profile.

NC4-005/044/003/038: register latest workspace intent before cleanup/phase dispatch; defer nested visual work during synchronous phase/effect/cleanup steps to microtask boundary, recheck request identity and supersession before/after cleanup and before native invocation. Do not overwrite an existing native command gate. Retain pending native command across replacement. Close controller guards starting/finishing/committing, defers reentrant flush/second close until begin or seal returns, gives disposal precedence during acquisition, suppresses nested calls through clear/native completion, and preserves the existing sealed terminal frame. Preference observer inert after disposal. Normal timings, native close and workspace APIs unchanged; no new prefs.

Six new fixtures (two Workspace, four Closing); 29 focused source/runtime fixtures PASS in isolated JS (14 Workspace, 15 Closing). Changed runtime parser passed. Full CI and native acceptance pending at publication. Existing preview.60 bounded failure diagnostics remain; no added raw content. Residual risks include arbitrary synchronous replacement during DOM/native mutations across generations, failed native removal, unobservable same-value pref edits, mixed script versions, unresolved native operations, Sine beforeunload cancellation behavior, and cross-surface bookmark/Center ownership assigned to A3. Not a claim of complete Lifecycle correctness.

Next: bounded native checkpoint on the published CI-green package. With non-destructive test tabs, verify normal startup, rapid Workspace changes and Escape, close one of two windows and surviving window, reload/disable/re-enable in the surviving window (if available), native preferences and Downloads/Library readiness, local/foreign Workspace URI reuse and Split View. Collect diagnostics once after the surviving window is active; do not inject faults or manually mutate native prefs. Native baseline and A1/G2 remain open pending evidence; no new work on A2 until checkpoint evaluated. A1 scope/dependency extraction remains incremental and must not be marked complete solely from this batch.


### A1 native checkpoint — preliminary user observation (preview.61)

Preview.61 `8d3d8ec742c06d7ea51b8e0cdccdf69135d73414`: [CI 44236262073](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44236262073) PASS, 392/392, immutable and current served archive verified. User response to the requested native checkpoint: “Вроде все норм” (no obvious problem reported). This is preliminary subjective evidence, not individual scenario acceptance or confirmation of the installed build. No new diagnostics JSON was attached to this response. Await the existing diagnostic file, without repeating the smoke test, to verify build identity, native command outcomes, teardown/lease release and surviving-window evidence. A0.4, A1 and G2 remain open. No runtime changes or version bump.

### A1 native checkpoint — preview.61 diagnostics evaluated

User reports no obvious visual regression and supplied schema-2 nocturne-diagnostics.json (1,049,012 bytes). All three retained sessions and every recorded script version agree with preview.61; 810 unique events (86/440/284, startup archive deduplicated by sequence), zero dropped. CI [44236262073](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44236262073) PASS 392/392 on runtime 8d3d8ec742c06d7ea51b8e0cdccdf69135d73414. Native evidence: 33 tabs.sync events, all native==mirror; three assembly.cleanup failed=0 (one Boot skip from trusted keydown, two complete startup runs with 16/16 and 14/14 icons ready, no timeout); ten recorded Center releases failed=0 (two startup, eight workspace); four complete Workspace out/swap/in/idle cycles with four native.end cancelled=false superseded=false, four geometry locks and matched locked releases, four cleanup failed=0 and keepGate=false. Split geometry and sampled split groups/handles present; not proof of all split commands. Native TabOpen/Move/Close recorded in surviving window; final sample has visible=mirror=16, icons=16/16, startup/closing/center/ghost/detached/laneGhost=0. New window acquires Layout pref lease shared=true, survives alongside original window; original window still sampled after new window starts. Two close requests reached sealed then native.before with closing=true; observed seal-to-native dwell 110.60/112.66 ms. No repeated native-before per recorded close. No recorded positive cleanup failure counts. 7,684 sampled RAF intervals, 39 >25 ms (0.51%); per-session maxima 52.54/115.12/127.77 ms; no presented FPS or like-for-like performance improvement claim. Peak gaps coincide with close acquisition, tab open/move, and a later non-closing sample respectively; causality unproven.

Partial native acceptance only: both closing sessions end at disassembly.native.before, with no terminal layout.cleanup.end, layout.prefs lease release, diagnostics.quiesce/dispose or native-after evidence. Same gap as preview.53, despite preview.55 guarded quiescence. This is an observability gap, not proof of leaked resources. Source review: persist() snapshots and queues an asynchronous IOUtils.writeUTF8 task; flush() joins in-flight work; requestDispose() schedules final dispose in a microtask. A destroyed window may not finish those continuations; no synthetic native shutdown delay permitted. NC4-045/081/005/037: investigate process-owned snapshot handoff to surviving recorder / stable process context before further native checkpoint. Do not repeat entire smoke test. No workspace.escape or superseded transition recorded, no hot reload or mod-disable terminal evidence, no scoped URI reuse outcome; Library reports enabled=false, historyShortcut=false, downloadsShortcut=false in all three sessions, so registration is confirmed but opening / native Downloads subscription detach is not. No assumptions about user configuration changes. A0.4/A1/G2 remain open; current normal-path smoke accepted as partial evidence, terminal/disable gap next, then A2. No runtime changes or version bump.

### A1.9 — Terminal diagnostic persistence ownership (preview.62)

Preview.61 native checkpoint (e73dfe2): both closed-window files end at disassembly.native.before, not evidence of failed cleanup. Actual source has two lifetime hazards: the old flush() waits for a prior writer promise before even capturing later dirty snapshots; the IO task and its Promise continuations live in the browser-window realm. A process-shared reference to a window-owned Promise does not make its callbacks independent of that realm. The lack of native terminal events could additionally mean producers never executed; native investigation remains necessary.

Alternatives: (1) delay native close until IO completes — rejected (native shutdown/UX contract); (2) hand off to a surviving window — cannot cover last-window close or zero-window intervals; (3) existing writer queue in a standalone Gecko sandbox — chosen, no separate diagnostics service, mod entrypoint or browser data owner. Firefox 160 [Sandbox.cpp](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_160_0_RELEASE/js/xpconnect/src/Sandbox.cpp) registers IOUtils, PathUtils, TextEncoder as wantGlobalProperties; [xpccomponents.idl](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_160_0_RELEASE/js/xpconnect/idl/xpccomponents.idl) defines system-principal Sandbox/freshZone and evalInSandbox; [BrowserWindowTracker](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_160_0_RELEASE/browser/modules/BrowserWindowTracker.sys.mjs) exports a mutable module singleton. Use only a non-enumerable mod-owned symbol expando on that module, no native fields/hooks modified. Evaluate only static bundled createWriter source, never any log or profile data. JSON strings are the sole submission input; no window, DOM, caller-owned IO or callback is held by the independent writer. The window reference is an alias of the queue, not an additional owner.

NC4-045/081/005/037: every flush with dirty data synchronously captures and submits a snapshot, even if disk I/O is outstanding; quiescing producer records also submit before returning. The independent writer serializes atomic writes, coalesces the latest pending snapshot per session, caps pending sessions at three plus one active, stores packed bounded sessions, and shares the queue across a zero-window interval if the process anchor succeeds. Existing schema 2, three recent sessions by creation, startup archive, 2,000,000 UTF-8 bytes and private exclusion unchanged. No artificial shutdown wait. diagnostics.ready.writer distinguishes process / independent (unanchored) / local / legacy-blocked / unavailable. Mixed older recorder queues are not replaced; restart the whole browser for the new contract. A fallback window-local queue does not solve realm lifetime. No new prefs. Initial isolated harness lacked TextEncoder for the local fallback; corrected harness explicitly injects it, no runtime workaround. All 15 focused diagnostics tests pass, including four new tests for terminal handoff during pending IO, bounded latest queue, zero-window anchor/private isolation, legacy queue block. Runtime parser passes; full CI and real Gecko sandbox/CCW behavior pending.

A1.9-R next: independently review process-anchor publication, fallback/legacy coexistence, bounded queue and failure/disable semantics, actual Sine access to Components.utils, producer reentrancy and late terminal events. Then one targeted multiwindow-close/disable native checkpoint, not whole smoke repetition. Process shutdown and absent producer execution remain best effort; do not claim terminal persistence guaranteed or close A1/G2 yet.

### A1.9-R — Diagnostic writer independent self-review (preview.63)

Reviewed preview.62 at `2d484894fd598fbf5539a5ad1f2112c71327bd23`; [CI 44238132257](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44238132257) succeeded. Source review found two independent correctness gaps. Discovery accepted a modern alias/anchor without checking every visible peer, allowing a legacy queue to coexist unnoticed or two independent modern owners to be silently selected. Lazy event detail executed after allocating the event sequence/time, permitting synchronous nested records to appear out of order and a detail callback to append after disposal/disable.

NC4-045/081/005/037: consider own alias, process anchor and all accessible peer aliases before selecting or publishing a writer; legacy evidence takes precedence, distinct modern queues block writes (conflict-blocked). Do not replace running queues or publish a new process anchor on conflict. The recorder still supports local dump; a complete browser restart is required for mixed generations/conflicts. Discovery is not proof that inaccessible peers or the actual Gecko cross-compartment identity behave as expected. Commit event sequence/time after sanitized detail evaluation; re-check dead/enabled before committing. Preserve immediate terminal snapshot submission, bounded/coalesced writer, private exclusion, file schema/byte cap, no artificial shutdown delay. Warning distinguishes unretained snapshot from missing file access.

Runtime `57f501a9b5347c6c39bca5abecfc5baea050146f`: all 19 focused diagnostics fixtures PASS in isolated JavaScript harness (four added: legacy peer after modern alias, distinct queues, nested sequence/time, disposal/disable during detail). The 11 versioned runtime scripts parse as async function bodies; three changed generated outputs reconstructed by exact source-fragment replacement. This is not a substitute for the canonical full build/package CI. GitHub full-source reconstruction hit connector call limits; no full local suite claim. Full CI and actual Gecko/Sine process-anchor, terminal persistence, disable/re-enable evidence remain pending. No claim that absent producers execute or that disk IO survives whole-process termination.

Next: confirm published full CI, then targeted native checkpoint only: fully restart Zen into preview.63, open two windows, close one while the other remains, exercise surviving window and collect one diagnostics file. Optional Sine disable/re-enable if supported; avoid destructive profile operations. Verify same build, writer mode, terminal events/lease release, no new cleanup failures and surviving activity. A0.4/A1/G2 remain open; then evaluate A2 readiness.

### A1.9-R — preview.63 publication verification

Pinned `667b332bc4d3bfa04475a0164e5c95b9ff16640a` (runtime `57f501a9b5347c6c39bca5abecfc5baea050146f`). [Verify preview package #44239591704](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44239591704) completed successfully: 15 Python release-policy tests, five reproducible generated outputs, all 12 runtime parser checks, 400/400 Node tests (0 failures/skips), monotonic publication metadata, immutable archive and current public Raw/codeload verified. This supersedes the isolated build/parser limitation for this checkout only. Native Gecko/Sine writer mode, closed-window terminal records and resource/lease cleanup are still unverified. Next: fully restart into preview.63, open a second browser window, close only the second, create/close one disposable tab in the surviving window, allow its scheduled write to complete and collect diagnostics without closing the survivor. Do not repeat previously accepted normal-path smoke. A0.4/A1/G2 remain open; optional supported mod disable/re-enable is a separate checkpoint if needed. No runtime changes.

### A1.9 native checkpoint — process writer verified, terminal producer ordering still open (preview.63)

User reports no obvious visual regression and supplied schema-2 diagnostics (716,314 bytes). Three retained sessions: one historical preview.61 (284 events, excluded from new-version acceptance) and two preview.63 sessions (158 + 118 = 276 unique events; startup archive matches ring; zero dropped; monotonic sequence/time; all recorded script version fields match session). Both new non-private recorders report writer=process; first Layout lease acquired shared=false, second shared=true. All seven tabs.sync have native==mirror. Two startup cleanups and two startup Center releases report failed=0, 16/16 source icons each; no recorded positive cleanup failure counts.

Second-window close: disassembly.request n97, effects n103, sealed n110, native.before n112, native.after n113 closed=true, deactivate n114, pagehide n115, unload n116, diagnostics.quiesce n117 failed=0, diagnostics.dispose n118 closed=true. Seal-to-native dwell 115.47 ms. First window subsequently records activate, samples and two tabs.sync, then its own beforeunload/pagehide/unload/quiesce/dispose (closed=false at dispose). No native.TabOpen/TabClose events in either new session, so the requested disposable-tab step is not confirmed; do not infer user error or exact close/navigation cause. First-window final sampled counts: visible=mirror=16, icons=16/16, startup/closing/center/ghost/detached/laneGhost=0. No need to repeat successful writer test. Process-anchored writer persistence through observed native unload and diagnostic quiescence/disposal is evidenced; not guaranteed for arbitrary whole-process exit.

Neither new session contains layout.markClosing, layout.cleanup.begin/end, layout.prefs release/restore, center.dispose, startup-prefs.cleanup or workspace.dispose. At diagnostics.dispose both still have oneplane-active and startup-ready; closing window additionally retains close markers. Missing terminal records are not proof of failed resource cleanup. Source check: diagnostics registers a capture unload listener calling requestDispose(), which stops sampling and schedules dispose via Promise microtask; Layout's nativeUnload is registered later, non-capture, and Sine 2.3.3 removeListenersForDOM executes callbacks from beforeunload. Firefox 160 [EventListenerManager.cpp](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_160_0_RELEASE/dom/events/EventListenerManager.cpp) surrounds listener invocation with nsAutoMicroTask; [CallbackObject.cpp](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_160_0_RELEASE/dom/bindings/CallbackObject.cpp) enters/leaves microtasks. Existing fixture assumes same synchronous stack for unload producers. Extracted actual preview.63 recorder fixture: invoke registered unload callback, await microtask checkpoint, invoke simulated subsequent layout.cleanup.end producer: trace already removed, event not retained, tail diagnostics.quiesce/dispose. This reproduces a real ordering vulnerability, not proof of actual native listener scheduling or Sine callback execution in this run.

NC4-045/081/005/037 follow-up A1.10: replace implicit microtask-as-end-of-unload assumption with explicit owner terminal handoff, separate sampling quiescence from trace closure and native-exit vs mod-disable paths. Evaluate Layout-owned completion, safe early-init fallback and late independent producers; preserve native close behavior, avoid timers to keep a dying window alive, no second writer or duplicate cleanup owner. Test checkpoints between listeners, missing owner, Sine callback and native unload order, reentrant/idempotent release, same-window replacement, private/disabled recorder. Review actual Sine callback registration and native event filtering before selecting implementation. A1/G2/A0.4 remain open; A1.9 process-writer native checkpoint accepted narrowly; no version bump in this evidence commit.

Other observations: 2,182 sampled RAF intervals, 19 >25 ms (0.87%); per-window maxima 1000.42 and 41.10 ms. The 1000.42 ms gap is in a deactivated window (one sample interval), consistent with background scheduling; not presented FPS or evidence of an active UI freeze. Library remains disabled in both. First library.ready precedes library.services.ready and reports services=false; second reports services=true. Registration later succeeds in first window. Record load-order readiness observation under A7, not proof of user-visible Library failure.

### A1.10 — Explicit Layout terminal handoff (preview.64)

NC4-045/081/005/037: the preview.63 native trace proved process writer persistence but not Layout's terminal cleanup. The isolated microtask experiment exposed an ordering gap; source review additionally found unfiltered capture-phase beforeunload/pagehide/unload and a one-shot Layout unload listener, which could consume descendant lifecycle events. These are demonstrated code-path risks, not a proven explanation of the user's exact trace.

Selected explicit owner completion instead of a delay or a second global controller. Diagnostics claimLayout captures the current Layout cleanup callback and returns a generation-bound, idempotent completion. On a genuine chrome window/document unload (target and originalTarget when provided), Diagnostics records window.unload, quiesces sampling and delegates synchronously with nativeExit=true; the same existing Layout cleanup remains sole resource owner. The native Layout listener is an idempotent fallback, is filtered and is no longer once. Sine final callback still invokes cleanup directly; early fallback requests delegate if an owner exists, or quiesce and finalize without one. Reentrant preference mutation may defer the completion until its existing finally releases the lease. Handoff errors record diagnostics.layout.handoff-error and allow recorder disposal. Forced dispose/replacement invalidates the captured completion. No owner callback or window reference enters the independent writer. The terminal snapshot is submitted synchronously; final recorder disposal uses a microtask only after owner completion or no owner. Late independent producers across listener checkpoints are still best effort; do not claim all Sine entrypoint terminal events are guaranteed.

Runtime `dccbaecbd4fd89e768682afe174e750ed8e33fb6`: 25 Diagnostics + 17 Layout preference fixtures PASS (42 total, nine added), including microtask separation, filtered descendant/retargeted events, explicit completion, Sine fallback, stale completion, failed handoff, disabled/reentrant disposal, actual full bootstrap registration and deferred preference release. Tests ran in isolated JS harness with mock native APIs; 11 changed runtime bodies parse as async functions. Exact source-fragment replacement in previously CI-verified generated Layout/Library/Library Services; no full local npm/Node suite or native validation claim. Full GitHub CI pending. No new prefs, writer, timer or animation changes. A1.10-R: independently review Sine callback/Gecko target semantics, stale/reentrant terminal paths, full CI and one narrow native checkpoint; A1/G2/A0.4 still open.

### A1.10-R — Independent terminal handoff review and registration rollback (preview.65)

Preview.64 at `8d1d26e080bb0ebccdc826c24142e79f05476a05` [CI 44240883629](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44240883629) PASS: 409/409 Node tests, 15 Python release tests, five reproducible generated outputs, all 12 runtime scripts, immutable and served Raw/codeload package. Zen 1.24.2b surfer.json pins Firefox 160.0; upstream FIREFOX_160_0_RELEASE nsDocumentViewer.cpp dispatches beforeunload/unload to the window with the document as target. EventDispatcher.cpp sets originalTarget to target on the ordinary path and invokes target capture before bubble. Sine 2.3.3 manager.sys.mjs replaces per-script/window callbacks, invokes them without event arguments on beforeunload and awaits callbacks individually for mod removal/rebuild. Therefore the owner handoff/filter matches the verified native target contract; cancellation after Sine beforeunload remains a host limitation and late independent producer records are best effort.

Independent extracted-source experiment on preview.64: synchronous OnePlane:StartupState consumer calls current Layout cleanup during bootstrap publication. Owner completion succeeds and controller disappears, but two window listeners and one delayed startup observer are then registered by the disposed generation. This is a code-path regression risk, not a demonstrated user symptom. Fix: register captured Diagnostics claim, native listeners and Sine callback before StartupState publication; verify current generation before dispatch and before activation/observer acquisition, guard the observer callback and roll back partial registration on setup failure. Preserve the same sole Layout owner and existing writer, prefs and visual timings. No added timers. Sine may retain an idempotent callback until the manager removes it; no unsupported Sine unregister API added.

Runtime `3257414864d076d702147f0c2b64ae7024530925`: 25 Diagnostics + 19 Layout ownership fixtures PASS in isolated JS harness (44 total; two new registration tests). First harness omitted boot-prelude input, causing the generated-prefix assertion to fail; corrected harness includes the real prelude and all 44 pass. All 11 changed runtime bodies parse as async functions, generated fragments replaced from exact previously verified build sections. Full canonical CI for preview.65 pending. A1.10-R implementation and source review complete; next verify full CI, then targeted native checkpoint for Layout cleanup/lease and recorder disposal after real window close, surviving-window tab operation, plus supported Sine disable/re-enable if available without risking the user's session. Do not repeat the prior whole visual smoke. A1/G2/A0.4 remain open until evidence evaluated. No claim of whole-process persistence or all independent script terminal events.

### A1.10-R publication checkpoint and explicit native-validation deferral

Pinned `1018281f7d2bfffc2af71fe6a8ce25209dc1bbc0` (runtime `3257414864d076d702147f0c2b64ae7024530925`), [Verify preview package #44241426331](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44241426331), job 134589995065: full CI PASS, 411/411 Node tests (zero fail/cancel/skip), 15 Python release-policy tests, five reproducible generated outputs, all 12 runtime parser checks, publication metadata and immutable/current Raw/codeload package verified.

User explicitly defers the native checkpoint until later and asks what is next. A1 implementation and automated verification checkpoint complete; A1 native acceptance, G2 and remaining A0.4 evidence remain OPEN/DEFERRED, not waived and not passed. Proceed to A2 source review, command contract design and incremental automated implementation under this explicit sequencing exception. Preserve prior native evidence, require deferred gates before integrated release acceptance (A8), and request a targeted check earlier only for an actual blocking safety dependency, not routine repetition. No runtime change or version increment.

A2 proposed execution order (refine against actual current sources before cutover): A2.1 shared mod-origin workspace command boundary / ownership (NC4-008); A2.2 authoritative native switch result (NC4-033); A2.3 Free designation and startup acquisition (NC4-007); A2.4 safe workspace transfer/deletion journal (NC4-009/034); A2.5 Trash restore/purge outcome and eligibility (NC4-010/035); A2.6 projection and user takeover (NC4-010/040); A2.7 stuck/concurrent command reconciliation without overlapping native mutations (NC4-041); A2-R integrated self-review and regression matrix. Design serialization and unknown/pending outcome semantics from A2.1, not as a late retrofit in A2.7. These are proposed work packages for the existing nine primary A2 findings, not new accepted behavior or a second native data owner. Zen remains authoritative; no automatic destructive rollback. Coordinate A2/A3 command vs motion handoff before switching consumers.

### A2.1–A2.3 — Shared mod-origin Workspace command boundary, switch verification and Free role (preview.66)

Source contract reviewed against Zen 1.24.2b: `src/zen/spaces/ZenSpaceManager.mjs` changeWorkspace catches native errors and resolves the requested workspace, activeWorkspace is assigned before active elements, pinned/scrollbox bindings and selection are reconciled; public isChangingWorkspace is a real native flag. ZenSpace.mjs active is an attribute-backed getter. Native _shouldShowTab may mutate ownership when a tab has no workspace ID and must not be used as a read-only predicate. saveWorkspace and reorderWorkspace propagate native workspace data through ZenWindowSync; propagation invokes peer managers without awaiting all peer completions. A successful native promise or local ID is not evidence of complete peer propagation. No native APIs are patched and no native operations are automatically rolled back.

NC4-008/033/007: new `src/core/workspace-commands.mjs` is inlined in Layout before Home/Hub; one existing window command gate is reused by managed WorkspaceTransition (lease option, no second native gate or wait on own promise). Home and Hub selection, Free startup, the switch before workspace deletion and child projection now call the shared boundary. All Hub-origin data operations and explicit create also acquire the window gate plus one process-local primitive token on BrowserWindowTracker native module identity. Exact owner token and current manager/view are checked before native mutations and after relevant awaits. Competing managed commands are rejected busy (not queued or coalesced) rather than executed late; legacy unowned visual compatibility callbacks cannot interrupt a managed lease. Native calls initiated outside Nocturne remain Zen-owned. Data anchor unavailable fails closed for data operations; a destroyed realm with an unresolved native operation may strand its process token until full restart. No timeout releases a live mutation. This is an explicit conservative behavior decision, not a claim of cross-window native atomicity.

Switch confirmation requires native idle and target ID, connected active workspace elements with no competing active element, target tabs/pinned containers, native scrollbox/pinned bindings and a connected eligible selected tab with physical ownership for ordinary tabs. Essentials use the native container rule; native empty placeholder identity can be verified even when absent from visibleTabs; Glance is a native special case. Check before reporting success, and again after presentation. Structural mismatch rejects rather than running incoming success motion; it is not proof that all asynchronous native listeners, bookmark updates or peer propagation completed. Native timing unchanged.

Free startup and manual Hub designation share the same mutation helper; role conflicts, stale manager/disposal, synchronous preference observers, post-create/reorder validity and exact native order are checked. Existing ambiguous Free is not claimed automatically, and partial native creation is not deleted. Startup claim is only consumed after verified selection or deliberate ambiguity, allowing retry on failure in a later eligible startup. No new persistent prefs. NC4-040 partial: projection user input before readiness prevents automatic switch, and later takeover suppresses automatic startup/search preparation; an already started native operation is not cancelled. Existing placement task may still finish independently. NC4-009/010/034 partial: Hub delete/restore/purge enter the data gate, delete verifies the switch away from source, rechecks lease and membership around stamp/move and before native remove; ensureTrash checks role identity after native create and refuses duplicate ambiguous named Trash. There is not yet a dedicated Trash designation UI for that ambiguity. Physical transfer journal, authoritative deletion/partial purge outcome, projection cleanup and pending-command UI recovery remain open; do not claim destructive paths fully verified.

Runtime `2319b69259a51181067cb0709a780856d0dd4be3`: 50 focused tests (new command boundary, Free startup, WorkspaceTransition) and 26 Hub fixtures pass in isolated JS harness; 16 new permanent regression tests (12 command, two startup, two motion), updated prior integration fixtures. Initial combined harness could not evaluate existing Home URL fixtures because the tool JS realm lacks URL; full Node CI required. Changed runtime bodies parse, generated Layout and Library outputs reconstructed by exact verified source assembly transformations. Full CI and native validation pending. A1 native gate remains explicitly deferred. Next A2-R independent review of this batch and full CI, then A2.4/A2.5 destructive move/purge journal and A2.6/A2.7 remaining projection/recovery. No new visual timings or intended animation style changes.

### A2.1–A2.3 publication verification and A2.4/A2.5 destructive API preflight

Pinned preview.66 `e6b33d1d78a1940d77010c747c76baa2450d659b` (runtime `2319b69259a51181067cb0709a780856d0dd4be3`), [Verify preview package #44243133900](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44243133900), job 134595545129: PASS 427/427 Node tests (zero failures/skips/cancellations), 15 Python release-policy tests, five reproducible generated outputs, all 12 runtime parser checks, verified monotonic publication metadata, immutable package and served Raw/codeload. This supersedes the isolated Home fixture URL limitation for this checkout. Readback confirmed build-plan insertion, compiled fragments, manifest/package agreement and bookmarks provenance. A1 native acceptance remains explicitly deferred; A2 native validation also pending.

Next safety block A2.4/A2.5, source-confirmed in Zen 1.24.2b: moveTabsToWorkspace returns true regardless of per-tab skip, updates zen-workspace-id before physical insert, moves a split group as a unit, and invalidates native cached tabs on completion; tabs-mjs.patch _invalidateCachedTabs clears manager._allStoredTabs. removeWorkspace synchronously calls #deleteWorkspaceOwnedTabs using allStoredTabs before propagating deletion; that native filter excludes Essentials and ungrouped empty placeholder, then closes every remaining matching tab. allStoredTabs may be cached; its rebuild walks each native normal/pinned container, essentials, group children and glance. Do not use only attribute/cache equality to certify absence of owned tabs. Firefox 160 Tabbrowser.removeTab can return undefined on veto or success; with animate=false normal successful path calls _endRemoveTab, but a fulfilled JS call is not a success certificate.

Independent extracted-source fixtures on published preview.66: (1) actual Hub moveNativeTab invoked with a native mock that changes workspace ID to Trash while leaving physical parent in source, returns without error (one native call); (2) actual executePurge with two approved tabs and native removeTab mock that vetoes both invokes both, retains both, returns undefined with no partial result. These reproduce existing validation gaps in mocks, not observed native tab loss or a claim that Firefox always behaves this way. NC4-009/034 and NC4-010/035 remain open. Next implement preflight with exact captured manager/source/destination, physical membership AND native ownership, reject unknown group/glance/selection/role state, revalidate immediately before native calls and after synchronous notifications, journal confirmed/retained/unknown with safe stop; no destructive rollback. Invalidate/reconcile native cache only via verified API, compare physical source and authoritative membership immediately before deletion, never call removeWorkspace unless source is demonstrably empty of owned tabs. For purge distinguish removed/retained/unknown and respect native beforeunload; never retry stale approval automatically. Tests: ID-only partial move, physical-only/exception partial move, source role/selection/manager change, native veto, second window appearing, stale cache, grouped/placeholder exclusions, partial operation reporting and safe no-op. Preserve the existing confirmed UX; A2-R independent review of preview.66 still required before broad destructive cutover. No runtime change or version increment.

### A2.4–A2.5 — Native ownership reconciliation and partial-result journal (preview.67)

NC4-009/034, NC4-010/035: source-confirmed Zen 1.24.2b allStoredTabs and moveTabsToWorkspace behavior (see previous preflight) plus Firefox 160 Tabbrowser._endRemoveTab removes native tab DOM, invalidates cache and finally sets linkedBrowser=null. A native removeTab invocation returning undefined is not a completion certificate. Reconciliation now uses the existing workspace-commands module, not another command owner or persistent tab store.

`readWorkspaceOwnership` compares exact native tab identities in normal/pinned physical containers with native allStoredTabs, refreshing through the verified native _invalidateCachedTabs API at destructive boundaries. Mismatched IDs, missing containers/cache, unknown physical members, duplicate identity, unexpected Essentials and non-native ungrouped empty placeholders fail closed. Existing group/split/Glance exclusions remain. Source and destination must agree; an ID-only or physical-only move is unknown. Native exception stops further transfers even if that individual move can be confirmed. Metadata is written only after confirmed transfer, so a metadata failure preserves the already moved native tab and stops deletion; no automatic rollback or retry. The journal stores bounded counts (planned, attempted, confirmed, retained, unknown, notAttempted, reason), not tab URLs, IDs or titles. Per-command checks may scan native membership repeatedly; no continuous observer or polling introduced for this verification.

Hub removal captures approval, source/Free/Trash role identities, exact manager and browser, verifies selection and single-window eligibility, then moves only approved tabs. Before native removeWorkspace, after switchGuard, it revalidates both the empty source and the physical destination of every approved tab; any inconsistency keeps the workspace. The final result additionally requires missing native workspace and element. Native partial deletion is reported unconfirmed. Trash creation checks captured roles before/after creation and while waiting for native container readiness; ambiguity is not auto-claimed. Restore confirms physical move and timestamp cleanup before success motion; if the result is uncertain, stop drag motion and render actual state rather than simulate a return into a false source. Purge captures manager/role/approval, revalidates age, eligibility and membership before every native removeTab (no skipPermitUnload), checks detached tab with released linkedBrowser and absence from refreshed native list; veto/unknown stops batch, reports actual counts, consumes approval. No change to native session semantics or animation durations.

Independent command-boundary review: require a real process data token in Free designation and new destructive helpers; selection-only lease must not mutate data. Hub rename and reorder now verify native result and guard against stale continuation; sanitize unexpected native error code in command-end trace to a fixed error label. Native ownership remains authoritative. This is a bounded synchronous-operation reconciliation, not an atomic cross-window transaction; native external code and reentrant native operations can still change state. Partial native outcomes are preserved. Stuck pending native promises and asynchronous peer propagation remain open; no timeout unlocks a running mutation.

Runtime `ba77a22b482f77ef0b1b4ff706921fb75c32d24d`: 13 new permanent regression tests (actual extracted Hub command bodies, real command/inspection helpers and mocked native containers), including stale cache, ID/physical mismatch, exact placeholder exemption, successful deletion, partial second move, native exception after mutation, metadata failure, new tab/second window, native veto, partially detached tab, stale purge approval, restore and selection-only lease rejection. 51/51 focused fixtures PASS (13 new + 26 Hub + 12 command); initial run 50/51 due to missing hubWorkspaceOrder/hubWorkspaceSnapshot test fixture dependencies, corrected and rerun. Updated prior Hub session-specific UI fixture to new contract. 11 changed runtime bodies parse, generated outputs assembled with exact verified source transformations. Full CI pending; native acceptance deferred as requested. Next independent A2.4/A2.5-R review and full CI, then A2.6 remaining projection cleanup/identity and A2.7 pending-state UI recovery. A1/G2/A0.4 native gates remain deferred, A2 native acceptance open.

### A2.4–A2.5 publication checkpoint (preview.67)

Pinned `4407fed872a05869f9417bddba9cd8d9d77e8270` (runtime `ba77a22b482f77ef0b1b4ff706921fb75c32d24d`), [Verify preview package #44244683437](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44244683437), job 134600684504: PASS 441/441 Node tests (zero failures/skips/cancellations), 15 Python release-policy tests, five reproducible generated outputs, all 12 runtime parser checks, monotonic publication metadata, immutable and current served Raw/codeload package. Initial CI 44244545404 failed the two legacy extracted Trash fixtures (missing manager/ownership bindings); corrected tests only in pinned HEAD and added one unconfirmed drag settlement regression, bringing this batch to 14 new tests. Final CI supersedes prior fixture failures. Independent source confirmation: Zen 1.24.2b Tabbrowser-sys-mjs.patch exposes gBrowser.isTab and retains synchronous _endRemoveTab when animate=false; tabs-mjs.patch invalidates native allStoredTabs with _invalidateCachedTabs. This supports the selected native inspection contract, not a native behavior PASS. Repeated membership scans occur only during approved destructive operations; native large-batch latency, XUL grouping/placeholder shape and cancel/reentrant behavior remain to be measured. No new runtime version. Next: independent A2.4/A2.5-R review, A2.6 projection lifecycle/takeover and A2.7 pending-state recovery. A1/G2/A0.4 native acceptance remains explicitly deferred; A2 native acceptance open.

### A2.4/A2.5-R — Independent data-operation review (preview.68)

Re-read preview.67 at `685d310c442729bf690fab20ddd5a8e2105ba19f`, confirmed final CI and subsequent documentation CI PASS. User explicitly requires independent self-review at least once per two substantive working replies, in addition to routine checks; recorded in AGENTS.md. Reviewed actual Hub command, native ownership and approval paths independently of previous implementation.

Reproduced two gaps using extracted preview.67 functions: (1) failed replacement askPurge preflight left the prior purgePlan intact; (2) restoreTrashTab read the current role at release, accepting a tab in a replacement Trash role rather than the role captured by the user's drag. Zen 1.24.2b getWorkspaceFromId catches errors and returns null, so an absent DOM element plus failed lookup could falsely confirm deletion. New inspectWorkspaceDeletion requires a readable, internally consistent authoritative native list with expected surviving Free/Trash roles and no removed identity/element. Failed fresh purge preflight clears old approval and renders it away; approval records exact removal timestamp per tab (including all-age filter). Timestamp changes require review. Batch initial eligibility reuses one refreshed ownership snapshot, while each actual native removal still has fresh per-tab eligibility and ownership checks. Trash drag captures manager, browser, Free/Trash roles and original physical membership before lift; changed identity/role cancels transfer and settlement. No native data rollback.

Residual native boundary risk: Zen removeWorkspace first invokes #deleteWorkspaceOwnedTabs and gBrowser.removeTabs even for an empty set; Firefox 160 removeTabs invokes Services.tm.spinEventLoopUntilOrQuit during native processing. Native code can therefore permit external/reentrant state changes after Nocturne's last preflight and before native propagation; native UI update promise is also not target-specific. Do not claim atomic deletion or guaranteed exclusion of all external operations. No observed native data loss, no unsupported private replacement or native monkey patch added. This is an explicit unresolved NC4-009/034 native contract/validation gate. Verify with controlled disposable workspace/tab fixtures before release; no destructive test on valuable user data. Assess supported native alternatives or conservative deletion restriction if evidence establishes unsafe behavior. Nocturne's own commands remain gated. Large-batch performance still not measured in native runtime.

Runtime `140711300677d2fb02d09fa0f431a697e0a144a8`: 59/59 focused extracted-source fixtures PASS (16 workspace-data, 26 Hub, 12 command, 4 real-card, 1 age-menu); four new permanent tests plus existing age approval assertions. All 11 changed runtime bodies parse; generated fragments assembled using exact build transformation. Full CI pending. A2.4/A2.5-R source review and corrections implemented, native acceptance open. Next A2.6 projection lifecycle/takeover and A2.7 pending command recovery, then integrated A2-R.

### A2.6a — Projection startup ownership (preview.69)
NC4-040 partial: exact manager/marker and source sync eligibility fence automatic Workspace selection and startup search. Native work already started cannot be cancelled by this fence. NC4-045 partial: existing JSON trace receives phase data. Destructive startup-tab cleanup, Return peer verification, placement in-flight takeover and A2.7 pending recovery remain open. No claim of complete A2.6 or native PASS.

### A2.6b — Projection native data safety (preview.70)
NC4-010/040: queued native TabClose makes old mod-origin startup-tab removal non-atomic across synced peers. Remove this mod-origin destructive fallback; native startup cleanup remains. Strengthen Return and keep selection/placeholder preparation under one lease. Residual ordinary blank tab is an explicit conservative fallback, not a confirmed native regression. Native close is a request, not a certified close or atomic peer handoff; asynchronous native external changes and a destroyed realm stranding the primitive token remain limitations. Placement already has trusted-input listeners both before startup and during native geometry retries; shared placement reentrancy/teardown review remains open. No geometry/timing change. Native acceptance deferred.

### A2.6c — Projection and detach placement lifecycle (preview.71)
Preview.70 pinned HEAD `db3be426c83e3cb7a53164388f8b3c75ab2a16ca`, [CI 44247288463](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44247288463) PASS. Independent execution-path review: startup placement observers, timers and input listener handoff were not owned by Layout scope. A partial observer registration could reject without cleanup, and source teardown during a pending startup/geometry delay could leave an unresolved continuation. Projection native readiness and the temporary empty-tab guard were similarly tied to eventual completion rather than Hub teardown.
One placement scope per actual newly opened window, registered under existing Layout mountScope. Keep the same trusted-input and close observers from startup through bounded native retry; cancellation settles owned delay promises and disables later geometry requests. Register cleanup before observer acquisition, arm only after acquisition, attempt exact release on partial failure. Preserve the startup deadline, existing settle/retry intervals and geometry algorithms, and keep native window/tab intact. Recheck ownership after reentrant native size/restore/maximize operations, before subsequent geometry mutations. Projection uses a child DisposableScope under Hub for input and startup capture listeners, exact native empty guard and readiness observer lifetime. Trusted input disposes this scope and immediately rejects unresolved readiness; it cannot cancel a native Workspace switch already in progress. No native mutation is replayed or unlocked by this cancellation.
15 focused extracted-source fixtures PASS (4 new, 11 existing), all 11 versioned runtime bodies parse; canonical CI pending. Native Windows monitor/DPI, startup window and synced Return acceptance remain deferred. A2.7 next: separate presentation pending state from unresolved native leases, including process token stranded by destroyed realm; do not release a live native data lease on timeout. A2-R still required.

### Independent A2.6 review — preview.72

Independent A2.6 review (NC4-040): preview.71 search recaptured `_emptyTab` after placement and had an unscoped retry timer. Both reproduced in extracted-source fixtures and corrected in preview.72; four permanent regressions. Native validation remains open. Return concurrent source selection belongs to existing NC4-041/A2.7; the independent placement lifecycle and Return physical membership checks remain A2-R verification questions, not demonstrated new native bugs.

### A2.7a — Workspace command presentation and Return peer reservation (preview.73)
Parallel preview.72 pinned HEAD `ee4ec7e1d566a913df85e026c9f18aa351705d0f`, [CI 44249720435](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44249720435) PASS; preview.71 CI 44248000241 PASS. A2.6 independent search corrections retained. NC4-041: the prior data token excluded concurrent data mutations but not a managed selection in Return's surviving source; both Home and Hub also lacked a shared slow/unknown command presentation.
Reserve the exact source gate with a primitive token under the existing Return data lease before callbacks; verify both managers and the reservation before invoking the native close request. Compatibility WorkspaceTransition honors this reservation. Unrelated third-window selection remains independent. The reservation and process token are released only on exact owned command settlement, never on a UI timer. Native external commands and asynchronous close effects are not serialized by this mod boundary. Existing gate provides monotonic elapsed time, bounded pending/unknown presentation and a change event. Home and Hub observe it while open with one deadline timer per visible view, clear timers on close/disposal, and show unknown after five seconds without changing native ownership. Hub can yield the overlay without waiting for command settlement when not dragging; existing manual close remains valid. No animation timings or native prefs changed.
18/18 focused extracted-source fixtures PASS (17 core, one compatibility transition), six new permanent regressions, 11 versioned runtime bodies parse. Canonical CI pending. A2.7b remains: opener-side Projection waiting on a child gate, process data token stranded by destroyed realm (no proven safe automatic release), late Hub UI session completion, native close request vs final close observation and integrated recovery tests. Full restart remains conservative recovery for an indefinitely unresolved native command; do not assume native close is synchronous or that dropping a lease is safe. Native acceptance deferred.

### A2.7b — Native close completion, bounded presentation and late view settlement (preview.74)
Preview.73 pinned HEAD `39499aa53363ea2a2c3fb787ddd2ad4fbe52d4b8`, [CI 44251578110](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44251578110) PASS. Independent review against Firefox `FIREFOX_160_0_RELEASE`: `browser/base/content/browser-commands.js` tryToCloseWindow synchronously calls WindowIsClosing and window.close; `dom/base/nsGlobalWindowOuter.cpp` FinalClose sets closed before posting ReallyCloseWindow. `xpfe/appshell/AppWindow.cpp` Destroy unregisters the window (via nsAppShellService and nsWindowWatcher, emitting domwindowclosed), destroys docshell, detaches exact chrome BrowsingContext and only then emits xul-window-destroyed; `docshell/base/BrowsingContext.cpp` Detach sets isDiscarded. SessionStore handles domwindowclosed and synchronously emits SSWindowClosing. Zen 1.24.2b ZenWindowSync.sys.mjs moves visible tab docshells in that handler into first surviving candidate from BrowserWindowTracker.orderedWindows, NOT necessarily the projection marker's source; subsequent tab state flush is separate. Native Zen #inChangingWorkspace clears after awaited UI update, so UI update alone may leave a stale visual busy flag.
Return uses the existing source gate's exact generation-owned endpoint, executing the native close request from the surviving source realm under the same process data lease and a child reservation. Fail closed unless source is the only eligible survivor (including conservative rejection of unknown third-window readiness) and tab identities are verified. Native close uses BrowserCommands.tryToCloseWindow with no synthesized trusted event. Hold command through exact child domwindowclosed plus captured chrome BrowsingContext.isDiscarded; source realm owns both observers. Native veto settles as not-closed; partial observer acquisition blocks invocation. A source close during unresolved Return removes observers but preserves token because completion cannot be certified. Source reload only replaces the endpoint, not the in-flight command. No native close persistence/flush guarantee or atomic exclusion of externally initiated native changes; third windows may still open during native dialogs. Opener view observes its existing projection pending phase with the shared deadline; real child close, trusted input or scope disposal cancels only waiting and automatic setup, never releases a running child native gate. Native-only busy view uses at most one 250ms timer during a bounded 5s visible interval; controls remain retryable and actual admission rejects native busy. Late Hub results are scoped to opening session; reconcile native data without clearing a new draft/edit/status. Roll back exact partially published leases on admission failure; process data contention explains restart recovery.
32 distinct focused fixtures PASS (19 core, 12 projection data/close, one Hub late-create), 10 new permanent regressions; 11 versioned runtime bodies parse. Full canonical CI pending. Remaining A2-R: integrated admission, physical peer ownership and native external reentrancy verification; check native Windows/Zen Return teardown and actual observer ordering before acceptance. No safe automatic global unlock for genuinely unresolved native mutations, especially when all relevant owners close. Full restart is the conservative recovery; this is not a claim that restart rolls back native data. Native acceptance deferred per user.

### A2-R1 — Integrated native command admission and ownership audit (preview.75)
Preview.74 pinned HEAD `956388ffa84fe1afa7f411e9a9007d2c9fd5391b`, [CI 44253540354](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44253540354) PASS. Integrated source review of NC4-007/008/009/010/033/034/035/040/041: Layout activation waited unboundedly for Free startup; peer admission could overwrite a command synchronously admitted during a getter; Return used fresh native cache and IDs without independent physical container/group reconciliation; destructive workspace ownership did not check pin-role membership or an off-container fake cached placeholder. Zen 1.24.2b ZenSpaceManager `allStoredTabs` traverses workspace normal/pinned and Essentials sections plus native group/glance children. `removeWorkspace` closes native owned tabs before propagating workspace data. Gecko FinalClose flag precedes unregister.
Bound the optional Free startup wait to five seconds (normal path unchanged), fence subsequent automatic actions on deadline or Layout cleanup, keep native lease until actual settlement. Recheck exact command gates at admission and after callbacks; verify exact pending promise and preserve foreign owners on release. Independently scan physical workspace/Essentials containers for Return, require exact cache identity, pin/workspace role, group identity, split/glance metadata; reject unsupported or inconsistent topology without invoking close. Strengthen destructive membership and reject any other registered window including closed-but-not-unregistered. Scope Trash readiness-only delay to existing Hub lifecycle, not the native command. Nine new regression fixtures; 67/67 focused actual source fixtures (core, Free startup, Projection, workspace data) PASS in isolated JS harness. No timing change to normal animations, no native mutation retry, no new data store.
A2-R1 source corrections implemented; full CI pending. A2-R2 remaining: independent review of startup fallback, actual native physical topology (especially grouped, nested glance and container-specific Essentials; conservative rejection is not a native failure claim), cross-window Return and external native confirmation/flush; review admission/UI integration and document final A2 disposition before A3. Native acceptance remains deferred. Native promise stranding after destruction still cannot safely be auto-unlocked; restart remains recovery. This audit does not prove data loss or validate actual Zen behavior.

### A2-R2 — Native topology, transfer preflight and final source audit (preview.76)
Preview.75 pinned HEAD `6768daaaf6cec155b05dba8af7d1f2897429d8e1`, [CI 44254574976](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44254574976) PASS. Re-read AGENTS and actual execution paths; compare Zen 1.24.2b `ZenSpaceManager.mjs` (getEssentialsSection, _shouldShowTab, _handleTabSelection, allStoredTabs, #organizeTabsToWorkspaceSections), `ZenPinnedTabManager.mjs` (addToEssentials), `ZenGlanceManager.mjs` (#configureNewTab), `tabgroup-mjs.patch` (nested folders), `ZenWindowSync.sys.mjs` (#canSwapBrowsers, #moveAllActiveTabsToOtherWindowsForClose, #syncItemPosition). Native selection visibility alone does not certify a nested Glance parent's workspace; actual Essentials section has a container attribute; native top-level group placement uses outermost group's pin role; active docshell transfer is skipped for missing linked browser or differing remoteness. Previous Return omitted these facts. Source findings and mock regressions, not observed live data loss.
Verify selected Glance via exact parent identity and matching glance ID, then its physical workspace/Essentials section. Read the existing Essentials sections, never create one through native getEssentialsSection during inspection. Verify Return nested native group ancestry/IDs and outermost pin role, exact tab document, active linked browsers and boolean remoteness. Fail closed on any Glance topology in either window and duplicate active ownership; do not promise native transfer or persistence success. Free startup observes trusted input only during its existing bounded wait, uses DisposableScope, cancels automatic follow-up but not started native mutation. Projection passes its takeover predicate to existing placement owner; input listeners precede observer acquisition and target validity is rechecked before reporting placement success. Return cleans partial observer acquisition even on source close. Nine new permanent regressions; 86/86 focused extracted-source fixtures PASS (75 core/Free/Projection/data and 11 display startup). No native API override or new timing/visual algorithm.
A2 source implementation and independent integrated audit complete at R2, subject to canonical CI. Native acceptance NOT passed: retain A2 runtime gates for actual Windows/Zen Sine, beforeunload/OS close, multi-monitor, group/Glance/Essentials, session flush, slow native switch and externally initiated native operations. Return refuses active/retained Glance in either window (native skips Glance position sync); use normal native close if unsupported. Unknown command still fail-closed until true settlement; restart only as conservative recovery. Native modal loops may permit external changes after preflight, and source survival, transfer and async persistence cannot be certified atomically by Nocturne. Do not intercept native close globally to simulate an atomic transaction. A3 source architecture work may proceed per explicitly deferred native gates; broad visual cutover still subject to its own acceptance. Preserve native command lease through motion watchdog. Next A3.1 inventory exact surface/property owners and existing MB work before making any runtime changes.

### A3.1 — NC4-039 regression extension (preview.76)

Reproduced the existing bookmark fold ownership defect across a complete Center Motion replacement, not merely two handles in one instance. Baseline `216f02270d6b8229d82ee4a066dc7b3226a0409b`, actual `src/core/center-motion.js.part` evaluated in isolated mock DOM/WAAPI: old out handle survives replacement/dispose (one active effect, marker true); new in handle starts; old release removes the new marker; new release restores stale marker and progress=1. Expected: old effect disposed (or explicitly delegated to exact close owner), no stale mutation, original inline/attribute baseline restored exactly once. Existing disposed-controller test does not retain a handle across replacement. Class S/P1, fixture-confirmed ownership defect; native visible overlap remains unverified. A3.2 will add permanent regression and exact per-surface lease cleanup. Related NC4-054: startup pointer/focus entry points already guard startup; existing effects, queued work, close and other measurement paths remain relevant. See [A3.1 inventory and contract](nocturne/pipeline-0.4.0.md#a31--motion-surface-ownership-inventory-and-contract-preview76-source-only). No runtime fix yet.

### A3.2a — Exact bookmark fold ownership (preview.77)

Pinned preview.76 HEAD `37c2b3aaf76a9869b983fe6b7c62a59a259677bc`, A3.1 [CI 44259016206](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44259016206) PASS. NC4-039: exact bookmark handle cancels previous before acquiring baseline, releases idempotently, restores inline priority and marker, rejects synchronous bookmark reentry and defers disposal until acquisition finishes. Track exact tab/bookmark close owners; preserve the existing closing-phase seal contract (not proof of native close), and reclaim retained old handles on replacement. Fence two-frame handoff callbacks by engine identity and generation. Startup/Closing explicitly label bookmark owner. Magnetic Bookmarks suspends existing hover/queued work for startup/close/center/fold via existing observer plus synchronous phase notifications. Workspace retains its row fade and native lease. No new observer, timer, preference, trajectory or timing.

Eight permanent regression cases added: both release orders, hot reload, exact close delegation/replacement, delegated release, partial WAAPI pause failure, reentrant bookmark disposal, absent/zero-width surface, and overlapping suspension. Seven new Center Motion fixture bodies and four shared-bookmarks tests PASS in isolated V8 using actual source and mock DOM; changed source/runtime bodies parsed and generated Layout updated by exact source-fragment substitution plus version synchronization. Full local Node suite unavailable (GitHub DNS); canonical CI pending. Native visual acceptance deferred. NC4-039 fixed in tested source paths, not native-confirmed.

A3.2b remains OPEN: tab proxy acquisition rollback, synchronous CenterMotionEnd reentry, stale tab handles/partial WAAPI setup, fallback and native close compatibility. Review bookmark suspension before initial close geometry collection, startup contour preflight and integration ordering; NC4-054 not fully closed. Independently audit this batch and confirm CI before A3.3. No broad startup rewrite yet.

### A3.2b — Transactional tab proxy acquisition and close ownership (preview.78)

Pinned preview.77 HEAD `18a5ea1156ba07a0aaa25c24eb1e6099cd94107b`, [CI 44391286462](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44391286462) PASS. Independently re-read Center Motion, native close controller, magnetic bookmark suspension and Layout cleanup. Source defects: tab start continued after synchronous CenterMotionEnd release callbacks, partial mount could leave markers/proxies, and favicon observer/listener registration could leak on partial acquisition. WAAPI pause failure could leave an unowned effect. Closing phase alone was insufficient to distinguish native commit from ordinary disable.

Reserve exact tab handle before any acquisition; serialize synchronous admission and release across existing tab/bookmark surfaces, defer disposal until stack unwinds. Prepare all detached proxies before hiding sources; record exact baseline markers and individual resources before mutation; roll back all on failure. Failed WAAPI setup now fails open as one surface instead of retaining partially animated copies. Guard released handles and queued favicon callbacks. Close passes a captured predicate for the existing controller.committing state to both handles; only exact close handles during native commit are retained, replacement always releases. No new timers/observers or changes to normal timings, native command ownership or Fold geometry. Reuse existing diagnostics (handle ID, reason, failure counts).

Eleven permanent regression tests added: partial setup at seven stages, synchronous supersession and disposal, cross-surface reentry, stale handoff callback, exact marker baseline, queued favicon callback, exact close retention/replacement, cancelled close and consumer predicate. Existing bookmark fixtures rerun with native commit predicate; all 18 new/previous bookmark and proxy fixture bodies passed in isolated V8, actual source and mock DOM. Full candidate targeted suite and canonical CI checked separately; native visual/runtime gates remain OPEN. NC4-039 and proxy acquisition/reentry source fixes implemented. NC4-054 remains open for integrated preflight/geometry ordering: close fallback collection before phase and startup contour readiness, mixed Sine ordering and native testing; do not claim broad motion integration or final topology handoff (A3.6). Next A3.2-R independent audit + CI closure before A3.3.

### Independent A2 follow-up — preview.79

Independent A2 follow-up (NC4-033/041, AUD-006/007): preview.78 could confirm inconsistent Workspace list/container membership and a stale peer gate after synchronous reentry; reproduced in source fixtures, corrected in preview.79. Native acceptance deferred. AUD-008 under A3.2-R: close fallback omits bookmarks if API is present but returns null and does not provide tab proxy fallback; verify actual acquisition result or safely bypass close motion. No native visual failure observed. Existing NC4-054 geometry ordering remains open.

### Independent close acquisition review — preview.80

AUD-008 (A3.2-R/NC4-054 related): close API-presence fallback omitted visible horizontal tabs/bookmarks when shared acquisition failed. Preview.80 uses conservative native close bypass and exact cleanup on acquisition failure; source fixture PASS, native visual acceptance pending. Geometry collection before phase and cross-surface integration remain open in A3.2-R/A3.6.

### A3.2-R — Integrated motion preflight review (preview.81)

Baseline preview.80 `22fe9960ce10a033a131ac39f7c7b3545bb14a71`, [CI 44394562026](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44394562026) PASS. Independently reviewed current Center Motion, Closing, Startup, Workspace phase/native gate, shared bookmark lifecycle, contour and CSS phase rules, and A2/close parallel commits preview.79–80. Retain those commits. A3.2a/b source fixes still present; no duplicate owner introduced. Close fallback from preview.80 remains conservative native bypass; Workspace retains row fade and does not release native command ownership on visual cleanup.

NC4-054: Closing previously collected visible targets before setting closing phase/synchronously suspending Magnetic Bookmarks. Two behavioral fixtures reproduce preflight measurement ordering and continued animation after injected sync failure on preview.80; both pass on preview.81. Close now enters its existing phase before any target geometry read, synchronizes hover, rechecks captured engine and bypasses on preflight failure; existing close controller clears acquired phase/resources before invoking native once. Startup launch and forced workspace/bookmark contour preflight synchronize suspension before measurement; bookmark preference callbacks coalesce while suspended and apply latest settings once after the last overlapping phase clears (initial installation still initializes base reserve). Three permanent regression cases added. Existing timing/trajectories/native operations unchanged. No new observers/timers or duplicate geometry owner.

A3.2 source ownership and immediate preflight fixes complete subject to canonical CI for preview.81; native visual/runtime validation explicitly deferred, not waived. Remaining risks: older Refined shared registry revision 1 may be first owner and lack new suspension semantics; validate mixed-install/reload permutations before native acceptance, do not silently replace another consumer's registry. Startup captures engine separately for bookmark acquisition, and direct reveal marks seen before a failed shared fold, so fallback/late-target readiness belongs to A3.3 (MB1/2); review partial startup WAAPI acquisition and pending watchdog there. Full shared timeline/finished outcome (A3.4), topology handoff and gesture interaction (A3.6) remain open, not closed by this review. Native NC4-039/054 acceptance remains open. A3.2-R does not claim the approved Bloom or native performance. Proceed to A3.3 after full CI confirmation.

### A3.3a — Assembly direct effects and fold acquisition (preview.82)

Baseline preview.81 `df7bc283930122102fb372b500885399e1a35438`, [CI 44395911797](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44395911797) PASS. A3.2 source and CI gates complete; deferred native and mixed Refined-first gates remain. MB1/2 first implementation slice: startup play previously registered WAAPI only after pause/currentTime, leaking effects if pause threw. Failed bookmark fold marked targets seen before acquisition, making existing direct reveal fallback skip them. Assembly also read Center Motion twice, allowing mixed-generation handles. Own direct effect immediately, observe rejection, cancel late or failed acquisition, restore recorded styles independently; externally cancelled exact effects settle their own completion. Preserve failed direct targets ungated. Capture a single engine for tab/fold acquisition, release handles returned after disposal/replacement, and restore temporary bookmark admission when fold fails so the existing fallback can run. Observe boot logo cancellation. No new scheduler, animation timing, startup eligibility, native command or trajectory change.

Six permanent regression cases added (partial pause, external cancellation, disposal during animate, fold null/throw/replacement, successful fold, independent style rollback). 21/21 startup-transparency test bodies PASS in isolated V8 with actual source, mock effects and file adapter. Full CI and native verification pending. A3.3 remains OPEN: MB1/2 boot-prelude exact adoption/phase baseline, captured Home structural lease, cancellable native readiness callbacks, startup hard deadline and missing/reordered entrypoints, late topology and icon readiness. Review old cleanup touching current pending/Home generation, Home partial WAAPI setup, interruption while preparing and readiness watchdog. Existing choreography deliberately retained until MB3/4/5. Next A3.3b lifecycle and readiness, then independent review; no broad A3 closure.

### A3.3b1 — Boot adoption, native readiness and exact Home startup lease (preview.83)

Baseline preview.82 `692a7a24d9826f391024f685a1ab864a60aba19f`, [CI 44397702904](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44397702904) PASS. MB1/2: Boot Prelude previously could leave markers after a failed cancellation/removal or stale callback; adoption now transfers exact phase/boot baselines and node to Assembly before setup, and cleanup isolates failures and checks exact published record. Assembly owns both native readiness RAF IDs and fences dead callbacks, restores its phase/hold baselines, closes its exact published timeline, and releases captured Center Motion pending gate. Center Motion skips creating a new pending gate after Assembly already finished. Home owns an exact timeline-bound lease (same shared registry apiVersion 1, additive startupLeaseVersion capability); partial WAAPI setup rolls back as a group, stale releases and closed timelines cannot affect new effects, render retires old animated children before replacement, and the existing root observer clears an orphaned startup marker. Assembly resumes/releases timeline lease, not the current global Home; legacy fallback is limited to the captured unchanged registry. Native input while preparing fails open rather than running a paused settle. No new scheduler, timing/trajectory or native data changes.

Four new permanent regression cases (native readiness cancellation, Home partial pause and exact lease, prelude baseline/adoption and stale cleanup, closed timeline late acquisition). Existing source checks updated for exact lease. Focused JS fixtures, parser and generated build integrity verified on candidate; full CI and native verification separate. A3.3 remains OPEN: independent review of this batch; MB2 late/reordered/missing entrypoints and Home readiness/render integration, hard deadline/fail-open under acquisition reentry, mixed legacy Home/Refined owner, resource readiness and topology stabilization. Do not claim real paint or final Magnetic Bloom choreography. A3.4 shared time/outcome, A3.5 visual engine/Home and A3.6 handoff remain planned.

### A3.3b2 — Bounded Home and resource readiness (preview.84)

Baseline preview.83 `5efae6535f221a1eaec6e9db015a2a69dc0b1aa5`, [CI 44402923444](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44402923444) PASS. Independent review of Boot adoption, exact Home lease, Assembly phase and readiness found MB-003/004/005 residual paths: asynchronous Search initialization could auto-open Home after Assembly launch/abort; passive native/pref refresh replaced animated children; cached icon aggregates and fixed row child count could miss an equal-count topology replacement. Layout startup record now publishes Home readiness (pending/ready/skipped/failed), captured lease/record/tab must remain current, and automatic startup open is admitted only before Assembly launch. Existing no-Assembly path and native placeholder behavior are preserved. Home's exact startup lease coalesces passive structural refresh and flushes latest native/pref state once on release, while explicit interaction can render immediately. A native Home appearing after its scheduled stage uses resting state, no late startup replay.

Assembly warms Home even without horizontal strip, samples new engine/row/Home identities immediately and local tab/card/image-node topology at the existing sampling cadence, incorporates resource revision and Home state into quiet detection, and shares the existing 600/1400ms icon readiness budget. Missing or slow resources fall back without extending this budget. Readiness RAF/async resume exceptions fail open via existing cleanup; native timer cancellation is isolated. No new scheduler, preference, native data owner or normal choreography change. Diagnostics report bounded state/revision counts, not node identities or URLs.

Six new permanent regression cases cover late Home launch/abort, replacement Layout record, resource owner/topology change, readiness failure, passive coalescing and late native Home without replay. Source/fixture and CI checks are tracked separately. A3.3-R remains OPEN: independent integrated audit and CI, exact absolute watchdog transfer and boot failure/reentry edge cases, Sine mixed-install runtime gates, geometry/structural handoff across all surfaces (A3.6), and native favicon paintability. Do not claim MB1/2 native acceptance or complete MB-011 geometry freeze. Next A3.3-R, then MB3 shared timing.

### A3.3-R — Integrated Startup deadline and fail-open audit (preview.85)

Baseline preview.84 `970b9a8b52b8fb73a0025df15cbf84ee454722f6`, [CI 44406149574](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44406149574) FAIL: 540/541 Node tests passed; Home source assertion still named the mutable homeLease rather than the captured lease. No other reported CI failure. Correct the assertion and retain the generation-checked runtime contract; no test removal. Reviewed AGENTS and current owners, prelude, Assembly, Center Motion, Home readiness/lease, and actual CI log. MB-001/002/011: prelude's eight-second budget was reset on adoption and Assembly could cancel its watchdog before launch then extend beyond the original deadline at resume/late reveal/settle. Prelude transfers its exact deadline; orphan expiry marks startup seen to prevent replay. Assembly's single rearmable finish timer clamps to that deadline and ignores stale callbacks; it is armed before setup. Insufficient time for the full choreography causes fail-open, not an extra waiting period. Center Motion's orphan pending timer is bounded to the available startup deadline and cannot remove a new gate via stale callback. Isolate failed timer cancellation/setup, preflight, settle and late-rescan failure; observe/retire boot effects returned after disposal. Existing choreography unchanged for successful launches. Two new behavior regressions: inherited deadline and stale timer/cap; extended prelude fixture to verify deadline/expiry. Update source-contract assertions for new exact ownership, without relaxing intended behavior.

A3.3 source checkpoint subject to canonical CI; native acceptance remains explicitly deferred. Existing Assembly booleans and standalone orphan safety timers remain; do not describe this as a full formal FSM or universal single timer across all entrypoints. A3.4 must consolidate timing/finished outcome and establish generated pure plan; A3.6 still owns complete topology and geometry handoff, interruption integration and MB-011 freeze. Mixed legacy Home/Refined-first registry and actual Gecko favicon paint/native execution remain open. No MB7 native PASS or visual Bloom implementation claimed. Proceed to A3.4 only after CI is green.

### A3.4a — preview.86 timing budget

MB-007/008/012: pure startup offsets and completion budgets extracted; late Boot handoff and late reveal are rejected when the full effect cannot fit the remaining budget. Shared document epoch, exact completion outcome, Address Cascade integration, Lab parity and native acceptance remain open. Do not mark MB3 complete.

### A3.4b — preview.87 document epoch

MB-007/008/012: current startup owners share one document epoch, including boot-disabled paths and late Home/chrome. Mixed legacy owners still use legacy play; native compositor behavior, unified finished/cancel outcome, Address Cascade and Lab parity remain open. No broad MB3 closure.

### A3.4c1 — preview.88 Address lifecycle

NC4-050/051: exact phase/bar/epoch, current cancellation recovery, bounded wave/phase/handoff completion and isolated cleanup implemented in source. Native reproduction/acceptance remains open. Startup outcome and full A3.4 review remain pending.

### A3.4c2 — preview.89 Startup terminal outcome

MB3: common effect outcome and bounded completion implemented for current Startup owners. Legacy owners are explicitly unverified; no claim of native frame continuity or Lab parity. A3.4-R integrated review, MB6 geometry/topology handoff and native acceptance remain open.

### A3.4-R — preview.90 integrated audit

Fixed source-confirmed false terminal success, retained cancel blind spot, mixed epoch/outcome capability, late admission after synchronous cleanup, interruption reseal and stale Address geometry/bar cleanup. NC4-050/051 and MB3 native verification remain open; MB4/5 real-slot visual comparison, MB6 topology handoff and approved Lab parity are not yet implemented/verified.

### A3.5a — preview.91 visual comparison

MB-006/007/010/012/013: pure Fold extraction, bounded Bloom candidate and generated comparison Lab implemented. Current runtime remains Fold; original approved Magnetic Bloom HTML not recovered. Real-slot acquisition/fallback, CSS property ownership, Home choreography, Boot mapping, topology and native performance remain open.


### A3.5b — preview.92 isolated tab candidate

MB-006/007/010/012/013: real-slot tab/split acquisition, sampled computed style/geometry admission and rollback/fallback implemented within current Center Motion; no production activation. Full Bloom timing/Boot/Home mapping, native CSS/WAAPI/paint and geometry handoff remain open; no original Lab parity.


### A3.5b-R — preview.93 acquisition audit

Corrected inconsistent candidate budget, stale explicit fallback and epoch reentry, strengthened WAAPI state/finished-promise validation and preserved Fold CSS selector priority. Competing animation fails open. Full common timing, Home/Boot, topology and Gecko/visual acceptance remain open.


### A3.5c1 — preview.94 timing and Home

MB3/5: shared candidate full timing plan, isolated native Home leaf effects and generated Lab schedule implemented. Default Fold unchanged. Actual Assembly candidate surface orchestration/Boot handoff, full topology and native acceptance remain open; no exact original Lab parity.
