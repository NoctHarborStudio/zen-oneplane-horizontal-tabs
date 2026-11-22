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

## Stabilization A implementation

Preview.3 adds the per-window persistent workspace command gate (explicit Home/Hub calls), Downloads generation fencing, Smart Search rollback, best-effort layout teardown and a 30px Horizontal Downloads slot with a dedicated hold. These are incremental runtime contracts, not a completed Unified Core. The bottom Utility Dock, process-level native command service and shared motion/contour ownership remain planned.

## Magnetic Bloom startup architecture checkpoint

Approved design, not implemented (preview.40 planning baseline). The previous broad RFC is refined by [migration B.7](migration.md#b7-magnetic-bloom-startup-stabilization-approved); risk register: [MB-001–015](../known-issues.md#nocturne--magnetic-bloom-startup-audit-2026-11-17).

- One per-window transaction owns phase, generation, readiness, absolute deadline, immutable timeline, effects, geometry lease and cancellation. Boot Prelude supplies an adoptable cover with orphan cleanup, not a second phase owner. DOM markers are derived from the transaction; compatibility readers remain supported.
- Shared Home supplies readiness/eligibility and a stable structural lease; it keeps native selection and normal interaction semantics. Center Motion supplies effects; keep existing workspace/close Fold behavior. Layout supplies geometry/dirty-state reconciliation. No participant independently starts or ends the global startup.
- One pure timing source is built into both the HTML Lab and existing startup runtime entry. Prefer fixed real slots and safely composed visual properties for Bloom; use proxy fallback only if measured necessary. Existing Sine script names remain unchanged.
- Prepare before revealing, bind to a single document timeline epoch, then atomically seal/reconcile/release. Cancellation and timeout use the same idempotent cleanup. No input starvation or unbounded startup wait. Native pre-injection flash is separate.

### Diagnostic terminal ownership (A1.10)

Layout owns its cleanup and native preference lease. Diagnostics claims that specific generation's cleanup callback, quiesces sampling on a real chrome-window unload and delegates to the same owner; completion is explicit after the terminal Layout event and lease release. A filtered, idempotent native Layout listener covers absent/forced-disposed Diagnostics. Partial-init Sine fallback has no required Layout owner. The final microtask is not a guarantee for independent late listeners. See [Diagnostics](diagnostics.md) and [Pipeline](pipeline-0.4.0.md).

### A2 — Native Workspace command ownership

The Layout-inlined workspace-commands module owns Nocturne-origin command admission, not native workspace data. Its window lease reuses the existing transition gate; data mutations additionally acquire a primitive process token on BrowserWindowTracker. WorkspaceTransition is a presentation consumer of the same lease, not another managed native queue. Home, Hub, Free and projection use the shared command boundary; native structural outcome must be verified before incoming success motion. Pending native operations never release due only to a visual watchdog; competing managed commands fail busy. Native external mutations and asynchronous peer propagation remain authoritative and are not wrapped. See [Pipeline](pipeline-0.4.0.md) for partial-result and pending-state gates.

### A2 — Destructive Workspace data reconciliation

The existing workspace-commands module compares authoritative native tab identity with physical normal/pinned container membership before and after destructive commands. Hub holds the same data lease across transfer/delete/purge; the journal is transient counts, not another tab store. No destructive rollback, no stale approval retry and no native removeWorkspace call before a freshly reconciled empty source. Transfer metadata follows confirmed physical movement. See [Pipeline](pipeline-0.4.0.md) and [Validation](validation.md) for evidence and unresolved native/pending-state gates.

### A2.6a — Projection startup ownership (preview.69)
Readiness now resolves only the exact current child Workspace manager; obsolete promise fulfillment/rejection cannot certify a replacement. Partial observer registration rolls back. The startup empty-selection guard releases its exact old manager wrapper on replacement; stale wrappers delegate to their own original native method and never record tabs. The opener captures the exact projection marker and source manager; automatic switching/search require current source/child identity, sync eligibility and target presence. Cleanup is best effort per listener. No geometry/animation timing changes. Destructive startup-tab cleanup, Return peer verification, placement in-flight takeover and A2.7 pending recovery remain open. No claim of complete A2.6 or native PASS.

### A2.6b — Projection native data safety (preview.70)
Zen 1.24.2b `ZenWindowSync.sys.mjs` uses a private queued event context for TabClose (not INSTANT_EVENTS); `on_TabClose` resolves the peer by ID when processed and calls native removeTab. `getItemFromWindow` is a DOM-ID lookup, not a liveness or data guarantee. `SSWindowClosing` is an instant native event that delegates live-docshell transfer. ZenSpaceManager itself removes initial empty startup tabs and emits AfterWorkspacesSessionRestore. There is no verified public local-only/atomic close contract for Nocturne's synced startup cleanup.
Keep the single existing window command lease through switch and exact native empty-placeholder selection, recheck source/child manager, browser and sync identity. Remove mod-origin residual startup-tab deletion entirely; let Zen own cleanup. If native leaves an ordinary startup tab, preserve it instead of risking a queued destructive peer close. Search retries require the same exact placeholder and revalidate after synchronous search before OpenLocation. Return checks ready synced managers, current browser identities, refreshed native allStoredTabs, unique IDs, connected nonclosing native tabs and exact native DOM-ID lookup, matching workspace/pin/container/Essentials attributes. Extra unlisted child tabs fail closed. Return acquires existing shared data lease and rejects concurrent source commands; uses native window close only, never tab deletion. Native close is a request, not a certified close or atomic peer handoff; asynchronous native external changes and a destroyed realm stranding the primitive token remain limitations. Placement already has trusted-input listeners both before startup and during native geometry retries; shared placement reentrancy/teardown review remains open. No geometry/timing change. Native acceptance deferred.

### A2.6c — Projection and detach placement lifecycle (preview.71)
Preview.70 pinned HEAD `db3be426c83e3cb7a53164388f8b3c75ab2a16ca`, [CI 44247288463](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44247288463) PASS. Independent execution-path review: startup placement observers, timers and input listener handoff were not owned by Layout scope. A partial observer registration could reject without cleanup, and source teardown during a pending startup/geometry delay could leave an unresolved continuation. Projection native readiness and the temporary empty-tab guard were similarly tied to eventual completion rather than Hub teardown.
One placement scope per actual newly opened window, registered under existing Layout mountScope. Keep the same trusted-input and close observers from startup through bounded native retry; cancellation settles owned delay promises and disables later geometry requests. Register cleanup before observer acquisition, arm only after acquisition, attempt exact release on partial failure. Preserve the startup deadline, existing settle/retry intervals and geometry algorithms, and keep native window/tab intact. Recheck ownership after reentrant native size/restore/maximize operations, before subsequent geometry mutations. Projection uses a child DisposableScope under Hub for input and startup capture listeners, exact native empty guard and readiness observer lifetime. Trusted input disposes this scope and immediately rejects unresolved readiness; it cannot cancel a native Workspace switch already in progress. No native mutation is replayed or unlocked by this cancellation.
15 focused extracted-source fixtures PASS (4 new, 11 existing), all 11 versioned runtime bodies parse; canonical CI pending. Native Windows monitor/DPI, startup window and synced Return acceptance remain deferred. A2.7 next: separate presentation pending state from unresolved native leases, including process token stranded by destroyed realm; do not release a live native data lease on timeout. A2-R still required.

### Independent A2.6 review — preview.72

Independent A2.6 review: capture the prepared placeholder under the existing command boundary, keep its identity through asynchronous placement, and scope automatic search waits to Projection. No new lifecycle owner or native data store. A2.7 command concurrency/recovery and A2-R native verification remain open.

### A2.7a — Workspace command presentation and Return peer reservation (preview.73)
Parallel preview.72 pinned HEAD `ee4ec7e1d566a913df85e026c9f18aa351705d0f`, [CI 44249720435](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44249720435) PASS; preview.71 CI 44248000241 PASS. A2.6 independent search corrections retained. NC4-041: the prior data token excluded concurrent data mutations but not a managed selection in Return's surviving source; both Home and Hub also lacked a shared slow/unknown command presentation.
Reserve the exact source gate with a primitive token under the existing Return data lease before callbacks; verify both managers and the reservation before invoking the native close request. Compatibility WorkspaceTransition honors this reservation. Unrelated third-window selection remains independent. The reservation and process token are released only on exact owned command settlement, never on a UI timer. Native external commands and asynchronous close effects are not serialized by this mod boundary. Existing gate provides monotonic elapsed time, bounded pending/unknown presentation and a change event. Home and Hub observe it while open with one deadline timer per visible view, clear timers on close/disposal, and show unknown after five seconds without changing native ownership. Hub can yield the overlay without waiting for command settlement when not dragging; existing manual close remains valid. No animation timings or native prefs changed.
18/18 focused extracted-source fixtures PASS (17 core, one compatibility transition), six new permanent regressions, 11 versioned runtime bodies parse. Canonical CI pending. A2.7b remains: opener-side Projection waiting on a child gate, process data token stranded by destroyed realm (no proven safe automatic release), late Hub UI session completion, native close request vs final close observation and integrated recovery tests. Full restart remains conservative recovery for an indefinitely unresolved native command; do not assume native close is synchronous or that dropping a lease is safe. Native acceptance deferred.

### A2.7b — Native close completion, bounded presentation and late view settlement (preview.74)
Preview.73 pinned HEAD `39499aa53363ea2a2c3fb787ddd2ad4fbe52d4b8`, [CI 44251578110](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44251578110) PASS. Independent review against Firefox `FIREFOX_160_0_RELEASE`: `browser/base/content/browser-commands.js` tryToCloseWindow synchronously calls WindowIsClosing and window.close; `dom/base/nsGlobalWindowOuter.cpp` FinalClose sets closed before posting ReallyCloseWindow. `xpfe/appshell/AppWindow.cpp` Destroy unregisters the window (via nsAppShellService and nsWindowWatcher, emitting domwindowclosed), destroys docshell, detaches exact chrome BrowsingContext and only then emits xul-window-destroyed; `docshell/base/BrowsingContext.cpp` Detach sets isDiscarded. SessionStore handles domwindowclosed and synchronously emits SSWindowClosing. Zen 1.24.2b ZenWindowSync.sys.mjs moves visible tab docshells in that handler into first surviving candidate from BrowserWindowTracker.orderedWindows, NOT necessarily the projection marker's source; subsequent tab state flush is separate. Native Zen #inChangingWorkspace clears after awaited UI update, so UI update alone may leave a stale visual busy flag.
Return uses the existing source gate's exact generation-owned endpoint, executing the native close request from the surviving source realm under the same process data lease and a child reservation. Fail closed unless source is the only eligible survivor (including conservative rejection of unknown third-window readiness) and tab identities are verified. Native close uses BrowserCommands.tryToCloseWindow with no synthesized trusted event. Hold command through exact child domwindowclosed plus captured chrome BrowsingContext.isDiscarded; source realm owns both observers. Native veto settles as not-closed; partial observer acquisition blocks invocation. A source close during unresolved Return removes observers but preserves token because completion cannot be certified. Source reload only replaces the endpoint, not the in-flight command. No native close persistence/flush guarantee or atomic exclusion of externally initiated native changes; third windows may still open during native dialogs. Opener view observes its existing projection pending phase with the shared deadline; real child close, trusted input or scope disposal cancels only waiting and automatic setup, never releases a running child native gate. Native-only busy view uses at most one 250ms timer during a bounded 5s visible interval; controls remain retryable and actual admission rejects native busy. Late Hub results are scoped to opening session; reconcile native data without clearing a new draft/edit/status. Roll back exact partially published leases on admission failure; process data contention explains restart recovery.
32 distinct focused fixtures PASS (19 core, 12 projection data/close, one Hub late-create), 10 new permanent regressions; 11 versioned runtime bodies parse. Full canonical CI pending. Remaining A2-R: integrated admission, physical peer ownership and native external reentrancy verification; check native Windows/Zen Return teardown and actual observer ordering before acceptance. No safe automatic global unlock for genuinely unresolved native mutations, especially when all relevant owners close. Full restart is the conservative recovery; this is not a claim that restart rolls back native data. Native acceptance deferred per user.

### A2-R1 — Integrated native command admission and ownership audit (preview.75)
Preview.74 pinned HEAD `956388ffa84fe1afa7f411e9a9007d2c9fd5391b`, [CI 44253540354](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44253540354) PASS. Integrated source review of NC4-007/008/009/010/033/034/035/040/041: Layout activation waited unboundedly for Free startup; peer admission could overwrite a command synchronously admitted during a getter; Return used fresh native cache and IDs without independent physical container/group reconciliation; destructive workspace ownership did not check pin-role membership or an off-container fake cached placeholder. Zen 1.24.2b ZenSpaceManager `allStoredTabs` traverses workspace normal/pinned and Essentials sections plus native group/glance children. `removeWorkspace` closes native owned tabs before propagating workspace data. Gecko FinalClose flag precedes unregister.
Bound the optional Free startup wait to five seconds (normal path unchanged), fence subsequent automatic actions on deadline or Layout cleanup, keep native lease until actual settlement. Recheck exact command gates at admission and after callbacks; verify exact pending promise and preserve foreign owners on release. Independently scan physical workspace/Essentials containers for Return, require exact cache identity, pin/workspace role, group identity, split/glance metadata; reject unsupported or inconsistent topology without invoking close. Strengthen destructive membership and reject any other registered window including closed-but-not-unregistered. Scope Trash readiness-only delay to existing Hub lifecycle, not the native command. Nine new regression fixtures; 67/67 focused actual source fixtures (core, Free startup, Projection, workspace data) PASS in isolated JS harness. No timing change to normal animations, no native mutation retry, no new data store.
A2-R1 source corrections implemented; full CI pending. A2-R2 remaining: independent review of startup fallback, actual native physical topology (especially grouped, nested glance and container-specific Essentials; conservative rejection is not a native failure claim), cross-window Return and external native confirmation/flush; review admission/UI integration and document final A2 disposition before A3. Native acceptance remains deferred. Native promise stranding after destruction still cannot safely be auto-unlocked; restart remains recovery. This audit does not prove data loss or validate actual Zen behavior.

### A2-R2 — Native topology, transfer preflight and final source audit (preview.76)
Preview.75 pinned HEAD `6768daaaf6cec155b05dba8af7d1f2897429d8e1`, [CI 44254574976](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44254574976) PASS. Re-read AGENTS and actual execution paths; compare Zen 1.24.2b `ZenSpaceManager.mjs` (getEssentialsSection, _shouldShowTab, _handleTabSelection, allStoredTabs, #organizeTabsToWorkspaceSections), `ZenPinnedTabManager.mjs` (addToEssentials), `ZenGlanceManager.mjs` (#configureNewTab), `tabgroup-mjs.patch` (nested folders), `ZenWindowSync.sys.mjs` (#canSwapBrowsers, #moveAllActiveTabsToOtherWindowsForClose, #syncItemPosition). Native selection visibility alone does not certify a nested Glance parent's workspace; actual Essentials section has a container attribute; native top-level group placement uses outermost group's pin role; active docshell transfer is skipped for missing linked browser or differing remoteness. Previous Return omitted these facts. Source findings and mock regressions, not observed live data loss.
Verify selected Glance via exact parent identity and matching glance ID, then its physical workspace/Essentials section. Read the existing Essentials sections, never create one through native getEssentialsSection during inspection. Verify Return nested native group ancestry/IDs and outermost pin role, exact tab document, active linked browsers and boolean remoteness. Fail closed on any Glance topology in either window and duplicate active ownership; do not promise native transfer or persistence success. Free startup observes trusted input only during its existing bounded wait, uses DisposableScope, cancels automatic follow-up but not started native mutation. Projection passes its takeover predicate to existing placement owner; input listeners precede observer acquisition and target validity is rechecked before reporting placement success. Return cleans partial observer acquisition even on source close. Nine new permanent regressions; 86/86 focused extracted-source fixtures PASS (75 core/Free/Projection/data and 11 display startup). No native API override or new timing/visual algorithm.
A2 source implementation and independent integrated audit complete at R2, subject to canonical CI. Native acceptance NOT passed: retain A2 runtime gates for actual Windows/Zen Sine, beforeunload/OS close, multi-monitor, group/Glance/Essentials, session flush, slow native switch and externally initiated native operations. Return refuses active/retained Glance in either window (native skips Glance position sync); use normal native close if unsupported. Unknown command still fail-closed until true settlement; restart only as conservative recovery. Native modal loops may permit external changes after preflight, and source survival, transfer and async persistence cannot be certified atomically by Nocturne. Do not intercept native close globally to simulate an atomic transaction. A3 source architecture work may proceed per explicitly deferred native gates; broad visual cutover still subject to its own acceptance. Preserve native command lease through motion watchdog. Next A3.1 inventory exact surface/property owners and existing MB work before making any runtime changes.

### A3.2a — Bookmark fold lifecycle ownership

Center Motion owns one exact bookmark-fold handle per window and restores the prior inline CSS value, priority and marker only for the current lease. Supersession and replacement cancel the old effect before capturing a new baseline; acquisition failure rolls back. Existing close-seal retention is explicitly restricted to close-owned handles, reclaimed on replacement. Magnetic Bookmarks observes existing phase markers and suspends normal hover. The shared tab proxy acquisition and wider motion transaction remain in A3.2b/A3.3; see [pipeline](pipeline-0.4.0.md). No change to native workspace admission or normal animation timing.

### Independent A2 follow-up — preview.79

Preview.79 independent review extends the existing Workspace command contract: selected item must be in exactly the expected native container (outermost group role if grouped), and the peer reservation must belong to the actual current peer gate after the final native busy check. Zen remains sole native data owner.

### A3.2-R preflight contract

Closing sets its existing phase and synchronizes Magnetic Bookmarks before collecting target rectangles; acquisition failure uses the existing native-only bypass. Workspace phase already suspends before geometry lock. Startup rechecks suspension before resting contour preflight; the existing Magnetic Bookmarks controller coalesces preference changes until its last suspension phase clears. No new owner. Older shared Refined registry first-owner compatibility remains a native/mixed-install gate. Startup structural readiness, common timeline and topology reconciliation remain in A3.3–A3.6.

### A3.3a Assembly effect ownership

Direct WAAPI acquisition registers the exact animation and completion before pause. Failed acquisition cancels its effect, and external cancellation restores that record only. Assembly captures one Center Motion generation at launch; fold acquisition temporarily admits nodes into the existing managed set, and failure restores fallback eligibility. This is an incremental MB1/2 change; Boot adoption, readiness ownership and Home structural lease remain in A3.3b. Existing approved timing and native operations unchanged.

### A3.3b1 Boot / Assembly / Home

Prelude owns the exact early cover and its marker baselines until adoption; Assembly owns adopted node and markers thereafter. Native readiness RAFs are captured and cancelled by Assembly. Shared Home startup lease is attached to the existing exact timeline, not a separate global controller; Home render invalidates old animated children, and Assembly closes the timeline before releasing the lease. Legacy registry compatibility is additive and remains an explicit test gate. No approved visual/timing changes.

### A3.3b2 bounded readiness and Home structure

The existing Layout startup record publishes the Home trigger's readiness outcome. Assembly owns the launch boundary and observes this state with its existing icon budget. The Home lease defers passive structural refresh, not native user input or authoritative data. The existing sampler tracks local row/engine/Home identity and tab/card/image topology; no permanent polling or new controller. Remaining MB1/2 absolute watchdog and mixed-runtime acceptance plus MB6 geometry handoff remain explicit gates.

### A3.3-R absolute deadline contract

Prelude owns the initial cover and absolute expiry until adoption, then Assembly owns the inherited deadline. Its existing finish timer is rearmed for earlier completion but never beyond that deadline; stale callbacks are fenced. Center Motion's independent orphan guard is bounded to the available deadline. Full timeline/outcome consolidation and topology handoff remain A3.4/A3.6. Native compatibility and paintability are not established by source tests.

### A3.4a — startup timing plan

The generated Startup Animation entrypoint consumes the pure startup timing plan; admission and late reveal use one bounded completion budget. The controller still owns its mutable runtime epoch, effects and exact Home lease. Document timeline synchronization, completion outcome, Address Cascade and Lab parity remain open.

### A3.4b — document epoch

Assembly owns one finite document timeline epoch and supplies an exact startEffect callback to prepared direct, tab, bookmark and Home effects. Legacy handles without resumeAt retain their previous resume behavior; all native data owners and Fold geometry remain unchanged. Performance time bounds the watchdog; document time selects effect stage. The terminal outcome and Address Cascade remain A3.4c.

### A3.4c1 — Address completion ownership

Address phase captures the native bar and document epoch; cascade belongs to the phase generation, not direction alone. Exact phase and cascade watchdogs bound pending WAAPI and handoff, cancellation clears references before releasing resources, and replaced bars cannot be dismissed by stale callbacks. Startup terminal outcome is a separate pending checkpoint.

### A3.4c2 — common Startup outcome

Assembly's existing timeline owns the exact effect ledger and single completion timer. Current direct, tab, bookmark and Home effects distinguish completion, retirement and unexpected cancellation. The nominal boundary closes admission; at most one capped 120ms grace interval can wait for remaining effects, with no extra scheduler. Current Home retains the lease until common release, except explicit native action or interruption. Workspace/Close and legacy contracts are unchanged. Integrated review and native acceptance pending.

### A3.4-R — audited completion and replacement boundaries

Capture terminal ledger before invalidating ownership. Retained effects observe cancel events as well as the initial finished promise; exact owner capability distinguishes legacy epoch-only consumers. Interruptions release instead of resealing; late admission stops after synchronous cleanup. Address geometry interruption and cleanup retain exact bar identity. No added polling or parallel Startup timer.

### A3.5a — shared visual math and candidate comparison

Fold math moved intact to a pure factory shared by Layout and the generated offline Lab. Bloom candidate is a separate pure algorithm in the Lab only; the existing startup timing/outcome remains production authority. Real-slot Bloom must use the same Center Motion/Assembly owner, not a second controller. Existing important scale/translate and opacity gates need an exact visual-mode property contract and native computed-style preflight before promotion.


### A3.5b — real-slot candidate boundary (preview.92)

The current Center Motion owner now contains a dormant real-slot tab acquisition mode. The same handle owns cancellation, outcome and release, with explicit paused Assembly identity and full-plan budget admission. The Fold gate and Bloom visual marker are distinct; default production callers remain Fold. No second controller or new Sine entrypoint. Full Startup timing, Home/Boot integration, native compositing and geometry reconciliation remain subsequent gates.


### A3.5c1 — common Bloom timing and Home lease (preview.94)

The pure timing selector and Home stage schedule now share candidate timing with Lab; Home's existing exact lease owns real leaf effects. Fold remains default. Bloom uses a visible post-Boot epoch with a consistent normal/late budget, subject to inherited watchdog; actual full candidate Assembly admission and Boot handoff remain subsequent work. Provisional mapping does not reproduce the lost Lab's splash overlap.


### A3.5c2 — coordinated dormant Assembly path (preview.95)

One Startup controller, one document epoch, one outcome ledger and existing structural leases. Explicit source switch remains disabled; selector checks cold horizontal startup, versioned owners, registration and inherited budget. Center acquires resting geometry before the Island shape; direct chrome effects use existing registered progress, batch preparation index and cleanup. Provisional post-Boot mapping, no late Bloom replay. Independent integration review and A3.6 geometry before activation.


### A3.5c-R — prepared effect cohort (preview.96)

The one Assembly outcome ledger now freezes live candidate membership before Boot hold and validates it immediately before the document epoch. Admission closes independently of the outcome ledger. Late Home rests, changed candidate aborts and interruption retires all surfaces. No new lifecycle owner. Fold remains default; topology/geometry reconciliation follows.


### A3.6a — topology contract (preview.97)

Native Zen tab order/membership remains authoritative. Strip sync publishes the last completed projection signature and exposes an exact read-only validator for the row and mirrored nodes/parents. Center Motion verifies the contract at acquisition and resume; scheduled sync invalidates stale Startup/Workspace visuals and reconciles changed topology at release. Workspace native commands remain single-owned. Explicit close keeps its native lifecycle. Geometry, lane scroll and terminal visual parity are separate next gates; Bloom disabled.


### A3.6b1 — resting geometry lease (preview.98)

Layout owns the read-only resting slot metrics and Center Motion holds the lease alongside native topology. Existing resize/scroll callbacks and transaction boundaries validate it; changed geometry releases existing visuals and reconciles through the current handoff. No separate observer, scheduler or owner. Real painted proxy alignment and native evidence remain open.


### A3.6b2 — mounted coordinate and terminal guard (preview.99)

Center Motion owns the coordinate mapping and validates the actual mounted Fold layer against Layout's resting projection. Correct host origin; reject unsafe transforms, partial clipping and mismatch; verify the finished incoming pose before the existing handoff. Layout remains the geometry owner. No new scheduler. Post-release phase changes and actual Gecko paint remain pending.


### A3.6-R — audited ownership and handoff (preview.100)

Claim the existing Center Motion lock before any release validation and guard recursive invalidation. Layout owns geometry, including mode flags and existing split-slot/compact callbacks. The existing two-frame handoff supplies one lazy post-cleanup resting geometry sample; no new owner, observer or frame loop. Native visual/performance acceptance stays open; A4 will consolidate resting geometry and contour ownership.


### A4.1 — Shared contour geometry (preview.101)

Existing contour algorithm now owns pure preferences, visible and stable envelope geometry, deterministic cache key and SVG generation. Layout consumes visible policy and commits its cache after successful render/write, rolling back partial CSS values. Magnetic Bookmarks still owns its legacy stable override until an exact provider lease and explicit selection policy are implemented. Distinct envelope policies are preserved; one renderer is the target, not yet the production state. Native geometry/hit-region and performance gates remain open.


## Active scope correction — 2026-11-19

Nocturne is the only supported installed package. The separate legacy Zen Refined mod has been removed from the development setup; concurrent installation, Refined-first registry ownership, and maintaining standalone Refined runtime compatibility are no longer development or acceptance requirements. Earlier references to coexistence gates are historical and superseded. Preserve imported features, existing preference keys and native data, source provenance and safe lifecycle ownership within Nocturne. Sine entrypoint order, hot reload, disable/unload, missing/partial entrypoints, and multi-window remain mandatory. Do not silently remove another installed mod or claim coexistence support.

For A4.2, use a single Layout-owned renderer with Magnetic Bookmarks as an internal geometry provider. Remove Refined-only coexistence obligations, not imported functionality or Nocturne lifecycle/visual acceptance. Previous migration and audit records remain historical evidence.


### A4.2 — Single contour renderer (preview.102)

Layout alone renders and commits the toolbar mask using two geometry policies. Magnetic Bookmarks provides the resting envelope and readiness/hold/off contract; exact controller validity protects against stale reads. The redundant renderer, CSS override and its scheduling are removed. Internal Sine lifecycle is still guarded; native parity remains open.


### A4.2-R — contour ownership audit (preview.103)

Revision-2 bookmark registry fences installation and final release, retires recognized old in-package leases, and rejects stale owners. Layout uses live phase and provider identity, reuses a clean stable prehover revision and retains sole renderer/cache ownership. Hidden shelves select visible fallback. Native validation remains open; A4.3 coordinates geometry.


### A4.3a — height and contour scheduling (preview.104)

One Layout geometry RAF owns dirty height/contour passes. Reuse a pass-local resting row snapshot only if no wrapper-height write intervenes; explicit force preflight remains synchronous. Stable bookmark provider can consume the exact toolbar rectangle. Synchronous centering, active feature animations and native geometry leases remain distinct. Further read/compute/write consolidation and native evidence pending.


### A4.3b — coordinator audit (preview.105)

CENTER/HEIGHT/CONTOUR requests share one ticketed scheduler. Successful direct native centering requests only height/contour unless CENTER is already pending. Reentry is rejected rather than nested; forced pass preserves new dirty bits. Height is validated/read back before acknowledgement. Address extent is reused only within the same read/write pass and reread after actual geometry writes. Native convergence and explicit preflight outcome integration remain open.


A4.3c1: Layout geometryPreflightVersion 1 acknowledges only successful synchronous center/height/contour preparation. Startup and Workspace consume that result and fail open through their own cleanup, retaining native command ownership. Older entrypoints with a callable preflight may return undefined; this is legacy compatibility, not verified geometry.


A4.3c2 (preview.107): existing pure toolbar-center module owns pass-local collapsed budget and partition dimensions; Layout applies the plan before fresh actual geometry/anchor reads and rejects stale order/viewport/phase outcomes. Strict preflight rejects partial drag/cascade centering. Tab projection reuses the native topology snapshot for group/selection/pin state; physical Split measurements stay with existing DOM owners. Native convergence remains open.


A4.3-R (preview.108): force geometry is fenced against projection/contour reentry, stale native/mirror topology and phase transitions. Rejected force restores queued dirty work; actual height and contour reject stale revision handoffs. Lane moves use a single captured projection plan, with live ownership checks; tab sync uses one exact RAF identity and defers reentry. Existing native animation owners and physical measurements remain separate.


A4.4a (preview.109): shared live resting gate holds center/height/contour, mirror topology and ordinary scroll during drag/live reorder/lane/magnetic pull and transitional address cascade; hidden phase and existing release paths replay projection/geometry. Feature-owned Bunny/Split measurement and lane autoscroll remain active. Native destination is validated against the live topology before drop. This is a resting-write contract, not a guarantee that native resize/CSS cannot change physical slots; native hit regions remain A4.4b.


A4.4b (preview.110): native drag region is independent of the contour mask. The resting Home toolbar wrapper and existing spacers/lane gaps own bounded native drag; actual controls subtract, decorative contour stays default/pointer-none. Gecko 160 display-list region union/subtraction is based on conservatively clipped frame border boxes, not alpha. Compact hidden handles are default; motion suppresses non-client drag on owned slots. Address shield and Split Drop own content input only in their active phase; split rejects stale/outside points before native commands. Local drag captures viewport coordinates and retires on size/DPI/mode change. Rear fade is visual only, not a native handle. No native movement synthesis or new hit layer. Point-level native validation and A4.4-R remain open.


A4.4-R1 (preview.111): incoming tab preview holds one destination-local lease over exact source controller/token and viewport. Invalidating releases existing visual state; a fresh trusted dragover must re-admit before drop. Source completion/cancel clears only matching previews, excluding the destination currently committing. Native DataTransfer identity and actual commit remain A5, not inferred from the preview token.


A4.4-R2 (preview.112): one Layout-native tab input policy gates strip, Split Drop, source dragend, foreign preview and toolbar return during Center/Startup/Workspace/Close and address ownership. Native edge-control horizontal geometry is a gesture-local immutable snapshot, not a second geometry controller. Existing resize/mutation delivery and final native commits validate it; moving tab lanes are intentionally excluded. Full Gecko non-client hit-region acceptance remains separate.


A5.1a (preview.113): native drag fallback is a strict admission check, not a second session store. The only admissible protected dragover source is a unique existing browser-window controller with live native tab and valid source lifecycle token; explicit trusted Gecko DataTransfer payload remains primary. No protected-mode guess on concurrent owners. Native OS session identity and commit confirmation remain separate A5 contracts.


A5.1b1 (preview.114): Zen's current native tab/group order and live Split membership are the only synchronous postconditions for a delivered custom tab drop; the Layout mirror is not used to infer native success. Delivered drop consumption and verified native mutation are deliberately separate signals. The existing drag controller retires the exact active source regardless of rejected native command, avoiding an accidental secondary detach; no rollback/second reorder or OS session identity is synthesized.


A5.2a (preview.115): Split Drop performs one synchronous native eligibility preflight before selection and one owner/native-partner validation after selection, then calls Zen's existing `gZenViewSplitter.splitTabs/removeTabFromGroup` only for a still-owned gesture. Source identity, native group membership and selected-tab state remain owned by Zen/Gecko; no source-to-mirror transaction rollback. Every delivered Split drop is settled by the captured Drag Engine token, without clearing a newer synchronous gesture. Clone-prone pinned/Essentials/Glance combinations are rejected rather than reinterpreted as ordinary move.


A5.3a (preview.117): file transfer payloads now belong to the existing Library Services / Downloads service owner; Dock and Library remain gesture/UI consumers, with Dock owning only Bunny visuals and OS image handoff. The identity gate is the service's exact native Download record (or opaque Library ID); no second cached filesystem model. Both variants use real nsIFile plus native URI and completed-file checks synchronously. The deliberate private distinction is preserved: native Dock is allowed for its own private list, Library is not. Native OS copy/move and accepted visual choreography unchanged; actual OS handoff remains a native validation gate.


A5.4a (preview.118): the only production display snap/desktop coordinate policy is the existing `src/algorithms/display-placement.mjs` consumed through `src/interactions/display-engine.js.part`; Hub workspace pointer releases and tab Bunny share `placementAt`, rather than their own snap implementations. Unused legacy `hubSnapRect`/`hubOtherDisplay` were retired. `displayPreviewKey` describes *presentation* identity based on authoritative full monitor, work area and target rect (plus mode/label), not another placement decision. The compact XUL popup reanchors when native work-area changes shift its CSS screen location, even on one monitor. Actual Gecko/OS coordinate equivalence and native acceptance remain separate; no new state owner or animation driver.
