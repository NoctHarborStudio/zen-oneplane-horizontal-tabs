# OnePlane — Horizontal Tab Bar for Zen Browser

Adaptive horizontal top tabs for [Zen Browser](https://zen-browser.app/), with hover-expandable tabs, a dynamic address bar, and an auto-hide single-row toolbar.

OnePlane is designed to keep browser controls on a single horizontal plane at the top of the window, without permanently sacrificing screen space.

> **Early development.** No stable release yet. The CSS prototype is based on Zen 1.24.2b source and has not been tested in a running browser.

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

The installation contains CSS and preference metadata only. OnePlane's own layout switch is off by default; enable **Enable OnePlane (experimental)** in the mod's settings only after configuring the native layout:

- Multiple Toolbars, expanded left sidebar.
- Compact Mode → Hide toolbar (not Hide both).
- Window width at least 900 CSS pixels.

Disable the mod in Sine or set `zen.oneplane.enabled` to false to restore the native UI.

See the [Sine and manual installation guide](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/blob/preview/docs/installation.md) and [design and validation plan](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/blob/preview/docs/design.md). All preview code is on the [preview branch](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/tree/preview).

Horizontal scrolling, drag and drop, pinned tabs, folders, workspaces, extension controls and compatibility with other themes are not yet validated. Sine packaging was checked against its v2.3.3 source; installation has not been tested in a running browser.

## Scope

This project is exclusively about horizontal tabs and the integrated top toolbar. It does not change page backgrounds, loading animations, content spacing or unrelated browser styling.

## License

[MIT](LICENSE). Independent community project; not affiliated with Zen Browser.
