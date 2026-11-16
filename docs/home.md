# Shared Home — preview.33

OnePlane ships the first host of the portable v1 core in `src/home/shared-home.js.part`. Zen Refined will embed the identical source and call `acquireZenHome(window, Services)` with its own trigger. No second surface, duplicate preference, or runtime fetch. Window registry `__zenSharedHomeV1` owns DOM, observers and state; each host gets a releasable lease and open-state subscription. Last release restores the page and removes shared resources. Incompatible API fails closed. Future incompatible changes require migration, not independent controllers.

Home is a chrome surface in `zen-tabbox-wrapper`, not a tab. Native tabpanels remain mounted and temporarily invisible/inert. Native tab session data is untouched. Search delegates to native new-tab command; validated HTTP(S) shortcuts open via native navigation. Private windows excluded in v1. Native workspace data is read on render and switches via the native manager. Empty initial shortcuts are intentional; Customize is the only Add/remove/reorder entry. Profile-local preference `zen.home.shortcuts.v1` is shared across windows and future hosts. Icons use Gecko page-icon. Five-second idle title does not change width. Alternate mode reserves a 32px central icon where geometry permits. Existing narrow-window/native fallback remains unchanged (<900px or insufficient center room).

OnePlane adapter alone holds its Compact toolbar via `oneplane-home-hold`. Address cascade remains authoritative. Tab selection, navigation, new tab, Escape, native fullscreen and last lease release close Home. Workspace switch initiated by Home retains it where possible. Native media/focus/split/portrait require actual Zen testing.

## Validation
- Click title, same/different tab, Escape, repeated toggles; preserve tab identity and scroll.
- Add HTTP(S), reject privileged schemes, remove, drag/reorder, restart and two windows; no Add in ordinary mode.
- Native search, bookmarks, workspace switch, split view, Compact on/off, address cascade, reduced motion, unload/reload and fullscreen.
- Check alternate mode, crowded tabs, groups and narrow fallback.
- Refined port: both installation orders, two triggers, release either lease, release last lease, shared data and CSS, private isolation.

## Deferred
Search in place, auto-open on startup, widgets/folders, portrait-native trigger, and Extension Dock relocation. No extension change in this preview.
