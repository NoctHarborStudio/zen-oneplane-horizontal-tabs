# Nocturne — by NoctHarborStudio

A unified UI modification for [Zen Browser](https://zen-browser.app/), combining OnePlane and Zen Refined. Nocturne is not a browser fork.

**Development preview: 0.3.0-preview.217** · Target: Zen 1.24.2b / Sine 2.3.3. Native verification of this combined package is pending.

> **JavaScript required:** In Zen Settings → Sine Settings, explicitly enable JavaScript for unofficial mods, then restart Zen. Nocturne requires these scripts to work correctly; enabling the CSS alone is not sufficient. Only allow scripts you trust.
>
> **Uninstall warning:** Basic manual testing indicates that Zen generally works after disabling or removing Nocturne, but complete restoration of the pre-installation browser state is not yet guaranteed. Some native browser UI elements, features or settings may not return to their original behavior after removal. Back up your profile or use a disposable profile before installing.

## Features

- **OnePlane Horizontal:** adaptive centered tabs, integrated address bar, Compact Mode, Fluid/Bunny interactions, Unified Contour and Fade.
- **Home & Hub:** native workspace integration, Free/Trash, pinned shortcuts, projection and split/tab interactions.
- **Smart Search:** recent active tabs and native recommendations, with native tab selection.
- **Magnetic Bookmarks:** native bookmark magnification, liquid indicator and stable contour.
- **Downloads Dock:** permanent compact horizontal toolbar slot, native downloads, live progress, recent list, Library handoff (legacy full list fallback) and native Bunny drag of completed files and system file icons.
- **Page Progress:** compact native-position indicator: unfold, symmetric network progress, center collapse.
- **Nocturne Boot / Center Assembly:** lightweight branded startup while session, icons and geometry prepare; synchronized reveal, with a fail-open timeout and optional splash.
- **Center Disassembly / Workspace Transition:** existing coordinated animations.
- **Library (experimental):** centered five-section Library with native History, Recently Closed, All Downloads, Documents and Pictures, search, pagination, file actions, temporarily paused local folder scanning (saved folder preferences retained), shared Bunny drag, confirmed history actions and optional Ctrl+H/Ctrl+J. The native downloads view remains available for older Places records. See [Library RFC](docs/nocturne/library-architecture.md).
- Vertical layout is planned, not implemented in this release.

## Upgrade from OnePlane + Zen Refined

Keep OnePlane installed; disable the separate Zen Refined mod in Sine **before** updating. Restart Zen after disabling to release legacy controllers and preference ownership. Update OnePlane through Sine; the same entry becomes Nocturne. Restart and verify. Existing preference names and native data remain unchanged by the migration. Nocturne is the supported standalone package; the separate Zen Refined mod is not required and concurrent installation is unsupported. Users migrating from the old package must disable it and restart first. Preserve the old package only if needed for an explicitly tested rollback.

Install in a disposable profile first. Sine unpublished GitHub source:

```text
NoctHarborStudio/zen-oneplane-horizontal-tabs/tree/preview
```

On a **fresh install**, Sine 2.3.3 does not immediately write all preference defaults. Nocturne uses runtime fallbacks: regular features, experimental Library, and Ctrl+H/Ctrl+J Library shortcuts are **on** by default, while explicit user opt-outs remain authoritative. The experimental local-media preference defaults on, but native local folder scanning remains **suspended** until its safety gates pass. Free/Trash role IDs from older profiles are not prerequisites. The native bookmarks toolbar is set to Always Show by default; turn off the Nocturne Always show bookmarks toolbar option to restore its prior native visibility preference. Existing panel animations and visibility rules remain unchanged. Nocturne automatically sets Zen's native content-element separation to zero (no content frame) through the reversible Layout preference lease. Existing user values are preserved for restoration. See [installation and clean-profile diagnostics](docs/installation.md).

In Sine Settings, enable JavaScript for unofficial mods (required). Only enable scripts you trust; then restart Zen for a cold startup intro. The intro deliberately does not replay on Sine hot reload. Home uses a transparent CSS surface. The Nocturne settings now expose Home transparency, native window transparency and platform-specific backdrop options. Native settings remain user-controlled. Nocturne's motion policy is enabled by default and controlled by its own Nocturne animations setting (restart Zen after changing it), independently of the OS reduced-motion preference. The independent Disable fullscreen video animation option defaults on and removes the native DOM fullscreen fade in both directions; fullscreen security notices remain unchanged. Existing individual feature opt-outs are preserved; the former startup-only override is superseded without writing its stored value. System compositor support and the native workspace theme opacity still determine the actual desktop translucency. On Windows an optional Home-only direct-alpha experiment controls the existing Zen tint opacity without Mica/Acrylic. Enable native window transparency, disable Mica and restart before testing. Actual alpha with Windows Transparency effects disabled is not verified; no desktop blur is promised. If updating does not work, see [Sine diagnostics](docs/sine-updates.md).

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
