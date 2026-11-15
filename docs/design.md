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

## Manual validation checklist

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
