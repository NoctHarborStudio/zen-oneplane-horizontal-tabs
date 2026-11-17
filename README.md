# Nocturne — by NoctHarborStudio

**A unified, modular UI overhaul for [Zen Browser](https://zen-browser.app/).**

Nocturne combines OnePlane and Zen Refined in one browser-chrome mod. Native Zen remains the owner of tabs, sessions, workspaces and browser commands. Nocturne is not a browser fork.

**Development preview: 0.3.0-preview.36** · Target: Zen 1.24.2b / Sine 2.3.3.

> Experimental software. Preview.36 contains Library L2 and has two outstanding Downloads lifecycle test failures; preview.34 passed all 265 automated tests. See [Actions](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions) and [validation](docs/nocturne/validation.md). Neither result establishes full native-browser compatibility. Use a disposable profile.

## Features

| Feature | What it does |
| --- | --- |
| OnePlane Horizontal | Adaptive centered tab lanes, overflow row, integrated address bar, Compact Mode, Unified Contour and Fade. |
| Home & Hub | Native workspace integration, Free/Trash, pinned shortcuts, Home search, projection and split/tab interactions. |
| Magnetic motion | Pointer-driven reversible Bunny extraction/insertion, Magnetic Fold, native bookmark magnification and liquid indicators. |
| Smart Search | Recent active tabs and native recommendations, exact native tab selection. |
| Downloads Dock | Compact toolbar slot, live transfer progress, recent/full views and native drag of completed files. |
| Page Progress | Symmetric network progress below the horizontal dock. |
| Nocturne Boot | Optional brand splash while session, icons and geometry prepare; synchronized reveal and fail-open deadline. |
| Coordinated motion | Center Assembly/Disassembly and workspace transitions. |

## In development

**Nocturne Library:** L0 state machine, L1 overlay coordinator and L2 shared Downloads/Places/SessionStore data foundation are implemented; L2 is not yet validated. No Library UI or Ctrl+H/Ctrl+J interception. Next: L3 shell after the L2 gate passes.

Shared lifecycle and layout hosts, Extension/Utility Dock and vertical layout remain planned. See the [current roadmap](docs/roadmap.md).

## Install / upgrade

Use a disposable Zen profile. Install [Sine](https://github.com/CosmoCreeper/Sine), open Zen Settings → Sine Mods and use the unpublished GitHub source:

```text
NoctHarborStudio/zen-oneplane-horizontal-tabs/tree/preview
```

Sine 2.3.3 requires explicit permission for unofficial mod scripts; review the source before granting it. Restart if scripts have not loaded.

**Existing OnePlane + Zen Refined users:** disable the separate Zen Refined mod, restart Zen, update OnePlane through Sine, then restart and verify. The existing OnePlane entry becomes Nocturne. Its ID, URL and existing preference namespaces are preserved. Do not run legacy Refined alongside Nocturne; retain it disabled until rollback is tested.

The repository slug is intentionally unchanged. The main branch is documentation only. See [Sine diagnostics](docs/sine-updates.md) for update issues and [migration](docs/nocturne/migration.md) for recovery policy.

## Development

Node.js 20+ (CI uses Node 22); no npm dependencies. Edit source fragments in `src/` and independent runtime entrypoints as appropriate. Generated layout/CSS/overlay outputs must match their sources.

```sh
npm run build
npm run verify
```

- [Roadmap](docs/roadmap.md) · [Architecture](docs/nocturne/architecture.md) · [Library RFC](docs/nocturne/library-architecture.md)
- [Migration pipeline](docs/nocturne/migration.md) · [Validation gates](docs/nocturne/validation.md) · [Known issues](docs/known-issues.md)
- [Diagnostics](docs/nocturne/diagnostics.md) · [Changelog](CHANGELOG.md) · [Import provenance](docs/nocturne/import-ledger.json)
- [Historical OnePlane roadmap](docs/history/oneplane-0.2-roadmap.md) · [Historical Refined documentation](docs/legacy-refined/README.md)

MIT ([LICENSE](LICENSE)); independent community project, not affiliated with Zen Browser.
