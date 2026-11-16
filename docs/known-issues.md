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
- Status: open; no animation changes in this release.

## OP-003 — Abrupt disappearance of selected URL text on close

- Reported on installed 0.2.0-preview.1.
- When closing the inline address editor, the highlighted URL selection disappears unattractively, even though the overall closing animation is acceptable.
- Investigate native blur/selection timing relative to the closing wave. Do not replace the native text input or interfere with actual selection, clipboard or keyboard behavior.
- Acceptance: selection visually settles without a sudden flash or jump; retain the existing good closing motion.
- Status: open; no fix yet.

## OP-004 — Sine intermittently does not discover published updates

- Reported repeatedly; screenshot shows installed 0.2.0-preview.1 while preview.2 is published.
- Verified preview.2 raw manifest (with and without cache-busting query), GitHub branch head, increasing updatedAt, stable ID/homepage and successful archive verification.
- Sine 2.3.3 compares updatedAt, skips disabled/no-updates mods, and processes the installed list sequentially without a per-mod catch in updateMods. Its fetch helper uses ordinary fetch without explicit cache bypass. The crossed-arrow icon is also used for enabled updates; the highlighted button state and tooltip distinguish opt-out.
- Next diagnostic: inspect only the local OnePlane entry in chrome/sine-mods/mods.json (version, updatedAt, homepage, enabled, no-updates, origin), and browser console errors during manual update. A stale response or failure in another mod is possible, but unconfirmed.
- Status: open; repository-side metadata is valid. Do not alter the local database blindly or mark this fixed merely by bumping versions.
