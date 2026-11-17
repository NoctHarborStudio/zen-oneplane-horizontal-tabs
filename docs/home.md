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

## 0.2.0-preview.45 — native window dragging

Blank Home background is a native Gecko window-drag region. Home content and controls retain no-drag semantics. Toolbar gaps are actual draggable areas, not 1px pointer-transparent spacers. No JavaScript window dragging or changes to the Home state machine.

## 0.2.0-preview.46 — Home search surface and icon quality

Home-origin floating search now uses a scoped root glass surface with one border and radius, aligned to the source field (clamped to leave viewport space for results). Native background child and view backgrounds are transparent; native scale/translate/clip are neutralized only in this session. The old clipped morph is replaced with a measured actual-height reveal. Source content is hidden before opening; cancellation restores Home and removes the session attributes and geometry properties. Resize remeasures the hidden source without restarting the animation. Smart Search remains a native provider. Higher-resolution Places page-icon requests are sized for the card and DPR, with an embedded Steam SVG from Simple Icons (CC0) for Steam-owned domains. No pin data migration. Test actual glass rendering, corners, results height, resize, light theme, reduced motion/transparency, native cancel and non-Home search in Zen.

## 0.2.0-preview.47 — Search motion and Gmail fallback

Hold the native bar at the Home header height until a real native results height is measurable. A bounded requestAnimationFrame driver writes height and result opacity without per-frame layout reads; natural height is measured before and at the end of the reveal, with up to two correction rounds for asynchronous results. Escape and captured Home background pointerdown reverse the actual native box before calling Zen's session cancel handler. Native blur/popover dismissal may happen before the mod can animate the real editor; a noninteractive temporary header-only glass shell folds back into Home in that case. Result selection/tab switching still leaves Home immediately. Clear owned motion state, temporary shell and geometry on close/unload/resize. Respect reduced motion/transparency. Gmail uses a local SVG for mail.google.com/gmail.com; other icons fall back from sized cached URI to original cached URI, then an embedded generic icon. No remote fetching. Test typed searches, Escape, outside clicks, rapid reopen, results selection, other search modes and both mods in actual Zen.

## 0.2.0-preview.49 — toolbar-only window dragging

Supersedes the preview.45 blank-background drag behavior: the entire Home panel and its descendants are explicitly no-drag. Dedicated native toolbar gaps retain Gecko window dragging; tab drag, search and pin/workspace interactions remain unchanged. Verify blank-space clicks and drags, outside-search cancellation, toolbar drag, maximize/restore and mixed DPI in Zen on Windows. The separately reported early SearchService engagement warning remains open.

## 0.2.0-preview.50 — continuous search handoff

The closed Home field, native editor and cancellation fallback share CSS tokens for glass, border, radius, typography, label and icon size. The original header remains visible until the native floating editor is ready, then the two visibility states switch together. Home sections fade without changing layout. The search geometry preserves the source top rather than reserving an arbitrary 460px by moving the field upward; results scroll within remaining viewport bounds. Height uses smoothstep easing (560ms reveal, 460ms collapse), with no fade-out of the returning header. Native search mode controls are retained; the default new-tab identity icon is replaced by the shared search glyph. Restore the temporary input placeholder only if still owned by Home. Pin/workspace redraws do not replace the source during an active session. Validate actual placeholder/icon alignment, empty/full results, Escape/outside click, rapid interaction, light mode and short windows in Zen; native blur may still require the noninteractive return shell.

## 0.2.0-preview.54 — drag from the toolbar Fade

Gecko unions native drag rectangles and subtracts every explicit no-drag rectangle even when visually overlapping. The preview.49 full Home rectangle therefore suppressed the toolbar. The Home background and its noninteractive descendants use default (neutral); controls explicitly exclude their own rectangles. The existing measured Unified Contour surface contributes the native drag region only with Home held open and search inactive, while remaining pointer-transparent for normal DOM interaction. Toolbar structural boxes are neutral, existing tab/button exclusions and native gaps remain. No drag over blank Home outside the surface, no synthetic window move. Test the Fade edge, toolbar gaps, blank Home, Home controls, search dismissal, two-row mode, maximize/restore and mixed DPI in actual Zen.

## 0.2.0-preview.56 — continuous close

A short-lived detached visual copy of the native result view is refreshed after result mutations and before outside click or explicit cancellation. It copies computed layout and pseudo-label/rail styles into inert HTML nodes, not native custom elements or interactive result IDs. The same 460ms return layer is used for Escape and native blur; native selection/commands remain owned by Zen. Each Home section gets opacity based on its measured top and the moving bottom edge, with no layout reads in the animation tick. The return layer and snapshot are removed on finish/unload. Diagnostics [Zen Home] search close-start/close-finish include reason, row count and size only. If no snapshot can be obtained, the header-only fallback remains. Test result preservation, clipped scroll position, Escape, outside clicks, typed search, rapid navigation, reduced motion and resize in Zen.

## 0.2.0-preview.57 — progressive card return

Instead of waiting for the whole Pinned section's top, measure visible cards, headings, workspace buttons and footer once and reveal each from its exposed area as the search bottom edge moves upward. Cards on the same row share timing. A clipped top prevents overlap while opacity and a 6px vertical offset interpolate continuously to their resting state. The closing shell starts from the last native rectangle; unchanged result snapshots are reused, invalidated by result mutations, scrolling and resize. No layout reads in return ticks. The diagnostic close-finish includes elapsed and maxFrameGap in milliseconds; close-start includes part count and snapshot dirty state. No text or URLs logged. Test multiple pinned rows, empty Pinned, portrait, Escape/blur, and reduced motion in Zen.

## 0.2.0-preview.61 — stable collapse handoff

The native close event may run after Zen removes zen-newtab and Refined clears layout attributes. Capture only while the native new-tab view is still open; ignore identical attribute mutations and refresh before blur. Resolved CSS longhands preserve one-sided separators, background positioning, pseudo-elements and Gecko context SVG paint. Result dimensions are frozen as a border box. Home-only timeline rails use their final position rather than independent delayed travel animations; non-Home search is unchanged. close-start logs rows, rails, pseudos, snapshotAge, captureMs and handoffMs; close-finish logs firstFrameDelay and maxFrameGap, all timings in ms. No query text or URLs logged. Verify actual chrome rendering and first-frame continuity in Zen.

## 0.2.0-preview.62 — new-tab navigation guard

Automatic Home now requires either Zen's explicit zen-empty-tab marker or a settled, committed ordinary about:blank/newtab/home document (WindowGlobal isInitialDocument=false and matching document URI). Pending, discarded, busy, loading and typed-destination tabs are not placeholders. Selected-tab attribute and top-level network-stop events recheck a genuine blank page after commit. Native URL bar close with onSwitch or onElementPicked never requests Home; only an actual cancel on the same confirmed placeholder may restore it. Startup and explicit Home remain independent. No added timers or navigation interception. Verify Ctrl+T, plus, result selection, foreground/background links, unloaded tabs, actual empty workspaces and Escape on Windows Zen.
