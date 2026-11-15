# OnePlane

Experimental one-row layout for Zen Browser. The intended design is icon-first horizontal tabs that expand on hover, a compact expandable URL field and the native Compact Mode reveal behavior.

## Preview

Follow [manual installation](../../docs/installation.md) in a separate test profile. Select Multiple Toolbars, an expanded left tab sidebar and Compact Mode → Hide toolbar (not Hide both). Turn off other layout-changing mods for the first test.

Enable Boolean preference `zen.refined.oneplane.enabled` in `about:config`. Disable it to revert.

The CSS contains adjustable toolbar height, tab width, expanded tab width, URL width, reserved areas and transition duration. These are initial design values, not final defaults.

**Known limitations:** this is a visual overlay experiment, not a native horizontal tab implementation. The internal vertical tab orientation remains unchanged. Overflow, drag and drop, folders, workspace controls, window resizing, menu placement, and compatibility with other mods require testing. Some sidebar-only controls are temporarily hidden in this preview; use existing keyboard shortcuts or disable the mod to access them.

The initial overlay yields its space while the address field is focused. A later iteration should improve layout allocation without overlay collisions.

See the [design and test plan](../../docs/oneplane-design.md).
