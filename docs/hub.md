# Hub Foundation — preview.11

Existing native spaces are shown as-is. Free designation/migration and full editing/deletion are separate stages. Named creation is an explicit native createAndSaveWorkspace call; Zen owns session updates. No polling or network.

## Pending live tests

- Open in Compact on/off; anchor, hold, outside-click, Escape focus, resize/customize/fullscreen and unload.
- Verify actual names, current space, selection, named creation, no duplicate tabs, disabled workspaces, private/synced windows, rapid clicks and unload during async work.
- Right-click non-selected, pinned and split tabs; the native menu must act on the exact tab without selecting it first. Cancel if trigger identity is unavailable. Check keyboard menu, submenus and cleanup.
- Verify no regression in Center Assembly, Fluid Wave, Bunny, shared Magnetic Bookmarks and contour. Native appearance is provisional; custom Hub animation and full Library remain future work.

## Preview.12 — live feedback and polish

User confirmed native workspace creation and switching, including newly created empty Work. Hub icon was invisible, Compact toggle closed the panel, and fixed width/left alignment/theme did not match the toolbar. Preview.12 uses an explicit SVG button, address-width-derived panel geometry and address surface color. Compact transition keeps intent with at most one bounded reopen. Right-click workspace opens actions. Delete uses native Zen removal after explicit confirmation: ordinary ungrouped tabs in a single participating window move to another existing space (Free if designated); grouped/Glance/multiwindow cases require separate explicit consent to close remaining tabs, not a silent lossy move. Last space and designated Free protected. Live tests pending. Test populated/empty, active/inactive, grouped, multiwindow, cancellation and last-space protection.

## Preview.13 — input and workspace isolation

Preview.12 user reports icon brightness/position mismatch, missing hover background, intermittent first-click failure and double-click maximize/restore. Remove XUL Hub popup and screen-coordinate moveTo; use one manually controlled HTML panel in browser chrome, manual top layer if available, viewport-relative geometry, explicit no-drag CSS and event boundaries. Keep the panel open during Compact changes without reopen timers. Native tab context menu remains independent. Source audit: Zen 1.24.2b URILoadingHelper switches across allUsedBrowsers; scope native reuse to current window/active workspace only, visible Essentials excepted. URL bar explicit existing-tab result loads locally when no matching local tab exists, instead of unregistering the foreign tab. Verify settings from menus and search, duplicate HTTP URLs, containers, private windows, split views, explicit workspace selection and disable/unload. Multi-monitor projection remains roadmap only, not implemented. Live tests pending.

## Preview.14 — Hub continuity and experimental projection

User accepted trigger, confirmed workspace-local duplicates, Compact retention and existing animations. Keep trigger unchanged. Use native dontChange=true, retain Hub on create/select, center inline deletion confirmation, match toolbar tint, add interruptible WAAPI reveal/close with reduced motion. Experimental drag across monitor (pointer capture), context action fallback and Return; requires native all-tab sync, no changed sync preferences or tab adoption. Return verifies every nonempty native tab ID in source before normal native window close. Native Zen can swap live docshells; no promise of simultaneous live rendering. Mixed-DPI coordinates, native window placement/closure and runtime behavior require testing. Synced favicon fallback uses native tab ID, native icon or local page-icon and event-driven refresh.

## Preview.15 — drag and monitor feedback

User confirms deletion, persistent Hub and Open in another window. Hub 460/390ms. Shared snap-style work-area geometry for tab detach and workspace projection; top maximize, sides halves, corners quarters, center bounded floating. Native XUL nonfocusing mouse-through preview is experimental, not Windows shell Snap UI. Once external, keep OS drag image through reentry; no local duplicate, bounded reinsertion scale and immediate slot shifts. Empty workspace drop selects tab; native edge Split View retained. Explicit blank projection startup and only exact untouched startup-tab cleanup. True simultaneous scroll/video mirroring is not implemented: Zen swaps one live docshell between windows, and a separate rendering/input architecture is needed. Test cross-monitor preview, mixed DPI, negative coordinates, drag cancellation, split, native placement and startup tabs. Do not silently duplicate pages or inject generic input forwarding.
