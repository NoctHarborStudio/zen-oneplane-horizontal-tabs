# Nocturne preview.10 diagnostics

Recording remains enabled by default for this preview. Set `zen.nocturne.diagnostics.enabled` to false in about:config to disable. No network upload.

## Collect

Restart Zen completely, reproduce the issue, and open about:support > Profile Folder > Open Folder > nocturne-diagnostics. Attach the single `nocturne-diagnostics.json` file. It contains up to four recent window sessions and is formatted with indentation; total serialized size is capped at approximately 450 KB. Old per-window Nocturne diagnostic JSON files are removed after the first successful replacement. Save them separately first if you need older traces.

Fallback: `Services.wm.getMostRecentWindow("navigator:browser").__nocturneDiagnostics.dump()` in Browser Console. `await Services.wm.getMostRecentWindow("navigator:browser").__nocturneDiagnostics.flush()` explicitly persists. Private windows never write. Closing/unload persistence remains best effort.

## Format

Schema 2: sessions contain version, window, dropped, updated, events. Sample metrics are a full keyframe every tenth sample (`full:true`), otherwise only changed properties; a null node means removal. Samples run during active events, not continuously during idle. A trimmed session can start with a delta: read from the next full sample.

- center.motion: owner, direction, count, duration and total travel.
- assembly.*, disassembly.*, workspace.*: lifecycle and phase.
- selection.motion: normal tab switch direction and duration.
- sample: card offset/opacity, geometry, scroll indicators and frame gaps.
- drag.*: native drag lifecycle.

Logs contain no page URL, title, search text, downloads filename or page contents. Frame measurements are diagnostic, not an absolute FPS benchmark.
