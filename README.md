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

The horizontal strip mirrors native tabs and uses their selection and close APIs. Drag and drop, folder presentation, native tab context menus, workspace controls, and compatibility with other themes are unfinished. Sine installation, automatic configuration and the horizontal strip were observed in the developer's browser through preview.3. Preview.4's horizontal panel and tab styling were observed in the developer's browser. Preview.5 centers the controls and addresses toolbar hover stability; runtime validation is pending.

## Scope

This project is exclusively about horizontal tabs and the integrated top toolbar. It does not change page backgrounds, loading animations, content spacing or unrelated browser styling.

## License

[MIT](LICENSE). Independent community project; not affiliated with Zen Browser.
