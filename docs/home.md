# Shared Home — preview.33

OnePlane ships the first host of the portable v1 core in `src/home/shared-home.js.part`. Zen Refined will embed the identical source and call `acquireZenHome(window, Services)` with its own trigger. No second surface, duplicate preference, or runtime fetch. Window registry `__zenSharedHomeV1` owns DOM, observers and state; each host gets a releasable lease and open-state subscription. Last release restores the page and removes shared resources. Incompatible API fails closed. Future incompatible changes require migration, not independent controllers.

Home is a chrome surface in `zen-tabbox-wrapper`, not a tab. Native tabpanels remain mounted and temporarily invisible/inert. Native tab session data is untouched. Search delegates to native new-tab command; validated HTTP(S) shortcuts open via native navigation. Private windows excluded in v1. Native workspace data is read on render and switches via the native manager. Empty initial shortcuts are intentional; Customize is the only Add/remove/reorder entry. Profile-local preference `zen.home.shortcuts.v1` is shared across windows and future hosts. Icons use Gecko page-icon. Five-second idle title does not change width. Alternate mode reserves a 32px central icon where geometry permits. Existing narrow-window/native fallback remains unchanged (<900px or insufficient center room).

OnePlane adapter alone holds its Compact toolbar via `oneplane-home-hold`. Address cascade remains authoritative. Tab selection, navigation, new tab, Escape, native fullscreen and last lease release close Home. Workspace switch initiated by Home retains it where possible. Native media/focus/split/portrait require actual Zen testing.

## Validation
- Click title, same/different tab, Escape, repeated toggles; preserve tab identity and scroll.
- Add HTTP(S), reject privileged schemes, remove, drag/reorder, restart and two windows; no Add in ordinary mode.
- Native search, bookmarks, workspace switch, split view, Compact on/off, address cascade, reduced motion, unload/reload and fullscreen.
- Check alternate mode, crowded tabs, groups and narrow fallback.
- Refined port: both installation orders, two triggers, release either lease, release last lease, shared data and CSS, private isolation.

## Deferred
Search in place, auto-open on startup, widgets/folders, portrait-native trigger, and Extension Dock relocation. No extension change in this preview.

## Preview.34 — live feedback

Empty Pinned now points to Customize Home. The center search calls native `gZenUIManager.handleNewTab(false,false,"tab",true,token)` instead of closing Home first. Native search cancellation preserves the surface; matching `ZenURLBarClosed` with selection or native TabSelect/TabOpen closes it. Escape passes through while native search is active. The host adapter collapses the inline URL slot using independent `data-op-home`, preserves native floating search, and separates native selection from mirrored `data-selected`/split-active state. Indicator fallback has no selected-tab target on Home; hover/drag still work. Test search opening, Escape and outside cancellation, repeated sessions, selecting current/existing/new results, Home exit, both Compact states and split selection. Native runtime not verified by automated tests.

## Preview.36 — startup and search animation

OnePlane calls the optional shared `showOnStartup()` lease method after `OnePlane:StartupState` reports ready, following session/workspace restoration. Claim `__zenSharedHomeStartupV1` persists across mod reloads. Projected/private windows, unsupported narrow layout and reloads are excluded. No native startup preference changed; startup Home ends an existing native startup search through its close handler and ignores background location changes. Explicit tab selection and toolbar navigation still leave Home.

Home-origin search keeps the native floating bar and provider. Measure the source button and native target once, then run a 400ms WAAPI custom-property morph (translation, horizontal scale, bottom clip, opacity). Native positioning and result rows remain owned by Zen/Refined. Other search sessions untouched. Cancellation clears owned markers and restores Home; bounded observer fallback handles missing close events. Reduced motion bypasses the morph. Real Zen validation: startup with restored page/empty tab, both mods, Escape/outside click, rapid open/close, focus, result selection and portrait/Compact.

## 0.2.0-preview.38 — shared workspace motion

Home invokes the optional window-local `__zenRefinedWorkspaceTransition.run(nativeCallback)` when present. Without Refined, the native switch executes immediately. Keep the Home surface mounted throughout and update only the selected workspace's ARIA state; rebuild only if workspace identities/names changed. The host holds its Compact panel and freezes the contour mask during the transition. Search morph and startup claim are unchanged.
