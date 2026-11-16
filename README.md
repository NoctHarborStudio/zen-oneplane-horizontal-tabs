# OnePlane — Horizontal Tab Bar for Zen Browser

Adaptive horizontal top tabs for [Zen Browser](https://zen-browser.app/), with hover-expandable tabs, a dynamic address bar, and an auto-hide single-row toolbar.

OnePlane is designed to keep browser controls on a single horizontal plane at the top of the window, without permanently sacrificing screen space.

> **Early development.** No stable release yet. The toolbar prototype is based on Zen 1.24.2b source and has not been tested in a running browser.

## Design goals

- Horizontal tab bar at the top of the window.
- Icon-only tabs by default; hovering reveals the title and close control.
- Compact address bar that expands when clicked or focused.
- Tabs and address bar on the same row.
- Native Compact Mode integration for top-edge reveal and automatic hiding.
- Preserve native navigation, window controls, keyboard shortcuts and theme colors wherever possible.

## Install the development preview with Sine

**Use a disposable Zen profile.** Install Sine in that profile using its official instructions, then open Sine Mods in Zen Settings.

Paste this GitHub source into Sine's unpublished/local mod installation field:

```text
NoctHarborStudio/zen-oneplane-horizontal-tabs/tree/preview
```

OnePlane now automatically configures the necessary native layout preferences when enabled in Sine. No manual changes to Zen's toolbar layout are required.

**Script permission:** Sine 2.3.3 does not run JavaScript from unpublished GitHub mods unless the user explicitly allows unofficial mod scripts. OnePlane includes a small, auditable local browser-chrome script ([layout.uc.mjs](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/blob/preview/layout.uc.mjs)); it changes only Zen layout preferences and uses the native Compact Mode API. It makes no network requests. Do not enable unofficial scripts unless you trust the mods installed in that profile.

Restart the test browser after updating from preview.1 if the script is not loaded immediately. Disable OnePlane in Sine to remove its layout and restore the original preferences on a best-effort basis. A narrow window or unsupported native layout falls back to Zen's own CSS.

See the [installation guide](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/blob/preview/docs/installation.md) and [design and validation plan](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/blob/preview/docs/design.md).

The horizontal strip mirrors native tabs and uses their selection and close APIs. Drag and drop, folder presentation, native tab context menus, workspace controls, and compatibility with other themes are unfinished. Sine installation, automatic configuration and the horizontal strip were observed in the developer's browser through preview.3. Preview.4's horizontal panel and tab styling were observed in the developer's browser. Preview.6 separates navigation from centered tabs and uses an overlay reveal. Runtime validation is pending.

## Scope

This project is exclusively about horizontal tabs and the integrated top toolbar. It does not change page backgrounds, loading animations, content spacing or unrelated browser styling.

## License

[MIT](LICENSE). Independent community project; not affiliated with Zen Browser.


## Development (0.2 source migration)

Edit the source sections in `src/`, not the generated root script and stylesheet. Run `npm run build` and `npm run verify` with Node 20+. No npm dependencies are required. See [architecture and migration plan](docs/architecture.md) and [source layout](src/README.md). Preview 0.2.0-preview.1 preserves the exact runtime of 0.1.0-preview.32; persistent mode and Hub are not yet implemented.


Preview 0.2.0-preview.2 keeps OnePlane active in both Compact Mode states. Toggle Compact Mode to switch between auto-hide overlay and persistent horizontal toolbar. See [known issues](docs/known-issues.md).


Preview 0.2.0-preview.4 prioritizes address animation, startup centering and the persistent Compact Mode command before Hub. See [roadmap](docs/roadmap.md) and [known issues](docs/known-issues.md).

## Optional Zen Refined startup integration

OnePlane exposes `data-op-startup-ready` (`pending` → `true`) and observes the optional `oneplane-startup-hold` wrapper flag. Zen Refined owns the startup animation and releases the flag on completion/cancel. OnePlane never requires Zen Refined; normal startup, Compact Mode and persistent mode work independently. The hold does not change browser preferences.


## Shared Magnetic Bookmarks and Wave Fade (preview.10)

OnePlane includes the same Magnetic Bookmarks controller and CSS as [Zen Refined 0.6.0-preview.3](https://github.com/NoctHarborStudio/zen-refined-ui-improvements/tree/c36668d9819a345ca24473cb399d01dfe89d7119). It works without Refined. When both updated mods are installed, independent leases share a single controller per window; settings remain under `zen.refined.bookmarks.*` and may appear in both Sine settings panels. OnePlane alone owns address-wave timing. The canonical copies are pinned in `scripts/shared-bookmarks.lock.json` and verified by the existing CI. No external runtime fetch. Update both mods for mixed-use compatibility; old legacy versions may require restart after the last shared copy is removed.

## Hub Foundation (preview.11)

The left Hub opens a native popup with real Zen workspaces, active state, named creation and Compact Mode. Right-click a mirrored tab to open its native menu. Free designation, timed discard, Library and Extension Dock are separate stages. See [Hub validation](docs/hub.md).

Preview.12 aligns the Hub with the navigation/address row, keeps it open during Compact Mode changes and adds right-click workspace deletion. See [Hub notes](docs/hub.md) for data preservation and validation.

Preview.13 changes Hub to an in-document panel and scopes native existing-tab reuse to the active workspace. Multi-monitor projection is not yet implemented.
