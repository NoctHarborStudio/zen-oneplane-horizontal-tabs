# Nocturne — Package Stabilization audit register

Audit baseline: Nocturne 0.3.0-preview.1 (0d575cf10a65653104db088fb45299526e6b6257).
Status: source-level stabilization in preview.2; Windows Zen validation remains required. Severity is an engineering prioritization, not a claim of observed user impact.

| ID | Priority | Finding | Status / exit gate |
| --- | --- | --- | --- |
| NC-001 | P1 | Downloads checks innerWidth >= 900 although horizontal layout now supports adaptive narrow windows; native fallback can be mounted in hidden toolbox. | Fixed in preview.2: matches actual horizontal ready-selector, tracks strip readiness and fullscreen/customization. Automated regression passes. Native narrow/portrait test pending. |
| NC-002 | P1 | Legacy Refined and Nocturne share global controller keys but independent Sine lifecycles. Old controllers and styles can compete. | Partially mitigated: read-only Sine installed-mod check logs a warning when old Refined is enabled. Not a runtime interlock; dual activation remains unsupported. Migration requires disabling/removing old Refined and restarting. Full safe coexistence/ownership guard or opt-in distribution remains a release gate. |
| NC-003 | P2 | Startup placeholder prefs are process-wide but each window previously restored the shared backup on unload. Reproduced with two windows. | Fixed in preview.2: live window leases, one observing owner, transfer to survivor, restore only on last explicit mod unload, preserve normal shutdown backup. Automated lifecycle regressions pass. Native multiwindow and Sine reload pending. |
| NC-004 | P2 | Home/Hub/Free lifecycle is coupled to installTabStrip and horizontal activation. | Open; Unified Core / Layout Abstraction milestone. Extract without changing native model or UI. |
| NC-005 | P2 | Combined CSS order may differ from legacy two-mod Sine cascade. Source parity does not prove computed style parity. | Open; compare actual Zen computed styles and rendering in disposable profile. No confirmed CSS regression. |
| NC-006 | P2 | Package published before native migration, rollback and coexistence gates passed. | Open; keep developer-preview designation, do not declare stable or archive Refined. Verify migration/rollback and Sine load/unload orders before broad promotion. |
| NC-007 | P3 | Independent observer/RAF/motion controllers; runtime memory/FPS unmeasured. | Open; profile first, then optimize measured duplicate work. No blanket scheduler rewrite. |

## Stabilization acceptance

- [x] Record all audit findings and priorities.
- [x] Implement NC-001 and NC-003 source fixes and regression fixtures.
- [x] Add NC-002 non-invasive diagnostic; keep legacy coexistence gate open.
- [ ] Verify actual Zen narrow/portrait downloads, both fullscreen transitions, Compact Mode and customization.
- [ ] Verify startup prefs in two windows, unload orders, normal shutdown, Sine update and restart.
- [ ] Confirm Home, Smart Search and bookmarks appearance remains unchanged after package merge; compare CSS with original dual-mod baseline.
- [ ] Validate legacy-disabled migration and rollback in a test profile. Do not enable legacy Refined alongside Nocturne in a daily-use profile.

## Implementation decisions

No layout, animation, preference IDs, Sine package ID, or session/workspace data changed in preview.2. The existing nine runtime entries remain. Import ledger describes the original import, not a permanent hash constraint for subsequent controller fixes. The legacy diagnostic uses Sine 2.3.3's read-only utils.getMods API; if unavailable, it silently skips diagnostics. It cannot prevent CSS conflicts or old code running after a new controller, and must not be presented as coexistence support. Shared Startup ownership uses the native browser-window enumerator rather than a persistent process registry; later Unified Core can generalize the lease.

## Full audit expansion — 0.3.0-preview.2

See [full-audit-preview.2.md](full-audit-preview.2.md) for detailed source references, execution graph, comparison and reproduction evidence. Developer reports the package works in Zen with inherited jitter and missing real Downloads UI placement. NC-001/003 source fixes remain; runtime details not exhaustively validated.

| ID | Priority | Finding | Status |
| --- | --- | --- | --- |
| NC-008 | P1 | Downloads host absent; fallback hides at idle | Implemented in preview.3; permanent compact horizontal host; actual Zen visual validation pending |
| NC-009 | P1 | Concurrent native workspace switches after visual supersession | Fixed in preview.3 for explicit Home/Hub transition calls; gate survives replacement, fixtures pass; native Zen validation pending |
| NC-010 | P1 | Stale Downloads async rejection tears down new instance | Fixed in preview.3; generation-guarded callbacks/catch and late view cleanup; fixtures pass |
| NC-011 | P1 | Smart Search partial mount leaves provider | Fixed in preview.3; transactional rollback and retained diagnostics; fixture passes |
| NC-012 | P1 | Layout cleanup exception blocks restoration | Fixed in preview.3; best-effort teardown and independent native restoration; fixture passes |
| NC-013 | P2 | Two Fade owners, differing overflow-row base | Confirmed source; visual impact needs trace |
| NC-014 | P2 | Repeated geometry and Home/search handoff work | Profile required |
| NC-015 | P2 | Uncoordinated motion property ownership | Source risk; profile and interaction tests |
| NC-016 | P1 | Workspace unload executes delayed native switch | Fixed in preview.3; pending commands cancelled on dispose, already-started operations settle; fixtures pass |
| NC-017 | P2 | Global layout prefs/Free startup transaction | Source risk; process coordinator |
| NC-018 | P2 | Partial Hub/drag operations on native failure | Source risk; fault tests |
| NC-019 | P2 | Home/Hub lifecycle, focus and drag regions | Architecture debt |
| NC-020 | P3 | Candidate CI, exact package tests and bookmark ownership lock | Pipeline debt |
| NC-021 | P2 | Downloads host needs hold/anchor/overflow contract | Initial host/hold/anchor implemented in preview.3; real narrow/customization/focus verification and full lower dock pending |
| NC-022 | P3 | Page Progress root-fixed placement and missing dedicated tests | Design/test gap |

No claim that every source risk manifests in actual Zen. Prioritize confirmed failures, then measured visual improvements; do not skip to Vertical before these gates.

## Stabilization A implementation — preview.3

Five reproduced failure paths are fixed and covered by regression fixtures. Downloads has a stable 30px slot near Hub, separate Compact hold and anchored overlay; speed is available in tooltip and details. The full lower-left Utility/Extension Dock remains a separate UI milestone. No change to native workspace/session data or animation timings. Native Zen validation remains required; no claim that all jitter is fixed.

## User smoke test of preview.3 / preview.4 follow-up

User reports the permanent Downloads button, idle/active access, progress, panel hold/release, narrow layout, search and window drag work. Workspace selection and tabs remain functional, but chrome/page flicker and Escape motion remain visibly unstable. Screenshots show the empty Downloads text is brighter during reveal than at rest. NC-008/021 initial host accepted; full Utility Dock remains planned. NC-023 (P2): confirmed CSS opacity mismatch (animation ends at 1 vs resting .65/.8); fixed in preview.4. NC-024 (P2): workspace motion jitter and premature visual abort; preview.4 replaces per-item transforms with short surface fades and bounded swap gate, coordinates hover/bookmarks and preserves native command serialization. Native page/background remains untouched; any remaining page flash needs a separate Gecko trace. NC-013/014/015 and general performance profiling remain open; this release does not claim to eliminate all animation jitter. Nocturne-specific bookmark override is pinned in shared-bookmarks.lock.json while retaining upstream import provenance.

## Preview.4 acceptance and preview.5 follow-up

User confirms NC-023 Downloads text color fixed, NC-024 tab and page flicker gone and Escape safe. Remaining: NC-025 intermittent cold startup assembly (late startup gate, readiness mismatch, duplicate resize interruption are source causes; actual frequency unmeasured); NC-026 abrupt dock height during workspace row changes; NC-027 request for richer workspace and page motion. Preview.5 adds recent initial-layout handshake, bounded readiness, stable height through swap and one-shot final geometry/contour handoff, coordinated whole-row translation/scale and opaque incoming page deck motion. No per-tab travel, page capture or native workspace change. Full runtime validation remains open; do not close NC-013/014/015 broadly based on these fixes. Downloads appearance and controls unchanged.

Preview.5 also fades the independent solid nav-bar backing in two-row mode with the workspace surfaces. This avoids exposing a new solid shelf before the height interpolation. No change to ordinary non-workspace toolbar CSS.

## Preview.5 regression report — diagnostic gate

User confirms intermittent startup animation (launch message actually appears), closing controls reappear before window closes, abrupt/absent tab/workspace motion and shelf height, flickering toolbar backing on collapse, delayed pull and premature reentry, occasional duplicate ghost. NC-025/026/027 remain OPEN. NC-028 closing restoration before native close (confirmed code ordering, native visual timing requires trace); NC-029 drag pull/return/ghost duplication (user screenshot, source threshold/visibility suspected); NC-030 compact backing blink (user report). Do not assume native extension/settings warnings cause these. Preview.6 adds diagnostic instrumentation only. Record first start, normal TabSelect and explicit workspace switch separately, open/close toolbar, drag out/in, and close. Fix based on trace, preserve native cancellation and data. Diagnostic sampling may affect frame timings; compare with recorder disabled before claiming performance improvement.

## Preview.18 drag trace / Preview.19 source fix

NC-029: the retained third session contains nine inline/content cycles; 50 of 53 sampled pull paints were zero. Source reentry suppressed further pulls until the pointer reached the toolbar, while an earlier return-cancellation branch bypassed visual state updates. The original return also clamped displacement to 34px. Preview.19 rearms on outward reversal and uses measured painted-rectangle handoffs through the single isolated Bunny ghost. Native cancellation and external window behavior are unchanged. Source fixtures cover continuity and rearm; actual Zen validation (single/group, repeated reversal, scrollable lanes, cross-window, Escape and drop) remains required.
