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

## Manual validation checklist

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
