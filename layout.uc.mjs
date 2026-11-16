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
  let addressAnimation=null, addressIdentityAnimation=null, addressSelectionAnimation=null;
  let addressDiagnosticsFrame=0;
  let addressTransition = null;
  let addressWasOpen = false;
  let addressCompactWidth = 0;
  let addressAnchor = null;
  const ADDRESS_WAVE_OPEN = 420, ADDRESS_WAVE_CLOSE = 380;
  const ADDRESS_WAVE_SPREAD = .24;
  let addressSettling = false;
  let addressSettleTimer = 0;
  let addressFallbackFrame=0, addressClipHome=null;
  function stopAddressAnimations(){
    if(addressDiagnosticsFrame)window.cancelAnimationFrame(addressDiagnosticsFrame);
    if(addressFallbackFrame)window.cancelAnimationFrame(addressFallbackFrame);
    addressDiagnosticsFrame=addressFallbackFrame=0;
    const animations=[addressAnimation,addressIdentityAnimation,addressSelectionAnimation];
    addressAnimation=addressIdentityAnimation=addressSelectionAnimation=null;
    for(const animation of animations)animation?.cancel();
    if(addressClipHome){
      const {bar,value,priority}=addressClipHome;
      if(value)bar.style.setProperty("clip-path",value,priority);
      else bar.style.removeProperty("clip-path");
      addressClipHome=null;
    }
  }

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
    addressTransition = null;
    stopAddressAnimations();
    addressSettling = false;
    if (addressSettleTimer) window.clearTimeout(addressSettleTimer);
    addressSettleTimer = 0;
    url.removeAttribute("data-op-url-phase");
    url.toggleAttribute("data-op-url-ready", nativeInlineOpen(addressBar()));
    root.removeAttribute("oneplane-address-unblur");
    const bar = addressBar();
    bar?.removeAttribute("data-op-url-animating");
    bar?.removeAttribute("data-op-url-selection-fade");
    bar?.style.removeProperty("--op-url-live-width");
    bar?.style.removeProperty("--op-url-live-clip");
    bar?.style.removeProperty("--op-url-selection-alpha");
    bar?.removeAttribute("data-op-url-fluid");
    reconcileTabCascade();
  }
  function addressWaveDepth(progress,x){
    const t=Math.max(0,Math.min(1,(progress-ADDRESS_WAVE_SPREAD*x)/(1-ADDRESS_WAVE_SPREAD)));
    return t*t*(3-2*t);
  }
  function addressWaveClip(width,height,header,progress,radius=8,layoutWidth=width){
    width=Math.max(1,width);height=Math.max(1,height);
    const rightInset=Math.max(0,layoutWidth-width);
    header=Math.min(height,Math.max(1,header));
    const r=Math.min(radius,width/2,header/2);
    const depth=x=>header+(height-header)*addressWaveDepth(progress,x);
    if(progress<=0 || progress>=1 || height-header<.5){
      const bottom=progress>=1?0:Math.max(0,height-header);
      return "inset(0px "+rightInset.toFixed(2)+"px "+bottom.toFixed(2)+"px 0px round var(--op-url-radius))";
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
  // Prepare all keyframes once. Both axes share the same smooth timeline.
  // The lower edge is relative to the live border-box height: native
  // suggestions can arrive after opening without restarting the animation.
  function addressMotionSample(name,from,to,t){
    t=Math.max(0,Math.min(1,t));
    const s=t*t*(3-2*t);
    const horizontal=name==="opening"?s+.35*s*(1-s):s-.35*s*(1-s);
    const alpha=from.selection??1;
    return {width:from.width+(to.width-from.width)*horizontal,
      reveal:from.reveal+(to.reveal-from.reveal)*s,
      selection:name==="opening"?alpha+(1-alpha)*s:alpha*(1-Math.min(1,s/.82))};
  }
  function addressFluidClip(width,header,progress,radius=8,shape=false){
    const w=Math.max(1,width),r=Math.max(0,Math.min(radius,w/2,header/2));
    const px=n=>Number(n.toFixed(3))+"px";
    const y=(x,dy=0)=>{
      const depth=addressWaveDepth(progress,Math.max(0,Math.min(1,x/w)));
      return "calc("+px(header*(1-depth)+dy)+" + "+Number((100*depth).toFixed(4))+"%)";
    };
    if(shape){
      // Identical command topology at every offset, including both endpoints.
      const pt=(x,dy=0)=>px(x)+" "+y(x,dy);
      const edge=(w-r);
      const commands=["from "+px(r)+" 0px","hline to "+px(edge),
        "curve to "+px(w)+" "+px(r)+" with "+px(w)+" 0px",
        "vline to "+y(w,-r),
        "curve to "+pt(edge)+" with "+px(w)+" "+y(w)];
      for(let i=0;i<4;i++){
        const x0=edge-(edge-r)*i/4,x1=edge-(edge-r)*(i+1)/4;
        commands.push("curve to "+pt(x1)+" with "+pt(x0+(x1-x0)/3)+" / "+pt(x0+2*(x1-x0)/3));
      }
      commands.push("curve to 0px "+y(0,-r)+" with 0px "+y(0),
        "vline to "+px(r),"curve to "+px(r)+" 0px with 0px 0px","close");
      return "shape("+commands.join(", ")+")";
    }
    // Compatible polygon fallback. Fixed topology, rounded-corner samples
    // and relative heights. No per-frame path serialization or layout reads.
    const p=[],point=(x,v)=>p.push(px(x)+" "+v);
    for(let i=0;i<=4;i++){
      const t=i*Math.PI/8;point(r-r*Math.cos(t),px(r-r*Math.sin(t)));
    }
    for(let i=0;i<=4;i++){
      const t=i*Math.PI/8;point(w-r+r*Math.sin(t),px(r-r*Math.cos(t)));
    }
    for(let i=0;i<=4;i++){
      const t=i*Math.PI/8;point(w-r+r*Math.cos(t),y(w,-r+r*Math.sin(t)));
    }
    for(let i=0;i<=8;i++){
      const x=(w-r)-(w-2*r)*i/8;point(x,y(x));
    }
    for(let i=0;i<=4;i++){
      const t=i*Math.PI/8;point(r-r*Math.sin(t),y(0,-r+r*Math.cos(t)));
    }
    return "polygon("+p.join(", ")+")";
  }
  function addressFluidFrames(name,from,to,layoutWidth,header,radius=8,shape=false){
    // These are interpolation knots, not frames or an FPS limit.
    return Array.from({length:17},(_,i)=>{
      const offset=i/16,v=addressMotionSample(name,from,to,offset);
      return {offset,clipPath:addressFluidClip(v.width,header,v.reveal,radius,shape),
        translate:""+(v.width-layoutWidth).toFixed(3)+"px 0px",
        selection:(v.selection*100).toFixed(3)+"%"};
    });
  }
  function emptyAddressState(explicitEmpty,uri,pending,restoring){
    if(explicitEmpty)return true;
    if(pending||restoring)return false;
    return /^(about:(blank|newtab|home|privatebrowsing))(?:[?#].*)?$/i.test(uri);
  }
  function cascadeWaveSchedule(items,phase,geometry,opening){
    const span=phase?.duration??(opening?180:0);
    const step=Math.min(opening?24:32,(opening?Math.max(0,span-85):240)/Math.max(1,items.length-1));
    let previous=-step;
    return items.map((v,i)=>{
      let edge=opening?span:0;
      if(phase){
        const covered=t=>{
          const sample=addressMotionSample(phase.name,phase.from,phase.to,t);
          if(geometry.left+sample.width<v.left)return false;
          if(!v.bookmark)return true;
          const depth=addressWaveDepth(sample.reveal,Math.max(0,Math.min(1,(v.left-geometry.left)/Math.max(1,sample.width))));
          return geometry.top+geometry.header+Math.max(0,geometry.height-geometry.header)*depth>=v.top;
        };
        const crossed=t=>opening?covered(t):!covered(t);
        let lo=0,hi=1;
        if(crossed(0))hi=0;
        else if(!crossed(1))lo=1;
        else for(let j=0;j<16;j++){
          const m=(lo+hi)/2;
          if(crossed(m))hi=m;else lo=m;
        }
        edge=(lo+hi)/2*span;
      }
      let delay,duration;
      if(opening){
        duration=Math.min(85,Math.max(1,span));
        const limit=Math.max(0,span-duration-step*(items.length-1-i));
        delay=Math.min(limit,Math.max(previous+step,edge-duration));
      }else{
        duration=190;
        delay=Math.max(previous+step,edge);
      }
      previous=delay;
      return {delay,duration};
    });
  }
  function cascadeRevealFrames(v={}){
    const opacity=Math.max(0,Math.min(1,v.opacity??0));
    const x=Math.max(0,Math.min(1,v.x??0)),y=Math.max(0,Math.min(1,v.y??0));
    // The whole painted card remains within its resting slot. All
    // easing control points are monotonic and have no external overshoot.
    if(x>=.999&&y>=.999&&opacity>=.999)
      return [{offset:0,scale:"1 1",opacity:1},{offset:1,scale:"1 1",opacity:1}];
    return [
      {offset:0,scale:x+" "+y,opacity,easing:"cubic-bezier(.18,.7,.25,1)"},
      {offset:.55,scale:"1 1",opacity:1,easing:"cubic-bezier(.3,0,.5,1)"},
      {offset:.78,scale:"0.93 0.93",opacity:1,easing:"cubic-bezier(.2,.7,.3,1)"},
      {offset:1,scale:"1 1",opacity:1}
    ];
  }
  function cascadeFadeFrames(opacity,opening){
    return [{opacity:Math.max(0,Math.min(1,opacity))},{opacity:opening?0:1}];
  }
  // Shared address-wave choreography. Each visible item gets a fixed
  // small set of keyframes; all measurement is batched before writes.
  const TAB_WAVE_SELECTOR=".oneplane-tab,.oneplane-split-handle,.oneplane-title-island,.oneplane-new-tab";
  const BOOKMARK_WAVE_SELECTOR="#PlacesToolbarItems > :is(toolbarbutton,toolbaritem,toolbarseparator),#PlacesChevron,#OtherBookmarks";
  let cascadeState="idle",cascadeGeneration=0,cascadeHandoffFrame=0;
  const cascadeAnimations=new Map(),cascadeDecorations=new Set();
  let cascadePointer=null,bookmarkInertHome=null;
  function setBookmarkWave(state){
    if(!bookmarks)return;
    if(state){
      if(bookmarkInertHome===null)bookmarkInertHome={present:bookmarks.hasAttribute("inert"),value:bookmarks.getAttribute("inert")};
      bookmarks.setAttribute("inert","");
      root.setAttribute("data-op-bookmark-wave",state);
      bookmarks.setAttribute("data-op-bookmark-wave",state);
    }else{
      bookmarks.removeAttribute("data-op-bookmark-wave");
      root.removeAttribute("data-op-bookmark-wave");
      if(bookmarkInertHome!==null){
        if(bookmarkInertHome.present)bookmarks.setAttribute("inert",bookmarkInertHome.value);
        else bookmarks.removeAttribute("inert");
      }
      bookmarkInertHome=null;
    }
    window.__zenMagneticBookmarksShared?.syncAddressState?.();
  }
  function cancelCascadeAnimations(){
    for(const [node,anim] of cascadeAnimations){
      anim.cancel();
      node.removeAttribute("data-op-cascade-member");
      node.removeAttribute("data-op-cascade-frame");
      node.removeAttribute("data-op-bookmark-wave-member");
    }
    cascadeAnimations.clear();
    for(const {node,anim} of cascadeDecorations){
      anim.cancel();node.removeAttribute("data-op-bookmark-wave-card");
    }
    cascadeDecorations.clear();
  }
  function cancelCascadeHandoff(){
    if(cascadeHandoffFrame)window.cancelAnimationFrame(cascadeHandoffFrame);
    cascadeHandoffFrame=0;
  }
  function resetTabCascade(){
    cascadeGeneration++;
    cancelCascadeHandoff();
    row.removeAttribute("data-op-cascade");
    cascadeState="idle";
    row.inert=false;
    cancelCascadeAnimations();
    setBookmarkWave(null);
    if(!dead){refreshIndicator();scheduleContour();}
  }
  function settleHidden(generation){
    if(dead||generation!==cascadeGeneration)return;
    cascadeState="hidden";
    row.setAttribute("data-op-cascade","hidden");
    setBookmarkWave("hidden");
    cancelCascadeAnimations();
    clearTabHover();hideIndicator();islandTextAnimation?.cancel();
  }
  function finishCascadeHandoff(generation){
    if(dead||generation!==cascadeGeneration)return;
    cascadeHandoffFrame=window.requestAnimationFrame(()=>{
      cascadeHandoffFrame=0;
      if(dead||generation!==cascadeGeneration)return;
      resetTabCascade();
      clearTabHover();
    });
  }
  function collectCascadeSlots(previous){
    const viewport=row.getBoundingClientRect(),cache=new Map();
    const bounds=node=>{
      if(!cache.has(node))cache.set(node,node.getBoundingClientRect());
      return cache.get(node);
    };
    const tabNodes=Array.from(row.querySelectorAll(TAB_WAVE_SELECTOR));
    const bmNodes=bookmarks&&!bookmarks.hidden&&!bookmarks.collapsed?
      Array.from(bookmarks.querySelectorAll(BOOKMARK_WAVE_SELECTOR)).filter(n=>!n.parentElement?.closest(BOOKMARK_WAVE_SELECTOR)):[];
    const result=[];
    for(const [nodes,bookmark] of [[tabNodes,false],[bmNodes,true]]){
      for(const node of nodes){
        if(!node.isConnected||node.hidden||node.collapsed)continue;
        const rect=node.getBoundingClientRect();
        // XUL bookmarks need not expose HTMLElement.offsetWidth.
        // Their native text is never scaled by our wave.
        const width=bookmark?rect.width:node.offsetWidth,height=bookmark?rect.height:node.offsetHeight;
        if(!(width>0&&height>0))continue;
        const css=window.getComputedStyle(node);
        if(css.display==="none"||bookmark&&css.visibility!=="visible")continue;
        const scale=!css.scale||css.scale==="none"?[1,1]:css.scale.split(/\s+/).map(Number);
        const tracked=cascadeAnimations.has(node);
        const hidden=previous!=="idle"&&!tracked;
        const fullyHidden=hidden||previous==="hidden";
        const center=(rect.left+rect.right)/2,cy=(rect.top+rect.bottom)/2;
        const left=center-width/2,right=center+width/2,top=cy-height/2;
        const lane=bookmark?null:node.closest(".oneplane-island-lane");
        const region=bookmark?bookmarks:(lane&&lane.offsetWidth>0?lane:node.closest(".oneplane-tab-list")||row);
        const clip=region===row?viewport:bounds(region);
        const group=bookmark?null:node.closest(".oneplane-split-group");
        if(right<=clip.left||left>=clip.right)continue;
        result.push({node,bookmark,group,left,right,top,
          x:fullyHidden?0:(Number.isFinite(scale[0])?scale[0]:1),
          y:fullyHidden?0:(Number.isFinite(scale[1])?scale[1]:Number.isFinite(scale[0])?scale[0]:1),
          opacity:fullyHidden?0:Math.max(0,Math.min(1,parseFloat(css.opacity)||0))});
      }
    }
    return result;
  }
  function animateTabCascade(opening,phase=null){
    if(dead||!hoverSupported()){resetTabCascade();return;}
    const previous=cascadeState;
    if(opening&&(previous==="hidden"||previous==="hiding")||!opening&&(previous==="idle"||previous==="showing"))return;
    if(row.hasAttribute("data-op-dragging"))return;
    cancelCascadeHandoff();
    if(panelLastPointer)cascadePointer={...panelLastPointer};
    cancelHoverTimer();
    const generation=++cascadeGeneration;
    if(!addressMotionEnabled()){
      if(opening){row.inert=true;settleHidden(generation);}else resetTabCascade();
      return;
    }
    // Suspend Magnetic Hover synchronously, before reading resting slots.
    // Preserve the tab hover geometry until the opening fade is invisible.
    if(bookmarks){
      root.setAttribute("data-op-bookmark-wave",opening?"hiding":"showing");
      window.__zenMagneticBookmarksShared?.syncAddressState?.();
    }
    const slots=collectCascadeSlots(previous);
    const groupAlpha=new Map();
    for(const v of slots)if(v.group&&!groupAlpha.has(v.group)){
      groupAlpha.set(v.group,previous==="idle"?1:cascadeAnimations.has(v.group)?
        parseFloat(window.getComputedStyle(v.group).opacity)||0:0);
    }
    const bar=addressBar(),rect=bar?.getBoundingClientRect();
    const geometry={left:parseFloat(url.style.getPropertyValue("--op-url-anchor-left"))||url.getBoundingClientRect().left,
      top:parseFloat(url.style.getPropertyValue("--op-url-anchor-top"))||rect?.top||0,
      header:parseFloat(url.style.getPropertyValue("--op-url-header-height"))||30,
      height:rect?.height||30};
    const hadIndicator=indicatorShown,indicatorOpacity=previous==="idle"?1:
      cascadeAnimations.has(indicator)?parseFloat(window.getComputedStyle(indicator).opacity)||0:0;
    cancelCascadeAnimations();
    cascadeState=opening?"hiding":"showing";
    row.setAttribute("data-op-cascade",cascadeState);
    row.inert=true;
    setBookmarkWave(cascadeState);
    if(!opening){
      indicatorHover=null;hoverX=null;
      hideIndicator();refreshIndicator(true);
    }
    if(indicatorFrame)window.cancelAnimationFrame(indicatorFrame);
    indicatorFrame=0;iv=0;last=0;
    islandTextAnimation?.cancel();
    const start=phase&&addressAnimation?.startTime;
    const jobs=[],groupTiming=new Map();
    const play=(node,frames,timing,attr)=>{
      try{
        node.setAttribute(attr,"true");
        const anim=node.animate(frames,{...timing,fill:"both",easing:"linear"});
        cascadeAnimations.set(node,anim);
        if(start!==null&&start!==undefined&&Number.isFinite(start))anim.startTime=start;
        jobs.push(anim.finished);return true;
      }catch(error){
        node.removeAttribute(attr);
        window.console.warn("[OnePlane] Wave animation fallback:",error);
        return false;
      }
    };
    const selected=entries.get(browser.selectedTab)?.item;
    const indicatorItem=opening&&indicatorHover&&list.contains(indicatorHover)?indicatorHover:selected;
    let indicatorPlayed=false;
    // Two rows share the same address trajectory but independent stagger.
    // No quadratic global timeline and no repeated geometry sampling.
    for(const bookmark of [false,true]){
      const ordered=slots.filter(v=>v.bookmark===bookmark).sort((a,b)=>opening?a.left-b.left:b.left-a.left);
      const timings=cascadeWaveSchedule(ordered,phase,geometry,opening);
      for(let i=0;i<ordered.length;i++){
        const v=ordered[i],timing=timings[i];
        let frames=opening||bookmark?cascadeFadeFrames(v.opacity,opening):cascadeRevealFrames(v);
        // On reopening during a return, hold the card's current scale
        // during its fade rather than snapping back to full size.
        if(opening&&!bookmark&&previous==="showing")
          frames=frames.map(k=>({...k,scale:v.x+" "+v.y}));
        play(v.node,frames,timing,bookmark?"data-op-bookmark-wave-member":"data-op-cascade-member");
        if(v.group){
          const old=groupTiming.get(v.group);
          if(!old||opening&&old.delay<timing.delay)groupTiming.set(v.group,timing);
        }
        if(!opening&&bookmark&&v.node.matches("toolbarbutton.bookmark-item")){
          // Native XUL labels/icons only fade. The decorative card alone
          // has a bounded spring; it never alters the native text metrics.
          try{
            v.node.setAttribute("data-op-bookmark-wave-card","true");
            const effect=new window.KeyframeEffect(v.node,[
              {offset:0,transform:"scale(0)",opacity:0},
              {offset:.55,transform:"scale(1)",opacity:.18},
              {offset:.78,transform:"scale(.93)",opacity:.12},
              {offset:1,transform:"scale(1)",opacity:0}
            ],{...timing,fill:"both",easing:"ease-out",pseudoElement:"::before"});
            if(effect.pseudoElement!=="::before")throw Error("pseudo unsupported");
            const anim=new window.Animation(effect,document.timeline);
            cascadeDecorations.add({node:v.node,anim});anim.play();
            if(start!==null&&start!==undefined&&Number.isFinite(start))anim.startTime=start;
            jobs.push(anim.finished);
          }catch{v.node.removeAttribute("data-op-bookmark-wave-card");}
        }
        if(v.node===indicatorItem&&(opening?hadIndicator:indicatorShown)){
          indicatorPlayed=play(indicator,cascadeFadeFrames(indicatorOpacity,opening),
            opening?timing:{delay:timing.delay+28,duration:105},"data-op-cascade-member");
        }
      }
    }
    if(!indicatorPlayed&&opening)hideIndicator();
    for(const [group,timing] of groupTiming)
      play(group,cascadeFadeFrames(groupAlpha.get(group)??0,opening),
        {delay:timing.delay,duration:opening?timing.duration:85},"data-op-cascade-frame");
    Promise.allSettled(jobs).then(()=>opening?settleHidden(generation):finishCascadeHandoff(generation));
  }
  function reconcileTabCascade(){
    if(dead||!hoverSupported()){if(cascadeState!=="idle")resetTabCascade();return;}
    if(addressTransition||addressSettling)return;
    const open=nativeInlineOpen(addressBar());
    if(open&&(cascadeState==="idle"||cascadeState==="showing"))animateTabCascade(true);
    else if(!open&&(cascadeState==="hidden"||cascadeState==="hiding")){
      holdToolbarAfterDismiss();
      animateTabCascade(false);
    }
  }

  function currentAddressVisual(){
    const a=addressTransition;
    if(!a)return null;
    const elapsed=addressAnimation?Number(addressAnimation.currentTime??0):window.performance.now()-a.start;
    return addressMotionSample(a.name,a.from,a.to,elapsed/a.duration);
  }
  function startAddressDiagnostics(a){
    if(!prefs.getBoolPref("zen.oneplane.address-diagnostics",false))return;
    let last=null;
    const intervals=[];
    function sample(now){
      if(dead||addressTransition!==a)return;
      if(last!==null)intervals.push(now-last);
      last=now;
      addressDiagnosticsFrame=window.requestAnimationFrame(sample);
    }
    a.report=()=>{
      if(addressDiagnosticsFrame)window.cancelAnimationFrame(addressDiagnosticsFrame);
      addressDiagnosticsFrame=0;
      const sorted=intervals.slice().sort((x,y)=>x-y);
      const percentile=p=>sorted.length?Number(sorted[Math.min(sorted.length-1,Math.floor(p*(sorted.length-1)))].toFixed(2)):null;
      window.console.info("[OnePlane address]",{phase:a.name,engine:a.engine,frames:intervals.length,
        medianMs:percentile(.5),p95Ms:percentile(.95),maxMs:percentile(1),
        approximateHz:sorted.length?Math.round(1000/(intervals.reduce((x,y)=>x+y,0)/intervals.length)):null,
        frameRatePref:prefs.getIntPref("layout.frame_rate",-1)});
    };
    addressDiagnosticsFrame=window.requestAnimationFrame(sample);
  }
  function finishAddressPhase(a){
    if(dead||addressTransition!==a)return;
    a.report?.();
    if(a.name!=="closing-wave"){
      clearAddressAnimation();
      return;
    }
    // Keep the last compact silhouette while native focus and popover
    // dismissal settle. The layout changes once, at the end of motion.
    addressTransition=null;
    addressSettling=true;
    url.setAttribute("data-op-url-phase","settling");
    const bar=addressBar();
    stopAddressAnimations();
    if(bar){
      bar.style.setProperty("--op-url-live-width",Math.max(1,a.to.width).toFixed(3)+"px");
      bar.style.setProperty("--op-url-live-clip","inset(0 0 max(0px, calc(100% - var(--op-url-header-height))) 0 round var(--op-url-radius))");
      bar.style.setProperty("--op-url-selection-alpha","0%");
    }
    finishDismissUrl();
    if(!addressSettling)return;
    if(!inlinePopoverPresent(addressBar())){
      clearAddressAnimation();
      addressWasOpen=false;
    }else{
      addressSettleTimer=window.setTimeout(()=>{
        if(dead||!addressSettling)return;
        clearAddressAnimation();
        addressWasOpen=nativeInlineOpen(addressBar());
      },600);
    }
  }
  function beginAddressPhase(name,from,to,duration,layoutWidth=Math.max(from.width,to.width)){
    // Cancel only after sampling the previous visual position. Keep
    // the native editor, selection, results and popup anchors intact.
    stopAddressAnimations();
    const bar=addressBar();
    if(!bar){clearAddressAnimation();return;}
    const full=Math.max(1,layoutWidth);
    const header=Math.max(1,parseFloat(url.style.getPropertyValue("--op-url-header-height"))||addressAnchor?.height||30);
    const radius=parseFloat(window.getComputedStyle(bar).getPropertyValue("--op-url-radius"))||8;
    const shape=window.CSS?.supports("clip-path",addressFluidClip(Math.max(1,from.width),header,from.reveal,radius,true))??false;
    const frames=addressFluidFrames(name,from,to,full,header,radius,shape);
    const a={name,from,to,duration,start:window.performance.now(),engine:shape?"waapi-shape":"waapi-polygon"};
    addressTransition=a;
    url.setAttribute("data-op-url-phase",name);
    root.toggleAttribute("oneplane-address-unblur",name.startsWith("closing"));
    bar.setAttribute("data-op-url-animating","true");
    bar.setAttribute("data-op-url-fluid","true");
    bar.toggleAttribute("data-op-url-selection-fade",name==="closing-wave"||(from.selection??1)<1);
    bar.style.setProperty("--op-url-live-width",full.toFixed(3)+"px");
    bar.style.setProperty("--op-url-live-clip",frames[0].clipPath);
    bar.style.setProperty("--op-url-selection-alpha",frames[0].selection);
    const timing={duration,easing:"linear",fill:"both"};
    const identity=bar.querySelector("#identity-box");
    try{
      addressAnimation=bar.animate(frames.map(({offset,clipPath})=>({offset,clipPath})),timing);
      // Verify the cascade, not just support for Element.animate().
      // A user theme can still override clip-path with !important.
      addressAnimation.pause();
      addressAnimation.currentTime=duration/2;
      const mid=window.getComputedStyle(bar).clipPath;
      addressAnimation.currentTime=0;
      const first=window.getComputedStyle(bar).clipPath;
      if(mid===first)throw new Error("Native clip animation overridden");
      addressAnimation.play();
      const start=addressAnimation.startTime;
      if(identity){
        addressIdentityAnimation=identity.animate(frames.map(({offset,translate})=>({offset,translate})),timing);
        if(start!==null)addressIdentityAnimation.startTime=start;
      }
      if(bar.hasAttribute("data-op-url-selection-fade")){
        addressSelectionAnimation=bar.animate(frames.map(({offset,selection})=>({offset,"--op-url-selection-alpha":selection})),timing);
        if(start!==null)addressSelectionAnimation.startTime=start;
      }
      addressAnimation.onfinish=()=>finishAddressPhase(a);
    }catch(error){
      // Compatibility fallback for a conflicting user theme or old Gecko.
      // Normally unused. Preserve a functional native editor.
      stopAddressAnimations();
      a.engine="fallback";
      window.console.warn("[OnePlane] Native address animation unavailable:",error);
      addressClipHome={bar,value:bar.style.getPropertyValue("clip-path"),priority:bar.style.getPropertyPriority("clip-path")};
      a.start=window.performance.now();
      const draw=now=>{
        if(dead||addressTransition!==a)return;
        const t=Math.max(0,Math.min(1,(now-a.start)/duration));
        const v=addressMotionSample(name,from,to,t);
        bar.style.setProperty("clip-path",addressFluidClip(v.width,header,v.reveal,radius,shape),"important");
        bar.style.setProperty("--op-url-selection-alpha",(v.selection*100).toFixed(3)+"%");
        if(t<1)addressFallbackFrame=window.requestAnimationFrame(draw);
        else finishAddressPhase(a);
      };
      draw(a.start);
    }
    startAddressDiagnostics(a);
    animateTabCascade(name==="opening",a);
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
    const from = currentAddressVisual() || { width: widths.expanded, reveal: 1, selection:1 };
    // Reverse an interrupted opening from its current visual position.
    // Shrink the width and the result wave together, in one phase.
    const to={width:widths.compact,reveal:0};
    beginAddressPhase("closing-wave",from,to,addressWaveDuration(from,to,widths,ADDRESS_WAVE_CLOSE),widths.expanded);
    return true;
  }
  function onAddressMutation() {
    if (dead) return;
    updateAddressAnimation();
    reconcileTabCascade();
    if(!addressTransition&&!addressSettling&&!nativeInlineOpen(addressBar()))alignAddressStart();
  }
  function onAddressInput() {
    // Typing or clicking the real input during closing reverses the close.
    if (!addressSettling && !addressTransition?.name.startsWith("closing")) {
      if(!addressTransition)rememberCompactAddress();
      return;
    }
    const from = currentAddressVisual() || { width: addressWidths().compact, reveal: 0, selection:0 };
    addressSettling = false;
    if (addressSettleTimer) window.clearTimeout(addressSettleTimer);
    addressSettleTimer = 0;
    const widths=addressWidths(),to={width:widths.expanded,reveal:1};
    beginAddressPhase("opening",from,to,addressWaveDuration(from,to,widths,ADDRESS_WAVE_OPEN));
  }
  function alignAddressStart() {
    if (addressFrame) return;
    addressFrame = window.requestAnimationFrame(() => {
      addressFrame = 0;
      if(addressTransition||addressSettling)return;
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
    if(url.hasAttribute("data-op-empty")!==empty){
      url.toggleAttribute("data-op-empty",empty);
      // CSS changes the anchor width synchronously; update its matching
      // spacer bias in the same transaction, before the next paint.
      centerToolbar();
      scheduleGeometry();
    }
  }
  const progressListener = {
    onLocationChange() { updateEmptyAddress(); alignAddressStart(); }
  };
  const actionObserver = new MutationObserver(records => {
    // Native suggestion rows mutate many times during opening. They
    // cannot change the page-action placement; ignore those mutations.
    const selector=actionIds.map(id=>"#"+id).join(",");
    const relevant=records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>
      node.nodeType===1&&(node.matches?.(selector)||node.querySelector?.(selector))));
    if(!dead&&relevant){movePageActions();if(!addressTransition&&!addressSettling)alignAddressStart();}
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
  function hubPanelWidth(left,right,viewport){
    const room=Math.max(1,viewport-left-8);
    return Math.max(1,Math.min(Math.round(room),Math.max(180,Math.round(right-left))));
  }
  function hubWorkspaceBrowserEligible(tab,active){
    if(!tab||!active||tab.closing||tab.hasAttribute("zen-empty-tab"))return false;
    if(tab.hasAttribute("zen-essential"))return !tab.hidden&&!tab.collapsed;
    return tab.getAttribute("zen-workspace-id")===active;
  }
  function hubWorkspaceSnapshot(manager) {
    try {
      if (!manager || manager.workspaceEnabled === false ||
          typeof manager.getWorkspaces !== "function" || typeof manager.changeWorkspaceWithID !== "function") return null;
      const native = manager.getWorkspaces();
      if (!Array.isArray(native)) return null;
      const seen = new Set(), spaces = [];
      for (const space of native) {
        if (typeof space?.uuid !== "string" || !space.uuid || seen.has(space.uuid)) continue;
        seen.add(space.uuid);
        spaces.push({id:space.uuid,name:typeof space.name==="string" && space.name.trim()?space.name:"Unnamed space",
          icon:typeof space.icon==="string" && space.icon.length<=24 && !space.icon.includes(".svg")?space.icon:"",
          active:space.uuid===manager.activeWorkspace});
      }
      return spaces;
    } catch { return null; }
  }
  function hubOtherDisplay(source,dest,x,y){
    return !!source&&!!dest&&(source.x!==dest.x||source.y!==dest.y)&&x>=dest.x&&x<dest.x+dest.width&&y>=dest.y&&y<dest.y+dest.height;
  }
  function hubSnapRect(display,x,y){
    if(!display||![display.x,display.y,display.width,display.height,x,y].every(Number.isFinite)||display.width<=0||display.height<=0)return null;
    const {x:left,y:top,width,height}=display;
    const edge=Math.max(24,Math.min(100,Math.round(Math.min(width,height)*.085)));
    const right=left+width,bottom=top+height,hw=Math.floor(width/2),hh=Math.floor(height/2);
    const h=x-left<=edge?"left":right-x<=edge?"right":"",v=y-top<=edge?"top":bottom-y<=edge?"bottom":"";
    if(h&&v)return {x:h==="left"?left:left+hw,y:v==="top"?top:top+hh,width:h==="left"?hw:width-hw,height:v==="top"?hh:height-hh,mode:h+"-"+v};
    if(v==="top")return {x:left,y:top,width,height,mode:"maximize"};
    if(h)return {x:h==="left"?left:left+hw,y:top,width:h==="left"?hw:width-hw,height,mode:h};
    if(v==="bottom")return {x:left,y:top+hh,width,height:height-hh,mode:"bottom"};
    const w=Math.round(width*.72),ht=Math.round(height*.74);
    return {x:Math.max(left,Math.min(right-w,Math.round(x-w/2))),y:Math.max(top,Math.min(bottom-ht,Math.round(y-ht/2))),width:w,height:ht,mode:"center"};
  }
  // Shared monitor work-area geometry and experimental chrome preview.
  let placementPreview=null,placementLabel=null,placementKey="";
  function desktopDisplayAt(x,y){
    if(!Number.isFinite(x)||!Number.isFinite(y))return null;
    try{
      const sm=Cc["@mozilla.org/gfx/screenmanager;1"].getService(Ci.nsIScreenManager);
      const s=sm.screenForRect(Math.round(x),Math.round(y),1,1),l={},t={},w={},h={};
      s.GetAvailRectDisplayPix(l,t,w,h);
      const d={x:l.value,y:t.value,width:w.value,height:h.value};
      return x>=d.x&&x<d.x+d.width&&y>=d.y&&y<d.y+d.height?d:null;
    }catch{return null;}
  }
  function placementAt(x,y){const d=desktopDisplayAt(x,y);return d?hubSnapRect(d,x,y):null;}
  function pointInSourceWindow(x,y){
    return x>=window.screenX&&x<window.screenX+window.outerWidth&&y>=window.screenY&&y<window.screenY+window.outerHeight;
  }
  function clearPlacementPreview(remove=false){
    placementKey="";
    if(placementPreview&&(placementPreview.state==="open"||placementPreview.state==="showing"))try{placementPreview.hidePopup();}catch{}
    if(remove){placementPreview?.remove();placementPreview=placementLabel=null;}
  }
  function showPlacementPreview(x,y,label){
    if(pointInSourceWindow(x,y)){clearPlacementPreview();return;}
    const p=placementAt(x,y);if(!p){clearPlacementPreview();return;}
    const key=[p.x,p.y,p.width,p.height,p.mode,label].join(":");
    if(key===placementKey)return;
    placementKey=key;
    try{
      if(!placementPreview){
        const set=document.getElementById("mainPopupSet");if(!set)return;
        placementPreview=document.createXULElement("panel");placementPreview.id="oneplane-placement-preview";
        for(const [k,v] of Object.entries({noautohide:"true",noautofocus:"true",mousethrough:"always",level:"top","aria-hidden":"true"}))placementPreview.setAttribute(k,v);
        placementLabel=html("div","op-placement-label");placementPreview.append(placementLabel);set.append(placementPreview);
      }
      placementLabel.textContent=label+" · "+(p.mode==="maximize"?"Full screen":p.mode==="center"?"Window":p.mode);
      const inset=8,w=Math.max(1,p.width-2*inset),h=Math.max(1,p.height-2*inset);
      placementPreview.style.width=w+"px";placementPreview.style.height=h+"px";
      placementLabel.style.width=w+"px";placementLabel.style.height=h+"px";
      if(placementPreview.state==="open"){placementPreview.sizeTo(w,h);placementPreview.moveTo(p.x+inset,p.y+inset);}
      else if(placementPreview.state!=="showing")placementPreview.openPopupAtScreen(p.x+inset,p.y+inset,false);
    }catch(error){clearPlacementPreview(true);console.warn("[OnePlane] Snap preview unavailable:",error);}
  }
  function placeNativeWindow(win,p){
    if(!win||win.closed||!p)return;
    try{
      if(win.windowState===win.STATE_MAXIMIZED||win.windowState===win.STATE_MINIMIZED)win.restore();
      win.moveTo(p.x,p.y);win.resizeTo(p.width,p.height);
      if(p.mode==="maximize")win.maximize();
    }catch(error){console.warn("[OnePlane] Window placement:",error);}
  }
  function placeAfterStartup(win,p){
    if(!win||!p)return;
    if(win.gBrowserInit?.delayedStartupFinished){placeNativeWindow(win,p);return;}
    let timer=0;
    const cleanup=()=>{Services.obs.removeObserver(observer,"browser-delayed-startup-finished");win.removeEventListener("unload",cleanup);if(timer)window.clearTimeout(timer);};
    const observer=subject=>{if(subject===win){cleanup();placeNativeWindow(win,p);}};
    Services.obs.addObserver(observer,"browser-delayed-startup-finished");win.addEventListener("unload",cleanup,{once:true});
    timer=window.setTimeout(cleanup,15000);
  }
  function onSourceDrag(event){
    if(!draggedTab||draggedGroup||(!event.screenX&&!event.screenY))return;
    if(!pointInSourceWindow(event.screenX,event.screenY)){
      if(dragImageMode!=="outside")setDragImageMode("outside",event);
      showPlacementPreview(event.screenX,event.screenY,"Tab");
    }else clearPlacementPreview();
  }

  // Native Hub, window-scoped. Zen owns all workspace/session state.
  function createHubController({target,root,toolbarWrapper,supported,hold,switchGuard}) {
    const button=html("button","op-hub-trigger");
    button.id="oneplane-hub-button";button.type="button";
    const glyph=document.createElementNS("http://www.w3.org/2000/svg","svg");
    glyph.setAttribute("viewBox","0 0 20 20");glyph.setAttribute("aria-hidden","true");
    const shape=document.createElementNS(glyph.namespaceURI,"path");
    shape.setAttribute("d","M4 3.5h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2ZM2 8h16M7 8v8.5M10 11h5M10 14h5");
    glyph.append(shape);button.append(glyph);button.title="OnePlane Hub";
    for(const [key,value] of Object.entries({skipintoolbarset:"true",removable:"false",tooltiptext:"OnePlane Hub","aria-label":"OnePlane Hub","aria-haspopup":"dialog","aria-expanded":"false"}))button.setAttribute(key,value);
    const panel=html("div","op-hub-panel");
    panel.hidden=true;
    const topLayer=typeof panel.showPopover==="function"&&typeof panel.hidePopover==="function";
    if(topLayer)panel.setAttribute("popover","manual");
    panel.id="oneplane-hub-panel";
    for(const [key,value] of Object.entries({role:"dialog","aria-label":"OnePlane Hub"}))panel.setAttribute(key,value);
    const make=(tag,cls,text)=>{const n=html(tag,cls);if(text!==undefined)n.textContent=text;return n;};
    const content=make("div","op-hub-content");
    const spaces=make("div","op-hub-spaces"),status=make("div","op-hub-status");
    status.setAttribute("role","status");status.setAttribute("aria-live","polite");
    const form=make("form","op-hub-create"),name=make("input","op-hub-name"),add=make("button","op-hub-add","+");
    name.type="text";name.maxLength=80;name.placeholder="New workspace";name.setAttribute("aria-label","New workspace name");
    add.type="submit";add.setAttribute("aria-label","Create workspace");form.append(name,add);
    const mode=make("button","op-hub-mode");mode.type="button";
    content.append(make("h2","op-hub-title","OnePlane"),make("h3","op-hub-heading","Workspaces"),spaces,form,status,make("h3","op-hub-heading","Settings"),mode);
    const returnButton=make("button","op-hub-return","Return to main window");returnButton.type="button";returnButton.hidden=true;content.prepend(returnButton);
    panel.append(content);
    let destroyed=false,busy=false,open=false,contextId=null;
    let geometryFrame=0,motion=null,confirmation=null,drag=null,suppressClickUntil=0,projectionBusy=false;
    const PROJECTION="__oneplaneWorkspaceProjection";
    const manager=()=>window.gZenWorkspaces;
    const command=()=>document.getElementById("cmd_toggleCompactModeIgnoreHover");
    function setHold(value){toolbarWrapper?.toggleAttribute("oneplane-hub-hold",value);hold();}
    function stopMotion(){if(motion){motion.cancel();motion=null;}}
    function hideNow(){
      stopMotion();
      if(topLayer&&panel.matches(":popover-open"))panel.hidePopover();
      panel.hidden=true;panel.inert=false;setHold(false);
    }
    function fluid(show,done){
      const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches||prefs.getIntPref("zen.oneplane.animation-duration",160)===0;
      if(reduced||typeof panel.animate!=="function"){stopMotion();done();return;}
      const computed=window.getComputedStyle(panel);
      const from=motion?{clipPath:computed.clipPath,opacity:computed.opacity,translate:computed.translate}:show?
        {clipPath:"inset(0 0 100% 0 round 8px)",opacity:0,translate:"0 -6px"}:
        {clipPath:"inset(0 0 0% 0 round 8px)",opacity:1,translate:"0 0px"};
      stopMotion();
      const to=show?{clipPath:"inset(0 0 0% 0 round 8px)",opacity:1,translate:"0 0px"}:
        {clipPath:"inset(0 0 100% 0 round 8px)",opacity:0,translate:"0 -6px"};
      try{
        const animation=panel.animate([from,to],{duration:show?460:390,easing:"cubic-bezier(.22,.72,.2,1)",fill:"both"});
        motion=animation;
        animation.finished.then(()=>{if(motion!==animation)return;motion=null;animation.cancel();done();},()=>{});
      }catch{done();}
    }
    function close(restoreFocus=false,immediate=false){
      const wasVisible=!panel.hidden;contextId=null;confirmation=null;open=false;
      if(drag)cancelDrag();
      if(geometryFrame)window.cancelAnimationFrame(geometryFrame);geometryFrame=0;
      button.setAttribute("aria-expanded","false");
      if(restoreFocus&&!destroyed&&supported())button.focus({preventScroll:true});
      if(!wasVisible||immediate||destroyed||!supported()){hideNow();return;}
      panel.inert=true;fluid(false,()=>{if(!open)hideNow();});
    }
    function updateGeometry(){
      if(!open||!supported())return;
      const b=button.getBoundingClientRect(),a=url.getBoundingClientRect();
      const bar=document.getElementById("urlbar"),style=window.getComputedStyle(root);
      const compact=parseFloat(style.getPropertyValue("--op-url"))||180;
      // A blank tab collapses the address anchor. Reserve its usual width,
      // rather than collapsing the Hub or following a live search wave.
      const right=a.width>1?a.right:a.left+compact;
      const width=hubPanelWidth(b.left,right,window.innerWidth);
      panel.style.setProperty("--op-hub-width",width+"px");
      // Share the actual toolbar contour color rather than the address capsule.
      const bg=window.getComputedStyle(surface).backgroundColor;
      panel.style.setProperty("--op-hub-bg",bg&&bg!=="rgba(0, 0, 0, 0)"&&bg!=="transparent"?bg:
        window.getComputedStyle(toolbarWrapper).getPropertyValue("--op-surface-tint").trim()||"light-dark(#f4f5f9,#15171e)");
      const color=bar&&window.getComputedStyle(bar).color;
      if(color)panel.style.setProperty("--op-hub-fg",color);
      const x=Math.round(b.left),y=Math.round(b.bottom+4);
      panel.style.setProperty("--op-hub-left",x+"px");
      panel.style.setProperty("--op-hub-top",y+"px");
      return true;
    }
    function scheduleHubGeometry(){
      if(!open||geometryFrame)return;
      geometryFrame=window.requestAnimationFrame(()=>{geometryFrame=0;updateGeometry();});
    }
    function showPopup(){
      if(!updateGeometry())return false;
      panel.hidden=false;panel.inert=false;
      if(topLayer&&!panel.matches(":popover-open"))panel.showPopover();
      fluid(true,()=>{});return true;
    }
    function render(){
      if(destroyed)return;
      const snapshot=hubWorkspaceSnapshot(manager()),focusedId=document.activeElement?.dataset?.workspaceId;
      returnButton.hidden=!window[PROJECTION];returnButton.disabled=projectionBusy;
      spaces.replaceChildren();
      if(!snapshot?.length)spaces.append(make("p","op-hub-empty",snapshot?"No native workspaces":"Native workspaces unavailable"));
      else for(const space of snapshot){
        const entry=make("button","op-hub-space");entry.type="button";entry.dataset.workspaceId=space.id;entry.disabled=busy;
        entry.setAttribute("aria-current",space.active?"true":"false");
        const icon=make("span","op-hub-icon",space.icon||Array.from(space.name)[0]?.toUpperCase()||"·");icon.setAttribute("aria-hidden","true");
        entry.append(icon,make("span","op-hub-label",space.name));
        if(space.active)entry.append(make("span","op-hub-current","•"));
        entry.addEventListener("click",()=>{if(window.performance.now()>=suppressClickUntil)void select(space.id);});
        entry.addEventListener("pointerdown",event=>beginDrag(event,space.id,entry));
        entry.addEventListener("pointermove",moveDrag);
        entry.addEventListener("pointerup",endDrag);
        entry.addEventListener("pointercancel",cancelDrag);
        entry.addEventListener("lostpointercapture",cancelDrag);
        entry.addEventListener("contextmenu",event=>{event.preventDefault();event.stopPropagation();if(!busy){confirmation=null;contextId=contextId===space.id?null:space.id;render();}});
        spaces.append(entry);
        if(contextId===space.id)spaces.append(workspaceMenu(space,snapshot));
        if(focusedId===space.id&&open&&!busy)entry.focus({preventScroll:true});
      }
      form.hidden=!snapshot||typeof manager()?.createAndSaveWorkspace!=="function";
      name.disabled=busy;add.disabled=busy||!name.value.trim();
      const compact=root.getAttribute("zen-compact-mode")==="true";
      mode.textContent=compact?"Compact Mode     On":"Compact Mode     Off";
      mode.setAttribute("aria-pressed",String(compact));mode.disabled=typeof command()?.doCommand!=="function";
    }
    function workspaceMenu(space,snapshot){
      const menu=make("div","op-hub-context");menu.setAttribute("role","group");menu.setAttribute("aria-label","Workspace actions");
      const native=manager(),free=prefs.getStringPref("zen.oneplane.free-space-id","");
      const canDelete=snapshot.length>1&&space.id!==free&&typeof native?.removeWorkspace==="function";
      const detach=make("button","op-hub-action","Open in another window");detach.type="button";detach.disabled=busy||projectionBusy;
      detach.addEventListener("click",()=>void project(space.id,null));menu.append(detach);
      if(confirmation?.id===space.id){
        const message=make("p","op-hub-confirm-text",confirmation.description);
        const controls=make("div","op-hub-confirm-controls");
        const cancel=make("button","op-hub-action","Cancel"),ok=make("button","op-hub-delete","Delete");cancel.type=ok.type="button";
        cancel.addEventListener("click",()=>{confirmation=null;render();});
        ok.addEventListener("click",()=>void removeSpace(space.id));
        controls.append(cancel,ok);menu.append(message,controls);
      }else{
        const remove=make("button","op-hub-delete","Delete workspace");remove.type="button";remove.disabled=busy||!canDelete;
        remove.addEventListener("click",()=>askDelete(space.id));menu.append(remove);
      }
      return menu;
    }
    function ownedTabs(native,id){
      if(!Array.isArray(native?.allStoredTabs))return null;
      return native.allStoredTabs.filter(tab=>tab.getAttribute("zen-workspace-id")===id&&
        !tab.hasAttribute("zen-essential")&&!(tab.hasAttribute("zen-empty-tab")&&!tab.group));
    }
    // Keep existing data by default. Moving ordinary tabs is safe only with
    // one participating window and no native grouping/Glance relationships.
    function preservationPlan(native,id,destination){
      try{
        const tabs=ownedTabs(native,id);
        if(!tabs||!destination||typeof native.moveTabsToWorkspace!=="function")return null;
        const windows=Services.wm.getEnumerator("navigator:browser");
        while(windows.hasMoreElements()){
          const other=windows.getNext();
          if(other!==window&&!other.closed&&other.gZenWorkspaces?.getWorkspaceFromId?.(id))return null;
        }
        if(tabs.some(t=>t.closing||t.group||t.hasAttribute("glance-id")||t.hasAttribute("zen-glance-tab")||
          t.hasAttribute("split-view")||t.querySelector?.(".tabbrowser-tab[glance-id]")))return null;
        const targetSpace=native.getWorkspaceFromId(destination.id),element=native.workspaceElement(destination.id);
        if(!targetSpace||!element||tabs.some(t=>!((t.pinned?element.pinnedTabsContainer:element.tabsContainer))))return null;
        return tabs;
      }catch{return null;}
    }
    function deletionDetails(id){
      const native=manager(),snapshot=hubWorkspaceSnapshot(native),space=snapshot?.find(s=>s.id===id);
      const free=prefs.getStringPref("zen.oneplane.free-space-id","");
      if(!space||snapshot.length<=1||id===free||typeof native.removeWorkspace!=="function")return null;
      const destination=snapshot.find(s=>s.id===free&&s.id!==id)||snapshot.find(s=>s.id!==id&&s.active)||snapshot.find(s=>s.id!==id);
      const plan=preservationPlan(native,id,destination);
      const description=plan===null?
        "Delete “"+space.name+"” and close its remaining tabs, including in synced windows?":
        plan.length?"Move "+plan.length+" tab(s) to “"+destination.name+"” and delete “"+space.name+"”?":
        "Delete empty workspace “"+space.name+"”?";
      return {id,native,destination,plan,description};
    }
    function askDelete(id){
      if(busy||destroyed)return;
      confirmation=deletionDetails(id);contextId=id;render();
    }
    async function removeSpace(id){
      if(busy||destroyed||confirmation?.id!==id)return;
      const approved=confirmation,now=deletionDetails(id);
      if(!now||now.native!==approved.native||now.description!==approved.description||
        (now.plan!==null&&approved.plan!==null&&(now.plan.length!==approved.plan.length||now.plan.some(t=>!approved.plan.includes(t))))){
        confirmation=now;status.textContent="Workspace changed. Review again.";render();return;
      }
      const {native,destination,plan}=now;
      busy=true;confirmation=null;contextId=null;status.textContent="";render();
      try{
        if(plan!==null){
          if(plan.length)native.moveTabsToWorkspace([...plan],destination.id);
          if(plan.some(t=>t.getAttribute("zen-workspace-id")!==destination.id)||ownedTabs(native,id)?.length!==0)throw Error("Not all tabs moved");
        }
        switchGuard();await native.removeWorkspace(id);
        if(native.getWorkspaceFromId(id))throw Error("Workspace not removed");
      }catch(error){if(!destroyed)status.textContent="Could not delete workspace safely.";console.warn("[OnePlane] Hub delete:",error);}
      finally{busy=false;if(!destroyed&&open)render();}
    }
    // A projection is a native synced window, not a copy or adoption of tabs.
    function canProject(){
      return !!manager()?.currentWindowIsSyncing&&!!window.gZenWindowSync&&
        prefs.getBoolPref("zen.window-sync.enabled",true)&&!prefs.getBoolPref("zen.window-sync.sync-only-pinned-tabs",true);
    }
    function monitorAt(x,y){
      const source=desktopDisplayAt(window.screenX+window.outerWidth/2,window.screenY+window.outerHeight/2),dest=desktopDisplayAt(x,y);
      return hubOtherDisplay(source,dest,x,y)?hubSnapRect(dest,x,y):null;
    }
    function beginDrag(event,id,entry){
      if(event.button!==0||busy||projectionBusy)return;
      drag={id,entry,pointer:event.pointerId,x:event.screenX,y:event.screenY,moved:false};
      try{entry.setPointerCapture(event.pointerId);}catch{drag=null;}
    }
    function moveDrag(event){
      if(!drag||event.pointerId!==drag.pointer)return;
      if(!drag.moved&&Math.hypot(event.screenX-drag.x,event.screenY-drag.y)>=9){
        drag.moved=true;drag.entry.setAttribute("data-op-dragging","true");
        status.textContent="Drag to another monitor and release.";
      }
      if(drag.moved){event.preventDefault();showPlacementPreview(event.screenX,event.screenY,manager()?.getWorkspaceFromId(drag.id)?.name||"Workspace");}
    }
    function cancelDrag(event){
      if(!drag||(event&&event.pointerId!==drag.pointer))return;
      const d=drag;drag=null;clearPlacementPreview();d.entry.removeAttribute("data-op-dragging");
      if(d.moved){suppressClickUntil=window.performance.now()+400;status.textContent="";}
      try{if(d.entry.hasPointerCapture(d.pointer))d.entry.releasePointerCapture(d.pointer);}catch{}
    }
    function endDrag(event){
      if(!drag||event.pointerId!==drag.pointer)return;
      const d=drag,point=monitorAt(event.screenX,event.screenY);cancelDrag(event);
      if(!d.moved)return;
      event.preventDefault();event.stopPropagation();
      if(point)void project(d.id,point);
      else status.textContent="Release on another monitor, or use Open in another window.";
    }
    async function project(id,display){
      if(projectionBusy||busy||destroyed)return;
      if(!canProject()){status.textContent="Enable native window sync for all tabs to use this feature.";return;}
      const native=manager();
      if(!native.getWorkspaceFromId(id))return;
      projectionBusy=true;status.textContent="Opening workspace…";render();
      let child=null;
      try{
        const {BrowserWindowTracker}=ChromeUtils.importESModule("resource:///modules/BrowserWindowTracker.sys.mjs");
        const features=display?`left=${display.x},top=${display.y},width=${display.width},height=${display.height}`:undefined;
        const args=Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);args.data="about:blank";
        const options={openerWindow:window,private:false,zenSyncedWindow:!prefs.getBoolPref("zen.window-sync.prefer-unsynced-windows",false),features,args};
        child=BrowserWindowTracker.openWindow(options);
        if(!child)throw Error("Native window did not open");
        child[PROJECTION]={source:window,id};
        let startupTab=null;
        const captureStartup=()=>{if(!startupTab)startupTab=child.gBrowser?.selectedTab||null;};
        captureStartup();child.addEventListener("DOMContentLoaded",captureStartup,{once:true});
        await new Promise((resolve,reject)=>{
          if(child.gBrowserInit?.delayedStartupFinished){resolve();return;}
          const observer=subject=>{if(subject===child){cleanup();resolve();}};
          const closed=()=>{cleanup();reject(Error("Window closed"));};
          const timer=window.setTimeout(()=>{cleanup();reject(Error("Window startup timeout"));},15000);
          function cleanup(){window.clearTimeout(timer);Services.obs.removeObserver(observer,"browser-delayed-startup-finished");child.removeEventListener("unload",closed);}
          Services.obs.addObserver(observer,"browser-delayed-startup-finished");child.addEventListener("unload",closed,{once:true});
        });
        child.removeEventListener("DOMContentLoaded",captureStartup);
        await child.gZenWorkspaces?.promiseInitialized;
        if(child.closed||destroyed||!child.gZenWorkspaces?.currentWindowIsSyncing||
          child.gZenWindowSync!==window.gZenWindowSync||!child.gZenWorkspaces.getWorkspaceFromId(id))throw Error("Native sync unavailable");
        await child.gZenWorkspaces.changeWorkspaceWithID(id);
        if(child.gZenWorkspaces.activeWorkspace!==id)throw Error("Workspace not activated");
        // Only the exact untouched projection startup tab, never arbitrary New Tab.
        if(startupTab&&startupTab!==child.gBrowser.selectedTab&&!startupTab.closing&&!startupTab.pinned&&!startupTab.group&&
          !startupTab.hasAttribute("zen-essential")&&!startupTab.hasAttribute("zen-empty-tab")&&startupTab.isEmpty&&
          startupTab.linkedBrowser?.currentURI?.spec==="about:blank"&&startupTab.linkedBrowser?.canGoBack===false&&startupTab.linkedBrowser?.canGoForward===false){
          child.gBrowser.removeTab(startupTab,{animate:false});
        }
        if(display)placeNativeWindow(child,display);
        child.focus();status.textContent="";
      }catch(error){
        if(child&&!child.closed)delete child[PROJECTION];
        if(!destroyed)status.textContent="Could not open synced workspace. Check window sync settings.";
        console.warn("[OnePlane] Workspace projection:",error);
      }finally{projectionBusy=false;if(!destroyed&&open)render();}
    }
    async function returnProjection(){
      const projection=window[PROJECTION],source=projection?.source;
      if(projectionBusy||!source||source.closed||!canProject()||source.gZenWindowSync!==window.gZenWindowSync){
        status.textContent="Main synced window unavailable.";return;
      }
      const own=manager()?.allStoredTabs,other=source.gZenWorkspaces?.allStoredTabs;
      if(!Array.isArray(own)||!Array.isArray(other)||!own.filter(t=>!t.hasAttribute("zen-empty-tab")).every(t=>
        t.id&&other.some(o=>o.id===t.id&&!o.closing&&o.getAttribute("zen-workspace-id")===t.getAttribute("zen-workspace-id")))){
        status.textContent="Some tabs are not synced yet. Return cancelled to protect them.";return;
      }
      try{
        if(typeof window.BrowserTryToCloseWindow==="function")window.BrowserTryToCloseWindow();
        else if(typeof window.BrowserCommands?.tryToCloseWindow==="function")window.BrowserCommands.tryToCloseWindow();
        else {status.textContent="Use the native close-window command.";return;}
        if(window.closed)source.focus();
      }catch(error){status.textContent="Could not return safely.";console.warn("[OnePlane] Return:",error);}
    }
    async function select(id){
      if(busy||destroyed)return;
      const native=manager(),space=hubWorkspaceSnapshot(native)?.find(s=>s.id===id);
      if(!space){render();return;}if(space.active){contextId=null;confirmation=null;render();return;}
      busy=true;status.textContent="";render();
      try{switchGuard();await native.changeWorkspaceWithID(id);
        if(!destroyed){if(native.activeWorkspace!==id)throw Error("Workspace did not activate");contextId=null;confirmation=null;scheduleHubGeometry();}
      }catch(error){if(!destroyed)status.textContent="Could not switch workspace.";console.warn("[OnePlane] Hub switch:",error);}
      finally{busy=false;if(!destroyed&&open)render();}
    }
    async function create(event){
      event.preventDefault();const value=name.value.trim(),native=manager();
      if(!value||busy||destroyed||!hubWorkspaceSnapshot(native)||typeof native.createAndSaveWorkspace!=="function")return;
      busy=true;status.textContent="";render();
      try{const result=await native.createAndSaveWorkspace(value,undefined,true);
        if(!result?.uuid||!native.getWorkspaceFromId(result.uuid))throw Error("Native workspace creation unavailable");
        if(!destroyed){name.value="";contextId=null;confirmation=null;scheduleHubGeometry();}
      }catch(error){if(!destroyed)status.textContent="Could not create workspace.";console.warn("[OnePlane] Hub create:",error);}
      finally{busy=false;if(!destroyed&&open)render();}
    }
    function ensure(){
      if(destroyed)return;
      if(button.parentElement!==target)target.prepend(button);
      if(panel.parentElement!==root)root.append(panel);
    }
    function toggle(event){
      event.preventDefault();event.stopPropagation();
      if(!supported()||destroyed)return;
      if(open){close();return;}
      ensure();if(!panel.isConnected)return;
      status.textContent="";contextId=null;confirmation=null;open=true;
      button.setAttribute("aria-expanded","true");setHold(true);render();
      try{
        if(!showPopup()){close();return;}
        (spaces.querySelector('[aria-current="true"]:not(:disabled)')||spaces.querySelector("button:not(:disabled)")||mode).focus({preventScroll:true});
      }catch(error){close();console.warn("[OnePlane] Hub open:",error);}
    }
    function key(event){
      if(!open||event.key!=="Escape")return;
      event.preventDefault();event.stopPropagation();
      if(drag){cancelDrag();return;}if(confirmation){confirmation=null;render();return;}if(contextId){contextId=null;render();return;}close(true);
    }
    function changed(){if(open){if(!drag)render();scheduleHubGeometry();}}
    function onMode(){if(!supported())close(false,true);else if(open){setHold(true);changed();}}
    function deactivate(){if(open&&!busy&&!drag&&!projectionBusy)close();}
    function toggleMode(){
      const cmd=command();if(typeof cmd?.doCommand!=="function"||!open)return;
      setHold(true);
      try{cmd.doCommand();changed();}catch(error){console.warn("[OnePlane] Compact Mode:",error);}
    }
    function onInput(){add.disabled=busy||!name.value.trim();}
    function onOutside(event){if(open&&!event.composedPath().includes(panel)&&!event.composedPath().includes(button))close();}
    function stopDrag(event){event.stopPropagation();}
    function stopDouble(event){event.preventDefault();event.stopImmediatePropagation();}
    const listeners=[[button,"click",toggle],[button,"pointerdown",stopDrag],[button,"mousedown",stopDrag],[button,"dblclick",stopDouble],
      [panel,"keydown",key],[form,"submit",create],[mode,"click",toggleMode],[returnButton,"click",()=>void returnProjection()],[window,"deactivate",deactivate],[name,"input",onInput],[window,"resize",scheduleHubGeometry]];
    window.addEventListener("pointerdown",onOutside,true);
    for(const event of ["ZenWorkspaceDataChanged","ZenWorkspacesUIUpdate","ZenCompactMode:Toggled","ZenCompactMode:LayoutUpdate"])listeners.push([window,event,changed]);
    for(const [node,event,fn] of listeners)node.addEventListener(event,fn);
    function destroy(){if(destroyed)return;destroyed=true;close(false,true);clearPlacementPreview(true);window.removeEventListener("pointerdown",onOutside,true);for(const [node,event,fn] of listeners)node.removeEventListener(event,fn);panel.remove();button.remove();}
    return {ensure,close,onMode,destroy};
  }
  const hub=createHubController({target,root,toolbarWrapper,supported:hoverSupported,hold:reconcilePanel,switchGuard:guardPanelSwitch});

  // Zen 1.24.2b URILoadingHelper enumerates allUsedBrowsers across windows.
  // Filter only for the duration of a synchronous reuse lookup. Never
  // change workspace ownership, provider databases, or the native getter
  // outside this call. Explicit tab selection continues to use Zen's API.
  function installWorkspaceLinkScope(){
    const nativeSwitch=window.switchToTabHavingURI;
    if(typeof nativeSwitch!=="function")return ()=>{};
    const active=()=>root.hasAttribute("oneplane-active")&&
      window.gZenWorkspaces?.workspaceEnabled&&!!window.gZenWorkspaces.activeWorkspace;
    function withScope(run){
      if(!active())return run();
      const restores=[];
      try{
        const enumerator=Services.wm.getEnumerator("navigator:browser"),windows=new Set([window]);
        while(enumerator.hasMoreElements())windows.add(enumerator.getNext());
        for(const win of windows){
          if(win.closed||!win.gBrowser)continue;
          const manager=win.gZenWorkspaces;
          if(!manager)throw Error("Native workspace lookup unavailable");
          const descriptor=Object.getOwnPropertyDescriptor(manager,"allUsedBrowsers");
          if(descriptor&&!descriptor.configurable)throw Error("Native workspace lookup cannot be scoped");
          const original=manager.allUsedBrowsers;
          if(!Array.isArray(original))throw Error("Native browser list unavailable");
          const list=win===window?original.filter(b=>{
            const t=win.gBrowser.getTabForBrowser(b);
            return hubWorkspaceBrowserEligible(t,manager.activeWorkspace);
          }):[];
          Object.defineProperty(manager,"allUsedBrowsers",{configurable:true,get:()=>list});
          restores.push(()=>descriptor?Object.defineProperty(manager,"allUsedBrowsers",descriptor):delete manager.allUsedBrowsers);
        }
      }catch(error){
        for(const restore of restores.reverse())restore();
        console.warn("[OnePlane] Could not scope workspace URI lookup:",error);
        // Do not accidentally switch spaces if the native contract changes.
        return undefined;
      }
      try{return run();}finally{for(const restore of restores.reverse())restore();}
    }
    const helper=ChromeUtils.importESModule("resource:///modules/URILoadingHelper.sys.mjs").URILoadingHelper;
    function fallback(uri,openNew,params={},context=null){
      if(!openNew)return false;
      const spec=typeof uri==="string"?uri:uri.spec;
      const options={...params};
      for(const key of ["ignoreFragment","ignoreQueryString","replaceQueryString","adoptIntoActiveWindow"])delete options[key];
      if(context!==null&&context!==undefined)options.userContextId=context;
      helper.openTrustedLinkIn(window,spec,"tab",options);return false;
    }
    function scopedSwitch(uri,openNew,params={},context=null,split=null){
      if(!active())return nativeSwitch.apply(this,arguments);
      const result=withScope(()=>nativeSwitch.call(this,uri,openNew,{...params},context,split));
      return result===undefined?fallback(uri,openNew,params,context):result;
    }
    window.switchToTabHavingURI=scopedSwitch;
    // The native address-bar result path calls the shared URI helper
    // directly. Avoid its stale-result unregister path when an existing
    // matching tab merely belongs to a different workspace.
    let unregister=()=>{};
    try{
      const {UrlbarParentController}=ChromeUtils.importESModule("moz-src:///browser/components/urlbar/UrlbarParentController.sys.mjs");
      const proto=UrlbarParentController.prototype,key=Symbol.for("oneplane.workspace-urlbar-scope");
      let registry=proto[key];
      if(!registry){
        const original=proto.switchToTab;
        if(typeof original!=="function")throw Error("URL bar switch API unavailable");
        const clients=new Map();
        const wrapper=function(data){
          const client=clients.get(this.browserWindow);
          return client?client(this,data,original):original.call(this,data);
        };
        registry={clients,original,wrapper};
        Object.defineProperty(proto,key,{configurable:true,value:registry});
        proto.switchToTab=wrapper;
      }
      const client=(controller,data,original)=>{
        if(!active()||!data?.url)return original.call(controller,data);
        const context=data.userContextId??0;
        // Native private context sentinel is not a public container ID.
        const userContext=context===-1?null:context;
        const matches=b=>{
          try{return b.currentURI.spec===data.url&&(userContext===null||String(b.getAttribute("usercontextid")||0)===String(userContext));}catch{return false;}
        };
        const manager=window.gZenWorkspaces;
        const local=manager.allUsedBrowsers.some(b=>matches(b)&&hubWorkspaceBrowserEligible(browser.getTabForBrowser(b),manager.activeWorkspace));
        if(local){
          const result=withScope(()=>{original.call(controller,data);return true;});
          if(result)return;
        }
        // No reusable tab in this workspace: load locally rather than
        // unregistering a real tab belonging to another workspace.
        const params=userContext===null?{}:{userContextId:userContext};
        helper.openTrustedLinkIn(window,data.url,"tab",params);
        if(!data.heuristic)controller.addToInputHistory?.(data.url,data.searchString);
      };
      registry.clients.set(window,client);
      unregister=()=>{
        if(registry.clients.get(window)===client)registry.clients.delete(window);
        if(!registry.clients.size&&proto[key]===registry){
          if(proto.switchToTab===registry.wrapper)proto.switchToTab=registry.original;
          delete proto[key];
        }
      };
    }catch(error){console.warn("[OnePlane] URL bar workspace isolation unavailable:",error);}
    return ()=>{
      unregister();
      if(window.switchToTabHavingURI===scopedSwitch)window.switchToTabHavingURI=nativeSwitch;
    };
  }
  let releaseWorkspaceLinkScope=()=>{};


  // Target Zen 1.24.2b TabContextMenu resolves triggerNode.tab.
  // Fail closed rather than accidentally acting on the selected tab.
  let nativeTabMenu=null,nativeTabMenuCleanup=null;
  function closeNativeTabMenu(){if(nativeTabMenu)nativeTabMenu.hidePopup();nativeTabMenuCleanup?.();}
  function openNativeTabMenu(event,tab,button){
    if(!hoverSupported()||!validNativeTab(tab))return;
    const popup=document.getElementById("tabContextMenu");
    if(!popup||typeof popup.openPopupAtScreen!=="function")return;
    event.preventDefault();event.stopPropagation();hub.close();closeNativeTabMenu();
    const trigger=event.target;if(!trigger||!button.parentElement?.contains(trigger))return;
    trigger.tab=tab;
    const guard=e=>{if(e.target===popup&&popup.triggerNode?.tab!==tab){e.preventDefault();e.stopImmediatePropagation();cleanup();}};
    const hidden=e=>{if(e.target===popup)cleanup();};
    const cleanup=()=>{
      popup.removeEventListener("popupshowing",guard,true);popup.removeEventListener("popuphidden",hidden);
      if(trigger.tab===tab)delete trigger.tab;
      if(nativeTabMenu===popup){nativeTabMenu=null;nativeTabMenuCleanup=null;toolbarWrapper?.removeAttribute("oneplane-tab-menu-hold");reconcilePanel();}
    };
    nativeTabMenu=popup;nativeTabMenuCleanup=cleanup;
    popup.addEventListener("popupshowing",guard,true);popup.addEventListener("popuphidden",hidden);
    toolbarWrapper?.setAttribute("oneplane-tab-menu-hold","true");reconcilePanel();
    const rect=button.getBoundingClientRect(),x=event.screenX||window.mozInnerScreenX+rect.left,y=event.screenY||window.mozInnerScreenY+rect.bottom;
    try{popup.openPopupAtScreen(x,y,true,event);}
    catch(error){cleanup();console.warn("[OnePlane] Native tab menu:",error);}
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
    if(dead||!toolbarWrapper||!hoverSupported()||root.hasAttribute("data-op-bookmark-wave"))return;
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
    if(now<contourUntil && hoverSupported()&&!root.hasAttribute("data-op-bookmark-wave"))contourFrame=window.requestAnimationFrame(stepContour);
  }
  function scheduleContour(){
    if(!dead&&!contourFrame)contourFrame=window.requestAnimationFrame(stepContour);
  }
  function onContourTransition(event){
    if(root.hasAttribute("data-op-bookmark-wave")||!contourObserved.has(event.target))return;
    if(!/^(margin|width|height|scale|translate|transform|padding)/.test(event.propertyName||""))return;
    // Magnetic Bookmarks can move through CSS transforms without a
    // resize notification. Follow only while its short transition runs.
    contourUntil=window.performance.now()+360;
    scheduleContour();
  }
  function toolbarCenterBias(left,right,trailingReserve,centered){
    const bias=right-left+(centered?0:trailingReserve);
    return {left:Math.max(0,Math.round(bias)),right:Math.max(0,Math.round(-bias))};
  }
  const leftIds = new Set(["oneplane-hub-button", "sidebar-button", "sidebar-toggle-button", "back-button",
    "forward-button", "stop-reload-button", "reload-button", "home-button", "urlbar-container"]);
  const centerIds = new Set(["oneplane-tabs", "oneplane-center-start", "oneplane-center-end"]);
  let geometryFrame = 0;
  let geometryObserver = null;
  let centering=false;
  function centerToolbar(){
    if(centering||!hoverSupported()||!toolbarWrapper)return;
    centering=true;
    try {
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
      const bias=toolbarCenterBias(left,right,trailingReserve,centered);
      setLength(leftSpacer,"--op-center-bias",bias.left);
      setLength(rightSpacer,"--op-center-bias",bias.right);
      // Cap leftward expansion at actual free space next to navigation.
      setLength(row, "--op-left-room", leftSpacer.getBoundingClientRect().width - 4);
    } finally {centering=false;}
  }
  function scheduleGeometry(){
    if(dead||geometryFrame)return;
    geometryFrame=window.requestAnimationFrame(()=>{
      geometryFrame=0;
      if(!hoverSupported()||!toolbarWrapper)return;
      centerToolbar();
      // Keep the earlier switch guard for vertical geometry and mask,
      // not horizontal compensation. Old bias + new anchor = visible jump.
      if(toolbarWrapper.style.getPropertyValue("--op-measured-toolbar-height") &&
         window.performance.now()<panelSwitchUntil)return;
      const setLength=(node,name,value)=>{
        const next=Math.max(0,Math.round(value))+"px";
        if(node.style.getPropertyValue(name)!==next)node.style.setProperty(name,next);
      };
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
      if(element&&!centerIds.has(element.id))geometryObserver.observe(element);
    }
    scheduleGeometry();
  }

  // Native Compact Mode may clear its hover flag during a tab expansion or
  // while entering a bookmarks row. Keep the entire visible toolbar interactive.
  let pointerInside = false;
  let panelTimer=0, panelSwitchTimer=0, panelSwitchUntil=0, panelCloseSince=null;
  let panelLastPointer=null;
  const PANEL_NATIVE_FLAGS=["zen-has-hover","has-popup-menu","zen-compact-mode-active"];
  const PANEL_HOLD_FLAGS=["oneplane-url-hold","oneplane-drag-hold","oneplane-startup-hold","oneplane-hub-hold","oneplane-tab-menu-hold"];
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
    closeNativeTabMenu();
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
    hub.onMode();
    if(!hoverSupported())closeNativeTabMenu();
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
      {translate:"0 "+dy+"px",scale:".78 .92",offset:0},
      {translate:"0 -4px",scale:"1 .78",offset:.30},
      {translate:"0 2px",scale:".94 1",offset:.56},
      {translate:"0 -1px",scale:"1 .97",offset:.78},
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
    // Once OS owns the drag image, never draw a local duplicate on re-entry.
    if(dragImageMode==="outside")return;
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
    if(tabOwner(tab)===window)clearPlacementPreview();
    else tabOwner(tab)?.[DRAG_CONTROLLER]?.preview?.(event);
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
      if (dragImageMode === "outside") {
        if(within){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect="move";previewStripDrag(event,tab);}
        else{clearLiveDrag();releaseDragReveal();}
        return;
      }
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
    clearPlacementPreview();
    cancelInsertion();
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
    reconcileTabCascade();
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
      if (!group && (browser.selectedTab !== tab || isSplit(tab))) {
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
    if(cascadeState!=="idle")return;
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
    if(cascadeState!=="idle")return;
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
    event.dataTransfer.dropEffect = "move";
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
        // Empty start page is not a valid split partner: select the real tab.
        browser.selectedTab=tab;sourceHandled(tab);schedule();return;
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
      } else if (!side && validNativeTab(tab)) {
        browser.selectedTab=tab;schedule();
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
    if (inside) {
      if(!toolbarContainsPoint(event.clientX,event.clientY)&&emptySplitTarget(browser.selectedTab))browser.selectedTab=tab;
      return;
    }
    try {
      // Native session adoption preserves the live browser, history, audio
      // and private-window state. Zen chooses its native window-sync mode.
      if (isSplit(tab) && !unsplitTab(tab)) return;
      const p=placementAt(x,y);
      const win=browser.replaceTabWithWindow(tab, {
        replaceLastTab: true, screenX:p?.x??x-40,screenY:p?.y??y-20,
        outerWidth:p?.width??Math.min(window.outerWidth,1200),
        outerHeight:p?.height??Math.min(window.outerHeight,850)
      });
      if(win&&p)placeAfterStartup(win,p);
    } catch (error) { console.error("[OnePlane] Detach tab:", error); }
  }
  const dragController = {
    source: () => draggedTab,
    group: () => draggedGroup,
    outside: event => setDragImageMode("outside",event),
    preview: event => {if(draggedTab&&!draggedGroup)showPlacementPreview(event.screenX,event.screenY,"Tab");},
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
  function refreshIndicator(force=false) {
    if(cascadeState!=="idle"&&force!==true)return;
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
    if(cascadeState==="idle" && hadTitle && title && !reducedMotion.matches &&
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
    if (cascadeState!=="idle" || !item || !list.contains(item)) return;
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
    if (cascadeState!=="idle" || !hoverTab || hoverTimer) return;
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
    if(event.pointerType==="touch")return;
    const pointNow={x:event.clientX,y:event.clientY};
    if(cascadeState!=="idle"){cascadePointer=pointNow;return;}
    if(cascadePointer){
      if(Math.hypot(pointNow.x-cascadePointer.x,pointNow.y-cascadePointer.y)<1)return;
      cascadePointer=null;
    }
    if (!hoverSupported() || draggedTab || root.hasAttribute("data-zr-startup-phase")) return;
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
    if(cascadeState!=="idle"||root.hasAttribute("data-zr-startup-phase"))return;
    const item = event.target?.closest?.(".oneplane-tab");
    if (item && event.target.matches(":focus-visible")) selectHover(item);
  }
  function blurTab(event) {
    if (!row.contains(event.relatedTarget) && !row.matches(":hover")) queueTabCollapse();
  }
  function leaveTabPointer(event) {
    // The translated strip can extend beyond the row's original box.
    // A pointerleave from the plus or row is not necessarily a departure.
    if (cascadeState!=="idle" || (event && pointOverTabStrip(event))) return;
    releaseIndicatorHover();
    queueTabCollapse();
  }
  function onNewTabClick() { clearTabHover(); }

  function favicon(tab) {
    const local=t=>{
      const sources=[t.getAttribute("image"),t.querySelector(".tab-icon-image")?.getAttribute("src")];
      try{sources.push(t.ownerDocument.defaultView.gBrowser.getIcon(t));}catch{}
      return sources.find(src=>/^(data:image\/|chrome:|resource:|moz-anno:|page-icon:|blob:)/i.test(src||""))||"";
    };
    const direct=local(tab);
    if(direct)return direct;
    // Resolve the native synchronized tab identity, not its URL/title.
    if(tab.id&&window.gZenWindowSync&&window.gZenWorkspaces?.currentWindowIsSyncing){
      const wins=Services.wm.getEnumerator("navigator:browser");
      while(wins.hasMoreElements()){
        const win=wins.getNext();
        if(win===window||win.closed||win.gZenWindowSync!==window.gZenWindowSync||!win.gZenWorkspaces?.currentWindowIsSyncing)continue;
        const peer=win.gZenWindowSync.getItemFromWindow(win,tab.id);
        if(!peer||!win.gBrowser?.isTab(peer)||peer.closing||peer.getAttribute("zen-workspace-id")!==tab.getAttribute("zen-workspace-id"))continue;
        const icon=local(peer);if(icon&&!icon.startsWith("blob:"))return icon;
        const page=peer.linkedBrowser?.currentURI?.spec||"";
        if(/^https?:/i.test(page))return "page-icon:"+page;
      }
    }
    const page=tab.linkedBrowser?.currentURI?.spec||"";
    return /^https?:/i.test(page)?"page-icon:"+page:"";
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
    img.addEventListener("load", () => { img.hidden = false; });
    icon.append(img);
    const audio = html("span", "oneplane-tab-audio");
    audio.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 3; i++) audio.append(html("i"));
    const title = html("span", "oneplane-tab-title");
    button.append(icon, title);
    item.addEventListener("contextmenu", event => openNativeTabMenu(event, tab, button));
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
    centerToolbar();
    refreshIndicator();
    refreshIslandTitle();
    scheduleGeometry();
  }

  function schedule() {
    if (!dead && !frame) frame = window.requestAnimationFrame(sync);
  }
  function revealSelectedInStrip(){
    if(dead||cascadeState!=="idle")return;
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
  function onNativeIconChanged(event){
    schedule();
    if(!window.gZenWindowSync||!window.gZenWorkspaces?.currentWindowIsSyncing)return;
    const wins=Services.wm.getEnumerator("navigator:browser");
    while(wins.hasMoreElements()){
      const win=wins.getNext();
      if(win!==window&&!win.closed&&win.gZenWindowSync===window.gZenWindowSync&&win.gZenWorkspaces?.currentWindowIsSyncing)
        win.dispatchEvent(new win.CustomEvent("OnePlane:SyncedIconChanged"));
    }
  }
  const events = ["TabOpen", "TabClose", "TabMove", "TabAttrModified", "TabPinned", "TabUnpinned", "TabShow", "TabHide", "TabBrowserInserted", "TabBrowserDiscarded", "ZenTabRemovedFromSplit"];
  const tabObserver = new MutationObserver(schedule);
  const workspaceObserver = new MutationObserver(schedule);
  const toolbarObserver = new MutationObserver(() => {
    if (dead || root.hasAttribute("customizing")) return;
    if (url.parentElement === target && row.parentElement !== target) url.after(row);
    if (leftSpacer.parentElement !== target) target.prepend(leftSpacer);
    if (rightSpacer.parentElement !== target) row.after(rightSpacer);
    hub.ensure();
    movePageActions();
    centerToolbar();
    observeGeometry();
  });

  function destroy() {
    if (dead) return;
    dead = true;
    resetTabCascade();
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
    window.removeEventListener("drag",onSourceDrag,true);clearPlacementPreview(true);
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
    releaseWorkspaceLinkScope();
    hub.destroy();
    closeNativeTabMenu();
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
    window.removeEventListener("ZenTabIconChanged",onNativeIconChanged,true);
    window.removeEventListener("OnePlane:SyncedIconChanged",schedule);
    window.removeEventListener("ZenViewSplitter:SplitViewActivated", schedule);
    window.removeEventListener("ZenViewSplitter:SplitViewDeactivated", schedule);
    window.removeEventListener("aftercustomization", schedule);
    row.remove();
    entries.clear();
    splitEntries.clear();
  }

  try {
    url.after(row);
    hub.ensure();
    try{releaseWorkspaceLinkScope=installWorkspaceLinkScope();}catch(error){console.warn("[OnePlane] Workspace link isolation:",error);}
    target.prepend(leftSpacer);
    row.after(rightSpacer);
    tabbox.append(shield, splitZone);
    window.addEventListener("dragover", revealForDrag, true);
    window.addEventListener("drag",onSourceDrag,true);
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
    window.addEventListener("ZenTabIconChanged",onNativeIconChanged,true);
    window.addEventListener("OnePlane:SyncedIconChanged",schedule);
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
    geometryObserver = new ResizeObserver(()=>{
      // ResizeObserver delivery occurs before paint. Compensate edge
      // width changes now rather than a frame later.
      centerToolbar();
      scheduleGeometry();
    });
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
  root.removeAttribute("data-op-startup-ready");
  window.dispatchEvent(new window.CustomEvent("OnePlane:StartupState"));
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
    // Publish readiness after activation has allowed geometry and the
    // native toolbar to settle. No dependency on Zen Refined.
    window.dispatchEvent(new window.CustomEvent("ZenCompactMode:LayoutUpdate"));
    window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>{
      if(disposed||window.closed)return;
      root.setAttribute("data-op-startup-ready","true");
      window.dispatchEvent(new window.CustomEvent("OnePlane:StartupState"));
    }));
  } catch (error) {
    console.error("[OnePlane] Layout activation failed:", error);
    cleanup();
  }
}

if (!root.hasAttribute("popup-window") && typeof window.addUnloadListener === "function") {
  window[CONTROLLER]?.cleanup();
  window[CONTROLLER] = controller;
  root.setAttribute("data-op-startup-ready","pending");
  window.dispatchEvent(new window.CustomEvent("OnePlane:StartupState"));
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
