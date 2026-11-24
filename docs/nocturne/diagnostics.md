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

Preview.52 adds `layout.prefs.lease` (acquire/shared, release/last), `layout.close.pending-expired` (active flag). No pref values or window data. Close hint timeout is not proof of native cancellation; Sine beforeunload behavior is an integration limitation.

Preview.53 retains `layout.prefs.lease` and existing cleanup events; final release may follow synchronous native preference observer cancellation, after mutation returns. `ZenCompactMode:LayoutUpdate` replaces duplicate hideToolbar writes. No additional user data logged.

### Preview.53 native terminal evidence gap

All three sessions in the supplied native smoke trace end at `disassembly.native.before`, with no retained final cleanup or recorder-dispose events. Closing writes are best effort; asynchronous persistence and Sine unload order may prevent final producers reaching disk. This does not establish a cleanup failure. A1.7 must improve terminal lifecycle evidence within existing recorder and privacy/size limits, without delaying OS/browser shutdown; see [pipeline](pipeline-0.4.0.md).

### Preview.54 terminal lifecycle contract

Layout owns its final Sine callback and explicitly releases captured early boot/Center Motion resources before strip and preference cleanup. `layout.cleanup.error` records static resource label and error class; `layout.cleanup.end` records flags and thrown-step count (preference restoration has its own aggregate). `diagnostics.quiesce` reports sampling teardown failures; synchronous late producers can still trace until `diagnostics.dispose` at the microtask boundary. Asynchronous writes and cross-entrypoint cleanup remain best effort on shutdown. Archive bytes capped at 120,000 per session; `startupDropped` counts discarded archive entries independently from ring drops. A coalesced flush returns the actual write outcome. No added private data or uploads. Native verification pending.

### Preview.55 lifecycle self-review

Same-window recorder reload reuses the existing write coordinator; all coalesced callers join the follow-up write. Quiesced callbacks cannot re-arm sampling even if native removal throws. `center.dispose` records failed release-step count and delegated-close flag; `center.motion.release` now includes failure count. No new private fields. Partial initialization fallbacks release captured earlier resources. Closing persistence remains best effort, and later async Sine producers are not guaranteed to reach the recorder.

### Preview.56 native resource cleanup

`library.downloads.detach` reports released/retained booleans for attempted native removal; failed release retains the exact view and blocks replacement. `hub.uri.scope.restore` reports phase (acquire, run, reentrant, split-index), count, failed and foreign descriptor counts only on exceptional restoration/acquisition. `hub.uri.dispose` reports failed cleanup count. No URL, path, tab/workspace IDs or error messages are recorded. Async shutdown persistence remains best effort.

### Preview.57 native resource self-review

`hub.uri.transaction.release` records failed transaction-token release; `hub.uri.scope.restore` includes the new cancelled phase. No content fields. Downloads pre-acquisition disposal releases the lease without claiming native removal: `library.downloads.detach` remains an actual removal-attempt event only.

### Preview.58 cross-owner startup cleanup

`assembly.cleanup` records aggregate failed cleanup count and ownership flag; `boot.cleanup` reports failed removal count; `startup-prefs.cleanup` reports interrupted/successor/modUnload booleans. No preference values, content or paths. Layout invokes active Assembly before Center Motion disposal so terminal effects are released while their hosts exist. Terminal writes remain best effort.

### Preview.59 startup preference review

`startup-prefs.restore.result` records restored/skipped/failed counts and checkpointFailed; `startup-prefs.sync.error` and `startup-prefs.cleanup.error` record error class only. Existing invalid backup is not overwritten. Pending replacements are cancellable before acquiring preferences; old lease retained until restoration returns. No preference values or profile content recorded.

### Preview.60 workspace/closing cleanup

`workspace.geometry.cleanup`, `workspace.effects.cleanup`, `workspace.settle.cleanup`, `workspace.cleanup`, `workspace.dispose`, `disassembly.cleanup`, `disassembly.dispose` report bounded aggregate failure counts, sequence/keepGate or delegated flags where applicable. `workspace.visual.error` records error class only when native operation already succeeded. No URLs, profile values or raw error messages in new diagnostic payloads. Failed cleanup is not native-release proof.

### Preview.61 reentrant motion lifecycle

Existing preview.60 cleanup/phase/native events retained. Workspace intent is registered before synchronous teardown; close reentrant requests serialized through acquisition/seal/completion. No additional content fields, no artificial shutdown delay.

Preview.61 native file retains all three sessions with zero dropped, yet both closed-window tails stop at disassembly.native.before. Surviving-window activity and successful pre-close seal are evidenced; terminal cleanup and lease release are not. Investigate stable process/surviving-window persistence ownership, without native shutdown delay, under A1/A0.4. Do not interpret absent terminal records as failed cleanup.

### Preview.62 independent writer

`diagnostics.ready.writer`: process = independent sandbox and module anchor; independent = standalone sandbox without process anchor; local = window-local fallback; legacy-blocked = incompatible old queue, restart required; unavailable = no writer. Snapshot submission happens synchronously, disk writes remain asynchronous. One active write, at most three pending latest session snapshots, retained file cap unchanged. Private windows never submit. Terminal events still depend on actual producer execution and process survival; no shutdown delay or guarantee. Static packaged writer code only; no user content evaluation.

### Preview.63 writer self-review

`diagnostics.ready.writer` additionally reports conflict-blocked for distinct discovered modern queues; any discovered legacy queue takes precedence. No new disk submission or replacement writer on these conflicts. Restart the entire browser. Local dump remains available. Event sequence/time allocated after sanitized lazy detail returns; events discarded if the callback disposed or disabled the recorder. Unretained snapshots may result from queue policy or IO failure, not only missing file access. Existing bounds, private exclusion and immediate terminal handoff unchanged. Native Gecko identity/persistence remains unverified.

### Preview.63 native evidence and A1.10

Both new recorders report process writer and persist native unload/quiesce/dispose; the closing window also records native.after closed=true. Layout cleanup and lease release records remain absent. An isolated fixture with a microtask checkpoint between unload listeners reproduces premature trace removal before a later producer. Do not equate diagnostic disposal with Layout cleanup or missing event with failed resource release. A1.10 will review explicit terminal handoff and native/mod-disable ordering without delaying shutdown. Background RAF gaps are not presented FPS.

### A1.10 — Explicit Layout terminal handoff (preview.64)

NC4-045/081/005/037: the preview.63 native trace proved process writer persistence but not Layout's terminal cleanup. The isolated microtask experiment exposed an ordering gap; source review additionally found unfiltered capture-phase beforeunload/pagehide/unload and a one-shot Layout unload listener, which could consume descendant lifecycle events. These are demonstrated code-path risks, not a proven explanation of the user's exact trace.

Selected explicit owner completion instead of a delay or a second global controller. Diagnostics claimLayout captures the current Layout cleanup callback and returns a generation-bound, idempotent completion. On a genuine chrome window/document unload (target and originalTarget when provided), Diagnostics records window.unload, quiesces sampling and delegates synchronously with nativeExit=true; the same existing Layout cleanup remains sole resource owner. The native Layout listener is an idempotent fallback, is filtered and is no longer once. Sine final callback still invokes cleanup directly; early fallback requests delegate if an owner exists, or quiesce and finalize without one. Reentrant preference mutation may defer the completion until its existing finally releases the lease. Handoff errors record diagnostics.layout.handoff-error and allow recorder disposal. Forced dispose/replacement invalidates the captured completion. No owner callback or window reference enters the independent writer. The terminal snapshot is submitted synchronously; final recorder disposal uses a microtask only after owner completion or no owner. Late independent producers across listener checkpoints are still best effort; do not claim all Sine entrypoint terminal events are guaranteed.

Runtime `dccbaecbd4fd89e768682afe174e750ed8e33fb6`: 25 Diagnostics + 17 Layout preference fixtures PASS (42 total, nine added), including microtask separation, filtered descendant/retargeted events, explicit completion, Sine fallback, stale completion, failed handoff, disabled/reentrant disposal, actual full bootstrap registration and deferred preference release. Tests ran in isolated JS harness with mock native APIs; 11 changed runtime bodies parse as async functions. Exact source-fragment replacement in previously CI-verified generated Layout/Library/Library Services; no full local npm/Node suite or native validation claim. Full GitHub CI pending. No new prefs, writer, timer or animation changes. A1.10-R: independently review Sine callback/Gecko target semantics, stale/reentrant terminal paths, full CI and one narrow native checkpoint; A1/G2/A0.4 still open.

### A1.10-R — Independent terminal handoff review and registration rollback (preview.65)

Preview.64 at `8d1d26e080bb0ebccdc826c24142e79f05476a05` [CI 44240883629](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44240883629) PASS: 409/409 Node tests, 15 Python release tests, five reproducible generated outputs, all 12 runtime scripts, immutable and served Raw/codeload package. Zen 1.24.2b surfer.json pins Firefox 160.0; upstream FIREFOX_160_0_RELEASE nsDocumentViewer.cpp dispatches beforeunload/unload to the window with the document as target. EventDispatcher.cpp sets originalTarget to target on the ordinary path and invokes target capture before bubble. Sine 2.3.3 manager.sys.mjs replaces per-script/window callbacks, invokes them without event arguments on beforeunload and awaits callbacks individually for mod removal/rebuild. Therefore the owner handoff/filter matches the verified native target contract; cancellation after Sine beforeunload remains a host limitation and late independent producer records are best effort.

Independent extracted-source experiment on preview.64: synchronous OnePlane:StartupState consumer calls current Layout cleanup during bootstrap publication. Owner completion succeeds and controller disappears, but two window listeners and one delayed startup observer are then registered by the disposed generation. This is a code-path regression risk, not a demonstrated user symptom. Fix: register captured Diagnostics claim, native listeners and Sine callback before StartupState publication; verify current generation before dispatch and before activation/observer acquisition, guard the observer callback and roll back partial registration on setup failure. Preserve the same sole Layout owner and existing writer, prefs and visual timings. No added timers. Sine may retain an idempotent callback until the manager removes it; no unsupported Sine unregister API added.

Runtime `3257414864d076d702147f0c2b64ae7024530925`: 25 Diagnostics + 19 Layout ownership fixtures PASS in isolated JS harness (44 total; two new registration tests). First harness omitted boot-prelude input, causing the generated-prefix assertion to fail; corrected harness includes the real prelude and all 44 pass. All 11 changed runtime bodies parse as async functions, generated fragments replaced from exact previously verified build sections. Full canonical CI for preview.65 pending. A1.10-R implementation and source review complete; next verify full CI, then targeted native checkpoint for Layout cleanup/lease and recorder disposal after real window close, surviving-window tab operation, plus supported Sine disable/re-enable if available without risking the user's session. Do not repeat the prior whole visual smoke. A1/G2/A0.4 remain open until evidence evaluated. No claim of whole-process persistence or all independent script terminal events.

### A2.1–A2.3 — Shared mod-origin Workspace command boundary, switch verification and Free role (preview.66)

Source contract reviewed against Zen 1.24.2b: `src/zen/spaces/ZenSpaceManager.mjs` changeWorkspace catches native errors and resolves the requested workspace, activeWorkspace is assigned before active elements, pinned/scrollbox bindings and selection are reconciled; public isChangingWorkspace is a real native flag. ZenSpace.mjs active is an attribute-backed getter. Native _shouldShowTab may mutate ownership when a tab has no workspace ID and must not be used as a read-only predicate. saveWorkspace and reorderWorkspace propagate native workspace data through ZenWindowSync; propagation invokes peer managers without awaiting all peer completions. A successful native promise or local ID is not evidence of complete peer propagation. No native APIs are patched and no native operations are automatically rolled back.

NC4-008/033/007: new `src/core/workspace-commands.mjs` is inlined in Layout before Home/Hub; one existing window command gate is reused by managed WorkspaceTransition (lease option, no second native gate or wait on own promise). Home and Hub selection, Free startup, the switch before workspace deletion and child projection now call the shared boundary. All Hub-origin data operations and explicit create also acquire the window gate plus one process-local primitive token on BrowserWindowTracker native module identity. Exact owner token and current manager/view are checked before native mutations and after relevant awaits. Competing managed commands are rejected busy (not queued or coalesced) rather than executed late; legacy unowned visual compatibility callbacks cannot interrupt a managed lease. Native calls initiated outside Nocturne remain Zen-owned. Data anchor unavailable fails closed for data operations; a destroyed realm with an unresolved native operation may strand its process token until full restart. No timeout releases a live mutation. This is an explicit conservative behavior decision, not a claim of cross-window native atomicity.

Switch confirmation requires native idle and target ID, connected active workspace elements with no competing active element, target tabs/pinned containers, native scrollbox/pinned bindings and a connected eligible selected tab with physical ownership for ordinary tabs. Essentials use the native container rule; native empty placeholder identity can be verified even when absent from visibleTabs; Glance is a native special case. Check before reporting success, and again after presentation. Structural mismatch rejects rather than running incoming success motion; it is not proof that all asynchronous native listeners, bookmark updates or peer propagation completed. Native timing unchanged.

Free startup and manual Hub designation share the same mutation helper; role conflicts, stale manager/disposal, synchronous preference observers, post-create/reorder validity and exact native order are checked. Existing ambiguous Free is not claimed automatically, and partial native creation is not deleted. Startup claim is only consumed after verified selection or deliberate ambiguity, allowing retry on failure in a later eligible startup. No new persistent prefs. NC4-040 partial: projection user input before readiness prevents automatic switch, and later takeover suppresses automatic startup/search preparation; an already started native operation is not cancelled. Existing placement task may still finish independently. NC4-009/010/034 partial: Hub delete/restore/purge enter the data gate, delete verifies the switch away from source, rechecks lease and membership around stamp/move and before native remove; ensureTrash checks role identity after native create and refuses duplicate ambiguous named Trash. There is not yet a dedicated Trash designation UI for that ambiguity. Physical transfer journal, authoritative deletion/partial purge outcome, projection cleanup and pending-command UI recovery remain open; do not claim destructive paths fully verified.

Runtime `2319b69259a51181067cb0709a780856d0dd4be3`: 50 focused tests (new command boundary, Free startup, WorkspaceTransition) and 26 Hub fixtures pass in isolated JS harness; 16 new permanent regression tests (12 command, two startup, two motion), updated prior integration fixtures. Initial combined harness could not evaluate existing Home URL fixtures because the tool JS realm lacks URL; full Node CI required. Changed runtime bodies parse, generated Layout and Library outputs reconstructed by exact verified source assembly transformations. Full CI and native validation pending. A1 native gate remains explicitly deferred. Next A2-R independent review of this batch and full CI, then A2.4/A2.5 destructive move/purge journal and A2.6/A2.7 remaining projection/recovery. No new visual timings or intended animation style changes.

### A2.4–A2.5 — Native ownership reconciliation and partial-result journal (preview.67)

NC4-009/034, NC4-010/035: source-confirmed Zen 1.24.2b allStoredTabs and moveTabsToWorkspace behavior (see previous preflight) plus Firefox 160 Tabbrowser._endRemoveTab removes native tab DOM, invalidates cache and finally sets linkedBrowser=null. A native removeTab invocation returning undefined is not a completion certificate. Reconciliation now uses the existing workspace-commands module, not another command owner or persistent tab store.

`readWorkspaceOwnership` compares exact native tab identities in normal/pinned physical containers with native allStoredTabs, refreshing through the verified native _invalidateCachedTabs API at destructive boundaries. Mismatched IDs, missing containers/cache, unknown physical members, duplicate identity, unexpected Essentials and non-native ungrouped empty placeholders fail closed. Existing group/split/Glance exclusions remain. Source and destination must agree; an ID-only or physical-only move is unknown. Native exception stops further transfers even if that individual move can be confirmed. Metadata is written only after confirmed transfer, so a metadata failure preserves the already moved native tab and stops deletion; no automatic rollback or retry. The journal stores bounded counts (planned, attempted, confirmed, retained, unknown, notAttempted, reason), not tab URLs, IDs or titles. Per-command checks may scan native membership repeatedly; no continuous observer or polling introduced for this verification.

Hub removal captures approval, source/Free/Trash role identities, exact manager and browser, verifies selection and single-window eligibility, then moves only approved tabs. Before native removeWorkspace, after switchGuard, it revalidates both the empty source and the physical destination of every approved tab; any inconsistency keeps the workspace. The final result additionally requires missing native workspace and element. Native partial deletion is reported unconfirmed. Trash creation checks captured roles before/after creation and while waiting for native container readiness; ambiguity is not auto-claimed. Restore confirms physical move and timestamp cleanup before success motion; if the result is uncertain, stop drag motion and render actual state rather than simulate a return into a false source. Purge captures manager/role/approval, revalidates age, eligibility and membership before every native removeTab (no skipPermitUnload), checks detached tab with released linkedBrowser and absence from refreshed native list; veto/unknown stops batch, reports actual counts, consumes approval. No change to native session semantics or animation durations.

Independent command-boundary review: require a real process data token in Free designation and new destructive helpers; selection-only lease must not mutate data. Hub rename and reorder now verify native result and guard against stale continuation; sanitize unexpected native error code in command-end trace to a fixed error label. Native ownership remains authoritative. This is a bounded synchronous-operation reconciliation, not an atomic cross-window transaction; native external code and reentrant native operations can still change state. Partial native outcomes are preserved. Stuck pending native promises and asynchronous peer propagation remain open; no timeout unlocks a running mutation.

Runtime `ba77a22b482f77ef0b1b4ff706921fb75c32d24d`: 13 new permanent regression tests (actual extracted Hub command bodies, real command/inspection helpers and mocked native containers), including stale cache, ID/physical mismatch, exact placeholder exemption, successful deletion, partial second move, native exception after mutation, metadata failure, new tab/second window, native veto, partially detached tab, stale purge approval, restore and selection-only lease rejection. 51/51 focused fixtures PASS (13 new + 26 Hub + 12 command); initial run 50/51 due to missing hubWorkspaceOrder/hubWorkspaceSnapshot test fixture dependencies, corrected and rerun. Updated prior Hub session-specific UI fixture to new contract. 11 changed runtime bodies parse, generated outputs assembled with exact verified source transformations. Full CI pending; native acceptance deferred as requested. Next independent A2.4/A2.5-R review and full CI, then A2.6 remaining projection cleanup/identity and A2.7 pending-state UI recovery. A1/G2/A0.4 native gates remain deferred, A2 native acceptance open.

### A2.4/A2.5-R — Independent data-operation review (preview.68)

Re-read preview.67 at `685d310c442729bf690fab20ddd5a8e2105ba19f`, confirmed final CI and subsequent documentation CI PASS. User explicitly requires independent self-review at least once per two substantive working replies, in addition to routine checks; recorded in AGENTS.md. Reviewed actual Hub command, native ownership and approval paths independently of previous implementation.

Reproduced two gaps using extracted preview.67 functions: (1) failed replacement askPurge preflight left the prior purgePlan intact; (2) restoreTrashTab read the current role at release, accepting a tab in a replacement Trash role rather than the role captured by the user's drag. Zen 1.24.2b getWorkspaceFromId catches errors and returns null, so an absent DOM element plus failed lookup could falsely confirm deletion. New inspectWorkspaceDeletion requires a readable, internally consistent authoritative native list with expected surviving Free/Trash roles and no removed identity/element. Failed fresh purge preflight clears old approval and renders it away; approval records exact removal timestamp per tab (including all-age filter). Timestamp changes require review. Batch initial eligibility reuses one refreshed ownership snapshot, while each actual native removal still has fresh per-tab eligibility and ownership checks. Trash drag captures manager, browser, Free/Trash roles and original physical membership before lift; changed identity/role cancels transfer and settlement. No native data rollback.

Residual native boundary risk: Zen removeWorkspace first invokes #deleteWorkspaceOwnedTabs and gBrowser.removeTabs even for an empty set; Firefox 160 removeTabs invokes Services.tm.spinEventLoopUntilOrQuit during native processing. Native code can therefore permit external/reentrant state changes after Nocturne's last preflight and before native propagation; native UI update promise is also not target-specific. Do not claim atomic deletion or guaranteed exclusion of all external operations. No observed native data loss, no unsupported private replacement or native monkey patch added. This is an explicit unresolved NC4-009/034 native contract/validation gate. Verify with controlled disposable workspace/tab fixtures before release; no destructive test on valuable user data. Assess supported native alternatives or conservative deletion restriction if evidence establishes unsafe behavior. Nocturne's own commands remain gated. Large-batch performance still not measured in native runtime.

Runtime `140711300677d2fb02d09fa0f431a697e0a144a8`: 59/59 focused extracted-source fixtures PASS (16 workspace-data, 26 Hub, 12 command, 4 real-card, 1 age-menu); four new permanent tests plus existing age approval assertions. All 11 changed runtime bodies parse; generated fragments assembled using exact build transformation. Full CI pending. A2.4/A2.5-R source review and corrections implemented, native acceptance open. Next A2.6 projection lifecycle/takeover and A2.7 pending command recovery, then integrated A2-R.

### A2.6a — Projection startup ownership (preview.69)
NC4-045 partial: existing `__nocturneTrace` records `hub.projection.<stage>` with local sequence, readiness/empty flags, counts and fixed error reason. Trace failures cannot abort the native operation. No URLs, titles or raw error strings in these projection records; native persistence not verified. Destructive startup-tab cleanup, Return peer verification, placement in-flight takeover and A2.7 pending recovery remain open. No claim of complete A2.6 or native PASS.

### A2.6b — Projection native data safety (preview.70)
Projection `start-prepared` reports retained candidates and removed=0; native startup cleanup is not asserted. `return-request` / `return-rejected` describe admission, not native close success. Exact identity is checked in memory only; no tab IDs, URLs, titles or raw errors are added. Existing command begin/end diagnostics apply. Native close is a request, not a certified close or atomic peer handoff; asynchronous native external changes and a destroyed realm stranding the primitive token remain limitations. Placement already has trusted-input listeners both before startup and during native geometry retries; shared placement reentrancy/teardown review remains open. No geometry/timing change. Native acceptance deferred.

### A2.6c — Projection and detach placement lifecycle (preview.71)
Placement emits `startup-settled` with bounded outcome/reason and scope cleanup counts; `startup-cleanup-error` is fixed-label only. Projection logs startup cleanup failure without native payload. Preview.70 pinned HEAD `db3be426c83e3cb7a53164388f8b3c75ab2a16ca`, [CI 44247288463](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44247288463) PASS. Independent execution-path review: startup placement observers, timers and input listener handoff were not owned by Layout scope. A partial observer registration could reject without cleanup, and source teardown during a pending startup/geometry delay could leave an unresolved continuation. Projection native readiness and the temporary empty-tab guard were similarly tied to eventual completion rather than Hub teardown.
One placement scope per actual newly opened window, registered under existing Layout mountScope. Keep the same trusted-input and close observers from startup through bounded native retry; cancellation settles owned delay promises and disables later geometry requests. Register cleanup before observer acquisition, arm only after acquisition, attempt exact release on partial failure. Preserve the startup deadline, existing settle/retry intervals and geometry algorithms, and keep native window/tab intact. Recheck ownership after reentrant native size/restore/maximize operations, before subsequent geometry mutations. Projection uses a child DisposableScope under Hub for input and startup capture listeners, exact native empty guard and readiness observer lifetime. Trusted input disposes this scope and immediately rejects unresolved readiness; it cannot cancel a native Workspace switch already in progress. No native mutation is replayed or unlocked by this cancellation.
15 focused extracted-source fixtures PASS (4 new, 11 existing), all 11 versioned runtime bodies parse; canonical CI pending. Native Windows monitor/DPI, startup window and synced Return acceptance remain deferred. A2.7 next: separate presentation pending state from unresolved native leases, including process token stranded by destroyed realm; do not release a live native data lease on timeout. A2-R still required.

### Independent A2.6 review — preview.72

Preview.72 uses the existing bounded `hub.projection.search-cancelled` event for stale preparation (fixed reason enum `stale-preparation`) or cancelled retry (attempt counter). No additional recorder, identifiers, titles or query contents. Native persistence remains unverified.

### A2.7a — Workspace command presentation and Return peer reservation (preview.73)
`workspace.command.begin/end` include peer reservation boolean and elapsed duration on end. `workspace.command.presentation-unknown` reports reserved boolean; `presentation-error` fixed label. No new personal data or logger. Parallel preview.72 pinned HEAD `ee4ec7e1d566a913df85e026c9f18aa351705d0f`, [CI 44249720435](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44249720435) PASS; preview.71 CI 44248000241 PASS. A2.6 independent search corrections retained. NC4-041: the prior data token excluded concurrent data mutations but not a managed selection in Return's surviving source; both Home and Hub also lacked a shared slow/unknown command presentation.
Reserve the exact source gate with a primitive token under the existing Return data lease before callbacks; verify both managers and the reservation before invoking the native close request. Compatibility WorkspaceTransition honors this reservation. Unrelated third-window selection remains independent. The reservation and process token are released only on exact owned command settlement, never on a UI timer. Native external commands and asynchronous close effects are not serialized by this mod boundary. Existing gate provides monotonic elapsed time, bounded pending/unknown presentation and a change event. Home and Hub observe it while open with one deadline timer per visible view, clear timers on close/disposal, and show unknown after five seconds without changing native ownership. Hub can yield the overlay without waiting for command settlement when not dragging; existing manual close remains valid. No animation timings or native prefs changed.
18/18 focused extracted-source fixtures PASS (17 core, one compatibility transition), six new permanent regressions, 11 versioned runtime bodies parse. Canonical CI pending. A2.7b remains: opener-side Projection waiting on a child gate, process data token stranded by destroyed realm (no proven safe automatic release), late Hub UI session completion, native close request vs final close observation and integrated recovery tests. Full restart remains conservative recovery for an indefinitely unresolved native command; do not assume native close is synchronous or that dropping a lease is safe. Native acceptance deferred.

### A2.7b — Native close completion, bounded presentation and late view settlement (preview.74)
`hub.projection.return-result` outcome closed/not-closed; `return-owner-closed` fixed stage; `workspace.command.presentation-unknown` adds projection boolean. No URL, title, native tab IDs or raw error added to recorder. Preview.73 pinned HEAD `39499aa53363ea2a2c3fb787ddd2ad4fbe52d4b8`, [CI 44251578110](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44251578110) PASS. Independent review against Firefox `FIREFOX_160_0_RELEASE`: `browser/base/content/browser-commands.js` tryToCloseWindow synchronously calls WindowIsClosing and window.close; `dom/base/nsGlobalWindowOuter.cpp` FinalClose sets closed before posting ReallyCloseWindow. `xpfe/appshell/AppWindow.cpp` Destroy unregisters the window (via nsAppShellService and nsWindowWatcher, emitting domwindowclosed), destroys docshell, detaches exact chrome BrowsingContext and only then emits xul-window-destroyed; `docshell/base/BrowsingContext.cpp` Detach sets isDiscarded. SessionStore handles domwindowclosed and synchronously emits SSWindowClosing. Zen 1.24.2b ZenWindowSync.sys.mjs moves visible tab docshells in that handler into first surviving candidate from BrowserWindowTracker.orderedWindows, NOT necessarily the projection marker's source; subsequent tab state flush is separate. Native Zen #inChangingWorkspace clears after awaited UI update, so UI update alone may leave a stale visual busy flag.
Return uses the existing source gate's exact generation-owned endpoint, executing the native close request from the surviving source realm under the same process data lease and a child reservation. Fail closed unless source is the only eligible survivor (including conservative rejection of unknown third-window readiness) and tab identities are verified. Native close uses BrowserCommands.tryToCloseWindow with no synthesized trusted event. Hold command through exact child domwindowclosed plus captured chrome BrowsingContext.isDiscarded; source realm owns both observers. Native veto settles as not-closed; partial observer acquisition blocks invocation. A source close during unresolved Return removes observers but preserves token because completion cannot be certified. Source reload only replaces the endpoint, not the in-flight command. No native close persistence/flush guarantee or atomic exclusion of externally initiated native changes; third windows may still open during native dialogs. Opener view observes its existing projection pending phase with the shared deadline; real child close, trusted input or scope disposal cancels only waiting and automatic setup, never releases a running child native gate. Native-only busy view uses at most one 250ms timer during a bounded 5s visible interval; controls remain retryable and actual admission rejects native busy. Late Hub results are scoped to opening session; reconcile native data without clearing a new draft/edit/status. Roll back exact partially published leases on admission failure; process data contention explains restart recovery.
32 distinct focused fixtures PASS (19 core, 12 projection data/close, one Hub late-create), 10 new permanent regressions; 11 versioned runtime bodies parse. Full canonical CI pending. Remaining A2-R: integrated admission, physical peer ownership and native external reentrancy verification; check native Windows/Zen Return teardown and actual observer ordering before acceptance. No safe automatic global unlock for genuinely unresolved native mutations, especially when all relevant owners close. Full restart is the conservative recovery; this is not a claim that restart rolls back native data. Native acceptance deferred per user.

### A2-R1 — Integrated native command admission and ownership audit (preview.75)
`workspace.startup.wait` reports fixed reason (settled/deadline/layout-dispose/timer-error/error), not a success certificate. Existing command and projection diagnostics remain unchanged; no new personal data. Preview.74 pinned HEAD `956388ffa84fe1afa7f411e9a9007d2c9fd5391b`, [CI 44253540354](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44253540354) PASS. Integrated source review of NC4-007/008/009/010/033/034/035/040/041: Layout activation waited unboundedly for Free startup; peer admission could overwrite a command synchronously admitted during a getter; Return used fresh native cache and IDs without independent physical container/group reconciliation; destructive workspace ownership did not check pin-role membership or an off-container fake cached placeholder. Zen 1.24.2b ZenSpaceManager `allStoredTabs` traverses workspace normal/pinned and Essentials sections plus native group/glance children. `removeWorkspace` closes native owned tabs before propagating workspace data. Gecko FinalClose flag precedes unregister.
Bound the optional Free startup wait to five seconds (normal path unchanged), fence subsequent automatic actions on deadline or Layout cleanup, keep native lease until actual settlement. Recheck exact command gates at admission and after callbacks; verify exact pending promise and preserve foreign owners on release. Independently scan physical workspace/Essentials containers for Return, require exact cache identity, pin/workspace role, group identity, split/glance metadata; reject unsupported or inconsistent topology without invoking close. Strengthen destructive membership and reject any other registered window including closed-but-not-unregistered. Scope Trash readiness-only delay to existing Hub lifecycle, not the native command. Nine new regression fixtures; 67/67 focused actual source fixtures (core, Free startup, Projection, workspace data) PASS in isolated JS harness. No timing change to normal animations, no native mutation retry, no new data store.
A2-R1 source corrections implemented; full CI pending. A2-R2 remaining: independent review of startup fallback, actual native physical topology (especially grouped, nested glance and container-specific Essentials; conservative rejection is not a native failure claim), cross-window Return and external native confirmation/flush; review admission/UI integration and document final A2 disposition before A3. Native acceptance remains deferred. Native promise stranding after destruction still cannot safely be auto-unlocked; restart remains recovery. This audit does not prove data loss or validate actual Zen behavior.

### A2-R2 — Native topology, transfer preflight and final source audit (preview.76)
`workspace.startup.wait` adds fixed `user-takeover`/`setup-error`; no keyboard value or raw private data. Existing placement `startup-settled` reason and command/projection traces retained. Preview.75 pinned HEAD `6768daaaf6cec155b05dba8af7d1f2897429d8e1`, [CI 44254574976](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/44254574976) PASS. Re-read AGENTS and actual execution paths; compare Zen 1.24.2b `ZenSpaceManager.mjs` (getEssentialsSection, _shouldShowTab, _handleTabSelection, allStoredTabs, #organizeTabsToWorkspaceSections), `ZenPinnedTabManager.mjs` (addToEssentials), `ZenGlanceManager.mjs` (#configureNewTab), `tabgroup-mjs.patch` (nested folders), `ZenWindowSync.sys.mjs` (#canSwapBrowsers, #moveAllActiveTabsToOtherWindowsForClose, #syncItemPosition). Native selection visibility alone does not certify a nested Glance parent's workspace; actual Essentials section has a container attribute; native top-level group placement uses outermost group's pin role; active docshell transfer is skipped for missing linked browser or differing remoteness. Previous Return omitted these facts. Source findings and mock regressions, not observed live data loss.
Verify selected Glance via exact parent identity and matching glance ID, then its physical workspace/Essentials section. Read the existing Essentials sections, never create one through native getEssentialsSection during inspection. Verify Return nested native group ancestry/IDs and outermost pin role, exact tab document, active linked browsers and boolean remoteness. Fail closed on any Glance topology in either window and duplicate active ownership; do not promise native transfer or persistence success. Free startup observes trusted input only during its existing bounded wait, uses DisposableScope, cancels automatic follow-up but not started native mutation. Projection passes its takeover predicate to existing placement owner; input listeners precede observer acquisition and target validity is rechecked before reporting placement success. Return cleans partial observer acquisition even on source close. Nine new permanent regressions; 86/86 focused extracted-source fixtures PASS (75 core/Free/Projection/data and 11 display startup). No native API override or new timing/visual algorithm.
A2 source implementation and independent integrated audit complete at R2, subject to canonical CI. Native acceptance NOT passed: retain A2 runtime gates for actual Windows/Zen Sine, beforeunload/OS close, multi-monitor, group/Glance/Essentials, session flush, slow native switch and externally initiated native operations. Return refuses active/retained Glance in either window (native skips Glance position sync); use normal native close if unsupported. Unknown command still fail-closed until true settlement; restart only as conservative recovery. Native modal loops may permit external changes after preflight, and source survival, transfer and async persistence cannot be certified atomically by Nocturne. Do not intercept native close globally to simulate an atomic transaction. A3 source architecture work may proceed per explicitly deferred native gates; broad visual cutover still subject to its own acceptance. Preserve native command lease through motion watchdog. Next A3.1 inventory exact surface/property owners and existing MB work before making any runtime changes.

### Preview.77 bookmark fold ownership

`center.bookmarks.acquire/release/error` records numeric handle ID, static owner, direction/duration, release reason and cleanup failure count. `center.dispose` adds bookmarkDelegated and replacement. No content, new writer or per-frame telemetry. Existing privacy/size limits unchanged. Native verification pending.

### Preview.78 tab proxy transactional ownership

`center.motion` and `center.motion.release` include numeric handle ID; release includes static reason (superseded, setup-failed, disposed, release, no-visible-cards) and cleanup failure count. `center.motion.error` reports prepare/setup stage and error class. `center.dispose` retains existing delegation fields; exact close commit predicate determines retention. No new recorder, private fields or per-frame events. Native verification pending.

### Independent close acquisition review — preview.80

Preview.80 emits bounded disassembly.bypass with static reasons tab-engine-unavailable, tab-acquisition-failed, bookmark-acquisition-failed, engine-replaced or control-acquisition-failed. Existing disassembly.cleanup and native.before/after traces remain authoritative for request/cleanup evidence, not persistence proof. No raw payloads or separate recorder.

### Preview.81 preflight outcome

Existing `disassembly.bypass` now also records `bookmark-preflight-failed` and `engine-replaced` before first measurement. Existing cleanup and native-before/after diagnostics track rollback and invocation; no new logger, per-frame recording, or private payload. Preference changes use the existing observer/RAF and apply only after motion suspension ends.

### Preview.82 Assembly direct-effect outcomes

`assembly.effect.error` reports the error class and paused preparation state; `assembly.effect.cancel` reports external cancellation of an exact record; `assembly.effect.cleanup-error` / `assembly.effect.cleanup` report restoration failure, and `assembly.bookmarks.error/fallback` report shared acquisition failure and number of fallback candidates. Uses existing bounded startup decision path, no URLs, titles, extra writer or per-frame telemetry. Native evidence pending.

### Preview.83 Boot and Home ownership

`boot.prelude.cleanup` reports isolated cleanup failure counts; `home.startup.error` reports only error class on group acquisition failure. Existing startup/boot decisions and readiness timeout events remain authoritative. No new writer, observer for telemetry, or private fields.

### Preview.84 readiness outcomes

`home.startup.ready` reports ready/skipped/failed, `assembly.icons.ready` reports Home state, local topology revision and existing resource budget timeout; `assembly.readiness.error` and `assembly.resume.error` identify error class before fail-open cleanup. No DOM references, favicon URLs or additional writer.

### Preview.85 absolute Startup watchdog

`assembly.watchdog` reports age and active phase flags on hard timeout; `assembly.skip` with insufficient-budget reports remaining/required milliseconds; `assembly.settle.error` and `assembly.late.error` report error class and terminal fail-open. No separate logger or private fields. Prelude orphan expiry prevents replay; the existing Center Motion gate timeout remains an orphan safety fallback.

Preview.86: `assembly.skip` can include `stage: launch` or `resume`, `remaining` and `needed` for insufficient full-sequence budget; `assembly.late.skip` records insufficient late-effect budget without target identity. No additional sampling or timer.

Preview.87: `assembly.epoch` reports `prepared`, `legacy` and `fromBoot`; nonzero legacy identifies owners without exact epoch support. `assembly.launch.error` / existing `assembly.resume.error` report failures before fail-open cleanup. No new sampling loop or payload.

Preview.88: `address.finish` includes `reason` (finished/cancelled/watchdog/setup-failed/fallback-failed). `address.cascade.finish` records generation, opening and reason. `address.cleanup.error`, `address.cascade.cleanup`, `address.cascade.error`, `address.cascade.bookmarks.error`, `address.phase.error` and `address.dismiss.error` report bounded failure metadata. No URL or input contents.

Preview.89: `assembly.finish` reports bounded `reason`, `counts` (pending/finished/cancelled/retired) and `legacy`; `assembly.outcome.cancel` reports fixed surface name; `assembly.boundary.wait` reports pending count and remaining bounded grace. These are transaction events, no added polling or private payload.

Preview.90: `assembly.finish` snapshots counts before invalidation and reports legacy outcome capability conservatively, including a late legacy Home registry; `assembly.timer.error` reports failure to allocate the existing finish timer. No new sensitive data or sampling loop.

Preview.91: no new runtime event or logger; Fold math extraction preserves existing Center Motion diagnostics. Offline Lab counters are local synthetic preparation/effect/keyframe/proxy metrics, not native diagnostic FPS. Native candidate telemetry belongs to A3.5b.


### Preview.92 — isolated Bloom candidate

`center.bloom.acquire` reports count/effects/proxies/checks/stageEnd for an explicitly admitted candidate. `center.bloom.fallback` reports budget/preflight; `center.motion.release` and setup error include visual mode. No node identity, private data or new timer/recorder. No production caller selects Bloom; native diagnostics remain pending.


### Preview.93 — Bloom acquisition review

Existing events retained; invalid timing contracts and competing effects fail open, setup failures retain static error class and visual mode. No new payload fields, recorder, timers or private data.


### Preview.94 — Home Bloom candidate

`home.bloom.acquire` reports effects and stageEnd only, existing `home.startup.error` reports error class. No new recorder, timing loop, content, titles, workspace identity or URL fields. Dormant explicit candidate; actual native evidence pending.


### Preview.95 — coordinated candidate

`assembly.bloom.direct`: count and number of preflight checks; `assembly.bloom.fallback`: budget reason; timeline/epoch/center result now report mode (fold/bloom or exact center handle mode). No new recorder, persistent sampling, identity, titles, URLs or content. Candidate remains disabled.


### Preview.96 — prepared-cohort audit

Existing assembly launch/resume error and cleanup events cover cohort validation failure; error classes identify the failing contract. No new recorder, private payload, persistent sampling or timer. Atomic candidate interruption retains existing reason. Native evidence pending.


### Preview.97 — topology invalidation

`center.topology.reject` records owner and capture stage; `center.topology.invalidate` records transaction ID, owner, visual mode and count; `center.topology.error` records owner and error class. No tab identities, URLs, labels, persistent sampling, new observer or timer. Native evidence remains pending.


### Preview.98 — resting geometry lease

`center.geometry.reject` reports owner and capture stage; `center.geometry.invalidate` reports transaction ID, owner, mode, stage and count once per lease. Existing motion release and Assembly/Workspace cleanup report interruption. No identities, URLs, labels, new recorder or periodic sampling.


### Preview.99 — mounted Fold geometry

`center.fold.reject`: transaction ID, owner, count, partial count and static reason (partial-clip/coordinate-frame). `center.fold.geometry`: count, Split part count, maximum rectangle error (null for invalid values), valid. `center.fold.terminal`: count/error and valid=false for finished incoming mismatch; existing geometry invalidation/release report cleanup. No URLs, native identities or new periodic probes. Existing group offset diagnostic retained.


### Preview.100 — resting handoff audit

`center.fold.handoff` is a lazy one-shot diagnostic on an eligible finished incoming Fold in the existing second handoff RAF. Fields: transaction ID, owner, card count, status (`local-stable`, `geometry-changed`, `membership-changed`, `not-comparable`); maximum row-local rectangle delta and absolute row displacement when comparable (null on invalid numeric values). Phase, row, engine generation and Layout owner guards reject stale samples. This is not exact first painted-frame/compositor evidence; a real user interaction can change the resting geometry before sampling. No new timer, observer or RAF chain and no measurement callback when recording is disabled. Existing `center.geometry.invalidate` includes `slots`/`mode` stages.


### Preview.101 — contour commit failure

`contour.commit.error`: static error name only, throttled 500 ms, flush. The last ordinary contour cache key is unchanged on render/style failure; next existing invalidation may retry. Existing `contour.paint` is recorded after successful commit. Stable bookmark legacy diagnostic/renderer remains unchanged. No new sampling loop.


### Preview.102 — single contour renderer

`contour.paint` includes `mode` (visible/stable). `contour.provider.error` is throttled and records only error name; failed reads retain the last mask. `contour.commit.error` retains previous cache on rejected CSS writes. Legacy bmMask/bmContour diagnostic fields can remain null; retired stable marker is no longer observed. No new observer or RAF.


### Preview.103 — contour audit

Existing contour.paint/commit.error/provider.error and bookmarks lifecycle traces remain authoritative. Clean stable prehover may skip painting when its committed invalidation revision/provider is unchanged; no new hot-path logging. Native readback, mask paint and performance require evidence.


### Preview.104 — geometry coordinator

Existing geometry.height, geometry.workspace.prepare and contour.paint traces are retained. Height/contour share one scheduler; no new sampling or per-frame logs. Native matched profiling remains required to quantify avoided reads and paint timing.


### Preview.105 — geometry audit

`geometry.preflight.reentry` indicates rejected nested preflight (500 ms throttle, flush); `geometry.height.rejected` reports failed inline readback (force only, 500 ms); `geometry.pass.error` reports error name and dirty mask (500 ms, flush). Existing geometry.height/contour.paint retained. No new sampling loop. CENTER=4, HEIGHT=1, CONTOUR=2.


### Preview.106 geometry preflight

`geometry.preflight.result` reports ready and stage (height/contour/ready); `assembly.preflight` and `workspace.preflight.geometry` report ready/legacy, with existing elapsed/sequence. Startup can finish with geometry-unready; Workspace retains the native result and releases the swap gate without incoming motion. No private fields or added timers. Native acceptance pending.


### Preview.107 — resting geometry plan

`geometry.center.stale` reports stale order, viewport or live phase detected across centering boundaries (500 ms throttle, empty payload). Existing scheduler reconciles; strict preflight rejects partial active drag/address cascade. Existing geometry.preflight.result/contour.paint/tabs.sync retained. No new sampling or private fields. Native frequency and performance remain unverified.


### Preview.108 — geometry transaction audit

Existing `geometry.preflight.reentry` also covers projection sync and contour painting; `geometry.preflight.result` stage adds topology/stale. `geometry.center.stale` remains the throttled empty-payload marker when the lane plan loses its current owner/phase. Existing contour and height traces retained. No new sampling, private fields or timers; native fallback rates remain unverified.


### Preview.109 — resting geometry freeze

No new trace stream. Existing drag, address.cascade, tabs.sync, geometry.preflight.result/geometry.center.stale and contour.paint remain authoritative; correlate live drag/lane/incoming/magnetic/center and cascade phase markers with the absence of ordinary geometry writes and post-release sync. Explicit pull and lane autoscroll remain allowed. Native freeze and hit-test acceptance require live evidence.


### Preview.110 — native hit-region boundary

`drag.viewport.changed` reports new width/height/scale only, throttled and flushed, then existing `drag.lifecycle.cancel` reason viewport-changed owns cleanup. Rejected local split event uses reason split-hit-rejected; no raw pointer payload, title or URL. Use existing phase and geometry snapshots to compare real toolbar/spacer/control/Fade/content coordinates; DOM pointer hit and OS native non-client hit are distinct. Native region probes remain deferred.


### Preview.111 — incoming viewport lease

`drag.incoming.release` records static reason and whether rejection evidence is retained. No source tab, token, URL or window identity is emitted. Source detach fallback may be suppressed only for the captured current token on a delivered rejected drop.


### Preview.112 — drag input frame and phase

`drag.chrome-frame.changed` emits only a bounded static stage (`drop`, `strip-drop`, `dragend`, `toolbar-drop`, `window-resize`, `native-edge-resize`, `toolbar-children`, `compact-mode` or `split-drop`) and existing `drag.lifecycle.cancel` reports reason `chrome-frame-changed` or phase-owner interruption. Raw node IDs, tab identity, user input, coordinates, URLs and file names are not emitted. No new profiler/RAF channel; native frame gaps must still be measured independently.


### Preview.113 — protected drag source arbitration

`drag.source.resolve` records only bounded static `reason: "ambiguous"` (750 ms throttle). No window/tab/token/URL/title/path or DataTransfer contents are logged. Pair with existing `drag.lifecycle.begin/cancel`, `drag.incoming.release` and `drag.drop` to distinguish invalidated preview from genuine OS drag completion. Real Gecko session identity is not proven by these records.


### Preview.114 — native drag result vs consumed OS gesture

`drag.native.outcome` emits sampled bounded `{operation,outcome}` for native local tab/group move, foreign adoption, split, unsplit and select on delivered drop. Static outcomes include `confirmed`, `rejected`, `unverified`, `transferred-off-target`, `no-op` and `error`. These reflect immediate native state after synchronous calls, not a later native/session-restore/OS DragSession certificate. The existing `drag.lifecycle.cancel`, `drag.end` and `drag.incoming.release` own gesture cleanup evidence. Never log URLs, titles, tab objects, window identifiers, private payloads or files in these events.


### Preview.115 — Split native admission and settlement

Existing `drag.native.outcome` adds an optional bounded fixed `reason` for rejected/retargeted Split command candidates (e.g. `native-may-clone`, `native-essentials-unsupported`, `native-split-limit`, `selection-retargeted`, `stale-source`). `split-settle-incomplete` is an existing Drag Engine lifecycle cancellation reason for a delivered Split drop whose exact source could not be marked handled. No new recorder, persistent source cache, timer, RAF or raw native tab data. Native reentrant selection and OS drag sequencing still require Zen diagnostics/profiler evidence.


### Preview.116 — Split native group convergence

The existing bounded `drag.native.outcome` event now uses the fixed `native-postcondition` reason when a Split/unsplit native result cannot be confirmed against exact physical/returned native membership. Inconsistent pre-existing Split group topology uses `native-split-group-unready`; changes during native selection remain `selection-retargeted`. `confirmed` is an immediate native snapshot, not a promise of asynchronous future convergence or a unique OS drag session. Existing gesture settlement traces remain authoritative for token cleanup. No tabs, window IDs, URLs, titles, paths, native objects or extra polling are recorded.


### Preview.117 — Native file drag payload ownership

A new bounded `downloads.native.transfer` event records only `{mode,reason}`: `mode` is `dock` or `library`; `reason` is `ineligible`, `file-unavailable`, `native-error` or `payload-written`. The existing Dock `downloads.drag.payload` records static `{accepted:false,reason:"native-source-or-file-unavailable"}` on failure. These are **DataTransfer population** outcomes, not native OS drop confirmation. Neither event includes paths, file names, download IDs, URLs or DataTransfer content. Sampling/throttle is bounded and no new writer, RAF or poller is created. Combine with existing Bunny begin/end/cancel traces and native OS manual acceptance.


### Preview.118 — Display preview work-area reconciliation

The existing Display Engine now records bounded `drag.placement.preview` only when a live drag's current monitor is unchanged but its native available work rectangle differs from the previous preview. The payload has fixed `reason:"work-area-change"` and boolean `movedAnchor`; it is throttled to 1000 ms. This reports presentation cache/anchor reconciliation, **not** an OS placement or drop result. It contains no display rectangles, absolute positions, tab/workspace identities, labels, URLs, paths or native objects. Use with existing drag release/placement traces; no additional observer, timer or diagnostic writer is introduced.


### Preview.119 — Bounded native tab/file source recovery

Existing `drag.lifecycle.cancel` can now include fixed `reason:"native-session-unavailable"` after six consecutive unknown/unavailable Gecko session probes, alongside `"native-session-ended"` after three consecutive confirmed absent observations. The Downloads Dock's existing `downloads.drag.end` event records the same static reasons when file source liveness expires, even if Bunny artwork creation failed. Library's existing private-safe `library.*` trace emits `library.file.drag.recovered` with only `{reason:"native-session-ended"|"native-session-unavailable"}` for its Dock-free fallback. The popup's existing `downloads.drag.popup-hidden` does not mean native OS drop completed. These paths log no URLs, titles, downloaded file identities/paths, raw event/session objects or native file contents and do not create a new writer. Watchers run only for a live drag source at 200–250ms intervals, with explicit timeout teardown on normal dragend/dispose; diagnostic sampling cannot establish true native DragSession identity or OS payload acceptance.


### Preview.120 File Bunny OLE artwork paint gate

Existing `downloads.drag.tick` and `downloads.drag.end` aggregates include `paints` (actual artwork style write and forced layout flush count) and `skips` (near-static frames with physics/release pose updated without layout). These counters measure this code path, not Gecko-composited frames. The 16 ms timer and native source watchdog remain unchanged. Never log file names, paths or OS drop contents; native OS paint/profiler acceptance pending.


### Preview.121 Startup Search gesture restoration diagnostics

`drag.search.restore` emits only static `outcome` (`requested`, `invalidated`, `skipped`), static cancellation `reason`, and the same per-window Drag Engine token already present in `drag.lifecycle.begin`. Queries and native URLs are used only transiently for native identity checks and are never logged, uploaded or persisted. The native 80ms restore delay is unchanged. Actual Gecko/Zen acceptance remains pending.


### Preview.122 empty-native Workspace tab adoption diagnostics

`drag.empty.preview` records a sampled static `admitted:true` only on a newly eligible native destination. `drag.drop` adds a bounded boolean `empty`; `drag.native.outcome` uses static `operation:"adopt-empty-workspace"` and existing outcome values (`confirmed`, `rejected`, `unverified`, `transferred-off-target`, `error`). Do not record Workspace UUIDs, titles, URL or native payloads. Source token, incoming lease, terminal cleanup and diagnostic retention remain those of the existing Drag Engine. An accepted native custom drop does not equal a successful OS mutation.


### Preview.123 native drag structural lease diagnostics

`drag.topology.changed` is emitted only when an active tab Drag Engine token or a post-drag insertion visual tail has become structurally stale. The bounded event records a static `stage`, existing local drag `token` when live, boolean `tail`, previous visible tab count and boolean `sourceValid`. The existing `drag.lifecycle.cancel` reason is `native-topology-changed`; neither event logs native Workspace IDs, tab titles/URLs, folder names or DOM contents. No polling/RAF was added; event/MutationObserver wakeups are existing lifecycle owners. Confirm real OS session behavior in Zen separately.

### Preview.129 — Page Progress overlapping native requests

The existing trace channel records sampled page-progress.network {reason:"overlap-start"|"stale-stop"} for an overlapping top-level network transition and a mismatched late STOP. These are content-free bounded reasons; never record nsIRequest, URLs, status text, page titles or a request identifier. Standard events and missing-request fallback are not logged by this new probe. Native Gecko correlation and presentation timing still need target-browser validation.

### Preview.130 — Page Progress correlation correction

`page-progress.network` retains the existing sampled content-free reasons `overlap-start` and `stale-stop`. The latter now means that a STOP carried a request previously seen and superseded by another NETWORK START, **not** merely that the STOP request differed from the current one. The bounded retired-request identity set is never serialized to telemetry and is cleared at terminal completion or unload. No additional hot-path probe or sensitive request metadata.

### Preview.137 — local Media refresh commit/failure diagnostic

`library.media.refresh` is emitted by the existing Library Services trace sink only on a **current** scan success or scanner/metadata staging error. Detail is exactly `{section:"documents"|"pictures", status:"committed"|"error", count:<bounded number>}`, with `count` equal to the currently published row count on commit and zero on staging error. Neither native path nor filename, query, file content, action ID or view key is recorded. Superseded sessions are ignored, not reported as a successful commit. This does not measure decoded image memory, scanner traversal cost or OS file action success.

### Preview.138 — bounded native media scan UI-wait signal

`library.media.scan.wait` is emitted via the existing Library `trace()` channel only for a still-current local media session. The event detail has exactly `status` from the fixed `deadline`, `late-complete`, `late-error` set and `section` from current Documents/Pictures; never file names, roots, paths, query text, native file action IDs, contents or URLs. It does **not** assert that native Gecko scanning was cancelled. The 15-second deadline is scheduled once per UI wait using the existing Library data owner and cancelled on completion/stop; no sampling loop or permanent observer is added. The existing `library.media.refresh` record still contains only section/status/count for current success/error. Native scan allocation and decoded image memory require separate Profiler/native evidence.

### Preview.141 — Page Progress long-overlap retired identity audit

The existing sampled `page-progress.network` event retains only `{reason:"overlap-start"|"stale-stop"}`. The second reason means a STOP matched an explicitly superseded NETWORK START while the active session remained live. The per-session retired registry now uses a `WeakSet` instead of a strong 16-entry `Set`; no additional trace payload, native `nsIRequest` identifier, URL, page title, request count array or content is logged. Source fixture with 21 starts reproduces the old eviction error, but target Gecko event ordering and frequency remain a native-test question. Diagnostics disabled/on profiling remains an independent performance gate.

### NC4-088 — diagnostics opt-out persistence semantics (preview.142 audit)

Disabling `zen.nocturne.diagnostics.enabled` stops recording immediately and stops **new** snapshot submissions, including deferred flushes whose timer fires after opt-out. It does not erase the already captured in-memory snapshot or delete an existing `nocturne-diagnostics.json`. An `IOUtils.writeUTF8` that was already submitted while diagnostics was enabled may finish after the pref change; it cannot be safely revoked by the current process-owned writer. No background upload is involved. Do not interpret a prior authorized write's late completion as new recording after opt-out.

Source-backed tests exercise both a pending unsent snapshot and an already-submitted disk write. This checkpoint defines the existing behavior; it does not add a preference observer, cancel native I/O, or silently delete a user's diagnostic history. Actual Zen preference-flip/live write timing remains a separate native acceptance scenario.

### Preview.143 / NC4-089 — bounded metadata, no arbitrary manual labels

The original process-wide schema-2 writer, three-window/2,000,000 UTF-8 byte limits, opt-out behavior and private-window refusal remain unchanged. The per-window recorder now validates event/throttle-name structure, stores throttle identities only for throttled events with a 256-key oldest-first cap, and limits recursive detail traversal to 1024 values (existing depth/array/object limits still apply). Diagnostic object keys representing URLs, filesystem paths, page/tab titles, search/query/input text, raw payloads and credentials are ignored. Unrecognized string fields, free-form human text, URL schemes and paths are not recorded; expected status, error-class, CSS geometry and known data-attribute values still have restricted string grammars. Redacted **string values become null** in permitted fields. Manual `__nocturneDiagnostics.mark("before-drag")` accepts only 1–40 character lowercase symbolic identifiers with letters, digits, dashes and underscores; invalid labels return false and create no trace.

This is a defensive metadata-admission contract for current producers, not a full typed schema for every event, nor a purge of older JSON files. Some formerly free-form diagnostic values will be absent; native Zen/Sine acceptance and the further field-by-field producer schema audit stay OPEN. Existing lifecycle trace identity and ordering, file privacy and local-only persistence are unchanged.

Canonical preview.143 production: [PR #15](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/pull/15), commit `b2e4e370fd07bf412002aa872f6289323606002f`, [CI 45097834977](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45097834977) SUCCESS (815 Node, 15 Python, 12 parser checks, public Sine artifacts). Generic scoped source hardening is verified, not a full per-event schema or actual native Zen privacy/performance certification.

### Preview.144 / NC4-089-R2 — restore known native outcomes without raw strings

Independent readback of preview.143 exposed dropped diagnostic evidence: drag previous/requested mode and native dropEffect, Workspace command result `code`, address start `name`, plus the invalid Home `snapshot unavailable` event label. Existing `safe()` now admits these and related native/animation fields using **finite value sets**, not a general relaxation of string privacy checks. Enumerated fields include drag `previous/requested/drop`, Workspace `code` and `from/to`, Startup `startup/ready/homeState`, address `engine`, disassembly `resultType`, and existing fixed `easing`. The address begin producer now emits `phase` to match `address.finish`; Home emits `home.search.snapshot-unavailable`. Unexpected strings still redact to null, and URL/path/title/query/filename/user text restrictions remain.

Do not equate restoring source diagnostics with native drag success, Workspace command convergence or OS drop acceptance. The process writer, schema, 256-key throttle bound, 1024-node scan budget, opt-out/private guards and local file limits are unchanged. The old on-disk sessions are not rewritten. The complete event-by-event producer audit and Zen/Sine privacy/performance acceptance remain separate OPEN gates.

Canonical preview.144: [PR #16](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/pull/16), production `e191d2be0405b23129ff33960fb92767315e2d49`, [CI 45111169738](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45111169738) SUCCESS — 818 Node/15 Python, 12 parsers and verified Sine artifact. This closes only the previously reproduced source diagnostic omissions; actual native event ordering/privacy/performance and exhaustive schemas remain OPEN.

### Preview.145 / NC4-089-R3 — chrome attribute, Workspace code and popup evidence

Exact source replay at preview.144 confirmed further recorder-induced omissions: unknown-but-source-declared Workspace command error codes, `chrome.attributes` missing every structural node/attr/value, popup Bunny computed color/appearance/radius/flip, platform and scoped layout error class. Preview.145 restores only bounded diagnostic metadata through the existing recorder. Workspace codes and OS values use finite lists. The internal `chrome.attributes` event retains the original array shape but accepts only root/observed nodes, attribute names from the recorder's own capture lists, and finite lifecycle-state values; unknown content becomes null, unrecognized names and nodes are skipped. CSS popup values are accepted only under `downloads.drag.popup-shown.surface` with bounded numeric/CSS color/size/appearance grammar and URL/path exclusion. Layout and Hub scope errors now emit `name` instead of the non-admitted `error` field.

No extra event source, writer, observer, timer, native command, UI behavior, browser content or user data collection. The existing local-only schema-2 writer, diagnostic opt-out, private-window disk refusal, 3-session/2 MB bounds and throttle/budget limits are unchanged. Four source-backed tests replay positive and adversarial event inputs and the actual popup CSS sample. Native Zen/Sine parser/runtime acceptance and the remaining generic reason/status event-by-event semantic inventory are separate gates.

Canonical preview.145 [PR #17](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/pull/17), production `5c88a841ebc76a097e20b25b954477d4fbc323c4`, [CI 45114926054](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45114926054) **SUCCESS** (822 Node, 15 Python, 12 parsers, public Sine package). This is source-level preservation of known diagnostic metadata, not exhaustive per-event privacy certification or native Zen profiling.

### Preview.146 / NC4-089-R4 — Closed Tabs scope error class (source/CI CLOSED)

Independent replay at preview.145 found that the existing `ClosedTabsService` error handler emitted `library.scope.error` with a string `error` property, which the NC4-089 sanitizer excludes. This silently discarded the native observer subscription/unsubscribe exception class. Preview.146 changes only the producer field to `name`, matching the existing Layout/Hub scope-error contract and the recorder's bounded error-class grammar. The new regression extracts that actual callback, forces Closed Tabs observer cleanup to throw, and checks that `TypeError` survives while the raw exception message is absent from the persisted dump and console echo. No new log sink, owner, native command or data field.

Canonical production [PR #18](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/pull/18), commit `c9011b7dcbf9335f0116fd68048dbf7d7475c846`; [CI 45116100787](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45116100787) **SUCCESS** (823/823 Node, 15/15 Python, 12 runtime parsers, deterministic build/release policy, public Sine artifacts). Closed Tabs error-class omission source/CI CLOSED; full generic per-event `reason`/`status` semantic inventory and native Zen/Sine diagnostics privacy/performance acceptance remain OPEN.

### Preview.147 / NC4-089-R5 — event-specific reason/status fields and console boundary (source/CI CLOSED)

The existing per-window recorder admitted any syntactically short token for `reason` or `status`. A source-driven enum now applies to exactly 15 reviewed events: Library opening/shortcuts, media scanning/refresh and drag recovery, native Download transfer/payload, Home Search close and snapshot failures, Page Progress network overlap, and selected center motion/fallback outcomes. The rule is top-level and event-scoped; unrelated producers are unchanged pending review. Missing, null and numeric/boolean metadata are unchanged. Unknown string values become null before JSON dump, Browser Console structured logging or disk persistence.

Home Search `searchLog` previously passed the raw `fields` object to `console.info`, outside the diagnostic serializer. It now prints only the fixed event name, while structured telemetry remains available through `__nocturneTrace`; snapshot error class is routed as `name` and validated against the existing bounded exception grammar, not free-form `reason`.

Source-backed tests verify literal producer reasons and statuses (including native transfer and Page Progress), refuse arbitrary diagnostic tokens, and assert that Home Search's direct Console log and recorder do not retain hostile marker content. No native browser operation, screen behavior, preferences, writer or file budget changes. [PR #20](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/pull/20) merged to `2e26594448ff227e5a257ed9a406af9f91ea2ff4`; [CI 45123101888](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45123101888) **SUCCESS**: 825/825 Node, 15 Python, 12 parsers, reproducible package, release metadata and public Sine archive. Other `reason`/`status` producers, direct console paths elsewhere, native diagnostics on/off/private/multiwindow and Gecko profiler remain independent OPEN gates.

### Preview.148 / NC4-089-R6 — Smart Search exception class, not message (source/CI CLOSED)

Smart Search is an independent Sine provider and exposes a window-local status via `__zenRefinedSmartSearchStatus()`; it is not serialized by the main Diagnostics recorder. The provider's result catch and registration failure catch previously assigned `String(e)` to status `error`, while six `console.warn` paths directly echoed native exception objects. Such messages may embed the current URL, title or query. Preview.148 uses the same internal class-only extraction for both status and warnings: valid `Error`, named `*Error`/`*Exception` and `NS_ERROR_*` class codes survive; unknown, malicious or throwing `name` access returns `Error`. No exception message, stack or native object is logged by these paths.

A source-extracted real provider regression forces each result callback to throw a `TypeError` with a simulated sensitive URL, verifies bounded status and captured warnings, and additionally probes malicious `name`. A full-script late-init failure regression checks retained status `Error` and no URL in any console argument even after partial registration cleanup. `[Zen Refined] Smart Search` numeric eligibility/count logs and browser selection mechanics remain unchanged.

Canonical [PR #22](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/pull/22) production `c4877e9aa8885d098959dd6fb4d8498ff91b8e6e`; [CI 45125761168](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45125761168) **SUCCESS**: 826/826 Node, 15/15 Python, all 12 parsers and reproducible/public archive. This addresses only Smart Search's audited paths. Other modules' direct console exception messages, generic `reason`/`status` fields, private/multiwindow Zen browser results and measured profiler overhead remain OPEN.

### Preview.150 / NC4-089-R7a — Inlined Layout owners emit only bounded error classes (source/CI CLOSED)

The opt-in Diagnostics recorder previously sanitized `__nocturneTrace` but could not sanitize direct Browser Console logs. Real Layout sources for Home, Hub, Bootstrap, window lifecycle, tab drag/detach, display, startup search restoration and address animation forwarded raw native exception objects; Hub could also render arbitrary `error.message`. New `src/core/error-class.mjs` is a **pure**, build-inlined helper with finite allowed standard/native exception names; unknown, content-bearing or throwing class names become `Error`. Production catch blocks retain diagnostic context and only this class; Hub errors use fixed text and leave command leases untouched. The helper is not a new persistent logger or global process owner.

Tests cover positive/hostile error names and the extracted real Home subscriber callback, and assert all nine touched source producers use the same sanitizer. First [CI 45134434548](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45134434548) was **FAIL** because 17 existing isolated test invocations lacked the newly added inlined pure helper. The subsequent six test-harness corrections in [PR #27](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/pull/27) inject its real exported implementation; successful canonical [CI 45134865787](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45134865787) **SUCCESS**, 829/829 Node, 15 Python, exact installed package `0.3.0-preview.150`. The version was not reissued for test-only changes.

**Exclusions:** external independent Sine entrypoints' raw console errors, generic per-event `reason/status`, native diagnostics on/off/private/multiwindow/profiler, and Library NC4-022/082/083 memory/cancellation. Browser Console error-class safety is source-proven only for the nine inlined owners, not all Nocturne or Zen.


### Preview.153 / NC4-089-R7c-P2 — Finite Diagnostics name classes and source-scoped reasons

The recorder's early `name` sink previously admitted arbitrary `[A-Z]…Error` strings, unlike the existing finite 27-class producer filter. The early recorder now uses the exact finite class set with an automated source-level parity check; unknown names become `null` in both the JSON dump and mirrored Console. Eight source-backed Assembly, Disassembly and Drag `reason` event families now have explicit value sets. Runtime event producers, native commands, lifecycle scopes, animation timing, resource ownership and diagnostic storage quotas are unchanged.

[PR #35](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/pull/35), `preview.153` production `545c3e2adf5cc5caa16b26e79e4259b383333471`; [CI 45141588472](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45141588472) **SUCCESS**: 835/835 Node, 15/15 Python, 12 parsers and public Sine package. Remaining dynamic `reason/status` domains and real Zen/Sine private/multiwindow/diagnostics-on-off/profiler checks are OPEN; Library NC4-022/082/083 memory/cancellation P0 gates remain OPEN.

### Preview.154 / NC4-089-R7c-P3 — Center release and drag outcome bounded tokens

The Diagnostics recorder now accepts only source-backed finite `reason`/`status` values for `center.motion.release`, `center.bookmarks.release`, `center.fold.handoff`, `drag.lifecycle.cancel`, and `drag.native.outcome`. Adversarial strings are replaced by `null` before local dump and mirrored Console; actual native cancellation, topology rejection and Split preflight tokens stay distinguishable. No new data source, writer, timer, native command, drag/motion controller or producer change. Source/CI pass is not actual Gecko/Zen evidence.

[PR #37](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/pull/37), `preview.154` `de8b7fa8213787d9fb3168aef51c94b9da12cf6b`; [CI 45143471266](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45143471266) **SUCCESS** (836 Node, 15 Python, 12 runtime parsers and public Sine package). Library P0 and native acceptance OPEN.


### Preview.155 / NC4-022/082/083 — local-media scan admission status

The existing `library.services.ready` aggregate now includes the boolean `mediaScanAvailable:false` when the explicitly approved temporary native-scan safety gate is active. It includes no local paths, folder names, URLs or file data; it adds no diagnostics writer or observer. The Library controller reads the same read-only capability to hide scan controls. Source/CI [PR #39](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/pull/39) / [run 45247966548](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions/runs/45247966548) PASS. No native scans are newly admitted by the new Nocturne Media service, but pre-upgrade native tasks and the stock Zen Library remain outside this gate. Full restart and native/Gecko profiler acceptance remain OPEN.

### Preview.157 / NC4-089-R7c-P4 — remaining native-result reason domains and direct Display Console

**Source finding:** `downloads.drag.end.reason` receives only the local `dragend` default and two native session-watchdog fallback reasons; `workspace.data.journal.reason` receives a finite set from `workspaceTabJournal` and the Hub's known move/purge step results. The recorder previously accepted any short token in those two event fields. Preview.157 gives both exact source-backed reason enums, preserving legitimate statuses and replacing unknown tokens with null before dump, Console mirror and disk write.

**Direct Console finding:** Display Engine's `logPlacement` was outside the recorder and printed desktop geometry even after the user opted out of diagnostics, with raw `extra` objects serialized. Preview.157 makes this Console diagnostic obey `zen.nocturne.diagnostics.enabled` and includes only expected numeric rectangles, finite stages and snap modes, and finite lifecycle reason/counter/boolean fields. The browser's native window state and placement paths remain unchanged. Independent per-feature address diagnostics use their own opt-in and were not modified.

Two new actual-source regressions cover the enums and the `logPlacement` opt-out/redaction boundary; native Zen/Sine/OS validation remains OPEN. Full producer-by-producer certification of other event string fields, direct console paths, and measured diagnostics/profiler overhead are not inferred from this pass.

### Preview.162 — MB-014 Sine-only early CSS probe

The native Zen 1.24.2b browser.xhtml begins with zen-before-loaded=true. ZenStartup.openWatermark runs at MozBeforeInitialXULLayout and removes the marker when zen.watermark.enabled or workspace eligibility is false; closeWatermark removes it after native initialization. Sine 2.3.3 manager loads window modules after load, and stylesheet application can race module import. The optional CSS cover uses the native marker, existing Boot/animation prefs, and 2s CSS fail-open, with no input interception. A window-lifetime handoff latch prevents re-cover on abort/hot reload. boot.prelude and assembly.eligible.check add nativeBeforeLoaded/nativeWatermark/sineCSS/cssCover boolean observations. CSS computed-style reads occur once per early entry, only with diagnostics enabled. paintCount is Gecko paint evidence, not presentation timing; false CSS coverage may also mean the native marker has disappeared or the CSS timer expired. No profile changes, no new pref or global observer. Native comparison and pre-injection boundary remain open.

### Preview.163 — HS3.1 Home search baseline

`home.search.open-baseline` and `home.search.close-baseline` share a local probe sequence `id` (not a native tab or query identifier). One summary per started phase, with complete/interrupted and opening bypass/readiness-ended reasons. `elapsed` is wall time since phase start; `frames` counts existing animation callbacks; `gapCount` is the first at most 512 valid successive intervals, `gapDropped` counts overflow; p50/p95/p99 are nearest rank in milliseconds, max includes overflow. No extra RAF or per-frame event. Opening records `waitFrames`, `firstRevealMs` (time to schedule first reveal), `rounds`, existing natural-height `measureCalls/measureMs`, `resizeReads`. Both summaries report cumulative snapshot attempts/success/cost/max cost and attempts before the opening summary (`snapshotDuringOpen`); the close summary includes the opening totals. Compare their deltas, and existing close-start/finish handoff timing. No text, URL, query or raw snapshots are logged. Opt-out prevents probe creation and suppresses summary; summaries do not independently arm the generic recorder's sampling. Callback gaps are not presented FPS. Layout/paint/composite attribution requires Gecko Profiler, and diagnostic overhead requires on/off comparison.

### Preview.164 — Library motion diagnostics

Existing recorder gains Library-produced events (no new logger): `library.motion.begin` (phase/section/duration), `library.motion.frames` (epoch, completed, frames, elapsed, p50/p95/p99/max, over25 callback intervals, maximum 300 samples; RAF cancelled on completion/interruption/teardown and absent if disabled/reduced motion), `library.render` (section/phase/row count/render duration during opening/switching), and finite `library.filter.changed` mode/scope. No per-frame DOM/style reads or individual frame events. Preserve prior `library.motion.settled` computed endpoint comparison. Aggregate callback cadence is not presented FPS; compare real Zen diagnostics on/off and Gecko Profiler if compositor remains suspect.

### Preview.165 — HS3.2 pointer boundary

`home.search.pointer-boundary` reports one structural record per pointerdown observed during an active Home search before return: local probe id, classified background/consumed booleans, exact Home/host/panels/bar/barChild booleans and primary-press status. No coordinates, DOM IDs, input strings or URLs. No new sampling arm. A consumed press runs the same live handoff as Escape and should produce `home.search.close-start.reason=home-background`. A native-observer close after an unconsumed press is useful evidence for a missed target or inactive native state, not proof of a presented flash. Existing baseline/close events retained.

### Preview.166 — MB-014 global native visibility experiment

Preview.164 diagnostics from three archived starts showed Assembly after prior Gecko paints, with native watermark enabled but zen-before-loaded already removed; the old per-window pseudo-element probe was inactive. Sine 2.3.3 StylesheetManager registers style.content via nsIStyleSheetService.USER_SHEET following asynchronous stylesheet rebuild. Move the experiment to an independent early-startup.css manifest content entry, exact browser.xhtml URL and browser windowtype only. Temporarily animate the chrome body's opacity to zero without fill; the existing root-level Boot remains outside the body. On handoff/skip the existing window-lifetime latch removes the selector; no native styles are overwritten. The 2000ms fallback is relative to CSS animation start, not process start; late registration may still miss first paint. Existing settled-window markers, existing prefs, reduced motion and unsupported modes exclude hiding. No new preference, profile edits or loader patch. boot.prelude and assembly.eligible.check now report globalCSS and cssHidden rather than sineCSS/cssCover, alongside nativeBeforeLoaded/nativeWatermark/paintCount. These are point-in-time style observations, not proof of presentation before the first frame. Native visual test pending.

### Preview.167 Library lifecycle

`library.unload.ignored` reports foreign-document once per controller generation, `library.dispose.begin/end` report replacement/window-unload/sine-unload, phase/ownership and failed cleanup count; `library.button` adds finite accepted/rejected/api-missing/exception reason and overlay/services booleans. No event target identity, URL, key, query, or error text recorded. Native logs are bounded; the third supplied .164 session dropped 489 early events and cannot establish the exact disposal cause.

### Preview.168 — shield routing

`home.search.pointer-boundary` records `shield:true` when the exact existing Address shield receives the press. This is not a consumed Home pointerdown: the shield owns the full gesture. `home.search.shield-dismiss` with `handled:true` identifies successful delegation to Home at the shield's normal dismissal boundary. Existing close-start/finish and baseline events establish whether Home used the live home-background route. No private payload or extra observer/timer.

### Preview.169 — MB-014 native sidebar experiment

Preview.167 cold starts did not observe the experimental global CSS marker. Retire its manifest entry; the old CSS file contains no rules for stale manifests. Zen 1.24.2b Compact Mode's native sidebar.inc.css uses hide-tabbar and zen-compact-mode=true to hide navigator-toolbox/titlebar, with explicit reveal and animation exceptions. OnePlane now requests hide-tabbar=true instead of false. On confirmed native exit of the last applied Layout owner, retain only a still-owned, matching sidebar pref and its baseline in the existing original-layout backup. Release other prefs; snapshot recaptures released entries on next activation. Live disable restores the original sidebar value if still owned, as before. Compact Mode enable-at-startup remains user-owned. If the original sidebar pref was already true, no persistent ownership is needed. boot.prelude and assembly.eligible.check now report nativeHideTabbar/nativeCompactStartup/nativeCompact/nativeSidebarOnscreen/nativeSidebarReveal/nativeSidebarAnimating/nativeTitlebarHidden, with a single bounded style/rect probe when diagnostics enabled. Onscreen is a geometry/style heuristic, not a presented-frame observation. Native CSS may still initialize too late or reveal the sidebar. Normal exit, restart, horizontal tabs, live disable and multi-window verification pending.

### Preview.170 Library direct section transition
`library.section.motion` records source/target section, direction, duration, epoch; `library.section.queued` records latest requested section during a flight. Existing `library.motion.frames` now also samples switching phase, bounded to 300 gaps and diagnostic opt-out. No query, URL, titles or visual snapshot contents in diagnostics. Compare p50/p95/p99/max and over25 with previous opening/closing summaries; these measure RAF cadence, not display presentation.
