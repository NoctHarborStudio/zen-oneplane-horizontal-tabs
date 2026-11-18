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
| NC4-027 | Documentation-only CI failure | A0 |
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

Primary static audit checkpoints complete: 100 evidence IDs, 16 extracted-source experiments (not permanent tests/native PASS). Every ID has one primary workstream in the [consolidated implementation ownership table](nocturne/pipeline-0.4.0.md#consolidated-implementation-ownership-100-evidence-ids-not-100-fixes); cross-links are dependencies, not duplicate implementations. P0 risks are prioritized before broad visual refactors. A0.3 release CI next; native baseline and actual acceptance pending. No runtime/version change.
