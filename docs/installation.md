# Manual installation (development preview)

**Do not install into your primary profile.** This is an untested layout prototype. Use a separate Zen profile created via `about:profiles`. Disable other layout-changing mods for the first test.

1. Open the test profile's `about:support` and click **Open Folder** next to Profile Folder.
2. Create a `chrome` directory if necessary.
3. Set `toolkit.legacyUserProfileCustomizations.stylesheets` to Boolean `true` in `about:config`.
4. Copy [chrome.css](../chrome.css) into `chrome/oneplane/chrome.css`.
5. Add the following import to the beginning of `chrome/userChrome.css` (create the file if missing; do not overwrite existing styles).

```css
@import url("oneplane/chrome.css");
```

6. In **Look and Feel**, select **Multiple Toolbars** and an expanded left sidebar.
7. Enable **Compact Mode → Hide toolbar** (not Hide both). Use a window at least 900 CSS pixels wide.
8. Create Boolean `zen.oneplane.enabled` in `about:config`, initially set it to `false`.
9. Restart Zen, then set the preference to `true` to test the layout.

The preview does not change Zen's original tab orientation logic. Scroll behavior, tab reordering, folders and toolbar overlap are unresolved. See the [design and validation plan](design.md).

## Rollback

Set `zen.oneplane.enabled` to `false`. If Zen is unusable, close it completely and remove the import or rename `chrome/oneplane/chrome.css`, then restart. Keep a copy of any existing `userChrome.css`.

No executable installer or privileged script is required. Sine and Zen Mods packaging are not available yet.
