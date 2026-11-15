/* OnePlane — local, reversible Zen layout configuration.
 * Runs only in browser.xhtml via Sine; no network or page access.
 */
// Services and SessionStore are native browser-chrome globals.

const KEY = "zen.oneplane.original-layout";
const CONTROLLER = "__oneplaneLayoutController";
const TARGET = {
  "zen.view.use-single-toolbar": false,
  "zen.tabs.vertical.right-side": false,
  "zen.view.sidebar-expanded": true,
  "zen.view.compact.hide-tabbar": false,
  "zen.view.compact.hide-toolbar": true,
};
const STARTUP = "zen.view.compact.enable-at-startup";
const root = document.documentElement;
const prefs = Services.prefs;
let disposed = false;
let applied = false;
let originalCompact = false;
let closing = false;
let startupObserver = null;
let removeTabStrip = null;

function snapshot() {
  const raw = prefs.getStringPref(KEY, "");
  if (raw) {
    const saved = JSON.parse(raw);
    if (Object.keys({...TARGET, [STARTUP]: true}).every(name =>
      typeof saved[name]?.value === "boolean" && typeof saved[name]?.user === "boolean")) {
      return saved;
    }
    throw new Error("Invalid OnePlane layout backup; refusing to overwrite it.");
  }
  const saved = {};
  for (const name of [...Object.keys(TARGET), STARTUP]) {
    if (prefs.getPrefType(name) !== prefs.PREF_BOOL) {
      throw new Error("Unsupported Zen preference: " + name);
    }
    saved[name] = { value: prefs.getBoolPref(name), user: prefs.prefHasUserValue(name) };
  }
  prefs.setStringPref(KEY, JSON.stringify(saved));
  return saved;
}

function otherActiveWindow() {
  const windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    const other = windows.getNext();
    if (other !== window && !other.closed && other[CONTROLLER]?.active) return true;
  }
  return false;
}

function restorePrefs() {
  const raw = prefs.getStringPref(KEY, "");
  if (!raw) return;
  const saved = JSON.parse(raw);
  for (const name of [...Object.keys(TARGET), STARTUP]) {
    const original = saved[name];
    if (!original || typeof original.value !== "boolean" || typeof original.user !== "boolean") continue;
    // Do not overwrite settings changed by the user while the mod was active.
    const expected = name === STARTUP ? true : TARGET[name];
    if (name !== STARTUP && prefs.getBoolPref(name) !== expected) continue;
    if (original.user) prefs.setBoolPref(name, original.value);
    else prefs.clearUserPref(name);
  }
  prefs.clearUserPref(KEY);
}

function markClosing(event) {
  if (event.target === document) closing = true;
}


// The horizontal strip is a view of native tabs, not a second tab session.
function installTabStrip() {
  const browser = window.gBrowser;
  const target = document.getElementById("nav-bar-customization-target");
  const url = document.getElementById("urlbar-container");
  if (!browser?.tabContainer || !target || url?.parentElement !== target) {
    throw new Error("OnePlane: native toolbar or tabs not available");
  }

  const html = (tag, cls) => {
    const node = document.createElementNS("http://www.w3.org/1999/xhtml", tag);
    if (cls) node.className = cls;
    return node;
  };
  const row = html("div");
  row.id = "oneplane-tabs";
  row.setAttribute("skipintoolbarset", "true");
  row.setAttribute("removable", "false");
  const list = html("div", "oneplane-tab-list");
  list.setAttribute("role", "tablist");
  list.setAttribute("aria-label", "Browser tabs");
  const plus = html("button", "oneplane-new-tab");
  plus.type = "button";
  plus.textContent = "+";
  plus.title = "New tab";
  plus.setAttribute("aria-label", "New tab");
  plus.addEventListener("click", () => {
    const command = document.getElementById("cmd_newNavigatorTab");
    if (typeof command?.doCommand === "function") command.doCommand();
    else window.BrowserCommands?.openTab();
  });
  const indicator = html("div");
  indicator.id = "oneplane-tab-indicator";
  indicator.setAttribute("aria-hidden", "true");
  row.append(list, plus, indicator);


  // Keep native page actions and popup anchors, moving only their actual nodes.
  const actions = document.createXULElement("hbox");
  actions.id = "oneplane-page-actions";
  actions.setAttribute("skipintoolbarset", "true");
  actions.setAttribute("removable", "false");
  actions.setAttribute("align", "center");
  const actionIds = ["translations-button", "zen-site-data-icon-button"];
  const actionHomes = new Map();
  function movePageActions() {
    if (root.hasAttribute("customizing")) return;
    if (actions.parentElement !== target || actions !== target.lastElementChild) {
      target.append(actions);
    }
    for (const id of actionIds) {
      const node = document.getElementById(id);
      if (!node || node.parentElement === actions) continue;
      if (!url.contains(node)) continue;
      const anchor = document.createComment("OnePlane original position: " + id);
      node.before(anchor);
      actionHomes.set(node, anchor);
      if (typeof actions.moveBefore === "function") actions.moveBefore(node, null);
      else actions.append(node);
    }
  }
  function restorePageActions() {
    for (const [node, anchor] of actionHomes) {
      if (anchor.parentNode && node.parentElement === actions) {
        const parent = anchor.parentNode;
        if (typeof parent.moveBefore === "function") parent.moveBefore(node, anchor);
        else parent.insertBefore(node, anchor);
      }
      anchor.remove();
    }
    actionHomes.clear();
    actions.remove();
  }

  // Shield the web content, not the toolbar. Keep it until the complete click
  // has been consumed, even if a native focus handler closes the URL view early.
  const tabbox = document.getElementById("zen-tabbox-wrapper");
  if (!tabbox) throw new Error("OnePlane: native content wrapper not available");
  const shield = html("div");
  shield.id = "oneplane-url-dismiss";
  shield.setAttribute("aria-hidden", "true");
  let shieldPointer = null;
  let shieldTimer = 0;
  function stopInput(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  function releaseShield() {
    shieldPointer = null;
    shield.removeAttribute("data-pressed");
    if (shieldTimer) window.clearTimeout(shieldTimer);
    shieldTimer = 0;
  }
  function dismissUrl() {
    releaseShield();
    if (startAddressClose()) return;
    finishDismissUrl();
  }
  function finishDismissUrl() {
    const bar = window.gURLBar;
    // Restart the hold after the visual closing sequence.
    holdToolbarAfterDismiss();
    try {
      bar?.view?.close();
      bar?.blur();
      browser.selectedBrowser?.focus();
    } finally {
      releaseShield();
    }
  }
  shield.addEventListener("pointerdown", event => {
    stopInput(event);
    shieldPointer = event.pointerId;
    shield.setAttribute("data-pressed", "true");
    holdToolbarAfterDismiss();
    try { shield.setPointerCapture(event.pointerId); } catch {}
  });
  shield.addEventListener("pointerup", event => {
    stopInput(event);
    // Click follows pointerup. Delay fallback for gestures that do not produce one.
    if (shieldPointer === event.pointerId) {
      shieldTimer = window.setTimeout(dismissUrl, 250);
    }
  });
  shield.addEventListener("pointercancel", () => releaseShield());
  for (const type of ["mousedown", "mouseup", "dblclick", "contextmenu", "auxclick", "dragstart"]) {
    shield.addEventListener(type, stopInput);
  }
  shield.addEventListener("click", event => {
    stopInput(event);
    dismissUrl();
  });
  // A native double-click can generate a second independent pointer sequence.
  // Only the first dismissing click is intentionally intercepted.
  const addressInput = () => window.gURLBar?.inputField || document.getElementById("urlbar-input");
  let addressFrame = 0;
  let addressObserver = null;
  let addressAnimationFrame = 0;
  let addressTransition = null;
  let addressWasOpen = false;
  let addressVisual = null;
  const addressEase = t => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

  function addressBar() { return document.getElementById("urlbar"); }
  function nativeInlineOpen(bar) {
    return Boolean(bar && bar.hasAttribute("breakout-extend") &&
      !bar.hasAttribute("zen-floating-urlbar") &&
      (bar.hasAttribute("open") || bar.hasAttribute("focused")));
  }
  function addressMotionEnabled() {
    return hoverSupported() &&
      prefs.getIntPref("zen.oneplane.animation-duration", 160) !== 0 &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function addressWidths() {
    const base = parseFloat(window.getComputedStyle(url).getPropertyValue("--op-url")) || 180;
    return { compact: url.hasAttribute("data-op-empty") ? 0 : base,
      expanded: Math.max(320, Math.min(window.innerWidth * .45, 760)) };
  }
  function clearAddressAnimation() {
    if (addressAnimationFrame) window.cancelAnimationFrame(addressAnimationFrame);
    addressAnimationFrame = 0;
    addressTransition = null;
    addressVisual = null;
    url.removeAttribute("data-op-url-phase");
    const bar = addressBar();
    bar?.removeAttribute("data-op-url-animating");
    bar?.style.removeProperty("--op-url-live-width");
    bar?.style.removeProperty("--op-url-live-clip");
  }
  function drawAddress(width, reveal) {
    const bar = addressBar();
    if (!bar) return;
    addressVisual = { width, reveal };
    // The native popover background includes both the header and results.
    // Animate its real width and clip the results until width is ready.
    bar.setAttribute("data-op-url-animating", "true");
    bar.style.setProperty("--op-url-live-width", Math.max(1, width).toFixed(2) + "px");
    const bounds = bar.getBoundingClientRect();
    const input = bar.querySelector(".urlbar-input-container");
    const view = bar.querySelector(".urlbarView");
    const inputBottom = input?.getBoundingClientRect().bottom || bounds.top + 34;
    const header = Math.max(1, inputBottom - bounds.top + 2);
    const full = Math.max(header, bounds.height,
      (view?.getBoundingClientRect().bottom || bounds.bottom) - bounds.top);
    const visible = header + (full - header) * reveal;
    bar.style.setProperty("--op-url-live-clip",
      "inset(0px 0px " + (bounds.height - visible).toFixed(2) + "px 0px round 8px)");
  }
  function beginAddressPhase(name, from, to, duration) {
    addressTransition = { name, from, to, duration, start: null };
    url.setAttribute("data-op-url-phase", name);
    drawAddress(from.width, from.reveal);
    if (!addressAnimationFrame) addressAnimationFrame = window.requestAnimationFrame(stepAddress);
  }
  function stepAddress(now) {
    addressAnimationFrame = 0;
    const a = addressTransition;
    if (!a || dead) return;
    if (!nativeInlineOpen(addressBar()) || !addressMotionEnabled()) {
      const closing = a.name.startsWith("closing");
      clearAddressAnimation();
      if (closing && nativeInlineOpen(addressBar())) finishDismissUrl();
      return;
    }
    if (a.start === null) a.start = now;
    const t = Math.min(1, (now - a.start) / a.duration);
    const eased = addressEase(t);
    drawAddress(a.from.width + (a.to.width - a.from.width) * eased,
      a.from.reveal + (a.to.reveal - a.from.reveal) * eased);
    if (t < 1) {
      addressAnimationFrame = window.requestAnimationFrame(stepAddress);
      return;
    }
    if (a.name === "opening-width") {
      beginAddressPhase("opening-results", a.to, { width: a.to.width, reveal: 1 }, 220);
    } else if (a.name === "closing-results") {
      beginAddressPhase("closing-width", a.to, { width: addressWidths().compact, reveal: 0 }, 360);
    } else if (a.name === "closing-width") {
      addressTransition = null;
      finishDismissUrl();
      clearAddressAnimation();
      addressWasOpen = false;
    } else {
      clearAddressAnimation();
    }
  }
  function updateAddressAnimation() {
    const bar = addressBar();
    const open = nativeInlineOpen(bar);
    if (!open || !addressMotionEnabled()) {
      if (addressTransition) {
        const closing = addressTransition.name.startsWith("closing");
        clearAddressAnimation();
        if (closing && open) finishDismissUrl();
      }
      addressWasOpen = open;
      return;
    }
    if (addressWasOpen) return;
    addressWasOpen = true;
    const widths = addressWidths();
    // Zen may have already expanded the placeholder before its popover
    // mutation is delivered. Start at the actual compact target, not a
    // potentially fully expanded placeholder.
    beginAddressPhase("opening-width", { width: widths.compact, reveal: 0 },
      { width: widths.expanded, reveal: 0 }, 320);
  }
  function startAddressClose() {
    const bar = addressBar();
    if (!nativeInlineOpen(bar) || !addressMotionEnabled()) return false;
    if (addressTransition?.name.startsWith("closing")) return true;
    holdToolbarAfterDismiss();
    const widths = addressWidths();
    const from = addressVisual || { width: widths.expanded, reveal: 1 };
    if (addressAnimationFrame) window.cancelAnimationFrame(addressAnimationFrame);
    addressAnimationFrame = 0;
    // Reverse an interrupted opening from its current visual position.
    if (from.reveal > .01) {
      beginAddressPhase("closing-results", from,
        { width: from.width, reveal: 0 }, Math.max(80, 200 * from.reveal));
    } else {
      beginAddressPhase("closing-width", from,
        { width: widths.compact, reveal: 0 }, 360);
    }
    return true;
  }
  function onAddressMutation() {
    if (dead) return;
    updateAddressAnimation();
    alignAddressStart();
  }
  function onAddressInput() {
    // Typing or clicking the real input during closing reverses the close.
    if (!addressTransition?.name.startsWith("closing")) return;
    const from = addressVisual || { width: addressWidths().compact, reveal: 0 };
    if (addressAnimationFrame) window.cancelAnimationFrame(addressAnimationFrame);
    addressAnimationFrame = 0;
    const width = addressWidths().expanded;
    if (from.reveal > 0) {
      beginAddressPhase("opening-results", from, { width, reveal: 1 }, 220);
    } else {
      beginAddressPhase("opening-width", from, { width, reveal: 0 }, 320);
    }
  }
  function alignAddressStart() {
    if (addressFrame) return;
    addressFrame = window.requestAnimationFrame(() => {
      addressFrame = 0;
      const bar = document.getElementById("urlbar");
      const input = addressInput();
      updateEmptyAddress();
      if (!bar?.hasAttribute("focused") && !bar?.hasAttribute("open") && input) {
        input.scrollLeft = 0;
      }
    });
  }
  function updateEmptyAddress() {
    const tab = browser.selectedTab;
    const spec = tab?.linkedBrowser?.currentURI?.spec || "";
    const empty = Boolean(tab?.hasAttribute("zen-empty-tab")) ||
      /^(about:(blank|newtab|home|privatebrowsing))(?:[?#].*)?$/i.test(spec);
    url.toggleAttribute("data-op-empty", empty);
  }
  const progressListener = {
    onLocationChange() { updateEmptyAddress(); alignAddressStart(); }
  };
  const actionObserver = new MutationObserver(() => {
    if (!dead) { movePageActions(); alignAddressStart(); }
  });


  // Keep native customizable toolbar items in their original parent. Only
  // insert two flexible spacers and use CSS ordering for the center group.
  const leftSpacer = html("div");
  leftSpacer.id = "oneplane-center-start";
  const rightSpacer = html("div");
  rightSpacer.id = "oneplane-center-end";
  for (const spacer of [leftSpacer, rightSpacer]) {
    spacer.setAttribute("skipintoolbarset", "true");
    spacer.setAttribute("removable", "false");
    spacer.setAttribute("aria-hidden", "true");
  }
  const navbar = document.getElementById("nav-bar");
  const toolbarWrapper = document.getElementById("zen-appcontent-navbar-wrapper");
  const bookmarks = document.getElementById("PersonalToolbar");
  const surface = html("div");
  surface.id = "oneplane-toolbar-surface";
  surface.setAttribute("aria-hidden", "true");
  // A real element, not a native theme pseudo-element. Keep the background
  // behind the controls and above the web surface without receiving input.
  for (const [name, value] of Object.entries({
    position: "absolute", top: "0", left: "0", right: "0",
    "pointer-events": "none", "z-index": "0",
    "background-color": "var(--op-surface-tint, rgba(21, 23, 30, .34))"
  })) surface.style.setProperty(name, value, "important");
  const leftIds = new Set(["sidebar-button", "sidebar-toggle-button", "back-button",
    "forward-button", "stop-reload-button", "reload-button", "home-button", "urlbar-container"]);
  const centerIds = new Set(["oneplane-tabs", "oneplane-center-start", "oneplane-center-end"]);
  let geometryFrame = 0;
  let geometryObserver = null;
  function scheduleGeometry() {
    if (dead || geometryFrame) return;
    geometryFrame = window.requestAnimationFrame(() => {
      geometryFrame = 0;
      if (dead || !root.hasAttribute("oneplane-active") || !toolbarWrapper) return;
      if (window.innerWidth < 900 || root.hasAttribute("customizing")) return;
      const targetRect = target.getBoundingClientRect();
      // Center the collapsed tabs against the WINDOW, not the remaining toolbar.
      // Native window buttons and all left/right controls consume edge space.
      let left = Math.max(0, targetRect.left);
      let right = Math.max(0, window.innerWidth - targetRect.right);
      for (const child of target.children) {
        if (centerIds.has(child.id) || child.localName === "toolbarspring") continue;
        const box = child.getBoundingClientRect();
        if (!box.width) continue;
        const style = window.getComputedStyle(child);
        const extent = box.width + (parseFloat(style.marginLeft) || 0) + (parseFloat(style.marginRight) || 0);
        if (leftIds.has(child.id)) left += extent;
        else right += extent;
      }
      const setLength = (node, name, value) => {
        const next = Math.max(0, Math.round(value)) + "px";
        if (node.style.getPropertyValue(name) !== next) node.style.setProperty(name, next);
      };
      const rowWidth = row.getBoundingClientRect().width;
      const tabWidth = parseFloat(window.getComputedStyle(row).getPropertyValue("--op-tab")) || 36;
      const count = list.children.length;
      const naturalTabsWidth = count ? count * (tabWidth + 3) - 3 : 0;
      // Do not count the new-tab button or the expansion reserve in the center.
      // When space runs out, center only the visible tab viewport as far as possible.
      const collapsedTabsWidth = Math.min(naturalTabsWidth, Math.max(0, rowWidth - tabWidth - 3));
      const trailingReserve = Math.max(0, rowWidth - collapsedTabsWidth);
      const bias = right - left + trailingReserve;
      setLength(leftSpacer, "--op-center-bias", bias);
      setLength(rightSpacer, "--op-center-bias", -bias);
      // Cap leftward expansion at actual free space next to navigation.
      setLength(row, "--op-left-room", leftSpacer.getBoundingClientRect().width - 4);
      // Nebula can constrain the wrapper to a fixed height. Include the
      // actual bookmarks row instead of letting it sit outside the hover area.
      const navHeight = navbar?.getBoundingClientRect().height || 0;
      const bookmarksHeight = bookmarks && !bookmarks.collapsed && !bookmarks.hidden
        ? bookmarks.getBoundingClientRect().height : 0;
      if (navHeight > 0) setLength(toolbarWrapper, "--op-measured-toolbar-height", navHeight + bookmarksHeight);
    });
  }
  function observeGeometry() {
    if (!geometryObserver) return;
    geometryObserver.disconnect();
    for (const element of [target, navbar, toolbarWrapper, bookmarks, ...target.children]) {
      if (element) geometryObserver.observe(element);
    }
    scheduleGeometry();
  }

  // Native Compact Mode may clear its hover flag during a tab expansion or
  // while entering a bookmarks row. Keep the entire visible toolbar interactive.
  let pointerInside = false;
  let hoverObserver = null;
  let modeObserver = null;
  let addressHoldTimer = 0;
  const ADDRESS_DISMISS_HOLD_MS = 2000;

  function releaseAddressHold() {
    if (addressHoldTimer) window.clearTimeout(addressHoldTimer);
    addressHoldTimer = 0;
    toolbarWrapper?.removeAttribute("oneplane-url-hold");
  }
  function holdToolbarAfterDismiss() {
    if (!hoverSupported() || !toolbarWrapper) return;
    releaseAddressHold();
    toolbarWrapper.setAttribute("oneplane-url-hold", "true");
    addressHoldTimer = window.setTimeout(() => {
      addressHoldTimer = 0;
      toolbarWrapper.removeAttribute("oneplane-url-hold");
      // Normal hover/popup state remains authoritative after the hold.
      if (pointerInside) maintainHover();
    }, ADDRESS_DISMISS_HOLD_MS);
  }
  function onWindowDeactivate() {
    clearHover();
    releaseAddressHold();
    clearAddressAnimation();
  }
  function hoverSupported() {
    return !dead && root.hasAttribute("oneplane-active") &&
      root.getAttribute("zen-compact-mode") === "true" &&
      !root.hasAttribute("customizing") && !root.hasAttribute("inDOMFullscreen") &&
      !root.hasAttribute("inFullscreen") && window.innerWidth >= 900;
  }
  function clearHover() {
    pointerInside = false;
    toolbarWrapper?.removeAttribute("oneplane-hover-lock");
  }
  function maintainHover() {
    if (!hoverSupported() || !pointerInside || !toolbarWrapper) return;
    toolbarWrapper.setAttribute("oneplane-hover-lock", "true");
    if (!toolbarWrapper.hasAttribute("zen-has-hover")) {
      const manager = window.gZenCompactModeManager;
      if (typeof manager?._setElementExpandAttribute === "function") {
        manager._setElementExpandAttribute(toolbarWrapper, true);
      }
    }
  }
  function trackPointer(event) {
    if (!hoverSupported() || !toolbarWrapper) { clearHover(); return; }
    const insideTarget = event.composedPath().includes(toolbarWrapper);
    if (!insideTarget && !pointerInside) return;
    const rect = toolbarWrapper.getBoundingClientRect();
    const inside = rect.height > 8 && event.clientX >= rect.left &&
      event.clientX < rect.right && event.clientY >= rect.top && event.clientY < rect.bottom;
    if (!inside) { clearHover(); return; }
    pointerInside = true;
    maintainHover();
  }
  function leaveWindow(event) {
    if (event.relatedTarget === null) clearHover();
  }
  function onCompactChanged() {
    if (!hoverSupported()) { clearHover(); clearTabHover(); releaseAddressHold(); clearAddressAnimation(); addressWasOpen = false; }
    scheduleGeometry();
  }

  const entries = new Map();
  let frame = 0;
  let dead = false;

  // Single hover target; preserve momentum across tabs and short gaps.
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
  let hoverTab = null, hoverX = null, hoverTimer = 0, indicatorFrame = 0;
  let indicatorShown = false, ix = 0, iy = 0, iw = 14, ih = 3, iv = 0, last = 0, until = 0;
  const hoverDelay = () => reducedMotion.matches ? 0 :
    clamp(prefs.getIntPref("zen.oneplane.hover-close-delay", 260), 0, 600);

  function cancelHoverTimer() {
    if (hoverTimer) window.clearTimeout(hoverTimer);
    hoverTimer = 0;
  }
  function indicatorTarget() {
    if (!hoverTab || !list.contains(hoverTab)) return null;
    const a = hoverTab.getBoundingClientRect(), s = row.getBoundingClientRect();
    if (a.width <= 0 || s.width <= 0) return null;
    const center = (a.left + a.right) / 2;
    const bias = hoverX === null ? 0 : clamp((hoverX - center) / Math.max(1, a.width / 2), -1, 1);
    return { x: center - s.left - row.clientLeft + bias * Math.min(12, a.width * .12),
      y: Math.min(s.height - 2, a.bottom - s.top + 2), w: clamp(a.width * .14, 12, 18) };
  }
  function paintIndicator() {
    const tail = clamp(iv * .0035, -5, 5);
    indicator.style.width = iw.toFixed(2) + "px";
    indicator.style.height = ih.toFixed(2) + "px";
    indicator.style.transform = "translate3d(" + (ix - iw / 2 - tail).toFixed(2) +
      "px," + (iy - ih / 2).toFixed(2) + "px,0)";
  }
  function tickIndicator(now) {
    indicatorFrame = 0;
    const p = indicatorTarget();
    if (dead || !p || !indicatorShown) return;
    const dt = last ? clamp((now - last) / 1000, .001, .05) : 1 / 60;
    last = now;
    if (reducedMotion.matches) {
      ix = p.x; iy = p.y; iv = 0; iw = p.w; ih = 3;
    } else {
      const steps = Math.max(1, Math.ceil(dt * 120)), step = dt / steps;
      for (let i = 0; i < steps; i++) {
        iv += (p.x - ix) * 350 * step;
        iv *= Math.exp(-23 * step);
        ix += iv * step;
      }
      const stretch = Math.min(18, Math.abs(iv) * .025);
      const blend = 1 - Math.exp(-24 * dt);
      iw += (p.w + stretch - iw) * blend;
      ih += (3 - stretch * .035 - ih) * blend;
      iy += (p.y - iy) * (1 - Math.exp(-30 * dt));
    }
    paintIndicator();
    if (!reducedMotion.matches && (now < until || Math.abs(ix-p.x) > .08 ||
        Math.abs(iy-p.y) > .08 || Math.abs(iv) > .2 || Math.abs(iw-p.w) > .08 ||
        Math.abs(ih-3) > .04)) {
      indicatorFrame = window.requestAnimationFrame(tickIndicator);
    }
  }
  function scheduleIndicator() {
    if (!hoverTab || !indicatorShown || dead) return;
    until = window.performance.now() + 450;
    if (!indicatorFrame) { last = 0; indicatorFrame = window.requestAnimationFrame(tickIndicator); }
  }
  function selectHover(item, x = null) {
    if (!item || !list.contains(item)) return;
    cancelHoverTimer();
    hoverX = x;
    if (hoverTab !== item) {
      hoverTab?.removeAttribute("data-op-expanded");
      hoverTab = item;
      item.setAttribute("data-op-expanded", "true");
    }
    if (!prefs.getBoolPref("zen.oneplane.tab-indicator", true)) {
      indicatorShown = false;
      indicator.removeAttribute("data-visible");
      if (indicatorFrame) window.cancelAnimationFrame(indicatorFrame);
      indicatorFrame = 0;
      return;
    }
    if (!indicatorShown) {
      const p = indicatorTarget();
      if (p) { ix = p.x; iy = p.y; iw = p.w; ih = 3; iv = 0; paintIndicator(); }
      indicatorShown = true;
      indicator.setAttribute("data-visible", "true");
    }
    scheduleIndicator();
  }
  function clearTabHover() {
    cancelHoverTimer();
    hoverTab?.removeAttribute("data-op-expanded");
    hoverTab = null; hoverX = null;
    indicatorShown = false;
    indicator.removeAttribute("data-visible");
    if (indicatorFrame) window.cancelAnimationFrame(indicatorFrame);
    indicatorFrame = 0; iv = 0; last = 0;
  }
  function queueTabCollapse() {
    if (!hoverTab || hoverTimer) return;
    hoverTimer = window.setTimeout(() => {
      hoverTimer = 0;
      // Keep the plus stationary until the pointer actually leaves it.
      if (plus.matches(":hover") || plus.matches(":active")) return;
      clearTabHover();
    }, hoverDelay());
  }
  function trackTabPointer(event) {
    if (!hoverSupported() || event.pointerType === "touch") return;
    const hit = event.target?.closest?.(".oneplane-tab");
    if (hit && list.contains(hit)) { selectHover(hit, event.clientX); return; }
    if (!hoverTab) return;
    if (event.target === plus || (event.target instanceof Node && plus.contains(event.target))) {
      cancelHoverTimer(); return;
    }
    // Inter-tab gaps are part of the hover session, not departures.
    const a = list.getBoundingClientRect();
    if (event.clientX >= a.left - 3 && event.clientX <= a.right + 3 &&
        event.clientY >= a.top - 2 && event.clientY <= a.bottom + 2) {
      cancelHoverTimer();
      return;
    }
    queueTabCollapse();
  }
  function focusTab(event) {
    const item = event.target?.closest?.(".oneplane-tab");
    if (item && event.target.matches(":focus-visible")) selectHover(item);
  }
  function blurTab(event) {
    if (!row.contains(event.relatedTarget) && !row.matches(":hover")) queueTabCollapse();
  }
  function leaveTabPointer() { queueTabCollapse(); }
  function onNewTabClick() { clearTabHover(); }

  function favicon(tab) {
    const src = tab.querySelector(".tab-icon-image")?.getAttribute("src")
      || tab.getAttribute("image") || "";
    // Only local browser icon resources; never fetch a remote icon directly.
    if (/^(data:image\/|chrome:|resource:|moz-anno:|page-icon:|blob:)/i.test(src)) return src;
    const page = tab.linkedBrowser?.currentURI?.spec || "";
    return /^https?:/i.test(page) ? "page-icon:" + page : "";
  }

  function createEntry(tab) {
    const item = html("div", "oneplane-tab");
    const button = html("button", "oneplane-tab-select");
    button.type = "button";
    button.setAttribute("role", "tab");
    const icon = html("span", "oneplane-tab-icon");
    const img = html("img");
    img.alt = "";
    img.draggable = false;
    img.addEventListener("error", () => { img.hidden = true; });
    icon.append(img);
    const title = html("span", "oneplane-tab-title");
    button.append(icon, title);
    button.addEventListener("click", () => {
      if (!tab.closing) browser.selectedTab = tab;
    });
    item.addEventListener("auxclick", event => {
      if (event.button === 1 && !tab.closing) {
        event.preventDefault();
        browser.removeTab(tab, { animate: true });
      }
    });
    item.append(button);
    return { item, button, title, img, src: null };
  }

  function sync() {
    frame = 0;
    if (dead) return;
    // Respect the current workspace and native visibility.
    const tabs = Array.from(browser.visibleTabs || browser.tabs || []).filter(
      tab => !tab.closing && !tab.hidden && !tab.hasAttribute("zen-empty-tab")
    );
    const count = String(tabs.length);
    if (row.style.getPropertyValue("--op-tab-count") !== count) {
      row.style.setProperty("--op-tab-count", count);
      scheduleGeometry();
    }
    updateEmptyAddress();
    const keep = new Set(tabs);
    for (const [tab, entry] of entries) {
      if (!keep.has(tab)) {
        if (hoverTab === entry.item) clearTabHover();
        entry.item.remove(); entries.delete(tab);
      }
    }
    for (let index = 0; index < tabs.length; index++) {
      const tab = tabs[index];
      let entry = entries.get(tab);
      if (!entry) {
        entry = createEntry(tab);
        entries.set(tab, entry);
      }
      const label = tab.label || tab.getAttribute("label") || "New tab";
      const selected = tab === browser.selectedTab;
      entry.item.toggleAttribute("data-selected", selected);
      entry.item.toggleAttribute("data-pinned", Boolean(tab.pinned));
      entry.item.toggleAttribute("data-busy", tab.hasAttribute("busy"));
      entry.item.toggleAttribute("data-unloaded", !selected && (tab.hasAttribute("pending") || tab.hasAttribute("discarded")));
      entry.item.toggleAttribute("data-audio", tab.hasAttribute("soundplaying"));
      entry.button.setAttribute("aria-selected", String(selected));
      entry.button.setAttribute("aria-label", label);
      if (entry.title.textContent !== label) entry.title.textContent = label;
      const src = favicon(tab);
      if (entry.src !== src) {
        entry.src = src;
        entry.img.hidden = !src;
        if (src) entry.img.setAttribute("src", src);
        else entry.img.removeAttribute("src");
      }
      if (list.children[index] !== entry.item) list.insertBefore(entry.item, list.children[index] || null);
    }
  }

  function schedule() {
    if (!dead && !frame) frame = window.requestAnimationFrame(sync);
  }
  function onSelect() {
    updateEmptyAddress();
    schedule();
    alignAddressStart();
    window.requestAnimationFrame(() => {
      if (!dead) entries.get(browser.selectedTab)?.item.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }
  const events = ["TabOpen", "TabClose", "TabMove", "TabAttrModified", "TabPinned", "TabUnpinned", "TabShow", "TabHide", "TabBrowserInserted", "TabBrowserDiscarded"];
  const tabObserver = new MutationObserver(schedule);
  const workspaceObserver = new MutationObserver(schedule);
  const toolbarObserver = new MutationObserver(() => {
    if (dead || root.hasAttribute("customizing")) return;
    if (url.parentElement === target && row.parentElement !== target) url.after(row);
    if (leftSpacer.parentElement !== target) target.prepend(leftSpacer);
    if (rightSpacer.parentElement !== target) row.after(rightSpacer);
    movePageActions();
    observeGeometry();
  });

  function destroy() {
    if (dead) return;
    dead = true;
    if (frame) window.cancelAnimationFrame(frame);
    tabObserver.disconnect();
    workspaceObserver.disconnect();
    toolbarObserver.disconnect();
    actionObserver.disconnect();
    geometryObserver?.disconnect();
    hoverObserver?.disconnect();
    modeObserver?.disconnect();
    if (geometryFrame) window.cancelAnimationFrame(geometryFrame);
    clearHover();
    releaseAddressHold();
    clearTabHover();
    window.removeEventListener("pointermove", trackTabPointer, true);
    window.removeEventListener("deactivate", clearTabHover);
    row.removeEventListener("pointerleave", leaveTabPointer);
    row.removeEventListener("focusin", focusTab);
    row.removeEventListener("focusout", blurTab);
    plus.removeEventListener("pointerleave", leaveTabPointer);
    plus.removeEventListener("click", onNewTabClick);
    try { browser.removeProgressListener(progressListener); } catch {}
    url.removeAttribute("data-op-empty");
    toolbarWrapper?.style.removeProperty("--op-measured-toolbar-height");
    surface.remove();
    leftSpacer.remove();
    rightSpacer.remove();
    window.removeEventListener("pointermove", trackPointer, true);
    toolbarWrapper?.removeEventListener("pointerover", trackPointer);
    document.documentElement.removeEventListener("mouseleave", leaveWindow);
    window.removeEventListener("deactivate", onWindowDeactivate);
    window.removeEventListener("ZenCompactMode:Toggled", onCompactChanged);
    window.removeEventListener("resize", onCompactChanged);
    addressObserver?.disconnect();
    clearAddressAnimation();
    addressBar()?.removeEventListener("pointerdown", onAddressInput, true);
    addressBar()?.removeEventListener("input", onAddressInput, true);
    if (addressFrame) window.cancelAnimationFrame(addressFrame);
    releaseShield();
    shield.remove();
    url.removeEventListener("focusout", onAddressMutation);
    restorePageActions();
    for (const event of events) browser.tabContainer.removeEventListener(event, schedule);
    browser.tabContainer.removeEventListener("TabSelect", onSelect);
    window.removeEventListener("ZenWorkspaceDataChanged", schedule);
    window.removeEventListener("aftercustomization", schedule);
    row.remove();
    entries.clear();
  }

  try {
    url.after(row);
    target.prepend(leftSpacer);
    row.after(rightSpacer);
    tabbox.append(shield);
    toolbarWrapper?.prepend(surface);
    movePageActions();
    const bar = document.getElementById("urlbar");
    if (bar) {
      addressObserver = new MutationObserver(onAddressMutation);
      bar.addEventListener("pointerdown", onAddressInput, true);
      bar.addEventListener("input", onAddressInput, true);
      addressObserver.observe(bar, { attributes: true, attributeFilter: ["focused", "open", "textoverflow", "pageproxystate", "zen-floating-urlbar", "breakout-extend"] });
    }
    url.addEventListener("focusout", onAddressMutation);
    actionObserver.observe(url, { subtree: true, childList: true });
    alignAddressStart();
    sync();
    try { browser.addProgressListener(progressListener); } catch {}
    window.addEventListener("pointermove", trackTabPointer, true);
    window.addEventListener("deactivate", clearTabHover);
    row.addEventListener("pointerleave", leaveTabPointer);
    row.addEventListener("focusin", focusTab);
    row.addEventListener("focusout", blurTab);
    plus.addEventListener("pointerleave", leaveTabPointer);
    plus.addEventListener("click", onNewTabClick);
    for (const event of events) browser.tabContainer.addEventListener(event, schedule);
    browser.tabContainer.addEventListener("TabSelect", onSelect);
    window.addEventListener("ZenWorkspaceDataChanged", schedule);
    window.addEventListener("aftercustomization", schedule);
    tabObserver.observe(browser.tabContainer, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ["label", "image", "selected", "hidden", "busy", "pinned", "active", "zen-workspace-id", "pending", "discarded", "soundplaying", "zen-empty-tab"]
    });
    const wrapper = document.getElementById("zen-tabs-wrapper");
    if (wrapper && !browser.tabContainer.contains(wrapper)) {
      workspaceObserver.observe(wrapper, { subtree: true, childList: true, attributes: true, attributeFilter: ["active", "hidden"] });
    }
    toolbarObserver.observe(target, { childList: true });
    geometryObserver = new ResizeObserver(scheduleGeometry);
    observeGeometry();
    if (toolbarWrapper) {
      hoverObserver = new MutationObserver(maintainHover);
      hoverObserver.observe(toolbarWrapper, { attributes: true, attributeFilter: ["zen-has-hover"] });
      toolbarWrapper.addEventListener("pointerover", trackPointer);
    }
    modeObserver = new MutationObserver(onCompactChanged);
    modeObserver.observe(root, { attributes: true, attributeFilter: ["zen-compact-mode", "customizing", "inDOMFullscreen", "inFullscreen"] });
    window.addEventListener("pointermove", trackPointer, true);
    document.documentElement.addEventListener("mouseleave", leaveWindow);
    window.addEventListener("deactivate", onWindowDeactivate);
    window.addEventListener("ZenCompactMode:Toggled", onCompactChanged);
    window.addEventListener("resize", onCompactChanged);
    row.setAttribute("data-ready", "true");
  } catch (error) {
    destroy();
    throw error;
  }
  return destroy;
}

function cleanup() {
  if (disposed) return;
  disposed = true;
  root.removeAttribute("oneplane-active");
  removeTabStrip?.();
  removeTabStrip = null;
  if (startupObserver) {
    Services.obs.removeObserver(startupObserver, "browser-delayed-startup-finished");
    startupObserver = null;
  }
  window.removeEventListener("beforeunload", markClosing, true);
  window.removeEventListener("unload", cleanup);
  const wasApplied = applied;
  applied = false;
  if (window[CONTROLLER] === controller) delete window[CONTROLLER];
  if (!wasApplied) return;
  try {
    const manager = window.gZenCompactModeManager;
    if (!closing && manager?.preference === true && !originalCompact) {
      manager.preference = false;
    }
    if (!otherActiveWindow()) restorePrefs();
    if (!closing) window.dispatchEvent(new CustomEvent("ZenCompactMode:LayoutUpdate"));
  } catch (error) {
    console.error("[OnePlane] Could not completely restore layout:", error);
  }
}

const controller = { get active() { return applied && !disposed; }, cleanup };

async function activate() {
  try {
    await window.SessionStore?.promiseAllWindowsRestored;
    await window.gZenWorkspaces?.promiseInitialized;
    if (disposed || window.closed || root.hasAttribute("popup-window")) return;
    const manager = window.gZenCompactModeManager;
    if (!manager || typeof manager.hideToolbar !== "function") {
      throw new Error("Unsupported Zen Compact Mode API.");
    }
    const hadBackup = prefs.prefHasUserValue(KEY);
    const saved = snapshot();
    originalCompact = hadBackup ? saved[STARTUP].value : manager.preference;
    applied = true;
    for (const [name, value] of Object.entries(TARGET)) {
      if (prefs.getBoolPref(name) !== value) prefs.setBoolPref(name, value);
    }
    manager.hideToolbar();
    if (!manager.preference) manager.preference = true;
    removeTabStrip = installTabStrip();
    // Native state changes and animations remain owned by Zen.
    root.setAttribute("oneplane-active", "true");
  } catch (error) {
    console.error("[OnePlane] Layout activation failed:", error);
    cleanup();
  }
}

if (!root.hasAttribute("popup-window") && typeof window.addUnloadListener === "function") {
  window[CONTROLLER]?.cleanup();
  window[CONTROLLER] = controller;
  window.addEventListener("beforeunload", markClosing, true);
  window.addEventListener("unload", cleanup, { once: true });
  window.addUnloadListener(cleanup);
  if (window.gBrowserInit?.delayedStartupFinished) {
    void activate();
  } else {
    startupObserver = subject => {
      if (subject !== window) return;
      Services.obs.removeObserver(startupObserver, "browser-delayed-startup-finished");
      startupObserver = null;
      void activate();
    };
    Services.obs.addObserver(startupObserver, "browser-delayed-startup-finished");
  }
}
