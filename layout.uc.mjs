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
  row.append(list, plus);


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
    const bar = window.gURLBar;
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
  function alignAddressStart() {
    if (addressFrame) return;
    addressFrame = window.requestAnimationFrame(() => {
      addressFrame = 0;
      const bar = document.getElementById("urlbar");
      const input = addressInput();
      if (!bar?.hasAttribute("focused") && !bar?.hasAttribute("open") && input) {
        input.scrollLeft = 0;
      }
    });
  }
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
      if (element && element !== leftSpacer && element !== rightSpacer) geometryObserver.observe(element);
    }
    scheduleGeometry();
  }

  // Native Compact Mode may clear its hover flag during a tab expansion or
  // while entering a bookmarks row. Keep the entire visible toolbar interactive.
  let pointerInside = false;
  let hoverObserver = null;
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
    if (!hoverSupported()) clearHover();
    scheduleGeometry();
  }

  const entries = new Map();
  let frame = 0;
  let dead = false;

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
    const close = html("button", "oneplane-tab-close");
    close.type = "button";
    close.textContent = "×";
    close.title = "Close tab";
    close.setAttribute("aria-label", "Close tab");
    button.addEventListener("click", () => {
      if (!tab.closing) browser.selectedTab = tab;
    });
    close.addEventListener("click", () => {
      if (!tab.closing) browser.removeTab(tab, { animate: true });
    });
    item.addEventListener("auxclick", event => {
      if (event.button === 1 && !tab.closing) {
        event.preventDefault();
        browser.removeTab(tab, { animate: true });
      }
    });
    item.append(button, close);
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
    const keep = new Set(tabs);
    for (const [tab, entry] of entries) {
      if (!keep.has(tab)) { entry.item.remove(); entries.delete(tab); }
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
    if (geometryFrame) window.cancelAnimationFrame(geometryFrame);
    clearHover();
    toolbarWrapper?.style.removeProperty("--op-measured-toolbar-height");
    leftSpacer.remove();
    rightSpacer.remove();
    window.removeEventListener("pointermove", trackPointer, true);
    toolbarWrapper?.removeEventListener("pointerover", trackPointer);
    document.documentElement.removeEventListener("mouseleave", leaveWindow);
    window.removeEventListener("deactivate", clearHover);
    window.removeEventListener("ZenCompactMode:Toggled", onCompactChanged);
    window.removeEventListener("resize", onCompactChanged);
    addressObserver?.disconnect();
    if (addressFrame) window.cancelAnimationFrame(addressFrame);
    releaseShield();
    shield.remove();
    url.removeEventListener("focusout", alignAddressStart);
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
    movePageActions();
    const bar = document.getElementById("urlbar");
    if (bar) {
      addressObserver = new MutationObserver(alignAddressStart);
      addressObserver.observe(bar, { attributes: true, attributeFilter: ["focused", "open", "textoverflow", "pageproxystate"] });
    }
    url.addEventListener("focusout", alignAddressStart);
    actionObserver.observe(url, { subtree: true, childList: true });
    alignAddressStart();
    sync();
    for (const event of events) browser.tabContainer.addEventListener(event, schedule);
    browser.tabContainer.addEventListener("TabSelect", onSelect);
    window.addEventListener("ZenWorkspaceDataChanged", schedule);
    window.addEventListener("aftercustomization", schedule);
    tabObserver.observe(browser.tabContainer, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ["label", "image", "selected", "hidden", "busy", "pinned", "active", "zen-workspace-id", "pending", "discarded", "soundplaying"]
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
    window.addEventListener("pointermove", trackPointer, true);
    document.documentElement.addEventListener("mouseleave", leaveWindow);
    window.addEventListener("deactivate", clearHover);
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
