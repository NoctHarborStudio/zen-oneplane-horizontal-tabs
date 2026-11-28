# Adaptive Layout — AL1–AL7

Status: user approved the in-chat Adaptive Layout Lab and architecture. AL1 initial source audit / AL2a pure candidate. Baseline preview.219, b73688ebb472fdd4a6a471f5fbb1a3fcc94d001b. Zen 1.24.2b / Sine 2.3.3. No installed runtime changes.

## Contract and ownership

Keep central Home, at most two physical tab rows, measured width rather than a four-tab or orientation limit. Preserve native identity, atomic Split groups, existing preferences and logical side provenance. Automatic keeps its single plus; Manual keeps both plus controls. In Manual the row containing Home holds a center-out prefix, the other row an outer suffix with plus at the logical outer end even when above Home. This is an extension of the approved mirror contract, not an activation of Manual. Automatic shared lower lane retains native order when Home is above; Manual uses separate lower lanes if both sides overflow, full-width if one does. When Home is below, lower lanes flank Home and top shares the measured interval. OP-023: no Automatic orphan plus-only row; try single-row icon or meaningful Home row, otherwise fail closed. Manual plus-only remains valid under ML1.

- geometry.js.part centerToolbar reads native controls and atomic widths, calls restingToolbarBudget / planAdaptiveTabRows, reclaims address width, calls applyStripPartition, sets dimensions, schedules height/contour and scroll. Compact allocation caps two ordinary slots per side, skips groups, can set hasSecondRow for plus alone. This is a source possibility for OP-023, not proof of the exact laptop cause.
- strip-order.js.part normalizes Auto to three fixed regions, publishes verified committed projection; flat recovery/invalidation remain authoritative. CSS places plus outside lane DOM; Home is not currently a movable projection region. Pure arithmetic alone cannot implement Home transfer.
- Manual ML1–ML3 staged, not installed; coordinate with [Manual Mirror Layout](manual-mirror-layout.md). No side persistence or native search edits. Preserve Elastic Chain single-row acceptance; multi-row is a separate gate.
- Reject a new independent observer/controller, and reject deleting only the four-slot limit while retaining the address reservation and fixed topology. Extend the existing renderer/coordinator and pure contract. Candidate isolated from parallel owner edits; integrate at cutover and remove superseded path.

## AL2a

src/algorithms/responsive-tab-rows.mjs receives measured top/bottom intervals, center, widths, explicit sides, Home/control sizes, gap and previous committed Home row. Output: exact unit/control membership, visual order, row/side, capacity/used width, scrollability, Home row/width, reason and counts, or unavailable. Top uses independent measured halves; bottom enumerates outer suffix sizes using prefix sums and monotone right limit. No DOM, native write, timer or observer. Hysteresis candidate: enter lower Home at two additional fully visible tabs, remain at one, except infeasible upper geometry. Prefer full island; icon only when avoiding unnecessary row or fallback. Actual selection reveal, clipping, address budget and CSS placement are later gates. Thresholds experimental.

Nine fixture bodies PASS in isolated JS before publication; matrix, conservation, side provenance, atomic groups, plus uniqueness, capacity, impossible geometry. Canonical Node/CI and real Zen are separate gates. No runtime/build/version change.

| Stage | Exit |
|---|---|
| AL1 | Source path and contract pinned; complete cross-consumer audit before cutover |
| AL2 | Pure common plan, independent challenge, address budgeting and structural signature integration |
| AL3 | Existing committed projection and renderer, original Home, CSS, controls, height/contour and focus |
| AL4 | Existing Center Motion/Elastic Chain/Workspace/Startup handoff; no animation backlog |
| AL5 | Bunny, Split, hover, address and scroll use committed physical regions; existing gesture leases and replay |
| AL6 | Bounded diagnostics, build/parser/Node CI, adversarial tests and matched performance |
| AL7 | Real Zen resize, portrait/mixed DPI, few/many tabs, OP-023, Home, drag, startup/workspace, reload/disable |

Next: AL2a independent review, address budget and placement signature. No user test before runtime candidate.
