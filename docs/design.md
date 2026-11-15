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

## Manual validation checklist

- [ ] Verify preview.6: tab-only centering (including odd/even counts), plus excluded, left navigation, stable page position during reveal and hide, URL focus and crowded windows.
- [ ] Verify preview.5: centered navigation and bookmarks, stable hover across rows and empty space, no sticky toolbar after leaving, many tabs and narrow windows.
- [ ] Verify preview.4: native page actions, click dismissal, loaded/unloaded states, URL fade and frosted background on bright/dark pages.
- [ ] Verify preview.3 shows the tab strip, expands the address field on click, and reveals via native top hover.
- [ ] Install and enable with no manual native layout changes; disable and verify restoration.
- [ ] Two windows, close one, disable mod, restart and update from preview.1.
- [ ] Windows 11, Zen version and clean test profile recorded.
- [ ] Compact Mode reveals from the top and hides without flickering or moving page content unexpectedly.
- [ ] Native URL field, suggestions, Ctrl+L and Ctrl+T work while compact and expanded.
- [ ] Tab activation, close buttons, middle-click, keyboard focus and pinned tabs work.
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
