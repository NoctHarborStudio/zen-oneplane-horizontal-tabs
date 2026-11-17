# Center Motion Engine — Preview 10

## Ownership and lifecycle

Layout installs one window-local engine before projecting cards. Startup, explicit native close, and workspace transactions call the same `start(row,{owner,direction,duration,delay})`. The handle owns only its two custom properties and marker per card; `seal()` preserves the terminal frame, `release()` restores styles exactly once. Startup gates before the first projection, releases when effects own cards, and fails open after 1800 ms. A late already-painted strip is not sent backward to the center. Close retains the hidden endpoint through the native close; cancelled close restores. Workspace swaps only under its existing hidden gate. Native navigation/selection remains Zen-owned.

## Geometry and choreography

Snapshot visible real cards and split groups, group by lane and side of Home, sort outermost first. For each side use the nearest card's inner edge as anchor. A card's outward travel starts after the preceding card has cleared its width plus the resting gap. A single global travel coordinate and easing generates monotonic keyframes for distance and opacity; closing reverses those keyframes. No animation-frame layout queries, clones, or per-card timers. Offscreen cards stay in their native scroll lanes. CSS disables competing transitions during the transaction and hides transient indicators/scrollbars. Freeze centering during owned motion; update after release.

Workspace geometry is captured under the hidden swap gate before starting any surface transforms. Height, bookmark offset and surface scale use the same incoming duration; measure the untransformed CSS height, never a previously scaled rectangle.

## Selection and diagnostics

Ordinary TabSelect remains immediate. Animate the selected browser chrome deck only (short directional glide/fade, no screenshots, no content DOM). Skip during startup/workspace/close, reduced motion, split, and native customization. Rapid selections replace the prior effect.

Diagnostics retains a single bounded profile file with per-window sessions; serialized writes share a process lock. Per-session dump remains readable. Store changed metrics rather than complete duplicate snapshots; skip private windows. No URL, title, content, downloads name or search text. Visual confirmation in real Zen remains required.
