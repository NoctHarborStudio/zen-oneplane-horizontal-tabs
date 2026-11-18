# Magnetic Fold — Preview 16

The shared engine ports the Motion Lab B curve. Given a card center x, actual Home anchor cx, and progress p (0 docked, 1 resting), the remaining horizontal distance is |x-cx| times a smoothstep compression factor. Width scales with the same factor; nearby cards disappear first. The lower row lifts toward Home and has a 12% closing delay. Opening exactly reverses the closing curve. Threshold distances are normalized to actual card height.

The engine snapshots visible mirror card geometry once and paints inert chrome-only copies in a closed shadow tree within the row. This prevents clipping by scroll lanes and keeps native tabs, scroll positions and projection queries unchanged. No page images, page DOM, or native tabs are cloned. Copies use computed visual styles and are removed on completion or cancellation. Real mirror cards stay in flow and hidden during playback. A two-frame handoff guard suppresses native transition restarts. The workspace controller keeps the Home anchor stable and the compact contour is the sole background. Bookmarks use horizontal compression; ordinary tab selection keeps the page opaque and stationary, as in Lab B.

Timings: startup 760 ms with 55 ms delay (scaled by configured duration); close 620 ms, bookmarks 650 ms, final 110 ms sealed dwell; workspace 460 ms out / 560 ms in, plus native swap and bounded settle. Native lifecycle, reduced motion and hot-reload protections remain. Startup trace markers are retained separately. The actual Gecko/Zen visual behavior requires in-browser validation.

Preview 16 adds a portal boundary: calculate the signed separating gap between the scaled card and the actual Home rectangle. Fade within a band of up to 24 normalized pixels outside it; the overlay has an even-odd rectangular clip hole as a safety net between keyframes. With no visible Home, retain the original fold. Opening uses the same curve in reverse.

Preview 16 unifies row metrics: the first card and Home center are 21 CSS px from the row origin in both modes; adding a row adds exactly 52 CSS px to the strip. Both contour owners use a 5px trim. The motion engine is unchanged.

Preview 16 preserves the measured relative bounds of split group children and handle dots, adds a bounded 350ms startup favicon readiness wait, and tracks only image changes inside the active proxy. Keyboard/scroll input outside the chrome no longer interrupts the startup fold. Native tab geometry and trajectory timings remain unchanged.

Preview 17: warm native mirror icon decoding before the startup fold (600ms maximum). Ready favicons are drawn from the existing chrome image into a small transient canvas, without pixel readback; URL clones and placeholders remain the fallback. The Island hover reserves the scaled slot through symmetric margins rather than moving the card down. Startup primes the resting contour and both contour owners skip measuring the squeezed bookmarks.

Preview 18: generic toolbar startup gates exclude descendants of `#oneplane-tabs`; outer cards own the gate. A ready image could previously be hidden by the captured zero-alpha tab-select ancestor. The Home label is held through `out`/`swap` and transitions only to the settled `in` title (280ms, fade out/in). The hub's bounds and shared Magnetic Fold trajectories are unchanged.

### Independent close acquisition review — preview.80

Preview 80: close controller treats failure to acquire required visible tab proxies or bookmark Fold as a transaction failure, rolls back acquired effects and uses the original native close command. Missing horizontal engine and partial direct control acquisition likewise bypass. Normal Fold geometry, close dwell and existing native-sidebar bookmark fallback retained. Native validation pending.
