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
