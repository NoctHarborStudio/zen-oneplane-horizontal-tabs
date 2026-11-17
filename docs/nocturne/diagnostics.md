# Nocturne preview.6 diagnostics

This diagnostic preview intentionally leaves motion and drag behavior unchanged. Recording is enabled by default. Set `zen.nocturne.diagnostics.enabled` to false in about:config to disable it (or restart after changing it to prevent any early traces). There is no network upload.

## Collect

1. Restart Zen completely. Open Browser Console (Ctrl+Shift+J). Look for `[Nocturne diag ...]` and version 0.3.0-preview.6.
2. Reproduce normal tab selection and workspace switching separately, one/two rows, reveal/collapse, drag out/back, and native close. Each window has a unique diagnostic ID. Do not share unrelated console logs unless needed.
3. Open about:support > Profile Folder > Open Folder, then `nocturne-diagnostics`. Attach the newest JSON files, including the previous (closed) window's file. They are updated asynchronously, so the very last unload event is best effort.
4. Fallback: evaluate `window.__nocturneDiagnostics.dump()` in the parent Browser Console. If the console context does not expose the browser window, use `Services.wm.getMostRecentWindow("navigator:browser").__nocturneDiagnostics.dump()`. To explicitly persist, call `await Services.wm.getMostRecentWindow("navigator:browser").__nocturneDiagnostics.flush()`. Optional `mark("drag-out-in")` adds a short test label; never enter private information.
5. Recorder is bounded to 1600 events and trims old entries when serializing a large snapshot. Recent files retained; private windows are not written to disk. Logs contain no page URL, title, search text, downloads filename or page contents. Window-relative coordinates, dimensions, timings, counts, state names and animation metadata only.

## Read

- assembly.*: eligibility, native/layout readiness, launch, targets, interruptions, settle and finish.
- disassembly.*: native close request, effect count, restore and native invocation (compare times).
- native.TabSelect vs workspace.*: ordinary selection vs explicit workspace animation. Bypass reports startup, active interaction, reduced motion and registration.
- panel.*, geometry.*, contour.*, bookmarks.contour, chrome.attributes and sample: measured/painted height, two contour owners, hold flags, frame gaps, style and animation state.
- drag.*: threshold, return decision, pull, mode, source and ghost state, native image, insertion, drop and cancellation.
- Other runtime owners and Home/Hub/address record lifecycle events; no arbitrary text is captured.

Sampling is active-event driven and rate-limited; diagnostics itself adds some overhead. Do not use the trace as an absolute FPS benchmark. Sine hot reload and process shutdown can prevent the final async write; console and prior disk snapshots remain fallback evidence.
