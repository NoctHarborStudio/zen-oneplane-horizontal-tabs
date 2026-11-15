# Installation — development preview

Use a disposable profile, not your daily browser.

1. Install Sine using its [official instructions](https://github.com/CosmoCreeper/Sine).
2. In Sine Mods, install `NoctHarborStudio/zen-oneplane-horizontal-tabs/tree/preview`.
3. OnePlane uses a local browser-chrome script to prepare the layout automatically. Sine 2.3.3 requires the user to explicitly permit scripts from unofficial mods for this feature. Review [layout.uc.mjs](../layout.uc.mjs) first. The Sine setting applies to other unpublished mods too; it is not changed by OnePlane.
4. Enable OnePlane in Sine. Restart Zen after updating if the new script is not loaded immediately.

No manual sidebar position, toolbar mode or Compact Mode setup is intended. The script records the original native values, configures Multiple Toolbars, the expanded left sidebar and Hide Toolbar, and requests native Compact Mode. The CSS is gated by the script's per-window active marker.

## Rollback

Disable OnePlane in Sine. The script attempts to restore original layout preferences, preserving values changed by the user where possible. Restore behavior across multiple windows, script reload and startup is not yet runtime validated.

If the interface is unusable, use the test profile rather than your primary profile. Remove the mod or disable it in Sine. The saved values are available in `zen.oneplane.original-layout` if automatic restoration fails. Do not delete that backup before recording its contents. If required, restore the original native preferences manually.

## Limitations

The current preview is not a stable release. Sine packaging and Zen API references have been inspected, but browser execution has not been tested. The new horizontal view mirrors the current workspace's visible native tabs. Drag and drop, folders, native tab menus and workspace controls are not implemented yet; scrolling and window control placement require testing. Official Zen Mods packaging is not provided.

## Layout backup and script permission

The `zen.oneplane.original-layout` preference is an internal backup, created automatically. It is not a switch and should not be removed while the mod is active. No manual layout preparation or Nebula edits are required. Sine's global permission for unpublished JavaScript mods remains an explicit user choice; the mod does not modify it. A future marketplace submission may allow Sine to treat OnePlane as a store-origin script instead.
