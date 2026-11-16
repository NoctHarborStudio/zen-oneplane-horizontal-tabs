# OnePlane 0.2 — revised roadmap and design decisions

Baseline: 0.2.0-preview.4. User confirmed unloaded-tab flicker OP-001 fixed in preview.3. UI stabilization now takes priority over Hub; preview.4 mitigates OP-002/003/006/007, pending live confirmation.

## 1. Native workspace engine

- Exactly one mandatory Free workspace, first in the Hub, default on ordinary cold startup. No Work/Study presets, demo spaces, or automatic site creation. Users create arbitrary spaces with name, icon, color and order; existing native spaces are shown, not recreated.
- Free is an ordinary native Zen space marked by stable UUID, not an always-loaded/shared tab set. New tabs belong to the active space; global Essentials retain native semantics, including container rules. Never identify by display name alone.
- First run: after native session restore, adopt the sole existing space with consent where renaming is involved; if multiple existing spaces, offer designation of an existing space or creation of empty Free. Never delete or silently merge existing spaces, folders (including Zen Basics) or tabs. If the designated UUID is missing, repair via explicit non-destructive selection; never delete a space based on a stale pref.
- Disable deletion of Free through OnePlane. Native deletion outside the mod requires reconciliation; native UI protection feasibility to be tested. On user-space deletion, default to move tabs to Free, offer explicit close only after confirmation. Preserve container identities, pins, groups and split constraints; do not silently flatten native structures.
- Ordinary cold launch selects Free after SessionStore and Zen Spaces initialization. Preserve explicit --space routing, private/unsynced windows and explicit restore routes; do not switch every window or on Sine reload. Native workspace persistence and active selection remain authoritative.
- Storage: ZenSessionManager owns zen-sessions.jsonlz4 and native backups; native SessionStore owns restoration data. OnePlane stores only Free UUID and memory/UI preferences (e.g. zen.oneplane.free-space-id, workspace-unload-delay-ms, workspace-unload-enabled), no independent URLs, session database or page snapshots. Use getWorkspaces(), createAndSaveWorkspace(), changeWorkspaceWithID(), moveTabToWorkspace() via feature-detected adapter. IDs, APIs and exact version compatibility must be verified during implementation.

## 2. Memory policy — agreed 10-minute default

Use event-driven delayed discard, not close/recreate. Do not preload an entire space on entry. When leaving any space (including Free), mark inactive and schedule eligibility after 600 seconds (10 minutes). Already resident tabs can remain warm until their deadline, subject to native memory pressure. Returning cancels its deadline immediately. No periodic per-tab timers. One scheduler per window (or process coordinator for synced windows); one nearest-deadline timer, monotonic time, generation tokens for races, cleanup on mod unload/window close. Recheck current workspace, tab ownership, native discard eligibility and all relevant visible windows immediately before each discard. On busy, sharing, audio, protected/dirty or uncertain eligibility, skip; retry only on relevant state change or bounded backoff. Never force discard, suppress beforeunload, or unload selected/visible tabs in any window.

Native Zen already offers unloadWorkspace() and unloadAllOtherWorkspaces() using gBrowser.explicitUnloadTabs on allStoredTabs. Automatic policy must be more conservative than manual bulk actions; investigate native non-forced discard/prepareDiscardBrowser contract in the target build, rather than calling a context-menu function or writing SessionStore directly. Protect active audio/video/PiP, capture/WebRTC, downloads or ongoing work when detectable, unsaved forms/editor state, non-discardable tabs, active split members, Essentials and explicit keep-awake tabs. If reliable detection is unavailable, skip or leave automatic policy disabled until tested. Discarded tabs retain identity/session metadata but reload the document on selection; arbitrary JS state and unsaved edits are not guaranteed to survive. No claim of exact RAM savings: shared processes/caches can remain.

Agreed default: 10 minutes, after safety validation. An opt-out (native memory pressure only) and per-space Keep loaded are proposed safety controls; do not introduce additional delay presets without a design decision. Switching spaces immediately renders all tab icons from native session metadata, without loading all documents. Load other tabs only on explicit selection. Zen may restore the selected tab as part of the native workspace switch; verify whether a neutral/empty selection can avoid even that restore without disturbing native session semantics. Do not create extra placeholder tabs or close existing tabs to force this behavior. Preserve already-loaded tabs rather than reloading them unnecessarily. Native memory pressure retains authority. No duplicate tabs, no network fetch by OnePlane, no persistent timer state. Show resident/lazy counts based on native status, not fabricated RAM figures.

Tests: switch A→B→A before the 600-second deadline; verify icons appear immediately with no bulk document loading, only explicitly selected tabs (and any native-required selected-tab restoration) load; repeated switches; cold start and hot reload; audio/PiP/WebRTC, dialogs and dirty forms; selected/split/essential exclusions; tab move/close during discard; multiwindow sync/private; memory pressure; session recovery; measure RAM and frame pacing with real Zen.

## 3. Hub Foundation

Own left toolbar button replaces missing native Compact Mode shortcut. Hub overlay independent of Compact Mode; native toggle remains accessible via Hub settings/keyboard. No duplicate vertical tab list. Free and actual existing user-created spaces only, plus create action. Native context menu on mirrored tabs; no fake placeholders for unavailable actions. Integrate Essentials/folders in later milestones.

## 4. Extension toolbar / discoverability

User reports visible SponsorBlock at right, native Extensions menu available but pinning other extensions to toolbar is not intuitive. Current right area also contains window minimize/maximize/close and other native buttons.

Corrected and agreed placement: a separate lower-left Extension Dock, starting directly below the Hub button and extending horizontally beneath the whole upper-left group (Hub, navigation controls, address bar). The native Extensions manager button, pinned extension actions and overflow belong in this lower strip, not inline with the upper row and not below the right-side window captions. The main row remains Hub / navigation / address / centered tabs / native system controls. Preserve the central bookmarks area, address expansion and existing centered tabs. Exact dock width, row heights, coexistence with bookmarks, popup anchoring, and behavior when the bookmark row is disabled must be prototyped. No automatic move into the primary row. Optional alternative placement is not part of the agreed initial design. Native pin/unpin and reorder remain global across spaces initially. No hard cap of five; target ~5 visible icons at typical width, adaptive overflow for more, always expose overflow/manager entry. No disabling or uninstalling hidden extensions.

Native Firefox/Zen CustomizableUI owns actual widget placements. Use actual browser-action nodes and native extension menu/popup anchors, context commands and permissions; do not clone extension controls or replace permissions UI. Add discoverable explicit Pin to toolbar / Unpin controls in native menu or a compatible management view, and arrange pinned icons through Customize Toolbar/native placement APIs. Keep native panel for unpinned extensions and distinguish clicking an extension (run action) from pinning (placement). Extensions without toolbar actions are not pinnable. Preserve user choices on mod disable and avoid reordering every window on startup. Test install/remove, private-window permissions, badge updates, popups and anchors, pinned/unpinned state, overflow, narrow windows, both Compact modes, Zen Refined/Nebula, keyboard and customizations. Prototype exact spacing and overflow behavior before runtime implementation; the lower-left strip beneath the entire navigation group is agreed.

## 5. Portrait / narrow layout (OP-005)

User reports that the horizontal OnePlane UI works very poorly on a portrait monitor because the available width is insufficient. This orientation was not previously tested. First candidate: adaptive two-row icon layout only in portrait mode when the primary row cannot fit; redistribute icons into a second row instead of clipping or compressing the entire toolbar. This responsive wrapping is distinct from the dedicated lower-left Extension Dock in normal layout. The dock and bookmark strip may share available lower space; whether a third physical band is needed in portrait mode remains unresolved. The visual concept is provisional, not an agreed fixed row count for the entire toolbar. Do not enable two rows just because a screen is portrait if all icons fit. Measure actual available chrome width and required icon width; use hysteresis to avoid oscillation near the threshold. Keep native navigation, Hub, extension actions and window captions reachable; preserve tab selection, drag targets, bookmarks, address expansion, Compact Mode visibility and measured contour geometry. Exact second-row icon membership and minimum supported width remain design/test questions. Current CSS uses a 900px minimum-width scope; audit that guard and the matching JS capability gate rather than just adding a media query. Check maximized portrait, narrow windows, resize, OS scaling, many tabs/extensions, both Compact modes, and rotation between orientations. Do not redesign landscape layout in this task; separate future design decision.

## 6. Final development sequence (release numbers provisional)

Baseline: source migration and Compact Mode independence are done, OP-001 fixed in user testing. Integrate these planning documents into preview with the next actual runtime release (do not publish a docs-only Sine update).

0. **Immediate priority: UI stabilization.** Fix OP-002/003 address opening and selection, OP-006 first-click strip jump, and OP-007 disappearing Compact Mode button. Validate real Zen frame pacing, startup selection, mode toggles, and regression behavior before Hub. Preview.4 contains the first fixes.
1. Hub Foundation: native context menu, left Hub button, independent overlay, close/focus/Escape, access to native Compact Mode toggle, real native workspace listing or explicit unavailable state. Extract lifecycle-owned Hub controller; no new session store.
2. Workspace Engine: Free UUID designation, non-destructive migration, user-created spaces only, create/select/rename/reorder/delete with safe transfer, default cold-start behavior, metadata-only tab rendering, no bulk preload. Verify actual Zen session and multiwindow semantics.
3. Memory Management: 600-second inactivity timeout, cancel on return, conservative native discard, opt-out and protected tabs, on-demand restoration. Test before enabling automation by default.
4. Extension Dock: separate lower-left strip beneath the complete Hub/navigation/address group. Preserve real extension widgets, native menu actions, pin/unpin/reorder and adaptive overflow; integrate geometry and shared contour, test with bookmarks shown/hidden.
5. Portrait Responsive UI: OP-005 investigation and prototype of a second icon row when required. Do not finalize physical row count or landscape changes prematurely. Test available width, scaling, rotation, native controls and both layout modes.
6. Library: Essentials, pinned tabs, folders, bookmarks, native data and actions; preserve Zen Basics and user data.
7. Interactions: cross-space drag/drop, native multiselect, audio controls, Split View/Glance compatibility.
8. Fluid UI: remaining performance and animation polish after the immediate stabilization gate; do not defer OP-002/003/006/007 to this milestone.
9. Integration: Live Folders, Zen Refined/Nebula/SuperPins compatibility, session recovery, multiwindow and performance tests; stabilize before 0.2.0.

Every milestone: feature detection, lifecycle cleanup, source build, unit/regression tests, manifest + updatedAt validation, atomic release and real Zen smoke test before the next milestone. The final layout details, safe discard API contract and exact native selected-tab restore behavior are still validation gates.

Maintain source modules and reproducible build; no large unrelated runtime changes in a single release. OP-004 remains intermittently observed, even though latest update arrived. Preview numbering decided at publication.

## Source references

- Zen 1.24.2b: [ZenSpaceManager](https://github.com/zen-browser/desktop/blob/1.24.2b/src/zen/spaces/ZenSpaceManager.mjs) (workspace create/switch/unload).
- [ZenSessionManager](https://github.com/zen-browser/desktop/blob/1.24.2b/src/zen/sessionstore/ZenSessionManager.sys.mjs) (native session file).
- [TabUnloader patch](https://github.com/zen-browser/desktop/blob/1.24.2b/src/browser/components/tabbrowser/TabUnloader-sys-mjs.patch) (native memory-pressure selection).
- [ZenCustomizableUI](https://github.com/zen-browser/desktop/blob/1.24.2b/src/zen/common/sys/ZenCustomizableUI.sys.mjs) and [CustomizableUI patch](https://github.com/zen-browser/desktop/blob/1.24.2b/src/browser/components/customizableui/CustomizableUI-sys-mjs.patch).
- [Mozilla extension toolbar help](https://support.mozilla.org/en-US/kb/extensions-button).
- [Firefox lazy browser documentation](https://firefox-source-docs.mozilla.org/browser/components/tabbrowser/docs/lazy-browsers.html) (current upstream; verify exact Zen build contract).


### Immediate stabilization checkpoint — preview.5

User confirmed startup strip jump (OP-006) and Compact Mode button (OP-007) fixed. Address motion is the only current implementation priority: native Fluid Wave opening/closing and actual high-refresh validation (OP-002/003). Do not begin Hub until this is confirmed. All agreed Free, 10-minute unload, lower-left Extension Dock and portrait roadmap decisions are unchanged.


### Stabilization checkpoint — preview.7

User approved the native address wave and requested the Bunny Cascade visual companion in both hover modes before Hub. Preserve the accepted address trajectory. Validate the new cascade (Expand/Island, native dismissal, rapid reversal, Split View and optional Zen Refined startup) before beginning Hub. No workspace or Extension Dock changes.
