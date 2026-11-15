# Manual installation (development only)

Use a separate test profile via `about:profiles`. Do not replace an existing theme or install these files in your primary profile until validated.

1. Open the test profile's `about:support` page and click **Open Folder** next to Profile Folder.
2. Create a `chrome` directory if it does not exist.
3. In `about:config`, set `toolkit.legacyUserProfileCustomizations.stylesheets` to `true` (Boolean).
4. Copy the desired module's `chrome.css` into a subdirectory of `chrome`, named `oneplane` or `general-improvements`.
5. Add the corresponding import at the beginning of your existing `userChrome.css`, preserving any existing imports and customizations. Create it if it does not exist.

```css
@import url("general-improvements/chrome.css");
@import url("oneplane/chrome.css");
```

Import only the modules you intend to test. Imports must precede ordinary CSS rules.

6. Create the module's Boolean enable preference in `about:config` (see its README), initially set to `false`.
7. Restart Zen, then enable one module at a time.

## Rollback

Set the module preference to `false`. If the browser is unusable, close it completely and remove the module's import from `userChrome.css` or rename the module's CSS file, then restart. Keep a backup of the original `userChrome.css`.

No executable installer, privileged script or network request is needed. Official Zen Mods and Sine packaging are not provided in this prototype.
