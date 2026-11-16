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
- Status: open; repository-side metadata is valid. Do not alter the local database blindly or mark this fixed merely by bumping versions.

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
