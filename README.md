# Nocturne — by NoctHarborStudio

A unified UI modification for [Zen Browser](https://zen-browser.app/), combining OnePlane and Zen Refined. Nocturne is not a browser fork.

**Development preview: 0.3.0-preview.24** · Target: Zen 1.24.2b / Sine 2.3.3. Native verification of this combined package is pending.

## Features

- **OnePlane Horizontal:** adaptive centered tabs, integrated address bar, Compact Mode, Fluid/Bunny interactions, Unified Contour and Fade.
- **Home & Hub:** native workspace integration, Free/Trash, pinned shortcuts, projection and split/tab interactions.
- **Smart Search:** recent active tabs and native recommendations, with native tab selection.
- **Magnetic Bookmarks:** native bookmark magnification, liquid indicator and stable contour.
- **Downloads Dock:** permanent compact horizontal toolbar slot, native downloads, live progress and recent/full list.
- **Page Progress:** compact native-position indicator: unfold, symmetric network progress, center collapse.
- **Center Assembly / Disassembly / Workspace Transition:** existing coordinated animations.
- Vertical layout is planned, not implemented in this release.

## Upgrade from OnePlane + Zen Refined

Keep OnePlane installed; disable the separate Zen Refined mod in Sine **before** updating. Restart Zen after disabling to release legacy controllers and preference ownership. Update OnePlane through Sine; the same entry becomes Nocturne. Restart and verify. Existing preference names and native data remain unchanged by the migration. Do not run legacy Refined alongside Nocturne: coexistence is not validated. Prefer disable rather than delete until rollback has been tested.

Install in a disposable profile first. Sine unpublished GitHub source:

```text
NoctHarborStudio/zen-oneplane-horizontal-tabs/tree/preview
```

Sine 2.3.3 requires permission for unofficial mod scripts. Only enable scripts you trust. If updating does not work, see [Sine diagnostics](docs/sine-updates.md).

## Development

Node 20+; no npm dependencies. Edit source fragments in src/ for the horizontal layout and combined CSS; imported runtime scripts are still independent entrypoints at the repository root. Run npm run build and npm run verify. The first unified package deliberately preserves existing implementations before refactoring the shared lifecycle.

- [Nocturne architecture](docs/nocturne/architecture.md)
- [Migration pipeline](docs/nocturne/migration.md)
- [Stabilization audit](docs/nocturne/audit.md)
- [Full preview.2 audit](docs/nocturne/full-audit-preview.2.md)
- [Validation gates](docs/nocturne/validation.md)
- [Import provenance](docs/nocturne/import-ledger.json)
- [Historical OnePlane README](docs/nocturne/oneplane-baseline-readme.md)
- [Refined documentation](docs/legacy-refined/README.md)

MIT ([LICENSE](LICENSE)); independent community project, not affiliated with Zen Browser.
