# Changelog

## 0.1.0-preview.13

- Expand the inline address to the actual right-hand window-caption boundary, instead of a fixed width cap.
- Keep the toolbar anchor compact throughout the popover animation, so native close does not trigger a second horizontal transition.
- Retain the final compact visual frame until native closure settles; recover if native dismissal is blocked.
- Use one consistent compact/focused/expanded surface color and 8 px corner radius.
- Preserve the native floating New Tab search and existing two-phase animation.

## 0.1.0-preview.12

- Collapse the inline URL placeholder whenever Zen opens floating search, including New Tab over an already loaded page.
- Keep the native central search visible and prevent its empty toolbar anchor from animating.
- Start inline address growth from its compact width even if Zen already expanded the placeholder.
- Preserve the same Sine package ID and preview source with a strictly newer update timestamp.

## 0.1.0-preview.11

- Animate the real inline address popover instead of just its toolbar anchor.
- Open in two phases: grow rightward, then reveal search results downward.
- Dismiss from outside in reverse: hide the results upward, then shrink the address field before invoking native close.
- Preserve the two-second toolbar hold after dismissal, native floating search and reduced motion.
- Allow an interrupted opening to reverse from its current geometry.

## 0.1.0-preview.10

- Improve compact and focused address-field contrast with a lighter neutral surface.
- Use asymmetric address expansion/collapse durations (260/360 ms).
- Keep the top panel open for two seconds after an outside click dismisses address editing.
- Slow the top panel closing transition to 340 ms; preserve ordinary compact hover behavior and reduced motion.

## 0.1.0-preview.9

- Collapse the empty start-page address anchor while preserving native floating search and non-floating keyboard focus.
- Remove the close button from expanded tabs; retain middle-click and native keyboard closing.
- Center the favicon and title together; soften expansion and collapse timing.
- Add the spring-driven liquid hover indicator with restrained cursor-relative offset, independently of Zen Refined.
- Retarget immediately between tabs; delay collapse on departure and keep the new-tab button stationary while hovered.
- Add indicator and collapse-delay settings.

## 0.1.0-preview.8

- Use a dedicated real toolbar backdrop element, with an independent tinted background on the visible navigation and bookmarks rows.
- Expand the first tab leftward, the last tab rightward, and interior or single tabs symmetrically, subject to available space.
- Keep the collapsed tab strip centered and move the new-tab button with the right edge of the expanding strip.
- Prefer pointer hover over stale keyboard focus, and cap left expansion at the available navigation gap.

## 0.1.0-preview.7

- Restore the top overlay's frosted surface independently of the native Zen/Nebula background layer.
- Provide a readable tinted fallback when backdrop blur cannot sample web content.
- Preserve the existing tab centering, left/right controls and overlay positioning.
- Respect reduced-transparency preferences.

## 0.1.0-preview.6

- Return navigation and the address field to the left edge.
- Center the collapsed tab strip against the full browser window, excluding the new-tab button and expansion reserve.
- Preserve native right-edge controls and centered bookmarks.
- Make the native top toolbar an overlay instead of resizing web content during reveal.
- Neutralize Zen's corresponding content margin adjustment within the active OnePlane layout.
- Keep Nebula height compatibility and hover retention inside OnePlane; no manual theme edits.

## 0.1.0-preview.5

- Center the navigation buttons, compact address field and horizontal tabs in one group.
- Keep page actions, extensions and native window controls at the edge.
- Center the native bookmarks row and remove flexible gaps between navigation and URL.
- Reserve expansion space for hovered tabs to avoid moving the center group.
- Measure the full toolbar height (including bookmarks) and keep it open while the pointer is within its bounds, preserving native Compact Mode outside that area.

## 0.1.0-preview.4

- Move the native translation and site-data buttons to the right end of the toolbar.
- Intercept the click used to dismiss the address field before it reaches the page.
- Give active, loaded and unloaded tabs distinct surfaces; mute unloaded favicons.
- Align the compact address at its start and apply overflow fading only on the right.
- Add a translucent frosted native toolbar background and place New Tab next to the tab list.

## 0.1.0-preview.3

- Replace the invisible fixed-position tab overlay with a horizontal view in the native navigation toolbar.
- Mirror native tabs and synchronize selection, labels, icons and open/close events.
- Expand the real address field and non-floating suggestion panel on focus.
- Preserve native toolbar reveal and fall back to the original layout when the strip is unavailable.
- Native drag and drop, folder rendering and context menus remain unfinished.

## 0.1.0-preview.2

- Configure required native Zen layout automatically using an auditable local Sine script.
- Attempt to restore saved settings on unload; gate CSS by a per-window activation marker.
- Remove the redundant internal enable checkbox; use Sine's mod toggle.

## 0.1.0-preview.1

- Initial experimental horizontal top tab bar.
- Icon-first tabs with hover expansion and compact address field.
- Native Compact Mode integration experiment.
- Fallback to the standard layout outside the supported configuration or below 900 CSS pixels.
- Manual installation, rollback and validation documentation.
- Sine package metadata and opt-in settings for tab widths, address width and expansion timing.

No stable release has been published.
