# Nocturne — current development roadmap

Baseline: 0.3.0-preview.35 (2026-11-17). This is the active product roadmap; historical decisions are retained in [the OnePlane 0.2 roadmap](history/oneplane-0.2-roadmap.md). Implementation is not equivalent to native acceptance.

## Status and priorities

| Stage | State | Next gate |
| --- | --- | --- |
| Package Fusion | Implemented in 0.3.x | Native migration/rollback, legacy conflict policy |
| Motion & UI Stabilization | In progress | Boot, Bunny, Fold, workspace changes, drag, narrow rows, real Zen performance |
| Library L0–L2 | L0/L1 implemented; L2 published in .35, CI red | Fix diagnostics version and Downloads lifecycle regressions, native Dock parity |
| Library L3–L7 | Planned | Shell, History/Closed, Downloads, Documents/Pictures, acceptance |
| Shared Core | Partial foundations; broader extraction planned | WindowContext/disposal, layout hosts, horizontal parity |
| Extension / Utility Dock | Planned | Native controls, narrow/portrait geometry, accessibility |
| Vertical Layout (0.4.x candidate) | Planned | Native sidebar adapter, left/right, compact/expanded, safe fallback |
| Stable release | Not reached | Native compatibility, migration/rollback, accessibility and performance |

## Immediate work

1. Restore a green candidate. Preview.35 has three failing tests (diagnostic version and two Downloads lifecycle tests). Diagnose rather than bypass them; keep the existing Sine identity and publish a new monotonic recovery version for runtime changes.
2. Verify L2 in real Zen: native subscription uniqueness, Dock progress/actions/drag, private list isolation, stale callbacks, disable/reload and removal. No Library command interception until the later gate.
3. Stabilize Nocturne Boot and coordinated motion with user traces: repeated cold launches, closing, workspace transitions, first icon readiness, reversible Bunny and Home/search handoff. Native window paint before Sine injection is outside the mod's control.
4. Continue Library L3 after L2 acceptance; coordinate focus, Escape and overlay ownership before native command interception.
5. Extract shared lifecycle/host contracts incrementally. Preserve horizontal behavior; defer vertical work until shared core and horizontal acceptance.

## Library sequence

- L0: RFC + pure transition reducer (implemented).
- L1: overlay coordinator and Home/Hub/Downloads ownership (implemented; live validation pending).
- L2: shared per-window Downloads service, lazy read-only History/Closed adapters (implemented in .35; CI/native gate pending).
- L3: responsive five-section shell, theme and motion, focus handling, explicit preview gate.
- L4: History and Recently Closed native actions; Ctrl+H only with safe fallback.
- L5: Downloads integration, native drag/clear parity; Ctrl+J only after validation.
- L6: downloaded Documents/Pictures, then explicitly opted-in local folders and safe previews.
- L7: native validation, accessibility, privacy, performance and rollback.

See [Library architecture](nocturne/library-architecture.md).

## Release pipeline

Develop on isolated branches from the current integration baseline. Run reproducible build, runtime syntax, regression and publication-contract checks on a candidate before merging to `preview`. Documentation-only changes may keep the manifest unchanged; packaged runtime changes require a strictly increasing version and Sine updatedAt. Keep ID, homepage, branch and existing preference keys stable. Verify Raw GitHub and codeload after publication. Do not mark a preview accepted until the required native checks pass.

`main` is public documentation; `preview` is the Sine distribution channel. `integration/unified-core` is the candidate baseline; keep it current without force-pushing. Historical branches are reference only. Repository rename and legacy archival remain gated by tested Sine migration.

[Migration](nocturne/migration.md) · [Validation](nocturne/validation.md) · [Known issues](known-issues.md) · [Changelog](../CHANGELOG.md)
