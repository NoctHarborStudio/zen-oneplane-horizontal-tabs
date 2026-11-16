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
  // Compact Mode is a user-owned setting.
  for (const name of Object.keys(TARGET)) {
    const original = saved[name];
    if (!original || typeof original.value !== "boolean" || typeof original.user !== "boolean") continue;
    // Do not overwrite settings changed by the user while the mod was active.
    const expected = TARGET[name];
    if (prefs.getBoolPref(name) !== expected) continue;
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
  const leftLane = html("div","oneplane-island-lane oneplane-island-left");
  const rightLane = html("div","oneplane-island-lane oneplane-island-right");
  const island = html("div","oneplane-title-island");
  island.setAttribute("aria-hidden","true");
  const islandTitle = html("span","oneplane-island-title");
  island.append(islandTitle);
  row.append(list, plus, indicator, island);
  function stripNodes() {
    return leftLane.parentElement === list ?
      [...leftLane.children,...rightLane.children] : Array.from(list.children);
  }
  function isStripNode(node) {
    return Boolean(node && (node.parentElement === list ||
      node.parentElement === leftLane || node.parentElement === rightLane));
  }
  function compactSlotWidth(node, tabWidth) {
    return node.classList.contains("oneplane-split-group") ?
      22 + node.querySelectorAll(".oneplane-tab").length*(tabWidth+3) : tabWidth;
  }
  function islandBoundary(widths, plusWidth, gap=3) {
    if (widths.length < 2) return widths.length;
    const total=widths.reduce((sum,w)=>sum+w+gap,0);
    let left=0,best=1,score=Infinity;
    for(let i=1;i<widths.length;i++){
      left+=widths[i-1]+gap;
      const diff=Math.abs(left-(total-left+plusWidth));
      if(diff<score){score=diff;best=i;}
    }
    return best;
  }
  function placeStripOrder(order) {
    const useLanes=row.hasAttribute("data-op-show-island");
    // Preserve the native drag source DOM parent. Both lanes stay in
    // place during a drag; only visual slot transforms change.
    if(row.hasAttribute("data-op-dragging")) return;
    if(useLanes){
      if(leftLane.parentElement!==list) list.append(leftLane,rightLane);
      const tabWidth=parseFloat(window.getComputedStyle(row).getPropertyValue("--op-tab"))||36;
      const boundary=islandBoundary(order.map(n=>compactSlotWidth(n,tabWidth)),tabWidth+3);
      for(const [lane,nodes] of [[leftLane,order.slice(0,boundary)],[rightLane,order.slice(boundary)]]){
        for(let i=0;i<nodes.length;i++)
          if(lane.children[i]!==nodes[i]) lane.insertBefore(nodes[i],lane.children[i]||null);
      }
    }else{
      for(let i=0;i<order.length;i++)
        if(list.children[i]!==order[i]) list.insertBefore(order[i],list.children[i]||null);
      leftLane.remove();rightLane.remove();
    }
  }


  // Keep native page actions and popup anchors, moving only their actual nodes.
  const actions = document.createXULElement("hbox");
  actions.id = "oneplane-page-actions";
  actions.setAttribute("skipintoolbarset", "true");
  actions.setAttribute("removable", "false");
  actions.setAttribute("align", "center");
  const actionIds = ["translations-button", "zen-site-data-icon-button", "urlbar-zoom-button"];
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
  let addressCompactWidth = 0;
  let addressAnchor = null;
  const ADDRESS_WAVE_OPEN = 420, ADDRESS_WAVE_CLOSE = 380;
  const ADDRESS_WAVE_SPREAD = .24;
  let addressSettling = false;
  let addressSettleTimer = 0;
  const addressEase = t => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

  function addressBar() { return document.getElementById("urlbar"); }
  function nativeInlineOpen(bar) {
    return Boolean(bar && bar.hasAttribute("breakout-extend") &&
      !bar.hasAttribute("zen-floating-urlbar") &&
      (bar.hasAttribute("open") || bar.hasAttribute("focused")));
  }
  function inlinePopoverPresent(bar) {
    return Boolean(bar && !bar.hasAttribute("zen-floating-urlbar") &&
      (bar.hasAttribute("breakout-extend") || bar.matches(":popover-open")));
  }
  function addressMotionEnabled() {
    return hoverSupported() &&
      prefs.getIntPref("zen.oneplane.animation-duration", 160) !== 0 &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function addressWidths() {
    const base = parseFloat(window.getComputedStyle(url).getPropertyValue("--op-url")) || 180;
    const compact = url.hasAttribute("data-op-empty") ? 0 : (addressCompactWidth || base);
    const bar = addressBar();
    const anchor = url.getBoundingClientRect();
    const left = anchor.left + (addressAnchor?.dx || 0);
    const top = anchor.top + (addressAnchor?.dy || 0);
    url.style.setProperty("--op-url-anchor-left", left.toFixed(2) + "px");
    url.style.setProperty("--op-url-anchor-top", top.toFixed(2) + "px");
    url.style.setProperty("--op-url-header-height", Math.max(24, addressAnchor?.height || anchor.height || 30).toFixed(2) + "px");
    // Zen has several caption containers, including hidden sidebar copies.
    // Prefer the live right-hand group; never cover the minimize button.
    const groups = Array.from(document.querySelectorAll(".titlebar-buttonbox-container"));
    let nativeGroup;
    try { nativeGroup = window.gZenVerticalTabsManager?.actualWindowButtons; } catch {}
    if (nativeGroup && !groups.includes(nativeGroup)) groups.unshift(nativeGroup);
    let right = window.innerWidth;
    for (const group of groups) {
      const box = group.getBoundingClientRect();
      const style = window.getComputedStyle(group);
      if (box.width > 0 && box.height > 0 && box.left > window.innerWidth / 2 &&
          box.right <= window.innerWidth + 2 && style.visibility === "visible" &&
          style.display !== "none" && Number(style.opacity || 1) > 0) {
        right = Math.min(right, box.left);
      }
    }
    const expanded = Math.max(compact, right - Math.max(0, left) - 6);
    url.style.setProperty("--op-url-expanded-width", expanded.toFixed(2) + "px");
    url.style.setProperty("--op-url-compact-width", Math.max(1, compact).toFixed(2) + "px");
    return { compact, expanded };
  }
  function rememberCompactAddress() {
    const bar = addressBar();
    if (!bar || inlinePopoverPresent(bar) ||
        bar.hasAttribute("zen-floating-urlbar") || url.hasAttribute("data-op-empty")) return;
    const box = bar.getBoundingClientRect();
    const anchor = url.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) {
      addressCompactWidth = box.width;
      addressAnchor = { dx: box.left - anchor.left, dy: box.top - anchor.top,
        height: box.height };
      addressWidths();
    }
  }
  function clearAddressAnimation() {
    if (addressAnimationFrame) window.cancelAnimationFrame(addressAnimationFrame);
    addressAnimationFrame = 0;
    addressTransition = null;
    addressVisual = null;
    addressSettling = false;
    if (addressSettleTimer) window.clearTimeout(addressSettleTimer);
    addressSettleTimer = 0;
    url.removeAttribute("data-op-url-phase");
    url.toggleAttribute("data-op-url-ready", nativeInlineOpen(addressBar()));
    root.removeAttribute("oneplane-address-unblur");
    const bar = addressBar();
    bar?.removeAttribute("data-op-url-animating");
    bar?.style.removeProperty("--op-url-live-width");
    bar?.style.removeProperty("--op-url-live-clip");
  }
  function addressWaveDepth(progress,x){
    const t=Math.max(0,Math.min(1,(progress-ADDRESS_WAVE_SPREAD*x)/(1-ADDRESS_WAVE_SPREAD)));
    return t*t*(3-2*t);
  }
  function addressWaveClip(width,height,header,progress,radius=8){
    width=Math.max(1,width);height=Math.max(1,height);
    header=Math.min(height,Math.max(1,header));
    const r=Math.min(radius,width/2,header/2);
    const depth=x=>header+(height-header)*addressWaveDepth(progress,x);
    if(progress<=0 || progress>=1 || height-header<.5){
      const bottom=progress>=1?0:Math.max(0,height-header);
      return "inset(0px 0px "+bottom.toFixed(2)+"px 0px round var(--op-url-radius))";
    }
    const f=n=>n.toFixed(2);
    const left=depth(0),right=depth(1);
    let path="M"+f(r)+" 0 H"+f(width-r)+" Q"+f(width)+" 0 "+f(width)+" "+f(r)+
      " V"+f(right-r)+" Q"+f(width)+" "+f(right)+" "+f(width-r)+" "+f(depth((width-r)/width));
    for(let i=1;i<=24;i++){
      const x=(width-r)-(width-2*r)*i/24;
      path+=" L"+f(x)+" "+f(depth(x/width));
    }
    path+=" Q0 "+f(left)+" 0 "+f(left-r)+" V"+f(r)+" Q0 0 "+f(r)+" 0 Z";
    return 'path("'+path+'")';
  }
  function addressWaveDuration(from,to,full,duration){
    const fraction=Math.max(Math.abs(to.reveal-from.reveal),
      Math.abs(to.width-from.width)/Math.max(1,full.expanded-full.compact));
    return Math.max(80,duration*Math.min(1,fraction));
  }
  function emptyAddressState(explicitEmpty,uri,pending,restoring){
    if(explicitEmpty)return true;
    if(pending||restoring)return false;
    return /^(about:(blank|newtab|home|privatebrowsing))(?:[?#].*)?$/i.test(uri);
  }
  function drawAddress(width, reveal) {
    const bar = addressBar();
    if (!bar) return;
    addressVisual = { width, reveal };
    // The native popover background includes both the header and results.
    // Reveal the actual shared surface with a left-to-right liquid wave
    // while its width grows, instead of waiting for width to finish.
    bar.setAttribute("data-op-url-animating", "true");
    bar.style.setProperty("--op-url-live-width", Math.max(1, width).toFixed(2) + "px");
    const bounds = bar.getBoundingClientRect();
    const input = bar.querySelector(".urlbar-input-container");
    const inputBottom = input?.getBoundingClientRect().bottom || bounds.top + 30;
    const header = Math.max(1, addressAnchor?.height || inputBottom - bounds.top);
    // Clip coordinates belong to the real popover's border box.
    // Never make the wave extend into page content outside that box.
    const full = Math.max(header,bounds.height);
    const radius=parseFloat(window.getComputedStyle(bar).getPropertyValue("--op-url-radius"))||8;
    bar.style.setProperty("--op-url-live-clip",
      addressWaveClip(bounds.width,full,header,reveal,radius));
  }
  function beginAddressPhase(name, from, to, duration) {
    addressTransition = { name, from, to, duration, start: null };
    url.setAttribute("data-op-url-phase", name);
    root.toggleAttribute("oneplane-address-unblur", name.startsWith("closing"));
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
    const elapsed = now - a.start;
    const t = Math.min(1, elapsed / a.duration);
    // Same timeline for both axes. Closing reverses the opening curve;
    // the right side of the result surface retreats before the left.
    const horizontal = a.name === "opening" ? addressEase(t) : 1-addressEase(1-t);
    const vertical = t;
    drawAddress(a.from.width + (a.to.width - a.from.width) * horizontal,
      a.from.reveal + (a.to.reveal - a.from.reveal) * vertical);
    if (t < 1) {
      addressAnimationFrame = window.requestAnimationFrame(stepAddress);
      return;
    }
    if (a.name === "closing-wave") {
      // Native focus and popover-close notifications can arrive separately.
      // Hold the last compact frame until the real popover has closed;
      // otherwise the expanded fallback width flashes for a frame.
      addressTransition = null;
      addressSettling = true;
      url.setAttribute("data-op-url-phase", "settling");
      finishDismissUrl();
      if (!addressSettling) return;
      if (!inlinePopoverPresent(addressBar())) {
        clearAddressAnimation();
        addressWasOpen = false;
      } else {
        addressSettleTimer = window.setTimeout(() => {
          if (dead || !addressSettling) return;
          // Fail open if native closure was blocked, rather than leaving the
          // editor clipped indefinitely.
          clearAddressAnimation();
          addressWasOpen = nativeInlineOpen(addressBar());
        }, 600);
      }
    } else {
      clearAddressAnimation();
    }
  }
  function updateAddressAnimation() {
    const bar = addressBar();
    const open = nativeInlineOpen(bar);
    if (addressSettling) {
      if (!inlinePopoverPresent(bar)) {
        clearAddressAnimation();
        addressWasOpen = false;
      }
      return;
    }
    if (open && !addressTransition) addressWidths();
    if (!open || !addressMotionEnabled()) {
      if (addressTransition) {
        const closing = addressTransition.name.startsWith("closing");
        clearAddressAnimation();
        if (closing && open) finishDismissUrl();
      }
      addressWasOpen = open;
      url.toggleAttribute("data-op-url-ready", open);
      return;
    }
    if (addressWasOpen) return;
    addressWasOpen = true;
    url.removeAttribute("data-op-url-ready");
    const widths = addressWidths();
    // Zen may have already expanded the placeholder before its popover
    // mutation is delivered. Start at the actual compact target, not a
    // potentially fully expanded placeholder.
    beginAddressPhase("opening", { width: widths.compact, reveal: 0 },
      { width: widths.expanded, reveal: 1 }, ADDRESS_WAVE_OPEN);
  }
  function startAddressClose() {
    const bar = addressBar();
    if (!nativeInlineOpen(bar) || !addressMotionEnabled()) return false;
    if (addressSettling || addressTransition?.name.startsWith("closing")) return true;
    holdToolbarAfterDismiss();
    const widths = addressWidths();
    const from = addressVisual || { width: widths.expanded, reveal: 1 };
    if (addressAnimationFrame) window.cancelAnimationFrame(addressAnimationFrame);
    addressAnimationFrame = 0;
    // Reverse an interrupted opening from its current visual position.
    // Shrink the width and the result wave together, in one phase.
    const to={width:widths.compact,reveal:0};
    beginAddressPhase("closing-wave",from,to,addressWaveDuration(from,to,widths,ADDRESS_WAVE_CLOSE));
    return true;
  }
  function onAddressMutation() {
    if (dead) return;
    updateAddressAnimation();
    alignAddressStart();
  }
  function onAddressInput() {
    // Typing or clicking the real input during closing reverses the close.
    if (!addressSettling && !addressTransition?.name.startsWith("closing")) {
      rememberCompactAddress();
      return;
    }
    const from = addressVisual || { width: addressWidths().compact, reveal: 0 };
    addressSettling = false;
    if (addressSettleTimer) window.clearTimeout(addressSettleTimer);
    addressSettleTimer = 0;
    if (addressAnimationFrame) window.cancelAnimationFrame(addressAnimationFrame);
    addressAnimationFrame = 0;
    const widths=addressWidths(),to={width:widths.expanded,reveal:1};
    beginAddressPhase("opening",from,to,addressWaveDuration(from,to,widths,ADDRESS_WAVE_OPEN));
  }
  function alignAddressStart() {
    if (addressFrame) return;
    addressFrame = window.requestAnimationFrame(() => {
      addressFrame = 0;
      const bar = document.getElementById("urlbar");
      const input = addressInput();
      updateEmptyAddress();
      rememberCompactAddress();
      if (!bar?.hasAttribute("focused") && !bar?.hasAttribute("open") && input) {
        input.scrollLeft = 0;
      }
    });
  }
  let restoringAddressTab=null, restoringAddressUntil=0, restoringAddressTimer=0;
  function guardRestoredAddress(tab){
    if(!tab || tab.hasAttribute("zen-empty-tab"))return;
    const mirrored=entries.get(tab)?.item;
    if(!tab.hasAttribute("pending")&&!tab.hasAttribute("discarded")&&
       !mirrored?.hasAttribute("data-op-unloaded"))return;
    restoringAddressTab=tab;
    restoringAddressUntil=window.performance.now()+1500;
    if(restoringAddressTimer)window.clearTimeout(restoringAddressTimer);
    restoringAddressTimer=window.setTimeout(()=>{
      restoringAddressTimer=0;
      restoringAddressTab=null;
      if(dead)return;
      updateEmptyAddress();
      scheduleGeometry();
    },1501);
  }
  function updateEmptyAddress() {
    const tab = browser.selectedTab;
    const spec = tab?.linkedBrowser?.currentURI?.spec || "";
    const pending=Boolean(tab?.hasAttribute("pending")||tab?.hasAttribute("discarded"));
    const restoring=tab===restoringAddressTab && window.performance.now()<restoringAddressUntil;
    const empty=emptyAddressState(Boolean(tab?.hasAttribute("zen-empty-tab")),spec,pending,restoring);
    url.toggleAttribute("data-op-empty",empty);
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
  // Unified Contour: composite the solid silhouette and vertical ramp
  // into ONE alpha mask. Applying opacity to their union prevents the
  // gradient from darkening the already translucent bookmark shelf.
  let captionHome=null, captionNode=null;
  function ensureWindowCaptions(){
    const toolbox=document.getElementById("navigator-toolbox");
    let node;
    try{node=window.gZenVerticalTabsManager?.actualWindowButtons;}catch{}
    if(!navbar||!node||!toolbox?.contains(node))return;
    captionHome?.remove();
    captionHome=document.createComment("OnePlane native captions");
    node.before(captionHome);
    captionNode=node;
    if(typeof navbar.moveBefore==="function")navbar.moveBefore(node,null);
    else navbar.append(node);
  }
  function restoreWindowCaptions(){
    if(captionHome?.parentNode && captionNode?.parentNode===navbar){
      const parent=captionHome.parentNode;
      if(typeof parent.moveBefore==="function")parent.moveBefore(captionNode,captionHome);
      else parent.insertBefore(captionNode,captionHome);
    }
    captionHome?.remove();
    captionHome=captionNode=null;
  }
  const contourDefaults={transparency:4,strength:100,length:69,hold:30,curve:65,radius:24,padding:0};
  const contourPrefPrefix="zen.oneplane.fade-";
  let contourFrame=0, contourUntil=0, contourKey="";
  let contourResize=null, contourObserver=null;
  const contourObserved=new Set();
  function contourSettings(){
    const read=(name,min,max)=>Math.max(min,Math.min(max,
      prefs.getIntPref(contourPrefPrefix+name,contourDefaults[name])));
    const length=read("length",10,160);
    return {transparency:read("transparency",0,40),strength:read("strength",0,100),
      length,hold:Math.min(length-1,read("hold",0,45)),curve:read("curve",25,300),
      radius:read("radius",4,24),padding:read("padding",0,20)};
  }
  const contourPreferenceObserver={observe(){scheduleContour();}};
  function contourPath(width,base,deep,left,right,radius){
    const r=Math.max(0,Math.min(radius,(deep-base)/2));
    const outside=radius+4;
    if(!r || left===null || right===null)
      return "M"+(-outside)+" "+base+"H"+(width+outside);
    const start=Math.min(-outside,left-2*r-outside);
    const end=Math.max(width+outside,right+2*r+outside);
    return "M"+start+" "+base+"H"+(left-2*r)+
      " A"+r+" "+r+" 0 0 1 "+(left-r)+" "+(base+r)+
      " V"+(deep-r)+" A"+r+" "+r+" 0 0 0 "+left+" "+deep+
      " H"+right+" A"+r+" "+r+" 0 0 0 "+(right+r)+" "+(deep-r)+
      " V"+(base+r)+" A"+r+" "+r+" 0 0 1 "+(right+2*r)+" "+base+
      " H"+end;
  }
  function contourAlpha(distance,settings){
    const t=Math.max(0,Math.min(1,(distance-settings.hold)/(settings.length-settings.hold)));
    return settings.strength/100*Math.pow(Math.max(0,1-t*t*(3-2*t)),settings.curve/100);
  }
  function contourImage(width,height,base,deep,left,right,settings){
    const edge=contourPath(width,base,deep,left,right,settings.radius);
    const startX=Number(edge.match(/^M(-?[\d.]+)/)[1]);
    const steps=64;
    const positions=Array.from({length:steps+1},(_,i)=>settings.length*i/steps);
    positions.push(settings.hold);
    positions.sort((a,b)=>a-b);
    const stops=positions.map(y=>'<stop offset="'+(y/settings.length).toFixed(6)+
      '" stop-color="black" stop-opacity="'+contourAlpha(y,settings).toFixed(6)+'"/>').join("");
    // Both shapes are opaque/partially opaque INSIDE the group. The
    // group itself gets the requested opacity exactly once. Thus the
    // silhouette is always the maximum alpha, never a sum of two tints.
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'">'+
      '<defs><linearGradient id="fade" gradientUnits="userSpaceOnUse" x1="0" y1="'+base+'" x2="0" y2="'+(base+settings.length)+'">'+stops+'</linearGradient></defs>'+
      '<g opacity="'+(1-settings.transparency/100)+'"><rect x="0" y="'+base+'" width="'+width+'" height="'+settings.length+'" fill="url(#fade)"/>'+
      '<path fill="black" d="'+edge+'V-100H'+startX+'Z"/></g></svg>';
    return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';
  }
  function contourCandidates(){
    if(!bookmarks)return [];
    const items=document.getElementById("PlacesToolbarItems");
    const result=items?Array.from(items.children):[];
    const chevron=document.getElementById("PlacesChevron");
    if(chevron && bookmarks.contains(chevron))result.push(chevron);
    // Also cover native toolbar controls (e.g. Other Bookmarks) that
    // are placed beside the Places strip, not inside it.
    for(const node of bookmarks.querySelectorAll("toolbarbutton.bookmark-item, #OtherBookmarks")){
      if(!items?.contains(node) && !result.includes(node))result.push(node);
    }
    return result;
  }
  function observeContourNodes(){
    if(!contourResize)return;
    const wanted=new Set(contourCandidates());
    for(const node of contourObserved)if(!wanted.has(node)){
      contourResize.unobserve(node);contourObserved.delete(node);
    }
    for(const node of wanted)if(!contourObserved.has(node)){
      contourResize.observe(node);contourObserved.add(node);
    }
  }
  function paintContour(){
    if(dead||!toolbarWrapper||!hoverSupported())return;
    // A switch can briefly hide or resize native bookmark controls.
    // Retain the last valid mask until the native layout settles.
    if(contourKey && window.performance.now()<panelSwitchUntil)return;
    const wrapper=toolbarWrapper.getBoundingClientRect();
    const nav=navbar?.getBoundingClientRect();
    if(wrapper.width<=0||!nav||nav.height<=0)return;
    // The mask and controls share panel travel. Measure the unshifted
    // geometry, otherwise an in-flight reveal would distort the shelf.
    const container=document.getElementById("zen-appcontent-navbar-container");
    const translation=container?window.getComputedStyle(container).translate:"none";
    const shiftY=translation&&translation!=="none"?(parseFloat(translation.split(/\s+/)[1])||0):0;
    const width=Math.max(1,Math.round(wrapper.width));
    const settings=contourSettings();
    // Keep the top short. Include the bottom of the actual tab row
    // (including its reserved hover room), not the bookmarks row.
    const base=Math.max(1,Math.round(Math.max(nav.bottom,row.getBoundingClientRect().bottom)-wrapper.top-shiftY-5));
    let left=null,right=null,deep=base;
    if(bookmarks && !bookmarks.hidden && !bookmarks.collapsed){
      const style=window.getComputedStyle(bookmarks);
      const bm=bookmarks.getBoundingClientRect();
      if(style.display!=="none" && style.visibility==="visible" && bm.height>1){
        for(const node of contourCandidates()){
          if(node.hidden||node.collapsed||node.getAttribute("hidden")==="true"||
            node.getAttribute("collapsed")==="true")continue;
          const s=window.getComputedStyle(node);
          if(s.display==="none"||s.visibility!=="visible"||Number(s.opacity)===0)continue;
          const b=node.getBoundingClientRect();
          if(b.width<1||b.height<1||b.right<=bm.left||b.left>=bm.right||
            b.bottom<=bm.top||b.top>=bm.bottom)continue;
          const l=Math.max(0,b.left-wrapper.left,bm.left-wrapper.left);
          const r=Math.min(width,b.right-wrapper.left,bm.right-wrapper.left);
          if(r<=l)continue;
          left=left===null?l:Math.min(left,l);
          right=right===null?r:Math.max(right,r);
          deep=Math.max(deep,b.bottom-wrapper.top-shiftY+settings.padding);
        }
      }
    }
    // Only visible items contribute. A full bookmark row naturally
    // extends its lower contour beyond the window instead of folding
    // the shoulders back through the edge bookmarks.
    if(left!==null){
      left=Math.floor(left-settings.padding);
      right=Math.ceil(right+settings.padding);
      deep=Math.ceil(deep);
      if(deep<=base){left=right=null;deep=base;}
    }
    // The fade begins at the bottom of the TOP row, not the window
    // top or bookmark shelf. Only the rear ramp extends below that row.
    const height=Math.max(1,Math.ceil(Math.max(deep,base+settings.length)+1));
    const key=[width,height,base,deep,left,right,...Object.values(settings)].join(":");
    if(key===contourKey)return;
    contourKey=key;
    surface.style.setProperty("--op-contour-height",height+"px");
    surface.style.setProperty("--op-contour-mask",contourImage(width,height,base,deep,left,right,settings));
  }
  function stepContour(now){
    contourFrame=0;
    if(dead)return;
    paintContour();
    if(now<contourUntil && hoverSupported())contourFrame=window.requestAnimationFrame(stepContour);
  }
  function scheduleContour(){
    if(!dead&&!contourFrame)contourFrame=window.requestAnimationFrame(stepContour);
  }
  function onContourTransition(event){
    if(!contourObserved.has(event.target))return;
    if(!/^(margin|width|height|scale|translate|transform|padding)/.test(event.propertyName||""))return;
    // Magnetic Bookmarks can move through CSS transforms without a
    // resize notification. Follow only while its short transition runs.
    contourUntil=window.performance.now()+360;
    scheduleContour();
  }
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
      if(toolbarWrapper.style.getPropertyValue("--op-measured-toolbar-height") &&
         window.performance.now()<panelSwitchUntil)return;
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
      const count = Number(row.style.getPropertyValue("--op-tab-count")) || 0;
      const groupOverhead = Number(row.style.getPropertyValue("--op-split-count")) * 25 || 0;
      const naturalTabsWidth = count ? count * (tabWidth + 3) - 3 + groupOverhead : 0;
      // Do not count the new-tab button or the expansion reserve in the center.
      // When space runs out, center only the visible tab viewport as far as possible.
      const collapsedTabsWidth = Math.min(naturalTabsWidth, Math.max(0, rowWidth - tabWidth - 3));
      const trailingReserve = Math.max(0, rowWidth - collapsedTabsWidth);
      // In Island Mode the row has symmetric halves around the fixed
      // center. Neither the hovered title nor the scroll positions affect it.
      const wantsIsland = row.hasAttribute("data-op-show-island");
      const available = Math.max(0,2*Math.min(window.innerWidth/2-left,window.innerWidth/2-right)-8);
      const minIslandRoom = 100+2*(tabWidth+9);
      const tight = wantsIsland && available < minIslandRoom;
      row.toggleAttribute("data-op-island-tight",tight);
      const centered = wantsIsland && !tight;
      if (centered) {
        const titleWidth=Math.max(100,Math.min(180,available-2*(tabWidth+9)));
        const laneWidth=lane=>Array.from(lane.children).reduce((sum,n)=>sum+compactSlotWidth(n,tabWidth)+3,6);
        const half=Math.max(laneWidth(leftLane),laneWidth(rightLane)+tabWidth+3,tabWidth+9);
        setLength(row,"--op-island-width",titleWidth);
        setLength(row,"--op-island-row-width",Math.min(available,titleWidth+6+2*half));
      }
      const bias = right - left + (centered ? 0 : trailingReserve);
      setLength(leftSpacer, "--op-center-bias", bias);
      setLength(rightSpacer, "--op-center-bias", -bias);
      // Cap leftward expansion at actual free space next to navigation.
      setLength(row, "--op-left-room", leftSpacer.getBoundingClientRect().width - 4);
      // Nebula can constrain the wrapper to a fixed height. Include the
      // actual bookmarks row instead of letting it sit outside the hover area.
      const navHeight = Math.max(navbar?.getBoundingClientRect().height || 0,
        row.getBoundingClientRect().height || 0);
      const bookmarksHeight = bookmarks && !bookmarks.collapsed && !bookmarks.hidden
        ? bookmarks.getBoundingClientRect().height : 0;
      if (navHeight > 0) setLength(toolbarWrapper, "--op-measured-toolbar-height", navHeight + bookmarksHeight);
      refreshIndicator();
      scheduleContour();
    });
  }
  function observeGeometry() {
    if (!geometryObserver) return;
    geometryObserver.disconnect();
    // The wrapper's height is animated; observing it would trigger a
    // geometry/mask pass every frame of reveal. Observe real rows only.
    for (const element of [target, navbar, bookmarks, ...target.children]) {
      if (element) geometryObserver.observe(element);
    }
    scheduleGeometry();
  }

  // Native Compact Mode may clear its hover flag during a tab expansion or
  // while entering a bookmarks row. Keep the entire visible toolbar interactive.
  let pointerInside = false;
  let panelTimer=0, panelSwitchTimer=0, panelSwitchUntil=0, panelCloseSince=null;
  let panelLastPointer=null;
  const PANEL_NATIVE_FLAGS=["zen-has-hover","has-popup-menu","zen-compact-mode-active"];
  const PANEL_HOLD_FLAGS=["oneplane-url-hold","oneplane-drag-hold"];
  const PANEL_SWITCH_GRACE=180, PANEL_CLOSE_GRACE=100;
  // One visual state for the wrapper, tint and controls. Native flags
  // can disappear/reappear during a native tab selection transaction.
  function panelDecision(open,direct,native,now,switchUntil,closeSince){
    if(direct)return {open:true,wait:0,closeSince:null};
    if(native){
      if(!open && now<switchUntil)return {open:false,wait:switchUntil-now,closeSince:null};
      return {open:true,wait:0,closeSince:null};
    }
    if(!open)return {open:false,wait:0,closeSince:null};
    const since=closeSince??now;
    const until=Math.max(since+PANEL_CLOSE_GRACE,switchUntil);
    return now<until?{open:true,wait:until-now,closeSince:since}:{open:false,wait:0,closeSince:null};
  }
  function reconcilePanel(){
    if(panelTimer)window.clearTimeout(panelTimer);
    panelTimer=0;
    if(!toolbarWrapper)return;
    if(!hoverSupported()){
      toolbarWrapper.removeAttribute("data-op-panel-open");
      panelCloseSince=null;
      return;
    }
    if(!compactLayout()){
      panelCloseSince=null;
      toolbarWrapper.setAttribute("data-op-panel-open","true");
      return;
    }
    const open=toolbarWrapper.hasAttribute("data-op-panel-open");
    const direct=pointerInside||PANEL_HOLD_FLAGS.some(a=>toolbarWrapper.hasAttribute(a));
    const native=PANEL_NATIVE_FLAGS.some(a=>toolbarWrapper.hasAttribute(a));
    const state=panelDecision(open,direct,native,window.performance.now(),panelSwitchUntil,panelCloseSince);
    panelCloseSince=state.closeSince;
    if(open!==state.open){
      toolbarWrapper.toggleAttribute("data-op-panel-open",state.open);
      if(state.open)scheduleContour();
      else clearTabHover();
    }
    if(state.wait>0)panelTimer=window.setTimeout(reconcilePanel,Math.ceil(state.wait)+1);
  }
  function guardPanelSwitch(){
    if(!hoverSupported())return;
    panelSwitchUntil=window.performance.now()+PANEL_SWITCH_GRACE;
    if(panelSwitchTimer)window.clearTimeout(panelSwitchTimer);
    panelSwitchTimer=window.setTimeout(()=>{
      panelSwitchTimer=0;
      reconcilePanel();
      scheduleGeometry();
      scheduleContour();
    },PANEL_SWITCH_GRACE+1);
    reconcilePanel();
  }
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
  function compactLayout(){
    return root.getAttribute("zen-compact-mode")==="true";
  }
  function hoverSupported() {
    return !dead && root.hasAttribute("oneplane-active") &&
      !root.hasAttribute("customizing") && root.getAttribute("inDOMFullscreen")!=="true" &&
      root.getAttribute("inFullscreen")!=="true" && !root.hasAttribute("popup-window") &&
      window.innerWidth >= 900;
  }
  function clearHover() {
    pointerInside = false;
    toolbarWrapper?.removeAttribute("oneplane-hover-lock");
    reconcilePanel();
  }
  function maintainHover() {
    if (!hoverSupported() || !pointerInside || !toolbarWrapper) return;
    toolbarWrapper.setAttribute("oneplane-hover-lock", "true");
    reconcilePanel();
  }
  function trackPointer(event) {
    if (!hoverSupported() || !toolbarWrapper) { clearHover(); return; }
    if(event.pointerType==="touch")return;
    const point={x:event.clientX,y:event.clientY};
    const moved=!panelLastPointer || Math.hypot(point.x-panelLastPointer.x,point.y-panelLastPointer.y)>=1;
    panelLastPointer=point;
    // Gecko can synthesize hover retargets when a tab changes layout
    // under a stationary pointer. They must not open/close the panel.
    if(!moved && window.performance.now()<panelSwitchUntil)return;
    const rect=toolbarWrapper.getBoundingClientRect();
    const open=toolbarWrapper.hasAttribute("data-op-panel-open");
    const measured=parseFloat(toolbarWrapper.style.getPropertyValue("--op-measured-toolbar-height"))||0;
    const height=open?Math.max(rect.height,measured):Math.max(2,Math.min(rect.height,8));
    const inside=point.x>=rect.left && point.x<rect.right &&
      point.y>=rect.top && point.y<rect.top+height;
    if(!inside){if(pointerInside)clearHover();return;}
    // Ignore synthetic enter events from descendants outside the
    // collapsed native hit strip; actual motion/edge hover can reopen.
    if(!open&&!moved&&!pointerInside)return;
    pointerInside=true;
    maintainHover();
  }
  function leaveWindow(event) {
    if (event.relatedTarget === null) {panelLastPointer=null;clearHover();}
  }
  function onCompactChanged() {
    if(hoverSupported())ensureWindowCaptions();
    else restoreWindowCaptions();
    if (!hoverSupported()) { clearHover(); clearTabHover(); releaseAddressHold(); clearAddressAnimation(); addressWasOpen = false; }
    else if (nativeInlineOpen(addressBar()) && !addressTransition && !addressSettling) addressWidths();
    reconcilePanel();
    scheduleGeometry();
  }

  const entries = new Map();
  const splitEntries = new Map();
  function measureSplitGroup(group) {
    const entry = splitEntries.get(group);
    if (!entry || !entry.box.isConnected) return;
    const members = Array.from(entry.box.children).filter(node => node.classList.contains("oneplane-tab"));
    const gap = 3;
    const widths = members.reduce((total, node) => {
      const style = window.getComputedStyle(node);
      // Hover scale is purely visual and must not change group layout.
      return total + node.offsetWidth + (parseFloat(style.marginInlineEnd) || 0);
    }, 0);
    const width = 22 + widths + gap * members.length;
    const next = Math.max(0,width).toFixed(2) + "px";
    if (entry.box.style.getPropertyValue("--op-split-measured") !== next)
      entry.box.style.setProperty("--op-split-measured", next);
  }
  const splitMeasureObserver = new ResizeObserver(records => {
    const groups = new Set();
    for (const {target: node} of records) {
      const tab = tabFromItem(node);
      const group = splitGroup(tab);
      if (group) groups.add(group);
    }
    for (const group of groups) measureSplitGroup(group);
  });
  const splitColors = new WeakMap();
  const splitPalette = ["#8eafff", "#74d6b6", "#d6a5ff", "#efba78", "#ed8fa9"];
  let nextSplitColor = 0;
  let frame = 0;
  let dead = false;
  // Only OnePlane's chrome UI accepts this custom flavor. Do not advertise
  // Firefox's native tab drag flavor without its private drag bookkeeping.
  const DRAG_TYPE = "application/x-oneplane-native-tab";
  const DRAG_CONTROLLER = "__oneplaneTabDrag";
  let draggedTab = null;
  let draggedGroup = null;
  let dragNode = null, dragImageMode = null, dragGrabRatio = .5, dragGrabY = .5;
  const PULL_DISTANCE = 37, REORDER_BUFFER = 8;
  let dragGhost = null, dragGhostBody = null, dragPull = 0, dragEdge = 0, dragWidth = 0;
  let dragGhostAnimation = null;
  let dragLastPoint = null;
  let dragReentry = false, dragInsertAnimation = null, dragInsertNode = null;
  let groupPullLayout = null;
  let pointerSearch = null, dragSearch = null, restoreSearchTimer = 0;
  const blankDragImage = html("canvas");
  blankDragImage.width = blankDragImage.height = 1;
  let dragHandled = false;
  let dragStartPoint = null;
  let dropMarker = null;
  let dragRevealTimer = 0;
  let liveDragTarget = null;
  let dragCommitFrame = 0;
  const dragShifted = new Set();
  const splitZone = html("div");
  splitZone.id = "oneplane-split-drop";
  splitZone.setAttribute("aria-hidden", "true");
  const splitPreview = html("div", "oneplane-split-preview");
  splitZone.append(splitPreview);

  function privateState(win) {
    try {
      return ChromeUtils.importESModule("resource://gre/modules/PrivateBrowsingUtils.sys.mjs")
        .PrivateBrowsingUtils.isWindowPrivate(win);
    } catch { return null; }
  }
  function tabOwner(tab) { return tab?.ownerDocument?.defaultView || null; }
  function validNativeTab(tab) {
    const owner = tabOwner(tab);
    return Boolean(owner?.gBrowser && !owner.closed && !tab.closing &&
      Array.from(owner.gBrowser.tabs).includes(tab));
  }
  function readDraggedTab(event) {
    const dt = event.dataTransfer;
    if (!dt || !Array.from(dt.types || []).includes(DRAG_TYPE)) return null;
    try {
      let tab = null;
      try { tab = dt.mozGetDataAt(DRAG_TYPE, 0); } catch {}
      // Some dragover events expose types but not data until drop. During
      // that protected phase, resolve only an active chrome drag controller.
      if (!tab && event.type === "dragover" && event.isTrusted) {
        const windows = Services.wm.getEnumerator("navigator:browser");
        while (windows.hasMoreElements()) {
          const candidate = windows.getNext()?.[DRAG_CONTROLLER]?.source();
          if (candidate && validNativeTab(candidate)) { tab = candidate; break; }
        }
      }
      const owner = tabOwner(tab);
      if (!validNativeTab(tab) || owner?.[DRAG_CONTROLLER]?.source() !== tab) return null;
      // Moving the native group as a unit is supported within one window.
      // Individual members can still be adopted by another window.
      if (owner !== window && owner?.[DRAG_CONTROLLER]?.group()) return null;
      const ours = privateState(window), theirs = privateState(owner);
      if (owner !== window && (ours === null || theirs === null || ours !== theirs)) return null;
      return tab;
    } catch { return null; }
  }
  function splitGroup(tab) {
    const group = tab?.group;
    return group?.hasAttribute("split-view-group") ? group : null;
  }
  function isSplit(tab) { return Boolean(tab?.splitView || tab?.hasAttribute("split-view") || splitGroup(tab)); }
  function unsplitTab(tab) {
    const owner = tabOwner(tab);
    if (!isSplit(tab)) return true;
    const splitter = owner?.gZenViewSplitter;
    if (typeof splitter?.removeTabFromGroup !== "function") return false;
    splitter.removeTabFromGroup(tab, undefined, { forUnsplit: true });
    return !isSplit(tab);
  }
  function tabFromItem(item) {
    for (const [tab, entry] of entries) if (entry.item === item) return tab;
    return null;
  }
  function groupMembers(group) {
    return Array.from(group?.tabs || []).filter(validNativeTab);
  }
  function dropTarget(event) {
    const children = stripNodes();
    if (!children.length) return null;
    let element = event.target?.closest?.(".oneplane-split-group, .oneplane-tab");
    // The entire group is atomic for strip drops, including its internal tabs.
    element = element?.closest?.(".oneplane-split-group") || element;
    if (!isStripNode(element)) {
      element = children.find(child => event.clientX < child.getBoundingClientRect().right) || children.at(-1);
    }
    const box = element.getBoundingClientRect();
    const group = [...splitEntries].find(([, entry]) => entry.box === element)?.[0];
    const tab = group ? null : tabFromItem(element);
    const before = event.clientX < (box.left + box.right) / 2;
    return { element, native: group || tab, group, tab, before };
  }
  // Keep native drag-and-drop alive: do not move/remove the source DOM node
  // until drop. Visually reorder its slot and animate the other slots instead.
  function unshiftedRect(node) {
    const rect = node.getBoundingClientRect();
    let x = 0;
    try {
      const transform = window.getComputedStyle(node).transform;
      if (transform && transform !== "none") x = new DOMMatrixReadOnly(transform).m41;
    } catch {}
    // CSS individual scale can be animated during reinsertion; do not use
    // the painted width as the slot width or the reorder thresholds drift.
    const width = node.offsetWidth;
    const center = (rect.left + rect.right)/2 - x;
    return { left: center-width/2, right: center+width/2, width };
  }
  function dragSlotIndex(slots, x) {
    const midpoint = slot => (slot.rect.left + slot.rect.right) / 2;
    // Keep the current insertion boundary until the pointer crosses an
    // additional 8 CSS pixels. Do not chase the animated neighbors.
    const old = slots.findIndex(slot => nativeSlot(slot.node).native === liveDragTarget?.native);
    if (old >= 0) {
      let i = old + (liveDragTarget.before ? 0 : 1);
      while (i < slots.length && x > midpoint(slots[i]) + REORDER_BUFFER) i++;
      while (i > 0 && x < midpoint(slots[i - 1]) - REORDER_BUFFER) i--;
      return i;
    }
    return slots.findIndex(slot => x < midpoint(slot));
  }
  function nativeSlot(node) {
    const group = [...splitEntries].find(([, entry]) => entry.box === node)?.[0];
    const tab = group ? null : tabFromItem(node);
    return { element: node, native: group || tab, group, tab };
  }
  function clearLiveDrag() {
    liveDragTarget = null;
    for (const node of dragShifted) {
      node.style.removeProperty("--op-drag-x");
      node.removeAttribute("data-op-drag-follow");
    }
    dragShifted.clear();
    row.removeAttribute("data-op-live-drag");
    if(row.hasAttribute("data-op-island-incoming")){
      row.removeAttribute("data-op-island-incoming");
      scheduleGeometry();
    }
    row.style.removeProperty("--op-drag-incoming");
  }
  function finishStripCommit() {
    // The visual slots already occupy their destination. Apply the native
    // order and remove transforms together, without a second transition.
    clearLiveDrag();
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    sync();
    if (dragCommitFrame) window.cancelAnimationFrame(dragCommitFrame);
    dragCommitFrame = window.requestAnimationFrame(() => {
      dragCommitFrame = 0;
      row.removeAttribute("data-op-drag-commit");
    });
  }
  function shiftDragNode(node, x, follow = false) {
    node.style.setProperty("--op-drag-x", x.toFixed(2) + "px");
    node.toggleAttribute("data-op-drag-follow", follow);
    dragShifted.add(node);
  }
  function toolbarContainsPoint(x, y) {
    const rect = toolbarWrapper?.getBoundingClientRect();
    return Boolean(rect && x >= rect.left && x < rect.right &&
      y >= rect.top && y <= Math.max(rect.top + 8, rect.bottom));
  }
  function makeDragGhost() {
    if (dragGhost || !dragNode) return;
    dragGhost = html("div", "oneplane-bunny-ghost");
    dragGhost.setAttribute("aria-hidden", "true");
    dragGhostBody = html("div", "oneplane-bunny-card");
    const members = draggedGroup ? Array.from(dragNode.querySelectorAll(".oneplane-tab")) : [dragNode];
    if (draggedGroup) {
      // Reproduce the actual compact Split View surface, its accent,
      // six-dot handle, member cards and selected member. No interactive
      // elements or IDs from the original toolbar are copied.
      dragGhostBody.setAttribute("data-op-bunny-group","true");
      dragGhostBody.toggleAttribute("data-op-bunny-active",dragNode.hasAttribute("data-op-split-active"));
      dragGhostBody.style.setProperty("--op-bunny-accent",
        dragNode.style.getPropertyValue("--op-split-color") || "#8eafff");
      const style = window.getComputedStyle(row);
      dragGhostBody.style.setProperty("--op-bunny-tab-width",style.getPropertyValue("--op-tab").trim() || "36px");
      dragGhostBody.style.setProperty("--op-bunny-height",style.getPropertyValue("--op-height").trim() || "34px");
      const handle = html("span","oneplane-bunny-handle");
      for(let i=0;i<6;i++) handle.append(html("i"));
      dragGhostBody.append(handle);
    }
    for (const member of members) {
      const icon = html("span", "oneplane-bunny-icon");
      icon.toggleAttribute("data-op-bunny-unloaded",member.hasAttribute("data-unloaded") && !member.hasAttribute("data-selected"));
      const original = member.querySelector(".oneplane-tab-icon img:not([hidden])");
      if (original?.getAttribute("src")) {
        const img = html("img");
        img.src = original.getAttribute("src"); img.alt = ""; img.draggable = false;
        icon.append(img);
      } else icon.textContent = "•";
      if (draggedGroup) {
        const card = html("span","oneplane-bunny-member");
        card.toggleAttribute("data-op-bunny-selected",member.hasAttribute("data-selected"));
        card.append(icon); dragGhostBody.append(card);
      } else dragGhostBody.append(icon);
    }
    dragGhost.append(dragGhostBody);
    root.append(dragGhost);
  }
  function positionGhost(x, y) {
    if (!dragGhost) return;
    dragGhost.style.left = x + "px";
    dragGhost.style.top = y + "px";
  }
  function hideGhost() {
    dragGhostAnimation?.cancel(); dragGhostAnimation = null;
    if (dragGhost) dragGhost.hidden = true;
    if (dragGhostBody) dragGhostBody.style.removeProperty("transform");
  }
  function showGhost(event, bounce) {
    makeDragGhost();
    if (!dragGhost) return;
    positionGhost(event.clientX, event.clientY);
    dragGhostBody.style.removeProperty("transform");
    dragGhost.hidden = false;
    if (bounce && !reducedMotion.matches && prefs.getIntPref("zen.oneplane.animation-duration",160) !== 0) {
      dragGhostAnimation?.cancel();
      dragGhostAnimation = dragGhostBody.animate([
        {transform:"translateY(-8px) scale(.34,.45)",offset:0},
        {transform:"translateY(5px) scale(1.22,.91)",offset:.24},
        {transform:"translateY(-3px) scale(.96,1.15)",offset:.43},
        {transform:"translateY(2px) scale(1.07,.95)",offset:.64},
        {transform:"translateY(-1px) scale(.99,1.03)",offset:.83},
        {transform:"translateY(0) scale(1)",offset:1}
      ], {duration:360,easing:"linear"});
    }
  }
  function captureGroupPull(event) {
    if (groupPullLayout || !draggedGroup || !isStripNode(dragNode)) return;
    const nodes = stripNodes();
    const order = nodes.filter(node=>node!==dragNode);
    const target = liveDragTarget?.element;
    const targetIndex = order.indexOf(target);
    const index = targetIndex < 0 ? nodes.indexOf(dragNode) :
      targetIndex + (liveDragTarget.before ? 0 : 1);
    order.splice(Math.max(0,index),0,dragNode);
    const bounds = dragNode.getBoundingClientRect();
    groupPullLayout = {
      order, index:order.indexOf(dragNode),
      center:(bounds.left+bounds.right)/2,
      centerY:(bounds.top+bounds.bottom)/2,
      pointerX:event.clientX,
      gap:parseFloat(window.getComputedStyle(list).columnGap)||3
    };
  }
  function hasCenteredIsland(){
    return row.hasAttribute("data-op-show-island") && !row.hasAttribute("data-op-island-tight") &&
      leftLane.parentElement===list;
  }
  function lanePositions(widths,boundary,leftEdge,rightEdge,gap){
    const positions=[];
    const leftWidth=widths.slice(0,boundary).reduce((s,w)=>s+w,0)+Math.max(0,boundary-1)*gap;
    let x=leftEdge-leftWidth;
    for(let i=0;i<widths.length;i++){
      if(i===boundary)x=rightEdge;
      positions.push(x);x+=widths[i]+gap;
    }
    return positions;
  }
  function islandSlotPositions(widths,gap){
    if(!hasCenteredIsland()) return null;
    const boundary=Math.min(leftLane.children.length,widths.length);
    const l=leftLane.getBoundingClientRect(),r=rightLane.getBoundingClientRect();
    return {boundary,positions:lanePositions(widths,boundary,l.right-3,r.left+3,gap)};
  }
  function previewGroupPull(event) {
    const state = groupPullLayout;
    if (!state || !dragNode) return false;
    const {order,index,gap} = state;
    // Freeze the visual reorder slot, rather than reverting to the
    // original DOM position while the group shrinks.
    let center = state.center + (event.clientX-state.pointerX)*.4;
    const source = unshiftedRect(dragNode);
    const rects=order.map(unshiftedRect);
    const lanes=islandSlotPositions(rects.map(r=>r.width),gap);
    if(lanes){
      // Keep the whole group and its neighbours on their respective
      // sides of the fixed title. Preserve the captured center where
      // possible, without pushing the near edge into the island.
      const anchored=lanes.positions[index]+source.width/2;
      let delta=center-anchored;
      delta=index<lanes.boundary?Math.min(0,delta):Math.max(0,delta);
      const laneWidth=(index<lanes.boundary?leftLane:rightLane).getBoundingClientRect().width;
      delta=Math.max(-laneWidth/2,Math.min(laneWidth/2,delta));
      for(let i=0;i<order.length;i++){
        if((i<lanes.boundary)===(index<lanes.boundary))lanes.positions[i]+=delta;
      }
      center=lanes.positions[index]+source.width/2;
    }
    let left = center-source.width/2, right = center+source.width/2;
    row.setAttribute("data-op-group-pull","true");
    shiftDragNode(dragNode,left-source.left,true);
    // Shrink the full-size group artwork as a single object, not the
    // individual flex children. The invisible source only reserves space.
    makeDragGhost();
    if (dragGhost && dragGhostBody) {
      const sx = Math.max(.05,1-.95*dragPull);
      const sy = Math.max(.12,1.055-.91*dragPull);
      positionGhost(center,state.centerY+17*dragPull);
      dragGhostBody.style.transform = "scale("+sx+","+sy+")";
      dragGhost.hidden = false;
    }
    if(lanes){
      for(let i=0;i<order.length;i++) if(i!==index)
        shiftDragNode(order[i],lanes.positions[i]-rects[i].left);
      shiftDragNode(plus,0);
    }else{
      for(let i=index-1;i>=0;i--){
        const node=order[i], rect=rects[i];
        left-=gap+rect.width;
        shiftDragNode(node,left-rect.left);
      }
      for(let i=index+1;i<order.length;i++){
        const node=order[i], rect=rects[i];
        right+=gap;
        shiftDragNode(node,right-rect.left);
        right+=rect.width;
      }
      shiftDragNode(plus,right+gap-unshiftedRect(plus).left);
    }
    refreshIndicator();
    return true;
  }
  function clearGroupPull() {
    if (!groupPullLayout && !row.hasAttribute("data-op-group-pull")) return;
    groupPullLayout = null;
    row.removeAttribute("data-op-group-pull");
    hideGhost();
  }
  function setPull(progress) {
    if (!dragNode) return;
    dragPull = progress;
    dragNode.toggleAttribute("data-op-pulling", progress > 0);
    dragNode.style.setProperty("--op-pull-width", Math.max(0,dragWidth*(1-.95*progress)).toFixed(2)+"px");
    dragNode.style.setProperty("--op-pull-y", (17*progress).toFixed(2)+"px");
    dragNode.style.setProperty("--op-pull-scale-y", String(Math.max(.12,1.055-.91*progress)));
    dragNode.style.setProperty("--op-pull-scale-x", String(Math.max(.08,1.055-.98*progress)));
    dragNode.style.setProperty("--op-pull-gap", (-3*progress).toFixed(2)+"px");
    if (draggedTab && !draggedGroup) measureSplitGroup(splitGroup(draggedTab));
    refreshIndicator();
  }
  function updateNativeDragImage(image, x, y, event) {
    try {
      const session = Cc["@mozilla.org/widget/dragservice;1"]
        .getService(Ci.nsIDragService).getCurrentSession(window);
      if (session?.updateDragImage) session.updateDragImage(image,x,y);
      else if (event?.dataTransfer?.updateDragImage) event.dataTransfer.updateDragImage(image,x,y);
      else return false;
      return true;
    } catch (error) { console.error("[OnePlane] Drag image transition:",error); return false; }
  }
  function cancelInsertion() {
    const animation = dragInsertAnimation;
    dragInsertAnimation = null;
    if (animation) animation.cancel();
    dragInsertNode?.removeAttribute("data-op-reinsert");
    dragInsertNode = null;
  }
  function animateInsertion(event) {
    cancelInsertion();
    if (!dragNode || reducedMotion.matches ||
        prefs.getIntPref("zen.oneplane.animation-duration",160) === 0) return;
    const node = dragNode;
    dragInsertNode = node;
    node.setAttribute("data-op-reinsert","true");
    const rect = node.getBoundingClientRect();
    const dy = Math.max(-12,Math.min(34,event.clientY-(rect.top+rect.height/2)));
    // Animate the real card (not just its icon), using individual transforms
    // so horizontal tracking and native drop/slot positioning stay independent.
    const animation = node.animate([
      {translate:"0 "+dy+"px",scale:".78 1.06",offset:0},
      {translate:"0 -4px",scale:"1.16 .72",offset:.30},
      {translate:"0 2px",scale:".94 1.14",offset:.56},
      {translate:"0 -1px",scale:"1.04 .97",offset:.78},
      {translate:"0 0",scale:"1 1",offset:1}
    ],{duration:240,easing:"linear"});
    dragInsertAnimation=animation;
    animation.onfinish=animation.oncancel=()=>{
      if (dragInsertAnimation !== animation) return;
      dragInsertAnimation=null; dragInsertNode=null;
      node.removeAttribute("data-op-reinsert");
    };
  }
  function setDragImageMode(mode, event) {
    if (!dragNode || mode === dragImageMode) return;
    const previous = dragImageMode;
    if (mode === "outside") {
      // Only the OS drag image is painted beyond this browser window.
      makeDragGhost();
      if (!dragGhost) return;
      hideGhost();
      const p = dragLastPoint || {x:window.innerWidth/2,y:dragEdge+PULL_DISTANCE};
      positionGhost(Math.max(20,Math.min(window.innerWidth-20,p.x)),
                    Math.max(20,Math.min(window.innerHeight-20,p.y)));
      dragGhost.hidden = false;
      const box = dragGhostBody.getBoundingClientRect();
      const ok = updateNativeDragImage(dragGhostBody,Math.round(box.width/2),Math.round(box.height/2),event);
      hideGhost();
      if (!ok) { if (previous === "content") showGhost(event,false); return; }
    } else if (previous === "outside") {
      // Clear the OS image BEFORE displaying our local animated card.
      if (!updateNativeDragImage(blankDragImage,0,0,event)) return;
    }
    dragImageMode = mode;
    const detached = mode === "content" || mode === "outside";
    dragNode.toggleAttribute("data-op-detached", detached);
    row.toggleAttribute("data-op-inline-drag", !detached);
    if (detached) {
      clearGroupPull();
      dragReentry = false;
      cancelInsertion();
      setPull(0);
      clearLiveDrag();
      if (mode === "content") showGhost(event,previous === "inline");
    } else {
      hideGhost();
      setPull(0);
      if (previous !== "inline") {
        dragReentry = true;
        try { animateInsertion(event); } catch (error) {
          cancelInsertion();
          console.error("[OnePlane] Insertion animation:",error);
        }
      }
    }
    if (draggedTab && !draggedGroup) measureSplitGroup(splitGroup(draggedTab));
    refreshIndicator();
    refreshIslandTitle();
  }
  function followLocalSource(event, node) {
    const rect = unshiftedRect(node);
    shiftDragNode(node, event.clientX - rect.width * dragGrabRatio - rect.left, true);
  }
  function onWindowDragLeave(event) {
    if (!draggedTab || !dragNode || event.relatedTarget instanceof Node) return;
    // Internal strip -> page crossings must not turn on the OS ghost.
    const x = event.clientX, y = event.clientY;
    const atEdge = x <= 1 || y <= 1 || x >= window.innerWidth-1 || y >= window.innerHeight-1;
    if (atEdge || event.target === window || event.target === document || event.target === root)
      setDragImageMode("outside",event);
  }
  function previewStripDrag(event, tab) {
    const owner = tabOwner(tab);
    const group = owner?.[DRAG_CONTROLLER]?.group();
    const entry = group ? splitEntries.get(group)?.box : entries.get(tab)?.item;
    if(owner!==window && row.hasAttribute("data-op-show-island") &&
        !row.hasAttribute("data-op-island-incoming")){
      row.setAttribute("data-op-island-incoming","true");
      scheduleGeometry();
    }
    const nodes = stripNodes();
    if (!nodes.length) { clearLiveDrag(); return null; }
    const slots = nodes.map(node => ({ node, rect: unshiftedRect(node) }));
    const local = owner === window && isStripNode(entry);
    const inline = owner === window && dragImageMode === "inline" && entry === dragNode;
    const memberGroup = !local && owner === window && splitGroup(tab);
    if (memberGroup) {
      const own = slots.find(slot => slot.node === splitEntries.get(memberGroup)?.box);
      if (own && event.clientX >= own.rect.left && event.clientX <= own.rect.right) {
        clearLiveDrag();
        if (inline) followLocalSource(event, entry);
        return { ...nativeSlot(own.node), before: false };
      }
    }
    const moving = local ? slots.find(slot => slot.node === entry) : null;
    const rest = slots.filter(slot => slot !== moving);
    if (!rest.length) {
      clearLiveDrag();
      if (inline) followLocalSource(event, entry);
      return null;
    }
    const found = dragSlotIndex(rest, event.clientX);
    const index = found < 0 ? rest.length : found;
    const target = rest[Math.min(index, rest.length - 1)];
    const dest = { ...nativeSlot(target.node), before: index < rest.length };
    if (!dest.native) { clearLiveDrag(); return null; }

    row.setAttribute("data-op-live-drag", "true");
    const gap = parseFloat(window.getComputedStyle(list).columnGap) || 3;
    const base = slots[0].rect.left;
    const incomingWidth = Math.max(1, parseFloat(window.getComputedStyle(row).getPropertyValue("--op-tab")) || 36);
    // Only the actual source follows the pointer. Neighbors glide into
    // their future slots without painting an additional placeholder.
    const order = rest.slice();
    if (moving) order.splice(index, 0, moving);
    else order.splice(index, 0, { node: null, rect: { width: incomingWidth } });
    const used = new Set();
    const lanes=islandSlotPositions(order.map(slot=>slot.rect.width),gap);
    const positions=lanes?.positions||[];
    if(!lanes){
      let left=base;
      for(const slot of order){positions.push(left);left+=slot.rect.width+gap;}
    }
    // An elastic buffer follows the pointer before crossing the 8px
    // reorder hysteresis. Neighboring slots yield as a chain, with
    // decreasing pressure farther from the dragged item. The dragged
    // card has resistance at the edges of its slot, not a free overlap.
    let pressure = 0, direction = 0, followX = null;
    if (inline && moving) {
      const slotLeft = positions[index], width = moving.rect.width;
      const rawDelta = event.clientX - width*dragGrabRatio - slotLeft;
      direction = Math.sign(rawDelta);
      // The island is an immovable boundary. Do not yield toward it.
      if(lanes && ((index<lanes.boundary && direction>0) ||
          (index>=lanes.boundary && direction<0))) direction=0;
      const maxYield = Math.min(15,Math.max(8,width*.33));
      pressure = maxYield * (1-Math.exp(-Math.abs(rawDelta)/18));
      followX = slotLeft + direction * Math.min(Math.abs(rawDelta),pressure);
    }
    for (let i=0;i<order.length;i++) {
      const slot=order[i];
      if (!slot.node) continue;
      if (slot === moving && inline) {
        if (followX !== null) shiftDragNode(slot.node,followX-slot.rect.left,true);
        else followLocalSource(event,slot.node);
      } else {
        // Shift the whole chain equally for the first neighbor; the
        // same displacement keeps the existing gaps from collapsing.
        const sameLane=!lanes || (i<lanes.boundary)===(index<lanes.boundary);
        const onSide = sameLane && (direction > 0 ? i > index : direction < 0 && i < index);
        const elastic = onSide ? direction*pressure : 0;
        shiftDragNode(slot.node,positions[i]-slot.rect.left+elastic);
      }
      used.add(slot.node);
    }
    // Incoming tabs retain the original native group until successful drop.
    row.style.setProperty("--op-drag-incoming", (moving ? 0 : incomingWidth + gap) + "px");
    shiftDragNode(plus,!lanes && direction > 0 ? pressure : 0);
    used.add(plus);
    if (inline && !moving) { followLocalSource(event,entry); used.add(entry); }
    for (const node of [...dragShifted]) {
      if (used.has(node)) continue;
      node.style.removeProperty("--op-drag-x");
      node.removeAttribute("data-op-drag-follow");
      dragShifted.delete(node);
    }
    liveDragTarget = dest;
    refreshIndicator();
    return dest;
  }
  function onStripDragLeave(event) {
    if (event.relatedTarget instanceof Node && row.contains(event.relatedTarget)) return;
    if (toolbarContainsPoint(event.clientX,event.clientY)) return;
    // The window capture listener owns pull and image transitions.
    // Do not erase a group's visual position mid-extraction.
    if (!(groupPullLayout && dragImageMode === "inline")) clearLiveDrag();
    clearDropMarker();
  }
  function clearDropMarker() {
    dropMarker?.removeAttribute("data-op-drop-before");
    dropMarker?.removeAttribute("data-op-drop-after");
    dropMarker = null;
  }
  function markDrop(event) {
    clearDropMarker();
    const dest = dropTarget(event);
    if (!dest?.native || dest.group === draggedGroup && draggedGroup) return;
    if (!draggedGroup && draggedTab && dest.group && splitGroup(draggedTab) === dest.group) return;
    dropMarker = dest.element;
    dropMarker.setAttribute(dest.before ? "data-op-drop-before" : "data-op-drop-after", "true");
  }
  function releaseDragReveal() {
    if (dragRevealTimer) window.clearTimeout(dragRevealTimer);
    dragRevealTimer = 0;
    toolbarWrapper?.removeAttribute("oneplane-drag-hold");
  }
  function revealForDrag(event) {
    const tab = readDraggedTab(event);
    if (!hoverSupported() || !tab || !toolbarWrapper) return;
    const within = toolbarContainsPoint(event.clientX,event.clientY);
    const local = tabOwner(tab) === window;
    if (local && dragNode) {
      dragLastPoint = {x:event.clientX,y:event.clientY};
      if (within && dragImageMode !== "content" && dragImageMode !== "outside")
        dragEdge = toolbarWrapper.getBoundingClientRect().bottom;
      const p = Math.max(0,Math.min(1,(event.clientY-(dragEdge-15))/PULL_DISTANCE));
      const lateralExit = event.clientX < toolbarWrapper.getBoundingClientRect().left ||
                          event.clientX > toolbarWrapper.getBoundingClientRect().right;
      const threshold = dragImageMode === "content" || dragImageMode === "outside" ? .72 : .96;
      const detach = p >= threshold || lateralExit;
      setDragImageMode(detach ? "content" : "inline",event);
      if (dragImageMode === "content") {
        positionGhost(event.clientX,event.clientY);
        clearLiveDrag(); releaseDragReveal();
        return;
      }
      if (dragImageMode === "outside") return;
      if (p === 0) dragReentry = false;
      if (p > 0 && !dragReentry) {
        if (draggedGroup) captureGroupPull(event);
        if (groupPullLayout) row.setAttribute("data-op-group-pull","true");
        else clearLiveDrag();
        setPull(p);
        if (!previewGroupPull(event)) followLocalSource(event,dragNode);
        toolbarWrapper.setAttribute("oneplane-drag-hold","true");
        if (dragRevealTimer) window.clearTimeout(dragRevealTimer);
        dragRevealTimer = window.setTimeout(releaseDragReveal,500);
        if (within) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect="move"; }
        return;
      }
      clearGroupPull();
      setPull(0);
    } else if (!local) tabOwner(tab)?.[DRAG_CONTROLLER]?.outside(event);
    if (!within && !(local && dragReentry && dragImageMode === "inline")) {
      clearLiveDrag(); releaseDragReveal(); return;
    }
    toolbarWrapper.setAttribute("oneplane-drag-hold", "true");
    if (dragRevealTimer) window.clearTimeout(dragRevealTimer);
    dragRevealTimer = window.setTimeout(releaseDragReveal, 500);
    if (within) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
    }
    clearDropMarker();
    previewStripDrag(event,tab);
  }
  function onToolbarDrop(event) {
    if (toolbarContainsPoint(event.clientX,event.clientY) && readDraggedTab(event)) onStripDrop(event);
  }
  function emptySplitTarget(tab) {
    return Boolean(tab?.hasAttribute("zen-empty-tab") ||
      (dragSearch?.tab === tab && dragSearch.empty));
  }
  function readStartupSearch() {
    const tab = browser.selectedTab, bar = window.gURLBar;
    if (!tab || !bar) return null;
    const empty = tab.hasAttribute("zen-empty-tab") ||
      /^(about:(blank|newtab|home|privatebrowsing))(?:[?#].*)?$/i.test(tab.linkedBrowser?.currentURI?.spec || "");
    if (!empty || !(bar.hasAttribute("zen-newtab") || bar.hasAttribute("zen-floating-urlbar")) ||
        !(bar.hasAttribute("open") || bar.hasAttribute("focused") || bar.view?.isOpen)) return null;
    return {tab,empty,query:bar.value || "",newtab:bar.hasAttribute("zen-newtab")};
  }
  function rememberStartupSearch(event) {
    if (event.button !== 0) return;
    pointerSearch = readStartupSearch();
  }
  function restoreStartupSearch(state) {
    if (!state || dead) return;
    if (restoreSearchTimer) window.clearTimeout(restoreSearchTimer);
    restoreSearchTimer = window.setTimeout(()=>{
      restoreSearchTimer=0;
      if (dead || browser.selectedTab !== state.tab || !validNativeTab(state.tab)) return;
      const bar=window.gURLBar;
      if (!bar || bar.hasAttribute("open") || bar.hasAttribute("focused") || bar.view?.isOpen) return;
      try {
        if (state.newtab && typeof window.gZenUIManager?.handleNewTab === "function") {
          // Native Zen new-tab search, without toggling an already-open popup.
          if (!bar.hasAttribute("zen-newtab")) window.gZenUIManager.handleNewTab(false,false,"tab",true);
          else { bar.search(state.query); document.getElementById("Browser:OpenLocation")?.doCommand(); }
          if (state.query && bar.value!==state.query) bar.search(state.query);
        } else {
          bar.search(state.query);
          document.getElementById("Browser:OpenLocation")?.doCommand();
        }
      } catch(error) { console.error("[OnePlane] Restore startup search:",error); }
    },80);
  }
  function endDragVisual() {
    const search = dragSearch;
    dragSearch = null; pointerSearch = null;
    clearGroupPull();
    dragNode?.removeAttribute("data-op-detached");
    dragNode?.removeAttribute("data-op-drag-follow");
    dragNode?.removeAttribute("data-op-pulling");
    for (const name of ["--op-pull-width","--op-pull-y","--op-pull-scale-y","--op-pull-scale-x","--op-pull-gap"])
      dragNode?.style.removeProperty(name);
    hideGhost();
    dragGhost?.remove(); dragGhost = null; dragGhostBody = null;
    dragPull = 0; dragLastPoint = null; dragReentry = false;
    dragNode = null;
    dragImageMode = null;
    row.removeAttribute("data-op-inline-drag");
    releaseDragReveal();
    clearLiveDrag();
    clearDropMarker();
    row.removeAttribute("data-op-dragging");
    if(!dead){applyHoverMode();scheduleGeometry();schedule();}
    for (const entry of splitEntries.values()) entry.box.removeAttribute("data-op-group-dragging");
    splitZone.removeAttribute("data-op-dragging");
    splitZone.removeAttribute("data-op-side");
    refreshIndicator();
    refreshIslandTitle();
    restoreStartupSearch(search);
  }
  function sourceHandled(tab) {
    const source = tabOwner(tab)?.[DRAG_CONTROLLER];
    source?.markHandled();
  }
  function onDragStart(event, tab, group = null) {
    if (!hoverSupported() || !validNativeTab(tab) || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    const image = group ? splitEntries.get(group)?.box : entries.get(tab)?.item;
    if (!image) { event.preventDefault(); return; }
    cancelInsertion();
    const grabbed = image.getBoundingClientRect();
    dragGrabRatio = Math.max(0,Math.min(1,(event.clientX-grabbed.left)/Math.max(1,grabbed.width)));
    dragGrabY = Math.max(0,Math.min(1,(event.clientY-grabbed.top)/Math.max(1,grabbed.height)));
    const compactWidth = parseFloat(window.getComputedStyle(row).getPropertyValue("--op-tab")) || 36;
    dragWidth = group ? (22 + image.querySelectorAll(".oneplane-tab").length*(compactWidth+3)) : compactWidth;
    dragEdge = toolbarWrapper?.getBoundingClientRect().bottom || grabbed.bottom;
    dragLastPoint = {x:event.clientX,y:event.clientY};
    clearTabHover();
    if (group && (splitGroup(tab) !== group || groupMembers(group).length < 2)) {
      event.preventDefault();
      return;
    }
    dragSearch = pointerSearch?.tab === browser.selectedTab ? pointerSearch : readStartupSearch();
    pointerSearch = null;
    groupPullLayout = null;
    draggedTab = tab;
    draggedGroup = group;
    dragHandled = false;
    dragStartPoint = { x: event.screenX, y: event.screenY };
    try {
      event.dataTransfer.mozSetDataAt(DRAG_TYPE, tab, 0);
      event.dataTransfer.effectAllowed = "move";
      dragNode = image;
      dragImageMode = "inline";
      event.dataTransfer.setDragImage(blankDragImage, 0, 0);
      row.setAttribute("data-op-dragging", "true");
      scheduleGeometry();
      row.setAttribute("data-op-inline-drag", "true");
      image.setAttribute("data-op-drag-follow","true");
      makeDragGhost(); hideGhost();
      if (group) image.setAttribute("data-op-group-dragging", "true");
      if (!group && (browser.selectedTab !== tab || isSplit(tab)) && window.gZenViewSplitter?.splitTabs) {
        splitZone.setAttribute("data-op-dragging", "true");
      }
      previewStripDrag(event,tab);
      refreshIndicator();
      refreshIslandTitle();
      event.stopPropagation();
    } catch (error) {
      event.preventDefault();
      endDragVisual();
      draggedTab = null;
      draggedGroup = null;
      console.error("[OnePlane] Tab drag start:", error);
    }
  }
  function onStripDragOver(event) {
    const tab = readDraggedTab(event);
    if (!tab) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    clearDropMarker();
    previewStripDrag(event, tab);
  }
  function moveNativeNextTo(element, dest) {
    if (!element || !dest?.native || element === dest.native) return false;
    const method = dest.before ? "moveTabBefore" : "moveTabAfter";
    if (typeof browser[method] !== "function") return false;
    browser[method](element, dest.native);
    return true;
  }
  function onStripDrop(event) {
    const tab = readDraggedTab(event);
    if (!tab) return;
    event.preventDefault();
    event.stopPropagation();
    const owner = tabOwner(tab);
    const source = owner?.[DRAG_CONTROLLER];
    const group = source?.group();
    if (owner === window && dragNode) { setDragImageMode("inline",event); setPull(0); }
    const dest = previewStripDrag(event, tab) || dropTarget(event);
    row.setAttribute("data-op-drag-commit", "true");
    try {
      if (group) {
        // Zen exposes a real tab-group object. Moving that object keeps the
        // grid, live browser instances and the selected pane intact.
        if (owner === window && splitGroup(tab) === group && dest?.native !== group) {
          moveNativeNextTo(group, dest);
        }
        source?.markHandled();
        schedule();
        return;
      }
      if (dest?.tab === tab || (owner === window && dest?.group && splitGroup(tab) === dest.group)) {
        source?.markHandled();
        return;
      }
      if (isSplit(tab) && !unsplitTab(tab)) { source?.markHandled(); return; }
      if (owner === window) {
        // Dropping a member beyond its original group detaches only that
        // member. Never insert an ordinary tab inside another split group.
        moveNativeNextTo(tab, dest);
        source?.markHandled();
      } else {
        const all = Array.from(browser.tabs);
        const boundary = dest?.group ? groupMembers(dest.group) : dest?.tab ? [dest.tab] : [];
        const index = boundary.length
          ? all.indexOf(dest.before ? boundary[0] : boundary.at(-1)) + (dest.before ? 0 : 1)
          : all.length;
        const adopted = browser.adoptTab(tab, { tabIndex: Math.max(0, index), selectTab: true });
        if (adopted) source?.markHandled();
      }
      schedule();
    } catch (error) {
      console.error("[OnePlane] Tab or split group move:", error);
    } finally {
      clearDropMarker();
      finishStripCommit();
    }
  }
  function splitSide(event) {
    const box = splitZone.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return "";
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    const sides = [["left", x], ["right", 1-x], ["top", y], ["bottom", 1-y]];
    sides.sort((a,b) => a[1]-b[1]);
    return sides[0][1] <= .25 ? sides[0][0] : "";
  }
  function onSplitDragOver(event) {
    const tab = readDraggedTab(event);
    if (!tab || tabOwner(tab) !== window || draggedGroup ||
        (tab === browser.selectedTab && !isSplit(tab))) return;
    // Zen's native splitter does not accept its empty workspace tab.
    // Keep the start-page search instead of calling splitTabs with one
    // real tab (Zen filters the empty tab out).
    const side = emptySplitTarget(browser.selectedTab) ? "" :
      isSplit(tab) ? "unsplit" : splitSide(event);
    splitZone.setAttribute("data-op-side", side);
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = side ? "move" : "none";
  }
  function onSplitDrop(event) {
    const tab = readDraggedTab(event);
    const current = browser.selectedTab;
    if (!tab || tabOwner(tab) !== window || draggedGroup ||
        (tab === current && !isSplit(tab))) return;
    event.preventDefault();
    event.stopPropagation();
    const side = splitSide(event);
    try {
      if (emptySplitTarget(current)) {
        // Reject an unsupported split without changing the selected tab.
        sourceHandled(tab);
        return;
      }
      if (isSplit(tab)) {
        unsplitTab(tab);
        schedule();
      } else if (side && validNativeTab(current) && !tab.hasAttribute("zen-empty-tab")) {
        const first = side === "left" || side === "top";
        const grid = side === "left" || side === "right" ? "vsep" : "hsep";
        // Mirror ZenViewSplitter's native drop order: selecting the
        // dragged tab first restores its pending browser. Keep the old
        // selected tab as the other pane, and let Zen own the session.
        browser.selectedTab = tab;
        const result = window.gZenViewSplitter?.splitTabs(first ? [tab,current] : [current,tab], grid, first ? 0 : 1);
        if (!result && validNativeTab(current)) browser.selectedTab = current;
        schedule();
      }
      sourceHandled(tab);
    } catch (error) {
      if (validNativeTab(current) && browser.selectedTab !== current) browser.selectedTab = current;
      console.error("[OnePlane] Split View:", error);
    } finally { endDragVisual(); }
  }
  function onDragEnd(event, tab) {
    const dt = event.dataTransfer;
    const handled = dragHandled;
    const wasGroup = Boolean(draggedGroup);
    const start = dragStartPoint;
    draggedTab = null; draggedGroup = null; dragHandled = false; dragStartPoint = null;
    endDragVisual();
    if (wasGroup || !start || handled || dt?.mozUserCancelled || dt?.dropEffect !== "none" ||
        !validNativeTab(tab) || tabOwner(tab) !== window) return;
    // A cancelled drag or a drop within this window must never create
    // another window. screenX/Y are browser-chrome desktop CSS coordinates.
    const x = event.screenX, y = event.screenY;
    if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0) ||
        Math.hypot(x-start.x,y-start.y) < 12) return;
    const left = window.screenX, top = window.screenY;
    const inside = x >= left && x < left + window.outerWidth &&
      y >= top && y < top + window.outerHeight;
    if (inside) return;
    try {
      // Native session adoption preserves the live browser, history, audio
      // and private-window state. Zen chooses its native window-sync mode.
      if (isSplit(tab) && !unsplitTab(tab)) return;
      browser.replaceTabWithWindow(tab, {
        replaceLastTab: true, screenX: x - 40, screenY: y - 20,
        outerWidth: Math.min(window.outerWidth, 1200),
        outerHeight: Math.min(window.outerHeight, 850)
      });
    } catch (error) { console.error("[OnePlane] Detach tab:", error); }
  }
  const dragController = {
    source: () => draggedTab,
    group: () => draggedGroup,
    outside: event => setDragImageMode("outside",event),
    markHandled: () => {
      dragHandled = true;
      endDragVisual();
      draggedTab = null;
      draggedGroup = null;
    }
  };
  window[DRAG_CONTROLLER] = dragController;

  // Single hover target; preserve momentum across tabs and short gaps.
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
  let hoverTab = null, hoverX = null, hoverTimer = 0, indicatorFrame = 0;
  let lastHoverPointer = null, indicatorHover = null;
  let indicatorShown = false, ix = 0, iy = 0, iw = 14, ih = 3, iv = 0, last = 0, until = 0;
  const hoverDelay = () => reducedMotion.matches ? 0 :
    clamp(prefs.getIntPref("zen.oneplane.hover-close-delay", 260), 0, 600);

  function cancelHoverTimer() {
    if (hoverTimer) window.clearTimeout(hoverTimer);
    hoverTimer = 0;
  }
  function pullIndicatorFactor(progress){
    const t=Math.max(0,Math.min(1,(progress-.06)/.56));
    return (1-t)*(1-t);
  }
  function indicatorTarget() {
    const s=row.getBoundingClientRect();
    if(s.width<=0||s.height<=0)return null;
    const dragging=Boolean(dragNode && row.hasAttribute("data-op-dragging"));
    const item=dragging?dragNode:indicatorHover && list.contains(indicatorHover)?
      indicatorHover:entries.get(browser.selectedTab)?.item;
    if(!item||!list.contains(item)||item.hasAttribute("data-op-detached")||
        item.closest(".oneplane-split-group[data-op-detached]"))return null;
    if(dragging && (dragImageMode!=="inline" || dragPull>=.62))return null;
    // For a shrinking group use the visible ghost rather than its
    // invisible layout placeholder when determining vertical clearance.
    const visual=dragging && dragPull>0 && draggedGroup && dragGhost &&
      !dragGhost.hidden && dragGhostBody ? dragGhostBody : item;
    let a=visual.getBoundingClientRect(),center=(a.left+a.right)/2;
    if(a.width<=0)return null;
    let w=clamp(a.width*.14,12,18),h=3;
    if(dragging){
      if(draggedGroup){
        const members=Array.from(item.querySelectorAll(".oneplane-tab"));
        if(dragPull===0 && members.length){
          const first=members[0].getBoundingClientRect(),last=members.at(-1).getBoundingClientRect();
          center=(first.left+last.right)/2;
          w=Math.max(12,last.right-first.left-4);
        }else{
          center+=10*(1-dragPull);
          w=Math.max(12,dragWidth-22-4);
        }
      }
      const factor=pullIndicatorFactor(dragPull);
      // Collapse before the descending card can intersect the underline.
      const clearance=s.bottom-a.bottom-2;
      const visibility=Math.min(factor,clamp(clearance/5,0,1));
      if(visibility<.015)return null;
      w*=visibility;h*=visibility;
      return {x:center-s.left-row.clientLeft,y:Math.min(s.height-2,a.bottom-s.top+3),
        w,h,drag:true,pulling:dragPull>0};
    }
    const bias=item!==indicatorHover||hoverX===null?0:
      clamp((hoverX-center)/Math.max(1,a.width/2),-1,1);
    return {x:center-s.left-row.clientLeft+bias*Math.min(12,a.width*.12),
      y:Math.min(s.height-2,a.bottom-s.top+2),w,h};
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
    if (dead || !p || !indicatorShown) { hideIndicator(); return; }
    const dt = last ? clamp((now - last) / 1000, .001, .05) : 1 / 60;
    last = now;
    if(p.drag){
      // Track the painted drag card directly, with no horizontal spring
      // lag. The width expands quickly on pickup, but collapses without
      // lag during the pull so the indicator cannot cross the card.
      ix=p.x;iy=p.y;iv=0;
      const blend=reducedMotion.matches||p.pulling?1:1-Math.exp(-28*dt);
      iw+=(p.w-iw)*blend;ih=p.h;
    } else if (reducedMotion.matches) {
      ix = p.x; iy = p.y; iv = 0; iw = p.w; ih = p.h;
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
    if (p.drag || (!reducedMotion.matches && (now < until || Math.abs(ix-p.x) > .08 ||
        Math.abs(iy-p.y) > .08 || Math.abs(iv) > .2 || Math.abs(iw-p.w) > .08 ||
        Math.abs(ih-p.h) > .04))) {
      indicatorFrame = window.requestAnimationFrame(tickIndicator);
    }
  }
  function scheduleIndicator() {
    if (!indicatorShown || dead) return;
    until = window.performance.now() + 450;
    if (!indicatorFrame) { last = 0; indicatorFrame = window.requestAnimationFrame(tickIndicator); }
  }
  const indicatorPreferenceObserver = { observe() { refreshIndicator(); } };
  function hideIndicator() {
    indicatorShown = false;
    indicator.removeAttribute("data-visible");
    if (indicatorFrame) window.cancelAnimationFrame(indicatorFrame);
    indicatorFrame = 0; iv = 0; last = 0;
  }
  function refreshIndicator() {
    if (dead || !prefs.getBoolPref("zen.oneplane.tab-indicator", true)) {
      hideIndicator(); return;
    }
    const p = indicatorTarget();
    if (!p) { hideIndicator(); return; }
    if (!indicatorShown) {
      ix=p.x; iy=p.y; iw=p.w; ih=p.h; iv=0;
      paintIndicator();
      indicatorShown=true;
      indicator.setAttribute("data-visible","true");
    }
    scheduleIndicator();
  }
  let islandTextAnimation = null;
  function refreshIslandTitle(){
    if(dead || !row.hasAttribute("data-op-show-island")) return;
    const item=dragNode && row.hasAttribute("data-op-dragging")?dragNode:
      indicatorHover && list.contains(indicatorHover)?indicatorHover:entries.get(browser.selectedTab)?.item;
    const title=item?.classList.contains("oneplane-split-group")?
      Array.from(item.querySelectorAll(".oneplane-tab-title")).map(n=>n.textContent).filter(Boolean).join(" · "):
      item?.querySelector(".oneplane-tab-title")?.textContent || "";
    if(islandTitle.textContent===title) return;
    islandTextAnimation?.cancel();
    const hadTitle=Boolean(islandTitle.textContent);
    islandTitle.textContent=title;
    island.title=title;
    if(hadTitle && title && !reducedMotion.matches &&
        prefs.getIntPref("zen.oneplane.animation-duration",160)!==0)
      islandTextAnimation=islandTitle.animate([{opacity:.35,translate:"0 2px"},{opacity:1,translate:"0 0"}],
        {duration:150,easing:"ease-out"});
  }
  function applyHoverMode(){
    if(dead || row.hasAttribute("data-op-dragging")) return;
    const mode=prefs.getIntPref("zen.oneplane.hover-mode",0)===1?"island":"expand";
    const show=mode==="island" && prefs.getBoolPref("zen.oneplane.show-center-island",true);
    if(row.getAttribute("data-op-hover-mode")===mode && row.hasAttribute("data-op-show-island")===show) return;
    clearTabHover();
    row.setAttribute("data-op-hover-mode",mode);
    row.toggleAttribute("data-op-show-island",show);
    if(!show) row.removeAttribute("data-op-island-tight");
    placeStripOrder(stripNodes());
    refreshIslandTitle();
    scheduleGeometry();
    schedule();
  }
  const hoverModePreferenceObserver={observe(){applyHoverMode();}};
  function selectHover(item, x = null) {
    if (!item || !list.contains(item)) return;
    cancelHoverTimer();
    hoverX = x;
    if (hoverTab !== item) {
      hoverTab?.removeAttribute("data-op-expanded");
      hoverTab?.removeAttribute("data-op-hovered");
      hoverTab = item;
      item.setAttribute("data-op-hovered", "true");
      item.toggleAttribute("data-op-expanded",row.getAttribute("data-op-hover-mode")!=="island");
    }
    indicatorHover = item;
    refreshIndicator();
    refreshIslandTitle();
  }
  function clearTabHover() {
    cancelHoverTimer();
    hoverTab?.removeAttribute("data-op-expanded");
    hoverTab?.removeAttribute("data-op-hovered");
    hoverTab = null; hoverX = null; lastHoverPointer = null; indicatorHover = null;
    refreshIndicator();
    refreshIslandTitle();
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
  function pointOverTabStrip(event) {
    const a = list.getBoundingClientRect();
    return a.width > 0 && a.height > 0 &&
      event.clientX >= a.left - 3 && event.clientX <= a.right + 3 &&
      event.clientY >= a.top - 2 && event.clientY <= a.bottom + 2;
  }
  function releaseIndicatorHover() {
    if (!indicatorHover) return;
    indicatorHover = null;
    hoverX = null;
    refreshIndicator();
    refreshIslandTitle();
  }
  function trackTabPointer(event) {
    if (!hoverSupported() || event.pointerType === "touch" || draggedTab) return;
    const hit = event.target?.closest?.(".oneplane-tab");
    if (hit && list.contains(hit)) {
      const point = {x:event.clientX,y:event.clientY};
      // Ignore synthetic retargets from geometry changes under a stationary mouse.
      if (hoverTab && hoverTab !== hit && lastHoverPointer &&
          Math.hypot(point.x-lastHoverPointer.x,point.y-lastHoverPointer.y) < 1) return;
      lastHoverPointer = point;
      selectHover(hit,event.clientX); return;
    }
    if (event.target === plus || (event.target instanceof Node && plus.contains(event.target))) {
      releaseIndicatorHover();
      cancelHoverTimer(); return;
    }
    // Gaps, split handles and group padding are part of the same hover
    // session. Do not briefly retarget the selected tab in these areas.
    if (pointOverTabStrip(event)) {
      cancelHoverTimer(); return;
    }
    releaseIndicatorHover();
    queueTabCollapse();
  }
  function focusTab(event) {
    const item = event.target?.closest?.(".oneplane-tab");
    if (item && event.target.matches(":focus-visible")) selectHover(item);
  }
  function blurTab(event) {
    if (!row.contains(event.relatedTarget) && !row.matches(":hover")) queueTabCollapse();
  }
  function leaveTabPointer(event) {
    // The translated strip can extend beyond the row's original box.
    // A pointerleave from the plus or row is not necessarily a departure.
    if (event && pointOverTabStrip(event)) return;
    releaseIndicatorHover();
    queueTabCollapse();
  }
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
    button.draggable = true;
    button.setAttribute("role", "tab");
    const icon = html("span", "oneplane-tab-icon");
    const img = html("img");
    img.alt = "";
    img.draggable = false;
    img.addEventListener("error", () => { img.hidden = true; });
    icon.append(img);
    const audio = html("span", "oneplane-tab-audio");
    audio.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 3; i++) audio.append(html("i"));
    const title = html("span", "oneplane-tab-title");
    button.append(icon, title);
    button.addEventListener("click", () => {
      if (!tab.closing && tab!==browser.selectedTab) {
        guardRestoredAddress(tab);
        guardPanelSwitch();
        browser.selectedTab = tab;
      }
    });
    item.addEventListener("auxclick", event => {
      if (event.button === 1 && !tab.closing) {
        event.preventDefault();
        browser.removeTab(tab, { animate: true });
      }
    });
    item.addEventListener("dragstart", event => onDragStart(event, tab));
    item.addEventListener("dragend", event => onDragEnd(event, tab));
    item.append(button, audio);
    return { item, button, title, img, audio, src: null };
  }

  function createSplitEntry(group) {
    const box = html("div", "oneplane-split-group");
    box.setAttribute("role", "group");
    const handle = html("button", "oneplane-split-handle");
    handle.type = "button";
    handle.draggable = true;
    handle.title = "Move entire Split View";
    handle.setAttribute("aria-label", "Move entire Split View");
    for (let i = 0; i < 6; i++) handle.append(html("i"));
    handle.addEventListener("dragstart", event => {
      const member = groupMembers(group)[0];
      if (member) onDragStart(event, member, group);
      else event.preventDefault();
    });
    handle.addEventListener("dragend", event => onDragEnd(event, draggedTab));
    handle.addEventListener("click", event => {
      event.stopPropagation();
      const member = groupMembers(group)[0];
      if (member && splitGroup(browser.selectedTab) !== group) browser.selectedTab = member;
    });
    // Keyboard alternative to drag. Move the whole group one top-level slot.
    handle.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const before = event.key === "ArrowLeft";
      const other = before ? box.previousElementSibling : box.nextElementSibling;
      if (!other) return;
      const native = [...splitEntries].find(([, entry]) => entry.box === other)?.[0] || tabFromItem(other);
      if (!native) return;
      event.preventDefault();
      event.stopPropagation();
      moveNativeNextTo(group, { native, before });
      schedule();
    });
    box.append(handle);
    return {box, handle};
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
        splitMeasureObserver.unobserve(entry.item);
        entry.item.remove(); entries.delete(tab);
      }
    }
    const groups = [...new Set(tabs.map(splitGroup).filter(Boolean))];
    const groupCount = String(groups.length);
    if (row.style.getPropertyValue("--op-split-count") !== groupCount) {
      row.style.setProperty("--op-split-count", groupCount);
      scheduleGeometry();
    }
    const order = [];
    const groupItems = new Map();
    for (const group of groups) {
      if (!splitEntries.has(group)) splitEntries.set(group, createSplitEntry(group));
      if (!splitColors.has(group)) splitColors.set(group, splitPalette[nextSplitColor++ % splitPalette.length]);
      const entry = splitEntries.get(group);
      entry.box.style.setProperty("--op-split-color", splitColors.get(group));
      entry.box.toggleAttribute("data-op-split-active", group === splitGroup(browser.selectedTab));
      groupItems.set(group, []);
    }
    for (let index = 0; index < tabs.length; index++) {
      const tab = tabs[index];
      let entry = entries.get(tab);
      if (!entry) {
        entry = createEntry(tab);
        entries.set(tab, entry);
        splitMeasureObserver.observe(entry.item);
      }
      const label = tab.label || tab.getAttribute("label") || "New tab";
      const selected = tab === browser.selectedTab;
      entry.item.toggleAttribute("data-selected", selected);
      const group = splitGroup(tab);
      const split = isSplit(tab);
      entry.item.toggleAttribute("data-op-split", split);
      entry.item.toggleAttribute("data-op-split-active", split && Boolean(group && group === splitGroup(browser.selectedTab)));
      // First/last flags are assigned after groups are laid out in visual order.
      entry.item.removeAttribute("data-op-split-prev");
      entry.item.removeAttribute("data-op-split-next");
      if (split) entry.item.style.setProperty("--op-split-color", splitColors.get(group) || splitPalette[0]);
      else entry.item.style.removeProperty("--op-split-color");
      entry.item.toggleAttribute("data-pinned", Boolean(tab.pinned));
      entry.item.toggleAttribute("data-busy", tab.hasAttribute("busy"));
      entry.item.toggleAttribute("data-unloaded", !selected && (tab.hasAttribute("pending") || tab.hasAttribute("discarded")));
      const muted = tab.hasAttribute("muted");
      const audible = tab.hasAttribute("soundplaying") || tab.hasAttribute("soundplaying-scheduledremoval");
      entry.item.toggleAttribute("data-audio", audible && !muted);
      entry.item.toggleAttribute("data-muted", muted);
      entry.audio.title = muted ? "Tab muted" : audible ? "Playing audio" : "";
      entry.button.setAttribute("aria-selected", String(selected));
      entry.button.setAttribute("aria-label", label + (split ? ", Split View" : "") + (muted ? ", muted" : audible ? ", playing audio" : ""));
      if (entry.title.textContent !== label) entry.title.textContent = label;
      const src = favicon(tab);
      if (entry.src !== src) {
        entry.src = src;
        entry.img.hidden = !src;
        if (src) entry.img.setAttribute("src", src);
        else entry.img.removeAttribute("src");
      }
      if (group && splitEntries.has(group)) {
        const members = groupItems.get(group);
        if (!members.length) order.push(splitEntries.get(group).box);
        members.push(entry.item);
      } else {
        order.push(entry.item);
      }
    }
    // Reparent the mirrored UI only when membership actually changes.
    // Native tabs and their native Split View containers are not reparented.
    for (const [group, items] of groupItems) {
      const entry = splitEntries.get(group);
      entry.box.setAttribute("aria-label", "Split View, " + items.length + " tabs");
      entry.box.style.setProperty("--op-split-members", String(items.length));
      for (let i = 0; i < items.length; i++) {
        const node = items[i];
        if (entry.box.children[i + 1] !== node) entry.box.insertBefore(node, entry.box.children[i + 1] || null);
      }
    }
    placeStripOrder(order);
    for (const [group, entry] of splitEntries) {
      if (!groupItems.has(group)) { entry.box.remove(); splitEntries.delete(group); }
      else measureSplitGroup(group);
    }
    // Count each actual visible tab, including split members, but never
    // the group wrapper, handle or plus. Use rendered order, not native
    // indexes, because a split can collect non-adjacent native tabs.
    const visualTabs = Array.from(list.querySelectorAll(".oneplane-tab"));
    row.toggleAttribute("data-op-small-strip", visualTabs.length <= 3);
    for (let i = 0; i < visualTabs.length; i++) {
      visualTabs[i].toggleAttribute("data-op-first", i === 0);
      visualTabs[i].toggleAttribute("data-op-last", i === visualTabs.length - 1);
    }
    refreshIndicator();
    refreshIslandTitle();
    scheduleGeometry();
  }

  function schedule() {
    if (!dead && !frame) frame = window.requestAnimationFrame(sync);
  }
  function revealSelectedInStrip(){
    if(dead)return;
    const item=entries.get(browser.selectedTab)?.item;
    if(!item||!list.contains(item))return;
    // Never scroll ancestors (native toolbar, page, or window).
    const viewport=item.closest(".oneplane-island-lane")||list;
    if(viewport.scrollWidth<=viewport.clientWidth+1)return;
    const a=item.getBoundingClientRect(),b=viewport.getBoundingClientRect();
    const delta=a.left<b.left?a.left-b.left:a.right>b.right?a.right-b.right:0;
    if(Math.abs(delta)>1)viewport.scrollLeft+=delta;
  }
  function onSelect() {
    guardRestoredAddress(browser.selectedTab);
    guardPanelSwitch();
    updateEmptyAddress();
    schedule();
    alignAddressStart();
    window.requestAnimationFrame(revealSelectedInStrip);
  }
  function onTabOpenOrClose(){
    guardPanelSwitch();
    schedule();
  }
  const events = ["TabOpen", "TabClose", "TabMove", "TabAttrModified", "TabPinned", "TabUnpinned", "TabShow", "TabHide", "TabBrowserInserted", "TabBrowserDiscarded", "ZenTabRemovedFromSplit"];
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
    if (dragCommitFrame) window.cancelAnimationFrame(dragCommitFrame);
    dragCommitFrame = 0;
    tabObserver.disconnect();
    splitMeasureObserver.disconnect();
    workspaceObserver.disconnect();
    toolbarObserver.disconnect();
    actionObserver.disconnect();
    geometryObserver?.disconnect();
    contourResize?.disconnect();
    contourObserver?.disconnect();
    prefs.removeObserver(contourPrefPrefix,contourPreferenceObserver);
    contourObserved.clear();
    if(contourFrame)window.cancelAnimationFrame(contourFrame);
    contourFrame=0;
    if(bookmarks)for(const event of ["transitionrun","transitionend","transitioncancel"])
      bookmarks.removeEventListener(event,onContourTransition,true);
    hoverObserver?.disconnect();
    modeObserver?.disconnect();
    if(panelTimer)window.clearTimeout(panelTimer);
    if(panelSwitchTimer)window.clearTimeout(panelSwitchTimer);
    panelTimer=panelSwitchTimer=0;
    toolbarWrapper?.removeAttribute("data-op-panel-open");
    if (geometryFrame) window.cancelAnimationFrame(geometryFrame);
    clearHover();
    releaseAddressHold();
    clearTabHover();
    endDragVisual();
    cancelInsertion();
    draggedTab = null;
    draggedGroup = null;
    if (window[DRAG_CONTROLLER] === dragController) delete window[DRAG_CONTROLLER];
    window.removeEventListener("dragover", revealForDrag, true);
    window.removeEventListener("drop", onToolbarDrop, true);
    window.removeEventListener("dragleave", onWindowDragLeave, true);
    window.removeEventListener("dragexit", onWindowDragLeave, true);
    row.removeEventListener("pointerdown", rememberStartupSearch, true);
    if (restoreSearchTimer) window.clearTimeout(restoreSearchTimer);
    restoreSearchTimer=0;
    row.removeEventListener("dragover", onStripDragOver);
    row.removeEventListener("drop", onStripDrop);
    row.removeEventListener("dragleave", onStripDragLeave);
    splitZone.removeEventListener("dragover", onSplitDragOver);
    splitZone.removeEventListener("drop", onSplitDrop);
    splitZone.remove();
    for(const lane of [list,leftLane,rightLane]) lane.removeEventListener("scroll",refreshIndicator);
    islandTextAnimation?.cancel();
    prefs.removeObserver("zen.oneplane.hover-mode",hoverModePreferenceObserver);
    prefs.removeObserver("zen.oneplane.show-center-island",hoverModePreferenceObserver);
    prefs.removeObserver("zen.oneplane.tab-indicator", indicatorPreferenceObserver);
    window.removeEventListener("pointermove", trackTabPointer, true);
    window.removeEventListener("deactivate", clearTabHover);
    row.removeEventListener("pointerleave", leaveTabPointer);
    row.removeEventListener("focusin", focusTab);
    row.removeEventListener("focusout", blurTab);
    plus.removeEventListener("pointerleave", leaveTabPointer);
    plus.removeEventListener("click", onNewTabClick);
    try { browser.removeProgressListener(progressListener); } catch {}
    url.removeAttribute("data-op-empty");
    url.removeAttribute("data-op-url-ready");
    for (const name of ["--op-url-expanded-width", "--op-url-compact-width", "--op-url-anchor-left", "--op-url-anchor-top", "--op-url-header-height"]) url.style.removeProperty(name);
    toolbarWrapper?.style.removeProperty("--op-measured-toolbar-height");
    surface.remove();
    leftSpacer.remove();
    rightSpacer.remove();
    window.removeEventListener("pointermove", trackPointer, true);
    toolbarWrapper?.removeEventListener("pointerover", trackPointer);
    document.documentElement.removeEventListener("mouseleave", leaveWindow);
    window.removeEventListener("deactivate", onWindowDeactivate);
    window.removeEventListener("ZenCompactMode:Toggled", onCompactChanged);
    window.removeEventListener("ZenCompactMode:LayoutUpdate", onCompactChanged);
    window.removeEventListener("resize", onCompactChanged);
    addressObserver?.disconnect();
    clearAddressAnimation();
    addressBar()?.removeEventListener("pointerdown", onAddressInput, true);
    addressBar()?.removeEventListener("input", onAddressInput, true);
    addressBar()?.removeEventListener("toggle", onAddressMutation);
    if (addressFrame) window.cancelAnimationFrame(addressFrame);
    if(restoringAddressTimer)window.clearTimeout(restoringAddressTimer);
    restoringAddressTimer=0;restoringAddressTab=null;
    releaseShield();
    shield.remove();
    url.removeEventListener("focusout", onAddressMutation);
    restorePageActions();
    restoreWindowCaptions();
    for (const event of events) browser.tabContainer.removeEventListener(event, schedule);
    browser.tabContainer.removeEventListener("TabSelect", onSelect);
    for(const event of ["TabOpen","TabClose"])browser.tabContainer.removeEventListener(event,onTabOpenOrClose,true);
    window.removeEventListener("ZenWorkspaceDataChanged", schedule);
    window.removeEventListener("ZenViewSplitter:SplitViewActivated", schedule);
    window.removeEventListener("ZenViewSplitter:SplitViewDeactivated", schedule);
    window.removeEventListener("aftercustomization", schedule);
    row.remove();
    entries.clear();
    splitEntries.clear();
  }

  try {
    url.after(row);
    target.prepend(leftSpacer);
    row.after(rightSpacer);
    tabbox.append(shield, splitZone);
    window.addEventListener("dragover", revealForDrag, true);
    window.addEventListener("drop", onToolbarDrop, true);
    window.addEventListener("dragleave", onWindowDragLeave, true);
    window.addEventListener("dragexit", onWindowDragLeave, true);
    row.addEventListener("pointerdown", rememberStartupSearch, true);
    row.addEventListener("dragover", onStripDragOver);
    row.addEventListener("drop", onStripDrop);
    row.addEventListener("dragleave", onStripDragLeave);
    splitZone.addEventListener("dragover", onSplitDragOver);
    splitZone.addEventListener("drop", onSplitDrop);
    toolbarWrapper?.prepend(surface);
    movePageActions();
    const bar = document.getElementById("urlbar");
    if (bar) {
      addressObserver = new MutationObserver(onAddressMutation);
      bar.addEventListener("pointerdown", onAddressInput, true);
      bar.addEventListener("input", onAddressInput, true);
      bar.addEventListener("toggle", onAddressMutation);
      addressObserver.observe(bar, { attributes: true, attributeFilter: ["focused", "open", "textoverflow", "pageproxystate", "zen-floating-urlbar", "breakout-extend", "popover-open"] });
    }
    url.addEventListener("focusout", onAddressMutation);
    actionObserver.observe(url, { subtree: true, childList: true });
    alignAddressStart();
    applyHoverMode();
    sync();
    try { browser.addProgressListener(progressListener); } catch {}
    for(const lane of [list,leftLane,rightLane]) lane.addEventListener("scroll",refreshIndicator);
    prefs.addObserver("zen.oneplane.hover-mode",hoverModePreferenceObserver);
    prefs.addObserver("zen.oneplane.show-center-island",hoverModePreferenceObserver);
    prefs.addObserver("zen.oneplane.tab-indicator", indicatorPreferenceObserver);
    window.addEventListener("pointermove", trackTabPointer, true);
    window.addEventListener("deactivate", clearTabHover);
    row.addEventListener("pointerleave", leaveTabPointer);
    row.addEventListener("focusin", focusTab);
    row.addEventListener("focusout", blurTab);
    plus.addEventListener("pointerleave", leaveTabPointer);
    plus.addEventListener("click", onNewTabClick);
    for (const event of events) browser.tabContainer.addEventListener(event, schedule);
    browser.tabContainer.addEventListener("TabSelect", onSelect);
    for(const event of ["TabOpen","TabClose"])browser.tabContainer.addEventListener(event,onTabOpenOrClose,true);
    window.addEventListener("ZenWorkspaceDataChanged", schedule);
    window.addEventListener("ZenViewSplitter:SplitViewActivated", schedule);
    window.addEventListener("ZenViewSplitter:SplitViewDeactivated", schedule);
    window.addEventListener("aftercustomization", schedule);
    tabObserver.observe(browser.tabContainer, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ["label", "image", "selected", "hidden", "busy", "pinned", "active", "zen-workspace-id", "pending", "discarded", "soundplaying", "soundplaying-scheduledremoval", "muted", "zen-empty-tab", "split-view", "split-view-group"]
    });
    const wrapper = document.getElementById("zen-tabs-wrapper");
    if (wrapper && !browser.tabContainer.contains(wrapper)) {
      workspaceObserver.observe(wrapper, { subtree: true, childList: true, attributes: true, attributeFilter: ["active", "hidden"] });
    }
    toolbarObserver.observe(target, { childList: true });
    geometryObserver = new ResizeObserver(scheduleGeometry);
    observeGeometry();
    if(bookmarks){
      contourResize=new ResizeObserver(scheduleContour);
      observeContourNodes();
      contourObserver=new MutationObserver(records=>{
        if(records.some(r=>r.type==="childList"))observeContourNodes();
        if(records.some(r=>r.type==="childList"||r.target===bookmarks||
          contourObserved.has(r.target)||r.target.id==="PlacesToolbarItems"||
          r.target.id==="PlacesToolbar"||r.target.id==="personal-bookmarks"))scheduleContour();
      });
      contourObserver.observe(bookmarks,{subtree:true,childList:true,attributes:true,
        attributeFilter:["hidden","collapsed","style","class","label","overflowed","data-zr-bm-active","data-zr-bm-room"]});
      for(const event of ["transitionrun","transitionend","transitioncancel"])
        bookmarks.addEventListener(event,onContourTransition,true);
    }
    prefs.addObserver(contourPrefPrefix,contourPreferenceObserver);
    scheduleContour();
    if (toolbarWrapper) {
      hoverObserver = new MutationObserver(reconcilePanel);
      hoverObserver.observe(toolbarWrapper, { attributes: true, attributeFilter: [...PANEL_NATIVE_FLAGS,...PANEL_HOLD_FLAGS] });
      window.requestAnimationFrame(reconcilePanel);
      toolbarWrapper.addEventListener("pointerover", trackPointer);
    }
    modeObserver = new MutationObserver(onCompactChanged);
    modeObserver.observe(root, { attributes: true, attributeFilter: ["oneplane-active", "zen-compact-mode", "customizing", "inDOMFullscreen", "inFullscreen"] });
    window.addEventListener("pointermove", trackPointer, true);
    document.documentElement.addEventListener("mouseleave", leaveWindow);
    window.addEventListener("deactivate", onWindowDeactivate);
    window.addEventListener("ZenCompactMode:Toggled", onCompactChanged);
    window.addEventListener("ZenCompactMode:LayoutUpdate", onCompactChanged);
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
    snapshot();
    applied = true;
    for (const [name, value] of Object.entries(TARGET)) {
      if (prefs.getBoolPref(name) !== value) prefs.setBoolPref(name, value);
    }
    // Configure the hide target without forcing Compact Mode on.
    manager.hideToolbar();
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
