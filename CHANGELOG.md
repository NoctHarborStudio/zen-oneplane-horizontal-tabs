## 0.2.0-preview.46 — Home glass search and sharper icons

- Match the native floating search to the Home field's width and position, with viewport bounds. Render one translucent rounded frame; neutralize the opaque native background and competing transforms only for Home sessions.
- Replace the clip/scale morph with a 300ms actual-height reveal. Hide the Home source before opening, restore on cancellation, and release all session CSS variables. Preserve Smart Search data and native input.
- Request larger cached favicons and use an embedded scalable Steam mark (Simple Icons, CC0, trademark remains with Valve). No remote icon request by the mod.
- Native browser visual verification pending.

## 0.2.0-preview.44 — Scrollable Home pin picker

- Replace recommendation pagination with a native vertical scrollbar and a fixed two-row viewport. Three columns on wide windows, two or one on narrow windows; Workspaces and Done stay outside the scroll region.
- Keep scroll position after pin additions or returning from custom URL; reset on leaving Add Pin. Add short mode-enter, hover and press motion with reduced-motion support.
- Preserve primary Home behavior and other preview.43 changes.

## 0.2.0-preview.42 — Compact Home Add Pin mode

- Show only three recommended sites per page, with previous/next navigation. Add mode replaces the search and existing pinned grid, retaining Workspaces and a single Done control.
- Custom URL entry replaces the recommendations instead of expanding the page; Escape/Done return through the editing states. Existing pins remain saved.
- Responsive short/narrow layout; no changes to Smart Search or tab lanes.

## 0.2.0-preview.41 — Independent tab lanes

- Native thin horizontal scrollbars and wheel/trackpad scrolling for each overflowing lane around Home, without scrolling the opposite lane or the web page. Keep the left lane initially aligned toward Home and hide indicators outside their viewport.
- Collapse a narrow title island to the Home icon before using the existing unsupported-space fallback. Preserve hover and native Split View groups.
- Second overflow row is a separate pending 2D layout/drag milestone; the existing 900px support threshold remains until adaptive native controls are implemented. Runtime Zen verification pending.

## 0.2.0-preview.40 — Proportional tab hover

- Expand ordinary tabs with uniform 120% scale and the existing 7px descent. A single interpolated progress drives layout width, scale and exact symmetric slot compensation; the configured expanded width remains the final painted width, with no additional horizontal overhang.
- Split and Island hover use a restrained uniform 105% scale; keep Split within its frame and Island slots stationary. Compensate the favicon zoom to remain around 128%; preserve drag, address-wave and reduced-motion paths.
- Chromium fixture verified geometry at 140/180/240px during hover retargeting; real Zen verification pending.

## 0.2.0-preview.39 — Home recommended pin picker

- Customize → Add Pin offers one-click recommendations from native toolbar bookmarks and recent visible tabs; already pinned URLs and unsafe schemes are excluded.
- Keep the picker open for adding several sites. Manual URL entry is secondary and name is optional. No history or network requests.
- Floating Smart Search appearance is unchanged in this release.

## 0.2.0-preview.37 — Reset Hub Trash on open

- Start every new Hub opening with Trash collapsed, including an interrupted close animation. Keep the age filter, native Trash contents and in-session manual expansion unchanged.
- Prevent an asynchronous workspace deletion from reopening Trash in a later Hub session; retain auto-expansion within the same session. Live Zen validation pending.

## 0.2.0-preview.36 — Home startup and search morph

- Open Home once per normal supported window after session/workspace restoration and OnePlane readiness. Preserve native tabs and avoid reopening on live reload or workspace projection.
- Increase Home content width to 720px, search height to 56px, shortcut height to 102px; increase spacing and workspace size with responsive fallback.
- Home-origin floating native search gets a geometry-based 400ms opening morph and fades Home content out/in; preserve native results, cancellation, keyboard handling and reduced motion.
- Runtime Zen verification pending.

## 0.2.0-preview.34 — Home search and visual state

- Keep Home visible under Zen's native floating search; cancellation returns to Home, committed search/tab selection returns to browsing. Match native close session token.
- Empty Pinned explains Customize Home. Hide selected-tab/split-group highlighting and compact URL slot while Home is open without changing native selection; restore on close. Hover/drag indicators stay available.
- Real Zen validation pending.

## 0.2.0-preview.33 — Home foundation

- Shared per-window Home controller and OnePlane trigger, native background, shortcuts and customization, workspace/search bridge.
- Fixed-width idle Home title and alternate centered icon where room permits. Extension relocation deferred. Private windows retain native behavior.
- Live Zen validation pending; Zen Refined host not shipped yet.

# Changelog

## 0.2.0-preview.45

- Enable native window dragging on the empty Home background and real toolbar drag gaps, excluding interactive controls. Preserve Windows maximize/restore/Snap and native tab drag ownership.
- Anchor the New Tab plus to the occupied right tab lane, capped by the available row width; retain expansion room in Expand mode. Reconcile geometry on resize and native size-mode changes.
- Live Windows drag and mixed-DPI verification pending; generic console exceptions lack a stack and are not attributed to these fixes.

## 0.2.0-preview.43

- Make Home an idempotent primary destination instead of a toggle. Repeated Home clicks and plain Escape no longer uncover empty transparent background. Empty ordinary native tabs return to Home; real page navigation exits. Background TabOpen does not dismiss Home. Preserve projection startup, private and fullscreen/customization paths, native search cancellation, current Add Pin and workspace transition.

## 0.2.0-preview.38

- Integrate the optional Zen Refined Center Workspace Transition in Home and Hub without changing native workspace ownership. Hold the Compact toolbar and retain the Unified Contour mask during the transition. Home updates workspace selection by native identity instead of rebuilding its search and pinned shortcuts.
- Preserve existing Home startup and search morph, address wave, and native fallback when Zen Refined is absent. Runtime integration validation pending.

## 0.2.0-preview.35

- Move the original Trash card via shared pointer drag lifecycle and empty spacer; remove native drag image and post-drop clones. Animate lift, absorption and return.
- Fix Windows Free startup claim without hiddenDOMWindow. Preserve concurrent Home changes, native transfer, filtering and projection.

## 0.2.0-preview.32

- Center Trash header controls; replace native age select with inline choices that retain filter state.
- Add Fluid lift, post-drop suction and in-Hub cancellation return while preserving native drag transfer and virtual list.

## 0.2.0-preview.31

- Redesign One Plane Hub: separated Free, settings above expandable bottom Trash button, count/header controls and compact drag-only site cards.
- Add virtualized Trash viewport, shared visible-only relative age timer, native drag lift and destination feedback.
- Select designated Free on first normal startup; create if absent without renaming existing spaces. Preserve projection and safety gates.

## 0.2.0-preview.30

- Explicit Free designation, native workspace name/icon/order controls and Hub accent.
- Native Trash drawer, age-filtered confirmed Clear and drag/selector restore. Safe workspace deletion parks eligible tabs rather than closing them.
- Gate moves/deletion/clear to single-window and supported ordinary tabs; preserve native session and close semantics. Runtime verification pending.

## 0.2.0-preview.29

- Open projected workspace search after placement settles; verify actual visible native view, resume inherited closed new-tab session, skip redundant same-space switch and add bounded diagnostics. No tab creation or geometry/indicator changes.
- Record shared theme-aware floating search color/translucency design in roadmap. Runtime verification pending.

## 0.2.0-preview.28

- Fix premature workspace/placement startup cancellation on document unload; observe actual native window closure and verified closed state instead.
- Keep projection startup guard alive across initial document replacement; bounded readiness probes and explicit cancellation diagnostics. Add regression tests for early unload and actual closure. Preserve working geometry and indicator.

## 0.2.0-preview.27

- Guard native projection startup empty-tab selection against ordinary homepage fallback; restore native method, safely identify startup tabs and open search independently of placement.
- Bound maximize readiness wait and add missed-startup fallback, verified screen check and diagnostic stages. Preserve confirmed indicator cooldown and snap geometry.

## 0.2.0-preview.26

- Wait for native Zen startup before maximize; bounded maximize retry and cancellation guards.
- Select native transparent empty tab and open floating startup search in projected workspace; remove only verified new untouched startup tab, never existing tabs.
- Hold hover underline for 2000ms after pointer departure, cancel on new hover or explicit selection; preserve tab expansion timing and existing drag/snap geometry.

## 0.2.0-preview.25

- Test the real startup scheduling adapter for delayed startup, ready windows and cancellation; account for integer CSS feature rounding at 2x DPI. Runtime unchanged from preview.24.

## 0.2.0-preview.24

- Create native windows with the selected final snap rectangle rather than the uniform center seed; maximize independently of workspace initialization.
- Verify selected position and size, add bounded resize fallback and preserve working target-monitor selection. No preview or animation changes.

## 0.2.0-preview.23

- Seed native workspace/tab window creation on verified target monitor using converted opener position and destination size features; retain post-startup snap verification and bounded native move fallback.
- Do not silently open an unknown target on source during experimental monitor drag; add local placement diagnostics. Preserve existing preview, zones and animations.

## 0.2.0-preview.22

- Broaden monitor snap zones (22% horizontal, 18% vertical), move small placement preview to target display with CSS coordinate conversion and validation.
- Stage native desktop position and post-DPI resize, verify target before maximize; narrowly scoped release fallback.
- Reserve expanded tab toolbar during drag and cancel a detached tab's return instead of creating a top Split View. Preserve direct reordering and existing split animations.

## 0.2.0-preview.21

- Extract Display Engine and pure desktop geometry; validate native event screen, handle full monitor vs work area, negative origins and DPI conversion.
- Replace desktop-sized popup with small source-window snap diagram. Place native windows after startup via base-window device/desktop API, validate target and use OS maximize; safe native fallback.
- Add experimental Windows placement preference and geometry tests. Drag Engine live validation and actual Windows shell overlay still pending.

## 0.2.0-preview.20

- Repair Sine update timestamp regression: new updatedAt exceeds preview.16 and intervening publications. No browser runtime changes from preview.19.
- Verify timestamp high-water mark against full manifest history before running build/tests; keep version and identity checks.

## 0.2.0-preview.19

- Normalize screenshot-shortcut detection to a strict boolean; fix regression test without weakening assertions. Includes preview.17–18 Drag Engine changes.

## 0.2.0-preview.18

- Harden native dragend ownership against a different/stale source node or tab, preserving the Drag Engine stabilization scope. No Snap or Split View visual changes.

## 0.2.0-preview.17

- Extract shared tokenized Drag Engine and cancel/finish ownership for workspace and native tab gestures; clear stale visuals and ignore late input.
- Global pointer-release/capture/focus/keyboard cleanup, native dragend fallback and active-only native session watchdog.
- Temporarily disable faulty external Snap popup and forced monitor placement; normal native window opening remains. Display Engine next.
- Record unresolved Split View overlap without changing its animation. Live validation pending.

## 0.2.0-preview.16

- Add a visible workspace carry badge inside the source window; stabilize center placement preview.
- Protect all pre-existing synced tab IDs during projection startup cleanup and check the source peer.
- Record live same-tab rendering as a separate milestone. Live validation pending.

## 0.2.0-preview.15

- Latch native drag image after external transition, clamp reinsertion scale, remove delayed live slot transforms; drop onto empty workspace selects dragged tab.
- Shared experimental snap-style work-area preview and placement for tabs/workspaces, top maximize, sides/quarters/center. Not Windows shell Snap UI.
- Explicit blank projection startup and guarded exact untouched startup tab cleanup; Hub Fluid 460/390ms.
- Document simultaneous live-page mirror as separate architecture; not implemented. Live verification pending.

## 0.2.0-preview.14

- Keep Hub open after create/select; native creation without activation, centered inline deletion confirmation and shared toolbar tint.
- Interruptible native Fluid animation on Hub open/close; preserve trigger and existing animations.
- Experimental synced workspace projection and Return, gated on all-tab sync; context action fallback. No tab adoption or independent session.
- Native synced favicon fallback and event-driven refresh. Live validation pending.

## 0.2.0-preview.13

- Replace native Hub popup with an in-document manual panel; fix single-click hit target, window dragging exclusion, hover background and icon sizing/brightness/alignment.
- Preserve Hub through Compact toggles without native popup reopen timers.
- Scope existing-tab URI reuse to current workspace/current window, preserving visible Essentials and native opening; add URL-bar result handling and cleanup.
- Multi-monitor projection remains a planned milestone. Live validation pending.

## 0.2.0-preview.12

- Visible SVG Hub trigger; match address surface and left/navigation width; no native arrow padding.
- Keep Hub open while toggling Compact Mode, bounded recovery if Zen rolls up the popup.
- Workspace right-click Delete with confirmation, last/Free protection and default safe tab preservation for ordinary single-window cases.
- Record multi-monitor workspace projection and Return design; not implemented yet. User verified preview.11 creation and switching; new polish needs live testing.

## 0.2.0-preview.11

- Hub Foundation: stable left button, native popup, real workspaces, explicit named creation, Compact Mode and lifecycle-owned visibility hold.
- Native mirrored-tab context menu; cancel if target identity cannot be resolved.
- No Free migration, discard, Library or Extension Dock yet. Fluid Wave, Bunny and Magnetic Bookmarks unchanged. Live validation pending.

## 0.2.0-preview.10

- Replace external Bunny overshoot with a bounded 0–100–93–100% return, four keyframes per tab. Restore progressive Wave Fade on address opening: two opacity keyframes per visible item, no scale on normal opening.
- Include native bookmarks, folders and overflow in the same address-wave choreography. Use the existing horizontal trajectory and vertical depth for the lower row; preserve native text metrics, add an optional decorative-only bounded bounce on return.
- Bundle canonical Magnetic Bookmarks from Zen Refined 0.6.0-preview.3, byte-identical script and stylesheet, with one window-scoped controller and independent leases. Existing shared settings are retained; no runtime dependency on Refined.
- Suspend magnetic hover and freeze both contour calculations during the address wave. Keep original Split View contour and selected-tab indicator timing. Keep the accepted Fluid Wave source unchanged.
- Add source-lock and lease tests; actual Zen high-refresh and two-mod lifecycle tests pending.

## 0.2.0-preview.9

- Remove opening Bunny animation entirely: hide the complete tab strip (including title island, plus, indicator and split groups) with one visibility/opacity state, without layout removal or per-card animation.
- Keep closing Bunny only; replace the quadratic shared timeline with three local scale/opacity keyframes per visible card. Limit horizontal overshoot using measured neighbor/group gaps, retain 114% vertical spring and right-to-left stagger. No slot locking, moving partitions or animated inherited CSS properties.
- Return the selected-tab underline with its own card (28ms after card reveal starts), not after the entire strip. Group opacity animates directly with the original fixed 8px contour.
- Preserve accepted address Fluid Wave unchanged. Regression tests cover keyframe budget, stagger and non-overlap. Live FPS validation pending.

## 0.2.0-preview.8

- Bunny Cascade v2: calculate a shared native scale/translate/opacity timeline with collision-aware slot boundaries, a bounded horizontal overshoot and stronger vertical spring. Stagger the visible cards, including the Island Mode title; offscreen cards do not consume stagger slots.
- Preserve current hover slot widths and list translation during hiding; avoid late hover retargets and indicator jumps, and stage the reveal-to-hover handoff. Fade late-arriving cards rather than showing them immediately at handoff.
- Split View uses its original surface throughout, with fixed 8px radius and animated background/outline alpha; remove the temporary pseudo-element.
- Keep accepted Fluid Wave unchanged; regression tests cover gaps, wide cards, stagger and reversal. Visual confirmation pending for OP-008/009/010.

## 0.2.0-preview.7

- Add Bunny Cascade for inline address search: each tab shrinks into its own center as the address edge advances, then springs back (112% overshoot, 160ms) as the edge retreats. Use native WAAPI scale/opacity, no per-frame layout loop.
- Support Expand Mode and Island Mode, including the title island, plus button, active underline, each Split View member and handle; fade the shared split outline separately.
- Preserve tab layout slots while hidden, block hidden tab interactions, reconcile native dismissal and interrupted animation, and cancel animations on unload. Respect reduced motion and disabled animation preference. Keep native floating search, bookmarks, navigation, captions and the accepted address wave unchanged.
- Retain preview.6's optional Zen Refined startup integration. Add timing and reversal tests. Actual visual validation remains pending.

## 0.2.0-preview.5

- Rebuild both inline-address transitions around native Web Animations API interpolation. Keep one final-width layout throughout opening and closing, prepare a continuous rounded wave with height-relative coordinates once, and let Gecko sample the timeline. Use CSS shape() when available, polygon otherwise; retain a script-driven compatibility fallback if the native cascade prevents animation.
- Synchronize horizontal and vertical progress with a smooth shared curve; move the native trailing identity control with the visible right edge. Preserve actual text selection and animate its highlight through a registered CSS property. No per-frame layout reads, width writes or JavaScript clip regeneration on the normal path.
- Add optional address frame-interval diagnostics, including animation engine, median/p95/max rAF interval and layout.frame_rate. These are refresh callback intervals, not presented-frame/GPU measurements. Do not change global refresh-rate preferences.
- Mark OP-006 and OP-007 confirmed fixed by user testing of preview.4. OP-002 remains open until high-refresh behavior is validated; OP-003 requires visual confirmation. Hub stays deferred.

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
