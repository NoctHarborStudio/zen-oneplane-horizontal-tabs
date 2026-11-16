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

## 0.2.0-preview.39 — recommended pins

Add Pin is available only in Customize. The portable core reads native Places toolbar bookmark nodes in display order, then visible native tabs ordered by last activity. Exact normalized URLs are deduplicated and already pinned URLs omitted; HTTP(S) only, up to 16 suggestions. No history query, remote suggestions, or external icon fetch. Clicking a suggestion saves its title and URL immediately while retaining the picker. Manual URL entry is optional and falls back to the domain as title. Escape closes the picker before leaving customization. Search styling is deferred. Test actual Places toolbar node data, pending tabs, multiple pins, duplicate filtering, persistence, and narrow layouts in Zen.

## 0.2.0-preview.42 — Compact Add Pin

Add Pin is a dedicated substate of Customize. It replaces the search and existing pinned grid with a compact recommendation picker, displays at most three cards per page, retains Workspaces and one footer Done. Page index clamps after additions; custom URL form replaces recommendations rather than expanding the page. Done returns to Customize, Escape returns from custom form to recommendations first. Existing pin data remains unchanged. Verify short/portrait windows and real browser focus.

## 0.2.0-preview.43 — Home as primary destination

Home trigger calls show(); legacy toggle is also idempotent. Plain Escape returns focus to search (picker/customization Escape retain their own behavior). Ordinary empty native tabs present Home instead of an empty background. Pending/discarded/busy tabs are not mistaken for placeholders. Real selected page navigation still exits; background TabOpen does not dismiss Home. Native projection startup, private windows, fullscreen/customization and last-lease teardown retain existing paths. No additional tabs or session mutation. Runtime validation pending.

## 0.2.0-preview.44 — Scrollable Add Pin

The compact picker now mounts the bounded recommendation list (up to 16), uses native vertical overflow with a fixed two-row viewport, and removes pagination controls. Three columns on wide windows, two on narrow windows and one at very narrow widths. Row height reduces on short windows. Only the recommendation grid scrolls; the picker controls, Workspaces and Done remain outside it. Store scroll offset before preference-driven rendering, clamp/restore after attaching the new grid, and reset when exiting the picker. Motion runs on mode transitions, not on every pin update; card hover/press transitions honor reduced motion. Test actual scrolling, focus, and compact geometry in Zen.
