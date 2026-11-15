# Changelog

## 0.1.0-preview.20

- Anchor hover expansion to the actual tab center, including adjacent Split View groups and rapid retargeting; use intrinsic group widths.
- Add an 8px reorder hysteresis and pointer-driven two-axis squash before detachment.
- Animate one opaque in-window drag card with a 360ms Bunny bounce and reverse insertion; hand off to Gecko only at the window boundary.
- Brighten unloaded icons during drag, suppress the old detached source and preserve native tab/group drop operations.
- Keep the Sine package identity and advance its update timestamp.

## 0.1.0-preview.19

- Isolate nested drag transforms so a Split View group's frame and tabs move together.
- Measure live member widths to size groups during hover and collapse without a second independent width animation.
- Collapse the source's layout slot while detached and provide subtle visual feedback.
- Preserve the width/title transition at drag start instead of instantly snapping to compact.
- Keep the native copy-link control in the leading address slot; suppress the invalid/search identity icon.
- Overlap horizontal address growth and downward results reveal, with a short 45 ms lead for width; retain results-first dismissal.

## 0.1.0-preview.18

- Animate the actual Split View wrapper width alongside its expanded member.
- Use a transparent native drag image while the pointer is inside the whole upper toolbar, with the real tab/group following the pointer.
- Switch to the normal OS drag image outside the toolbar and hide the original until drop or re-entry.
- Unify compact and expanded address clipping, corners, text and identity icon geometry, and disable competing inline result animations.

## 0.1.0-preview.17

- Preview horizontal drag reordering in real time: the native drag image follows the pointer, while adjacent tab/group slots slide and a translucent destination slot moves into place.
- Keep native tab order unchanged until drop, preserving cancellation, split extraction and cross-window transfer.
- Give the compact and inline popover address the same painted box, header dimensions, corner radius and internal spacing.
- Start native inline popovers at compact width before the animation controller reveals them, avoiding an expanded first frame.
- Preserve the central floating search and native identity/search controls.

## 0.1.0-preview.16

- Render each native Split View as a single horizontal group with shared background, outline and a dedicated six-dot handle on its left.
- Drag the handle to reorder the entire native group within the window without unsplitting; keyboard arrows on the handle provide an alternative.
- Drag individual tabs out of the group to unsplit; treat other groups as atomic drop targets.
- Include group handle width in tab-strip centering and preserve directional hover expansion.
- Retain native page-divider resize controls.

## 0.1.0-preview.15

- Speed up tab and inline address transitions, and align the real popover with the compact field's measured origin and header.
- Neutralize conflicting Nebula address surface scale/fade and return the page to its unblurred state when closing begins.
- Move the native page zoom indicator out of the address field into the right-side actions.
- Show shared Split View group accents on horizontal tabs and update them from native group state.
- Remove a single tab from Split View when dragged into the content, out of its group in the strip, or into another window; use native unsplit logic.
- Make the native split resize divider visible and easier to grab, including at zero content separation.

## 0.1.0-preview.14

- Display animated audio playback and static muted indicators on compact and expanded tabs, using native tab media state.
- Add horizontal drag reorder, transfer to another OnePlane window, and drag outside the source window to detach using native browser tab adoption.
- Add directional Split View drop targets on the current page.
- Validate update metadata, package identity, raw manifest and branch archive with a release verification utility.

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
