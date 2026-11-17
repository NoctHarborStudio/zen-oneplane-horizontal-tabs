# N O C T U R N E — architecture RFC

Status: proposed, planning only. No production behavior is changed by this RFC.
Product: Nocturne, a complete Zen browser UI modification by NoctHarborStudio, not a browser fork.
Working repository: existing OnePlane repository; public package ID retained.
Source baselines: OnePlane 0.2.0-preview.62 at 4281c4778f3851f939ad3cfdb01406238ff2d2a0; Zen Refined 0.6.0-preview.26 at 1926eacbe29782d80324ac277563aff514bf6943.

## 1. Goals and invariants

- One installable Sine mod, one manifest, one authoritative owner per component. Keep the current accepted horizontal UI working before attempting the vertical redesign.
- Zen remains authoritative for native tabs, sessions, workspaces, containers, Essentials, folders, split views, downloads, bookmarks, URL bar, permissions and extension actions. Never rebuild the session store or duplicate tabs to switch layout.
- Shared features run independently of the active layout. Horizontal uses the existing OnePlane mirror. Vertical starts with styled native sidebar tabs; it does not use a rotated horizontal mirror.
- No permanent opaque page overlay, full-page window-drag region, polling loop, second Smart Search provider, or full-window geometry calculation on every pointer move.
- Native fallback for unsupported browser versions, customization, popup windows and fullscreen. Respect private/unsynced/projection contexts, native commands, accessibility and reduced motion/transparency.
- No new feature scope during parity migration; preserve all existing controls and stored preferences.

## 2. Current coupling, verified in sources

OnePlane builds layout.uc.mjs and chrome.css deterministically from ordered source fragments. The split is transitional: installTabStrip is a large shared closure, not a set of independent controllers. Core activation waits for SessionStore/workspaces, snapshots native global layout prefs, applies TARGET, calls hideToolbar, mounts the horizontal strip and publishes OnePlane:StartupState. CSS hides navigator-toolbox when the horizontal row is ready. Home core is already host-neutral with a lease, but its trigger, Hub and Free startup are coupled to horizontal activation. Drag geometry, overflow allocation and contour measurements are horizontal-specific.

Refined ships eight separate scripts (shared bookmarks plus seven others). Both baselines already have byte-identical bookmarks.uc.mjs and magnetic bookmark CSS; six preference keys overlap. Smart Search owns a provider per native provider manager, with a per-window client and a reference-counted registry. Page Progress and startup placeholder suppression are largely independent. Downloads supports native and OnePlane hosts but its horizontal detection still contains a 900px guard. Assembly/Disassembly and Workspace Transition already branch between native sidebar and OnePlane views. They currently identify hosts by OnePlane selectors/globals and readiness events.

Do not delete compatibility names in the first migration. Keep existing CSS selectors, native hooks, provider name, preference IDs, Home registry and script entry names until parity is measured.

## 3. Target dependency direction

```text
Nocturne package (Sine)
  Bootstrap / process coordinator / per-window context
    Native adapters + preferences + capabilities + lifecycle
    Shared services (Home, Hub, workspace policy, Smart Search,
      Downloads, Page Progress, Bookmarks, startup/close/workspace motion)
    Layout manager (one active layout per window)
      Horizontal adapter (existing OnePlane)
      Vertical adapter (styled native Zen sidebar)
      Native fallback (no custom layout)
    Design system (semantic tokens, surfaces, motion, icons)
  Native Zen / Gecko (authoritative model and commands)
```

Source organization is a target, not an immediate directory rewrite:
- src/core/: bootstrap, disposable scopes, readiness, coordinator, prefs, diagnostics
- src/native/: feature-detected browser, workspace, urlbar, tabs, widget and compact adapters
- src/features/: home, hub, workspaces, smart-search, downloads, bookmarks, page-progress
- src/motion/: assembly, disassembly, workspace transition, contour/surface, shared easing
- src/layouts/horizontal/: existing horizontal sources and interaction algorithms
- src/layouts/vertical/: native sidebar styling, layout host, vertical interaction where needed
- src/styles/: shared semantic tokens, component styles, separately scoped layout styles
- scripts/: deterministic build, parity manifest and release checks; tests/: pure, fixture, integration gates

One package does not imply one huge script. Keep separate existing script entries during import. Only later adopt a multi-output source build / explicit factories where it reduces coupling; avoid relying on Sine script execution order.

## 4. Proposed interfaces

Per-window context contains win/doc, native adapters, capability flags, settings, service registry, layout host registry, events and a disposable scope. Controllers return idempotent dispose and optional onLayoutChanged. Dependency injection occurs at explicit mounting boundaries; no implicit cross-feature ownership.

Layout interface (conceptual, not yet implemented):
```ts
interface LayoutHost {
  id: "horizontal" | "vertical" | "native";
  mount(ctx: WindowContext): Promise<void>;
  dispose(): void;
  getSlots(): LayoutSlots;
  getMotionTargets(): MotionTargets;
  getSurfaceGeometry(): SurfaceGeometry;
  hold(reason: string): () => void;
}
```
Slots: Home trigger, Hub trigger, download anchor, extension anchor, tab viewport, bookmarks, active address surface, window captions. Slots can be absent; shared features must degrade to native or disable only their UI. Motion targets provide actual geometry and axis, not cloned tab data. Holds are reason/token owned, released on close, cancellation and disposal. Window drag uses bounded native regions, excludes actual controls; CSS mask alone is not a hit test.

One state writer for layout and native pref mutations; shared feature controllers may read active host but must not change global layout prefs. Per-window services survive layout switch. Process/provider-level services use leases keyed by actual native manager, not by window count alone. Preference overlays save original values/user-vs-default and restore only still-owned values. Backups and runtime claims are not normal user settings and must not be blindly migrated.

## 5. Layout state and transitions

Separate orientation (horizontal, vertical, native fallback) from visibility (native compact/persistent) and sidebar presentation (expanded/mini). Future adaptive orientation is opt-in, after manual switching is robust. Start with a profile-wide orientation setting because Zen native prefs are global. Multiple windows changing orientation independently is NOT promised; requires verified native per-window capability or separate design.

Transaction: validate requested mode and capabilities; wait or cancel conflicting tab drag/search/workspace motion; detach layout-owned holds/observers; remove old view and restore owned widgets/native settings; apply new native layout configuration; mount new view; verify required slots; publish ready once; on failure dispose partial view and restore previous viable layout or native fallback. Generation tokens invalidate stale async completions. No native tab recreation, no Free reinitialization, no automatic Home on layout switch. Keep native selected browser, workspace UUID, split membership and search ownership. First implementation may require restart to change orientation; live mode switch is a separate acceptance gate.

## 6. Startup, reload, shutdown

- Distinguish install, cold startup, new window, workspace projection and hot reload. Native SessionStore/workspace readiness and SearchService readiness remain authoritative; do not block native use on cosmetic feature failure.
- Preserve early startup-pref and animation registration requirements; late-load animation skips or bounded fallback rather than hiding already-painted chrome. Shared readiness bridge is emitted at the same semantic point as OnePlane today. Explicit Home startup claim once per eligible window, Free startup claim once per eligible process; preserve routing and privacy.
- Each feature registers all listeners, observers, timers, animation handles, DOM nodes, pref ownership, native command wrappers and provider leases with its own scope. Dispose reverse order, cancel stale work and remove only owned state. Old Sine unload callbacks must never dispose a newly mounted instance.
- At shutdown native close remains authoritative; no delay on OS/global quit. If optional feature fails, log feature and phase without URLs or query text; do not cover native content.
- Process-wide old/new compatibility: migration initially requires disabling legacy Refined and restarting. Later same-package lease/ownership bridge may support safe coexistence, but cannot guarantee protection from old CSS or old unload code. Never silently uninstall or modify Sine registry.

## 7. Design system and vertical direction

Semantic shared tokens for tint/glass, blur, radius, spacing, card sizes, focus, easing, durations and reduced-motion fallback; map old --op-* and --zr-* tokens without changing accepted rendering at first. Horizontal keeps measured adaptive lanes, Fluid/Bunny, current Home and Unified Contour. Vertical first styles native Zen tab list, pinned/Essentials/folders, navigation, Home trigger, Hub and footer. Left/right mirror, expanded/mini and compact/persistent are distinct states. Side Fade should follow measured sidebar width and physical edge, with a separate bounded drag policy. Use native vertical drag/drop, splits and folder behavior initially; add axis-aware cosmetic motion only after native behavior is validated. Address / bookmarks / extension placement, exact dimensions and adaptive policy need user design approval.

## 8. Non-goals for first release

New memory management, Smart Context Menu, Extension Dock, redesign of Home, native tab replacement, full rebranding of all internal identifiers, automatic layout switching, new persistence, browser fork, repository rename, or deletion of the Refined repo. Keep old project history and known issues. No compatibility claim beyond tested Zen/Sine versions.

See [migration pipeline](migration.md) and [validation gates](validation.md).

## Stabilization checkpoint

See [audit register](audit.md) for NC-001–NC-007. Preview.2 fixes narrow Downloads host detection and process-wide Startup ownership; adds a legacy warning, not coexistence support. Unified Core and native runtime gates remain pending.

## Full source audit checkpoint

The [full preview.2 audit](full-audit-preview.2.md) documents actual cross-controller dependencies, source parity, missing Downloads host and reproduced lifecycle races. Resolve Stabilization A before vertical; measure animation ownership/geometry issues in Stabilization B. The target architecture remains a proposal, not yet implemented.
