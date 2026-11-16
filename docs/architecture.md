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

## Workspace model (revised)

Exactly one mandatory Free space, designated by stable native Zen UUID. No predefined Work/Study templates, no automatic creation of other spaces. Users create and organize their own native spaces. Free is the ordinary cold-start destination, not an always-resident or shared workspace. Preserve existing spaces and tabs; migration must be non-destructive. Explicit command-line space routing and private/unsynced windows take precedence. See [roadmap.md](roadmap.md) for persistence, memory policy and extensions design.

## Delivery

1. Source split and deterministic build (done).
2. Independent compact/persistent layout (done, user tested).
3. Hub shell and native context menu.
4. Native workspace engine: Free plus user-created spaces.
5. Workspace memory policy: 600-second inactivity timeout and on-demand tab restoration.
6. Extension placement beside Hub at the far left of the primary toolbar and native pin/unpin controls.
7. Portrait responsive layout: adaptive second icon row when required (OP-005); landscape redesign deferred.
8. Essentials, pins, folders and interactions.
9. Fluid address animation, integration, stabilization.

See [roadmap.md](roadmap.md) for acceptance criteria and sequencing. Preview numbers are provisional.

Build locally with npm run build, verify with npm run verify, commit sources and generated artifacts atomically. CI checks parity, syntax, algorithms, stable manifest identity, monotonically increasing version/timestamp and served archive. Runtime smoke testing in Zen remains required.


## Preview.2 — independent layout

The common activation scope no longer depends on Compact Mode. The native mode is user-owned and changes only visibility/layout: overlay versus persistent in-flow. The persistent toolbar uses a solid background, no overlay gradient into page content. Native caption controls are rescued only if the manager puts them in the hidden toolbox, and restored on unload. Existing source sections remain transitional. See [OP-001](known-issues.md) for the reported unloaded-tab flicker mitigation.
