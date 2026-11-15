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

## Development preview

The [development branch](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/tree/dev/initial-prototype) contains the experimental CSS, [manual installation and rollback guide](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/blob/dev/initial-prototype/docs/installation.md), and [design and validation plan](https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/blob/dev/initial-prototype/docs/design.md).

Use a disposable profile for testing. Horizontal scrolling, drag and drop, pinned tabs, folders, workspaces, extension controls and compatibility with other themes are not yet validated.

## Scope

This project is exclusively about horizontal tabs and the integrated top toolbar. It does not change page backgrounds, loading animations, content spacing or unrelated browser styling.

## License

[MIT](LICENSE). Independent community project; not affiliated with Zen Browser.
