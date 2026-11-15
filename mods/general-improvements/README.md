# General Improvements

Independent visual refinements. Does not require OnePlane.

## Loading backdrop

Zen's transparent content panel can reveal the workspace theme when Nebula scales a page down during loading. This opt-in override gives the content panel a black backdrop during loading and briefly retains it during the return animation.

Enable Boolean preference `zen.refined.general.loading-backdrop` in `about:config` after following [manual installation](../../docs/installation.md).

The default color is `#000`. Edit `--zr-loading-backdrop` in the module's CSS to customize it. The CSS does not disable or replace the loading animation. It is intended for ordinary tabs and excludes split view and Glance where their known markers are present.

**Validation pending:** test slow/fast loads, reloads, transparent pages, switching tabs, Split View and Glance. Transparent pages may show the black backdrop while loading. No browser runtime test has been performed.

See [native settings](../../docs/native-settings.md) for removing the persistent content frame without CSS.

References: [Nebula loading animations](https://github.com/JustAdumbPrsn/Zen-Nebula/blob/main/nebula/modules/tab-animations.css), [Zen panel background](https://github.com/zen-browser/desktop/blob/1.24.2b/src/zen/common/styles/zen-browser-ui.css).
