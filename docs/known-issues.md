# Known issues

## Current triage — Nocturne 0.3.0-preview.35

- **Open / CI:** diagnostics version assertion and two Downloads lifecycle tests fail in [preview.35](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44192812308). Investigate L2 service/fixture ownership before promotion.
- **Open / native validation:** branded startup, pre-injection native window paint, reversible Magnetic Bunny, workspace/closing motion, native download drag and L2 Dock parity. Distinguish source fixes from user acceptance; see [validation](nocturne/validation.md).
- **Superseded plans:** adaptive second-row tabs and native download drag have implementations; older notes describing them as only planned are historical, not proof of native acceptance. Vertical layout and Extension Dock remain planned.
- **Distribution:** legacy Refined alongside Nocturne is unsupported; retain the existing Sine identity and URL.

## Historical OnePlane issue register

Entries below retain their original release context; use current triage and validation for the active baseline.

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
