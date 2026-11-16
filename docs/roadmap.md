# OnePlane 0.2 — revised roadmap and design decisions

Planning only; no runtime changes. Baseline: 0.2.0-preview.3, a5732e8ceee628c35185bcf5f9e11c4fe58c1e88. User confirmed unloaded-tab flicker OP-001 fixed. Address animation/selection OP-002/003 remain open.

## 1. Native workspace engine

- Exactly one mandatory Free workspace, first in the Hub, default on ordinary cold startup. No Work/Study presets, demo spaces, or automatic site creation. Users create arbitrary spaces with name, icon, color and order; existing native spaces are shown, not recreated.
- Free is an ordinary native Zen space marked by stable UUID, not an always-loaded/shared tab set. New tabs belong to the active space; global Essentials retain native semantics, including container rules. Never identify by display name alone.
- First run: after native session restore, adopt the sole existing space with consent where renaming is involved; if multiple existing spaces, offer designation of an existing space or creation of empty Free. Never delete or silently merge existing spaces, folders (including Zen Basics) or tabs. If the designated UUID is missing, repair via explicit non-destructive selection; never delete a space based on a stale pref.
- Disable deletion of Free through OnePlane. Native deletion outside the mod requires reconciliation; native UI protection feasibility to be tested. On user-space deletion, default to move tabs to Free, offer explicit close only after confirmation. Preserve container identities, pins, groups and split constraints; do not silently flatten native structures.
- Ordinary cold launch selects Free after SessionStore and Zen Spaces initialization. Preserve explicit --space routing, private/unsynced windows and explicit restore routes; do not switch every window or on Sine reload. Native workspace persistence and active selection remain authoritative.
- Storage: ZenSessionManager owns zen-sessions.jsonlz4 and native backups; native SessionStore owns restoration data. OnePlane stores only Free UUID and memory/UI preferences (e.g. zen.oneplane.free-space-id, workspace-unload-delay-ms, workspace-unload-enabled), no independent URLs, session database or page snapshots. Use getWorkspaces(), createAndSaveWorkspace(), changeWorkspaceWithID(), moveTabToWorkspace() via feature-detected adapter. IDs, APIs and exact version compatibility must be verified during implementation.

## 2. Memory policy — proposed balanced default

Use event-driven delayed discard, not close/recreate. Active space remains resident subject to normal native memory pressure. When leaving any space (including Free), mark inactive and schedule eligibility after 180 seconds. Returning cancels its deadline immediately. No periodic per-tab timers. One scheduler per window (or process coordinator for synced windows); one nearest-deadline timer, monotonic time, generation tokens for races, cleanup on mod unload/window close. Recheck current workspace, tab ownership, native discard eligibility and all relevant visible windows immediately before each discard. On busy, sharing, audio, protected/dirty or uncertain eligibility, skip; retry only on relevant state change or bounded backoff. Never force discard, suppress beforeunload, or unload selected/visible tabs in any window.

Native Zen already offers unloadWorkspace() and unloadAllOtherWorkspaces() using gBrowser.explicitUnloadTabs on allStoredTabs. Automatic policy must be more conservative than manual bulk actions; investigate native non-forced discard/prepareDiscardBrowser contract in the target build, rather than calling a context-menu function or writing SessionStore directly. Protect active audio/video/PiP, capture/WebRTC, downloads or ongoing work when detectable, unsaved forms/editor state, non-discardable tabs, active split members, Essentials and explicit keep-awake tabs. If reliable detection is unavailable, skip or leave automatic policy disabled until tested. Discarded tabs retain identity/session metadata but reload the document on selection; arbitrary JS state and unsaved edits are not guaranteed to survive. No claim of exact RAM savings: shared processes/caches can remain.

Suggested global modes: never (native memory pressure only), balanced 3 min (proposed default after safety validation), aggressive 1 min, relaxed 10/30 min; manual unload inactive space separately. Immediate mode optional only after testing. Optional per-space override Keep loaded. No preloading every tab when switching back: let Zen restore selected tab and lazy-load others on demand. Native memory pressure retains authority. No duplicate tabs, no network fetch by OnePlane, no persistent timer state. Show resident/lazy counts based on native status, not fabricated RAM figures.

Tests: switch A→B→A before deadline; repeated switches; cold start and hot reload; audio/PiP/WebRTC, dialogs and dirty forms; selected/split/essential exclusions; tab move/close during discard; multiwindow sync/private; memory pressure; session recovery; measure RAM and frame pacing with real Zen.

## 3. Hub Foundation

Own left toolbar button replaces missing native Compact Mode shortcut. Hub overlay independent of Compact Mode; native toggle remains accessible via Hub settings/keyboard. No duplicate vertical tab list. Free and actual existing user-created spaces only, plus create action. Native context menu on mirrored tabs; no fake placeholders for unavailable actions. Integrate Essentials/folders in later milestones.

## 4. Extension toolbar / discoverability

User reports visible SponsorBlock at right, native Extensions menu available but pinning other extensions to toolbar is not intuitive. Current right area also contains window minimize/maximize/close and other native buttons.

Proposed default: native Extensions manager button and pinned extension actions in a left zone near address bar, with optional lower-left row under address bar if geometry allows; preserve centered tabs and avoid crowding URL expansion/bookmarks. Right zone remains native window captions and appropriate page/window controls. User may choose left, lower-left, or right placement (right below window controls is a candidate, not final). Native pin/unpin and reorder remain global across spaces initially. No hard cap of five; target ~5 visible icons at typical width, adaptive overflow for more, always expose overflow/manager entry. No disabling or uninstalling hidden extensions.

Native Firefox/Zen CustomizableUI owns actual widget placements. Use actual browser-action nodes and native extension menu/popup anchors, context commands and permissions; do not clone extension controls or replace permissions UI. Add discoverable explicit Pin to toolbar / Unpin controls in native menu or a compatible management view, and arrange pinned icons through Customize Toolbar/native placement APIs. Keep native panel for unpinned extensions and distinguish clicking an extension (run action) from pinning (placement). Extensions without toolbar actions are not pinnable. Preserve user choices on mod disable and avoid reordering every window on startup. Test install/remove, private-window permissions, badge updates, popups and anchors, pinned/unpinned state, overflow, narrow windows, both Compact modes, Zen Refined/Nebula, keyboard and customizations. Determine final placement via prototype before runtime implementation.

## 5. Delivery sequence (provisional)

- Hub Foundation / native context menus.
- Workspace Engine: Free + create/select/rename/reorder/delete/migrate.
- Memory policy: native safe delayed discard with opt-out, metrics and tests.
- Extension integration: left zone prototype, pin/unpin, placement/overflow.
- Library: Essentials, pins and folders.
- Interactions: cross-space drag, multiselect and audio.
- Fluid UI: OP-002/003, high-refresh frame pacing.
- Live folders, compatibility, stabilization.

Maintain source modules and reproducible build; no large unrelated runtime changes in a single release. OP-004 remains intermittently observed, even though latest update arrived. Preview numbering decided at publication.

## Source references

- Zen 1.24.2b: [ZenSpaceManager](https://github.com/zen-browser/desktop/blob/1.24.2b/src/zen/spaces/ZenSpaceManager.mjs) (workspace create/switch/unload).
- [ZenSessionManager](https://github.com/zen-browser/desktop/blob/1.24.2b/src/zen/sessionstore/ZenSessionManager.sys.mjs) (native session file).
- [TabUnloader patch](https://github.com/zen-browser/desktop/blob/1.24.2b/src/browser/components/tabbrowser/TabUnloader-sys-mjs.patch) (native memory-pressure selection).
- [ZenCustomizableUI](https://github.com/zen-browser/desktop/blob/1.24.2b/src/zen/common/sys/ZenCustomizableUI.sys.mjs) and [CustomizableUI patch](https://github.com/zen-browser/desktop/blob/1.24.2b/src/browser/components/customizableui/CustomizableUI-sys-mjs.patch).
- [Mozilla extension toolbar help](https://support.mozilla.org/en-US/kb/extensions-button).
- [Firefox lazy browser documentation](https://firefox-source-docs.mozilla.org/browser/components/tabbrowser/docs/lazy-browsers.html) (current upstream; verify exact Zen build contract).
