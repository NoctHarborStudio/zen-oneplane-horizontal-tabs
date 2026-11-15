# Sine update diagnostics

Sine 2.3.3 checks the installed entry in `chrome/sine-mods/mods.json`, skips disabled mods and entries with `no-updates`, compares `updatedAt` strictly, then downloads a ZIP of the configured branch. A release's version string alone does not trigger an update. The manifest and archive are separate GitHub endpoints and can temporarily be out of sync. A failing earlier mod may also interrupt the updater. See [Sine's update implementation](https://github.com/CosmoCreeper/Sine/blob/v2.3.3/src/core/manager.sys.mjs).

Every OnePlane preview must retain the package ID and homepage and increase both the version and timestamp. Run `python scripts/verify-release.py --previous <previous-version> --previous-date <previous-timestamp>` from the checked-out preview after publication. This verifies both exact public URLs used by Sine and all package file bytes.

If an installed copy still does not update, use about:support to open the current profile directory. Read (do not edit) the OnePlane entry in `chrome/sine-mods/mods.json`. Check version, updatedAt, homepage, enabled and no-updates. Also compare the theme.json inside the package ID directory. Check the Browser Console for updater errors at the moment Check for Updates is clicked. Do not post the entire mods.json or profile. The mod does not modify Sine's global update policy, caches, or installed metadata.
