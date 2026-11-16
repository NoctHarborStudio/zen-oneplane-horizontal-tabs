# OnePlane 0.2 architecture and migration

## Baseline and constraints

Preview 0.1.0-preview.32 (commit 84594b9e9bc395b408e9d21f4791cbc590c976ff) is the known working baseline. The first 0.2 preview is a source-only refactor: generated runtime JS and CSS must be byte-for-byte identical to that commit. Sine keeps the same mod ID, homepage, script entry and preference IDs. No native session state changes are introduced.

## Current stage

Ordered source sections preserve the original shared window closure. Pure geometry and state-transition algorithms are standalone ES modules. The build uses Node standard library only, with a versioned build plan, deterministic concatenation and a narrow named-export inliner. This avoids a new dependency and keeps Sine's single cache-busted script entry. This is an intermediate migration, **not** a completed independent-controller architecture. Future dependency injection should replace the shared closure incrementally.

## Target boundaries

- Core: one per-window lifecycle, subscriptions, cleanup, preferences.
- Native adapter: gBrowser and Zen Workspaces APIs, feature detection; Zen owns sessions.
- Layout: independent active state, compact auto-hide / persistent toolbar, geometry and one visibility latch.
- Toolbar: tab mirror, hover/indicator, address and contour.
- Interaction: drag, split, context commands; one owner of native mutations.
- Hub: UI for spaces, Essentials, pinned tabs, folders, search, no duplicate session store.

## Planned layout migration

Remove Compact Mode from the common activation selector and split capability checks from visibility mode. Compact on = overlay/autohide. Compact off = in-flow persistent horizontal toolbar. Preserve native fallback in fullscreen, customization and narrow windows. Test actual Zen before adding Hub.

## Workspace model

Free is a normal native workspace designated by stable UUID, default on ordinary cold startup; do not override command-line space routing, private/unsynced windows or restored data without checking compatibility. Work and Study are optional user-editable templates, not Firefox profiles. Use Zen's native workspace switch and persistence; no close/recreate on switch. Do not delete Zen Basics or other user folders automatically. Containers are separate optional identity isolation. Define migration, startup and last-space behavior explicitly before implementing.

## Delivery

1. Source split, pure algorithm tests and reproducible build (this release).
2. Extract stateful controllers and remove dependence on Compact Mode for OnePlane activation.
3. Native context menu and Hub shell.
4. Free/Work/Study over native Zen Spaces.
5. Essentials, pinned and folders; then movement and native actions.

Build locally with npm run build, verify with npm run verify, commit sources and generated artifacts atomically. CI checks parity, syntax, algorithms, stable manifest identity, monotonically increasing version/timestamp and served archive. Runtime smoke testing in Zen remains required.


## Preview.2 — independent layout

The common activation scope no longer depends on Compact Mode. The native mode is user-owned and changes only visibility/layout: overlay versus persistent in-flow. The persistent toolbar uses a solid background, no overlay gradient into page content. Native caption controls are rescued only if the manager puts them in the hidden toolbox, and restored on unload. Existing source sections remain transitional. See [OP-001](known-issues.md) for the reported unloaded-tab flicker mitigation.
