# Nocturne — staged migration pipeline

This is a proposal in integration/unified-core. Do not advertise a Sine preview or change the current preview manifest until gates pass.

## A. Pin and inventory

- OnePlane: 4281c4778f3851f939ad3cfdb01406238ff2d2a0 (0.2.0-preview.62).
- Refined: 1926eacbe29782d80324ac277563aff514bf6943 (0.6.0-preview.26).
- Preserve source commit provenance in an import ledger, including source path, blob/checksum and destination. Both projects MIT; retain attribution/LICENSE and relevant history/docs.
- Run current OnePlane npm run verify and Refined node --test tests/*.test.mjs on pinned trees; record existing failures instead of hiding them. Native Windows Zen baseline captures: horizontal + Refined, cold startup, Home search, workspace changes, drag/split, downloads, bookmarks, closing. No claims of baseline runtime verification yet.

## B. Parity package (0.3.0-preview candidate)

Import the existing Refined scripts as independent entries, not a rewrite.

| Source | Destination/action |
| --- | --- |
| bookmarks.uc.mjs + magnetic-bookmarks.css | Existing OnePlane copies exactly match; keep one implementation and six existing bookmark preferences |
| page-progress.uc.mjs | Copy with tests and relevant CSS |
| smart-search.uc.mjs | Copy exact native provider, styles and tests; preserve manager registry and NAME |
| downloads-indicator.uc.mjs | Copy with downloads CSS/tests; audit host guard (900px) and actual narrow-width slot; separate fix from byte-parity import |
| startup.uc.mjs | Copy early preference ownership; test original backup/user/default restore |
| startup-animation.uc.mjs | Copy Center Assembly and phase/hold handshake |
| closing-animation.uc.mjs | Copy native close command ownership and tests |
| workspace-transition.uc.mjs | Copy controller, explicit Home/Hub bridge and tests |
| chrome.css | Extract non-bookmark portions into ordered source fragments, preserving CSS cascade; do not concatenate duplicate bookmark block |
| preferences.json | Merge by property key. At baselines 23 OnePlane entries + 15 Refined entries - 6 overlaps = 32 unique preference keys. Verify definitions/defaults and preserve both namespaces |
| theme.json | Existing OnePlane identity; display name Nocturne on release; union of script entries; no second bookmark entry |
| docs and tests | Import Refined validation and roadmap/known issues under clear provenance; resolve duplicate test filenames deliberately |

Expected nine distinct runtime entries (existing layout + shared bookmarks + seven other Refined scripts). Keep layout.uc.mjs and existing chrome.css build structure first. Add deterministic CSS source extraction and parity tests. Replace the shared-bookmarks upstream synchronization lock only once one source is authoritative; preserve historical source hash and update tests/release check explicitly.

Sequence each import in a separate commit with tests. Do not clean up/reformat files while proving equivalence. Test a single package with legacy Refined disabled; compare against the two-mod baseline. If cascade differs, inspect computed style/geometry and fix explicitly rather than assuming import order is equivalent.

## B.1. Package Stabilization (0.3.0-preview.2)

See [audit register](audit.md), NC-001 through NC-007. Resolve confirmed Downloads and Startup ownership defects before refactoring the core. Legacy conflict warning is diagnostic only; full safe coexistence remains unvalidated. Record actual Windows Zen validation and computed-style parity; do not call the package stable based solely on CI. Keep the current developer preview usable with Refined disabled.

## B.2. Full audit and second stabilization gate (after preview.2)

[Full source/integration audit](full-audit-preview.2.md) and [register](audit.md) cover NC-008–NC-022. User smoke test reports functional parity with inherited jitter and no proper Downloads UI slot. Do not treat the lack of a slot as a missing imported script.

- Stabilization A: NC-009/016 native workspace arbitration, NC-010/011 generation-safe feature mount, NC-012 reliable teardown, NC-008/021 Utility Dock host/hold/geometry prototype. Separate commits and tests; no blanket refactor.
- Stabilization B: NC-013/014/015 controlled profile of animation/geometry/contour; one owner per surface, preserve accepted visuals.
- Unified Core includes NC-017/018/019/020; Page Progress NC-022 test/host design. Native visual parity and migration gates remain NC-002/005/006/007.
- All nine entrypoints reviewed. Audit docs are included with preview.3. Docs-only changes do not bump preview.

## B.3. Stabilization A implementation (preview.3)

NC-008/009/010/011/012/016 addressed; NC-021 initial compact host/hold/anchor implemented. Full lower Utility Dock remains planned. Candidate source tests and actual Zen acceptance are separate gates. Continue Stabilization B only after checking the new host and interaction regressions.

## B.4. Visual stabilization after preview.3 smoke test

Preview.4 fixes NC-023 Downloads text opacity and NC-024 Workspace visual handoff; use two stable surface fades, keep the swap gate until native/mirror settling, and coordinate bookmark/hover state. Native page flicker and general geometry/contour optimization remain investigation items. See audit.md; no blanket motion rewrite.

## B.5. Startup / workspace motion refinement

Preview.4 user test confirms text and flicker fixes. Preview.5 addresses NC-025–027: cold readiness handshake, bounded workspace geometry hold and visual interpolation, coordinated row and page motion. Verify wide/narrow, one/two-row changes, Compact/persistent modes, Escape and cold startup in Zen. Continue measured stabilization before Unified Core/Vertical.

## B.6. Diagnostic gate after preview.5 regression report

Preview.6 is instrumentation only, default enabled. See diagnostics.md and audit.md (NC-025–030). Capture actual launch/close, native tab and workspace events, panel contour and drag thresholds. Prioritize confirmed regressions from user traces before new visual changes. Remove or default-disable detailed diagnostics after stabilization.


## B.7. Magnetic Bloom startup stabilization (approved)

Current checkpoint: Nocturne 0.3.0-preview.40; startup audit originally reviewed at preview.38. User selected **Startup Motion Lab option 01 — Magnetic Bloom**, and requested architecture review before implementation. This is the next startup workstream, not a shipped feature. The existing Library and Downloads workstreams remain independent; do not roll back their changes or declare their native validation complete. See [MB-001–015](../known-issues.md#nocturne--magnetic-bloom-startup-audit-2026-11-17) and [startup validation](validation.md#magnetic-bloom-startup-gates).

**Hard sequencing rule:** fix ownership and readiness before visual work. No new startup script entry, no second source of truth, no speculative global scheduler or simultaneous native startup preference rewrite. Preserve the existing Sine entry name and public compatibility APIs during extraction.

| Gate | Scope | Exit requirement |
| --- | --- | --- |
| MB0 — baseline | Freeze the current accepted behavior, record source hashes and capture cold/warm Zen traces (Boot, Home, layout, first workspace, close). | Distinguish user-reported symptoms from source hypotheses; retain comparable diagnostics-off baseline and accepted Lab option. |
| MB1 — lifecycle (MB-001/002/011) | Per-window StartupTransaction, generation, one absolute watchdog, explicit state machine and cleanup stack. Prelude transfers a cover lease only. | Both load orders, repeated finish, disable/reload, timeout, close and failures leave no cover, hold, timer or stale callbacks. No visual redesign yet. |
| MB2 — readiness (MB-003/004/005/011) | Explicit layout, native/session, Home and icon readiness; Home eligibility and single claim; bounded preflight; freeze geometry/structure with lease. | Ready/skipped/fallback states resolved before reveal; late async Home cannot replay; placeholders and deferred updates remain valid; user input stays native. |
| MB3 — shared timing (MB-007/008/012) | Extract pure `src/algorithms/startup-timeline.mjs`; compile it into runtime and generated HTML Lab via existing deterministic build pipeline. | Same pure plan in both outputs, bounded stagger for arbitrary counts, one document timeline epoch, no independent elapsed clock or competing completion timer. |
| MB4 — visual engine (MB-006/010/013) | Real-slot Magnetic Bloom candidate; measure style ownership and compare with proxy fallback. Preserve Fold for workspace/close. | No collisions, stable Home center/slot dimensions, finite keyframes, no per-frame JS layout; Gecko computed-style and performance evidence. |
| MB5 — Home choreography (MB-004/012) | Home Island shape/label, panel, tab wave, bookmarks, search, Pinned and Workspaces, footer. | Matches approved Lab; existing node identity retained during reveal; no abrupt focus/outline, icon or structural flash; regular Home/search unchanged. |
| MB6 — atomic handoff (MB-009/010/011) | Seal final effects, reconcile pending data, verify geometry, release leases and CSS gates without exposing intermediate states. | Last animated frame equals first resting frame; resize, interaction, workspace, close and native fallback cleanly interrupt. |
| MB7 — validation (MB-001–013) | Full CI, candidate Sine package, native Windows Zen matrix and comparative profiling. | All blocking gates in validation.md pass; no new runtime regressions; actual native acceptance before declaring fixed. |
| MB8 — native early flash (MB-014) | Independent research on earliest Sine injection and Zen/Gecko/OS first paint, including current startup placeholder preferences and Windhawk as an unconfirmed factor. | Evidence identifies controllable boundary; separate scoped proposal and tests. Do not gate all Bloom work on OS-level behavior outside Nocturne. |

Target state flow: BOOT -> PRELOADING -> PREPARED -> REVEALING -> HANDOFF -> READY; any active state may transition through ABORT to a single cleanup/READY path. A generation token guards every async continuation. Keep native session/workspace data authoritative. DOM attributes are projections, not a second state machine. One owner coordinates startup effects; layout, Shared Home and Center Motion supply capabilities/leases only. Existing Overlay coordination remains responsible for user overlay ownership.

Timing reference: the approved Lab's nominal sequence is ~2.86s, including splash. The readiness hold can extend it; it is not a startup-time guarantee. Panel begins near 940ms, splash exit 1010–1330ms, Home Island 1080–1640ms, tabs 1330–1940ms, bookmarks 1600–2060ms, search 1710–2230ms, Pinned 1930–2500ms, Workspaces 2220–2690ms, Customize 2480–2790ms. Use these as design inputs, not hardcoded parallel schedules; source module owns resolved delays. Preserve current preferences and reduced-motion behavior, define scale and no-splash mapping explicitly. At large counts, shrink stagger rather than item duration below the minimum. Total timeout covers all owned effects; deadline fallback never replays startup later.

Proposed source extraction: `src/startup/{coordinator,boot-surface,readiness,effects,handoff}.js.part`, `src/algorithms/startup-timeline.mjs`. Extend build plan to generate the existing `startup-animation.uc.mjs` and a reproducible lab; do not register individual source fragments in Sine. Maintain exact public filenames/manifest identity. Implement in reviewed small commits, each with regression fixtures; release only actual runtime candidates with monotonically higher version and updatedAt.

Planning-only policy: no manifest bump for this audit. The existing preview CI currently requires an increment even on docs-only commits (MB-015); fix that separately without weakening runtime release checks. Do not describe a documentation commit as a new Sine package.

## Independent feature backlog — Quick Download Drag (planned)

Status: planned, not a runtime change. Keep the preview.6 diagnostic gate and confirmed regression fixes ahead of this feature; do not combine it with tab dragging, contour or animation refactors.

- Drag directly from the Downloads indicator to export the most recently **successfully completed** local download; a normal click must still open the existing Downloads Dock. No extra menu, second button or mandatory animation.
- Implement within the shared `downloads-indicator.uc.mjs` controller, using its existing public/private native download list and history. The existing `latest` variable represents notification/batch activity, not necessarily the newest successful completion. Track completion ordering independently (including history hydration; define deterministic fallback if completion time is unavailable).
- Use native Gecko file drag-and-drop on the trusted `dragstart` event: validate succeeded/not blocked and synchronously verify the local file exists, then populate `application/x-moz-file` with an nsIFile and `text/uri-list` with the local file URI, following Firefox DownloadsView's native drag contract. Prefer copy-only semantics for this shortcut so the original is not moved unintentionally. Never fetch file bytes, create a temporary file, or expose a private download in a normal window.
- Missing, deleted, incomplete, blocked or canceled files must not start a file drag. If the latest completed file has disappeared, cancel rather than silently export an older unrelated file. Preserve normal click and keyboard activation. Let native drag threshold distinguish click from drag; prevent conflicts with window movement, tab dragging and dock auto-open; clean up drag state on cancellation, dragend, disable, unload and host changes.
- Test horizontal/native sidebar hosts, left/right and Compact modes, privacy separation, multiple simultaneous downloads with out-of-order completion, restored history, missing files, Escape and repeated gestures. Verify actual external file drops in Windows Explorer and compatible web/app upload targets in real Zen; native OS drag feedback is sufficient initially. No polling, persistent drag overlay, or per-frame layout work.

Publish only with a dedicated tested runtime update after stabilization. Planning-only change: no manifest version or updatedAt bump.

## C. Separate the lifecycle

1. Introduce WindowContext/disposable ownership and explicit readiness while preserving existing script entry compatibility.
2. Wrap independent shared feature controllers in mount/dispose interfaces; do not force early startup features to wait for layout.
3. Extract Home and Hub from installTabStrip; split workspace-native operations and Free startup from horizontal UI. Keep current API/DOM IDs via bridge. Hub actions must remain native and safe.
4. Introduce layout host registry and move Downloads/Assembly/Disassembly/Workspace Transition/Bookmarks host queries behind it one by one. Keep single provider and no duplicate observer. Separate startup and workspace holds from orientation.
5. Convert TARGET snapshot/apply/restore into a process-aware layout ownership policy. Keep native Compact Mode user-owned; guard against conflicting windows.
6. Add horizontal adapter as the only initially selectable mode and verify output parity after every extraction. No vertical work merged while horizontal regressions remain.

## D. Vertical (0.4.0-preview candidate)

Prototype on feature/vertical-layout after shared core is stable. First mount native sidebar with no destructive changes; use native tabs, folders, pinned/Essentials, native DnD, commands, split and workspace behavior. Add Nocturne skin and actual shared slots, then expanded/mini and side Fade. Confirm left/right, compact/persistent, pinned rows, scrollbar, drag window and reduced motion. Design vertical geometry separately; do not rotate horizontal strip algorithms. Add manual mode selector only once native restoration and host readiness work. Start restart-required if global prefs and old controllers prevent safe hot switch. Live switch and adaptive profile/window policy are later gates.

## E. Sine identity, update and rollback

- Keep OnePlane UUID 8b2e214c-e1ba-4b81-9fbf-e08161bf2da4. Keep existing repository slug, homepage, branch and script entry names until Sine test proves a rename route. Display brand can be Nocturne without changing URLs.
- Preserve zen.oneplane.*, zen.refined.*, zen.home.shortcuts.v1 and workspace Free/Trash UUID preferences. Do not rename keys or clear prefs during import. Native session/workspace data untouched. Snapshot backups (original-layout, startup.previous-placeholders) are ownership records, not blindly copied.
- The old Refined UUID 9d788b55-d497-41da-8444-993c603e89e4 is independent. First supported migration: update/install Nocturne in a test profile with Refined disabled, restart, validate settings and single owners. Check old Refined unload restoration before new module re-applies owned prefs. Never silently disable/remove another installed mod or edit Sine mods.json.
- For existing users, prevent an accidental unsafe auto-update: before broad publication, document and test coexistence with legacy Refined, add conflict detection/feature ownership guard and safe fallback. Legacy CSS can still override even if script leases work; do not claim coexistence until both load/disable orders and restart are tested. If not safe, publish on a separately opt-in integration branch/channel and leave automatic preview intact. Provide explicit migration instruction to disable Refined before switching.
- Sine 2.3.3 fetches installed homepage, compares updatedAt strictly, downloads codeload archive; version alone is insufficient. Source: https://github.com/CosmoCreeper/Sine/blob/v2.3.3/src/core/manager.sys.mjs. Current release script checks exact homepage and archive bytes. Adapt checks to all runtime entries, exact CSS, preference union, stable ID, monotonically increasing version and timestamp. Verify Raw and codeload before announcing release.
- Rollback: retain pinned baseline and branch; do not force-reset published preview or lower updatedAt. Publish a new monotonic recovery release with known-good package or use explicitly tested reinstall path; re-enable old Refined only after unified mod is disabled/unloaded. Preserve user preferences and native data. Test rollback in separate profile.
- Repository rename to zen-nocturne and Refined archival deferred. Raw/codeload and installed Sine URL migration must pass before changing repo slug. Archive only after parity, coexistence/migration and rollback are validated; retain original repo history.

## F. Branch and release policy

- preview now carries the Nocturne developer preview (Package Fusion published at 0.3.0-preview.1); main untouched. Broad/stable promotion remains gated by native validation.
- integration/unified-core starts at pinned OnePlane preview.62. Planning docs do not bump runtime version.
- feature/vertical-layout starts from accepted common core.
- Release numbering proposed: 0.3.x unified core; 0.4.x vertical; 1.0.0 after stable validation. Exact preview numbers chosen on release, not in planning docs.
- No feature changes mixed with parity import. Native bugs fixed separately and merged into integration with recorded baseline change. Every phase has an exit gate; don't accumulate untested runtime changes.

Package Fusion imports all seven non-bookmark Refined scripts unchanged with tests and a provenance ledger. Horizontal source remains unchanged. Full native parity and lifecycle refactor remain pending. No repo rename or legacy archive now.


## 0.4.0 cross-feature stabilization

See the [0.4.0 architecture audit and pipeline](pipeline-0.4.0.md) for the active cross-feature risk register, ownership inventory, sequencing and exit gates. This is planning, not a runtime release; preserve existing MB/Library/Downloads and native validation contracts. Recheck current preview HEAD before implementation.
