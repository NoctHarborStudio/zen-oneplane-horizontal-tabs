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


## Adaptive Contour Fade (preview.29)

The shared OnePlane background (not Zen Refined or the interactive toolbar) uses a generated SVG alpha mask. The upper baseline follows the real nav/tab row, with a short 9px feather. The central lower edge follows the visible bookmark button bounds with 5px padding; shoulders use equal tangent quarter circles with radius up to 18px and a vertical section if depth permits. Nested round strokes implement a smoothstep distance feather in all directions. No fixed center width or assumption about the number of bookmarks: the native overflow chevron and other visible bookmark controls are measured. When bookmarks fill the window, shoulders extend outside it. The geometry updates on bookmark changes, resize and short CSS geometry transitions (including Zen Refined magnetic hover), using a cached rounded geometry key. No page capture or continuous animation loop while idle. The visual surface has pointer-events:none and does not enlarge the hover area. Reduced transparency retains the opaque rectangular fallback. Liquid Wave address animation is intentionally deferred.


## Unified Contour (preview.30)

Replaces the contour-normal feather from preview.29 with one full-width vertical ramp behind an unfeathered silhouette. The ramp starts at the measured upper-row baseline, remains at configured intensity for the hold distance, then follows (1 - smoothstep(t))^curve. Both shapes are combined inside one SVG group with the chosen opacity; their intersection cannot exceed the global alpha. The CSS tint is opaque and the mask controls both tint and backdrop blur. The default group opacity is 0.96, fade intensity 1, length 69 CSS px, hold 30 CSS px, exponent 0.65, radius up to 24 CSS px, padding 0. Preferences use integer dropdown values; the curve stores hundredths. Geometry is still measured from native bookmark nodes and is refreshed on preference changes. The native bookmark visibility preference remains independent. Reduced-transparency mode uses the existing opaque rectangular fallback. The URL bar Liquid Wave is not included in this change.


## Liquid Wave and panel motion (preview.31)

The inline address popover uses a pixel-coordinate clip path with a rounded header and a lower edge sampled from smoothstep((progress - 0.24*x)/0.76). The real width and reveal advance in one 420ms timeline; outside-click close reverses the wave in 380ms, then runs the existing native dismissal/settling routine. A re-open from the input resumes from the last painted width and progress. Native floating search and native navigation/keyboard dismissal semantics are not replaced. Late-arriving native search results remain owned by Zen. Compact panel motion retains the native height transition but no longer clips the background when closing; its shared surface and controls fade and translate by 10px over 300/420ms. The contour is measured in unshifted coordinates and static parameters remain unchanged. Reduced-motion/disabled-animation settings zero the transition durations. Live Zen validation is required for focus, native popover behavior and compositor effects.


## Stable panel visibility (preview.32)

One visual latch (data-op-panel-open) drives height, opacity, translation and hit testing instead of raw native hover/popup selectors and :hover. Native signals still request visibility, but transient native-only opens during the 180ms tab transaction are deferred; a previously open panel waits through this window and a 100ms close hysteresis. Genuine pointer entry and explicit address/drag holds open immediately. Stationary pointer retargets during tab transactions do not update hover. The native manager is no longer repeatedly forced to re-add its hover flag. The contour is retained during tab settling; the geometry observer excludes the animated wrapper. Selected-tab scrolling is local to its lane or list. These changes address code-level flicker risks, not a reproduced live browser trace.


## 0.2 source migration (preview.1)

See [architecture.md](architecture.md). This release splits source and introduces a deterministic build and pure-function tests. The shipped JS/CSS are byte-identical to preview.32. Stateful controller boundaries, persistent mode and Hub are subsequent milestones.


## 0.2 preview.2

OnePlane stays horizontal with Compact Mode disabled. The native mode is not forced at activation. Persistent toolbar occupies native flow and has no rear gradient spilling over page content. OP-001 records a suspected lazy-tab URI and geometry race; mitigation requires live validation.


## 0.2 preview.4 — UI stabilization before Hub

Opening uses a fixed final native popover layout width and animated clipped visible width, with one initial size measurement and ResizeObserver height updates. Closing retains shrinking real width, avoids synchronous layout reads within the tick and fades selection highlight before native blur. During opening, trailing native controls may be progressively revealed rather than moving with the edge; validate visual behavior. Horizontal center compensation runs immediately on address empty-state transitions and independent edge resizes, while vertical geometry/contour retain the switch grace. The temporary left Compact Mode button dispatches Zen's native command and remains in the OnePlane toolbar independently of native sidebar reparenting. These are code-level mitigations, not verified live-browser measurements. See OP-002/003/006/007 and [roadmap](roadmap.md).


## 0.2 preview.5 — native Fluid Wave

Address motion is now a native WAAPI timeline, not a per-display-frame script loop. Both phases use a fixed expanded layout width until final native dismissal; the shape/polygon uses height-relative coordinates so late native suggestions do not restart the animation. Seventeen interpolation knots describe the smooth trajectory, not a frame-rate cap. Shape and polygon may still require main-thread painting in Gecko; native animation does not guarantee compositor acceleration. A cascade check chooses the script fallback if the native clip animation is overridden. The native identity box gets a synchronized translate animation, and selection highlight is animated using a registered percentage custom property. Reversals sample the existing animation timeline; native floating search and keyboard/navigation dismissal retain native behavior. The opt-in diagnostic preference zen.oneplane.address-diagnostics logs rAF callback intervals, engine, and layout.frame_rate to Browser Console, without changing global FPS settings. Actual displayed frames and compositor behavior require Firefox Profiler/live Zen testing. See [Mozilla compositor animation tracking](https://bugzilla.mozilla.org/show_bug.cgi?id=1625029) and [path rendering work](https://bugzilla.mozilla.org/show_bug.cgi?id=2078306).


## 0.2 preview.7 — Bunny Cascade

The address cascade is a visual companion to the existing native Fluid Wave. It schedules each mirror card using the edge crossing time from addressMotionSample, with up to 135ms shrink, a 7% anticipation and a 160ms return through 112% scale. Opening travels left to right; closing right to left. The same controller handles the visible title island in Island Mode, the new-tab button, the selected indicator (translate preserved), split member cards and split handle. Split outline alpha animates independently through a registered CSS property. Neither card scaling nor hidden state changes flex/grid slots; hover expansion is cleared once hidden. New mirrored items remain hidden until the reveal completes. The controller uses WAAPI, generation-guarded completion, current computed scale on reversal, inert during the cascade and explicit unload cleanup. Native instant dismissal restores a staggered cascade; reduced motion disables motion without leaving the strip visible behind inline search. Floating native search is unchanged. Live testing is required for both hover modes, keyboard dismissal, rapid reversal, groups, startup integration and high-refresh behavior.
