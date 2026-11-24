## 0.3.0-preview.159 — History button below One Plane Hub

Add a small History launcher directly below the existing One Plane Hub toolbar icon. The new control is owned by the existing Layout/Hub lifecycle and reuses the existing Nocturne Library `toggle("history")` route. When the experimental shell is disabled, unready, private or otherwise cannot accept, it invokes the stock `Browser:ShowAllHistory` command instead of creating another panel or modifying native history.

The second-row launcher occupies zero net horizontal flex width (30px width balanced by a -30px inline margin) and translates down by the existing `--op-top-row-height` metric. Hub, Downloads, nav controls and tab mirror keep their first-row layout, including narrow/overflow modes. The icon uses the same hover/focus/drag styling and `aria-label` as the existing toolbar language. One existing Hub scope owns click listeners and cleans up both buttons on Sine teardown. A bounded `library.button` diagnostic records only boolean accepted/nativeFallback, without browsing or keystroke data.

A source-extracted action regression covers Nocturne success, rejected/missing/throwing Library API fallback, unsupported/destroyed owner and action cleanup; generated `layout.uc.mjs` and `chrome.css` remain sourced from the build plan. No new Library data owner, no change to Ctrl+H/J routing, prefs, saved history, scanner, animation timings or native workspace operations. Native Zen/Sine hit testing, placement under Hub across UI scales/overflow, and actual click acceptance still require live user confirmation.

## 0.3.0-preview.158 — A7 Library Ctrl+H/J keyboard-layout fallback

A user-observed regression opened the native Zen History/Downloads interface instead of the experimental Nocturne Library. The attached three-session diagnostics file captured preview.156 and preview.157 startup with Library enabled and both shortcuts opted in, services/overlay present, but no Library shortcut attempts and no Library open/accept/reject events. This narrows the observed break to shortcut recognition/dispatch, not shell opt-out or a reported Library opening failure.

**Verified source defect and repair:** `libraryShortcutSection` used only `KeyboardEvent.key` ("h"/"j"), which changes under non-Latin keyboard layouts even though a physical accelerator remains on `code==="KeyH"` / `code==="KeyJ"`. Match the existing logical keys first and use the two physical codes as fallback, preserving exact Ctrl/Meta platform modifiers, repeat/composition/Alt/Shift and already-prevented guards. Source-backed regression covers Cyrillic-key synthetic events for Ctrl+H/J, Darwin and denied modifiers; generated Library output synchronized. No additional key logging, handlers, shortcut changes, service owner or UI feature.

**Evidence boundary:** The uploaded diagnostics intentionally omit actual key values/layout. The language-layout path is a reproducible source defect, **not a proven explanation** of the observed Zen routing regression. Also possible: earlier native event suppression, a changed Zen command target or a startup race. Full source/CI result pending; live Zen retest must verify both shortcuts in non-Latin/Latin input and native fallback, or investigate the earliest event/command handler next.

## 0.3.0-preview.157 — A7 NC4-089-R7c-P4 finite diagnostics and Console opt-out

**Audit finding 1:** `downloads.drag.end.reason` and `workspace.data.journal.reason` still used the generic token grammar despite their source-owned finite result sets. Preserve every verified dragend/native-session and Workspace journal outcome, and reject unknown strings before local JSON persistence or mirrored Browser Console. No native operation, workspace tab mutation, download drag identity or animation was changed.

**Audit finding 2:** Display Engine's `logPlacement` printed native window/monitor geometry through direct `console.info` even when `zen.nocturne.diagnostics.enabled=false`; this direct path was not protected by the recorder's opt-out/sanitizer. The existing logger now exits when opted out and logs only finite stages/modes, numeric rectangle fields and allowlisted lifecycle metadata; arbitrary native object fields and invalid reasons cannot enter Console. No change to window placement, focus, geometry calculation, monitor selection or scheduling.

Two new source-backed regressions check all allowed reason tokens plus hostile strings, exercise the exact Display logger with opt-out (no property access) and with diagnostics enabled (known geometry retained, foreign fields suppressed). Source/CI evidence is distinct from installed Zen/Sine: diagnostic privacy, multiwindow and performance need native acceptance. The full R7c producer inventory and other console paths are not universally certified by this bounded repair.

## 0.3.0-preview.156 — Cross-realm native History results (A7)

Fix native History silently displaying an empty list when `PlacesQuery.getHistory()` returns its grouped `Map` from a different Gecko JavaScript global. The previous `instanceof Map` check relied on matching constructors across realms; the Library now accepts the native iterable groups while retaining cross-realm `Array.isArray` handling for flat search results, the original 120-day limit, bounded pagination, URL/identity rules, and one native History owner. An isolated VM regression reproduces the previous empty rendering with a cross-realm Map, and verifies the normalized visit is visible. Does not change the native history database, privacy, commands, UI design, scanner safety gate, or any destructive action.

This is source/CI stabilization based on the user-observed blank Library after enabling experimental Ctrl+H. It does not yet prove that the installed Zen/Gecko context caused that blank state; native comparison with the built-in History after a full Nocturne update remains required. No new feature or API and no native Zen acceptance are claimed.

## 0.3.0-preview.155 — Temporary fail-closed Library local-media safety policy (NC4-022/082/083)

Following explicit user approval, temporarily suspend the optional native folder scan for Documents/Pictures in the existing Library Services owner regardless of the saved `zen.nocturne.library.local-media` preference. The Zen 1.24.2b native scanner accumulates all matching entries before limiting its returned items, exposes no cancellation handle, and Nocturne's former raw `file:` thumbnail source cannot bound decoded pixel or animation memory. Lowering `maxItems` or using CSS `img` sizing would not remove these risks. This scope does not patch Zen C++ or claim that its native scanner is now bounded/cancellable.

The safe policy returns no media session from `openMedia`, rejects direct service sessions and folder picker/clear operations through the same `mediaAllowed` gate, hides local folder controls and shows a short explanation when the saved opt-in is enabled. Defensive local row metadata no longer constructs a direct file-URI thumbnail; system icons remain the fallback. All saved media/folder preferences and native data are unchanged. History, Recently Closed, All Downloads, downloads-based Documents/Pictures projections, Dock downloads drag and native fallback continue to use their previous owners. No extra scan worker, observer, service, timer or UI subsystem was added. New production-source-extracted regressions cover disabled scan entry, old saved values, folder operations, icon-only metadata and download projections.

**Important:** An already issued Zen native scan from an older installed script cannot be cancelled by this release; a full Zen restart is required to establish the safe boundary. Re-enabling scanning requires an independently verified bounded native API and a later deliberate cutover. Source, CI and native Zen acceptance are distinct. Native scanner remediation NC4-022/082/083, native privacy, multiwindow and performance acceptance remain OPEN.

## 0.3.0-preview.154 — Dynamic Center release and native Drag reason/status telemetry bounds (NC4-089-R7c-P3)

Full source-path review confirmed that the existing Diagnostics recorder's generic `reason`/`status` tokens remained overly permissive for public Center Motion and Bookmarks `release(reason)` handles, Center Fold handoff status, Drag Lifecycle native and pointer cancellation reasons, and native Split/drop outcome reason. Five additional `EVENT_STRING_ENUMS` schemas now restrict these fields to values explicitly present in active runtime sources, retaining legitimate fail-open, disposal, unverified native operations and cancel reasons while dropping arbitrary tokens before the local diagnostics dump or mirrored Console. One source-backed adversarial regression probes accepted values and injected unknown values. These changes affect only the existing recorder and its generated Layout output. No native drag operations, cancellation behavior, UI, animation timing, observers, extra logging service or Library scanning changes.

This bounded R7c-P3 source/CI review does not certify all dynamic trace event fields or real Zen/Sine privacy/drag/profiler behavior. Library NC4-022/082/083 decoded thumbnail memory, pre-limit scan allocation and true native cancellation remain OPEN.

## 0.3.0-preview.153 — Finite diagnostic exception classes and Assembly/Drag event semantics (NC4-089-R7c-P2)

An independent recorder-boundary audit confirmed that the existing `name` filter still allowed arbitrary class-like strings (for example `PersonalTokenError`), even though Layout and several Sine producers already used a finite exception-class allowlist. The early standalone Diagnostics recorder now permits exactly the same 27 standard/native error names as the existing pure Layout helper, with a source-backed parity test; unknown names are omitted rather than exported or echoed to Browser Console. This remains independent of compiled helper initialization order.

Eight additional source-inventoried `reason` families now use exact finite values: Assembly eligibility/finish/skip/late skip/Bloom fallback, Disassembly bypass, drag source resolution and native drag search restoration. Known native cancellation/fail-open reasons remain preserved; arbitrary class-like or user-supplied tokens become null in the existing recorder. The real event inputs are checked against the active producer fragments by a source-backed regression. No changes to native commands, animation frames/timing, ownership, UI, storage, scan, observers or timers.

This is a bounded R7c-P2 source/CI pass, not universal privacy/native acceptance. Some dynamic `reason/status` producers (such as Center release and native drag lifecycle) still require individual source contract review; Zen/Sine Console/private-window/multiwindow/profiler acceptance and Library NC4-022/082/083 decoded-memory/scan cancellation remain OPEN.

## 0.3.0-preview.152 — Remaining source-scoped Console and diagnostic event boundaries (NC4-089-R7c)

Re-scanned the installed independent Sine and compiled Layout source/console paths. Found six remaining raw native exception Console sinks (Home mount/startup, drag image, Split View/drop settlement and address wave), three preference restore warnings that echoed arbitrary `error.name`, a source error-class escape in Layout/Center Motion trace metadata, a Hub Projection direct Console echo of unsanitized `data`, and a Hub return-projection status that reflected `error.message` for recognized codes. Replaced raw objects and names with the existing finite `nocturneErrorClass` filter; Hub Projection Console now prints fixed source-origin stage only, preserving sanitized structured diagnostics through `__nocturneTrace`. Hub return errors now show fixed bounded messages without native text. No new features or changed native commands, motion, timers, observers or UI ownership.

The diagnostics recorder now applies source-backed finite reason sets to nine additional producer events: Workspace startup wait, address cascade completion and address finish, incoming drag release, Hub projection cancellation/errors/failure/return rejection, and display placement preview. The R7c regressions verify source-declared accepted tokens and reject arbitrary sensitive tokens, check all newly audited raw Console sinks and exercise actual Projection logging. Event families not yet semantically inventoried keep their existing conservative lexical filtering; no universal privacy certification is claimed. Actual Zen Browser Console/private/multiwindow/profiler acceptance remains open together with critical Library NC4-022/082/083 safety and cancellation decisions.

## 0.3.0-preview.151 — Standalone Sine exception console hardening (NC4-089-R7b)

The independent Startup preferences, Magnetic Bookmarks, Page Progress, Workspace Transition and Center Assembly Sine entrypoints could pass raw Gecko/native exception objects to Browser Console outside the existing bounded diagnostics recorder. Those owners now log only a finite, explicit standard/native class (or `Error` on unsupported/throwing names) while retaining fixed operation labels; no exception message, stack or native object is sent. Startup, workspace and assembly diagnostic error-name fields use the same narrow classification.

Each entrypoint owns its local pure filter to remain independent of unpredictable Sine load order, hot reload and Layout availability. The generated Center Assembly output and its source are kept in sync, and existing native operations, UI, resource ownership, animation durations, timers, preferences and Library scanner are unchanged. A source-backed regression executes the installed console statements with hostile message/getter inputs and verifies only safe classes are emitted. CI and actual Zen/Sine native console and performance acceptance are distinct; R7c event inventories and Library NC4-022/082/083 memory/cancellation work remain open.

## 0.3.0-preview.150 — Bounded Layout/Home/Hub/Drag direct-console exceptions (NC4-089-R7a)

An independent full Layout source sweep found raw native exception objects in direct Browser Console warnings/errors from Home, Hub, Layout bootstrap, window lifecycle, tab drag/detach, Display placement, native address animation and startup search restoration. The existing Diagnostics recorder sanitized structured events, but did not own those direct Console sinks. Hub data-command failures also displayed arbitrary native exception messages directly in its status panel.

The Layout build now includes one *pure*, source-tested `nocturneErrorClass` helper with a **finite** set of standard/native exception classes and conservative `Error` fallback (including hostile/throwing `name` properties). Existing console call sites in nine Layout source fragments retain their fixed context and safe class only, never the error object/message/stack. Hub's data-operation and create-workspace status messages now use bounded fixed text, keeping the existing native command leases, busy state and ownership intact. Two source-backed regressions check class extraction, actual Home subscriber exception, Hub status and every touched Layout exception-console producer.

No additional logger, owner, writer, observer, timer, native command, UI feature or changes to drag/drop/Workspace operations. Independent root Sine scripts (Startup Animation, Magnetic Bookmarks, Page Progress, Workspace Transition and startup preferences) remain for separate direct-console audit; native Zen/Sine console/privacy/performance acceptance and all Library NC4-022/082/083 native memory/cancellation gates remain OPEN.

## 0.3.0-preview.149 — Keep Home Workspace command notices out of layout flow (native visual checkpoint)

User's first native preview.148 smoke reported no major functional regressions and slightly smoother motion, but the live Home `Workspace command in progress…` notice shifted vertically centered Home sections. The source-confirmed cause was the existing `.zh-workspace-pending` paragraph entering normal document flow on `hidden=false`. Preview.149 anchors only that existing status underneath the Workspace grid as an absolutely positioned, one-line clipped note inside a relative Workspace section. Full native warnings remain in accessible `textContent`, `aria-live` and a hover `title`, including the long unknown/never-settled warning. Command leases, timeouts, native blockers, workspace buttons and event observers are unchanged.

A source-extracted Home regression covers idle/pending/unknown/settled visibility, full status text and native command blocking, alongside static assertions of the out-of-flow layout geometry. This is a targeted source/CI correction, not a claim of a Gecko-rendered no-jump acceptance. User also observed Downloads Dock return blinking and laggy cross-monitor file drag; these remain separate native visual/performance cases requiring timings. An unrelated-looking Steam Store `ServiceTransportProvider` content error is not evidence of a Nocturne failure.

No new functionality, native calls, overlay owner, timers, preferences or scanner changes. NC4-022/082/083 Library memory/cancellation and NC4-089-R7 diagnostics audit remain OPEN.

## 0.3.0-preview.148 — Smart Search exception metadata privacy (NC4-089-R6)

A producer/source re-audit found that Smart Search's native provider error paths wrote the unfiltered `String(error)` to its externally readable diagnostic status and passed raw exception objects to Browser Console. Native/provider messages may contain URLs, tab titles or search context. The existing Smart Search entrypoint now retains only a bounded exception class (or `Error` fallback) in status and all its own warning paths; normal result/selection behavior and numeric counters are unchanged.

Source-backed regression coverage forces the **actual provider callback** to throw an exception containing a sensitive URL and verifies only `TypeError` remains in both the diagnostic status and captured console arguments. The existing partial-install failure fixture now verifies that a native exception URL does not survive registration rollback/status and Console warnings. No new data owner, logger, telemetry stream, window/DOM state, native operation, timeouts, persistence or features.

This closes the audited Smart Search exception producer at source/CI level only. Other direct `console.warn/error` owners, generic per-event semantic inventories, Zen/Sine native privacy/performance acceptance and Library NC4-022/082/083 upstream thumbnail/scanner limits remain OPEN.

## 0.3.0-preview.147 — Audit event-specific diagnostic reasons and Home Search console output (NC4-089-R5)

Independent source tracing found that known Library, media scan/refresh, native Download transfer, Home Search, Page Progress and selected motion events admitted arbitrary short `reason`/`status` tokens in the process-local recorder. The existing sanitizer now applies **event-scoped finite values** to 15 audited events while leaving other event families unchanged until reviewed. A dedicated Home Search snapshot error uses the existing restricted `name` exception-class field instead of generic `reason`.

The existing Home Search `console.info` forwarded its unsanitized `fields` object directly to Browser Console, bypassing the recorder's filtering. It now logs only the fixed event name while the sanitized structured metadata continues through `__nocturneTrace`. Source-backed tests cover producer values, rejected arbitrary tokens, exception-class preservation, and the console echo. No changes to browser data, UI rendering, native commands, services, motion timing, scanner, writer, or preferences.

These tests establish the audited producer families only; remaining event-specific semantic inventory, native Zen/Sine privacy/performance, and NC4-022/082/083 Library memory/cancellation gates are OPEN.

## 0.3.0-preview.146 — Preserve Closed Tabs error-class diagnostics (NC4-089-R4)

Independent producer/recorder audit found that `library.scope.error` emitted a native Closed Tabs observer failure class under `error`, a key rejected by the scoped diagnostic string filter. The existing Closed Tabs callback now emits `name`, the same restricted exception-class field already used by Layout and Hub. A production-source-extracted regression triggers actual observer disposal failure and confirms that the class survives while raw exception messages remain absent.

No new services, native commands, scanner, logger, writer, timer, observer, preferences, UI behavior or browser data access. Native Zen/Sine privacy/performance acceptance and full per-event semantic reason/status inventory remain OPEN.

## 0.3.0-preview.145 — Complete the scoped diagnostic producer evidence audit (NC4-089-R3)

Independent preview.144 replay reproduced additional evidence loss: native Workspace selection/return error codes were redacted; `chrome.attributes` preserved array length but nulled all node/attribute/value metadata; Download Bunny popup CSS surface samples, OS platform and lifecycle trace error class were missing. No private-data exposure in Zen has been reproduced.

The existing recorder retains a finite set of source-declared Workspace codes and OS platforms. For its internal `chrome.attributes` stream it now accepts only the actually observed root/known-node attribute names and a finite lifecycle-state vocabulary; unrecognized values become null. The existing Download Bunny popup trace accepts bounded CSS color/length/appearance and popup-flip grammar only in its known event context. Layout and Hub scope-error producers use the existing sanitized `name` error-class field instead of an unrecognized `error` key. Four new production-source regressions cover known/malicious strings, actual popup sampling and source producer compatibility. No UI, native drag, Workspace command, browser data mutation, additional writer, timer or observer. Real Zen/Sine privacy and performance acceptance remain OPEN.

## 0.3.0-preview.144 — Restore bounded diagnostic result fields (NC4-089-R2)

An independent post-preview.143 producer audit reproduced five lost traces/values in the actual recorder: drag mode transitions' previous/requested values, native dropEffect, Workspace command rejection codes, address phase labels and Home's snapshot-unavailable event (the latter had an invalid space). Additional source audit confirmed similarly affected Workspace phase, startup readiness, disassembly native result type, and address engine/easing fields.

The existing recorder now accepts strictly enumerated values for these known native/animation metadata fields, rather than allowing arbitrary strings. Address begin uses the same phase field as address finish; the Home error diagnostic uses a valid hyphenated event identifier. No native commands, UI, visual behavior, writer/storage/observer, preference or feature changes. Three production-backed regressions cover known values, rejection of unexpected strings and the actual Home producer. The preview.143 privacy guards, 256-entry throttle budget and existing native/privacy constraints remain in effect. All source/CI results and native acceptance are independently tracked.

## 0.3.0-preview.143 — bounded diagnostic metadata and manual checkpoints (NC4-089)

A0/A7 source audit found that the existing recorder accepted arbitrary object field names and unbounded throttle identities, while manually entered diagnostic marks stored arbitrary labels. The same recorder now admits structural event names, caps its per-window throttle identities at 256, rejects content-oriented field names and free-form string values (including URLs, paths and user text), restricts string details to existing diagnostic status/geometry classes, and uses safe short marker labels. Nested detail processing has a total 1024-node budget. Error-class names, native/window events, release telemetry and CSS geometry remain available. All snapshots still use the existing process writer, byte/session budgets, opt-out and private-window restrictions.

Four extracted production-source regressions cover sensitive fields/console echoes, invalid/manual marks, native event names and throttle eviction, and cyclic/high-fanout detail. The enforcement is conservative and may redact previously free-form diagnostic strings; it does not retroactively scrub prior files or guarantee semantic classification of every possible producer field. Native Sine/Zen diagnostics-on/off and privacy acceptance remain OPEN. No new feature, logger, persistent owner, observer, timer or network path.

## 0.3.0-preview.142 — Smart Search native controller ownership (NC4-086)

A7 source-level reproduction showed that an obsolete UrlbarController could continue resolving live-window Smart Search state after the native controller was replaced; a controller alias reporting a foreign window could resolve a different window's state. The existing provider now requires current native child/parent controller identity, consistent provider manager ownership, and agreement between active window and controller registries. Late Sine cleanup clears only its own state, not replacement mappings or target tokens. No new observer, timer, provider, UI, feature, preference or query-budget change.

Three source regressions cover stale controller/engagement, conflicting window aliases and late-dispose registry lifetime. Actual Zen 1.24.2b/Sine 2.3.3 multi-window/controller hot-replacement acceptance remains OPEN.

## 0.3.0-preview.141 — Page Progress retired network request identity reliability

A7 / NC4-087 source-extracted reproduction: when 19+ distinct top-level native NETWORK START request identities overlap, the previous hard-capped 16-entry strong Set evicts the oldest. A late STOP from that explicitly superseded request then incorrectly marks the current page load complete/canceled. The existing Page Progress owner now uses a WeakSet of superseded native nsIRequest objects for the lifetime of the active network transaction; old identities are not evicted by an arbitrary count or kept alive by the indicator, and the set is released on the accepted terminal event/unload. Existing Gecko aggregate progress for subrequests and the fallback for unknown STOP identities, visuals, timers, hosts and prefs remain unchanged.

Two new source-backed regressions verify the 21-start overlap with the oldest late STOP and weak identity lifetime across terminal/restart. Old-source negative reproduction for the overlap test confirmed. No new feature, native observer, control or animation. Actual Gecko/Zen network ordering, redirect/cancellation and perf acceptance remain OPEN.

## 0.3.0-preview.140 — Stable Library History date headings (NC4-085)

Existing Library History/Recently Closed rendering now reuses live date-heading DOM nodes when their displayed day and run position are unchanged. Stable group keys distinguish separate runs with the same date in non-date-sorted results, without an additional state owner, observer or cache. Unchanged result updates skip unnecessary DOM reconciliation; pagination, row and focus identity, scroll, native Places/SessionStore data sources and all existing actions are unchanged. Three source-extracted regression tests cover identical updates, repeated nonadjacent date runs, pagination extension/focus preservation and empty-view cleanup. No new user-facing feature or UI redesign; native Zen Browser acceptance remains OPEN.

## 0.3.0-preview.139 — Library History date-boundary pagination stabilization

NC4-021: when a date-sorted native PlacesQuery search returns an extra lookahead record already older than the 120-day History range, Library no longer advertises a phantom Load more page. The existing source/identity/date guards, 50-row steps, 500-row UI cap, native History fallback and conservative behavior for site/other sort orders are unchanged. One consistent cutoff is applied within the existing query invocation. No new feature, observer, timer, native data owner, disk writes or destructive operation.

NC4-020 independent audit: normal windows already have separate service leases onto the native PUBLIC Downloads list and window-qualified opaque handles, as required by existing architecture; native historical Places-only records remain available through the native Downloads view because DownloadHistoryList is not a drop-in replacement for the removable session list. New regression covers per-window lease/disposal isolation. Source-backed tests cover lookahead outside the range, exact date boundary and non-date fallback. Native Zen/Sine history and cross-window acceptance remains OPEN.

## 0.3.0-preview.138 - Bound Library scan UI wait without releasing native ownership

NC4-083: the existing Media service now coalesces overlapping refresh requests within one live media session, instead of queuing independent native directory scans for each Refresh click. The Library query owner schedules one 15-second UI-only deadline using its existing scheduler, reports when the native scan is still running and reconciles any eventual native result or error. Closing or switching the section cancels only the waiting UI callback and rejects stale row updates. The native Gecko scanner and its in-flight Promise/disposal barrier continue until real completion; no fabricated cancellation, overlapping folder walk, new Sine entrypoint, new user feature or altered file/thumbnail UX. Source-backed tests cover duplicate Refresh, deadline, late native completion and session teardown. NC4-022 image decode memory and NC4-082 native scanner pre-truncation allocation remain unchanged and OPEN; native Zen/Sine acceptance is separate.

## 0.3.0-preview.137 - Stabilize Library media refresh handles and row identity

NC4-077/092: preserve the last complete local-media cache and associated action handles if scanner or metadata staging fails. After a successful refresh, issue new opaque action IDs and revoke the previous generation while retaining an independent session-local viewKey for unchanged normalized paths. Library keys existing file DOM rows and focus by viewKey rather than action capability; rename, removal, close and opt-in pref invalidation retire old keys/handles. The native Zen scanner, file-open/reveal preflight, downloads, image loading, drag behavior and user-facing UX are unchanged. Existing diagnostics record only media section, status and result count (no file names or paths). Source-backed regressions cover failure, stale ID rejection, normalized paths, rename, session reopening and DOM reuse. Zen/Sine native acceptance remains OPEN.

## 0.3.0-preview.136 - Publish reproducible Downloads removal lifetime correction

Republish the preview.135 DownloadsService native-remove disposal fix with a canonical generated `library-services.uc.mjs` assembled from the current source. The initial preview.135 CI correctly rejected a stale generated bundle; a follow-up bundle-only correction passed deterministic assembly but was correctly blocked by release policy because a published runtime artifact changed without a version increase. Preview.136 preserves the same native removal lifetime contract and two regression tests while satisfying the existing build and version monotonicity rules. No additional native behavior, features, services or timers.

## 0.3.0-preview.135 - Close Downloads native-remove hot-reload lease gap

Independent review of the preview.134 NC4-090 source fix reproduced a generation handoff race: an old DownloadList.remove Promise may remain pending after DownloadsService.dispose removes its native view, while the replacement service attaches and attempts the same native removal. Track outstanding native removal Promises in the existing DownloadsService and await their settlement before releasing its view/lease. Reuse the current Downloads disposal barrier; do not add a new service, queue, timer, feature or OS operation. Two regression fixtures cover delayed completion and rejection with replacement startup. Keep the deliberate fail-closed rule for native operations that never settle. Cross-window and real Gecko event acceptance remain open.

## 0.3.0-preview.134 - Serialize existing Dock and Library Downloads bulk clear

Fix NC4-090: Dock and Library previously drove independent sequential removals through the shared Downloads service, allowing duplicate native DownloadList.remove calls for the same item. Dock now calls the existing shared clearCompleted method instead of maintaining a competing loop. The service rejects overlapping bulk confirmations, prevents concurrent removal of the same Download identity, rechecks eligibility and honors Dock's current epoch/teardown gate between items. The existing Library feedback reports a busy shared clear without claiming success. Keep the same native DownloadList and no disk-file removal, new UI surface, service, timer or user feature. Five source-backed regression tests cover Dock/Library overlap, row overlap, teardown cancellation and busy feedback; native Zen acceptance remains open.

## 0.3.0-preview.133 - Report skipped Downloads bulk-clear records accurately

Fix NC4-076: native Download entries can change eligibility between collection and sequential removal. The existing Downloads service now reports requested, removed, skipped and failed separately, without retrying or removing active/partial/blocked records. The existing Library bulk-clear status reports incomplete clearing when a record is skipped; its existing diagnostic channel records only aggregate counts. No new operation, UI feature, timer, observer or file deletion. Three source-backed tests cover skipped native state, native error and Library feedback. Native Zen acceptance remains open.

## 0.3.0-preview.132 - Serialize existing Library History destructive actions

Close NC4-084 source-confirmed command overlap: while native range clear is pending, a second range clear or a row Remove/Forget can no longer start. Native row deletion likewise prevents concurrent range clear, repeated removal and Forget until the operation settles. Reuse the existing Library `clearing` and `actionSerial` lifecycle gate, disable the Clear history action during the operation, preserve Copy, and release the gate on success/failure. Native confirmations, Places and SessionStore operations are unchanged. Two regression fixtures cover overlapping operations, failure and retry. Native Zen acceptance remains open.

## 0.3.0-preview.131 - Stabilize Library local-media preference invalidation ordering

Fix a source-reproduced Sine entrypoint ordering race: a Library preference observer could rebuild and open a fresh media session before the independent Library Services observer invalidated existing sessions. Defer the existing controller refresh until synchronous Gecko pref notifications finish, coalesce multiple same-turn notifications, and ignore the deferred callback after close/disposal or during a file drag. Keep the existing owner, file actions, UI, native scanner and timeout budget unchanged. Add two source-extracted lifecycle regressions. Decoded-image memory and native scanner allocation limits remain open; native Zen acceptance is not claimed.

## 0.3.0-preview.130 - Page Progress native request correlation hardening

Use request identity only for NETWORK START events known to be superseded: Gecko's network STOP and aggregate total-progress callbacks can legitimately carry other request objects. Preserve valid subresource progress and terminal events, while ignoring old request events after overlapping starts. Retain a bounded set of retired identities for the active load, clear it on completion/unload, and keep the approved motion and existing request-less fallback. Three new production-source regression tests cover aggregate progress, mismatched terminal requests, and multiple superseded starts. Physical Zen/Gecko acceptance remains open.

## 0.3.0-preview.129 - Preserve Page Progress across overlapping native navigation

Correlate overlapping Gecko top-level START/STOP and progress callbacks by their available native request identity. A late STOP or progress update from an older request can no longer complete or repaint the new active load when both request identities are available. Preserve the current indicator animation, standard no-identity behavior, native page ownership and no idle polling. Source regression tests cover the interleaved sequence; native graphical acceptance remains open.

## 0.3.0-preview.128 - Initialize History search and restore Smart Search UTF-8 text

Initialize native PlacesQuery options before a first or changed History search; do not dispatch a stale search after a superseding query. Restore the original Smart Search domain/workspace/container separator. Add independent regression checks for both paths. Real graphical Zen acceptance remains open.

## 0.3.0-preview.127 - Invalidate local Library access when folder permissions change

Closing access or changing extra folders invalidates previously issued file handles and scan sessions in every window. An earlier scan or open folder picker cannot restore access after settings change. Active file sections reload from the new settings.

## 0.3.0-preview.126 - Library history pagination

Keep Load more available when a history search page contains only out-of-range visits. Check one extra native record to distinguish a full last page from a truncated result. Explain the 500-record limit and native history fallback.

## 0.3.0-preview.125 - Smart Search query lifetime and Library media refresh

Ignore results, cancellation and completion from superseded address-bar queries. Publish local media rows and their action targets together after a successful scan; retain stable row IDs for surviving paths and keep the previous snapshot usable after a failed refresh.

## 0.3.0-preview.124 - A6 overlay handoff

Guard nested overlay requests during preflight and stop dismissing panels when the requesting owner is replaced. A later refusal leaves already dismissed panels closed. Native focus and Escape validation remain open.

## 0.3.0-preview.123 — A5.7c native drag topology lease and stale source retirement

- Capture only the native active Workspace, visible tab identity/order, Split membership, pinned state, physical native tab parent and per-tab Workspace UUID while a native tab gesture is active. This ephemeral witness is compared against Zen's live topology, not used as a second tab store.
- Retire a stale native drag gesture before the existing Tab Sync structurally removes/reparents its chrome source, including TabClose, TabMove, TabHide/Show, native Split changes, Workspace switch, native DOM mutation and same-tab migration to a folder/another Workspace. Selection/title/icon-only changes do not cancel the gesture.
- Preserve intentional synchronous TabMove from a previously accepted local native drop, and separately invalidate a return-to-strip insertion animation if its source structure changes after OS drag completion.
- Verify a cross-window source lease again on delivered native drop; when its original topology no longer matches, retire the precise source token and prevent any stale native move/adopt/detach.
- Keep the existing Drag Engine/Tab Sync owners, native OS handoff, watcher and no-idle-polling behavior. Add ten source-extracted regression cases covering native disappearance, reparenting, rearrangement, Split/Workspace, accepted commit, foreign drop and insertion-tail cleanup.
- Native Gecko/Zen behavior, OS DragSession termination, mixed-DPI, workspace/Folder/Split edge cases and visual/performance acceptance remain OPEN.

## 0.3.0-preview.122 — A5.7b native empty Workspace tab adoption

- Accept a cross-window ordinary native tab over the real empty tab strip or native new-tab control only when Zen proves the active Workspace and its connected native regular-tabs container are empty (excluding native `zen-empty-tab` placeholders).
- Preserve the existing exact source drag token, private-window and chrome/viewport gates. Bind the destination preview lease to the native Workspace manager and active ID; a switch or manager replacement retires the old destination without a native command.
- Call `gBrowser.adoptTab` without a guessed `tabIndex`; delegate the resulting tab's physical Workspace placement to Zen's existing `moveTabToWorkspace`. Verify native ownership, workspace ID and actual native container membership; classify partial/off-target results separately from confirmed, never synthesize a rollback or detach.
- Reject unsupported Pinned, Essentials, Split, Folder, Glance, hidden source and stale/hidden native target cases. Keep the current native return/OS image ownership unchanged and add a noninteractive indicator on the real new-tab affordance.
- Add eleven extracted-source regression cases for native eligibility, zero-tab/hidden-tab boundaries, trusted coordinates, native results/throws, cleanup and pointer exit. Real Zen 1.24.2b/Gecko acceptance, multiwindow Workspace placement and DPI/OS drag outcomes remain OPEN.

## 0.3.0-preview.121 — A5.7a native startup search restoration generation fence

- Bind delayed startup search restoration to a captured native tab drag gesture token and an exact generation. Stale queued timers cannot clear a successor timer or replay search after the next gesture.
- Invalidate pending native search restoration on trusted pointer/keyboard activity, native TabSelect/Open/Close and genuine address input, as well as drag start, cancellation and Layout disposal.
- Verify the selected native tab still exists, remains empty and retains its original native URI immediately before restore. Preserve native URLbar/Zen command ownership, the 80 ms delay and successful un-interrupted behavior.
- Add source-extracted deterministic regressions for quick repeat, stale timer reentrancy, native input/navigation, active drag and cleanup. No new scheduler, global controller or URLs/queries in diagnostics.
- NC4-065 empty-toolbar cross-window adoption and NC4-066 native topology change during drag still require separate native admission and lifecycle evidence; no speculative native mutation in this release.

## 0.3.0-preview.120 — A5.6a native file paint gating and Tab Bunny image audit

- Keep the Windows OLE-safe 16 ms File Bunny timer and native widget movement, but skip visual style writes and forced layout when relative artwork is below bounded subpixel thresholds.
- Preserve every physics/release pose, source ownership, native payload, cancellation and popup-hidden cleanup; aggregate paints/skips in the existing privacy-bounded diagnostics.
- Remove unreachable Tab Bunny native-image reset logic while retaining conservative single-OS-image ownership after outside handoff. Local return-artwork reactivation awaits real Gecko validation.
- Add extracted-source regression coverage. Native OS DragSession identity, paint/fidelity, file drops and matched profiler remain OPEN.

## 0.3.0-preview.119 — A5.5a native drag source watchdog recovery

- Bound unavailable Gecko drag session capability errors separately from absent sessions for tab Drag Engine, while preserving the exact gesture token and never synthesizing a native drop.
- Arm Downloads Dock native file-drag recovery before optional Bunny artwork. Use one source-owned timer for both session liveness and popup readiness; stop hidden popup rendering without ending the OS drag.
- Add a bounded Dock-free Library fallback file drag watchdog; preserve Dock as the sole gesture owner when its bridge accepts the Library drag, defer Library close while a native file gesture is outstanding.
- Attach native file preview DOM only after its cleanup state is created, preventing orphan artwork on construction failure.
- Add extracted-source regression cases for missing/unknown/live sessions, optional art failure, unexpected popup closure, Library fallback and source cleanup. Actual Gecko OS DragSession identity, Explorer/upload drop, cancellation and performance remain native acceptance gates.

## 0.3.0-preview.118 — A5.4a display coordinates and preview freshness

- Retire unused Hub snap/display helpers; both workspace projection and tab Bunny already use the same Display Engine placement path. The supported native snap policy and opt-in preference are unchanged.
- Include actual monitor work-area and target rectangle geometry in the display preview identity, so same-monitor taskbar/work-area changes reflow the preview rather than presenting a stale target.
- Move the compact native preview popup when its actual screen anchor changes, even on the same monitor; emit a bounded diagnostic without raw display, tab, workspace or file data.
- Add pure placement and extracted runtime popup regression tests. Native Gecko multi-DPI/OS drag/window placement and visual acceptance remain pending.

## 0.3.0-preview.117 — A5.3a shared native file-drag ownership

- Route Downloads Dock and Library completed-file drag through one window-local Downloads service and one synchronous Gecko file/URI payload constructor.
- Revalidate the current native Download identity, completed state and actual filesystem existence at dragstart; reject removed/stale records and untrusted payloads.
- Preserve explicit private policy: Dock may drag a native private download from its own list; Library stays disabled in private windows. Keep native OS copy/move negotiation and existing file Bunny image/cleanup ownership.
- Add bounded privacy-safe native payload outcomes and regression coverage. Native Zen/Windows Explorer/file handoff, mixed-DPI visuals and profiler acceptance remain pending.

## 0.3.0-preview.116 — A5.2b native Split group convergence

- Verify the exact native Split data and physical group membership after a drop, including the original members and source tab; do not certify a partial result from a truthy native call.
- Confirm both two-tab group dissolution and surviving three-plus-member group integrity on native unsplit. Treat inconsistent membership as unverified; never roll back native data speculatively.
- Revalidate source group members after selection callbacks, preserve exact drag-token cleanup, and add regression fixtures for partial native outcomes.
- Native Zen, OS DragSession identity, multi-window/DPI, visual and performance acceptance remain pending.

## 0.3.0-preview.115 — A5.2a Split drag transaction admission and cleanup

- Check actual Zen Split eligibility before native `splitTabs`: fail closed when pinned/normal role mixing or Live Folder combinations would cause an unadvertised tab clone, when Essentials is unsupported, when Glance remapping or hidden/empty tabs change source identity, and when an existing Split group is full.
- After selecting the dragged native tab, revalidate source gesture token, selected tab, partner ownership, Split group identities, current input phase, viewport and edge frame before the irreversible `splitTabs` call.
- Never restore an earlier native selection after a failed or throwing split command that already mutated native group membership. Record `drag.native.outcome` with a bounded rejection/retarget reason.
- All delivered Split Drop branches, including toolbar return, settle only the captured source token in one finalizer. An incomplete settle cancels that exact still-owned gesture; a synchronously superseding gesture remains untouched.
- Add source-backed regression tests for clone cases, hidden/Glance/Essentials, Split limits, reentrant selection, partial native mutations and exact cleanup. Native Zen acceptance remains pending.

## 0.3.0-preview.114 — A5.1b native drop postcondition and consumed gesture

- Verify synchronous local move/group placement against the current Zen-owned visible tab topology, not `moveTabBefore/After`'s void API outcome or an assumed mirror position. Avoid invoking native move for already-adjacent slots.
- Classify cross-window `adoptTab` by its returned native destination tab and actual position; distinguish null/rejected, valid transfer to an unexpected slot and unverified ownership. Avoid a second speculative native repair move.
- Split/unsplit confirms actual Split-group membership rather than assuming that a native API invocation succeeded. Native input delivered to a rejected/partial drop consumes the exact source gesture, preventing a later dragend from detaching the original tab as an OS fallback.
- Require trusted dragend and a current exact window-local drag lifecycle token before source placement/detach logic. Tokens do not certify Gecko OS DragSession identity.
- New bounded `drag.native.outcome` result traces, six source-backed tests and adjusted existing fixtures. Native OS-session identity, true multi-DPI behaviour and delayed native state convergence remain open.

## 0.3.0-preview.113 — Native drag source arbitration (A5.1a)

- Require trusted custom-flavor drag input and a current, valid source-controller token before resolving native tabs. Explicit Gecko DataTransfer payload remains authoritative when available.
- In protected dragover with hidden payload, scan browser windows for exactly one eligible source rather than selecting the first arbitrary controller. Reject ambiguous concurrent owners without native mutation.
- Release a stale incoming preview when the source becomes unresolved. Keep the existing drag lifecycle, source cleanup, private-window and Split-group gates; do not introduce an independent OS session registry.
- Add source-backed regression tests for concurrent sources, revoked tokens, explicit payload, untrusted input, Split/private isolation and stale preview cleanup. True native DataTransfer event identity and commit postconditions remain A5/native gates.

## 0.3.0-preview.112 — Native drag phase and edge frame audit

- Reuse one native-input phase gate across strip drop, Split Drop, Bunny dragend, incoming preview, startup/workspace and URLbar interruption. Suppress native mutations on conflicting phase, without interrupting an unrelated pointer gesture.
- Snapshot horizontal native toolbar/control geometry outside the moving tab lanes. Validate on native commits and existing ResizeObserver/toolbar mutation callbacks; cancel obsolete local sessions and retire incoming previews without new RAF, observer or timer.
- Preserve native Gecko non-client CSS regions pending real point-level acceptance. Maintain identical source/native-data semantics and bounded diagnostics without titles, URLs or file paths.

## 0.3.0-preview.111 — Incoming drag geometry lease

- Fence foreign-window previews and drops by exact source controller/token and destination size, DPI, mode and motion phase. Require fresh trusted dragover after invalidation; reject stale custom drops without native mutation.
- Retire incoming lane autoscroll and preview on geometry/phase changes, leave, local takeover and source completion/cancellation. Source OS ghost remains independent. No new scheduler or animation engine.

## 0.3.0-preview.110 — Bounded native hit regions

- Make the decorative toolbar contour input-neutral; preserve the Home native handle on the existing bounded toolbar wrapper instead of the alpha-mask rear fade. Suppress hidden compact and motion-owned native drag regions.
- Give the active address shield and Split Drop explicit no-drag semantics. Reject conflicting owner phases and nonfinite/outside split drop coordinates before native operations.
- Retire the local tab drag or its visual tail on changed chrome viewport size, DPI or native window mode, without synthesizing a native drop or detach. Preserve ordinary window movement and validate exact dragend identity first.

## 0.3.0-preview.109 — Resting geometry freeze

- Freeze ordinary center, height, contour and structural projection during local/incoming tab drag, lane drag and Address Cascade transitions; replay deferred native projection when the interaction releases or the cascade is fully hidden.
- Keep explicit Bunny/Split pull measurements and lane drop autoscroll with their interaction owners; defer automatic selection scrolling, hover-mode changes and ordinary overflow motion.
- Validate the current native drop target before acting on a frozen mirror. Preserve existing native hit-region CSS and the accepted native drop path.

## 0.3.0-preview.108 — Geometry transaction audit

- Reject geometry preflight during projection/contour reentry and reconcile native topology before capture, even before observer delivery. Preserve pending geometry work on rejection.
- Guard height, partition and contour against phase, ownership and invalidation changes. Stop stale lane reparenting, retain exact projection frame ownership and revalidate the mirrored topology around force paint.
- Preserve existing native animation and hit-region policies; add regression tests for reentry, stale callbacks, freeze and rejected preflight.

## 0.3.0-preview.107 — Resting toolbar geometry plan

- Extract a pass-local collapsed budget and pure partition dimensions, calculated before lane moves and focus callbacks. Preserve the current widths, address reserve and overflow policy.
- Reject strict preflight during partial drag/address cascade centering. Retire stale viewport/order plans and request reconciliation through the existing scheduler.
- Reuse the authoritative native topology snapshot for Split View membership, selection and pin projection instead of rereading native group state during each mirror update.
- Preserve post-partition physical Split measurements, native hit regions and existing motion owners. Native validation pending.

## 0.3.0-preview.106 — Explicit geometry preflight outcomes

- Acknowledge only completed center/height/contour preflight and preserve fresh invalidations raised by synchronous callbacks.
- Skip unsafe Startup or Workspace incoming visuals via existing cleanup; preserve the native workspace result without retry.
- Report bounded preflight outcome diagnostics; add regressions for rejected, stale and legacy providers. Native validation pending.

## 0.3.0-preview.105 — Geometry coordinator audit and centering requests

- Distinguish center, height and contour requests; preserve immediate native ResizeObserver/toolbar reconciliation while avoiding an unconditional second centering pass.
- Fence queued callbacks with exact tickets, reject nested preflight transactions and preserve invalidations raised during forced measurement.
- Validate height input and CSS readback; report bounded pass errors. Stop the visible contour transition tail during close.
- Reuse initial address margins/extent when no address geometry write intervenes; reuse the same collapsed width sum for address budgeting and tab centering.
- Retain existing synchronous topology, motion and native interaction boundaries; native paint/performance validation remains pending.

## 0.3.0-preview.104 — Geometry coordinator, first slice

- Coalesce Layout height and contour invalidations into one lifecycle-owned RAF with explicit dirty bits. Reuse a pass-local row snapshot when height is unchanged; never reuse pre-height-write rectangles for contour.
- Keep synchronous workspace/startup preflight and native centering paths. Preserve bounded visible-contour follow work through the same scheduler.
- Reuse calculated collapsed slot widths instead of traversing split members repeatedly within a centering pass. Add coordinator regressions for coalescing, height writes, reentrant invalidation, preflight and teardown.

## 0.3.0-preview.103 — Contour lifecycle audit

- Fence bookmark registry installation, release and stale generations; retire revision-1 in-package leases before installing revision 2.
- Hold stable geometry under live exclusive phase markers, reject CSS-hidden bookmark shelves, and suppress even forced contour writes during closing.
- Reuse the committed stable envelope on repeated prehover while its existing invalidation revision and provider are unchanged.
- Native mask serialization, paint and performance remain unverified.

## 0.3.0-preview.102 — One contour renderer

- Cut over Magnetic Bookmarks from an independent SVG renderer and CSS override to a resting envelope provider. Layout alone selects visible/stable geometry, renders and commits the mask.
- Remove the bookmark contour RAF, fade preference observer, panel observer and redundant resize listener; hold the last mask during active stable hover and reuse existing Layout invalidation.
- Preserve accepted stable SVG reference hashes; handle provider unload/stale snapshots, silently rejected CSS writes and reversed off-surface shelves. No standalone Refined coexistence requirement; Nocturne lifecycle and native visual/performance validation remain.

## 0.3.0-preview.101 — Shared contour geometry contract

- Extract pure contour preferences and distinct visible/stable envelope calculations into the existing contour algorithm; Layout consumes the visible policy with unchanged SVG rendering.
- Commit the ordinary contour cache only after successful mask generation and both style writes, preserving the prior values on partial failure.
- Add parity and fault-injection fixtures. Magnetic Bookmarks retains its existing stable override until the provider migration; no CSS, native hit region or animation changes.

## 0.3.0-preview.100 — Center Motion handoff audit

- Lock Center Motion before release validation and reject recursive invalidation/owner callbacks; retain native close and exact cleanup boundaries.
- Extend the existing resting geometry lease to layout mode flags and existing slot-resize/mode callbacks.
- Measure finished incoming Fold resting geometry after phase cleanup inside the existing two-frame handoff when diagnostics are enabled; cancel stale samples without touching successor marks.
- Native paint/performance acceptance remains pending. Magnetic Bloom is still disabled.

## 0.3.0-preview.99 — Fold mounted coordinate and terminal guard

- Correct Fold proxy and portal coordinates against the actual mounted layer origin; validate resting card and Split child rectangles before effect allocation.
- Fail open for partial scrollport/Island clipping, nontranslation coordinate frames, or mismatched geometry rather than showing a full or displaced clone. Check finished incoming Fold pose before normal handoff.
- Repair the window-geometry fixture for the preview.98 invalidation dependency. Bloom remains disabled; post-release native painted-pose and performance validation are pending.

## 0.3.0-preview.98 — Center Motion resting geometry lease

- Validate viewport/DPI, row, lane, Island, slot and Split handle layout metrics, scroll offsets and Fold fractional local rectangles at capture, resume and handoff.
- Reuse existing Layout resize and scroll events to retire stale Startup/Workspace visuals; preserve the native Workspace command and explicit-close lifecycle. No new observer or animation scheduler.
- Bloom remains disabled; actual mounted proxy alignment and native final-pose validation are separate.

## 0.3.0-preview.97 — Native strip topology contract

- Bind Center Motion to the last committed native strip topology and exact mirror nodes/parents; detect order, membership, split, selection and pin changes, including equal-count replacements.
- Invalidate stale Startup/Workspace visuals through their existing owners and reconcile changed mirror topology at handoff. Keep the native Workspace command single-owned and preserve the explicit-close lifecycle.
- Add six permanent regressions. Geometry, scroll/overflow and final-pose validation remain the next A3.6 substage; Bloom remains disabled.

## 0.3.0-preview.96 — Independent Bloom Assembly integration audit

- Freeze the exact live WAAPI cohort after candidate preparation; recheck paused state, zero time, document timeline, original finished promise and owner/lease identity immediately before Boot handoff.
- Reject late Home admission after cohort freeze, bound Home targets and prevent stale candidate direct writes or delayed callbacks.
- Keep interruption atomic for Bloom rather than replaying partial settle effects. Existing Fold remains the shipped default. Add five regressions; native validation remains pending.

## 0.3.0-preview.95 — Dormant coordinated Bloom Assembly

- Connect the explicit Bloom plan to the existing Startup Assembly, Center Motion, direct chrome effects and Home lease. Keep the shipped source switch disabled and preserve the default Fold path.
- Prepare panel, Island shape/label, native address controls and bookmark leaves on the common visible clock. Batch computed-style checks without adding per-frame work; bound direct preparation and fail open on incompatible effects.
- Require compatible owners and recheck the inherited deadline before and after Boot. Late chrome is ungated without replaying Bloom. Add seven regressions; native verification remains pending.

## 0.3.0-preview.94 — Shared Bloom timing and isolated Home

- Define the common full Bloom Assembly timing budget and share the Home stage schedule between the real Home owner and the generated comparison Lab.
- Prepare individual native Home UI leaves on the existing structural lease and exact outcome/epoch contract. Validate computed style, paused effects and cleanup; preserve normal Fold startup and late Home behavior.
- Keep Bloom dormant until remaining surface/Boot integration, native geometry and visual acceptance. Add seven permanent regression cases.

## 0.3.0-preview.93 — Independent Bloom acquisition audit

- Require consistent common completion and late-admission budgets; fence explicit Bloom and its Fold fallback across synchronous owner replacement and exact once-only epoch resume.
- Verify paused WAAPI effects, the document timeline and stable finished promise at interior samples; retire replacement promises before cancelling. Fail open for competing real-card effects.
- Preserve original Fold CSS specificity and add five regressions. Production animation selection remains unchanged.

## 0.3.0-preview.92 — Isolated real-slot Bloom acquisition

- Add an explicit Assembly-owned, paused real-slot Bloom candidate with shared timing admission, computed style/geometry preflight and transactional Fold fallback.
- Reuse Center Motion's exact handle, lifecycle, outcome ledger and existing freeze marker. No production caller selects Bloom; normal Startup, Workspace and Close remain Fold.
- Reject stale/reduced-motion/competing effects and partial acquisition; retain source-backed regressions. Native visual/compositor verification pending.

## 0.3.0-preview.91 — Magnetic Bloom comparison foundation

- Extract the existing Magnetic Fold math into a shared pure module without changing any trajectory or runtime owner.
- Add a deterministic, generated offline comparison Lab and bounded real-slot Bloom candidate algorithm; production Startup, Workspace and Close still use Fold.
- Cover documented stage windows, large collection stagger, fixed-slot scale bounds and generated source identity with regression tests.

## 0.3.0-preview.90 — A3.4 independent motion audit

- Capture terminal Startup outcomes before invalidating ownership; distinguish mixed epoch-only legacy handles, and detect cancellation of retained finished animations.
- Fence late admission after synchronous cleanup, bound timer acquisition failure and release interrupted surfaces without resealing them.
- Preserve sampled scale across repeated address phases and prevent stale cleanup or geometry interruption from altering a replacement URLbar.

## 0.3.0-preview.89 — Startup completion ownership

- Track exact direct, tab, bookmark and Home animation outcomes in Assembly, distinguishing completion, cancellation and intentional retirement.
- Keep the existing single completion timer and bounded watchdog; allow one capped grace interval when the planned boundary arrives before effect completion. Stop late admission at that boundary.
- Retain Home's structural lease until common completion, retire it on interruption, and fail open without sealing cancelled proxy effects. Workspace, Close and legacy owner contracts are preserved.

## 0.3.0-preview.88 — Address phase and cascade completion

- Bind the address wave to its exact phase and finite document timeline epoch; same-direction replacement retimes the cascade from current visuals.
- Observe WAAPI cancellation immediately; use bounded phase, wave and handoff recovery, fence stale callbacks and clean replaced URLbar markers without dismissing the replacement.
- Roll back partial wave acquisition and isolate cancellation failures. Existing native address commands, visual curves and preference IDs remain unchanged.

## 0.3.0-preview.87 — Startup document timeline epoch

- Prepare initial Assembly, tab proxy, bookmark and Home effects paused, including boot-disabled startup; start exact acquired effects on one document timeline epoch.
- Late Home and late chrome reveals use the shared document elapsed time; retain absolute watchdog and explicit legacy owner fallback.
- Reject inactive/foreign timeline, cancelled/stale effects and duplicate resume; fail open on acquisition or epoch failure. Existing Fold trajectories and native commands unchanged.

## 0.3.0-preview.86 — Shared startup timing plan

- Generate the existing Startup Animation entrypoint from a pure timing plan and the controller source.
- Use a single full-sequence budget at readiness, launch and Boot handoff; fail open when a late target cannot complete before the cap.
- Preserve normal choreography and preferences; document-epoch synchronization and native verification remain pending.

## 0.3.0-preview.85 — Startup absolute watchdog and audit

- Correct stale Home source-contract assertion in preview.84 CI; keep captured lease and generation guards.
- Transfer the exact Prelude deadline and cap all Assembly finish/rearm paths; reject stale timer callbacks and late orphan startup replay.
- Bound the Center Motion pending gate to the known startup deadline; isolate partial cancellation and setup failures.
- Fail open on startup preflight, settle and late readiness errors; skip reveal when the complete sequence cannot fit its remaining budget. Normal choreography unchanged.

## 0.3.0-preview.84 — Startup readiness and Home structural lease

- Resolve Home readiness within the existing icon budget and reject late automatic Home opening after the Assembly launch boundary.
- Preserve Home's animated children during passive native data and preference refresh; reconcile the latest state on exact lease release.
- Resample resources on strip/engine/Home identity replacement; include actual tab topology in boot quiet detection and warm Home without a horizontal strip.
- Fail open on readiness/RAF/resume exceptions; retain native placeholder behavior and approved animation parameters.

## 0.3.0-preview.83 — Boot adoption and Home startup lease

- Transfer exact boot/phase baselines from Prelude to Assembly; isolate cleanup failures and fence stale prelude callbacks.
- Own native readiness frames and cancel them on teardown; avoid recreating the startup pending gate after Assembly has finished.
- Give Home an exact timeline-bound startup lease, roll back partial effects, reject closed timelines and retire effects before replacing animated children.
- Preserve the existing choreography, eligibility, timing and native data ownership. Four new regression cases; native verification pending.

## 0.3.0-preview.82 — Startup direct effect ownership

- Own each direct WAAPI effect before pause/currentTime; cancel late or failed acquisition, restore exact recorded styles and settle external cancellation.
- Capture one Center Motion engine for Assembly; release rejected handles, restore bookmark fallback eligibility and avoid mixed-generation acquisition.
- Observe boot logo cancellation; six focused startup regression tests. Existing timing, eligibility and choreography unchanged. Native verification pending.

## 0.3.0-preview.81 — Motion preflight and bookmark geometry audit

- Settle close phase and Magnetic Bookmarks before the first target/visibility measurement; native close bypass on failed preflight or replaced engine.
- Coalesce bookmark preference changes during exclusive motion and apply them after the last phase; synchronize suspension before forced contour and Assembly preflight.
- Three new regression tests; preserve native close/Workspace command semantics, timings and trajectories. Native verification pending.

## 0.3.0-preview.80 — Independent close motion acquisition review

- Bypass decorative close motion if visible horizontal tabs or the required bookmark fold cannot acquire their effects, if the captured engine is replaced, or if a control effect fails.
- Release acquired effects before invoking the original native close once; retain normal Fold timing and native-sidebar bookmark fallback.
- Four permanent regression tests. Native acceptance remains pending.

## 0.3.0-preview.79 — Independent Workspace admission and selection review

- Require the selected Workspace in the authoritative list, distinct physical containers and exact exclusive pin-role membership, including nested group ancestry.
- Recheck the actual peer gate and native manager after the final native busy check; preserve foreign reservations on rejection.
- Four permanent regression tests; no animation timing, close behavior or native data ownership changes.

## 0.3.0-preview.78 — Center Motion transactional proxy ownership

- Reserve the exact tab proxy handle before acquisition; fence reentrant callbacks across both tab and bookmark surfaces, restore exact markers and roll back partial DOM/WAAPI initialization.
- Register favicon observers and listeners individually before acquisition; ignore callbacks after release.
- Fail open as a whole surface on partial WAAPI failure; retain close effects only during the actual native commit, never from the closing marker alone.
- Eleven new regression tests. Preserve normal Fold trajectories, durations and native commands; native verification pending.

## 0.3.0-preview.77 — Bookmark fold lifecycle ownership

- Track exact bookmark fold handles, cancel superseded effects, restore original inline priority and marker, and roll back partial WAAPI acquisition.
- Keep exact close-owned sealed handles through the existing close phase; reclaim them on replacement; fence Center Motion handoff callbacks.
- Suspend Magnetic Bookmarks across lifecycle motion phases. Preserve existing trajectories and native command ownership.
- Eight focused regression tests added; tab proxy acquisition audit and native verification pending.

## 0.3.0-preview.76 — Native Workspace topology and transfer preflight

- Verify Glance parent and physical Essentials section for Workspace selection; verify nested group ancestry and active native browser compatibility for Return.
- Reject unsupported Glance Return topology, preserve native window and existing close confirmation.
- Cancel optional Free startup on trusted input without releasing the actual native lease. Fence early Projection takeover and disconnected monitor success; clean partial Return observer acquisition.
- Nine new regression tests; native validation pending.

## 0.3.0-preview.75 — Integrated Workspace command safety audit

- Bound optional Free startup wait without releasing the native command; fence late automatic actions.
- Guard exact pending identity and reentrant admission; reconcile Return physical ownership and group metadata.
- Tighten destructive pin-role and single-window checks; scope Trash readiness delay.
- Nine new regression tests; native validation pending.

## 0.3.0-preview.74 — Workspace native close completion and pending recovery

- Keep Return's lease in the surviving original window until exact native child close and chrome context discard; reject ambiguous native destinations, preserve native close confirmation.
- Cancel only opener-side Projection setup on actual close or trusted takeover; preserve active native command ownership.
- Scope late Hub results to the opening session; bounded native-busy refresh, retryable controls and exact partial-admission cleanup.
- Ten new regression tests; native acceptance pending.

## 0.3.0-preview.73 — Workspace pending presentation and Return peer reservation

- Reserve the surviving source's existing Workspace gate while the managed Return request is pending; independent third-window selection remains available.
- Home and Hub show shared pending/unknown state without timing out the actual native command. Hub can yield while not dragging.
- Keep exact lease release on settlement only. Six new regression tests; native validation pending.

## 0.3.0-preview.72 — Independent Projection search review

- Preserve the exact prepared native placeholder across placement and search; reject replacement before focus or any native search command.
- Own search retry delays by the existing Projection scope; settle on disposal and stop on timer acquisition failure.
- Four regression tests; no native placement, Return lease or UX timing changes. Native validation pending.

## 0.3.0-preview.71 — Projection and detach placement lifecycle

- Scope startup observers, input and native placement delays to Layout; cancel and settle on teardown, close or trusted input.
- Scope Projection startup guard, capture and readiness to Hub; reject stale automatic work without cancelling native data commands.
- Preserve native geometry and existing animation timings. Four new regression tests.

## 0.3.0-preview.70 — Projection native data safety

- Keep selection and native placeholder preparation within the same Workspace command lease; fence startup search by exact native identities.
- Leave residual synced startup tabs intact rather than enqueue an unsafe cross-window TabClose. Zen remains responsible for startup cleanup.
- Verify exact live synced tab identities before native Return; reject uncertain ownership and overlapping managed data operations. Native close remains a request, not a confirmed result.
- Six added regression tests; native validation pending.

## 0.3.0-preview.69 — Projection startup ownership

- Reject stale Workspace readiness and guard ownership after manager replacement; fence automatic selection/search by the current projection identity.
- Roll back partial readiness observer registration and release child listeners independently. Route bounded Projection diagnostics through the existing recorder.
- Two regression fixtures; destructive startup-tab cleanup and Return verification remain open. Native validation pending.

## 0.3.0-preview.68 — Independent Workspace data review

- Require an authoritative native workspace list to confirm deletion; a failed native lookup returning null is not proof of absence.
- Invalidate an old Trash purge approval when a new preflight fails; capture and revalidate removal timestamps, including the all-age filter. Reuse the initial native ownership snapshot for batch preflight, with fresh per-tab validation retained.
- Capture native manager, browser and Free/Trash roles when a Trash card drag begins; reject stale role/owner changes before restore and suppress false settlement animation.
- Four new regression tests and strengthened existing fixtures. Native validation and the native removeWorkspace reentrancy limitation remain open.

## 0.3.0-preview.67 — Reconciled Workspace transfers and Trash outcomes

- Verify native Workspace tab ownership against physical normal/pinned containers and refreshed native tab caches. Stop transfers on mismatch or exception and never remove the source Workspace unless its owned-tab set is demonstrably empty.
- Journal confirmed, retained, unconfirmed and unattempted transfers/purge outcomes. Write removal timestamps only after confirmed physical transfer, report metadata failures, and honor native close veto without continuing an invalidated approval.
- Revalidate Free/Trash roles, manager identity, window count and eligibility at destructive boundaries; require the data lease, verify rename/reorder outcomes and suppress false successful drag absorption. Preserve native partial results without rollback.
- Thirteen additional regression fixtures. Native validation and stuck-command recovery remain pending; no intended animation timing or preference-ID changes.

## 0.3.0-preview.66 — Native Workspace command ownership

- Share the existing window command gate across Home, Hub, Free startup, projection and the switch before workspace deletion. A process-local data token serializes Nocturne-originated data mutations across synced windows; no native method wrapping or replacement.
- Confirm native active container, browser container bindings and selected tab ownership rather than treating a fulfilled switch promise or active ID as success. Motion consumes the same lease and reveals incoming content only on verified native outcome.
- Share Free designation between startup and Hub, revalidate roles after asynchronous/synchronous mutations, keep the startup claim retryable after failure and avoid duplicate ambiguous Free creation. Preserve native partial results without destructive rollback.
- Guard projection takeover and Trash creation/transfer entry points. Full destructive move/purge journal, pending UI recovery and native validation remain open. Sixteen added regression tests; no intended visual timing or preference-ID changes.

## 0.3.0-preview.65 — Layout registration self-review

- Register the captured Diagnostics owner, native listeners and Sine cleanup before publishing synchronous StartupState. Guard subsequent startup activation/observer registration against reentrant disposal or stale generation.
- Roll back registration on setup failure; two regression fixtures for synchronous cleanup and injected dispatch failure. No change to animation timing, preferences or diagnostic writer. Native verification pending.

## 0.3.0-preview.64 — Explicit Layout terminal handoff

- Register the current Layout cleanup owner with Diagnostics; a real chrome-window unload delegates directly, and disposal waits for explicit Layout completion rather than assuming the next microtask ends all listeners.
- Ignore descendant lifecycle events, including retargeted events where the original target is not the chrome window/document. Keep the idempotent native Layout fallback for unavailable or forced-disposed Diagnostics.
- Nine regression fixtures for separated microtasks, native/Sine paths, replacement, disabled recording and descendant events. No new prefs, writer, shutdown delay or intended visual changes. Native evidence pending.

## 0.3.0-preview.63 — Diagnostic writer self-review

- Check all available window aliases and the process anchor before choosing a diagnostic queue; block new recorder writes on legacy or distinct active queue conflicts until restart.
- Assign sequence and time after lazy detail returns; discard events whose callback disposed or disabled the recorder. Keep synchronous terminal handoff.
- Four regression fixtures; unchanged visual behavior, preference IDs, file format and native shutdown policy. Native Gecko/Sine evidence pending.

## 0.3.0-preview.62 — Independent diagnostic persistence queue

- Submit sanitized snapshots synchronously to a single bounded writer, including during an outstanding write and synchronous teardown.
- Run the writer in a standalone Gecko system-principal sandbox, anchored to the native process module when available; explicit fallback status in diagnostics.ready. No browsing data or window references cross into the writer.
- Preserve schema 2, three sessions, 2 MB UTF-8 cap and private-window exclusion. Four regression fixtures; native shutdown persistence remains best effort, no shutdown delay.

## 0.3.0-preview.61 — Workspace and closing lifecycle self-review

- Register the latest Workspace intent before synchronous cleanup/phase callbacks; defer nested visual work until the current synchronous step completes. Prevent a pending native command from being overwritten.
- Serialize reentrant close acquisition, seal and completion; cancellation during acquisition wins over nested proceed requests. Preserve normal timings and native close decisions.
- Six new regression fixtures; native validation pending. No new preferences or intended visual changes.

## 0.3.0-preview.60 — Workspace and closing lifecycle cleanup

- Isolate Workspace Transition cleanup failures across geometry, effect styles, handles, timers, waiters and listeners. Preserve the native command gate and successful native result even if subsequent decorative motion fails.
- Bind Closing Animation timers to their original request, fall back to native close if the terminal dwell timer fails, and isolate restoration and wrapper teardown failures.
- Seven new regression fixtures. No changes to normal animation timings or intended UX. Native validation pending.

## 0.3.0-preview.59 — Startup preference ownership self-review

- Preserve the last Startup Placeholders lease through final native restoration. Queue same-window replacement until synchronous mutation unwinds; reconcile newly joined windows without racing the backup.
- Validate the existing backup before mutation, preserve invalid data, and checkpoint per-key release progress to avoid restoring previously relinquished values.
- Six new regression fixtures. No new preference IDs or intended visual changes; native validation pending.

## 0.3.0-preview.58 — Cross-owner startup lifecycle review

- Preserve supported saved startup duration choices, including 760 ms. New installs retain the existing 1050 ms default; no attempt to reverse ambiguous legacy migrations.
- Stop active Assembly before Layout tears down its Center Motion and strip hosts. Isolate Assembly and Boot cleanup failures; retain terminal diagnostics.
- Defer Startup Placeholder preference lease release until synchronous mutation returns, reconcile reentrant option changes, and stop applying after disposal.
- Six new regression fixtures. Native validation pending; no intended normal-path visual changes.

## 0.3.0-preview.57 — Native resource cleanup self-review

- Release an unacquired Downloads lease immediately when disposal wins before addView. Late list resolution cannot attach to a dead generation; pending native addView still serializes removal.
- Guard Hub URI transactions across windows before acquiring the first temporary getter, including rollback, cancellation and nested unregistered URL bar clients.
- Use one native URI lookup with open-new disabled for the scoped URL bar path. Avoid a false-result provider unregister and duplicate opens; retain successful native empty-tab cleanup and adaptive history. A scoped miss uses the existing local-open fallback.
- Eight new fault-injection fixtures. No new prefs; native validation pending.

## 0.3.0-preview.56 — Native resource cleanup

- Preserve a single Downloads lease through failed native view removal, retry the exact view on the next acquisition, and block replacements until removal succeeds. Preserve pending legacy barriers across reloads. Add aggregate detach diagnostics.
- Restore Hub URI lookup getters independently, invalidate temporary getters before restoration, respect foreign replacements, suppress recursive reuse, and isolate URL-bar and window-hook teardown.
- Guard split-view lookup against mismatched native tab indices. In that exceptional case use the existing local-open fallback rather than moving an unrelated tab.
- Add eleven regression fixtures. No new preferences or intended normal-path visual changes; native validation pending.

## 0.3.0-preview.55 — Lifecycle and diagnostic ownership self-review

- Tear down the previous Layout before replacement fragments initialize, retain the same window's diagnostic write coordinator, and join the actual follow-up write across concurrent flush callers.
- Compose partial-initialization unload fallbacks; make stale Center Motion calls inert and isolate cleanup failures. Preserve the existing close-animation handoff without re-arming a disposed owner.
- Correct Magnetic Bookmarks source provenance for the version-only update. Add five regression fixtures; native validation pending, no intended visual changes.

## 0.3.0-preview.54 — Layout terminal lifecycle ownership

- Compose early boot, Center Motion, strip, preferences and diagnostics cleanup under the final Layout Sine callback. Capture terminal outcomes and stop diagnostic sampling synchronously; retain the trace for one microtask without delaying shutdown.
- Bound startup archive bytes and report coalesced write failures. Add four regression fixtures. No intended visual/default changes; native verification pending.

## 0.3.0-preview.53 — Preference ownership self-review

- Remove duplicate native hideToolbar preference writes after verifying Zen 1.24.2b; emit its layout notification without reapplying hide preferences.
- Retain the Layout lease through synchronous preference mutation, defer final cleanup until observer callbacks return, and avoid restoring an unvalidated backup.
- Add five regression tests (12 ownership fixtures total). Native multi-window/Sine validation pending; no intended visual/default changes.

## 0.3.0-preview.52 — Layout preference leases and close fallback

- Separate window preference ownership from UI active state. The first live layout applies native overrides; joining windows share the lease, and the last owner restores after local teardown.
- Track actual native writes in new backups, preserve user/default state for unmodified keys, and retain compatibility with older backups.
- Expire tentative close hints and update native layout after Sine unload if the window survives without a replacement. Actual native unload does not schedule recovery. Sine beforeunload cancellation behavior remains a native integration limitation.
- Add seven regression cases; no intended visual/default changes, native verification pending.

## 0.3.0-preview.51 — Lifecycle scope self-review

- Preserve the first release outcome, count nested and late cleanup during disposal, and invalidate scoped listener callbacks before attempting native removal. Try compensating removal if registration throws.
- Revalidate layout activation and guarded mount at synchronous handoffs; discard a strip returned after cancellation instead of publishing readiness. Reject stale Hub overlay generations and isolate Closed Tabs subscriber exceptions during acquisition.
- Add six regression cases and strengthen existing scope fixtures. No intended visual changes or new preference IDs; native validation remains pending.

## 0.3.0-preview.50 — Scoped resource acquisition

- Add a shared synchronous DisposableScope used by Layout, Hub and Closed Tabs Service. Isolate release failures, retain exact listener targets and release late acquisitions immediately.
- Publish Hub listeners/overlay ownership and drag controller only inside the guarded strip mount; rollback releases acquired resources without replacing the rest of the existing layout teardown.
- Isolate closed-tab observer removal and suppress callbacks even if native removal fails. Record bounded cleanup diagnostics; add eight regression tests. Native validation pending; no intended visual changes.

## 0.3.0-preview.49 — Lifecycle self-review follow-up

- Keep per-key release progress when native preference restoration is partial; retry only unresolved keys, reacquire released keys from their current user/default values on a new activation, and log checkpoint failure.
- Revalidate Free designation, native target existence and window/manager identity before reorder and selection; avoid overwriting a designation changed while creation is pending. Do not roll back completed native actions.
- Add six regression tests and extend the existing partial-restore test. No visual changes or new preference IDs; native verification remains pending.

## 0.3.0-preview.48 — Lifecycle safety guards

- Isolate native layout preference restoration per key, preserve the complete backup on partial failure, and record aggregate outcomes without user values.
- Revalidate the Free startup window and native manager after asynchronous creation and reorder; never publish an ID or start another native action from a stale continuation. Already-completed native creation is not rolled back.
- Synchronize diagnostic version tags across all entrypoints, including Library and Library Services. Add four regression fixtures; native validation pending. No visual behavior or preference defaults changed.

## 0.3.0-preview.47 — Unconstrained Bunny drag popup

- Set XUL panel `flip="none"` before attachment so Gecko does not constrain the live drag image to the monitor work area.
- Keep native drag session, transparency, grip geometry and motion unchanged. Add bounded grip coordinates and flip state to existing drag diagnostics.
- Cover pre-attachment configuration in regression tests. Live Windows multi-monitor verification pending.

## 0.3.0-preview.46 — Library shortcut recovery

- Route exact Ctrl+H/Ctrl+J (Cmd on macOS) at window keydown, retaining native command handling for menus and remapped keys. Consume only accepted actions; preserve native fallback on refusal.
- Add fixed browser-client surface fallback if HTML popover cannot open; check actual visible dimensions before accepting. Recover state on exceptions.
- Log Library script, service readiness, route and rejection reason without browsing data. Keep existing opt-in flags; real Zen validation pending. Retain preview.45 Bunny changes.

## 0.3.0-preview.45 — Bunny transparent native surface

- Explicitly request a transparent Gecko popup widget before creation using nonzero corner radius and near-opaque root alpha. Clear both legacy and current panel background tokens and content surfaces. Preserve the swing stage geometry and native file payload.
- Record computed popup and stage surface styles at popup-shown to diagnose opaque Windows backgrounds. Actual native compositing remains to be verified on Windows.

## 0.3.0-preview.44 — Library integrated release candidate

- Reuse the existing Dock Bunny engine for Library download rows, with native drag fallback if the Dock is unavailable. Hold the row until the drag and return animation finish.
- Animate a single section indicator; resize does not replay the entrance.
- Add explicit native folder picker (up to eight extra roots), reset extra folders, and scan barrier across service reload.
- Copy history addresses, confirm removal of page history or bounded time-range visits, and forget closed tabs by revalidated native ID. Native History and Downloads shortcuts remain accessible.
- Keep all experimental features gated pending real Zen/Sine acceptance; old Places-only downloads remain available in the native Downloads view.

## 0.3.0-preview.43 — Library file ordering regression fix

- Normalize absent active flags for local media and unknown sizes before sorting; active downloads remain first. Retain all preview.42 Library features.

## 0.3.0-preview.42 — Library L5–L7 functional preview

- Connect All Downloads, Documents and Pictures to the shared Downloads service with bounded search, sorting, status, progress, native file icons, open/reveal/remove and confirmed finished-record clearing.
- Route Dock All Downloads to the Library when it accepts the handoff; retain existing compact Dock and full fallback. Ctrl+J routing remains opt-in; native download history remains reachable.
- Optional native Zen folder scan only on media section entry/refresh, with limits, path deduplication, cloud exclusion and lazy small raster previews. No private media scans or local-file deletion.
- Native file drag in Library; existing Bunny drag remains in Dock. Regression coverage for source lifetime, privacy, scan serialization, throttled updates and guarded actions. Live Zen/Sine validation remains a release gate.

## 0.3.0-preview.41 — Library L4 native History & Recently Closed

- Connect lazy PlacesQuery and source-window SessionStore; native page icons, date groups, search and bounded Load more.
- Open HTTP(S) history in a new tab, including background opening; restore recently closed tabs by revalidated native closedId.
- Cancel stale requests and release observers on section switch/close/reload. No public history in private windows.
- Experimental Ctrl+H and History command routing, separate opt-in default off; native fallback on unsupported or unready windows. Live Zen routing and focus validation pending.

## 0.3.0-preview.40 — Native live Bunny drag popup

- Replace repeated local/native image swaps with a mouse-transparent XUL panel drag image on Windows. Gecko moves the popup across applications via native DragMoved.
- Drive the spring with drag-only timers and popup screen geometry rather than blocked rAF; no dragleave image transitions. Rightward travel leans right around the top grip.
- Add popup shown/hidden, timer, boundary, completion and return telemetry without file names or screen coordinates. Preserve the native file payload. Windows painting and DPI still require manual runtime validation.

## 0.3.0-preview.39 — Library L3 experimental shell

- Add independent centered five-section Library preview, accessible tab navigation, responsive client geometry, reduced-motion-aware transitions and overlay arbitration.
- Disabled by default; enable Experimental Library shell and open via browser-chrome console `window.__nocturneLibrary.open("history")`. No native shortcut interception, IO or file scanning yet.
- Migrate Dock lifecycle tests to the shared Downloads service; synchronize diagnostic versions and package metadata.

## 0.3.0-preview.38 — Bunny lifecycle verification

- Cover native/hosted toolbar holds during file drag and animated return in the existing wave fixtures.
- Restore the compact OS image when source drag events have no client coordinates but report a position outside the window. Retain shared Library download-service integration.

## 0.3.0-preview.37 — Bunny file drag and system icons

- Native file/application icons in Recent and All downloads, refreshed on completion.
- Compact 186×51 file preview from all three sources; spring lift, top grip, reversed velocity-driven swing and return inside the window. Native payload retained; static compact preview outside.
- Hold drag source and toolbar, clean up on dragend/disable and respect reduced motion. Add icon, motion and handoff tests.

## 0.3.0-preview.36 — Library L2 package verification

- Synchronize diagnostic trace versions across all entrypoints and refresh bookmark provenance lock. No UI changes.

## 0.3.0-preview.35 — Library L2 native data services

- Introduce a single per-window Downloads subscription, independent of the Dock preference, with native replay, immutable records, opaque IDs and validated actions. Dock consumes the same service; no second native list observer.
- Add lazy read-only PlacesQuery and source-window SessionStore adapters, with bounded query size, stale request rejection and cleanup. Private History/Closed unavailable; private downloads use their own native list.
- Keep existing download UI, progress, drag and session-list-only clear behavior. Places historical download merge, Library UI, restore/open and shortcut interception remain later stages. Native validation pending.

## 0.3.0-preview.34 — Boot verification follow-up

- Update test fixtures for the early boot prelude and existing Overlay ownership. Same startup behavior as preview.33.

## 0.3.0-preview.33 — Early Boot / slower wordmark

- Prefer the startup controller first in the Sine manifest; if layout loads first, mount a shared brand-color cover before diagnostics and layout, then adopt it without a second overlay.
- Keep the mark entrance and readable hold for at least 1010 ms before a 320 ms exit, with a short background-only lead when needed.
- Stage Home from the early waiting phase, keep the eight-second fail-open guard, and log readiness once instead of every frame.
- Native window paint before Sine injection cannot be hidden by a mod; no operating-system settings changed.

## 0.3.0-preview.32 — Library L1 overlay ownership foundation

- Independent per-window overlay coordinator, late registration, reload-safe unregister, guarded synchronous handoff and Escape arbitration.
- Home remains a destination; its native search defers competing overlays. Hub and Downloads yield only when safe. Passive download flights cannot displace another owner; native file drag and in-flight operations are not canceled.
- Preserve preview.31 branded boot and synchronized assembly. No Ctrl+H interception or Library view yet; existing downloads views stay intact. Native verification pending.

## 0.3.0-preview.31 — Nocturne Boot Sequence

- Show a lightweight, optional browser-chrome splash with a local vector mark and Nocturne wordmark during cold restore. No network assets, blur or web-page changes.
- Warm tab and Home icons during restore, wait for bounded readiness, prepare all assembly effects behind the splash, and resume them only after the splash fades.
- Allow interaction to skip the splash; honor disabled animations/reduced motion and the existing eight-second fail-open deadline. Keep download file drag from preview.30.
- Use light diagnostic samples throughout the boot and add startup lifecycle regression tests.

## 0.3.0-preview.30 — Native download file drag

- Drag the latest completed download from the toolbar icon or an individual completed row in Recent downloads / All downloads using Gecko's native file drag flavors.
- Validate the target on explicit dragstart; reject unfinished, blocked, partial, canceled or missing files. Preserve native click actions, source row during drag and public/private list separation.
- Add native payload and interaction tests, update diagnostic version metadata.

## 0.3.0-preview.29 — Staged startup and continuous Home search return

- Sequence the decorative toolbar surface, Magnetic Fold cards, bookmarks, and Home search, pinned and workspace sections on one startup clock. Preserve the native page and geometry.
- Decode pinned shortcut icons during the bounded startup icon preflight; suppress startup-only focus flash and avoid unrelated late-target rescans.
- Preserve a dedicated native search close gate through floating attribute teardown and remove the delayed observer fallback. Record Home search handoff timing in the diagnostic stream.

## 0.3.0-preview.28 — Bunny highlight handoff

- Restore the real card's drag-follow highlight when Magnetic Bunny returns to zero progress, including repeated dragovers.
- On an accepted local return, restore normal hover and indicator ownership if the release point remains over the returned card; do not change native tab selection or restore hover on cancelled gestures.
- Keep Magnetic Bunny geometry unchanged.

## 0.3.0-preview.27 — Magnetic Bunny / Home compression

- Port Motion Lab option 02: smooth anchored slot compression, same-side outer neighbors move toward Home, and the card follows the slot until it clears its own row.
- Preserve original native flex widths throughout the gesture, including full extraction, so Home, the opposite lane and other rows do not recenter. Clip the floating card against visible chrome obstacles, including the lower row.
- Use the same geometry on the accepted-drop visual tail, with no continuous animation loop during pointer movement. Keep native tab ownership, reorder and external window handling intact.
- Add regression coverage for the actual Motion Lab curve, same-side displacement, mask union and reversible paint.

## 0.3.0-preview.26 — Reversible Bunny and cold-start preflight

- Publication follow-up to preview.25; synchronized Sine metadata.

- Use one pointer-driven geometry curve for pulling a tab or Split View group out and returning it to its row. The same progress determines card position, compression and occupied slot width in both directions. Only an accepted early drop plays the remaining curve.
- Keep the frozen card-local activation edge and native drop/placement semantics; eliminate separate return threshold, insertion keyframes and autonomous bounce during the gesture.
- Avoid expensive diagnostic layout snapshots and scheduled JSON writes during visible cold assembly; retain frame-gap telemetry. Keep center-motion geometry/contour stable and preflight first-workspace image readiness within the existing bounded swap gate.
- Add regression coverage for reversible geometry and the diagnostic light-sampling path.

## 0.3.0-preview.24 — Dock-anchored page progress

- Place horizontal page progress in a fixed chrome layer rather than the selected browser panel, following the actual dock bottom and fading contour with an 8px gap. Follow Compact Mode motion and additional toolbar rows while visible; stop frame tracking when hidden.
- Preserve native panel positioning outside OnePlane, center-out progress phases, and existing preference ownership. Add dock geometry and lifecycle tests.

## 0.3.0-preview.23 — Pointer-controlled Bunny insertion

- Pause the insertion timeline while dragging; scrub its progress from the original row's return threshold to the row edge, including reverse motion and a stationary pointer.
- Only an accepted native drop plays the remaining insertion frames. Preserve the existing extraction, row-local boundaries and native split/window handling.
- Synchronize diagnostic versions and repair the diagnostic-version and shared-bookmarks provenance checks.

## 0.3.0-preview.22 — Symmetric native-position page progress

- Replace the full-window loading line and visually suppress Zen's original indicator only while the new controller is installed. Keep native lifecycle and restore visibility when disabled.
- Use the selected browser panel and native indicator position, width 1rem above Zen's initial width, and native height. Unfold a rounded track from its center, fill symmetrically using top-level network progress, then collapse the finished track to the center.
- Avoid flashes for loads shorter than 90ms; cancellation collapses without claiming completion. Clear timers on selection, restart, preference changes and unload. Add lifecycle and geometry tests.

## 0.3.0-preview.21 — Visible Bunny insertion

- Replace the globally eased return with a 400ms phased approach, visible compression at the slot, rebound and exact resting geometry. Preserve the row-local pull and existing outward animation.
- Finish the isolated return visual even when a native toolbar drop arrives early; finish the native drag immediately and clear pending visuals on a new gesture or cancellation.
- Trace early-drop visual tails and add regression checks for phased keyframes and native/visual ownership.

## 0.3.0-preview.20 — Row-local Bunny

- Freeze the actual dragged card's lower edge plus 3 CSS pixels at gesture start. Use a 30px pull distance with the existing detach/return hysteresis; upper and lower rows no longer share the panel's bottom edge.
- Keep native return/drop and panel reveal separate from visual pull. Prevent the strip bubble handler from repainting a content/pull ghost within the toolbar.
- Retain the lane ghost across consecutive pull events instead of clearing its visual state, and release it when the source has returned. Preserve the continuous 320ms insertion, Magnetic Fold and native cancellation policy.
- Record source card bottom and edge padding in drag-start diagnostics; add regression tests for row-local progress and lane ghost ownership.

## 0.3.0-preview.19 — Continuous Bunny drag handoff

- Re-arm pointer-driven pull on outward reversal after re-entry, rather than waiting for the pointer to reach the toolbar. Run the return state machine before applying native return cancellation.
- Start Bunny extraction from the actual painted source rectangle and return the isolated ghost from its actual position and size to the original slot; hide the native mirror until the 320ms return finishes. Preserve native drop/cancel, group identity and outside-window drag policy.
- Record measured handoff coordinates, rearm and completion; sample ghost body geometry. Preserve Magnetic Fold and the three-session / 2MB diagnostic limit.

## 0.3.0-preview.18 — Visible startup favicons and smooth workspace Home label

- Keep nested OnePlane buttons outside the generic startup opacity gate. The card itself owns its entrance and the isolated Magnetic Fold copy preserves its already decoded icon content.
- Hold the visible Home/title label during outgoing and swap phases, then fade out the old label and fade in the settled incoming one over 280ms. Unchanged labels do not blink; normal hover timing and portal geometry remain unchanged.
- Record mounted icon ancestor opacity and drawable geometry, plus Home label motion and geometry, without recording text or URLs. Preserve the 2 MB / three-session diagnostic budget.

## 0.3.0-preview.17 — Cached startup icons, magnetic Island hover and diagnostic capacity

- Resolve lazy tab favicon addresses through native SessionStore and local Places cache. Predecode mirror images, wait at most 600ms, paint ready chrome favicon pixels directly in the isolated proxy and keep late image updates live; no page restoration or image readback.
- Island hover now reserves the exact enlarged horizontal slot and zooms uniformly without downward translation. Keep Home anchored, split members inside their group and adaptive rows stable.
- Suspend bookmark hover before capturing outgoing workspace geometry; prime resting contours before startup motion, avoid measuring squashed bookmarks, and add a slightly longer bounded quiet interval for the first workspace switch.
- Retain the newest three diagnostic sessions in one pretty JSON file, up to 2,000,000 UTF-8 bytes total, with 3,200 events per live session and additional hover, favicon and workspace-boundary telemetry.

## 0.3.0-preview.16 — Stable split proxies and startup icons

- Freeze measured Split View handle, dots and member geometry in the shared animation proxy. Record mounted handle offset errors.
- Wait up to 350ms for startup favicons; keep chrome-only icon updates live during the fold with a placeholder for unavailable images. Ignore unrelated keyboard/scroll input during startup.
- Retain the three latest window sessions by creation time, with independent event budgets and preserved startup summaries. Record readiness, gate, interruption and proxy metrics without URLs or titles.
- Preserve the Preview 14 and 15 hosted downloads wave fixes.

## 0.3.0-preview.15 — Fixed horizontal download wave geometry

- Keep hosted downloads in the resting border box for the entire opening and closing wave. No extra 32px top bridge, padding, translation or final geometry change. Seed stays inside the panel's top edge; the contour still grows down and then right.
- Preserve the same border and background in every horizontal state. Use a resting rounded clip and no pop-in shadow. Native sidebar bridge and timing remain unchanged.
- Test bounds and final contour at several panel sizes, including full-height downloads.

## 0.3.0-preview.14 — Horizontal download wave orientation

- Rotate the hosted downloads wave to originate below the toolbar, travel down the left edge, then across the bottom. Use a top bridge with unchanged resting content coordinates and reverse the same contour on close.
- Keep native left/right sidebar paths unchanged. Measure resting height correctly when the hosted reveal is interrupted.

## 0.3.0-preview.13 — Consistent row geometry

- Share the same 52px row pitch, 21px vertical center, 10px bottom reserve and 1px horizontal lane inset across single and adaptive two-row modes. The second row extends downward without moving Home or upper cards. Keep the bottom slider in its reserved space.
- Both contour producers use the same fixed trim regardless of row count. Preserve Magnetic Fold and native row allocation, including compact capacity.
- Add regression checks for matching first-row center, last-row clearance and contour trim.

## 0.3.0-preview.12 — Magnetic Fold Home portal

- Fade chrome card proxies according to their scaled bounds and the real Home rectangle, rather than distance to its center alone. Clip the isolated animation layer at the Home boundary as a safety net. Preserve the reversible fold, timings and native layout.
- Record the portal dimensions and test both directions, wide cards and the lower row.

## 0.3.0-preview.11 — Magnetic Fold

- Port the selected Motion Lab B formula to the shared center engine. Cards compress around the actual Home anchor; lower cards move vertically toward it. Opening reverses closing.
- Isolated, inert chrome-card proxies avoid lane clipping without modifying native scroll positions or tab order. Hold native transitions off during handoff.
- Squeeze bookmarks toward the center. Keep the compact contour as the only shelf backing, and keep Home anchored during workspace swap.
- Restore page-deck opacity and position to native values (Lab B). Close seals the endpoint before a 110 ms final dwell.
- Constrain Windows caption controls to the first row. Retain startup events separately from the bounded diagnostic ring.

## 0.3.0-preview.10 — Publication metadata

- Publish the complete shared Center Motion implementation from preview.9 with a strictly newer Sine version and timestamp. No additional runtime behavior changes.

## 0.3.0-preview.9 — Shared Center Motion

- One window-local engine plans and plays card trajectories for startup, native close and workspace changes. Outer cards depart first; closing uses reversed keyframes. Freeze projection centering until release, then resynchronize.
- Gate cold projections before first reveal; never replay already-painted cards when a late loader misses the gate. Suppress transient strip indicators, slider and scrollbars during choreography.
- Fix the final unscaled shelf height before applying FLIP scale; bound both min/max height to prevent double growth during wrapper interpolation.
- Add a short incoming directional glide for ordinary native TabSelect, without delaying selection or capturing web content.
- Replace per-window diagnostic files with a readable bounded file of up to four sessions, delta snapshots and serialized writes. Old per-window files are removed after successful replacement.

## 0.3.0-preview.8 — Center motion and adaptive rows

- Keep startup waiting gates until each effect owns its node; sample resting opacity with transitions disabled. Move visible cards toward Home within their actual scroll lane and use a longer reveal with earlier onset.
- Replace workspace whole-row scaling with individual in-lane card convergence driven by one shared progress animation. Keep the native swap transaction and closing behavior unchanged.
- Synchronize compact toolbar height, bookmark vertical displacement and decorative surface with a single incoming timeline; avoid a separate overflow-row entrance during startup/workspace motion.
- Avoid redundant overflow visibility mutations and record startup resting opacity/progress and workspace card count. Native visual validation pending.

## 0.3.0-preview.7 — Motion regression fixes

- Keep Center Disassembly effects sealed through the synchronous native close; restore only when the window remains open or the native command fails.
- Permit cold Sine startup before the layout handshake within a bounded initial interval. Record eligibility and bypass reasons before the diagnostics recorder exists; bound the native promise wait.
- Move workspace motion and geometry lock rules into the packaged chrome stylesheet, with registered progress and explicit target selectors. Freeze geometry before outgoing motion and prepare the new contour under the hidden swap gate.
- Include actual workspace progress in diagnostic samples. Native Zen/Windows visual validation is still required; ordinary tab selection, drag thresholds and standalone contour flicker are not claimed fixed.

## 0.3.0-preview.6 — Diagnostic build

- Read-only diagnostic recorder: sequenced, timestamped chrome lifecycle, native events, active animation state, sampled geometry, contour hashes, frame gaps, tab and ghost counts, and local bounded JSON export.
- Instrument startup eligibility/targets/interruptions, closing restore/native command ordering, workspace bypass/phase/height, tab mirror/partition, compact hold and fade, drag pull thresholds/return zone/native image/ghost, address/Home/Hub and every runtime entrypoint.
- Enabled by default for this diagnostic preview; set zen.nocturne.diagnostics.enabled=false to disable recording. No change to animation, drag, tab, native data or layout decisions.
- Logs stay local in the profile's nocturne-diagnostics folder (recent runs retained); no URL/title/content/input/filename telemetry, no disk files for private windows. Final close write is best effort. Console provides key events; detailed samples are in JSON.

## 0.3.0-preview.5 — Startup and workspace geometry

- Accept a recently ready initial layout during late Sine startup; do not replay on established windows. Wait for actual horizontal bounds, ignore duplicate resize events and allow a bounded 8s readiness window.
- Keep the previous toolbar and contour height during workspace swap, measure the final geometry once, interpolate the decorative surface height with a compositor-scale effect. Restore temporary geometry on every exit.
- Restore a short coordinated row motion (fade + displacement/scale), including the adaptive two-row solid backing instead of opacity alone; keep per-tab animation disabled during workspace rebuild.
- Add an opaque incoming chrome-page slide, excluding covered Home and non-neutral native transforms; no content injection, page capture or reload.
- Correct magnetic contour overflow-row offset and synchronize final mask before reveal. Preserve serialized native operations and Escape safety. Native visual testing pending.

## 0.3.0-preview.4 — Workspace and Downloads visual stabilization

- End Downloads content animation at each child's actual resting opacity, eliminating the empty-message and notice brightness snap.
- Replace independent tab/bookmark travel with short whole-surface opacity fades. Keep chrome hidden while native selection and mirror/Places updates settle; retain the swap gate when transferring to a newer request.
- Escape skips outgoing/incoming decoration safely without prematurely revealing the rebuilding chrome or repeating native commands. Let an already-started incoming fade finish.
- Suspend tab hover and Magnetic Bookmarks during the workspace handoff. Preserve native page/background switching and existing address, startup and closing animations.
- Add tests for Escape, queued workspace gate, text opacity and bookmark suspension. Native visual validation still pending.

## 0.3.0-preview.3 — Stabilization A

- Serialize explicit native workspace switches across Home and Hub, coalesce pending requests and preserve the in-flight gate across controller reload. Disposing cancels commands not yet started.
- Guard Download view callbacks and async failures by generation; detach late views without touching a replacement.
- Roll back partially installed Smart Search providers, wrappers and listeners; retain diagnostic status until unload.
- Isolate layout teardown operations so later releases and native preference restoration continue after a feature failure.
- Add a real 30px Downloads host in the left navigation group, fixed dimensions, progress line and speed tooltip, anchored panel and independent Compact hold. The full lower Utility/Extension Dock remains planned.
- Add regression fixtures and full candidate verification before publishing. Existing animation timelines unchanged.

## 0.3.0-preview.2 — Package Stabilization

- Fix Downloads Dock host selection on narrow adaptive OnePlane windows; use the same ready-strip and fullscreen/customization gate as layout CSS, watch readiness changes.
- Coordinate startup placeholder preferences across live browser windows: one observer, transfer to surviving lease, restore only on last explicit mod unload, preserve normal exit.
- Read Sine mod state only to warn about enabled legacy Zen Refined. This is not an interlock; disable legacy Refined and restart before using Nocturne.
- Record all audit findings and remaining runtime/architecture gates in docs/nocturne/audit.md; add targeted regression fixtures. No layout or animation redesign.

## 0.3.0-preview.1 — Nocturne: unified package

- Combine OnePlane preview.62 and Zen Refined preview.26 into one Sine mod, preserving OnePlane's package ID, update URL and all existing preference keys.
- Import seven Refined runtime scripts and the non-bookmark stylesheet verbatim; retain one shared Magnetic Bookmarks controller and CSS. All nine runtime scripts are syntax-checked by the package verification command.
- Keep horizontal layout and Home unchanged; no vertical layout or lifecycle refactor yet.
- Migration requires disabling legacy Zen Refined before updating; native Zen/Sine validation and coexistence remain pending. See docs/nocturne/validation.md.

## 0.2.0-preview.62 — Prevent Home flash during new tab navigation

- Distinguish Zen's explicit empty tab and committed ordinary blank pages from a new browser's transient initial about:blank. Wait for the selected tab's committed WindowGlobal and load completion, not an arbitrary timeout.
- Do not reopen Home on native URL bar result selection or tab switch. Only actual cancellation can request Home on a confirmed placeholder; background tabs never trigger it.
- Preserve automatic startup, explicit Home and empty-tab fallback, and preview.61 search animations. Extend the Home runtime fixture with new-tab and search-close races. Live Zen validation pending.

## 0.2.0-preview.61 — Stable Smart Search collapse handoff

- Stabilize chronological rails inside Home; avoid independent delayed dot animations during the shared reveal. Ordinary Smart Search retains its timeline animation.
- Freeze resolved border sides, background layers, grid tracks and context SVG paint, keeping result border-box geometry and pseudo-elements in the closing copy.
- Ignore native teardown and identical attribute writes when invalidating the snapshot. Capture before blur and preserve last live geometry.
- Add rail/pseudo counts, snapshot age, capture time, handoff time and first-frame delay diagnostics. Preserve preview.60 tab-bar improvements.

## 0.2.0-preview.60 — Subtle overflow slider and adaptive address slack

- Reduce the visible overflow track to 1px and thumb to 2px (3px on hover), with lower contrast. Keep the 6px input hit area and existing smooth scroll behavior.
- Restore unused address width up to the configured preference whenever the measured centered strip can retain its title, upper slots, plus placement and row count. Include native margins, drag-room and an extra 4px guard. Keep the existing compact fallback when space is genuinely limited.
- Add layout and style regression coverage. Native Zen visual validation pending.

## 0.2.0-preview.59 — Four upper tabs and smoother overflow

- Keep up to two ordinary tabs on each side of the fixed Home center when the measured budget allows; never move part of a Split View group upstairs. Keep the full title when possible and preserve the wide strip. Reserve enough address space for the extra pair.
- Make resting strip/lane background a native window drag region instead of a blanket no-drag hitbox. Only actual cards, groups, controls and active drag/cascade states exclude the native region; preserve DOM hit testing for wheel and tab DnD.
- Reduce overflow range hit height to 6px, track to 2px, and thumb to 4px (6px on hover). Wheel and track-click movement use a bounded 145ms ease-out, with accumulated wheel targets; thumb dragging and horizontal trackpad input stay direct. Respect reduced motion and cancel on tab drag, selection reveal and teardown.
- Regression fixtures cover allocation and scrolling. Native Zen/Windows runtime validation pending.

## 0.2.0-preview.58 — Home footer return

- Use the footer's resting opacity when animating Customize back into view, not its search-hidden opacity.

## 0.2.0-preview.57 — Progressive Home card return

- Reveal individual pinned and workspace cards as their own row becomes uncovered, with smooth opacity, clipping and a subtle 6px rise. Headings and footer follow the same edge-driven motion. No abrupt final opacity reset.
- Reuse unchanged native result snapshots, track scroll/mutation invalidation, and start the closing layer from the last actual native geometry. Avoid redundant position writes and report maximum frame gap in close diagnostics.
- Live Zen visual validation pending.

## 0.2.0-preview.56 — Continuous search collapse

- Freeze the latest native Smart Search result view into a detached, inert visual copy before cancellation; preserve visible rows during the reverse animation even if Zen tears down the popover on blur.
- Reveal Pinned, Workspaces and Customize progressively using the moving bottom edge and elapsed progress. No overlapping full-opacity Home content when a result snapshot is available.
- Add close-start/close-finish diagnostics (reason, row count, geometry and duration; no URLs or query text). Preserve preview.55 overflow and Compact changes. Native browser visual verification pending.

## 0.2.0-preview.55 — Visible overflow scrubber and opaque shelf

- Separate native range for the lower lane; proportional thumb and position, pointer, keyboard and wheel, hidden when all tabs fit. Keep existing row height and plus placement.
- Correct the compact backing selector inside the active root, retaining the rear contour fade. Preserve preview.54 Home toolbar window dragging.
- Update real scroll geometry during bounded width transitions and clean up on unload. Native visual verification pending.

## 0.2.0-preview.54 — Native drag on Home toolbar Fade

- Fix preview.49's full-window no-drag subtraction: Home background and noninteractive descendants are neutral in Gecko; real Home controls alone exclude drag.
- Use the existing measured Unified Contour/Fade surface as the native window handle while Home and its toolbar are open. Keep actual controls and search cancellation protected; no new hit layer, synthetic mouse movement or web-page behavior change.
- Update drag-ownership regressions and generated files. Live Windows/Zen verification pending.

## 0.2.0-preview.53 — Compact cascade and startup tests

- Ensure compact lane padding and scrollbar visibility override the more-specific wide lane CSS. Update the existing geometry regression and add startup SearchService readiness/selection-race tests.

## 0.2.0-preview.52 — Compact toolbar polish

- Prevent underlying web controls showing through the two-row tab shelf, retain the rear fade, and remove the scrollbar track and floating selection underline in compact mode while keeping scrolling and selected-card feedback.
- Align upper tabs and Home vertically with native controls, restore Home hover/press/focus feedback, and correct the measured center. Reduce compact padding and reserve space for two ordinary top tabs when possible.
- Wait for SearchService initialization before automatic Home startup blurs the native address editor; do not reopen Home after a tab change during the wait.
- Native Zen visual and startup validation pending.

## 0.2.0-preview.51 — Home search handoff and regression checks

- Keep the common search glyph throughout native cancellation, including the interval after Zen removes its new-tab marker.
- Update stale window geometry tests for preview.49's client-area policy and current resize lifecycle. No window drag behavior changed.

## 0.2.0-preview.50 — Continuous Home search handoff

- Unify the collapsed Home search, native search input and return shell: same glass, border, radius, header typography, icon footprint and placeholder. Remove the redundant New tab hint.
- Keep the source header visible until native floating search is ready; switch both in the same frame. Preserve the source position and constrain results to the remaining viewport. Fade surrounding Home sections without shifting layout.
- Slow the actual height reveal to 560ms and reverse to 460ms with smoothstep easing; no final fade-to-zero on return. Keep source geometry stable during search. Preserve native search modes and result selection.
- Preserve preview.48/49 window dragging fixes. Live Zen visual verification pending.

## 0.2.0-preview.49 — Toolbar-only window dragging

- Restore the entire Home surface to client-area hit testing, including blank space, so clicking or dragging there cannot move the browser window. Keep native window dragging on the dedicated upper toolbar gaps and preserve tab drag and Home search cancellation.
- Add a source/bundle drag-ownership regression. Native Windows verification pending.
- Separate known issue: cold startup can blur the native address bar before SearchService initialization; the supplied stack identifies Home startup as the trigger. Not changed in this scoped fix.

## 0.2.0-preview.48 — Adaptive centered overflow

- Keep the wide OnePlane layout and fixed central Home. On overflow keep at most one ordinary tab per upper lane; all other tabs and intact Split View groups occupy a centered, independently scrollable lower lane. In the smallest mode keep only Home above. Reserve the lower plus slot and return to one row with a 12px hysteresis margin.
- Size the native address from measured edge controls, reduce by 30% when constrained, and expose compact search below an 80px anchor. Remove the 900px activation gate. Narrow auxiliary controls collapse; native menu and keyboard commands remain available.
- Crowded-strip drag uses clipped, row-aware hit testing and edge autoscroll; one ghost follows the pointer. Invalid toolbar-gap drops cancel instead of unsplitting. Bunny extraction begins below the measured toolbar.
- Include the lower lane in toolbar height, bookmarks and Unified Contour. Sync shared Magnetic Bookmarks with Zen Refined preview.26; preserve the latest Home changes.
- Pure allocation, address sizing and clipped drop-target regressions passed in a JS harness. Native Gecko/Windows, mixed DPI and Sine validation remain pending.

## 0.2.0-preview.47 — Home search open/close motion and Gmail icon

- Keep the original-size search header visible while waiting for actual native results; reveal with a bounded 340ms height animation and result fade. Handle late result-height changes.
- Reverse the real native search height on Escape or captured blank Home clicks; use a visual-only return shell for native cancellation/blur, leaving native result selection and session ownership untouched.
- Add a local Gmail SVG and restore original cached favicon fallback plus a generic icon on failure.
- Runtime Zen visual validation pending.

## 0.2.0-preview.46 — Home glass search and sharper icons

- Match the native floating search to the Home field's width and position, with viewport bounds. Render one translucent rounded frame; neutralize the opaque native background and competing transforms only for Home sessions.
- Replace the clip/scale morph with a 300ms actual-height reveal. Hide the Home source before opening, restore on cancellation, and release all session CSS variables. Preserve Smart Search data and native input.
- Request larger cached favicons and use an embedded scalable Steam mark (Simple Icons, CC0, trademark remains with Valve). No remote icon request by the mod.
- Native browser visual verification pending.

## 0.2.0-preview.44 — Scrollable Home pin picker

- Replace recommendation pagination with a native vertical scrollbar and a fixed two-row viewport. Three columns on wide windows, two or one on narrow windows; Workspaces and Done stay outside the scroll region.
- Keep scroll position after pin additions or returning from custom URL; reset on leaving Add Pin. Add short mode-enter, hover and press motion with reduced-motion support.
- Preserve primary Home behavior and other preview.43 changes.

## 0.2.0-preview.42 — Compact Home Add Pin mode

- Show only three recommended sites per page, with previous/next navigation. Add mode replaces the search and existing pinned grid, retaining Workspaces and a single Done control.
- Custom URL entry replaces the recommendations instead of expanding the page; Escape/Done return through the editing states. Existing pins remain saved.
- Responsive short/narrow layout; no changes to Smart Search or tab lanes.

## 0.2.0-preview.41 — Independent tab lanes

- Native thin horizontal scrollbars and wheel/trackpad scrolling for each overflowing lane around Home, without scrolling the opposite lane or the web page. Keep the left lane initially aligned toward Home and hide indicators outside their viewport.
- Collapse a narrow title island to the Home icon before using the existing unsupported-space fallback. Preserve hover and native Split View groups.
- Second overflow row is a separate pending 2D layout/drag milestone; the existing 900px support threshold remains until adaptive native controls are implemented. Runtime Zen verification pending.

## 0.2.0-preview.40 — Proportional tab hover

- Expand ordinary tabs with uniform 120% scale and the existing 7px descent. A single interpolated progress drives layout width, scale and exact symmetric slot compensation; the configured expanded width remains the final painted width, with no additional horizontal overhang.
- Split and Island hover use a restrained uniform 105% scale; keep Split within its frame and Island slots stationary. Compensate the favicon zoom to remain around 128%; preserve drag, address-wave and reduced-motion paths.
- Chromium fixture verified geometry at 140/180/240px during hover retargeting; real Zen verification pending.

## 0.2.0-preview.39 — Home recommended pin picker

- Customize → Add Pin offers one-click recommendations from native toolbar bookmarks and recent visible tabs; already pinned URLs and unsafe schemes are excluded.
- Keep the picker open for adding several sites. Manual URL entry is secondary and name is optional. No history or network requests.
- Floating Smart Search appearance is unchanged in this release.

## 0.2.0-preview.37 — Reset Hub Trash on open

- Start every new Hub opening with Trash collapsed, including an interrupted close animation. Keep the age filter, native Trash contents and in-session manual expansion unchanged.
- Prevent an asynchronous workspace deletion from reopening Trash in a later Hub session; retain auto-expansion within the same session. Live Zen validation pending.

## 0.2.0-preview.36 — Home startup and search morph

- Open Home once per normal supported window after session/workspace restoration and OnePlane readiness. Preserve native tabs and avoid reopening on live reload or workspace projection.
- Increase Home content width to 720px, search height to 56px, shortcut height to 102px; increase spacing and workspace size with responsive fallback.
- Home-origin floating native search gets a geometry-based 400ms opening morph and fades Home content out/in; preserve native results, cancellation, keyboard handling and reduced motion.
- Runtime Zen verification pending.

## 0.2.0-preview.34 — Home search and visual state

- Keep Home visible under Zen's native floating search; cancellation returns to Home, committed search/tab selection returns to browsing. Match native close session token.
- Empty Pinned explains Customize Home. Hide selected-tab/split-group highlighting and compact URL slot while Home is open without changing native selection; restore on close. Hover/drag indicators stay available.
- Real Zen validation pending.

## 0.2.0-preview.33 — Home foundation

- Shared per-window Home controller and OnePlane trigger, native background, shortcuts and customization, workspace/search bridge.
- Fixed-width idle Home title and alternate centered icon where room permits. Extension relocation deferred. Private windows retain native behavior.
- Live Zen validation pending; Zen Refined host not shipped yet.

# Changelog

## 0.2.0-preview.45

- Enable native window dragging on the empty Home background and real toolbar drag gaps, excluding interactive controls. Preserve Windows maximize/restore/Snap and native tab drag ownership.
- Anchor the New Tab plus to the occupied right tab lane, capped by the available row width; retain expansion room in Expand mode. Reconcile geometry on resize and native size-mode changes.
- Live Windows drag and mixed-DPI verification pending; generic console exceptions lack a stack and are not attributed to these fixes.

## 0.2.0-preview.43

- Make Home an idempotent primary destination instead of a toggle. Repeated Home clicks and plain Escape no longer uncover empty transparent background. Empty ordinary native tabs return to Home; real page navigation exits. Background TabOpen does not dismiss Home. Preserve projection startup, private and fullscreen/customization paths, native search cancellation, current Add Pin and workspace transition.

## 0.2.0-preview.38

- Integrate the optional Zen Refined Center Workspace Transition in Home and Hub without changing native workspace ownership. Hold the Compact toolbar and retain the Unified Contour mask during the transition. Home updates workspace selection by native identity instead of rebuilding its search and pinned shortcuts.
- Preserve existing Home startup and search morph, address wave, and native fallback when Zen Refined is absent. Runtime integration validation pending.

## 0.2.0-preview.35

- Move the original Trash card via shared pointer drag lifecycle and empty spacer; remove native drag image and post-drop clones. Animate lift, absorption and return.
- Fix Windows Free startup claim without hiddenDOMWindow. Preserve concurrent Home changes, native transfer, filtering and projection.

## 0.2.0-preview.32

- Center Trash header controls; replace native age select with inline choices that retain filter state.
- Add Fluid lift, post-drop suction and in-Hub cancellation return while preserving native drag transfer and virtual list.

## 0.2.0-preview.31

- Redesign One Plane Hub: separated Free, settings above expandable bottom Trash button, count/header controls and compact drag-only site cards.
- Add virtualized Trash viewport, shared visible-only relative age timer, native drag lift and destination feedback.
- Select designated Free on first normal startup; create if absent without renaming existing spaces. Preserve projection and safety gates.

## 0.2.0-preview.30

- Explicit Free designation, native workspace name/icon/order controls and Hub accent.
- Native Trash drawer, age-filtered confirmed Clear and drag/selector restore. Safe workspace deletion parks eligible tabs rather than closing them.
- Gate moves/deletion/clear to single-window and supported ordinary tabs; preserve native session and close semantics. Runtime verification pending.

## 0.2.0-preview.29

- Open projected workspace search after placement settles; verify actual visible native view, resume inherited closed new-tab session, skip redundant same-space switch and add bounded diagnostics. No tab creation or geometry/indicator changes.
- Record shared theme-aware floating search color/translucency design in roadmap. Runtime verification pending.

## 0.2.0-preview.28

- Fix premature workspace/placement startup cancellation on document unload; observe actual native window closure and verified closed state instead.
- Keep projection startup guard alive across initial document replacement; bounded readiness probes and explicit cancellation diagnostics. Add regression tests for early unload and actual closure. Preserve working geometry and indicator.

## 0.2.0-preview.27

- Guard native projection startup empty-tab selection against ordinary homepage fallback; restore native method, safely identify startup tabs and open search independently of placement.
- Bound maximize readiness wait and add missed-startup fallback, verified screen check and diagnostic stages. Preserve confirmed indicator cooldown and snap geometry.

## 0.2.0-preview.26

- Wait for native Zen startup before maximize; bounded maximize retry and cancellation guards.
- Select native transparent empty tab and open floating startup search in projected workspace; remove only verified new untouched startup tab, never existing tabs.
- Hold hover underline for 2000ms after pointer departure, cancel on new hover or explicit selection; preserve tab expansion timing and existing drag/snap geometry.

## 0.2.0-preview.25

- Test the real startup scheduling adapter for delayed startup, ready windows and cancellation; account for integer CSS feature rounding at 2x DPI. Runtime unchanged from preview.24.

## 0.2.0-preview.24

- Create native windows with the selected final snap rectangle rather than the uniform center seed; maximize independently of workspace initialization.
- Verify selected position and size, add bounded resize fallback and preserve working target-monitor selection. No preview or animation changes.

## 0.2.0-preview.23

- Seed native workspace/tab window creation on verified target monitor using converted opener position and destination size features; retain post-startup snap verification and bounded native move fallback.
- Do not silently open an unknown target on source during experimental monitor drag; add local placement diagnostics. Preserve existing preview, zones and animations.

## 0.2.0-preview.22

- Broaden monitor snap zones (22% horizontal, 18% vertical), move small placement preview to target display with CSS coordinate conversion and validation.
- Stage native desktop position and post-DPI resize, verify target before maximize; narrowly scoped release fallback.
- Reserve expanded tab toolbar during drag and cancel a detached tab's return instead of creating a top Split View. Preserve direct reordering and existing split animations.

## 0.2.0-preview.21

- Extract Display Engine and pure desktop geometry; validate native event screen, handle full monitor vs work area, negative origins and DPI conversion.
- Replace desktop-sized popup with small source-window snap diagram. Place native windows after startup via base-window device/desktop API, validate target and use OS maximize; safe native fallback.
- Add experimental Windows placement preference and geometry tests. Drag Engine live validation and actual Windows shell overlay still pending.

## 0.2.0-preview.20

- Repair Sine update timestamp regression: new updatedAt exceeds preview.16 and intervening publications. No browser runtime changes from preview.19.
- Verify timestamp high-water mark against full manifest history before running build/tests; keep version and identity checks.

## 0.2.0-preview.19

- Normalize screenshot-shortcut detection to a strict boolean; fix regression test without weakening assertions. Includes preview.17–18 Drag Engine changes.

## 0.2.0-preview.18

- Harden native dragend ownership against a different/stale source node or tab, preserving the Drag Engine stabilization scope. No Snap or Split View visual changes.

## 0.2.0-preview.17

- Extract shared tokenized Drag Engine and cancel/finish ownership for workspace and native tab gestures; clear stale visuals and ignore late input.
- Global pointer-release/capture/focus/keyboard cleanup, native dragend fallback and active-only native session watchdog.
- Temporarily disable faulty external Snap popup and forced monitor placement; normal native window opening remains. Display Engine next.
- Record unresolved Split View overlap without changing its animation. Live validation pending.

## 0.2.0-preview.16

- Add a visible workspace carry badge inside the source window; stabilize center placement preview.
- Protect all pre-existing synced tab IDs during projection startup cleanup and check the source peer.
- Record live same-tab rendering as a separate milestone. Live validation pending.

## 0.2.0-preview.15

- Latch native drag image after external transition, clamp reinsertion scale, remove delayed live slot transforms; drop onto empty workspace selects dragged tab.
- Shared experimental snap-style work-area preview and placement for tabs/workspaces, top maximize, sides/quarters/center. Not Windows shell Snap UI.
- Explicit blank projection startup and guarded exact untouched startup tab cleanup; Hub Fluid 460/390ms.
- Document simultaneous live-page mirror as separate architecture; not implemented. Live verification pending.

## 0.2.0-preview.14

- Keep Hub open after create/select; native creation without activation, centered inline deletion confirmation and shared toolbar tint.
- Interruptible native Fluid animation on Hub open/close; preserve trigger and existing animations.
- Experimental synced workspace projection and Return, gated on all-tab sync; context action fallback. No tab adoption or independent session.
- Native synced favicon fallback and event-driven refresh. Live validation pending.

## 0.2.0-preview.13

- Replace native Hub popup with an in-document manual panel; fix single-click hit target, window dragging exclusion, hover background and icon sizing/brightness/alignment.
- Preserve Hub through Compact toggles without native popup reopen timers.
- Scope existing-tab URI reuse to current workspace/current window, preserving visible Essentials and native opening; add URL-bar result handling and cleanup.
- Multi-monitor projection remains a planned milestone. Live validation pending.

## 0.2.0-preview.12

- Visible SVG Hub trigger; match address surface and left/navigation width; no native arrow padding.
- Keep Hub open while toggling Compact Mode, bounded recovery if Zen rolls up the popup.
- Workspace right-click Delete with confirmation, last/Free protection and default safe tab preservation for ordinary single-window cases.
- Record multi-monitor workspace projection and Return design; not implemented yet. User verified preview.11 creation and switching; new polish needs live testing.

## 0.2.0-preview.11

- Hub Foundation: stable left button, native popup, real workspaces, explicit named creation, Compact Mode and lifecycle-owned visibility hold.
- Native mirrored-tab context menu; cancel if target identity cannot be resolved.
- No Free migration, discard, Library or Extension Dock yet. Fluid Wave, Bunny and Magnetic Bookmarks unchanged. Live validation pending.

## 0.2.0-preview.10

- Replace external Bunny overshoot with a bounded 0–100–93–100% return, four keyframes per tab. Restore progressive Wave Fade on address opening: two opacity keyframes per visible item, no scale on normal opening.
- Include native bookmarks, folders and overflow in the same address-wave choreography. Use the existing horizontal trajectory and vertical depth for the lower row; preserve native text metrics, add an optional decorative-only bounded bounce on return.
- Bundle canonical Magnetic Bookmarks from Zen Refined 0.6.0-preview.3, byte-identical script and stylesheet, with one window-scoped controller and independent leases. Existing shared settings are retained; no runtime dependency on Refined.
- Suspend magnetic hover and freeze both contour calculations during the address wave. Keep original Split View contour and selected-tab indicator timing. Keep the accepted Fluid Wave source unchanged.
- Add source-lock and lease tests; actual Zen high-refresh and two-mod lifecycle tests pending.

## 0.2.0-preview.9

- Remove opening Bunny animation entirely: hide the complete tab strip (including title island, plus, indicator and split groups) with one visibility/opacity state, without layout removal or per-card animation.
- Keep closing Bunny only; replace the quadratic shared timeline with three local scale/opacity keyframes per visible card. Limit horizontal overshoot using measured neighbor/group gaps, retain 114% vertical spring and right-to-left stagger. No slot locking, moving partitions or animated inherited CSS properties.
- Return the selected-tab underline with its own card (28ms after card reveal starts), not after the entire strip. Group opacity animates directly with the original fixed 8px contour.
- Preserve accepted address Fluid Wave unchanged. Regression tests cover keyframe budget, stagger and non-overlap. Live FPS validation pending.

## 0.2.0-preview.8

- Bunny Cascade v2: calculate a shared native scale/translate/opacity timeline with collision-aware slot boundaries, a bounded horizontal overshoot and stronger vertical spring. Stagger the visible cards, including the Island Mode title; offscreen cards do not consume stagger slots.
- Preserve current hover slot widths and list translation during hiding; avoid late hover retargets and indicator jumps, and stage the reveal-to-hover handoff. Fade late-arriving cards rather than showing them immediately at handoff.
- Split View uses its original surface throughout, with fixed 8px radius and animated background/outline alpha; remove the temporary pseudo-element.
- Keep accepted Fluid Wave unchanged; regression tests cover gaps, wide cards, stagger and reversal. Visual confirmation pending for OP-008/009/010.

## 0.2.0-preview.7

- Add Bunny Cascade for inline address search: each tab shrinks into its own center as the address edge advances, then springs back (112% overshoot, 160ms) as the edge retreats. Use native WAAPI scale/opacity, no per-frame layout loop.
- Support Expand Mode and Island Mode, including the title island, plus button, active underline, each Split View member and handle; fade the shared split outline separately.
- Preserve tab layout slots while hidden, block hidden tab interactions, reconcile native dismissal and interrupted animation, and cancel animations on unload. Respect reduced motion and disabled animation preference. Keep native floating search, bookmarks, navigation, captions and the accepted address wave unchanged.
- Retain preview.6's optional Zen Refined startup integration. Add timing and reversal tests. Actual visual validation remains pending.

## 0.2.0-preview.5

- Rebuild both inline-address transitions around native Web Animations API interpolation. Keep one final-width layout throughout opening and closing, prepare a continuous rounded wave with height-relative coordinates once, and let Gecko sample the timeline. Use CSS shape() when available, polygon otherwise; retain a script-driven compatibility fallback if the native cascade prevents animation.
- Synchronize horizontal and vertical progress with a smooth shared curve; move the native trailing identity control with the visible right edge. Preserve actual text selection and animate its highlight through a registered CSS property. No per-frame layout reads, width writes or JavaScript clip regeneration on the normal path.
- Add optional address frame-interval diagnostics, including animation engine, median/p95/max rAF interval and layout.frame_rate. These are refresh callback intervals, not presented-frame/GPU measurements. Do not change global refresh-rate preferences.
- Mark OP-006 and OP-007 confirmed fixed by user testing of preview.4. OP-002 remains open until high-refresh behavior is validated; OP-003 requires visual confirmation. Hub stays deferred.

## 0.2.0-preview.4

- Prioritize UI stabilization before Hub. Opening Liquid Wave lays out native results at the final width once, then reveals the surface with the timestamp-driven clip; cache border-box geometry via ResizeObserver instead of forcing layout each animation frame.
- Preserve closing duration and reverse-wave shrinking width; fade selection highlight before native blur without changing actual text selection.
- Fix stale center compensation when the startup address slot appears: recenter synchronously with its empty-state change, process independent edge ResizeObserver notifications before paint, and keep the tab-switch grace only for vertical geometry/contour. Floating search over a real page no longer collapses its reserved slot.
- Keep a stable temporary Compact Mode command button in OnePlane, separate from the native sidebar toolbar Zen reparents on mode changes. Original widget remains available when OnePlane is disabled or outside its layout scope.
- Add wave and center-bias regression tests, synchronize the approved Hub roadmap, and track OP-006/007. Live performance and visual confirmation are pending.

## 0.2.0-preview.3

- Documentation and update-diagnostic release: record OP-002 (opening animation frame pacing), OP-003 (URL selection disappearance), and OP-004 (intermittent Sine update discovery).
- No runtime JS, CSS or preference changes relative to preview.2. This release also provides a fresh manifest for update-path diagnosis.

## 0.2.0-preview.2

- Keep OnePlane mounted with native Compact Mode off; persistent horizontal toolbar uses normal layout flow. Compact Mode on retains the animated overlay. Stop forcing Compact Mode on startup or restoring its user-owned preference on unload.
- Preserve native caption controls if Zen moves them into the hidden toolbox.
- Record and mitigate OP-001: one-frame UI jump when activating an unloaded tab. Guard provisional blank URI and defer recentering through the existing tab-switch settling interval.
- Add address classification regression tests. Hub and workspace presets remain planned; live testing is required.

## 0.2.0-preview.1

- Introduce ordered source sections for core, native adapter, layout, toolbar, interactions and CSS; extract eight independently importable pure algorithm modules.
- Add a dependency-free deterministic Node build, build parity verification and five regression test suites.
- Keep the shipped JS and CSS byte-identical to 0.1.0-preview.32. No behavior, settings or Sine entry changes.
- Document the staged persistent-layout and OnePlane Hub architecture. Stateful controllers still share the original window closure at this migration stage.

## 0.1.0-preview.32

- Stabilize Compact Mode visibility with one visual state for the surface and controls, a 180ms tab-switch settling window and 100ms close hysteresis. Do not restart the panel transition on transient native hover flags or stationary-pointer retargets.
- Replace selected-tab scrollIntoView with horizontal scrolling restricted to its own tab viewport.
- Keep the last valid contour during native tab transactions and stop observing the animated wrapper height, avoiding unnecessary mask/layout regeneration.
- Preserve Liquid Wave, Unified Contour settings, native floating search and drag holds. Live Zen verification remains required for the intermittent flicker.

## 0.1.0-preview.31

- Add Liquid Wave for the inline address editor: expand width and reveal the native result surface together, with a smooth left-to-right wave (420ms). Reverse the wave and width together on outside-click dismissal (380ms), including interrupted opening/reopening.
- Smooth Compact Mode panel reveal/hide: move the shared background and controls together by 10px while fading in/out (300/420ms). Keep the long Unified Contour visible during closing instead of clipping it immediately.
- Keep the selected static Fade settings, native bookmark layout, floating search, page position and reduced-motion support. The collapsed hit strip remains native; hidden controls do not receive pointer input.

## 0.1.0-preview.30

- Use Unified Contour: a solid rounded bookmark shelf without its own feather, and a full-width vertical fade beginning at the bottom of the upper toolbar row. Composite the two shapes into one alpha mask before applying global transparency.
- Defaults match the selected prototype: 4% transparency, 100% fade intensity, 69px fade length, 30px solid start, 0.65 falloff, 24px maximum corner radius and 0px bookmark padding.
- Add seven live Sine preferences for these parameters. Clamp the solid start to the fade length and the radius to half the shelf depth.
- Keep bookmark geometry tracking, toolbar interaction bounds, reduced transparency, address bar and tab animations unchanged.

## 0.1.0-preview.29

- Replace the uniform static toolbar fade with Adaptive Contour Fade: a short upper edge, rounded symmetric shoulders and a lower shelf around actual visible bookmark buttons.
- Use the selected prototype's 18px radius (limited by available depth), 5px padding and 9px contour-normal feather; mask the shared tint and blur together.
- Measure individual visible native bookmark buttons and the overflow chevron, update on resize, visibility, bookmark changes and Magnetic Bookmarks transitions. Without bookmarks the contour is flat.
- Keep the existing address bar animation, reveal/close timings, hover region, tab and bookmark interactions unchanged; retain opaque reduced-transparency behavior.

## 0.1.0-preview.28

- Fade the top overlay's shared tint and blur from the tab row to fully transparent at its existing lower edge; remove the hard row fills and bottom shadow.
- Preserve the current toolbar height, reveal/close behavior, interactive controls and bookmark geometry. Respect reduced transparency with an opaque, unmasked panel.

## 0.1.0-preview.27

- Keep the center title island visible and stationary during drag; show the carried tab title or combined Split View titles. Preserve the center gap in virtual reorder slots.
- Track the actual dragged tab with the liquid indicator; span all member cards when carrying a Split View group. Collapse the line during extraction and suppress it while detached; restore it on re-entry or after the drag ends.
- Strengthen ordinary hover motion to 20% vertical scale, 7px descent and 28% favicon scale. Reserve 18px of row height; keep member hover motion inside the Split View frame.
- Preserve unloaded-icon brightness, native adoption, reduced motion and Sine settings.

## 0.1.0-preview.26

- Add optional Island Mode: compact icons in two independently scrollable lanes around a fixed-width centered title pill. Hover changes only the title and visual lift, never the slot widths; the idle pill displays the selected tab.
- Add Sine preferences for hover mode and showing the center island; keep Expand Mode as default. Hide the island if there is insufficient symmetric space or during drag, with no loss of tab order.
- Use the same magnification and 3px downward motion in both modes, reserving 8px of row height for the effect and indicator so bookmarks remain clear.
- Preserve native split groups as indivisible lane slots and reuse continuous-strip drag geometry without reparenting the dragged node at drag start.

## 0.1.0-preview.25

- Make tab hover magnification visible: 12% taller card, 2% wider card and 18% larger favicon, with smooth reversible easing.
- Fix the more-specific direct-child transition that previously omitted scale. Keep the same tab-slot geometry, split group width and drag transforms.
- Preserve reduced-motion and disabled-animation settings, unloaded-icon fade and all drag behavior.
- Record native Zen 1.24.2b feature gaps and optional visual ideas in the design notes.

## 0.1.0-preview.24

- Keep unloaded favicons at half strength throughout hover, inline dragging, extraction, desktop dragging and return; retain full-strength loaded icons and opaque cards.
- Slow unloaded icon fade to 2 seconds after the hover/drag state ends; keep the 150ms hover response.
- Shrink the complete Split View artwork as one object during extraction, using the same group ghost instead of clipping the member cards inside a narrowing frame.
- Position adjacent slots in a synchronized geometry pass during group extraction, preventing transition lag from causing overlap; keep the existing horizontal reorder and Bunny bounce.

## 0.1.0-preview.23

- Keep unloaded favicons half-strength on hover (50% opacity and grayscale), fully bright while carried, then fade smoothly to the appropriate idle/hover state.
- Render detached Split View groups with the original group accent, frame, six-dot handle, individual compact tab cards and selected-member styling.
- Keep a group's visual reorder position while beginning extraction, rather than returning to its original native slot.
- Follow Zen 1.24.2b's native split-drop activation sequence for inactive/pending tabs; reject splits against the empty workspace tab and restore the previously open startup search after an unsuccessful drop.
- Known issue, intentionally deferred: a group may hesitate or transition unevenly when reordered from an outer edge.

## 0.1.0-preview.22

- Preserve the last hovered liquid-indicator target in inter-tab gaps, split handles and group padding; return to the active tab only when leaving the strip or reaching the plus.
- Use directional edge expansion only with one to three visible tabs, counting every Split View member in rendered order. For four or more tabs use the same centered expansion for every position.
- Add a restrained hover lift (1.008x horizontal, 1.065x vertical) without changing slot or group geometry; respect reduced motion and disabled animations.
- Leave the Bunny extraction, insertion spring, drag buffer and native desktop transfer unchanged.

## 0.1.0-preview.21

- Restore bounded directional hover expansion from preview.19 while preserving intrinsic Split View widths; eliminate cumulative anchor drift.
- Preserve the approved Bunny extraction; add a 240ms full-card insertion spring with a fast-opening slot and prevent re-compression during re-entry.
- Add elastic horizontal resistance and neighbor displacement before the reorder threshold.
- Keep the liquid indicator under the selected tab when idle, retarget it on hover and return it to the selected tab on departure.
- Preserve Sine package identity and advance update metadata.

## 0.1.0-preview.20

- Anchor hover expansion to the actual tab center, including adjacent Split View groups and rapid retargeting; use intrinsic group widths.
- Add an 8px reorder hysteresis and pointer-driven two-axis squash before detachment.
- Animate one opaque in-window drag card with a 360ms Bunny bounce and reverse insertion; hand off to Gecko only at the window boundary.
- Brighten unloaded icons during drag, suppress the old detached source and preserve native tab/group drop operations.
- Keep the Sine package identity and advance its update timestamp.

## 0.1.0-preview.19

- Isolate nested drag transforms so a Split View group's frame and tabs move together.
- Measure live member widths to size groups during hover and collapse without a second independent width animation.
- Collapse the source's layout slot while detached and provide subtle visual feedback.
- Preserve the width/title transition at drag start instead of instantly snapping to compact.
- Keep the native copy-link control in the leading address slot; suppress the invalid/search identity icon.
- Overlap horizontal address growth and downward results reveal, with a short 45 ms lead for width; retain results-first dismissal.

## 0.1.0-preview.18

- Animate the actual Split View wrapper width alongside its expanded member.
- Use a transparent native drag image while the pointer is inside the whole upper toolbar, with the real tab/group following the pointer.
- Switch to the normal OS drag image outside the toolbar and hide the original until drop or re-entry.
- Unify compact and expanded address clipping, corners, text and identity icon geometry, and disable competing inline result animations.

## 0.1.0-preview.17

- Preview horizontal drag reordering in real time: the native drag image follows the pointer, while adjacent tab/group slots slide and a translucent destination slot moves into place.
- Keep native tab order unchanged until drop, preserving cancellation, split extraction and cross-window transfer.
- Give the compact and inline popover address the same painted box, header dimensions, corner radius and internal spacing.
- Start native inline popovers at compact width before the animation controller reveals them, avoiding an expanded first frame.
- Preserve the central floating search and native identity/search controls.

## 0.1.0-preview.16

- Render each native Split View as a single horizontal group with shared background, outline and a dedicated six-dot handle on its left.
- Drag the handle to reorder the entire native group within the window without unsplitting; keyboard arrows on the handle provide an alternative.
- Drag individual tabs out of the group to unsplit; treat other groups as atomic drop targets.
- Include group handle width in tab-strip centering and preserve directional hover expansion.
- Retain native page-divider resize controls.

## 0.1.0-preview.15

- Speed up tab and inline address transitions, and align the real popover with the compact field's measured origin and header.
- Neutralize conflicting Nebula address surface scale/fade and return the page to its unblurred state when closing begins.
- Move the native page zoom indicator out of the address field into the right-side actions.
- Show shared Split View group accents on horizontal tabs and update them from native group state.
- Remove a single tab from Split View when dragged into the content, out of its group in the strip, or into another window; use native unsplit logic.
- Make the native split resize divider visible and easier to grab, including at zero content separation.

## 0.1.0-preview.14

- Display animated audio playback and static muted indicators on compact and expanded tabs, using native tab media state.
- Add horizontal drag reorder, transfer to another OnePlane window, and drag outside the source window to detach using native browser tab adoption.
- Add directional Split View drop targets on the current page.
- Validate update metadata, package identity, raw manifest and branch archive with a release verification utility.

## 0.1.0-preview.13

- Expand the inline address to the actual right-hand window-caption boundary, instead of a fixed width cap.
- Keep the toolbar anchor compact throughout the popover animation, so native close does not trigger a second horizontal transition.
- Retain the final compact visual frame until native closure settles; recover if native dismissal is blocked.
- Use one consistent compact/focused/expanded surface color and 8 px corner radius.
- Preserve the native floating New Tab search and existing two-phase animation.

## 0.1.0-preview.12

- Collapse the inline URL placeholder whenever Zen opens floating search, including New Tab over an already loaded page.
- Keep the native central search visible and prevent its empty toolbar anchor from animating.
- Start inline address growth from its compact width even if Zen already expanded the placeholder.
- Preserve the same Sine package ID and preview source with a strictly newer update timestamp.

## 0.1.0-preview.11

- Animate the real inline address popover instead of just its toolbar anchor.
- Open in two phases: grow rightward, then reveal search results downward.
- Dismiss from outside in reverse: hide the results upward, then shrink the address field before invoking native close.
- Preserve the two-second toolbar hold after dismissal, native floating search and reduced motion.
- Allow an interrupted opening to reverse from its current geometry.

## 0.1.0-preview.10

- Improve compact and focused address-field contrast with a lighter neutral surface.
- Use asymmetric address expansion/collapse durations (260/360 ms).
- Keep the top panel open for two seconds after an outside click dismisses address editing.
- Slow the top panel closing transition to 340 ms; preserve ordinary compact hover behavior and reduced motion.

## 0.1.0-preview.9

- Collapse the empty start-page address anchor while preserving native floating search and non-floating keyboard focus.
- Remove the close button from expanded tabs; retain middle-click and native keyboard closing.
- Center the favicon and title together; soften expansion and collapse timing.
- Add the spring-driven liquid hover indicator with restrained cursor-relative offset, independently of Zen Refined.
- Retarget immediately between tabs; delay collapse on departure and keep the new-tab button stationary while hovered.
- Add indicator and collapse-delay settings.

## 0.1.0-preview.8

- Use a dedicated real toolbar backdrop element, with an independent tinted background on the visible navigation and bookmarks rows.
- Expand the first tab leftward, the last tab rightward, and interior or single tabs symmetrically, subject to available space.
- Keep the collapsed tab strip centered and move the new-tab button with the right edge of the expanding strip.
- Prefer pointer hover over stale keyboard focus, and cap left expansion at the available navigation gap.

## 0.1.0-preview.7

- Restore the top overlay's frosted surface independently of the native Zen/Nebula background layer.
- Provide a readable tinted fallback when backdrop blur cannot sample web content.
- Preserve the existing tab centering, left/right controls and overlay positioning.
- Respect reduced-transparency preferences.

## 0.1.0-preview.6

- Return navigation and the address field to the left edge.
- Center the collapsed tab strip against the full browser window, excluding the new-tab button and expansion reserve.
- Preserve native right-edge controls and centered bookmarks.
- Make the native top toolbar an overlay instead of resizing web content during reveal.
- Neutralize Zen's corresponding content margin adjustment within the active OnePlane layout.
- Keep Nebula height compatibility and hover retention inside OnePlane; no manual theme edits.

## 0.1.0-preview.5

- Center the navigation buttons, compact address field and horizontal tabs in one group.
- Keep page actions, extensions and native window controls at the edge.
- Center the native bookmarks row and remove flexible gaps between navigation and URL.
- Reserve expansion space for hovered tabs to avoid moving the center group.
- Measure the full toolbar height (including bookmarks) and keep it open while the pointer is within its bounds, preserving native Compact Mode outside that area.

## 0.1.0-preview.4

- Move the native translation and site-data buttons to the right end of the toolbar.
- Intercept the click used to dismiss the address field before it reaches the page.
- Give active, loaded and unloaded tabs distinct surfaces; mute unloaded favicons.
- Align the compact address at its start and apply overflow fading only on the right.
- Add a translucent frosted native toolbar background and place New Tab next to the tab list.

## 0.1.0-preview.3

- Replace the invisible fixed-position tab overlay with a horizontal view in the native navigation toolbar.
- Mirror native tabs and synchronize selection, labels, icons and open/close events.
- Expand the real address field and non-floating suggestion panel on focus.
- Preserve native toolbar reveal and fall back to the original layout when the strip is unavailable.
- Native drag and drop, folder rendering and context menus remain unfinished.

## 0.1.0-preview.2

- Configure required native Zen layout automatically using an auditable local Sine script.
- Attempt to restore saved settings on unload; gate CSS by a per-window activation marker.
- Remove the redundant internal enable checkbox; use Sine's mod toggle.

## 0.1.0-preview.1

- Initial experimental horizontal top tab bar.
- Icon-first tabs with hover expansion and compact address field.
- Native Compact Mode integration experiment.
- Fallback to the standard layout outside the supported configuration or below 900 CSS pixels.
- Manual installation, rollback and validation documentation.
- Sine package metadata and opt-in settings for tab widths, address width and expansion timing.

No stable release has been published.
