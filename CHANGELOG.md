# Changelog

## 0.2.0-preview.4

- Prioritize UI stabilization before Hub. Opening Liquid Wave lays out native results at the final width once, then reveals the surface with the timestamp-driven clip; cache border-box geometry via ResizeObserver instead of forcing layout each animation frame.
- Preserve closing duration and reverse-wave shrinking width; fade selection highlight before native blur without changing actual text selection.
- Fix stale center compensation when the startup address slot appears: recenter synchronously with its empty-state change, process independent edge ResizeObserver notifications before paint, and keep the tab-switch grace only for vertical geometry/contour. Floating search over a real page no longer collapses its reserved slot.
- Keep a stable temporary Compact Mode command button in OnePlane, separate from the native sidebar toolbar Zen reparents on mode changes. Original widget remains available when OnePlane is disabled or outside its layout scope.
- Add wave and center-bias regression tests, synchronize the approved Hub roadmap, and track OP-006/007. Live performance and visual confirmation are pending.

## 0.2.0-preview.3

- Documentation and update-diagnostic release: record OP-002 (opening animation frame pacing), OP-003 (URL selection disappearance), and OP-004 (intermittent Sine update discovery).
- No runtime JS, CSS or preference changes relative to preview.2. This release also provides a fresh manifest for update-path diagnosis.

## 0.2.0-preview.2

- Keep OnePlane mounted with native Compact Mode off; persistent horizontal toolbar uses normal layout flow. Compact Mode on retains the animated overlay. Stop forcing Compact Mode on startup or restoring its user-owned preference on unload.
- Preserve native caption controls if Zen moves them into the hidden toolbox.
- Record and mitigate OP-001: one-frame UI jump when activating an unloaded tab. Guard provisional blank URI and defer recentering through the existing tab-switch settling interval.
- Add address classification regression tests. Hub and workspace presets remain planned; live testing is required.

## 0.2.0-preview.1

- Introduce ordered source sections for core, native adapter, layout, toolbar, interactions and CSS; extract eight independently importable pure algorithm modules.
- Add a dependency-free deterministic Node build, build parity verification and five regression test suites.
- Keep the shipped JS and CSS byte-identical to 0.1.0-preview.32. No behavior, settings or Sine entry changes.
- Document the staged persistent-layout and OnePlane Hub architecture. Stateful controllers still share the original window closure at this migration stage.

## 0.1.0-preview.32

- Stabilize Compact Mode visibility with one visual state for the surface and controls, a 180ms tab-switch settling window and 100ms close hysteresis. Do not restart the panel transition on transient native hover flags or stationary-pointer retargets.
- Replace selected-tab scrollIntoView with horizontal scrolling restricted to its own tab viewport.
- Keep the last valid contour during native tab transactions and stop observing the animated wrapper height, avoiding unnecessary mask/layout regeneration.
- Preserve Liquid Wave, Unified Contour settings, native floating search and drag holds. Live Zen verification remains required for the intermittent flicker.

## 0.1.0-preview.31

- Add Liquid Wave for the inline address editor: expand width and reveal the native result surface together, with a smooth left-to-right wave (420ms). Reverse the wave and width together on outside-click dismissal (380ms), including interrupted opening/reopening.
- Smooth Compact Mode panel reveal/hide: move the shared background and controls together by 10px while fading in/out (300/420ms). Keep the long Unified Contour visible during closing instead of clipping it immediately.
- Keep the selected static Fade settings, native bookmark layout, floating search, page position and reduced-motion support. The collapsed hit strip remains native; hidden controls do not receive pointer input.

## 0.1.0-preview.30

- Use Unified Contour: a solid rounded bookmark shelf without its own feather, and a full-width vertical fade beginning at the bottom of the upper toolbar row. Composite the two shapes into one alpha mask before applying global transparency.
- Defaults match the selected prototype: 4% transparency, 100% fade intensity, 69px fade length, 30px solid start, 0.65 falloff, 24px maximum corner radius and 0px bookmark padding.
- Add seven live Sine preferences for these parameters. Clamp the solid start to the fade length and the radius to half the shelf depth.
- Keep bookmark geometry tracking, toolbar interaction bounds, reduced transparency, address bar and tab animations unchanged.

## 0.1.0-preview.29

- Replace the uniform static toolbar fade with Adaptive Contour Fade: a short upper edge, rounded symmetric shoulders and a lower shelf around actual visible bookmark buttons.
- Use the selected prototype's 18px radius (limited by available depth), 5px padding and 9px contour-normal feather; mask the shared tint and blur together.
- Measure individual visible native bookmark buttons and the overflow chevron, update on resize, visibility, bookmark changes and Magnetic Bookmarks transitions. Without bookmarks the contour is flat.
- Keep the existing address bar animation, reveal/close timings, hover region, tab and bookmark interactions unchanged; retain opaque reduced-transparency behavior.

## 0.1.0-preview.28

- Fade the top overlay's shared tint and blur from the tab row to fully transparent at its existing lower edge; remove the hard row fills and bottom shadow.
- Preserve the current toolbar height, reveal/close behavior, interactive controls and bookmark geometry. Respect reduced transparency with an opaque, unmasked panel.

## 0.1.0-preview.27

- Keep the center title island visible and stationary during drag; show the carried tab title or combined Split View titles. Preserve the center gap in virtual reorder slots.
- Track the actual dragged tab with the liquid indicator; span all member cards when carrying a Split View group. Collapse the line during extraction and suppress it while detached; restore it on re-entry or after the drag ends.
- Strengthen ordinary hover motion to 20% vertical scale, 7px descent and 28% favicon scale. Reserve 18px of row height; keep member hover motion inside the Split View frame.
- Preserve unloaded-icon brightness, native adoption, reduced motion and Sine settings.

## 0.1.0-preview.26

- Add optional Island Mode: compact icons in two independently scrollable lanes around a fixed-width centered title pill. Hover changes only the title and visual lift, never the slot widths; the idle pill displays the selected tab.
- Add Sine preferences for hover mode and showing the center island; keep Expand Mode as default. Hide the island if there is insufficient symmetric space or during drag, with no loss of tab order.
- Use the same magnification and 3px downward motion in both modes, reserving 8px of row height for the effect and indicator so bookmarks remain clear.
- Preserve native split groups as indivisible lane slots and reuse continuous-strip drag geometry without reparenting the dragged node at drag start.

## 0.1.0-preview.25

- Make tab hover magnification visible: 12% taller card, 2% wider card and 18% larger favicon, with smooth reversible easing.
- Fix the more-specific direct-child transition that previously omitted scale. Keep the same tab-slot geometry, split group width and drag transforms.
- Preserve reduced-motion and disabled-animation settings, unloaded-icon fade and all drag behavior.
- Record native Zen 1.24.2b feature gaps and optional visual ideas in the design notes.

## 0.1.0-preview.24

- Keep unloaded favicons at half strength throughout hover, inline dragging, extraction, desktop dragging and return; retain full-strength loaded icons and opaque cards.
- Slow unloaded icon fade to 2 seconds after the hover/drag state ends; keep the 150ms hover response.
- Shrink the complete Split View artwork as one object during extraction, using the same group ghost instead of clipping the member cards inside a narrowing frame.
- Position adjacent slots in a synchronized geometry pass during group extraction, preventing transition lag from causing overlap; keep the existing horizontal reorder and Bunny bounce.

## 0.1.0-preview.23

- Keep unloaded favicons half-strength on hover (50% opacity and grayscale), fully bright while carried, then fade smoothly to the appropriate idle/hover state.
- Render detached Split View groups with the original group accent, frame, six-dot handle, individual compact tab cards and selected-member styling.
- Keep a group's visual reorder position while beginning extraction, rather than returning to its original native slot.
- Follow Zen 1.24.2b's native split-drop activation sequence for inactive/pending tabs; reject splits against the empty workspace tab and restore the previously open startup search after an unsuccessful drop.
- Known issue, intentionally deferred: a group may hesitate or transition unevenly when reordered from an outer edge.

## 0.1.0-preview.22

- Preserve the last hovered liquid-indicator target in inter-tab gaps, split handles and group padding; return to the active tab only when leaving the strip or reaching the plus.
- Use directional edge expansion only with one to three visible tabs, counting every Split View member in rendered order. For four or more tabs use the same centered expansion for every position.
- Add a restrained hover lift (1.008x horizontal, 1.065x vertical) without changing slot or group geometry; respect reduced motion and disabled animations.
- Leave the Bunny extraction, insertion spring, drag buffer and native desktop transfer unchanged.

## 0.1.0-preview.21

- Restore bounded directional hover expansion from preview.19 while preserving intrinsic Split View widths; eliminate cumulative anchor drift.
- Preserve the approved Bunny extraction; add a 240ms full-card insertion spring with a fast-opening slot and prevent re-compression during re-entry.
- Add elastic horizontal resistance and neighbor displacement before the reorder threshold.
- Keep the liquid indicator under the selected tab when idle, retarget it on hover and return it to the selected tab on departure.
- Preserve Sine package identity and advance update metadata.

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
