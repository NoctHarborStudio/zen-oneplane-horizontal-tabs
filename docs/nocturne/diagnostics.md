# Nocturne preview.11 diagnostics

Recording remains enabled by default for this preview. Set `zen.nocturne.diagnostics.enabled` to false in about:config to disable. No network upload.

## Collect

Restart Zen completely, reproduce the issue, and open about:support > Profile Folder > Open Folder > nocturne-diagnostics. Attach the single `nocturne-diagnostics.json` file. It contains up to three recent window sessions and is formatted with indentation; total serialized size is capped at approximately 2 MB. Old per-window Nocturne diagnostic JSON files are removed after the first successful replacement. Save them separately first if you need older traces.

Fallback: `Services.wm.getMostRecentWindow("navigator:browser").__nocturneDiagnostics.dump()` in Browser Console. `await Services.wm.getMostRecentWindow("navigator:browser").__nocturneDiagnostics.flush()` explicitly persists. Private windows never write. Closing/unload persistence remains best effort.

## Format

Schema 2: sessions contain version, window, dropped, updated, events. Sample metrics are a full keyframe every tenth sample (`full:true`), otherwise only changed properties; a null node means removal. Samples run during active events, not continuously during idle. A trimmed session can start with a delta: read from the next full sample.

- center.motion: owner, direction, count, duration and total travel.
- assembly.*, disassembly.*, workspace.*: lifecycle and phase.
- selection.motion: normal tab switch direction and duration.
- sample: card offset/opacity, geometry, scroll indicators and frame gaps.
- drag.*: native drag lifecycle.

Logs contain no page URL, title, search text, downloads filename or page contents. Frame measurements are diagnostic, not an absolute FPS benchmark.

Preview 11 adds a bounded `startup` array (up to 100 lifecycle events) per session, separate from the rolling event ring. `center.motion` reports the Magnetic Fold anchor and lower-row count. Caption buttons and handoff state are included in samples.

Preview 16 retains the newest three windows by creation time, trimming each independently (approximately 620,000 UTF-8 bytes per session). The startup archive retains `assembly.icons.ready`, `assembly.center.result`, `assembly.interrupt` with accepted flag, and startup `center.*` events. `center.group.geometry` records measured handle offsets; `center.motion.release` includes image readiness and proxy-load counts. Samples include split group/handle geometry and aggregate image readiness. No favicon addresses, keyboard values, or tab titles are logged.

Preview 17 caps the complete formatted file at 2,000,000 UTF-8 bytes, with up to 620,000 bytes per session before outer JSON indentation and 3,200 live events. `assembly.icons.ready` distinguishes missing, failed, pending, cached and decoded sources; `center.motion` and `center.motion.release` include bitmap counters. `tabs.hover` samples the hovered card and lane; `workspace.visual.boundary` and `workspace.settled` identify the first transition and geometry at each phase. No addresses or image pixels enter telemetry.

Preview 18 adds `center.icon.paint` with mounted proxy paintability, zero-alpha/zero-geometry counts and the number of hidden source tab buttons. `island.title.motion` records phase and duration only; `home-island` and `home-label` are sampled for geometry and opacity, not text. The three-session / 2,000,000-byte limit remains unchanged.

Preview 19 adds `drag.detach.handoff`, `drag.return.rearm` and `drag.insert.finish`, extends `drag.insert` with measured start offset, source/target widths and duration, and samples the actual `ghost-body` geometry. No tab identifiers or URLs are recorded.

Preview.47 adds `flip` to Bunny popup surface/tick diagnostics and rounded screen grip coordinates to the existing sampled `downloads.drag.tick` event. No file names or payloads are recorded. Use this to verify edge crossing and mixed-monitor motion.

Preview.48 adds `layout.prefs.restore` (restored/skipped/failed counts and backupRetained) and `layout.free.stale` (create/before-select stage only). No preference values, workspace IDs, names or URLs are emitted. All entrypoint version labels synchronized.

Preview.49 extends `layout.prefs.restore` with alreadyReleased and checkpointFailed. `layout.free.stale` adds designation, before-reorder and after-select stages; no native IDs or user values are recorded. Partial backup write failures are reported, not silently treated as successful restoration.

Preview.50 adds `layout.scope.error` / `layout.scope.dispose` for Layout and Hub, and `library.scope.error` / `library.scope.dispose` for Closed Tabs. Resource/owner labels, error class and release/failure counts only; native error messages and browsing data are not recorded. Failed native release remains a reported failure, not proof of successful detachment.

Preview.51 adds `layout.mount.stale` (stage: return) and refines scope disposal counters to include nested/late releases attempted during that disposal. Earlier manual failures are reported by scope error events. Closed Tabs callback exceptions use resource closed-tabs-callback. Native error class only, no message, payload or browsing data.
