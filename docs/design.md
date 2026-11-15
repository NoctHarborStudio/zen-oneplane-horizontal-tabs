# OnePlane: design and validation

## Intended behavior

One horizontal control plane at the top of the window. Back/forward and other native controls, a narrow address field, icon-sized tabs, new-tab button and window controls share the same row.

- Tabs are compact even when selected. Hover or keyboard focus expands one tab to reveal its title; moving away collapses it.
- The address field expands when focused and collapses when focus leaves. Native URL suggestions and keyboard shortcuts should remain available.
- Preserve the existing Compact Mode top-edge activation, popup tracking and timing rather than inventing a new edge detector.
- Prefer native theme colors; no forced full-browser theme.
- Preserve access to bookmarks without coupling the layout to unrelated visual changes.

## Implementation strategy

The third preview replaces the fixed-position sidebar overlay with a lightweight horizontal view inserted into the real navigation toolbar. Each control references an existing native tab; selection and closing go through gBrowser, and the original tab model is unchanged. The original sidebar remains available after disabling the mod.

This is a change in implementation, not a second tab session. The toolbar inherits native Compact Mode visibility. Native drag-and-drop, folders, tab context menus, workspace controls, and accessibility parity are still unfinished.

## Automatic configuration

A Sine window script snapshots native layout preferences and activates the required Zen settings using the native Compact Mode manager. The stylesheet applies only when that window is marked active. Unload attempts to restore the original configuration; multi-window, update and restart behavior need runtime validation.

## Visual and interaction refinements

Preview.4 moves the original page-action nodes with reversible DOM anchors, uses a content-only dismissal shield for URL editing, distinguishes pending tabs from loaded tabs, and applies a frosted background to the native toolbar. Verify that translation and site-data popups still open correctly, the dismissal gesture never reaches the page, and native compact reveal remains intact.

## Centered layout and hover retention

Preview.5 uses CSS ordering without reparenting native navigation widgets, two balancing spacers and a bounded tab strip with reserved hover expansion space. A resize observer compensates for native edge controls and measures the bookmarks row. A pointer guard preserves native toolbar hover while inside its visible bounds; native Compact Mode resumes on exit. Nebula has a fixed-height compact-toolbar rule, so the measured full height is also used as a compatibility override.

## Three-zone layout and overlay reveal

Preview.6 centers the collapsed tab strip alone. Navigation and the URL stay at the left; other native controls stay at the right. The balancing spacers compensate for the new-tab button and reserved expansion space, and maintain a stable left anchor while a tab expands. If the window is crowded the tab viewport shrinks and exact centering may give way to available space.

The native toolbar wrapper is positioned above the web content, rather than changing its allocated height. The corresponding native content margin compensation is neutralized only while OnePlane is active. Native compact hover and popup attributes still drive the reveal. Compatibility overrides are part of OnePlane, not external theme edits.

## Directional tab expansion

Preview.8 retains the collapsed strip anchor and uses the existing trailing expansion reserve. Its tab list and new-tab button translate by the leftward share of the expanded width. The first tab expands left, the last right, and interior or single tabs expand equally in both directions when space permits. The translation is capped by measured free space before the strip. Crowded windows and scrolling require runtime testing.

The overlay now has a real background element plus independent tint on the actual visible navigation and bookmark rows; this avoids relying solely on the native background element or wrapper pseudo-element.

## Tab hover controller

Preview.9 moves tab expansion from CSS hover alone to a single explicit target. Crossing tabs retargets immediately; leaving the strip schedules a collapse, except while the pointer is on the plus. The indicator shares the spring constants of Magnetic Bookmarks but has no dependency on Zen Refined. Native close shortcuts and middle-click remain. The empty URL anchor is collapsed without hiding the native floating search popover.

## Address interaction and panel hold

Preview.10 arms an independent two-second visibility hold before dismissing the address field through the content shield. The hold is restarted on another dismissal and cleared on unload, window deactivation or unsupported layout. Native hover and popup states still govern visibility after it expires. Address width and toolbar height use separate opening and closing durations. The floating Zen search appearance remains native.

## Sequenced inline address animation

Preview.11 observes Zen's real non-floating URL popover. A bounded animation-frame controller sets its actual width and clips the joint background/results surface. Opening uses 320 ms width growth followed by 220 ms results reveal. Outside-click dismissal uses up to 200 ms results collapse followed by 360 ms width contraction, before native close. Keyboard and navigation-triggered native closure are not deferred. Floating Zen search retains its native behavior. All transient styles are removed on unload and native close.

## Manual validation checklist

- [ ] Verify preview.19: group frame/member movement, neighbor hover shift, animated drag start, detached zero-width slot, return/cancel, transfer, stable copy URL icon, overlapping address expansion, reverse closing, native floating search.
- [ ] Verify preview.18: hover group growth and neighbor movement; no duplicate while dragging anywhere in the upper toolbar; outside/re-entry transitions, cancellation, cross-monitor single-tab transfer, group handle and split extraction; verify address silhouette in all phases.
- [ ] Verify preview.17: continuous drag slot preview both directions, entire group, extraction, incoming tab, Escape cancellation, cross-monitor transfer, narrow/scrolling strip; identical address first/last frame geometry, text/identity alignment, two-phase reveal, floating search and reduced motion.
- [ ] Verify preview.16: shared group surfaces, six-dot handle, group reorder both directions, moving past a second group, keyboard reorder, individual unsplit, stable group width/centering, cancel drag and page resizing. Whole-group reorder is limited to the same window; individual tabs can still transfer between windows.
- [ ] Verify preview.15: compact/open header alignment, initial/final frame, zoom action, unblur from start of dismissal, split membership colors, drag to unsplit (including two/three pane groups), drag out of window, native resize handles in both orientations with zero separation.
- [ ] Verify preview.14: audio playback/mute/unmute, reduced motion, tab reorder and cancellation, drag outside a maximized window to another monitor, drop in an existing window, private-window isolation, drag to each page edge for Split View, unload and multiple windows.
- [ ] Verify preview.13: full-width inline search stops before the real minimize/maximize/close group; test maximized and windowed. Verify identical compact/open colors and corners, no second width jump after outside dismissal, rapid re-entry, and floating New Tab behavior.
- [ ] Verify preview.12: click the plus or Ctrl+T from a loaded page and from an empty tab; central floating search remains usable and no empty address placeholder appears. Close it and confirm the loaded page's address returns.
- [ ] Verify preview.11: real popover opens width-first and closes results-first on outside click, no flash, left edge stationary, rapid interruption, typing during close, native keyboard and navigation, floating search.
- [ ] Verify preview.10: lighter compact/focused URL, smooth width animation, two-second hold after outside dismissal without page click-through, slower panel close, re-hover/reopen during hold, floating search and reduced motion.
- [ ] Verify preview.9: empty new tab and floating search, Ctrl+L, first/middle/last tab expansion, centered title, no X, middle-click, indicator continuity across gaps, delayed exit and stable plus.
- [ ] Verify preview.8: visible backdrop over bright and dark websites; first/middle/last/single tab expansion, keyboard focus, pointer stability and crowded windows.
- [ ] Verify preview.6: tab-only centering (including odd/even counts), plus excluded, left navigation, stable page position during reveal and hide, URL focus and crowded windows.
- [ ] Verify preview.5: centered navigation and bookmarks, stable hover across rows and empty space, no sticky toolbar after leaving, many tabs and narrow windows.
- [ ] Verify preview.4: native page actions, click dismissal, loaded/unloaded states, URL fade and frosted background on bright/dark pages.
- [ ] Verify preview.3 shows the tab strip, expands the address field on click, and reveals via native top hover.
- [ ] Install and enable with no manual native layout changes; disable and verify restoration.
- [ ] Two windows, close one, disable mod, restart and update from preview.1.
- [ ] Windows 11, Zen version and clean test profile recorded.
- [ ] Compact Mode reveals from the top and hides without flickering or moving page content unexpectedly.
- [ ] Native URL field, suggestions, Ctrl+L and Ctrl+T work while compact and expanded.
- [ ] Tab activation, native close shortcuts, middle-click, keyboard focus and pinned tabs work.
- [ ] 1, 10, 50 and 100 tabs: overflow, scrolling and access to the final tab.
- [ ] Drag/reorder tabs; pinned tabs, folders, Essentials and workspace switching.
- [ ] Window buttons, extensions, overflow menus, bookmarks and popup positioning.
- [ ] Maximized/windowed, narrow and ultrawide windows, fullscreen and reduced motion.
- [ ] Split View, Glance, transparent pages and Nebula compatibility.
- [ ] Disable preference and verify original layout is restored.

## Reference points

- [Zen 1.24.2b Compact Mode manager](https://github.com/zen-browser/desktop/blob/1.24.2b/src/zen/compact-mode/ZenCompactMode.mjs)
- [Zen 1.24.2b vertical tab manager](https://github.com/zen-browser/desktop/blob/1.24.2b/src/zen/common/modules/ZenVerticalTabsManager.mjs)
- [Zen 1.24.2b workspace element](https://github.com/zen-browser/desktop/blob/1.24.2b/src/zen/spaces/ZenSpace.mjs)

These references establish selector and layout assumptions, not runtime compatibility.


## Known issues (preview.23)

- Reordering a whole Split View group from an outer edge can sometimes hesitate or transition unevenly. Deferred at the user's request; the existing horizontal reorder behavior is otherwise retained.
- Verify startup floating search preservation and inactive-tab side drops in running Zen 1.24.2b; the native splitter explicitly excludes the empty workspace tab.


## Native feature audit (preview.25, Zen 1.24.2b)

The horizontal strip mirrors visible native tabs and supports selection, middle-click close, title expansion, pending state, audio status, split groups, drag reorder and individual tab transfer. It does not yet provide these native surfaces directly:

- Native tab context menu (pin, duplicate, mute, move, split, folder and other native commands). A right-click handler that opens the native menu for the actual tab is a high-value next step.
- Dedicated Essentials and pinned sections. The mirror records pinned state but does not render the native hierarchy or Essentials-specific controls.
- Workspace switcher and workspace/container identity. The mirror follows visible tabs and workspace changes but has no dedicated switcher.
- Native folders: Split View groups have their own representation; ordinary folders do not have an expandable horizontal representation.
- Tab multiselection: mirror clicks currently select a single tab; native Ctrl/Shift multi-select actions are not mirrored.
- Tab audio control: the equalizer/mute status is rendered, but the mirrored audio badge has no click handler.
- Glance: native content-side behavior is not deliberately replaced, but the mirror has no dedicated Glance parent/child representation. Verify before modifying.

Optional design ideas (not implemented): small pinned/Essentials capsule, workspace pill with its native color, folder accordion/popover, delayed preview card, subtle loading progress ring, clickable audio equalizer. Prioritize native context-menu access and workspace/folder semantics before adding more effects. Do not replace native session or security behavior. Known group edge-reorder hesitation remains deferred.


## Island Mode (preview.26)

Expand Mode remains the default. Island Mode keeps compact widths, uses two scrollable icon lanes and a fixed center label; groups are atomic slots. The label displays the hovered title or selected title when idle, and is optional. When space is too narrow for two usable lanes and the center label, the compact strip is shown without the label. During native drag the lanes become a continuous flex strip via display:contents, then return to the island layout; no source node is reparented at drag start. Both modes use identical scale, icon magnification and 3px downward translation with an 8px permanent vertical reserve. Test mode switching, odd/even and crowded strips, group boundaries, bookmarks, keyboard focus, scroll, local/cross-window drag, and narrow windows in live Zen.


## Island drag and indicator (preview.27)

The centered island and both scroll lanes stay in place during a drag (except the existing narrow-space fallback). The virtual reorder algorithm lays out slots on either side of the fixed title gap. Group pull uses the captured slot order and lane anchors. The title shows the carried tab or joined group titles. The liquid indicator has a dedicated drag target; it spans the member cards for a whole group, follows without horizontal lag, and collapses quadratically between 6% and 62% pull progress or earlier if vertical clearance is insufficient. It remains hidden while detached and is restored on re-entry/drop. The common ordinary hover uses 7px descent, 20% vertical and 28% favicon magnification; group members remain within their frame. The row reserves space above bookmarks. Verify these behaviors, especially crowded cross-lane group drag and re-entry, in live Zen.
