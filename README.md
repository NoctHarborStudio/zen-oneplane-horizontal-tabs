# Nocturne — by NoctHarborStudio

A unified UI modification for [Zen Browser](https://zen-browser.app/), combining OnePlane and Zen Refined. Nocturne is not a browser fork.

**Development preview: 0.3.0-preview.141** · Target: Zen 1.24.2b / Sine 2.3.3. Native verification of this combined package is pending.

## Features

- **OnePlane Horizontal:** adaptive centered tabs, integrated address bar, Compact Mode, Fluid/Bunny interactions, Unified Contour and Fade.
- **Home & Hub:** native workspace integration, Free/Trash, pinned shortcuts, projection and split/tab interactions.
- **Smart Search:** recent active tabs and native recommendations, with native tab selection.
- **Magnetic Bookmarks:** native bookmark magnification, liquid indicator and stable contour.
- **Downloads Dock:** permanent compact horizontal toolbar slot, native downloads, live progress, recent list, Library handoff (legacy full list fallback) and native Bunny drag of completed files and system file icons.
- **Page Progress:** compact native-position indicator: unfold, symmetric network progress, center collapse.
- **Nocturne Boot / Center Assembly:** lightweight branded startup while session, icons and geometry prepare; synchronized reveal, with a fail-open timeout and optional splash.
- **Center Disassembly / Workspace Transition:** existing coordinated animations.
- **Library (experimental):** centered five-section Library with native History, Recently Closed, All Downloads, Documents and Pictures, search, pagination, file actions, opt-in local folder scan and folder picker, shared Bunny drag, confirmed history actions and optional Ctrl+H/Ctrl+J. The native downloads view remains available for older Places records. See [Library RFC](docs/nocturne/library-architecture.md).
- Vertical layout is planned, not implemented in this release.

## Upgrade from OnePlane + Zen Refined

Keep OnePlane installed; disable the separate Zen Refined mod in Sine **before** updating. Restart Zen after disabling to release legacy controllers and preference ownership. Update OnePlane through Sine; the same entry becomes Nocturne. Restart and verify. Existing preference names and native data remain unchanged by the migration. Nocturne is the supported standalone package; the separate Zen Refined mod is not required and concurrent installation is unsupported. Users migrating from the old package must disable it and restart first. Preserve the old package only if needed for an explicitly tested rollback.

Install in a disposable profile first. Sine unpublished GitHub source:

```text
NoctHarborStudio/zen-oneplane-horizontal-tabs/tree/preview
```

Sine 2.3.3 requires permission for unofficial mod scripts. Only enable scripts you trust. If updating does not work, see [Sine diagnostics](docs/sine-updates.md).

## Development

Node 20+; no npm dependencies. Edit source fragments in src/ for the horizontal layout and combined CSS; imported runtime scripts are still independent entrypoints at the repository root. Run npm run build and npm run verify. The first unified package deliberately preserves existing implementations before refactoring the shared lifecycle.

- [Library architecture](docs/nocturne/library-architecture.md)
- [Nocturne architecture](docs/nocturne/architecture.md)
- [Migration pipeline](docs/nocturne/migration.md)
- [Known issues / Magnetic Bloom startup audit](docs/known-issues.md#nocturne--magnetic-bloom-startup-audit-2026-11-17)
- [Stabilization audit](docs/nocturne/audit.md)
- [Full preview.2 audit](docs/nocturne/full-audit-preview.2.md)
- [Validation gates](docs/nocturne/validation.md)
- [Import provenance](docs/nocturne/import-ledger.json)
- [Historical OnePlane README](docs/nocturne/oneplane-baseline-readme.md)
- [Refined documentation](docs/legacy-refined/README.md)

MIT ([LICENSE](LICENSE)); independent community project, not affiliated with Zen Browser.
