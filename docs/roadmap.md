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


### Stabilization checkpoint — preview.8

Bunny Cascade v2 addresses reported card overlaps, merged impulses, reveal flicker and group-radius discontinuity (OP-008/009/010). Preserve approved address wave. Validate before Hub; no changes to workspace or extension plan.


### Stabilization checkpoint — preview.9

User requests plain tab hiding during address opening, Bunny only on close, and early active-tab underline. Replace expensive shared timeline with linear-size local effects; validate real FPS before moving to Hub. Approved native address wave and other roadmap decisions remain unchanged.


### Stabilization checkpoint — preview.10

Bounded Bunny and progressive Wave Fade for tabs/bookmarks; shared Magnetic Bookmarks with Zen Refined, one controller per window. Validate both installation combinations, disable order, and hover/animation performance before Hub. Existing workspace, 10-minute unload, Extension Dock and portrait priorities remain unchanged.

## Preview.11

Hub Foundation first pass: native popup, actual workspace list, selection, named creation, Compact Mode and native tab context menu. Free designation/migration, full management, memory policy, Library and Extension Dock remain future stages. See [hub.md](hub.md).

## Multi-monitor workspace projection — requested 2026-11-16

Add to Workspace Engine after native management and before final integration. Drag an existing workspace from Hub to another monitor to open a secondary browser window showing that workspace; original shared workspace and all its tabs must remain present in the original Hub/window. This is a projection of one native workspace identity, not moving tabs out, deleting source, or creating duplicate independent workspaces. Provide an explicit Return / Reattach button in the secondary window to close/release the projection and restore focus/selection without deleting workspace or tabs. Investigate Zen native synced windows, per-window workspace selection, OS screen positioning, browser/window lifecycle and privacy constraints before implementation; do not assume one live browser can render into two windows or clone session state. If native synchronization cannot preserve tab identity and state, prototype a safe alternative and obtain approval. Test multi-monitor DPI, mixed refresh rates, disconnected screens, repeated drag/return, active audio and split/pinned/folder tabs, private/unsynced windows, close/restart, no duplication or loss, memory policy coordination. No implementation in preview.12.

## Preview.14 projection prototype

Implemented experimental native synced-window projection, cross-display pointer release, context action and guarded Return. All-tab native sync is required, no independent session or forced changes to sync settings. Runtime validation pending (especially mixed DPI and close). No timed discard yet.

## Preview.15–16 — drag feedback and live projection distinction

Cross-monitor placement now has a Snap-style OnePlane preview, fixed center target, workspace carry badge and work-area geometry. Live simultaneous same-tab rendering (scroll, media playback and input) remains an architectural milestone distinct from Zen's focus-driven docshell transfer. Investigate a single authoritative browser surface with remote view/input, DRM, cross-origin and accessibility, avoiding duplicate playback or session state. No arbitrary page input forwarding or duplicate sessions introduced.

## Preview.17 — stabilization order agreed after preview.16 feedback

1. Drag Engine: one tokenized gesture per window, explicit cancel/finish, event ownership and complete cleanup on interrupted input. Keep Split View visuals unchanged; temporarily disable broken external Snap preview and forced placement. Validate real screenshot interruption, native drag and workspace drag before next milestone.
2. Display & Snap Engine: investigate native Windows Snap feasibility and correct monitor coordinate spaces/DPI, work area, corner classification, one preview/commit geometry and actual window placement. Re-enable only after runtime tests.
3. Finish Workspace Engine (Free designation, rename/icon/color/order and safe native management).
4. Research Live Workspace Projection feasibility, without duplicating page sessions or audio.
5. Memory Management (600s, multiwindow safety); Extension Dock; Portrait Mode; Library; interactions/integration and Fluid UI. Defer remaining Split View overlap (OP-020) to final animation polish as requested.

## Preview.21 — Display & Snap Engine first implementation

Separate display geometry and runtime adapter. Windows chrome native monitor validation, work-area snap, small source-window map and guarded native placement. True desktop-wide visual overlay and native shell Snap semantics deferred pending physical-monitor verification. Drag Engine live test remains open; do not advance to Workspace Engine until this gate is reviewed.

## Preview.29 — projection verification checkpoint

User reports .28 now generally works, including transparent placeholder and search when projecting an inactive workspace, but search is missing for the already-active workspace. Keep Display & Snap Engine on runtime verification until consistent search is confirmed. .29 distinguishes inherited search state from actual open view; open after window placement, bounded recovery only, no ordinary tab creation. Continue using Browser Console stage diagnostics for subsequent regressions.

## Shared floating search surface — approved 2026-11-16

User screenshot: the native central floating search panel is near-black, while the OnePlane toolbar uses a muted blue-gray surface; user requests matching color and translucency in both OnePlane and standalone Zen Refined. This is an agreed visual pipeline task, not yet implemented. Zen Refined should own the reusable native floating URL-bar surface styling; OnePlane should provide/consume compatible toolbar surface tokens and a standalone fallback when Refined is absent. One effective style owner when both are enabled; no duplicated opacity/blur or competing overrides. Use theme-derived color, controlled translucency and a readable fallback when OS material/backdrop is unavailable. Preserve native search layout, keyboard/focus/security cues, suggestions and Smart Search behavior. Test ordinary startup, Ctrl+T, projected workspace, dark/light themes, Nebula on/off, each mod separately and combined, multi-monitor and disable/unload. Do not change accepted Fluid animations.

## Smart Search integration — preview.19 Zen Refined feedback

User confirms Smart Search recent results work with OnePlane, but the expanded horizontal address UI currently looks like a mixed, unstructured list. Add to the visual integration pipeline alongside the shared floating search surface: consume Zen Refined's grouped native results (six Recent tabs, six Recommended suggestions when available; each section 2 columns × 3 rows), left-aligned last-activity time, subtle nonselectable section headings, no repeated Recent tab / Space labels in each row. Match shared theme surface, typography, spacing and result alignment in expanded OnePlane address and native floating search. Reuse one provider and native keyboard navigation; do not duplicate search state or implement a second MRU database. Preserve approved address-wave animations, tab focus, responsive width and close behavior. First-open startup/activation correctness belongs to Zen Refined; test it in OnePlane ordinary startup and projected workspace search too. User approved the two-column 6+6 layout. Zen Refined preview.20 implements the shared native grid; OnePlane-specific theme, spacing and rendering validation remain queued. No OnePlane runtime changes in this documentation update.

## Preview.29 — user acceptance and next milestone

User confirms workspace projection now works and startup/search appears correctly, including the previously failing active-space case. Accept the tested Display & Snap Engine and projection startup path; keep untested edge cases and true simultaneous live rendering separate. No new runtime work needed in this checkpoint. Next milestone: finish Workspace Engine. Begin with native API audit and non-destructive Free UUID designation/migration, then rename/icon/color/order and safe delete/transfer. Existing spaces/tabs must not be silently renamed, merged or deleted. Preserve explicit workspace routing, native sync and working projection/startup/indicator behavior. Follow the agreed sequence: Live Workspace Projection feasibility research, conservative 600-second Memory Management, Extension Dock, Portrait UI, Library, interactions/Fluid UI and integration. Remaining Split View overlap stays deferred.

New user report: the projected workspace opens on another monitor without the usual Center Assembly appearance animation. Zen Refined owns this visual regression; track it in its roadmap. OnePlane may expose a narrowly scoped projection-ready integration signal if needed, without duplicating the animation controller or changing placement/focus/search behavior. This is queued, not implemented.

## Workspace Engine — Trash design (approved 2026-11-16)

User approves expanded Hub with Free, workspace editing, Trash icon and downward drawer. Trash holds recoverable tabs from deleted workspaces; restore via drag-and-drop or accessible selector. Clear by age of entry: all, 5 minutes, hour, day, week, month, year; explicit scoped confirmation; no automatic expiration. Native workspace/session owns contents. Preview.30 uses a native parking workspace (visible in native Zen UI), SessionStore custom tab timestamps and normal native close for Clear (Recently Closed may retain entries). Free explicitly created or designated/renamed with consent, first in Hub and protected from OnePlane deletion. Native rename/icon/order and Hub accent. Initial safety gate: single-window moves/deletion/clear; no grouped/Split/Glance/Essentials, no destructive fallback. Multiwindow safe transfer, groups, Free cold-start routing and native theme color are follow-up stages.

## Preview.31 — approved One Plane Hub visual iteration

User approved interactive prototype: Free separated, full-width bottom Trash button expands within itself, icon/count move right and Clear/age appear in header, no Restore to selectors, compact site cards with favicon/title/address/relative age, drag lift/target feedback. Virtualized fixed-row viewport and single minute timer while open, no per-tab timers. First normal synced startup selects UUID-designated Free or creates one without renaming other spaces; same-named ambiguous user space retains explicit designation. Projection and live reload excluded. Native Trash safety constraints unchanged; keyboard-only restoration, group/multiwindow safety and native color theme remain follow-up. Physical Zen test pending.

## Preview.32 — Trash polish

User confirms bottom drawer, Clear and native drag restore to Free/Space work. Fix misaligned header and age picker closing Hub; use in-Hub button choices, keep selected value for Clear. Add bounded Fluid card lift and post-drop suction/return animation without changing native tab transfer. Runtime visual verification pending.

## Shared Home and Extension Dock follow-up

- Preview.33: portable Home core and OnePlane host; validate in Zen before porting identical source to Refined. Both hosts use one window lease registry and shared shortcut preference.
- After Home stabilizes, add independent Zen Refined trigger. Test both install/unload orders.
- Extension Dock: investigate right-to-left relocation of native pinned extensions and manager, overflow and portrait. No change in this rollout.

## Preview.35 — real Trash card and Free startup

User rejects native ghost/doubled drag image. Move the original Trash row with shared pointer lifecycle, empty spacer and bounded lift/absorption/return; no clone or native drag image. Preserve native restore, filter and virtualization. Windows console confirms hiddenDOMWindow fails during Free startup; use process-local default-branch claim instead. Runtime verification pending.

## 0.2.0-preview.38 — workspace transition integration

Center Workspace Transition integration with Zen Refined preview.24: Home and Hub use an explicit optional shared controller. Preserve toolbar surface and Home contents while old tabs/bookmarks collapse and new ones emerge. Freeze contour geometry during the transition; resume after cleanup. Actual Zen startup, theme/background flicker and repeated switching require runtime verification. Native switches outside Home/Hub are not intercepted.


## Adaptive tabs — independent lanes and second-row overflow

First stage: native independent horizontal lane scrolling and center-facing initial position; compact title to Home icon before fallback. Keep current layout otherwise. Second stage: a stable native-order snapshot partitions into left/right top lanes using collapsed slot widths (including complete Split groups and plus reserve). Retain the center-adjacent suffix on the left and prefix on the right; outer overflow moves to a centered second row, not a third row. Keep both upper lane scroll containers for hover/temporary overflow, make the lower row scrollable if necessary. Repartition only on native tab/group membership/order or measured capacity changes, not hover scale. Preserve native tab IDs/order, select/reveal the exact lane, and defer partition changes during native drag or workspace/address transitions. Extend drop targeting from x-only to (row, x), and update keyboard order, indicator clipping, row height, bookmark shelf, and Unified Contour together. No runtime second-row implementation yet. Below-900px support separately requires adaptive native toolbar/address/caption budget; do not remove the old gate in isolation.

## 0.2.0-preview.43 — primary Home surface

User accepted Home, startup and workspace transitions. Fix repeat Home click exposing empty native background; Home is now an idempotent destination and replaces ordinary empty native tab surfaces. Preserve latest Add Pin UI and native special-window paths. Validate repeated clicks, Escape, background tabs, closing last real tab, pending tab selection, search cancellation and projection in Zen.

## 0.2.0-preview.45 — window drag and New Tab alignment

User reports Home is now primary, but window cannot be dragged from Home and the plus can separate from tabs after moving the window. Use native non-client CSS drag regions on blank Home and toolbar spacers (16px minimum); exclude interactive content, preserve native Snap and tab drag. Clamp plus to occupied right lane and available width; reconcile after native size-mode and resize changes. User console confirms successful startup, 6+6 Smart Search and Center Assembly; generic Object { message } exceptions have no trace and remain unattributed. Validate physical Windows monitor drag, restore/maximize, Snap, mixed DPI, crowded lanes and both hover modes. No speculative global exception interception.

## 0.3.0-preview.30 — Downloads native file drag

Implemented native Gecko drag payload for the latest completed download on the toolbar indicator and individual completed files in Recent downloads and All downloads (shared row cache). Uses the actual nsIFile and file URI; copy/move negotiated by the OS or drop target. No file access outside the user-initiated drag, no partial/blocked/canceled files. Keep Open/Show in folder clicks independent and defer row reconciliation until dragend. Verify Windows Explorer/Desktop, web upload drop zones, cancellation, recent/full modes, deleted file, private list isolation and normal clicks in Zen. Native platform verification pending.

## 0.3.0-preview.37 — Bunny downloads

Native moz-icon artwork refreshes on completion. Shared toolbar/latest and recent/full file drag controller begins with a compact native preview and uses a live chrome ghost only after Gecko accepts the blank image. Restore the compact native preview outside the window; OS drops remain native. Spring lift, top-center grip, reversed swing, cancellation return, reduced-motion fallback. Live Windows icon rendering and image handoff need verification.

## Nocturne — approved Magnetic Bloom startup workstream

Current baseline: 0.3.0-preview.40. User chose Startup Motion Lab option 01. Startup lifecycle and readiness stabilization must precede visual implementation: MB0 baseline -> MB1 ownership -> MB2 readiness -> MB3 shared timing -> MB4 visual engine -> MB5 Home choreography -> MB6 atomic handoff -> MB7 native validation. MB8 (pre-Sine/native flash) is a separate investigation. See [authoritative migration pipeline B.7](nocturne/migration.md#b7-magnetic-bloom-startup-stabilization-approved), [known issues](known-issues.md#nocturne--magnetic-bloom-startup-audit-2026-11-17) and [validation gates](nocturne/validation.md#magnetic-bloom-startup-gates). Do not duplicate the detailed task plan here. No implementation or new release in this planning update; preserve existing Library, Downloads and horizontal feature workstreams.


## Active scope correction — 2026-11-19

Nocturne is the only supported installed package. The separate legacy Zen Refined mod has been removed from the development setup; concurrent installation, Refined-first registry ownership, and maintaining standalone Refined runtime compatibility are no longer development or acceptance requirements. Earlier references to coexistence gates are historical and superseded. Preserve imported features, existing preference keys and native data, source provenance and safe lifecycle ownership within Nocturne. Sine entrypoint order, hot reload, disable/unload, missing/partial entrypoints, and multi-window remain mandatory. Do not silently remove another installed mod or claim coexistence support.

For A4.2, use a single Layout-owned renderer with Magnetic Bookmarks as an internal geometry provider. Remove Refined-only coexistence obligations, not imported functionality or Nocturne lifecycle/visual acceptance. Previous migration and audit records remain historical evidence.

## Planned — Manual Mirror Layout (A4.5 / ML0–ML7; approved UX, not implemented)

Within one native Zen Workspace, add an opt-in **Manual** arrangement without changing the existing **Automatic** balancing mode. In Manual, independent left/right tab sequences grow away from the fixed central Home; no automatic tab crossover for symmetry or capacity. Each side owns a `+` following its last tab, moving to its own second row's outer edge when overflowed; left rows are visually reversed (approved left example: top `2, 1`; bottom `+, 6, 4, 3`), right rows stay forward (top `1, 2`; bottom `3, 4, 5, +`). Independent sliders/scrolling; when only one side needs row two, it uses the centered available full lower width without reserving a blank other half. User drag changes sides, native Split View group moves as one, Ctrl+T/new tab links use active side, explicit `+` selects that side. First enable takes the currently painted visual side; Manual→Auto→Manual remembers assignments; workspace/restart restores saved side placement.

This is a **new feature workstream**, not part of the already approved A5.7c source correction and not shipped with preview.123. Existing Zen tab/session/group data stays authoritative; store only minimal side metadata after native persistence API verification. Detailed architecture/staging ML0–ML7: [manual-mirror-layout.md](nocturne/manual-mirror-layout.md). Native Zen acceptance, per-Workspace versus global mode scope, empty/Home selection and special native tab roles are not yet resolved; do not turn on by default based solely on the HTML demo. Follow [A4.5 in the 0.4.0 pipeline](nocturne/pipeline-0.4.0.md) and [validation gates](nocturne/validation.md).

## Bunny — Vanishing Home and asymmetric elasticity (2026-11-24)

- **Selected B — Vanishing Home:** collapse the central Home island to zero during a local tab/group drag, visually join the two chains into one continuous row, preserve the original Bunny pull/squash and allow reinsertion at a new slot and continued sorting. Restore the centered island after accepted native drop or cancellation. Native tabs, groups, source DOM and native drag session remain authoritative; do not reparent the drag source while Gecko owns the gesture. Initial lab timings: 205 ms collapse, 310 ms restore, subject to native visual validation.
- **Deferred A — Asymmetric Elastic Home:** keep Home visible. Pressure from the left only moves the left edge inward; pressure from the right mirrors it. Opposite edge and opposite lane stay fixed; no empty gap on the unpressured side. When transferring below Home, retain the full Bunny squash, detach, travel and reverse insertion curve. This is an idea to revisit, not part of B or an active setting.
- Implementation gates: frozen continuous virtual geometry and symmetric reorder hysteresis; integrate the existing Drag Engine and native drop admission; restore actual native order/partition after completion; cancel/escape/resize/unload and external OS-image handoff; handle or explicitly retain native fallback for unsupported overflow/Split member geometry. Source tests, reproducible build, CI and real Zen visual/diagnostic validation are separate gates. No decorative wave, unrelated runtime redesign, or new persisted tab state.

## Nocturne Design System — material first (DS1–DS8)

Approved workstream: one configurable translucent material across top plane, search, Hub, Downloads and Library, local per-property overrides, flat single top backing without bookmark-local halo; motion unification follows. Restore anchored compact All Downloads in DS6 while keeping Library. Owner and staged acceptance: [design-system.md](nocturne/design-system.md). DS-M1 source audit complete; DS-M2/M4 token contract and top-plane slice next. No runtime change in this planning commit.

- **VH1–VH4 visual correction (preview.207):** fixed center pivot, preserved original presentation across the drag/return, shared smooth join/restore clock, and regression coverage for release/handoff. VH5 native visual acceptance remains open, including dock-wide tint, rapid repeat, cancel, Bunny and both reorder directions. Deferred asymmetric A unchanged.

- **EC1–EC4 (preview.215):** approved Elastic Chain 2.0 replaces rigid whole-row grip offset. Measured distributed gaps, fixed grab and edges, local crossing-only reorder and adjacent Bunny closure; existing native drop and Home restoration retained. Source/fixture checks pass; EC5 CI and native visual acceptance open. Asymmetric Elastic Home A remains deferred.

- **EC5 — partial native acceptance (preview.219, 2026-11-28):** user reports excellent visual behavior. Retained diagnostics show four confirmed local single-row tab moves (including cross-side reorder), four 400 ms restores and paired presentation acquire/release, zero measured outer-edge displacement, zero grip offset, centered pivot, stable sampled label/icon mode, island and surface material at collapse and restore (8/8 each), and no residual ghost/detached/laneGhost in the following samples. Drag/restore callback p95 5.56–9.68 ms, not presented FPS; one drag max 27.78 ms. Current branch CI passed. All retained drag completions have pull=0; Escape, detached Bunny/OS handoff, Split and overflow are not newly validated by this capture. Log retention dropped older events; geometry string is null despite measured distributed gaps. Preserve accepted ordinary-sort UX and existing runtime; no runtime version bump.
