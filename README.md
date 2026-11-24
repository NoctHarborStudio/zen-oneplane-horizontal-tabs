# Nocturne — by NoctHarborStudio

**A unified, modular UI overhaul for [Zen Browser](https://zen-browser.app/).**

Nocturne brings OnePlane and Zen Refined together into a single browser-chrome mod: adaptive horizontal tabs, native workspaces, Home, Hub, magnetic interactions, search, downloads and coordinated motion. It is not a browser fork or a replacement for Zen's native data model.

> **Development preview — not a stable release.** Target: Zen 1.24.2b / Sine 2.3.3. Features are implemented at different levels of native-browser validation. Use a disposable profile. See the [live preview README](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/blob/preview/README.md), [changelog](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/blob/preview/CHANGELOG.md) and [Actions](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/actions) for the current package and verification status.

> **JavaScript required:** In Zen Settings → Sine Settings, explicitly enable JavaScript for unofficial mods, then restart Zen. Nocturne requires these scripts to work correctly; enabling the CSS alone is not sufficient. Only allow scripts you trust.
>
> **Uninstall warning:** Basic manual testing indicates that Zen generally works after disabling or removing Nocturne, but complete restoration of the pre-installation browser state is not yet guaranteed. Some native browser UI elements, features or settings may not return to their original behavior after removal. Back up your profile or use a disposable profile before installing.

## Features

| Feature | Description |
| --- | --- |
| OnePlane Horizontal | Centered adaptive tab lanes, overflow rows, integrated address bar, Compact Mode, contour and fade. |
| Home & Hub | Native workspaces, Free/Trash, pinned shortcuts, Home search and workspace/display interactions. |
| Magnetic motion | Reversible Bunny tab drag, Magnetic Fold, native bookmark magnification and liquid indicators. |
| Smart Search | Recent active tabs and native recommendations with exact tab selection. |
| Downloads Dock | Native downloads, recent/full views, live progress and native drag of completed files. |
| Page Progress | Symmetric page-load progress below the horizontal dock. |
| Nocturne Boot & motion | Optional branded startup, Center Assembly/Disassembly and coordinated workspace transitions. |

Native tab/session data, folders, split views and workspace identities remain owned by Zen. Nocturne integrates with native commands rather than replacing the browser engine.

## In development

- **Nocturne Library:** overlay coordination and native data services are implemented in the development branch; the Library shell, History/Recently Closed UI, full Downloads integration and Documents/Pictures remain planned. Native shortcut interception is not enabled.
- **Shared Core:** lifecycle ownership, layout hosts and native fallback.
- **Extension / Utility Dock:** planned.
- **Vertical Layout:** planned for the 0.4 development cycle, after horizontal stabilization.

## Install with Sine

1. Install [Sine](https://github.com/CosmoCreeper/Sine) in a disposable Zen profile.
2. In Zen Settings → Sine Mods, install this unpublished GitHub source:

   ```text
   NoctHarborStudio/zen-oneplane-horizontal-tabs/tree/preview
   ```

3. Review the [source](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/tree/preview), enable JavaScript for unofficial mods in Sine Settings, and restart Zen. This is required for Nocturne to work.

**Migrating from OnePlane + Zen Refined:** disable the separate Zen Refined mod and restart before updating OnePlane. The existing OnePlane entry becomes Nocturne; its ID, installation URL and existing preference namespaces are retained. Do not run legacy Refined alongside Nocturne. Keep it disabled rather than deleting it until rollback has been tested.

The repository retains its historical slug to preserve Sine updates. The `main` branch is documentation only; install from `preview`, not `main`.

## Development

Node.js 20+ (CI uses Node 22); no npm dependencies. Use the [development source](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/tree/preview).

```sh
npm run build
npm run verify
```

- [Current roadmap](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/blob/preview/docs/roadmap.md) · [Architecture](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/blob/preview/docs/nocturne/architecture.md) · [Library RFC](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/blob/preview/docs/nocturne/library-architecture.md)
- [Migration pipeline](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/blob/preview/docs/nocturne/migration.md) · [Validation gates](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/blob/preview/docs/nocturne/validation.md) · [Known issues](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/blob/preview/docs/known-issues.md)
- [Diagnostics](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/blob/preview/docs/nocturne/diagnostics.md) · [Sine updates](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/blob/preview/docs/sine-updates.md) · [Changelog](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/blob/preview/CHANGELOG.md)

Automated tests do not replace live Zen testing. Native compatibility, startup paint before Sine injection, drag behavior, accessibility, mixed DPI, reload and rollback remain validation gates.

## License

[MIT](LICENSE). Independent community project; not affiliated with Zen Browser.
