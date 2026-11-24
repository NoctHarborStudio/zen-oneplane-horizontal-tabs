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

### A3.5a — preview.91 shared Fold math and reconstructed Bloom candidate

The exact prior Fold formula now lives in `src/algorithms/magnetic-fold.mjs` and is consumed by Center Motion and [the generated comparison Lab](labs/startup-motion.html). Fold is still the production trajectory for Startup, Workspace and Close. The Bloom candidate stays within fixed resting slots and compresses stagger for large collections. It is Lab-only; no runtime enablement, no exact original Lab parity, and no native performance claim. See A3.5a in [the pipeline](pipeline-0.4.0.md) for property ownership and next acquisition gate.


### A3.5b — isolated candidate (preview.92)

Center Motion accepts an explicit paused current Assembly `bloomTimeline` only. Uses the same tab handle and outcome observer, distinct `data-zr-center-mode="bloom"` and exact outer-card markers, no proxies. Checks actual computed geometry/scale/alpha at resting and sampled keyframes; partial acquisition rolls back before bounded Fold fallback. No installed caller requests this mode. The full Bloom plan must fit the common completion budget before promotion; native compositor evidence and A3.6 topology handoff remain required.


### A3.5b-R — independent acquisition review (preview.93)

Consistent finishLength/lateLimit, exact paused Assembly admission through fallback, once-only explicit epoch, paused document WAAPI and finished-promise identity checked. Interior samples avoid the terminal boundary. Competing real-card effects bypass fallback; stale transactions retire all acquired resources. Fold CSS guard specificity preserved with :where. Candidate still dormant; no native acceptance.


### A3.5c1 — common Assembly plan (preview.94)

The shared timing selector has an explicit Bloom mode (1920*scale visible, +420ms late cap, inherited watchdog). Home uses the same stage schedule as the Lab under the existing lease. No production caller selects Bloom. Boot epoch mapping is provisional after-exit; remaining Assembly surfaces and actual handoff are A3.5c2.


### A3.5c2 — dormant Assembly integration (preview.95)

The existing Startup Assembly now contains an explicit coordinated Bloom candidate path with owner-version admission, original tab Fold fallback timings, registered-progress panel/Island/native control/bookmark effects and Home lease. Source switch remains false. Boot removal precedes common epoch; both admission and resume check inherited deadline. Late chrome ungates without replay. Direct effect sampling is batched before resume, max 256 targets. Independent integration and topology audit, native Gecko and approved visual parity remain open.


### A3.5c-R — exact prepared cohort (preview.96)

Existing Assembly outcome ledger captures and rechecks the current live effect cohort across Boot hold; retired trial effects excluded. Changed native state, promise, membership, Home lease or row rejects resume. Candidate admission closes at capture, late Home rests, interruption releases atomically. No production Bloom activation. A3.6 owns topology/geometry and final pose.


### A3.6a — native topology and mirror lease (preview.97)

The strip owner provides a read-only exact topology validator from the last completed sync. Center Motion rejects stale capture and checks preparation/resume/boundaries; scheduled sync invalidates Startup/Workspace visuals and reconciles the changed projection before the next paint using the existing release event. Close preserves its native commit lifecycle. Geometry/scroll/overflow/final-pose checks remain A3.6b. Bloom disabled.


### A3.6b1 — resting geometry (preview.98)

The Layout projection lease adds viewport/DPI, row/lane/Island/slot metrics and scroll plus Fold fractional row-local rectangles. Existing geometry events invalidate stale Startup/Workspace motion; native identity sync alone avoids geometry reads for icon-only updates. Close remains exempt. Proxy mount/clip/ancestor transform and final painted pose remain A3.6b2; Bloom disabled.


### A3.6b2 — mounted Fold geometry (preview.99)

Correct the absolute host origin for proxies and portal; preflight actual unanimated outer and paired Split part rectangles. Reject partial scrollport/portal clips and nontranslation frames rather than duplicate incorrect pixels. Compare finished incoming Fold geometry and alpha before handoff. Existing native/visual fallback is used when unsupported. No new timer, observer, owner or trajectory loop. Actual post-release native paint and performance remain open; Bloom disabled.


### A3.6-R — handoff source audit (preview.100)

The engine lock is claimed before release validation; nested invalidation/notification and diagnostic reentry cannot start a successor or release it. Existing slot/mode callbacks check the extended strip mode geometry lease. A lazy `center.fold.handoff` sample in the existing second RAF compares finished incoming Fold's captured row-local geometry with surviving real cards after external phase cleanup. It records row displacement separately, cancels on supersession, and is not a compositor measurement. Partial clipping fallback retained. Actual native paint, overhead and mixed ownership remain open; Bloom disabled.


### Preview.176 — Fold Home Island entrance

Startup only: when a measurable Home Island is covered by Boot or was not previously painted, Assembly prepares its existing resting slot before applying a 420ms (scaled) vertical entrance from above the window, .02 to 1 scale and 0 to native opacity. The original 650ms card wave begins at its landing boundary; the later stages retain their relative cadence. The same epoch, deadline and ownership rules apply. The geometry lease validates only this exact marked projection against the resting Island, keeping native centering, slot and scroll checks intact. Uncovered previously painted controls, missing Island and the experimental Bloom plan retain their original path. Native visual acceptance pending.

Preview.181: approved variant B replaces the single progress with 81 shared samples: vertical travel cubic-bezier(.25,.8,.22,1), size cubic-bezier(.3,0,.12,1) after the first 20% of time, opacity smoothstep over the first 30%. The 540ms scaled entrance precedes the existing card wave. Explicit native close folds tabs (620ms) and bookmarks (650ms), reverses the Home curve from 650–1190ms, seals and retains the 110ms native-close dwell. The real Island is transformed, preserving its native translate and resting slot. The geometry lease compares independently sampled travel and scale. Registration failure retains the previous fallback; existing native-close cancellation restores owned markers and properties. No new runtime entry, polling or native interception. Native visual validation pending.

Preview.184: experimental branded close finale shares the Boot mark factory (no network or page content). Existing fold endpoints are unchanged. Once the Home exit ends, crossfade to the #111219 cover (320ms), enter the logo with the Boot curve (460ms), fade the chrome document root via WAAPI opacity 1→0 (500ms), then retain the existing 110ms sealed dwell. Default visible-Island close: 1190/1510/1970/2470/2580ms milestones. Root alpha is not native window/compositor alpha; Mica, OS backing and native window decorations may remain opaque. The DOMWillOpenModalDialog capture listener restores during native delegation or cancels pending motion; a 180ms bounded recovery during synchronous native invocation restores on an extended nested event loop. Normal cancel/error/unload paths release the cover, effects and listener. No native APIs or bypass of native confirmation. If finale acquisition fails, preserve the prior close path. Native visibility, modal behavior and compositor result pending.

Preview.199: Firefox 160 ChromeObserver handles addition/removal of the root `windowsmica` attribute via SetMicaBackdrop on the current widget; nsWindow calls DwmSetWindowAttribute with DWMSBT_AUTO when disabling its requested backdrop. Close Finale owns a Windows-only temporary attribute lease. Wait for cover.finished plus two RAF opportunities; verify root and cover opacity=1 and >=100ms before fade; remove the attribute during the logo entrance. Cancel outstanding callbacks at seal/release, restore the exact original value on cancellation without replacing another owner's value. No global settings or Windows native library bindings. Existing timing is unchanged. Actual DWM presentation, alpha and modal recovery remain native checks; no claim that AUTO guarantees no backdrop.
