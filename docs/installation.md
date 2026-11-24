# Installation — development preview

Use a disposable profile, not your daily browser.

1. Install Sine using its [official instructions](https://github.com/CosmoCreeper/Sine).
2. In Sine Mods, install `NoctHarborStudio/zen-oneplane-horizontal-tabs/tree/preview`.
3. Nocturne uses a local browser-chrome script to prepare the layout automatically. Sine 2.3.3 requires the user to explicitly permit scripts from unofficial mods for this feature. Review [layout.uc.mjs](../layout.uc.mjs) first. The Sine setting applies to other unpublished mods too; it is not changed by Nocturne.
4. Enable Nocturne in Sine. Restart Zen after updating if the new script is not loaded immediately.

No manual sidebar position, toolbar mode or Compact Mode setup is intended. The script records the original native values, configures Multiple Toolbars, the expanded left sidebar and Hide Toolbar, and requests native Compact Mode. The CSS is gated by the script's per-window active marker.

## Fresh installation versus an upgraded profile

Sine 2.3.3 does **not** apply all `preferences.json` `defaultValue` entries on installation (its installer has a pending default-preferences TODO). Nocturne's JavaScript uses explicit runtime fallbacks for enabled features; opening the Sine preferences panel may materialize settings that were previously absent. Do not copy an older user's about:config values into a fresh profile and do not clear Nocturne's preference backups.

- **Unofficial scripts:** In Sine Settings, explicitly allow JavaScript from unofficial mods. This is a global trust choice, not a permission Nocturne can silently enable. After permitting, restart Zen and verify that the horizontal toolbar mounts.
- **Experimental Library:** `zen.nocturne.library.preview`, `zen.nocturne.library.history-shortcut` and `zen.nocturne.library.downloads-shortcut` are **on** by default, including when Sine has not yet written any of those prefs. Library replaces the native Library while Layout has a reversible lease; Ctrl+H/Ctrl+J route to Library. Explicit previously saved `false` values remain effective. `zen.nocturne.library.local-media` also defaults on as an experimental option, but the actual native folder scanner is still suspended and never starts on this build (NC4-022/082/083).
- **Native workspace roles:** An upgraded profile may already have Free/Trash role IDs. A fresh profile does not; Free startup attempts a guarded native designation once workspace services are ready. Trash is designated through the Hub operation, not by copying old identifiers. Native Zen workspace data remains authoritative.
- **Intro and Home transparency:** Startup animation and Boot are already enabled by default; they run on eligible cold launches only, never an in-place Sine update. Fully restart Zen after granting script permission. In Nocturne preferences, enable both **Startup intro** options and **Home — transparent surface**. If the system requests reduced motion, an optional startup-only override (off by default) permits the intro while preserving reduced-motion behavior for normal interactions. Enable native window transparency and the relevant platform option (Windows Mica/Acrylic backdrop, macOS vibrancy or Linux transparency) if desired; these native choices persist as browser preferences and require a restart. Their availability depends on the platform and compositor, OS accessibility settings and native workspace theme opacity. The settings do not enable website transparency or change OS accessibility flags. Local diagnostics include startup admission and the native appearance flags; no content or file paths are recorded. If either feature is absent after a cold launch, compare Zen/Sine versions to the README and collect `nocturne-diagnostics/nocturne-diagnostics.json` from the affected profile (not the full profile or Sine's `mods.json`).

## Rollback

Disable Nocturne in Sine. The script attempts to restore original layout preferences, preserving values changed by the user where possible. Restore behavior across multiple windows, script reload and startup is not yet runtime validated.

If the interface is unusable, use the test profile rather than your primary profile. Remove the mod or disable it in Sine. The saved values are available in `zen.oneplane.original-layout` if automatic restoration fails. Do not delete that backup before recording its contents. If required, restore the original native preferences manually.

## Limitations

The current preview is not a stable release. Source tests and CI are not a substitute for testing the actual Zen/Sine runtime, native drag handoff, startup and multi-window behavior. Official Zen Mods packaging is not provided.

## Layout backup and script permission

The `zen.oneplane.original-layout` preference is an internal backup, created automatically. It is not a switch and should not be removed while the mod is active. No manual layout preparation or Nebula edits are required. Sine's global permission for unpublished JavaScript mods remains an explicit user choice; the mod does not modify it. A future marketplace submission may allow Sine to treat Nocturne as a store-origin script instead.

## Experimental Windows Home direct alpha (preview.189)

In Nocturne preferences enable **Home — transparent surface**, **Native window transparency**, and **Home — direct window alpha without Acrylic**. Disable **Windows Mica / Acrylic backdrop** in the same settings, set **Home — direct alpha tint opacity** (default 65%), and fully restart Zen. Test with Windows Transparency effects already disabled, then change the tint and leave/reopen Home. The candidate clears native chrome backing only while normal Home is visible and fades Zen's existing background as one layer. Fullscreen, private, popup, forced-colors and ordinary page views retain native styles. This is not a guarantee of window alpha support or Desktop Acrylic blur. No Windows registry modification or desktop capture. To revert, disable direct alpha and restore the previous native Mica choice. Native verification required.
