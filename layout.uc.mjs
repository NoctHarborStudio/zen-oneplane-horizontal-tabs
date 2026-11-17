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


// Shared Zen Home v1: portable core, independent of both mod hosts.
function acquireZenHome(win, services) {
  const KEY="__zenSharedHomeV1", PREF="zen.home.shortcuts.v1", STARTUP="__zenSharedHomeStartupV1";
  const existing=win[KEY];
  if(existing)return existing.apiVersion===1?existing.acquire():null;
  const doc=win.document, root=doc.documentElement, prefs=services.prefs;
  const host=doc.getElementById("zen-tabbox-wrapper"), panels=doc.getElementById("tabbrowser-tabpanels"), browser=win.gBrowser;
  if(!host||!panels||!host.contains(panels)||!browser?.tabContainer)return null;
  try{
    const {PrivateBrowsingUtils}=ChromeUtils.importESModule("resource://gre/modules/PrivateBrowsingUtils.sys.mjs");
    if(PrivateBrowsingUtils.isWindowPrivate(win))return null;
  }catch{return null;}
  const html=(tag,cls,text)=>{
    const n=doc.createElementNS("http://www.w3.org/1999/xhtml",tag);
    if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;
  };
  function safeURL(value){
    if(typeof value!=="string"||!value.trim())return null;
    try{
      const input=value.trim(), url=new win.URL(/^[a-z][a-z\d+.-]*:/i.test(input)?input:"https://"+input);
      return /^(https?):$/.test(url.protocol)&&url.hostname&&!url.username&&!url.password?url.href:null;
    }catch{return null;}
  }
  function normalize(raw){
    if(!raw||raw.version!==1||!Array.isArray(raw.items))return [];
    const seen=new Set(),result=[];
    for(const item of raw.items.slice(0,100)){
      const url=safeURL(item?.url),id=item?.id;
      if(item?.type!=="shortcut"||typeof id!=="string"||!id||seen.has(id)||!url)continue;
      seen.add(id);result.push({id,type:"shortcut",title:String(item.title||new win.URL(url).hostname).slice(0,80),url});
    }
    return result;
  }
  // Prefer high-resolution cached Places icons; use a local scalable Steam
  // mark where the tab favicon is commonly a 16px bitmap. Simple Icons (CC0).
  const steamVector="data:image/svg+xml,"+encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><defs><linearGradient id=\"s\" x1=\"0\" y1=\"0\" x2=\"0.4\" y2=\"1\"><stop stop-color=\"#102139\"/><stop offset=\"1\" stop-color=\"#176a9b\"/></linearGradient></defs><circle cx=\"12\" cy=\"12\" r=\"11.9\" fill=\"#eaf4ff\"/><path fill=\"url(#s)\" d=\"M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z\"/></svg>");
  const gmailVector="data:image/svg+xml,"+encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 48\"><path fill=\"#4285f4\" d=\"M3 16l9 7v15H6a3 3 0 0 1-3-3z\"/><path fill=\"#34a853\" d=\"M45 16l-9 7v15h6a3 3 0 0 0 3-3z\"/><path fill=\"#fbbc04\" d=\"M36 11.75l3.6-2.7A3.38 3.38 0 0 1 45 11.75V16l-9 7z\"/><path fill=\"#ea4335\" d=\"M12 11.75l12 9 12-9V23l-12 9-12-9z\"/><path fill=\"#c5221f\" d=\"M3 11.75a3.38 3.38 0 0 1 5.4-2.7l3.6 2.7V23l-9-7z\"/></svg>");
  const genericVector="data:image/svg+xml,"+encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#969cac\" stroke-width=\"1.6\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><ellipse cx=\"12\" cy=\"12\" rx=\"4\" ry=\"9\"/><path d=\"M3 12h18M5 7h14M5 17h14\"/></svg>");
  function homeIconURL(value,cssSize=30){
    const url=new win.URL(value);
    const host=url.hostname.toLowerCase();
    if(/(?:^|\.)(?:steampowered\.com|steamcommunity\.com)$/.test(host))return steamVector;
    if(host==="mail.google.com"||/(?:^|\.)gmail\.com$/.test(host))return gmailVector;
    url.hash="";
    const preferred=Math.min(192,Math.max(cssSize>=30?96:48,Math.ceil(cssSize*(Number(win.devicePixelRatio)||1))));
    return "page-icon:"+url.href+"#size="+preferred;
  }
  function setHomeIcon(img,url,size){
    const page=new win.URL(url);page.hash="";
    const candidates=[...new Set([homeIconURL(url,size),"page-icon:"+url,"page-icon:"+page.href,genericVector])];
    let index=0;
    const retry=()=>{
      if(++index<candidates.length)img.src=candidates[index];
      else img.removeEventListener("error",retry);
    };
    img.addEventListener("error",retry);img.src=candidates[0];
  }
  const style=html("style");style.id="zen-shared-home-style";
  style.textContent=`
#zen-tabbox-wrapper[data-zr-home-host]{position:relative!important}
#tabbrowser-tabpanels[data-zr-home-covered],#tabbrowser-tabpanels[data-zr-home-covered] browser{visibility:hidden!important;pointer-events:none!important}
#zen-shared-home[hidden]{display:none!important}
#zen-shared-home{position:absolute;inset:0;z-index:4;display:flex;align-items:safe center;justify-content:center;overflow:auto;box-sizing:border-box;padding:72px 24px 32px;background:transparent;color:var(--toolbox-textcolor,currentColor);font:menu;scrollbar-width:thin}
#zen-shared-home *{box-sizing:border-box}
#zen-shared-home button,#zen-shared-home input{font:inherit;color:inherit}
#zen-shared-home button{appearance:none;cursor:pointer;border:0;background:none;padding:0}
#zen-shared-home button:focus-visible,#zen-shared-home input:focus-visible{outline:2px solid AccentColor;outline-offset:3px}
/* Gecko subtracts every explicit no-drag rectangle from all drag rectangles.
   A full-screen Home no-drag box erases the overlapping toolbar. Default
   contributes neither region; only real Home controls subtract their boxes. */
#zen-shared-home,#zen-shared-home *{-moz-window-dragging:default!important}
#zen-shared-home :is(button,input,textarea,select,summary,a,[draggable=true],.zh-recommendations){-moz-window-dragging:no-drag!important}
#zen-shared-home .zh-content{width:min(100%,720px);margin:auto;transition:opacity 180ms ease,translate 220ms cubic-bezier(.2,.75,.25,1)}
/* The collapsed button, native editor and cancellation fallback share
   these exact tokens. No separate hover/focus frame at the handoff. */
:root{
  --zh-search-color:var(--toolbox-textcolor,var(--toolbar-color,currentColor));
  --zh-search-glass:color-mix(in srgb,var(--zh-search-color) 8%,transparent);
  --zh-search-stroke:color-mix(in srgb,var(--zh-search-color) 14%,transparent);
  --zh-search-label:color-mix(in srgb,var(--zh-search-color) 76%,transparent);
  --zh-search-radius:14px;
  --zh-search-font:400 14px system-ui,sans-serif;
  --zh-search-icon:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round'%3E%3Ccircle cx='10.5' cy='10.5' r='6.5'/%3E%3Cpath d='m16 16 4 4'/%3E%3C/svg%3E");
}
#zen-shared-home .zh-search,#zen-home-search-return .zh-return-header{
  display:flex;align-items:center;gap:12px;padding:0 19px;
  font:var(--zh-search-font);color:var(--zh-search-label);text-align:start;white-space:nowrap;
}
#zen-shared-home .zh-search{
  width:100%;height:56px;border:1px solid var(--zh-search-stroke);
  background:var(--zh-search-glass);border-radius:var(--zh-search-radius);
  transition:none;
}
#zen-shared-home .zh-search:hover{background:var(--zh-search-glass)}
#zen-shared-home .zh-search svg,#zen-home-search-return .zh-return-header svg{width:17px;height:17px;flex:none;opacity:1}
#zen-shared-home .zh-search span{min-width:0;overflow:hidden;text-overflow:ellipsis}
#zen-shared-home .zh-search:focus-visible{outline-offset:2px}
@media(prefers-reduced-transparency:reduce){:root{--zh-search-glass:light-dark(#f4f4f8,#252632)}}
#zen-shared-home .zh-section{margin-block-start:36px}
#zen-shared-home h3{font-size:13px;font-weight:500;opacity:.68;margin:0 0 14px}
#zen-shared-home .zh-pins{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
#zen-shared-home .zh-pin{position:relative;flex:0 0 min(165px,calc((100% - 36px)/4));min-width:0}
#zen-shared-home .zh-tile{width:100%;height:102px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:10px;border-radius:14px;background:color-mix(in srgb,currentColor 5%,transparent);border:1px solid color-mix(in srgb,currentColor 8%,transparent);transition:background 160ms,translate 180ms}
#zen-shared-home .zh-tile:not(:disabled):hover{background:color-mix(in srgb,currentColor 10%,transparent);translate:0 -2px}
#zen-shared-home .zh-tile img{width:30px;height:30px;object-fit:contain}
#zen-shared-home .zh-tile span{max-width:90%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}
#zen-shared-home .zh-remove{position:absolute;right:5px;top:5px;border-radius:50%;width:21px;height:21px;background:color-mix(in srgb,currentColor 16%,transparent)}
#zen-shared-home .zh-order{display:flex;justify-content:center;gap:7px;margin-top:5px}
#zen-shared-home .zh-spaces{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
#zen-shared-home .zh-space{flex:1 1 160px;max-width:232px;min-width:0;display:flex;align-items:center;gap:10px;text-align:start;min-height:48px;padding:13px;border:1px solid color-mix(in srgb,currentColor 8%,transparent);background:color-mix(in srgb,currentColor 5%,transparent);border-radius:11px}
#zen-shared-home .zh-space span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#zen-shared-home .zh-space[aria-current=true]{border-color:color-mix(in srgb,currentColor 25%,transparent)}
#zen-shared-home .zh-footer,#zen-shared-home .zh-editbar{display:flex;justify-content:center;gap:8px;margin-top:34px}
#zen-shared-home .zh-small{padding:8px 12px;border-radius:8px;font-size:11px;opacity:.8}
#zen-shared-home .zh-small:hover{background:color-mix(in srgb,currentColor 8%,transparent);opacity:1}
#zen-shared-home .zh-empty{font-size:12px;opacity:.55;text-align:center;padding:26px}
#zen-shared-home .zh-picker{margin:0 auto;padding:16px;border:1px solid color-mix(in srgb,currentColor 12%,transparent);border-radius:14px;background:color-mix(in srgb,currentColor 4%,transparent)}
#zen-shared-home .zh-picker-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
#zen-shared-home .zh-picker-head h3{margin:0}
#zen-shared-home[data-zh-adding] .zh-section:first-child{margin-block-start:0}
#zen-shared-home[data-zh-adding] .zh-section{margin-block-start:24px}
#zen-shared-home[data-zh-adding] .zh-footer{margin-top:22px}
#zen-shared-home .zh-recommendations{--zh-row:64px;--zh-row-gap:8px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:var(--zh-row);align-content:start;gap:var(--zh-row-gap);padding:2px;height:calc(2 * var(--zh-row) + var(--zh-row-gap) + 4px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-gutter:stable;scrollbar-color:color-mix(in srgb,currentColor 25%,transparent) transparent}
#zen-shared-home .zh-recommendations:focus-visible{outline:1px solid AccentColor;outline-offset:2px}
#zen-shared-home .zh-recommendations .zh-empty{align-self:center;padding:8px}
#zen-shared-home [data-zh-enter]{animation:zh-picker-enter 200ms cubic-bezier(.2,.75,.25,1) both}
@keyframes zh-picker-enter{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
#zen-shared-home .zh-recommendations .zh-empty{grid-column:1/-1}
#zen-shared-home .zh-picker-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;flex-wrap:wrap}
#zen-shared-home .zh-picker-count{font-size:11px;opacity:.6}
#zen-shared-home .zh-custom-actions{display:flex;justify-content:flex-end;gap:8px}
#zen-shared-home .zh-custom-actions button{background:color-mix(in srgb,currentColor 7%,transparent)}
#zen-shared-home .zh-suggestion{display:flex;align-items:center;gap:10px;min-width:0;min-height:0;height:100%;padding:10px;text-align:start;border-radius:10px;border:1px solid color-mix(in srgb,currentColor 9%,transparent);background:color-mix(in srgb,currentColor 4%,transparent);transition:background 160ms ease,border-color 160ms ease,scale 140ms ease}
#zen-shared-home .zh-suggestion:hover{background:color-mix(in srgb,currentColor 11%,transparent);border-color:color-mix(in srgb,currentColor 19%,transparent)}
#zen-shared-home .zh-suggestion:active{scale:.97}
#zen-shared-home .zh-suggestion-plus{transition:opacity 160ms ease,scale 160ms ease}
#zen-shared-home .zh-suggestion:hover .zh-suggestion-plus{opacity:1;scale:1.12}
#zen-shared-home .zh-suggestion img{width:23px;height:23px;object-fit:contain;flex:none}
#zen-shared-home .zh-suggestion-copy{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
#zen-shared-home .zh-suggestion-copy span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:12px}
#zen-shared-home .zh-suggestion-copy small{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;opacity:.58;font-size:10px}
#zen-shared-home .zh-suggestion-plus{font-size:17px;opacity:.7;flex:none}
#zen-shared-home .zh-picker-note{font-size:11px;opacity:.6;margin:0 0 12px}
#zen-shared-home .zh-form{display:grid;gap:8px;margin:8px auto 0;max-width:420px}
@media(max-width:520px){#zen-shared-home .zh-recommendations{grid-template-columns:repeat(2,minmax(0,1fr));--zh-row:52px}#zen-shared-home .zh-suggestion{padding:7px 8px;gap:6px}}
@media(max-width:340px){#zen-shared-home .zh-recommendations{grid-template-columns:1fr}}
@media(max-height:560px){#zen-shared-home[data-zh-adding]{padding-block:46px 12px}#zen-shared-home[data-zh-adding] .zh-section{margin-block-start:14px}#zen-shared-home[data-zh-adding] .zh-footer{margin-top:12px}#zen-shared-home .zh-picker{padding:10px}#zen-shared-home .zh-recommendations{--zh-row:48px}#zen-shared-home .zh-picker-note{margin-bottom:6px}}
#zen-shared-home .zh-form input{width:100%;padding:9px 12px;border:1px solid color-mix(in srgb,currentColor 15%,transparent);border-radius:8px;background:color-mix(in srgb,currentColor 6%,transparent)}
#zen-shared-home .zh-error{font-size:11px;color:light-dark(#a22,#ffb2b2)}
#zen-shared-home .zh-pin[data-drop]{outline:1px solid AccentColor;border-radius:14px}
/* One surface: the Home button is replaced by the real native editor.
   No overlapping dummy bar and no separate native background silhouette. */
#zen-shared-home[data-zh-search] .zh-content{pointer-events:none;transition:none}
#zen-shared-home .zh-section,#zen-shared-home .zh-footer{transition:opacity 240ms ease}
#zen-shared-home[data-zh-search] .zh-section,#zen-shared-home[data-zh-search] .zh-footer{opacity:0;pointer-events:none}
#zen-shared-home[data-zh-search-ready] .zh-search{visibility:hidden}
#zen-shared-home[data-zh-search] .zh-search{outline:none!important}
@property --zh-reveal-height{syntax:"<length>";inherits:false;initial-value:56px}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"]{
  --zh-glass:var(--zh-search-glass);
  --zh-stroke:var(--zh-search-stroke);
  --urlbar-background-color:transparent!important;
  --urlbar-background-color-focus:transparent!important;
  --zen-urlbar-background-base:transparent!important;
  --zen-urlbar-background-transparent:transparent!important;
  --urlbar-background-overhang-open:0px!important;
  --urlbar-input-growth-open-inline:0px!important;
  --urlbar-input-growth-open-block:0px!important;
  --urlbar-background-border-radius:14px!important;
  --urlbar-background-border-top-radius-open:14px!important;
  --urlbar-container-height:var(--zh-search-header,56px)!important;
  --urlbar-margin-inline:0px!important;
  --urlbar-container-padding:0px!important;
  position:fixed!important;inset:auto!important;
  left:clamp(12px,var(--zh-search-left,12px),max(12px,calc(100vw - var(--zh-search-width,720px) - 12px)))!important;
  top:var(--zh-search-top,80px)!important;
  width:min(var(--zh-search-width,720px),calc(100vw - 24px))!important;
  min-width:0!important;max-width:none!important;
  height:auto!important;min-height:0!important;max-height:var(--zh-search-room,calc(100vh - 96px))!important;
  margin:0!important;padding:0!important;box-sizing:border-box!important;
  position-anchor:none!important;position-area:none!important;
  background:var(--zh-glass)!important;border:1px solid var(--zh-stroke)!important;
  border-radius:var(--zh-search-radius)!important;outline:0!important;box-shadow:none!important;
  overflow:clip!important;clip-path:none!important;transform:none!important;translate:none!important;scale:1!important;
  animation:none!important;transition:none!important;opacity:1!important;
}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] > .urlbar-background,
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] .urlbarView-background{
  background:transparent!important;border:0!important;outline:0!important;box-shadow:none!important;backdrop-filter:none!important;
  inset:0!important;margin:0!important;transform:none!important;scale:1!important;border-radius:14px!important;
}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] > .urlbar-input-container{
  box-sizing:border-box!important;min-height:calc(var(--zh-search-header,56px) - 2px)!important;height:calc(var(--zh-search-header,56px) - 2px)!important;
  max-height:calc(var(--zh-search-header,56px) - 2px)!important;flex-shrink:0!important;
  background:transparent!important;margin:0!important;padding:0 19px!important;border:0!important;outline:0!important;box-shadow:none!important;border-radius:var(--zh-search-radius)!important;
  gap:12px!important;align-items:center!important;
}
/* Use the same header typography and icon footprint as the Home button.
   Native search mode controls remain available when a mode is selected. */
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] .urlbar-input-box{
  margin:0!important;padding:0!important;min-width:0!important;font:var(--zh-search-font)!important;
}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] #urlbar-input{
  margin:0!important;padding:0!important;font:var(--zh-search-font)!important;
  color:var(--zh-search-color)!important;
}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] #urlbar-input::placeholder{
  color:var(--zh-search-label)!important;opacity:1!important;font:var(--zh-search-font)!important;
}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"]:not([searchmode]) > .urlbar-input-container::before{
  content:"";display:block;width:17px;height:17px;flex:0 0 17px;background:var(--zh-search-label);
  mask:var(--zh-search-icon) center/contain no-repeat;pointer-events:none;
}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"]:not([searchmode]) #identity-box{display:none!important}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] .urlbarView{
  background:transparent!important;border:0!important;outline:0!important;box-shadow:none!important;border-radius:0 0 14px 14px!important;
  flex-shrink:0!important;
}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] #urlbar-results,
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] #urlbar-results[data-zr-smart-grid]{
  max-height:max(56px,calc(var(--zh-search-room,calc(100vh - 96px)) - var(--zh-search-header,56px) - 40px))!important;
  overflow-y:auto!important;scrollbar-width:thin;
}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] #urlbar-results .urlbarView-row{
  --urlbarview-row-min-height:40px;
}
/* Home already animates the whole result view. Keep both chronological
   rails stable; ordinary non-Home search retains its own timeline motion. */
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] #urlbar-results[data-zr-smart-grid][data-zr-timeline] > .urlbarView-row[data-zr-rail]::after{
  animation:none!important;background-position:center bottom,center!important;opacity:.43!important;
}
#urlbar[data-zr-home-search-motion="prepare"][zen-floating-urlbar="true"],
#urlbar[data-zr-home-search-motion="run"][zen-floating-urlbar="true"]{
  height:var(--zh-reveal-height,var(--zh-search-header,56px))!important;
}
/* Keep the original button painted until the real editor is ready.
   Both changes happen in the same frame, so there is no blank handoff. */
#urlbar[data-zr-home-search-motion="prepare"][zen-floating-urlbar="true"]{opacity:0!important}
#urlbar[data-zr-home-search-motion="prepare"][zen-floating-urlbar="true"] .urlbarView{opacity:0!important}
#urlbar[data-zr-home-search-motion="run"][zen-floating-urlbar="true"] .urlbarView{opacity:var(--zh-results-alpha,1)!important}
#urlbar[data-zr-home-search-motion="closed"][zen-floating-urlbar="true"]{opacity:0!important}
#urlbar[data-zr-home-search][data-zh-closing] .urlbarView{pointer-events:none!important}
#zen-home-search-return{
  position:fixed;z-index:2147483000;box-sizing:border-box;overflow:hidden;pointer-events:none;
  background:var(--zh-search-glass);border:1px solid var(--zh-search-stroke);
  border-radius:var(--zh-search-radius);color:var(--zh-search-label);font:var(--zh-search-font);
}
#zen-home-search-return .zh-return-header{box-sizing:border-box}
#zen-shared-home[data-zh-return] .zh-search{visibility:hidden}
#zen-shared-home[data-zh-return] .zh-section{opacity:1;transition:none!important;animation:none!important;pointer-events:none}
#zen-shared-home[data-zh-return] :is(.zh-section h3,.zh-pin,.zh-pins .zh-empty,.zh-editbar,.zh-space,.zh-footer){
  opacity:calc(var(--zh-return-alpha,0) * var(--zh-return-base,1));
  clip-path:inset(var(--zh-return-clip,0px) 0 0 0);
  translate:0 var(--zh-return-shift,0px);
  transition:none!important;animation:none!important;pointer-events:none
}
#zen-home-search-return .zh-return-results{position:absolute;pointer-events:none;overflow:hidden}
#zen-home-search-return,#zen-home-search-return *{-moz-window-dragging:no-drag!important;pointer-events:none!important}
@media(max-width:600px){#zen-shared-home{padding:62px 16px 20px}#zen-shared-home .zh-pin{flex-basis:calc((100% - 24px)/3)}#zen-shared-home .zh-tile{height:84px}#zen-shared-home .zh-space{flex-basis:120px}}
@media(prefers-reduced-motion:reduce){#zen-shared-home *{transition:none!important;animation:none!important}#zen-shared-home .zh-suggestion:active,#zen-shared-home .zh-suggestion:hover .zh-suggestion-plus{scale:1}}
`;
  const panel=html("div");panel.id="zen-shared-home";panel.hidden=true;
  panel.setAttribute("role","region");panel.setAttribute("aria-label","Home");
  const content=html("main","zh-content");panel.append(content);
  let open=false,editing=false,dead=false,switching=false,adding=false,dragId=null,focusHome=null,oldInert=false,covered=false,motion=null,searchToken=null,startupHome=false,homeOnPlaceholder=false;
  let searchFrame=0,searchMotion=null,searchTimer=0,searchBar=null,nativeCancelTab=null;
  let searchGeometry=null,searchLastHeight=0,searchCurrentHeight=0,searchClosing=false,searchReturn=null,searchReturnFrame=0;
  let searchInput=null,searchOriginalPlaceholder=null,searchSessionLabel=null;
  let searchSnapshot=null,searchSnapshotTimer=0,searchSnapshotObserver=null,searchSnapshotDirty=true,searchSnapshotView=null;
  let searchReturnParts=[],searchLastRect=null;
  let pinScrollTop=0,pinCustom=false,pinViewMode="home";
  const leases=new Set(),cleanups=[];
  function listen(node,type,fn,options){node.addEventListener(type,fn,options);cleanups.push(()=>node.removeEventListener(type,fn,options));}
  const button=(cls,label,fn)=>{const n=html("button",cls,label);n.type="button";n.addEventListener("click",fn);return n;};
  function load(){try{return normalize(JSON.parse(prefs.getStringPref(PREF,'{"version":1,"items":[]}')));}catch{return [];}}
  function save(items){prefs.setStringPref(PREF,JSON.stringify({version:1,items:normalize({version:1,items})}));}
  function notify(){for(const l of [...leases])for(const fn of [...l.listeners])try{fn(open);}catch(error){win.console.warn("[Zen Home] subscriber",error);}}
  function allowed(){return !dead&&host.isConnected&&panels.isConnected&&!root.hasAttribute("customizing")&&root.getAttribute("inDOMFullscreen")!=="true"&&root.getAttribute("inFullscreen")!=="true"&&!root.hasAttribute("popup-window");}
  // Home is a primary destination, not a modal toggle.
  function isHomePlaceholder(tab,uri){
    if(!tab||tab.closing||tab.hasAttribute("zen-glance-tab"))return false;
    // Zen explicitly creates its permanent empty tab before selection.
    if(tab.hasAttribute("zen-empty-tab"))return true;
    if(tab.hasAttribute("pending")||tab.hasAttribute("discarded")||tab.hasAttribute("busy"))return false;
    try{
      const b=tab.linkedBrowser, spec=uri?.spec||b?.currentURI?.spec||"";
      const empty=/^about:(blank|newtab|home)(?:[?#].*)?$/i;
      if(!empty.test(spec)||b?.webProgress?.isLoadingDocument||
         (b?.userTypedValue&&!empty.test(b.userTypedValue)))return false;
      // An ordinary new browser begins with an INITIAL about:blank even
      // when its requested destination is a real URL. Never expose Home
      // until the parent-process WindowGlobal confirms a committed page.
      const global=b?.browsingContext?.currentWindowGlobal;
      return global?.isInitialDocument===false&&global.documentURI?.spec===spec;
    }catch{return false;}
  }
  function ensurePrimaryHome(){
    if(open||switching||!allowed()||win.__oneplaneWorkspaceProjection||
       root.getAttribute("data-op-startup-ready")==="pending"||
       nativeSearchOpen(win.gURLBar)||!isHomePlaceholder(browser.selectedTab))return false;
    return show();
  }
  function leaveHome(focus=false){
    if(!open)return false;
    if(isHomePlaceholder(browser.selectedTab)){
      homeOnPlaceholder=true;finishSearchVisual();return false;
    }
    close(focus);return true;
  }
  function onSelectedTab(){
    nativeCancelTab=null;
    if(switching||!allowed())return;
    if(isHomePlaceholder(browser.selectedTab)){
      if(open)homeOnPlaceholder=true;else ensurePrimaryHome();
    }else if(browser.selectedTab)close();
  }
  function restore(){if(!covered)return;covered=false;panels.removeAttribute("data-zr-home-covered");if(!oldInert)panels.removeAttribute("inert");host.removeAttribute("data-zr-home-host");}
  function stopMotion(){motion?.cancel();motion=null;}
  function close(restoreFocus=false){
    if(!open)return;open=false;editing=false;adding=false;pinScrollTop=0;pinCustom=false;pinViewMode="home";panel.removeAttribute("data-zh-adding");dragId=null;startupHome=false;homeOnPlaceholder=false;finishSearchVisual();stopMotion();panel.hidden=true;restore();notify();
    if(restoreFocus)try{if(focusHome?.isConnected)focusHome.focus({preventScroll:true});else browser.selectedBrowser?.focus();}catch{}
    focusHome=null;
  }
  function navigate(item){
    try{win.openTrustedLinkIn(item.url,"tab");leaveHome();}catch(error){win.console.warn("[Zen Home] shortcut navigation",error);}
  }
  // Animate only the Home-origin native floating search session.
  function searchActive(){
    const bar=win.gURLBar;
    return Boolean(bar&&(bar.view?.isOpen||bar.hasAttribute("zen-newtab")||bar.hasAttribute("open")||bar.hasAttribute("focused")));
  }
  function nativeSearchOpen(bar){
    return Boolean(bar&&(bar.view?.isOpen||bar.hasAttribute("zen-newtab")||bar.hasAttribute("open")));
  }
  function finishSearchMotion(){
    if(searchFrame)win.cancelAnimationFrame(searchFrame);
    searchFrame=0;
    const a=searchMotion;searchMotion=null;
    searchBar?.removeAttribute("data-zr-home-search-motion");
    searchBar?.style?.removeProperty("--zh-reveal-height");
    searchBar?.style?.removeProperty("--zh-results-alpha");
    try{a?.cancel();}catch{}
  }
  function finishSearchVisual(){
    finishSearchMotion();
    if(searchTimer)win.clearTimeout(searchTimer);searchTimer=0;
    if(searchReturnFrame)win.cancelAnimationFrame(searchReturnFrame);searchReturnFrame=0;
    searchReturn?.remove();searchReturn=null;
    stopSearchSnapshot();
    for(const part of searchReturnParts)for(const key of ["alpha","base","clip","shift"])part.node.style.removeProperty("--zh-return-"+key);
    searchReturnParts=[];searchLastRect=null;
    if(searchBar){
      searchBar.removeAttribute("data-zr-home-search");searchBar.removeAttribute("data-zh-closing");
      for(const key of ["left","top","width","header","room"])searchBar.style?.removeProperty("--zh-search-"+key);
    }
    if(searchInput&&searchInput.getAttribute("placeholder")===searchSessionLabel){
      if(searchOriginalPlaceholder===null)searchInput.removeAttribute("placeholder");
      else searchInput.setAttribute("placeholder",searchOriginalPlaceholder);
    }
    searchInput=null;searchOriginalPlaceholder=null;searchSessionLabel=null;
    searchBar=null;searchToken=null;searchGeometry=null;searchLastHeight=0;searchCurrentHeight=0;searchClosing=false;
    panel.removeAttribute("data-zh-search");panel.removeAttribute("data-zh-search-ready");panel.removeAttribute("data-zh-return");content.removeAttribute("inert");
  }
  function homeSearchGeometry(from,viewportWidth,viewportHeight){
    if(!from||!(from.width>0)||!(from.height>0))return null;
    const w=Math.max(24,Number(viewportWidth)||1280),h=Math.max(24,Number(viewportHeight)||800);
    const width=Math.min(from.width,Math.max(1,w-24)),header=from.height;
    const left=Math.min(Math.max(12,from.left+(from.width-width)/2),Math.max(12,w-width-12));
    // Keep the original header position. Results scroll in the remaining
    // viewport instead of moving the entire interface on activation.
    const top=Math.min(Math.max(12,from.top),Math.max(12,h-header-16));
    return {left,top,width,header,room:Math.max(header,h-top-16)};
  }
  function applySearchGeometry(bar,geometry){
    if(!geometry)return;
    for(const [key,value] of Object.entries(geometry))bar.style?.setProperty("--zh-search-"+key,value+"px");
  }
  // Use an explicit bounded frame driver instead of depending on Gecko
  // interpolating a registered custom property. The only per-frame work
  // is writing two values to this one search surface; no layout reads.
  function revealValue(from,to,progress){
    const t=Math.max(0,Math.min(1,progress)),eased=t*t*(3-2*t);
    return from+(to-from)*eased;
  }
  function paintSearchHeight(bar,height,alpha){
    searchCurrentHeight=height;
    bar.style?.setProperty("--zh-reveal-height",height+"px");
    bar.style?.setProperty("--zh-results-alpha",String(Math.max(0,Math.min(1,alpha))));
  }
  function naturalSearchHeight(bar,geometry){
    // Remove the height constraint for this synchronous measurement only;
    // restore before painting. Unlike measuring the prepared header, this
    // includes the asynchronous native results and the actual box border.
    const phase=bar.getAttribute("data-zr-home-search-motion");
    bar.removeAttribute("data-zr-home-search-motion");
    const h=bar.getBoundingClientRect().height;
    if(phase)bar.setAttribute("data-zr-home-search-motion",phase);
    return Math.max(geometry.header,Math.min(geometry.room,h||geometry.header));
  }
  function animateSearchHeight(token,from,to,duration,closing,done){
    if(searchFrame)win.cancelAnimationFrame(searchFrame);
    searchFrame=0;
    const bar=searchBar;if(!bar)return;
    bar.setAttribute("data-zr-home-search-motion","run");
    const header=searchGeometry?.header||56;
    const alpha=h=>Math.min(1,Math.max(0,(h-header)/Math.max(120,Math.abs(to-from)*.55)));
    paintSearchHeight(bar,from,alpha(from));
    let start=null;
    const tick=now=>{
      searchFrame=0;
      if(!open||searchToken!==token||searchBar!==bar||searchClosing!==closing)return;
      if(start===null)start=now;
      const p=Math.min(1,(now-start)/duration),height=revealValue(from,to,p);
      paintSearchHeight(bar,height,alpha(height));
      if(p<1)searchFrame=win.requestAnimationFrame(tick);else done();
    };
    searchFrame=win.requestAnimationFrame(tick);
  }
  function startSearchMorph(token,geometry){
    if(!searchBar||!geometry||win.matchMedia("(prefers-reduced-motion: reduce)").matches){
      panel.setAttribute("data-zh-search-ready","");finishSearchMotion();return;
    }
    // Keep the source visible until the native floating box is ready.
    // Then reveal the results from the same header without a flash.
    let attempts=0;
    const step=()=>{
      searchFrame=0;
      if(!open||searchToken!==token||!searchBar||searchClosing)return;
      const bar=searchBar;
      if(bar.hasAttribute("open")&&bar.getAttribute("zen-floating-urlbar")==="true"){
        const target=naturalSearchHeight(bar,geometry);
        if(!panel.hasAttribute("data-zh-search-ready")){
          panel.setAttribute("data-zh-search-ready","");
          bar.setAttribute("data-zr-home-search-motion","run");
        }
        if(target>geometry.header+8){
          searchLastHeight=target;
          const reveal=(from,to,round)=>{
            animateSearchHeight(token,from,to,round?280:560,false,()=>{
              const latest=naturalSearchHeight(bar,geometry);
              searchLastHeight=latest;
              if(Math.abs(latest-to)>5&&round<2){reveal(to,latest,round+1);return;}
              finishSearchMotion();scheduleSearchSnapshot();
            });
          };
          reveal(geometry.header,target,0);return;
        }
      }
      if(++attempts<120&&nativeSearchOpen(bar))searchFrame=win.requestAnimationFrame(step);
      else{panel.setAttribute("data-zh-search-ready","");finishSearchMotion();}
    };
    searchFrame=win.requestAnimationFrame(step);
  }
  function search(){
    if(!open||searchToken||nativeSearchOpen(win.gURLBar))return;
    const bar=win.gURLBar;if(!bar)return;
    const source=content.querySelector(".zh-search");
    const from=source?.getBoundingClientRect();
    const geometry=homeSearchGeometry(from,win.innerWidth,win.innerHeight);
    const token={};searchToken=token;searchBar=bar;searchGeometry=geometry;
    searchLastHeight=searchCurrentHeight=geometry?.header||56;
    applySearchGeometry(bar,geometry);
    bar.setAttribute("data-zr-home-search","");
    if(geometry&&!win.matchMedia("(prefers-reduced-motion: reduce)").matches){
      paintSearchHeight(bar,geometry.header,0);
      bar.setAttribute("data-zr-home-search-motion","prepare");
    }
    panel.setAttribute("data-zh-search","");content.setAttribute("inert","");
    try{
      if(win.gZenUIManager?.handleNewTab(false,false,"tab",true,token)!==true){
        finishSearchVisual();win.console.warn("[Zen Home] floating search unavailable");return;
      }
      searchInput=bar.inputField||doc.getElementById("urlbar-input");
      if(searchInput){
        searchOriginalPlaceholder=searchInput.getAttribute("placeholder");
        searchSessionLabel=source?.querySelector("span")?.textContent||"Search or enter address";
        searchInput.setAttribute("placeholder",searchSessionLabel);
      }
      startSearchSnapshot();startSearchMorph(token,geometry);
    }catch(error){finishSearchVisual();win.console.warn("[Zen Home] native search",error);}
  }
  // Freeze the visual result tree only: no native custom elements,
  // event handlers, selectable IDs or interactive links.
  // Resolved longhands preserve one-sided separators and multi-layer
  // pseudo-elements. Mixed border shorthands were empty in the old copy.
  const snapshotProperties=("display position box-sizing width height min-width min-height max-width max-height top right bottom left margin-top margin-right margin-bottom margin-left padding-top padding-right padding-bottom padding-left border-top-width border-right-width border-bottom-width border-left-width border-top-style border-right-style border-bottom-style border-left-style border-top-color border-right-color border-bottom-color border-left-color border-top-left-radius border-top-right-radius border-bottom-right-radius border-bottom-left-radius outline-width outline-style outline-color outline-offset box-shadow background-color background-image background-size background-position background-position-x background-position-y background-repeat background-origin background-clip color opacity font-family font-size font-weight font-style font-stretch font-variant-numeric font-feature-settings line-height letter-spacing text-align text-overflow white-space overflow-x overflow-y overflow-wrap direction writing-mode align-items align-self align-content justify-items justify-self justify-content flex-direction flex-wrap flex-grow flex-shrink flex-basis order row-gap column-gap grid-template-columns grid-template-rows grid-auto-rows grid-auto-columns grid-auto-flow grid-row-start grid-row-end grid-column-start grid-column-end vertical-align object-fit object-position list-style-image fill stroke -moz-context-properties mask-image mask-size mask-position mask-repeat transform transform-origin scale translate visibility z-index scrollbar-width scrollbar-color").split(" ");
  function snapshotNow(){return win.performance?.now?.()??Date.now();}
  function snapshotReady(bar){
    // Zen removes zen-newtab before notifying Home of cancellation.
    // Preserve the last live grid instead of copying its teardown state.
    return Boolean(bar?.hasAttribute("zen-newtab")&&bar.view?.isOpen&&bar.getAttribute("zen-floating-urlbar")==="true");
  }
  function snapshotPseudoText(value,source){
    if(!value||value==="none"||value==="normal")return null;
    const attr=value.match(/^attr\(([^)]+)\)$/);
    return attr?source.getAttribute(attr[1])||"":value.replace(/^["']|["']$/g,"");
  }

  function searchLog(event,fields={}){
    win.console.info?.("[Zen Home] search "+event,fields);
  }
  // A card starts appearing when any of its height is uncovered, rather
  // than waiting for the top of the entire Pinned section to clear.
  function returnCardState(top,height,bottom,progress,finalBottom){
    const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
    const h=Math.max(1,height),p=clamp(progress);
    const overlap=Math.max(0,bottom-top+3)-Math.max(0,finalBottom-top+3);
    const clip=Math.min(h,Math.max(0,overlap));
    const exposed=h-clip;
    const alpha=smooth(exposed/Math.min(h,38))*smooth(p/.48);
    return {alpha,clip,shift:6*(1-alpha)};
  }
  function prepareReturnParts(){
    // Measure all visible cards and headings once. Rows at equal y share
    // the same reveal timing automatically, including wrapped workspaces.
    const bounds=panel.getBoundingClientRect();
    const parts=[];
    for(const node of content.querySelectorAll(".zh-section h3,.zh-pin,.zh-pins .zh-empty,.zh-editbar,.zh-space,.zh-footer")){
      const rect=node.getBoundingClientRect();
      if(rect.height<=0||rect.bottom<=bounds.top||rect.top>=bounds.bottom)continue;
      // Footer itself is hidden by data-zh-search; its resting opacity is 1.
      const base=node.classList.contains("zh-footer")?1:Number.parseFloat(win.getComputedStyle(node).opacity);
      parts.push({node,top:rect.top,height:rect.height,base:Number.isFinite(base)?base:1,last:null});
    }
    return parts;
  }
  function paintReturnParts(parts,bottom,progress,finalBottom){
    for(const part of parts){
      const state=returnCardState(part.top,part.height,bottom,progress,finalBottom);
      const alpha=state.alpha.toFixed(3),clip=state.clip.toFixed(2)+"px",shift=state.shift.toFixed(2)+"px";
      const key=alpha+"/"+clip+"/"+shift;if(part.last===key)continue;part.last=key;
      part.node.style.setProperty("--zh-return-alpha",alpha);
      part.node.style.setProperty("--zh-return-clip",clip);
      part.node.style.setProperty("--zh-return-shift",shift);
    }
  }
  function freezeSearchResults(view,barRect){
    const rect=view.getBoundingClientRect();
    if(!(rect.width>0&&rect.height>0))return null;
    const scroll=[];let budget=900,pseudos=0,rails=0;
    function styleCopy(target,style){
      for(const key of snapshotProperties){
        const value=style.getPropertyValue(key);
        if(value)target.style.setProperty(key,value);
      }
      for(const key of ["animation","transition","pointer-events"])target.style.setProperty(key,"none","important");
    }
    function pseudo(source,target,which){
      const style=win.getComputedStyle(source,which),label=snapshotPseudoText(style.content,source);
      if(label===null||style.display==="none")return;
      const n=html("span");styleCopy(n,style);n.textContent=label;pseudos++;
      if(which==="::after"&&source.hasAttribute("data-zr-rail"))rails++;
      if(which==="::before")target.prepend(n);else target.append(n);
    }
    function copy(source){
      if(--budget<0)return null;
      const style=win.getComputedStyle(source);
      if(style.display==="none"||style.visibility==="collapse"||source.hidden)return null;
      const image=source.localName==="img"||source.localName==="image";
      const src=image&&(source.currentSrc||source.getAttribute("src"));
      const tag=src?"img":(!image&&["span","b","strong","em","small"].includes(source.localName)?source.localName:"div");
      const target=html(tag);styleCopy(target,style);
      if(src){target.src=src;target.alt="";target.draggable=false;target.style.setProperty("-moz-context-properties",style.getPropertyValue("-moz-context-properties")||"fill, stroke");}
      else if(image&&style.listStyleImage&&style.listStyleImage!=="none"){
        Object.assign(target.style,{backgroundImage:style.listStyleImage,backgroundSize:"contain",backgroundRepeat:"no-repeat",backgroundPosition:"center"});
        target.style.setProperty("-moz-context-properties",style.getPropertyValue("-moz-context-properties")||"fill, stroke");
      }
      if(!image){
        for(const child of source.childNodes){
          if(child.nodeType===3)target.append(doc.createTextNode(child.nodeValue||""));
          else if(child.nodeType===1){const n=copy(child);if(n)target.append(n);}
        }
        pseudo(source,target,"::before");pseudo(source,target,"::after");
      }
      if(source.scrollTop||source.scrollLeft)scroll.push({node:target,top:source.scrollTop,left:source.scrollLeft});
      return target;
    }
    const frozen=copy(view);if(!frozen||budget<0)return null;
    const holder=html("div","zh-return-results");
    Object.assign(holder.style,{left:(rect.left-barRect.left-1)+"px",top:(rect.top-barRect.top-1)+"px",width:rect.width+"px",height:rect.height+"px"});
    Object.assign(frozen.style,{position:"relative",inset:"auto",margin:"0",boxSizing:"border-box",width:rect.width+"px",height:rect.height+"px",opacity:"1"});
    holder.append(frozen);
    return {node:holder,scroll,rows:view.querySelectorAll(".urlbarView-row:not([hidden])").length,pseudos,rails,rect:{left:barRect.left,top:barRect.top,width:barRect.width,height:barRect.height}};
  }
  function captureSearchSnapshot(){
    if(!searchToken||!searchBar||searchClosing||searchReturn||!searchGeometry||
       !snapshotReady(searchBar))return;
    if(searchSnapshot&&!searchSnapshotDirty)return;
    try{
      const view=searchBar.querySelector?.(".urlbarView");
      if(!view?.querySelector(".urlbarView-row:not([hidden])"))return;
      const began=snapshotNow(),frozen=freezeSearchResults(view,searchBar.getBoundingClientRect());
      if(frozen?.rows){frozen.capturedAt=snapshotNow();frozen.captureMs=frozen.capturedAt-began;searchSnapshot=frozen;searchSnapshotDirty=false;}
    }catch(error){searchLog("snapshot unavailable",{reason:error?.name||"Error"});}
  }
  function scheduleSearchSnapshot(){
    if(!searchToken||searchClosing||searchReturn||!snapshotReady(searchBar))return;
    searchSnapshotDirty=true;
    if(searchSnapshotTimer)return;
    searchSnapshotTimer=win.setTimeout(()=>{searchSnapshotTimer=0;captureSearchSnapshot();},80);
  }
  function startSearchSnapshot(){
    if(win.matchMedia("(prefers-reduced-motion: reduce)").matches||!searchBar||!win.MutationObserver)return;
    const view=searchBar.querySelector?.(".urlbarView");if(!view)return;
    searchSnapshotView=view;view.addEventListener("scroll",scheduleSearchSnapshot,true);
    searchSnapshotObserver=new win.MutationObserver(records=>{
      // Identical attribute writes from a query refresh are not visual changes.
      if(records.some(r=>r.type!=="attributes"||r.oldValue!==r.target.getAttribute(r.attributeName)))scheduleSearchSnapshot();
    });
    searchSnapshotObserver.observe(view,{subtree:true,childList:true,characterData:true,attributes:true,attributeOldValue:true,attributeFilter:["hidden","src","selected","style","stale","data-zr-group","data-zr-cell","data-zr-first","data-zr-rail","data-zr-column","data-zr-top","data-zr-narrow","data-zr-smart-grid","data-zr-timeline"]});
    scheduleSearchSnapshot();
  }
  function stopSearchSnapshot(){
    if(searchSnapshotTimer)win.clearTimeout(searchSnapshotTimer);searchSnapshotTimer=0;
    searchSnapshotObserver?.disconnect();searchSnapshotObserver=null;
    searchSnapshotView?.removeEventListener("scroll",scheduleSearchSnapshot,true);searchSnapshotView=null;
    searchSnapshot=null;searchSnapshotDirty=true;
  }
  function finishNativeCancel(){
    const bar=searchBar;
    // Use Zen's own session closure; do not replace its provider or patch
    // its methods. Native cancellation still runs even if animation fails.
    try{
      if(typeof bar?._zenHandleUrlbarClose==="function")bar._zenHandleUrlbarClose(false,false);
      else bar?.view?.close();
      bar?.blur?.();
    }catch(error){win.console.warn("[Zen Home] search cancel",error);finishSearchVisual();}
  }
  function cancelHomeSearch(reason="escape"){
    if(!searchToken||!searchBar||!searchGeometry||searchClosing||!nativeSearchOpen(searchBar))return false;
    if(win.matchMedia("(prefers-reduced-motion: reduce)").matches)return false;
    if(searchBar.getAttribute("zen-floating-urlbar")!=="true")return false;
    captureSearchSnapshot();
    animateSearchReturn(reason,true);
    if(!searchReturn)return false;
    finishNativeCancel();
    return true;
  }
  function animateSearchReturn(reason="native-close",live=false){
    if(!searchToken||searchReturn)return;
    if(!searchGeometry||win.matchMedia("(prefers-reduced-motion: reduce)").matches){finishSearchVisual();return;}
    const handoffStarted=snapshotNow(),g=searchGeometry,bar=searchBar;
    captureSearchSnapshot();
    const measured=live?bar?.getBoundingClientRect():(searchLastRect||searchSnapshot?.rect);
    const height=Math.max(g.header,Math.min(g.room,measured?.height||searchLastHeight||g.header));
    const startBox={left:measured?.left??g.left,top:measured?.top??g.top,width:measured?.width||g.width};
    const resultAlpha=live?Number.parseFloat(win.getComputedStyle(bar.querySelector(".urlbarView")||bar).opacity):1;
    const initialAlpha=Math.max(0,Math.min(1,Number.isFinite(resultAlpha)?resultAlpha:1));
    searchClosing=true;
    finishSearchMotion();
    if(searchTimer)win.clearTimeout(searchTimer);searchTimer=0;
    if(bar){bar.setAttribute("data-zr-home-search-motion","closed");bar.setAttribute("data-zh-closing","");}
    const shell=html("div");shell.id="zen-home-search-return";shell.setAttribute("aria-hidden","true");shell.setAttribute("inert","");
    const source=content.querySelector(".zh-search"),header=html("div","zh-return-header");
    const icon=source?.querySelector("svg")?.cloneNode(true);
    if(icon)header.append(icon);
    header.append(html("span","",source?.querySelector("span")?.textContent||"Search or enter address"));shell.append(header);
    const dest=source?.getBoundingClientRect()||{left:g.left,top:g.top,width:g.width,height:g.header};
    Object.assign(shell.style,{left:startBox.left+"px",top:startBox.top+"px",width:startBox.width+"px",height:height+"px"});
    header.style.height=Math.max(0,g.header-2)+"px";
    const frozen=searchSnapshot;
    if(frozen){frozen.node.style.opacity=String(initialAlpha);shell.append(frozen.node);}
    root.append(shell);searchReturn=shell;
    if(frozen)for(const s of frozen.scroll){s.node.scrollTop=s.top;s.node.scrollLeft=s.left;}
    searchReturnParts=prepareReturnParts();
    const parts=searchReturnParts,finalBottom=dest.top+dest.height;
    for(const part of parts)part.node.style.setProperty("--zh-return-base",String(part.base));
    // Remove completed entry animations so they cannot replay at handoff.
    for(const node of content.querySelectorAll("[data-zh-enter]"))node.removeAttribute("data-zh-enter");
    paintReturnParts(parts,startBox.top+height,0,finalBottom);
    panel.setAttribute("data-zh-search-ready","");panel.setAttribute("data-zh-return","");
    const duration=height>dest.height+8?460:180;
    searchLog("close-start",{reason,rows:frozen?.rows||0,rails:frozen?.rails||0,pseudos:frozen?.pseudos||0,height:Math.round(height),header:Math.round(dest.height),duration,parts:parts.length,snapshotDirty:searchSnapshotDirty,snapshotAge:frozen?Math.round(snapshotNow()-frozen.capturedAt):null,captureMs:frozen?Math.round(frozen.captureMs):null,handoffMs:Math.round(snapshotNow()-handoffStarted)});
    const token=searchToken;let start=null,previous=null,maxFrameGap=0,firstFrameDelay=0;
    const moveTop=Math.abs(startBox.top-dest.top)>.1,moveLeft=Math.abs(startBox.left-dest.left)>.1,moveWidth=Math.abs(startBox.width-dest.width)>.1;
    const tick=now=>{
      searchReturnFrame=0;if(!open||searchToken!==token||searchReturn!==shell)return;
      if(start===null){start=now;firstFrameDelay=Math.max(0,snapshotNow()-handoffStarted);}
      if(previous!==null)maxFrameGap=Math.max(maxFrameGap,now-previous);previous=now;
      const p=Math.min(1,(now-start)/duration),h=revealValue(height,dest.height,p),top=revealValue(startBox.top,dest.top,p);
      shell.style.height=h+"px";
      if(moveTop)shell.style.top=top+"px";
      if(moveLeft)shell.style.left=revealValue(startBox.left,dest.left,p)+"px";
      if(moveWidth)shell.style.width=revealValue(startBox.width,dest.width,p)+"px";
      if(frozen)frozen.node.style.opacity=String(initialAlpha*Math.min(1,Math.max(0,(h-dest.height)/80)));
      paintReturnParts(parts,top+h,p,finalBottom);
      if(p<1)searchReturnFrame=win.requestAnimationFrame(tick);
      else{
        searchLog("close-finish",{reason,rows:frozen?.rows||0,elapsed:Math.round(now-start),maxFrameGap:Math.round(maxFrameGap),firstFrameDelay:Math.round(firstFrameDelay)});
        finishSearchVisual();content.querySelector(".zh-search")?.focus({preventScroll:true});
      }
    };
    searchReturnFrame=win.requestAnimationFrame(tick);
  }
  function onSearchClosed(event){
    const detail=event.detail;
    if(!open){
      // A result pick or tab switch is navigation, not a Home request.
      // Zen can dispatch this before the native view has finished closing.
      nativeCancelTab=null;
      if(detail&&!detail.onElementPicked&&!detail.onSwitch&&isHomePlaceholder(browser.selectedTab)){
        nativeCancelTab=browser.selectedTab;
        if(ensurePrimaryHome())nativeCancelTab=null;
      }
      return;
    }
    if(!searchToken||detail?.closeSeq!==searchToken.id)return;
    if(detail.onElementPicked||detail.onSwitch)leaveHome();
    else animateSearchReturn("native-event");
  }
  function observeSearch(){
    if(!searchToken||!searchBar){
      if(!open&&nativeCancelTab&&nativeCancelTab===browser.selectedTab&&!nativeSearchOpen(win.gURLBar)){
        nativeCancelTab=null;ensurePrimaryHome();
      }
      return;
    }
    if(searchReturn)return;
    if(nativeSearchOpen(searchBar)){
      if(searchTimer)win.clearTimeout(searchTimer);searchTimer=0;return;
    }
    // Native close can omit its event. Recover without leaving Home hidden.
    if(!searchTimer)searchTimer=win.setTimeout(()=>{
      searchTimer=0;if(searchToken&&!nativeSearchOpen(searchBar))animateSearchReturn("native-observer");
    },32);
  }
  function move(id,targetId){
    const items=load(),from=items.findIndex(x=>x.id===id),to=items.findIndex(x=>x.id===targetId);
    if(from<0||to<0||from===to)return;const [item]=items.splice(from,1);items.splice(to,0,item);save(items);
  }
  // Rank actual toolbar bookmarks first, then the most recently used
  // visible native tabs. No history query, network requests or mod dependency.
  function recommendedPins(bookmarks,tabs,items,limit=16){
    const seen=new Set(items.map(item=>safeURL(item.url)).filter(Boolean)),result=[];
    const add=(entry,source)=>{
      if(result.length>=limit)return;
      const url=safeURL(entry?.url);
      if(!url||seen.has(url))return;
      seen.add(url);
      result.push({url,title:String(entry.title||new win.URL(url).hostname).trim().slice(0,80)||new win.URL(url).hostname,source});
    };
    for(const entry of bookmarks)add(entry,"Bookmark");
    for(const entry of [...tabs].sort((a,b)=>(Number(b.last)||0)-(Number(a.last)||0)))add(entry,"Open tab");
    return result;
  }
  function collectRecommendations(items){
    const bookmarks=[],tabs=[];
    // Native Places toolbarbuttons already contain the bookmark's title
    // and URI, including items hidden by overflow. Skip folders/separators.
    for(const node of doc.getElementById("PlacesToolbarItems")?.children||[]){
      try{
        if(!node.matches("toolbarbutton.bookmark-item")||node.hasAttribute("container"))continue;
        const place=node._placesNode;
        const url=place?.uri||node.getAttribute("targetURI");
        if(url)bookmarks.push({url,title:place?.title||node.getAttribute("label")||node.label});
      }catch{}
    }
    for(const tab of Array.from(browser.visibleTabs||browser.tabs||[])){
      try{
        if(tab.closing||tab.hidden||tab.hasAttribute("zen-empty-tab"))continue;
        const url=tab.linkedBrowser?.currentURI?.spec;
        const lazy=tab.hasAttribute("pending")||tab.hasAttribute("discarded");
        const target=lazy?(win.SessionStore?.getLazyTabValue?.(tab,"url")||url):url;
        tabs.push({url:target,title:tab.label||tab.getAttribute("label"),last:tab===browser.selectedTab?Number.MAX_SAFE_INTEGER:Number(tab.lastSeenActive||tab.lastAccessed)||0});
      }catch{}
    }
    return recommendedPins(bookmarks,tabs,items);
  }
  function addPin(rawURL,rawTitle){
    const url=safeURL(rawURL),items=load();
    if(!url)return "Enter a valid HTTP or HTTPS URL.";
    if(items.length>=100)return "Shortcut limit reached.";
    if(items.some(i=>i.url===url))return "This site is already pinned.";
    const title=String(rawTitle||"").trim().slice(0,80)||new win.URL(url).hostname;
    let id;try{id=services.uuid.generateUUID().toString();}catch{id=String(Date.now())+"-"+Math.random().toString(36).slice(2);}
    save([...items,{id,type:"shortcut",title,url}]);
    return "";
  }
  // Keep a native two-row scroll viewport; preserve its position on
  // preference-driven re-render and when visiting the custom form.
  function leavePinPicker(){
    adding=false;pinScrollTop=0;pinCustom=false;render();
    content.querySelector(".zh-add-pin")?.focus({preventScroll:true});
  }
  function restorePinScroll(grid,top){
    if(!grid)return 0;
    const max=Math.max(0,grid.scrollHeight-grid.clientHeight);
    grid.scrollTop=Math.min(max,Math.max(0,Number(top)||0));
    return grid.scrollTop;
  }
  function addForm(parent){
    const picker=html("div","zh-picker"),head=html("div","zh-picker-head"),error=html("div","zh-error");
    error.setAttribute("role","status");
    const count=html("span","zh-picker-count",load().length+" pinned");
    head.append(html("h3","",pinCustom?"Add a custom URL":"Recommended"),count);
    picker.append(head);
    if(pinCustom){
      const form=html("form","zh-form"),url=html("input"),name=html("input"),submit=html("button","zh-small","Add"),actions=html("div","zh-custom-actions");
      url.placeholder="https://example.com";url.setAttribute("aria-label","Website URL");url.required=true;url.maxLength=2048;
      name.placeholder="Name (optional)";name.setAttribute("aria-label","Optional shortcut name");name.maxLength=80;
      submit.type="submit";
      actions.append(button("zh-small","Back",()=>{pinCustom=false;render();content.querySelector(".zh-suggestion, .zh-custom-link")?.focus({preventScroll:true});}),submit);
      form.append(url,name,actions);
      form.addEventListener("submit",e=>{
        e.preventDefault();if(!open||!editing||!adding)return;
        const message=addPin(url.value,name.value);
        if(message){error.textContent=message;return;}
        // Return to recommendations after a successful manual addition.
        pinCustom=false;render();content.querySelector(".zh-suggestion, .zh-custom-link")?.focus({preventScroll:true});
      });
      picker.append(form,error);parent.append(picker);return;
    }
    const grid=html("div","zh-recommendations"),suggestions=collectRecommendations(load());
    grid.setAttribute("role","region");grid.setAttribute("aria-label","Recommended sites");grid.tabIndex=0;
    picker.append(html("p","zh-picker-note","Choose a bookmark or open tab to pin it instantly."),grid,error);
    if(!suggestions.length)grid.append(html("div","zh-empty","No more recommended sites."));
    for(const [index,item] of suggestions.entries()){
      const row=button("zh-suggestion","",()=>{
        if(!open||!editing||!adding)return;
        const message=addPin(item.url,item.title);
        if(message){error.textContent=message;return;}
        // The preference observer replaces the old grid synchronously.
        // Restore focus near the removed item, not at the beginning.
        const rows=content.querySelectorAll(".zh-suggestion");
        (rows[Math.min(index,rows.length-1)]||content.querySelector(".zh-custom-link"))?.focus({preventScroll:true});
      });
      row.title=item.url;row.setAttribute("aria-label","Pin "+item.title);
      const img=html("img");img.alt="";img.draggable=false;setHomeIcon(img,item.url,23);
      const copy=html("span","zh-suggestion-copy"),domain=new win.URL(item.url).hostname;
      copy.append(html("span","",item.title),html("small","",domain+" · "+item.source));
      row.append(img,copy,html("span","zh-suggestion-plus","+"));grid.append(row);
    }
    const actions=html("div","zh-picker-actions");
    actions.append(button("zh-small zh-custom-link","Add a custom URL",()=>{pinCustom=true;render();content.querySelector(".zh-form input")?.focus({preventScroll:true});}));
    picker.append(actions);parent.append(picker);
  }
  // Shared Home's workspace controls are keyed by native identity. A switch
  // changes their selection, not the stable search and pinned shortcuts.
  function refreshWorkspaceSelection(){
    if(!open||dead)return;
    const manager=win.gZenWorkspaces;
    const buttons=Array.from(content.querySelectorAll(".zh-space[data-zh-workspace-id]"));
    let spaces=[];try{spaces=(manager?.getWorkspaces?.()||[]).filter(ws=>ws?.uuid);}catch{return;}
    if(buttons.length!==spaces.length||buttons.some((b,i)=>b.getAttribute("data-zh-workspace-id")!==spaces[i].uuid||b.getAttribute("data-zh-workspace-name")!==String(spaces[i].name||"Workspace"))){render();return;}
    for(const b of buttons){
      if(b.getAttribute("data-zh-workspace-id")===manager.activeWorkspace)b.setAttribute("aria-current","true");
      else b.removeAttribute("aria-current");
    }
  }
  function switchHomeWorkspace(manager,id){
    const transition=win.__zenRefinedWorkspaceTransition;
    const native=()=>manager.changeWorkspaceWithID(id);
    return typeof transition?.run==="function"?transition.run(native):native();
  }
  function render(){
    if(!open||dead||searchToken)return;
    const oldGrid=content.querySelector(".zh-recommendations");
    if(adding&&oldGrid)pinScrollTop=oldGrid.scrollTop;
    const nextMode=adding?(pinCustom?"custom-url":"add-pin"):(editing?"customize":"home");
    const animateMode=nextMode!==pinViewMode;pinViewMode=nextMode;
    content.replaceChildren();
    panel.toggleAttribute("data-zh-adding",adding);
    if(adding){
      const section=html("section","zh-section");if(animateMode)section.setAttribute("data-zh-enter","");section.append(html("h3","","Add Pin"));addForm(section);content.append(section);
    }else{
    const searchButton=button("zh-search","",search),svg=doc.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("fill","none");svg.setAttribute("stroke","currentColor");svg.setAttribute("stroke-width","1.6");
    for(const [tag,attrs] of [["circle",{cx:10.5,cy:10.5,r:6.5}],["path",{d:"m16 16 4 4"}]]){const node=doc.createElementNS("http://www.w3.org/2000/svg",tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);svg.append(node);}
    searchButton.append(svg,html("span","","Search or enter address"));if(animateMode)searchButton.setAttribute("data-zh-enter","");content.append(searchButton);
    const section=html("section","zh-section"),grid=html("div","zh-pins"),items=load();section.append(html("h3","","Pinned"),grid);if(animateMode)section.setAttribute("data-zh-enter","");
    if(!items.length)grid.append(html("div","zh-empty",editing?"Add a pinned site to get started.":"Click Customize Home to add your first pinned site."));
    for(const [index,item] of items.entries()){
      const card=html("div","zh-pin"),tile=button("zh-tile","",()=>{if(!editing)navigate(item);});
      tile.title=item.title;const img=html("img");img.alt="";img.draggable=false;setHomeIcon(img,item.url,30);
      tile.append(img,html("span","",item.title));card.append(tile);
      if(editing){
        tile.disabled=true;
        const remove=button("zh-remove","×",()=>save(load().filter(x=>x.id!==item.id)));remove.setAttribute("aria-label","Remove "+item.title);card.append(remove);
        const order=html("div","zh-order");
        if(index>0){const prev=button("zh-small","←",()=>move(item.id,items[index-1].id));prev.setAttribute("aria-label","Move "+item.title+" left");order.append(prev);}
        if(index<items.length-1){const next=button("zh-small","→",()=>move(item.id,items[index+1].id));next.setAttribute("aria-label","Move "+item.title+" right");order.append(next);}
        card.append(order);card.draggable=true;
        card.addEventListener("dragstart",e=>{dragId=item.id;e.dataTransfer.setData("application/x-zen-home-shortcut",item.id);e.dataTransfer.effectAllowed="move";e.stopPropagation();});
        card.addEventListener("dragover",e=>{if(!dragId)return;e.preventDefault();e.stopPropagation();card.setAttribute("data-drop","");});
        card.addEventListener("dragleave",()=>card.removeAttribute("data-drop"));
        card.addEventListener("dragend",e=>{dragId=null;card.removeAttribute("data-drop");e.stopPropagation();});
        card.addEventListener("drop",e=>{if(!dragId)return;e.preventDefault();e.stopPropagation();const id=dragId;dragId=null;move(id,item.id);});
      }
      grid.append(card);
    }
    if(editing){
      const editbar=html("div","zh-editbar");editbar.append(button("zh-small zh-add-pin","+ Add Pin",()=>{adding=true;pinScrollTop=0;pinCustom=false;render();content.querySelector(".zh-suggestion, .zh-custom-link")?.focus({preventScroll:true});}));section.append(editbar);
    }
    content.append(section);
    }
    const manager=win.gZenWorkspaces;
    if(manager?.workspaceEnabled&&typeof manager.getWorkspaces==="function"){
      const spaces=html("section","zh-section"),list=html("div","zh-spaces");spaces.append(html("h3","","Workspaces"),list);
      let workspaces=[];try{workspaces=manager.getWorkspaces()||[];}catch{}
      for(const ws of workspaces){
        if(!ws?.uuid)continue;
        const b=button("zh-space","",async()=>{
          if(switching||manager.activeWorkspace===ws.uuid)return;switching=true;
          try{await switchHomeWorkspace(manager,ws.uuid);}catch(error){win.console.warn("[Zen Home] workspace",error);}
          finally{switching=false;if(open)refreshWorkspaceSelection();}
        });
        b.setAttribute("data-zh-workspace-id",ws.uuid);b.setAttribute("data-zh-workspace-name",String(ws.name||"Workspace"));
        b.append(html("span","","◦"),html("span","",String(ws.name||"Workspace")));
        if(manager.activeWorkspace===ws.uuid)b.setAttribute("aria-current","true");list.append(b);
      }
      if(list.childElementCount)content.append(spaces);
    }
    const footer=html("div","zh-footer");footer.append(button("zh-small",editing?"Done":"Customize Home",()=>{if(adding){leavePinPicker();return;}editing=!editing;render();}));content.append(footer);
    const grid=content.querySelector(".zh-recommendations");
    if(grid)pinScrollTop=restorePinScroll(grid,pinScrollTop);
  }
  function show(startup=false){
    if(open||!allowed())return open;focusHome=doc.activeElement;startupHome=startup;homeOnPlaceholder=isHomePlaceholder(browser.selectedTab);
    try{
      // End an existing native startup search through its token-aware handler.
      const bar=win.gURLBar;
      if(startup&&bar?.hasAttribute("zen-newtab"))bar._zenHandleUrlbarClose?.();
      bar?.view?.close();bar?.blur();
      oldInert=panels.hasAttribute("inert");covered=true;host.setAttribute("data-zr-home-host","");panels.setAttribute("data-zr-home-covered","");panels.setAttribute("inert","");
      panel.hidden=false;open=true;render();notify();
      if(!win.matchMedia("(prefers-reduced-motion: reduce)").matches&&typeof content.animate==="function"){
        motion=content.animate([{opacity:0,transform:"translateY(9px)"},{opacity:1,transform:"translateY(0)"}],{duration:300,easing:"cubic-bezier(.2,.75,.25,1)"});
        const a=motion;a.finished.then(()=>{if(motion===a)motion=null;},()=>{});
      }
      content.querySelector(".zh-search")?.focus({preventScroll:true});return true;
    }catch(error){close();restore();win.console.warn("[Zen Home] open",error);return false;}
  }
  function destroy(){
    if(dead)return;close();dead=true;for(const fn of cleanups.splice(0))try{fn();}catch{}
    panel.remove();style.remove();if(win[KEY]===registry)delete win[KEY];
  }
  const registry={apiVersion:1,acquire(){
    if(dead)return null;const lease={listeners:new Set()};leases.add(lease);let released=false;
    return {get open(){return !released&&open;},show:()=>!released&&show(),close:(focus=false)=>{if(!released)leaveHome(focus);},
      showOnStartup(){
        if(released||win[STARTUP])return false;
        if(show(true)){win[STARTUP]=true;return true;}return false;
      },
      // Legacy lease name remains compatible, but no longer hides Home.
      toggle:()=>!released&&show(),
      subscribe(fn){if(released)return()=>{};lease.listeners.add(fn);fn(open);return()=>lease.listeners.delete(fn);},
      release(){if(released)return;released=true;lease.listeners.clear();leases.delete(lease);if(!leases.size)destroy();}};
  }};
  try{
    root.append(style);host.append(panel);
    const observer={observe(){if(open)render();}};prefs.addObserver(PREF,observer);cleanups.push(()=>prefs.removeObserver(PREF,observer));
    listen(browser.tabContainer,"TabSelect",onSelectedTab);
    // A selected, intentionally blank ordinary tab may finish loading
    // after TabSelect. Recheck only the selected tab, never background opens.
    listen(browser.tabContainer,"TabAttrModified",e=>{
      if(!open&&e.target===browser.selectedTab&&e.detail?.changed?.some?.(name=>name==="busy"||name==="pending"||name==="discarded"||name==="zen-empty-tab"))ensurePrimaryHome();
    });
    listen(win,"ZenWorkspaceDataChanged",()=>{if(open&&!switching)render();});
    listen(win,"ZenWorkspacesUIUpdate",()=>{if(open&&!switching)refreshWorkspaceSelection();});
    listen(win,"ZenURLBarClosed",onSearchClosed);
    listen(win,"resize",()=>{
      if(!searchToken||!searchBar)return;
      if(searchClosing||searchReturn){finishNativeCancel();finishSearchVisual();return;}
      panel.setAttribute("data-zh-search-ready","");finishSearchMotion();
      const from=content.querySelector(".zh-search")?.getBoundingClientRect();
      searchGeometry=homeSearchGeometry(from,win.innerWidth,win.innerHeight);
      applySearchGeometry(searchBar,searchGeometry);scheduleSearchSnapshot();
    });
    if(win.gURLBar){
      // Remember the latest painted height for native blur/popover teardown.
      if(typeof win.ResizeObserver==="function"){
        const sizes=new win.ResizeObserver(()=>{
          if(searchToken&&!searchClosing&&!searchReturn&&snapshotReady(searchBar)){
            const rect=searchBar.getBoundingClientRect();
            if(rect.height>0){searchLastHeight=rect.height;searchLastRect=rect;}
          }
        });sizes.observe(win.gURLBar);cleanups.push(()=>sizes.disconnect());
      }
      const searchObserver=new win.MutationObserver(observeSearch);
      searchObserver.observe(win.gURLBar,{attributes:true,attributeFilter:["open","zen-newtab","focused","zen-floating-urlbar","popover-open"]});
      cleanups.push(()=>searchObserver.disconnect());
    }
    // Explicit native navigation still leaves Home. Background restore does not.
    listen(win,"command",e=>{
      if(!open)return;
      if(e.target?.closest?.("#PlacesToolbarItems .bookmark-item:not([container]),#OtherBookmarks .bookmark-item:not([container]),#back-button,#forward-button,#reload-button,#stop-reload-button"))leaveHome();
    },true);
    listen(win,"keydown",e=>{
      if(open&&e.key==="Escape"&&searchReturn){e.preventDefault();e.stopImmediatePropagation();return;}
      if(open&&e.key==="Escape"&&searchToken&&!searchReturn){
        // Do not swallow Escape belonging to an autocomplete sub-popup or
        // search mode picker; ordinary Home search cancellation folds first.
        if(!e.defaultPrevented&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&
           !searchBar?.searchMode&&!searchBar?.hasAttribute("has-popup-open")&&
           (searchClosing||cancelHomeSearch("escape"))){e.preventDefault();e.stopImmediatePropagation();return;}
      }
      if(open&&e.key==="Escape"&&!searchActive()){e.preventDefault();e.stopPropagation();if(adding&&pinCustom){pinCustom=false;render();content.querySelector(".zh-suggestion, .zh-custom-link")?.focus({preventScroll:true});}else if(adding){leavePinPicker();}else if(editing){editing=false;render();}else content.querySelector(".zh-search")?.focus({preventScroll:true});}},true);
    listen(win,"pointerdown",e=>{
      if(searchToken&&!searchClosing&&!searchReturn&&searchBar&&!searchBar.contains?.(e.target))captureSearchSnapshot();
    },true);
    listen(win,"focusout",e=>{
      if(searchToken&&!searchClosing&&!searchReturn&&searchBar?.contains?.(e.target))captureSearchSnapshot();
    },true);
    listen(panel,"pointerdown",e=>{if(e.target===panel&&searchToken&&!searchClosing&&cancelHomeSearch("home-background")){e.preventDefault();e.stopPropagation();}},true);
    const stateObserver=new win.MutationObserver(()=>{if(open&&!allowed())close();else if(!open)ensurePrimaryHome();});
    stateObserver.observe(root,{attributes:true,attributeFilter:["customizing","inDOMFullscreen","inFullscreen","popup-window","data-op-startup-ready"]});cleanups.push(()=>stateObserver.disconnect());
    listen(win,"unload",destroy,{once:true});
    const progress={onLocationChange(b,wp,uri){
      if(switching||b!==browser.selectedBrowser||!wp?.isTopLevel)return;
      if(isHomePlaceholder(browser.selectedTab,uri)){
        if(open)homeOnPlaceholder=true;else ensurePrimaryHome();
        return;
      }
      if(open&&(!startupHome||homeOnPlaceholder)&&!searchActive())leaveHome();
    },onStateChange(b,wp,request,flags){
      // nsIWebProgressListener STATE_STOP | STATE_IS_NETWORK.
      // The committed WindowGlobal can arrive after onLocationChange.
      if(!open&&!switching&&b===browser.selectedBrowser&&wp?.isTopLevel&&
         (flags&0x00000010)&&(flags&0x00040000))ensurePrimaryHome();
    }};
    if(typeof browser.addTabsProgressListener==="function"){browser.addTabsProgressListener(progress);cleanups.push(()=>browser.removeTabsProgressListener(progress));}
    win[KEY]=registry;const lease=registry.acquire();ensurePrimaryHome();return lease;
  }catch(error){destroy();win.console.warn("[Zen Home] init",error);return null;}
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
  const compactSearch=html("button","oneplane-compact-search");
  compactSearch.id="oneplane-compact-search";compactSearch.type="button";compactSearch.title="Search or enter address";
  compactSearch.setAttribute("aria-label","Search or enter address");
  const searchGlyph=document.createElementNS("http://www.w3.org/2000/svg","svg");searchGlyph.setAttribute("viewBox","0 0 24 24");searchGlyph.setAttribute("aria-hidden","true");
  const searchPath=document.createElementNS(searchGlyph.namespaceURI,"path");searchPath.setAttribute("d","M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z");searchGlyph.append(searchPath);compactSearch.append(searchGlyph);
  compactSearch.addEventListener("click",()=>{window.gURLBar?.focus();window.gURLBar?.select();});
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
  const bottomLane = html("div","oneplane-island-lane oneplane-overflow-lane");
  bottomLane.hidden=true;
  bottomLane.setAttribute("role","group");bottomLane.setAttribute("aria-label","Overflow tabs");
  bottomLane.id="oneplane-overflow-tabs";
  const overflowSlider=html("input","oneplane-overflow-slider");
  overflowSlider.type="range";overflowSlider.min="0";overflowSlider.max="1000";overflowSlider.step="1";overflowSlider.value="0";overflowSlider.hidden=true;
  overflowSlider.setAttribute("aria-label","Scroll overflow tabs");overflowSlider.setAttribute("aria-controls",bottomLane.id);
  const island = html("button","oneplane-title-island");
  island.type="button";island.disabled=true;island.setAttribute("aria-label","Toggle Home");island.setAttribute("aria-expanded","false");
  const homeGlyph=document.createElementNS("http://www.w3.org/2000/svg","svg");
  homeGlyph.setAttribute("viewBox","0 0 24 24");homeGlyph.setAttribute("aria-hidden","true");
  const homePath=document.createElementNS("http://www.w3.org/2000/svg","path");homePath.setAttribute("d","m3 10 9-7 9 7v10h-6v-7H9v7H3z");homeGlyph.append(homePath);island.append(homeGlyph);
  const islandTitle = html("span","oneplane-island-title");
  island.append(islandTitle);
  row.append(list, plus, indicator, island, overflowSlider);
  let stripOrderSnapshot=[];
  function stripNodes() {
    // The painted row order is not the native order once overflow is active.
    return stripOrderSnapshot.filter(node=>list.contains(node));
  }
  function isStripNode(node) {
    return Boolean(node && (node.parentElement === list ||
      node.parentElement === leftLane || node.parentElement === rightLane || node.parentElement===bottomLane));
  }
  function compactSlotWidth(node, tabWidth) {
    return node.classList.contains("oneplane-split-group") ?
      22 + node.querySelectorAll(".oneplane-tab").length*(tabWidth+3) : tabWidth;
  }
  function laneNodes(lane){
    return Array.from(lane.children).filter(isStripNode);
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
  // Pure collapsed-slot allocation for the second-row controller.
  // Each slot represents one tab or one entire Split View group.
  function planTabOverflow(widths,boundary,leftCapacity,rightCapacity,gap=3){
    if(!Array.isArray(widths)||widths.some(w=>!Number.isFinite(w)||w<=0)||
       !Number.isInteger(boundary)||boundary<0||boundary>widths.length||
       ![leftCapacity,rightCapacity,gap].every(v=>Number.isFinite(v)&&v>=0))
      throw new TypeError("Invalid collapsed slot geometry");
    let leftStart=boundary,leftUsed=0;
    while(leftStart>0){
      const next=widths[leftStart-1]+(leftStart===boundary?0:gap);
      if(leftUsed+next>leftCapacity)break;
      leftStart--;leftUsed+=next;
    }
    let rightEnd=boundary,rightUsed=0;
    while(rightEnd<widths.length){
      const next=widths[rightEnd]+(rightEnd===boundary?0:gap);
      if(rightUsed+next>rightCapacity)break;
      rightUsed+=next;rightEnd++;
    }
    const indices=(a,b)=>Array.from({length:b-a},(_,i)=>a+i);
    const lowerLeft=indices(0,leftStart),lowerRight=indices(rightEnd,widths.length);
    return {topLeft:indices(leftStart,boundary),topRight:indices(boundary,rightEnd),
      lowerLeft,lowerRight,lower:[...lowerLeft,...lowerRight],
      hasSecondRow:lowerLeft.length+lowerRight.length>0,leftUsed,rightUsed};
  }

  // A fixed center has two independently budgeted sides. Compact mode
  // keeps at most two ordinary slots on either side; groups are atomic.
  function planAdaptiveTabRows(widths,groups,boundary,available,title,tab,gap=3,returnReserve=0){
    const lane=(sideTitle)=>Math.max(0,(available-sideTitle-2*gap)/2-2*gap);
    const wideCap=Math.max(0,lane(title)-returnReserve/2),rightCap=Math.max(0,wideCap-tab-gap);
    const full=planTabOverflow(widths,boundary,wideCap,rightCap,gap);
    if(!full.hasSecondRow&&available>=title+2*gap+2*(tab+gap)+returnReserve){
      return {...full,mode:"wide",title,topPlus:true};
    }
    const minTitle=32;
    const compactTitle=available>=title+2*gap?title:minTitle;
    const compactLane=sideTitle=>Math.max(0,(available-sideTitle-2*gap)/2-2);
    const pick=(cap,start,end,step)=>{
      const picked=[];let used=0;
      for(let i=start;i!==end&&picked.length<2;i+=step){
        if(groups[i])continue;
        const extent=widths[i]+(picked.length?gap:0);
        if(used+extent>cap)continue;
        picked.push(i);used+=extent;
      }
      if(step<0)picked.reverse();
      return {picked,used};
    };
    const slots=sideTitle=>{
      const cap=compactLane(sideTitle);
      return {left:pick(cap,boundary-1,-1,-1),right:pick(cap,boundary,widths.length,1)};
    };
    const titled=slots(compactTitle),icon=slots(minTitle);
    // Keep the full title unless the icon can reveal another actual tab.
    const count=s=>s.left.picked.length+s.right.picked.length;
    const chosenTitle=count(icon)>count(titled)||available<compactTitle+2*gap?minTitle:compactTitle;
    const compactCap=compactLane(chosenTitle);
    const chosen=chosenTitle===minTitle?icon:titled;
    const left=chosen.left.picked,right=chosen.right.picked;
    const kept=new Set([...left,...right]);
    const lower=widths.map((_,i)=>i).filter(i=>!kept.has(i));
    const singleCap=lane(chosenTitle);
    const topPlus=lower.length===0&&chosen.left.used<=singleCap&&
      chosen.right.used+tab+gap<=singleCap&&available>=chosenTitle+2*gap+2*(tab+gap+2*gap);
    return {mode:chosenTitle===minTitle&&compactCap<tab?"ultra":"compact",title:chosenTitle,
      topLeft:left,topRight:right,lower,hasSecondRow:lower.length>0||!topPlus,topPlus};
  }
  function adaptiveAddressWidth(preferred,windowWidth,leftWithoutAddress,centerReserve,margin=8,forceCompact=false){
    const budget=Math.max(0,Math.floor(windowWidth/2-leftWithoutAddress-centerReserve-margin));
    const desired=forceCompact||budget<preferred?Math.round(preferred*.7):preferred;
    return Math.max(36,Math.min(desired,budget));
  }

  function visibleLaneDropIndex(slots,left,right,x){
    const visible=slots.map((s,index)=>({index,left:Math.max(left,s.left),right:Math.min(right,s.right)}))
      .filter(s=>s.right>s.left);
    if(!visible.length)return null;
    for(const s of visible)if(x<(s.left+s.right)/2)return {index:s.index,before:true};
    return {index:visible.at(-1).index,before:false};
  }
  function laneScrollVelocity(x,left,right,edge=32){
    if(!(edge>0))return 0;
    const l=Math.max(0,Math.min(1,(left+edge-x)/edge));
    const r=Math.max(0,Math.min(1,(x-(right-edge))/edge));
    return Math.round((r*r-l*l)*18);
  }

  function centeredRowCorrection(windowWidth,left,right,rowCenter,rowWidth){
    const min=left+rowWidth/2,max=windowWidth-right-rowWidth/2;
    // If the edges overlap there is no exact safe midpoint; stay as close
    // as possible to the real available center rather than crossing controls.
    const target=min<=max?Math.max(min,Math.min(max,windowWidth/2)):(min+max)/2;
    return Math.round(target-rowCenter);
  }

  function overflowScrollMetrics(viewport,content,offset){
    const max=Math.max(0,content-viewport),visible=viewport>0&&max>1;
    const position=visible?Math.max(0,Math.min(1,offset/max)):0;
    return {visible,max,position,value:Math.round(position*1000),
      thumb:visible?Math.min(viewport,Math.max(20,viewport*viewport/content)):0};
  }

  // Direct dragging bypasses this short, interruptible ease-out.
  function overflowScrollEase(start,target,elapsed,duration=145){
    const t=duration>0?Math.max(0,Math.min(1,elapsed/duration)):1;
    return t===1?target:start+(target-start)*(1-(1-t)**3);
  }

  // Spend only the surplus around a centered strip. The compact width
  // is a starting point, not a hard cap. Keep the configured preference
  // as the ceiling and preserve title, native slots, plus and row count.
  function reclaimAddressWidth(preferred,baseline,planAtWidth,safety=4){
    const low=Math.round(baseline),limit=Math.max(low,Math.floor(preferred));
    if(limit<=low)return low;
    const reference=planAtWidth(low);
    const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
    const preserves=p=>p.mode===reference.mode&&p.title===reference.title&&
      p.topPlus===reference.topPlus&&p.hasSecondRow===reference.hasSecondRow&&
      same(p.topLeft,reference.topLeft)&&same(p.topRight,reference.topRight);
    const fits=w=>preserves(planAtWidth(w))&&preserves(planAtWidth(w+Math.max(0,safety)));
    // A conservative bounded search: extra room is optional. Never
    // return a width unless its actual and padded plans both fit.
    let l=low,h=limit;
    while(l<h){
      const mid=Math.ceil((l+h)/2);
      if(fits(mid))l=mid;else h=mid-1;
    }
    return l;
  }
  let adaptiveHeightDirty=false,overflowRevealAnimation=null;
  function mountLaneNodes(lane,nodes){
    for(let i=0;i<nodes.length;i++){
      const node=nodes[i],before=lane.children[i]||null;
      if(before===node)continue;
      if(node.isConnected&&typeof lane.moveBefore==="function"){
        try{lane.moveBefore(node,before);continue;}catch{}
      }
      lane.insertBefore(node,before);
    }
  }
  function applyStripPartition(plan){
    if(leftLane.parentElement!==list)list.append(leftLane,rightLane,bottomLane);
    const active=document.activeElement;
    const selected=entries.get(browser.selectedTab)?.item,previousLane=selected?.closest(".oneplane-island-lane");
    mountLaneNodes(leftLane,plan.topLeft.map(i=>stripOrderSnapshot[i]));
    mountLaneNodes(rightLane,plan.topRight.map(i=>stripOrderSnapshot[i]));
    mountLaneNodes(bottomLane,plan.lower.map(i=>stripOrderSnapshot[i]));
    const changed=row.hasAttribute("data-op-overflow-row")!==plan.hasSecondRow;
    row.toggleAttribute("data-op-overflow-row",plan.hasSecondRow);
    row.toggleAttribute("data-op-adaptive-compact",plan.mode!=="wide");
    row.toggleAttribute("data-op-bottom-plus",!plan.topPlus);
    bottomLane.hidden=!plan.hasSecondRow;
    if(changed){
      overflowRevealAnimation?.cancel();overflowRevealAnimation=null;
      if(plan.hasSecondRow&&row.hasAttribute("data-ready")&&cascadeState==="idle"&&!reducedMotion.matches&&prefs.getIntPref("zen.oneplane.animation-duration",160)!==0){
        try{overflowRevealAnimation=bottomLane.animate([{opacity:0},{opacity:1}],{duration:160,easing:"ease-out"});}catch{}
      }
      adaptiveHeightDirty=true;contourKey=null;
      // Real layout height changes once. Never repartition on hover.
      scheduleGeometry();scheduleContour();
    }
    if(active&&list.contains(active)&&document.activeElement!==active)active.focus?.({preventScroll:true});
    if(selected&&previousLane!==selected.closest(".oneplane-island-lane")&&!row.hasAttribute("data-op-home-open"))window.requestAnimationFrame(revealSelectedInStrip);
  }
  function placeStripOrder(order) {
    if(row.hasAttribute("data-op-dragging"))return;
    stripOrderSnapshot=order.slice();
    const useLanes=row.hasAttribute("data-op-show-island");
    if(useLanes){
      if(leftLane.parentElement!==list)list.append(leftLane,rightLane,bottomLane);
      if(row.hasAttribute("data-ready")&&hoverSupported()){
        centerToolbar();
      }else{
        const tabWidth=parseFloat(window.getComputedStyle(row).getPropertyValue("--op-tab"))||36;
        const boundary=islandBoundary(order.map(n=>compactSlotWidth(n,tabWidth)),tabWidth+3);
        applyStripPartition({topLeft:order.slice(0,boundary).map((_,i)=>i),
          topRight:order.slice(boundary).map((_,i)=>i+boundary),lower:[],hasSecondRow:false,mode:"wide",topPlus:true});
      }
    }else{
      mountLaneNodes(list,order);
      leftLane.remove();rightLane.remove();bottomLane.remove();bottomLane.hidden=true;
      if(row.hasAttribute("data-op-overflow-row")){adaptiveHeightDirty=true;contourKey=null;scheduleGeometry();}
      for(const attr of ["data-op-overflow-row","data-op-adaptive-compact","data-op-bottom-plus"])row.removeAttribute(attr);
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
    if(window.innerWidth<=700){if(actions.isConnected||actionHomes.size)restorePageActions();return;}
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
      if(row.hasAttribute("data-op-home-open"))document.getElementById("zen-shared-home")?.querySelector(".zh-search")?.focus({preventScroll:true});
      else browser.selectedBrowser?.focus();
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
    const bar = addressBar();
    const anchor = url.getBoundingClientRect();
    const compact = (url.hasAttribute("data-op-empty") || url.hasAttribute("data-op-home")) ? 0 : (anchor.width || addressCompactWidth || base);
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
    const expanded = Math.max(1, Math.min(window.innerWidth-12, right - Math.max(0, left) - 6));
    url.style.setProperty("--op-url-expanded-width", expanded.toFixed(2) + "px");
    url.style.setProperty("--op-url-compact-width", Math.max(1, compact).toFixed(2) + "px");
    return { compact, expanded };
  }
  function rememberCompactAddress() {
    const bar = addressBar();
    if (!bar || inlinePopoverPresent(bar) ||
        bar.hasAttribute("zen-floating-urlbar") || url.hasAttribute("data-op-empty") || url.hasAttribute("data-op-home")) return;
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
    if(!dead){refreshIndicator();scheduleGeometry();scheduleContour();}
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
    return {x:left+Math.floor((width-w)/2),y:top+Math.floor((height-ht)/2),width:w,height:ht,mode:"center"};
  }
  function hubTrashAgeMatches(stamp,age,now){
    if(age==="all")return true;
    const duration={"5m":300000,"1h":3600000,"1d":86400000,"7d":604800000,"30d":2592000000,"1y":31536000000}[age];
    return Number.isFinite(duration)&&Number.isFinite(stamp)&&stamp>0&&Number.isFinite(now)&&now-stamp>=duration;
  }
  function hubWorkspaceOrder(spaces,free,trash){
    return Array.isArray(spaces)?spaces.filter(s=>s.id!==trash).sort((a,b)=>Number(b.id===free)-Number(a.id===free)):null;
  }
  function hubTrashTabEligible(tab){
    return !!tab&&!tab.closing&&!tab.group&&!tab.hasAttribute("zen-essential")&&!tab.hasAttribute("zen-empty-tab")&&
      !tab.hasAttribute("split-view")&&!tab.hasAttribute("glance-id")&&!tab.hasAttribute("zen-glance-tab")&&
      !tab.querySelector?.(".tabbrowser-tab[glance-id],.tabbrowser-tab[zen-glance-tab]");
  }
  function hubTrashRange(count,scroll,height,row=54,overscan=3){
    const n=Math.max(0,Math.floor(count)||0),size=Math.max(1,row||54);
    const first=Math.min(n,Math.max(0,Math.floor(Math.max(0,scroll||0)/size)-overscan));
    const end=Math.min(n,Math.max(first,Math.ceil((Math.max(0,scroll||0)+Math.max(0,height||0))/size)+overscan));
    return {first,end,top:first*size,bottom:(n-end)*size};
  }
  function hubTrashRelativeAge(stamp,now){
    if(!Number.isFinite(stamp)||stamp<=0)return "Unknown";
    const m=Math.max(0,Math.floor((now-stamp)/60000));
    return m<1?"Just now":m<60?m+" min":m<1440?Math.floor(m/60)+" h":m<525600?Math.floor(m/1440)+" d":Math.floor(m/525600)+" y";
  }
  function hubTrashAgeOptions(){
    return [["all","All tabs","All tabs"],["5m","5 min+","Older than 5 minutes"],["1h","1 hour+","Older than 1 hour"],["1d","1 day+","Older than 1 day"],["7d","7 days+","Older than 7 days"],["30d","30 days+","Older than 30 days"],["1y","1 year+","Older than 1 year"]];
  }
  function hubTrashFlightGeometry(rect,release,dest,panel){
    if(!rect||!release||!dest||!panel||![rect.width,rect.height,release.x,release.y,dest.left,dest.top,dest.width,dest.height,panel.left,panel.top,panel.right,panel.bottom].every(Number.isFinite)||rect.width<=0||rect.height<=0)return null;
    if(release.x<panel.left||release.x>panel.right||release.y<panel.top||release.y>panel.bottom)return null;
    const x=Math.max(panel.left,Math.min(panel.right-rect.width,release.x-Math.min(20,rect.width/2)));
    const y=Math.max(panel.top,Math.min(panel.bottom-rect.height,release.y-rect.height/2));
    return {x,y,dx:dest.left+dest.width/2-x-rect.width/2,dy:dest.top+dest.height/2-y-rect.height/2};
  }
  // One owner/token per window, invalidated before callbacks run. A late
  // pointerup, dragend or timeout cannot complete a cancelled/new gesture.
  function createDragLifecycle(){
    let active=null,sequence=0;
    return {
      current:()=>active,
      begin(kind,handlers={}){
        if(active) return null;
        const token=++sequence;
        active={...handlers,kind,token};return token;
      },
      owns(token,kind){return !!active&&active.token===token&&(!kind||active.kind===kind);},
      finish(token){
        if(!active||active.token!==token)return false;
        active=null;return true;
      },
      cancel(reason,token=active?.token){
        if(!active||active.token!==token)return false;
        const previous=active;active=null;previous.onCancel?.(reason);return true;
      }
    };
  }
  function dragPointerSignal(event,pointerId){
    if(event.pointerId!==pointerId)return "ignore";
    if(event.type==="pointercancel"||event.type==="lostpointercapture")return "cancel";
    if(event.type==="pointerup")return event.button===0?"drop":"cancel";
    if(event.type==="pointermove"&&!(event.buttons&1))return "cancel";
    return event.type==="pointermove"?"move":"ignore";
  }
  function dragInterruptionKey(event){
    return event.key==="Escape"||event.key==="PrintScreen"||
      Boolean((event.metaKey||event.osKey)&&event.shiftKey&&String(event.key).toLowerCase()==="s");
  }
  function dragEndMatches(identity,event,tab){
    return !!identity&&identity.target===event?.target&&identity.tab===tab;
  }
  // Drag Engine: lifecycle only. Geometry/rendering and native tab
  // operations remain separate. No polling while idle.
  const dragLifecycle=createDragLifecycle();
  let nativeDragToken=null,nativeDragIdentity=null,dragWatchTimer=0,dragMissingSessions=0,dragFallbackTimer=0;
  const dragService=()=>Cc["@mozilla.org/widget/dragservice;1"].getService(Ci.nsIDragService);
  function stopNativeDragWatch(){
    if(dragWatchTimer)window.clearTimeout(dragWatchTimer);
    dragWatchTimer=0;dragMissingSessions=0;
    if(dragFallbackTimer)window.clearTimeout(dragFallbackTimer);dragFallbackTimer=0;
  }
  function watchNativeDrag(token){
    stopNativeDragWatch();
    const check=()=>{
      dragWatchTimer=0;
      if(!dragLifecycle.owns(token,"tab"))return;
      // A parent-process native session spans browser windows. A short
      // grace period avoids transient gaps at native drag startup/teardown.
      try{
        const service=dragService();
        if(typeof service.getCurrentSession==="function"){
          if(service.getCurrentSession(window))dragMissingSessions=0;
          else if(++dragMissingSessions>=3){dragLifecycle.cancel("native-session-ended",token);return;}
        }
      }catch{dragMissingSessions=0;}
      if(dragLifecycle.owns(token,"tab"))dragWatchTimer=window.setTimeout(check,250);
    };
    dragWatchTimer=window.setTimeout(check,250);
  }
  function cancelNativeDrag(reason){
    nativeDragToken=null;nativeDragIdentity=null;stopNativeDragWatch();
    dragHandled=true;dragStartPoint=null;draggedTab=null;draggedGroup=null;
    // Do not reopen the start-page search after an interrupted OS gesture.
    dragSearch=null;pointerSearch=null;
    if(restoreSearchTimer)window.clearTimeout(restoreSearchTimer);restoreSearchTimer=0;
    try{endDragVisual();}finally{
      // Remove the source's temporary shifts in other participating windows.
      try{
        const wins=Services.wm.getEnumerator("navigator:browser");
        while(wins.hasMoreElements()){
          const win=wins.getNext();
          if(win!==window&&!win.closed)win[DRAG_CONTROLLER]?.clearIncoming?.();
        }
      }catch{}
    }
  }
  function startNativeDragLifecycle(event,tab){
    if(dragLifecycle.current())dragLifecycle.cancel("superseded");
    nativeDragToken=dragLifecycle.begin("tab",{onCancel:cancelNativeDrag});
    if(nativeDragToken!==null){nativeDragIdentity={target:event.target,tab};watchNativeDrag(nativeDragToken);}
    return nativeDragToken!==null;
  }
  function finishNativeDragLifecycle(event=null,tab=null){
    if(event&&!dragEndMatches(nativeDragIdentity,event,tab))return false;
    const token=nativeDragToken;nativeDragToken=null;nativeDragIdentity=null;stopNativeDragWatch();
    return token!==null&&dragLifecycle.finish(token);
  }
  function cancelActiveDrag(reason){return dragLifecycle.cancel(reason);}
  function installDragEngine(){
    const capture=true,handlers=[];
    const listen=(node,type,fn)=>{node.addEventListener(type,fn,capture);handlers.push([node,type,fn]);};
    function pointer(event){
      const current=dragLifecycle.current();
      if(!current||!["workspace","trash"].includes(current.kind)||!event.isTrusted)return;
      const signal=dragPointerSignal(event,current.pointerId);
      if(signal==="cancel")dragLifecycle.cancel(event.type,current.token);
      else if(signal==="move")current.onMove?.(event);
      else if(signal==="drop")current.onUp?.(event);
    }
    function freshPointer(event){
      if(event.isTrusted&&dragLifecycle.current())cancelActiveDrag("new-pointerdown");
    }
    function mouseFallback(event){
      if(!event.isTrusted)return;
      const current=dragLifecycle.current();
      if(["workspace","trash"].includes(current?.kind)&&(event.type==="mouseup"||!(event.buttons&1)))
        dragLifecycle.cancel("mouse-release-without-pointerup",current.token);
      // Native HTML DnD owns its own button state: drag events often report
      // buttons=0. Never infer a tab drop from mousemove.
    }
    function keyboard(event){
      if(!event.isTrusted||!dragLifecycle.current()||!dragInterruptionKey(event))return;
      const kind=dragLifecycle.current().kind;
      cancelActiveDrag("keyboard-interruption");
      if(event.key==="Escape"&&["workspace","trash"].includes(kind)){event.preventDefault();event.stopImmediatePropagation();}
      // Let Gecko/OS receive Escape for a native tab drag and screenshot keys.
    }
    function focusLost(event){
      // Descendant focus transitions must not cancel an active gesture.
      if(event.type==="blur"&&event.target!==window&&event.target!==document)return;
      // Native DnD can move across windows without ending its OS session.
      // Cancel the workspace pointer gesture immediately; for tab drag,
      // hide the transient chrome and let its session watchdog/dragend own
      // completion. Explicit OS interruption keys cancel both.
      if(["workspace","trash"].includes(dragLifecycle.current()?.kind))cancelActiveDrag("focus-lost");
      else if(dragLifecycle.current()?.kind==="tab"){
        clearPlacementPreview(true);
        // Deactivation can also be an ordinary native cross-window drag.
        // Do not commit/abort solely on focus change while the OS owns it.
      }
    }
    function hidden(){if(document.hidden)cancelActiveDrag("document-hidden");}
    function nativeEnd(event){
      const current=dragLifecycle.current();
      if(current?.kind!=="tab"||!event.isTrusted)return;
      if(event.type==="dragend"&&event.target!==nativeDragIdentity?.target)return;
      // The source node's own dragend/drop listeners must run first.
      // A fallback timeout is token-scoped if they never run.
      if(dragFallbackTimer)window.clearTimeout(dragFallbackTimer);
      dragFallbackTimer=window.setTimeout(()=>{
        dragFallbackTimer=0;
        dragLifecycle.cancel("unhandled-native-end",current.token);
      },0);
    }
    for(const type of ["pointermove","pointerup","pointercancel","lostpointercapture"])listen(window,type,pointer);
    listen(window,"pointerdown",freshPointer);
    listen(window,"mousemove",mouseFallback);listen(window,"mouseup",mouseFallback);
    listen(window,"keydown",keyboard);
    listen(window,"blur",focusLost);listen(window,"deactivate",focusLost);
    listen(document,"visibilitychange",hidden);listen(window,"pagehide",()=>cancelActiveDrag("pagehide"));
    listen(window,"dragend",nativeEnd);listen(window,"drop",nativeEnd);
    return ()=>{
      for(const [node,type,fn] of handlers)node.removeEventListener(type,fn,capture);
      cancelActiveDrag("unload");stopNativeDragWatch();
    };
  }
  let releaseDragEngine=()=>{};
  // All geometry below is in global desktop pixels; no CSS coordinates.
  function displayContains(rect,x,y){
    return !!rect&&[rect.x,rect.y,rect.width,rect.height,x,y].every(Number.isFinite)&&
      rect.width>0&&rect.height>0&&x>=rect.x&&x<rect.x+rect.width&&y>=rect.y&&y<rect.y+rect.height;
  }
  function displayCssPoint(x,y,cssToDevice,desktopToDevice){
    if(![x,y,cssToDevice,desktopToDevice].every(Number.isFinite)||cssToDevice<=0||desktopToDevice<=0)return null;
    const scale=cssToDevice/desktopToDevice;
    return {x:Math.round(x*scale),y:Math.round(y*scale)};
  }
  function displayRectEqual(a,b){
    return !!a&&!!b&&["x","y","width","height"].every(k=>a[k]===b[k]);
  }
  function displaySnapTarget(full,work,x,y){
    if(!displayContains(full,x,y)||!displayContains(full,work?.x,work?.y)||
       !displayContains(full,work.x+work.width-1,work.y+work.height-1))return null;
    // Classify on the physical display, not the inset work area. A taskbar
    // is part of the hit surface, but never part of the target window.
    const horizontalEdge=Math.max(1,Math.round(full.width*.22)),verticalEdge=Math.max(1,Math.round(full.height*.18));
    const l=x-full.x,r=full.x+full.width-1-x,t=y-full.y,b=full.y+full.height-1-y;
    const h=l<horizontalEdge?"left":r<horizontalEdge?"right":"";
    const v=t<verticalEdge?"top":b<verticalEdge?"bottom":"";
    const {x:wx,y:wy,width:w,height:ht}=work,hw=Math.floor(w/2),hh=Math.floor(ht/2);
    let rect;
    if(h&&v)rect={x:h==="left"?wx:wx+hw,y:v==="top"?wy:wy+hh,width:h==="left"?hw:w-hw,height:v==="top"?hh:ht-hh,mode:h+"-"+v};
    else if(v==="top")rect={...work,mode:"maximize"};
    else if(h)rect={x:h==="left"?wx:wx+hw,y:wy,width:h==="left"?hw:w-hw,height:ht,mode:h};
    else if(v==="bottom")rect={x:wx,y:wy+hh,width:w,height:ht-hh,mode:"bottom"};
    else {
      const width=Math.round(w*.72),height=Math.round(ht*.74);
      rect={x:wx+Math.floor((w-width)/2),y:wy+Math.floor((ht-height)/2),width,height,mode:"center"};
    }
    return {...rect,full:{...full},work:{...work}};
  }
  function displayNativeRect(rect,desktopToDevice){
    if(!rect||![rect.x,rect.y,rect.width,rect.height,desktopToDevice].every(Number.isFinite)||
       rect.width<=0||rect.height<=0||desktopToDevice<=0)return null;
    return {x:Math.round(rect.x*desktopToDevice),y:Math.round(rect.y*desktopToDevice),
      width:Math.round(rect.width*desktopToDevice),height:Math.round(rect.height*desktopToDevice)};
  }
  function displayPreviewFraction(target){
    if(!target||!displayContains(target.full,target.x,target.y)||
       !displayContains(target.full,target.x+target.width-1,target.y+target.height-1))return null;
    const f=target.full;
    return {x:(target.x-f.x)/f.width,y:(target.y-f.y)/f.height,width:target.width/f.width,height:target.height/f.height};
  }
  function displayReleaseMatches(sample,token,x,y,now){
    return !!sample&&sample.token===token&&[x,y,now,sample.x,sample.y,sample.time].every(Number.isFinite)&&
      now>=sample.time&&now-sample.time<=400&&Math.hypot(x-sample.x,y-sample.y)<=16;
  }
  function tabReturnZone(x,y,rect,height){
    return !!rect&&[x,y,rect.left,rect.right,rect.top,height].every(Number.isFinite)&&
      x>=rect.left&&x<rect.right&&y>=Math.max(0,rect.top)&&y<Math.max(0,rect.top)+Math.max(0,height);
  }
  // Native creation uses the selected rectangle, not a uniform center seed.
  // For maximize, start at the work area and apply native maximize separately.
  function displayStartupFeatures(target,openerScale,destinationScale,openerZoom=1){
    const w=target?.work;
    if(!w||!displayContains(w,target.x,target.y)||
       !displayContains(w,target.x+target.width-1,target.y+target.height-1)||
       ![openerScale,destinationScale,openerZoom].every(n=>Number.isFinite(n)&&n>0)||
       !Number.isFinite(target.width)||!Number.isFinite(target.height)||target.width<=0||target.height<=0)return null;
    return {left:Math.round(target.x/openerScale),top:Math.round(target.y/openerScale),
      outerWidth:Math.max(1,Math.round(target.width/(destinationScale*openerZoom))),
      outerHeight:Math.max(1,Math.round(target.height/(destinationScale*openerZoom)))};
  }
  function displayPlacementMatches(target,actual,maximized=false,tolerance=8){
    if(!target?.full||!actual||![actual.x,actual.y,actual.width,actual.height,tolerance].every(Number.isFinite)||
       actual.width<=0||actual.height<=0||tolerance<0||
       !displayContains(target.full,actual.x+actual.width/2,actual.y+actual.height/2))return false;
    if(target.mode==="maximize")return maximized;
    return !maximized&&["x","y","width","height"].every(k=>Number.isFinite(target[k])&&Math.abs(actual[k]-target[k])<=tolerance);
  }
  // Display Engine: Windows first. Gecko's chrome MouseEvent.screen and
  // nsIBaseWindow expose the native monitor and desktop/device pixel scales.
  // A compact native panel is allowed on the target display; never a desktop-sized overlay.
  const DISPLAY_SNAP_PREF="zen.oneplane.experimental-display-snap";
  let placementPreview=null,placementMap=null,placementArea=null,placementLabel=null,placementKey="",placementMonitor=null,placementSample=null,placementPopupPoint=null;
  const screenManager=()=>Cc["@mozilla.org/gfx/screenmanager;1"].getService(Ci.nsIScreenManager);
  function nativeBase(win){
    const owner=win.docShell.QueryInterface(Ci.nsIDocShellTreeItem).treeOwner;
    try{return owner.QueryInterface(Ci.nsIBaseWindow);}
    catch{return owner.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIBaseWindow);}
  }
  function displaySnapEnabled(){
    return Services.appinfo.OS==="WINNT"&&prefs.getBoolPref(DISPLAY_SNAP_PREF,true);
  }
  function screenRect(screen,work=false){
    if(!screen)return null;
    const l={},t={},w={},h={};
    if(work)screen.GetAvailRectDisplayPix(l,t,w,h);else screen.GetRectDisplayPix(l,t,w,h);
    const rect={x:l.value,y:t.value,width:w.value,height:h.value};
    return displayContains(rect,rect.x,rect.y)?rect:null;
  }
  function nativeWindowRect(win){
    try{
      const base=nativeBase(win),x={},y={},w={},h={},scale=base.devicePixelsPerDesktopPixel;
      if(!Number.isFinite(scale)||scale<=0)return null;
      base.getPositionAndSize(x,y,w,h);
      const rect={x:Math.round(x.value/scale),y:Math.round(y.value/scale),width:Math.round(w.value/scale),height:Math.round(h.value/scale)};
      return displayContains(rect,rect.x,rect.y)?rect:null;
    }catch{return null;}
  }
  function displayEventPoint(event){
    if(!displaySnapEnabled()||!event?.isTrusted)return null;
    try{
      const eventWin=event.view?.gBrowser?event.view:event.target?.ownerDocument?.defaultView;
      const source=eventWin?.gBrowser?eventWin:window;
      const base=nativeBase(source);
      const point=displayCssPoint(event.screenX,event.screenY,source.devicePixelRatio,base.devicePixelsPerDesktopPixel);
      if(!point)return null;
      // Gecko's screen getter uses the same CSS->desktop conversion as
      // MouseEvent::ScreenPointDesktopPix. Validate it against our result.
      const resolved=event.screen;
      if(!resolved)return null;
      const full=screenRect(resolved),work=screenRect(resolved,true);
      if(!displayContains(full,point.x,point.y)||!work)return null;
      const checked=screenRect(screenManager().screenForRect(point.x,point.y,1,1));
      if(!displayRectEqual(full,checked))return null;
      return {...point,full,work};
    }catch{return null;}
  }
  function pointInSourceWindow(event){
    const p=displayEventPoint(event),rect=nativeWindowRect(window);
    if(p&&rect)return displayContains(rect,p.x,p.y);
    const x=event.screenX,y=event.screenY;
    return x>=window.screenX&&x<window.screenX+window.outerWidth&&y>=window.screenY&&y<window.screenY+window.outerHeight;
  }
  function placementAt(event,release=false){
    if(!displaySnapEnabled())return null;
    const p=displayEventPoint(event),rect=nativeWindowRect(window);
    if(p&&rect)return displayContains(rect,p.x,p.y)?null:displaySnapTarget(p.full,p.work,p.x,p.y);
    // Some native dragend events lose the screen/widget context. Only
    // reuse a recent observation of the SAME gesture and release point.
    const token=dragLifecycle.current()?.token;
    if(release&&event?.isTrusted&&displayReleaseMatches(placementSample,token,event.screenX,event.screenY,window.performance.now()))
      return placementSample.target;
    return null;
  }
  function clearPlacementPreview(remove=false){
    placementKey="";placementSample=null;placementMonitor=null;placementPopupPoint=null;
    if(placementPreview){
      const popup=placementPreview;
      try{if(popup.state!=="closed")popup.hidePopup();}catch{}
      if(remove){popup.remove();placementPreview=placementMap=placementArea=placementLabel=null;}
    }
  }
  function showPlacementPreview(event,label){
    const p=placementAt(event),fraction=displayPreviewFraction(p),token=dragLifecycle.current()?.token;
    if(!p||!fraction||token==null){clearPlacementPreview();return;}
    placementSample={token,x:event.screenX,y:event.screenY,time:window.performance.now(),target:p};
    const monitor=[p.full.x,p.full.y,p.full.width,p.full.height].join(":");
    const key=[monitor,p.mode,label].join(":");
    if(key===placementKey)return;
    try{
      if(!placementPreview){
        const set=document.getElementById("mainPopupSet");if(!set)return;
        placementPreview=document.createXULElement("panel");placementPreview.id="oneplane-placement-preview";
        for(const [k,v] of Object.entries({noautohide:"true",noautofocus:"true",mousethrough:"always",level:"top","aria-hidden":"true"}))placementPreview.setAttribute(k,v);
        const content=html("div","op-placement-content");
        placementMap=html("div","op-placement-map");placementArea=html("div","op-placement-area");
        placementLabel=html("div","op-placement-label");
        placementMap.append(placementArea);content.append(placementMap,placementLabel);placementPreview.append(content);set.append(placementPreview);
        placementPreview.addEventListener("popupshown",()=>{
          if(!placementSample||!dragLifecycle.owns(placementSample.token)){clearPlacementPreview(true);return;}
          // If Gecko constrained the small popup to another monitor,
          // hide it instead of misleading the user. The drop target is
          // still valid independently of popup rendering.
          try{
            const r=placementPreview.getOuterScreenRect(),scale=window.devicePixelRatio/nativeBase(window).devicePixelsPerDesktopPixel;
            const target=placementSample.target.full;
            if(!r.width||!r.height||!displayContains(target,(r.x+r.width/2)*scale,(r.y+r.height/2)*scale)){
              placementPreview.hidePopup();
            }
          }catch{try{placementPreview.hidePopup();}catch{}}
        });
      }
      const ratio=p.full.width/p.full.height;
      placementMap.style.width=Math.round(Math.min(160,92*ratio))+"px";
      placementMap.style.height=Math.round(Math.min(92,160/ratio))+"px";
      for(const [name,value] of Object.entries({left:fraction.x,top:fraction.y,width:fraction.width,height:fraction.height}))
        placementArea.style[name]=value*100+"%";
      const mode=p.mode==="maximize"?"Maximize":p.mode==="center"?"Centered":p.mode;
      placementLabel.textContent=label+" · "+mode;
      // XULPopupElement takes CSS screen coordinates in the SOURCE
      // document's scale, not destination desktop or CSS coordinates.
      const scale=window.devicePixelRatio/nativeBase(window).devicePixelsPerDesktopPixel;
      if(!Number.isFinite(scale)||scale<=0)return;
      const x=Math.round((p.work.x+p.work.width/2)/scale-105);
      const y=Math.round((p.work.y+Math.min(90,p.work.height*.12))/scale);
      placementPopupPoint={x,y};
      const changedMonitor=placementMonitor!==monitor;
      placementMonitor=monitor;placementKey=key;
      if(placementPreview.state==="open"){
        if(changedMonitor)placementPreview.moveTo(x,y);
      }else if(placementPreview.state==="showing"){
        if(changedMonitor)placementPreview.addEventListener("popupshown",()=>{
          if(placementSample&&placementPopupPoint&&placementPreview?.state==="open")placementPreview.moveTo(placementPopupPoint.x,placementPopupPoint.y);
        },{once:true});
      }else if(placementPreview.state==="hiding"){
        placementPreview.addEventListener("popuphidden",()=>{
          if(placementSample&&placementPopupPoint&&placementPreview?.state==="closed")placementPreview.openPopupAtScreen(placementPopupPoint.x,placementPopupPoint.y,false);
        },{once:true});
      }else placementPreview.openPopupAtScreen(x,y,false);
    }catch(error){console.warn("[OnePlane] Display preview:",error);try{placementPreview?.hidePopup();}catch{}}
  }
  function targetScreen(target){
    if(!target)return null;
    const f=target.full;
    const screen=screenManager().screenForRect(f.x+Math.floor(f.width/2),f.y+Math.floor(f.height/2),1,1);
    return displayRectEqual(f,screenRect(screen))&&displayRectEqual(target.work,screenRect(screen,true))?screen:null;
  }
  function nativeStartupFeatures(target){
    if(!displaySnapEnabled()||!target)return null;
    try{
      const screen=targetScreen(target);
      if(!screen)return null;
      const openerScale=window.devicePixelRatio/nativeBase(window).devicePixelsPerDesktopPixel;
      const destinationScale=screen.defaultCSSScaleFactor/screen.contentsScaleFactor;
      const zoom=window.browsingContext?.fullZoom||1;
      return displayStartupFeatures(target,openerScale,destinationScale,zoom);
    }catch(error){console.warn("[OnePlane] Startup display features:",error);return null;}
  }
  function logPlacement(stage,target,actual=null,extra=null){
    console.info("[OnePlane] Display placement "+stage,JSON.stringify({target:target?.full,rect:target?{x:target.x,y:target.y,width:target.width,height:target.height}:null,mode:target?.mode,actual,extra}));
  }
  // The startup window already has the selected target rectangle. If
  // nsIBaseWindow geometry is unavailable, check the child's native Screen
  // rectangle using the target's CSS scale, never guess the display.
  function childOnTargetScreen(win,target){
    try{
      const screen=targetScreen(target);
      if(!screen)return false;
      const scale=screen.defaultCSSScaleFactor/screen.contentsScaleFactor;
      if(!Number.isFinite(scale)||scale<=0)return false;
      const actual=win.screen,full=target.full;
      return ["x","y","width","height"].every((k,i)=>{
        const v=actual[["left","top","width","height"][i]];
        return Number.isFinite(v)&&Math.abs(v*scale-full[k])<=3;
      });
    }catch{return false;}
  }
  async function placeNativeWindow(win,target){
    if(!displaySnapEnabled()||!win||win.closed||!target)return false;
    let interrupted=false;
    const stop=event=>{if(event.isTrusted)interrupted=true;};
    const wait=()=>new Promise(resolve=>window.setTimeout(resolve,120));
    const alive=()=>!dead&&!win.closed&&!interrupted;
    const stateMax=()=>win.windowState===win.STATE_MAXIMIZED;
    const matches=()=>displayPlacementMatches(target,nativeWindowRect(win),stateMax())||
      (target.mode==="maximize"&&stateMax()&&childOnTargetScreen(win,target));
    const validTarget=()=>!!targetScreen(target);
    try{
      win.addEventListener("pointerdown",stop,true);win.addEventListener("keydown",stop,true);
      const full=target.full,work=target.work;
      const onTarget=rect=>rect&&displayContains(full,rect.x+Math.floor(rect.width/2),rect.y+Math.floor(rect.height/2));
      if(!validTarget()){logPlacement("target-disconnected",target);return false;}
      logPlacement("before",target,nativeWindowRect(win),win.windowState);
      if(matches()){logPlacement("already-matched",target,nativeWindowRect(win));return true;}
      // Maximize a correctly positioned window directly; do not make this
      // depend on a subsequent resize, tab loading or a workspace switch.
      if(target.mode==="maximize"&&(onTarget(nativeWindowRect(win))||childOnTargetScreen(win,target))&&win.windowState!==win.STATE_MINIMIZED){
        for(let attempt=0;attempt<3;attempt++){
          if(!alive()||!validTarget())return false;
          if(!stateMax()){logPlacement("maximize-request",target,nativeWindowRect(win),win.windowState);win.maximize();}
          await wait();
          if(!alive())return false;
          if(matches()){logPlacement("maximize",target,nativeWindowRect(win),win.windowState);return true;}
        }
      }
      const base=nativeBase(win);
      if(stateMax()||win.windowState===win.STATE_MINIMIZED){win.restore();await wait();}
      if(!alive())return false;
      const seed=displaySnapTarget(full,work,full.x+Math.floor(full.width/2),full.y+Math.floor(full.height/2));
      function nativeSize(rect){
        const n=displayNativeRect(rect,base.devicePixelsPerDesktopPixel);
        if(!n)throw Error("Invalid native display scale");
        base.setSize(n.width,n.height,true);
      }
      function cssApply(rect,resize=true){
        const scale=win.devicePixelRatio/base.devicePixelsPerDesktopPixel;
        if(!Number.isFinite(scale)||scale<=0)throw Error("Invalid CSS display scale");
        if(resize)win.resizeTo(Math.round(rect.width/scale),Math.round(rect.height/scale));
        win.moveTo(Math.round(rect.x/scale),Math.round(rect.y/scale));
      }
      // Retain .23's working monitor-selection path, but only use the
      // center seed for recovering an off-monitor window.
      if(!onTarget(nativeWindowRect(win))){
        try{nativeSize(seed);}catch{cssApply(seed);}
        for(let attempt=0;attempt<4;attempt++){
          if(!alive()||!validTarget())return false;
          try{
            if(attempt<2)base.setPositionDesktopPix(seed.x,seed.y);
            else cssApply(seed,false);
          }catch{cssApply(seed,false);}
          await wait();
          const actual=nativeWindowRect(win);
          logPlacement("move-"+(attempt+1),target,actual);
          if(onTarget(actual))break;
          if(attempt===3)return false;
        }
      }
      if(!alive()||!validTarget())return false;
      if(target.mode==="maximize"){
        win.maximize();await wait();
        logPlacement("maximize",target,nativeWindowRect(win),win.windowState);
        return alive()&&matches();
      }
      for(let attempt=0;attempt<2;attempt++){
        if(!alive()||!validTarget())return false;
        try{
          if(attempt===0){nativeSize(target);base.setPositionDesktopPix(target.x,target.y);}
          else cssApply(target);
        }catch{cssApply(target);}
        await wait();
        if(!alive())return false;
        const actual=nativeWindowRect(win);
        logPlacement("size-"+(attempt+1),target,actual);
        if(matches())return true;
      }
      // An OS minimum size may make the exact quarter impossible. Keep
      // the real window/tab intact, but do not call this a successful snap.
      const actual=nativeWindowRect(win);
      if(alive()&&onTarget(actual)&&actual.width<=work.width&&actual.height<=work.height){
        const x=Math.max(work.x,Math.min(work.x+work.width-actual.width,target.x));
        const y=Math.max(work.y,Math.min(work.y+work.height-actual.height,target.y));
        if(Math.abs(actual.x-x)>2||Math.abs(actual.y-y)>2)try{base.setPositionDesktopPix(x,y);}catch{}
      }
      logPlacement("size-unverified",target,nativeWindowRect(win));
      return false;
    }catch(error){logPlacement("exception",target,nativeWindowRect(win),String(error));console.warn("[OnePlane] Native display placement:",error);return false;}
    finally{try{win.removeEventListener("pointerdown",stop,true);win.removeEventListener("keydown",stop,true);}catch{}}
  }
  // Both creation paths schedule this immediately. Native window placement
  // must finish even when workspace initialization or activation fails.
  // Cancel on genuine interaction, close, teardown or startup timeout.
  function placeAfterStartup(win,target){
    if(!displaySnapEnabled()||!win||!target)return Promise.resolve(false);
    return new Promise(resolve=>{
      let timer=0,poll=0,settle=0,done=false;
      const cleanup=()=>{
        if(done)return false;done=true;
        try{Services.obs.removeObserver(observer,"browser-delayed-startup-finished");}catch{}
        try{Services.obs.removeObserver(closedObserver,"domwindowclosed");}catch{}
        win.removeEventListener("pointerdown",input,true);win.removeEventListener("keydown",input,true);
        if(timer)window.clearTimeout(timer);if(poll)window.clearTimeout(poll);if(settle)window.clearTimeout(settle);
        return true;
      };
      const cancel=(reason)=>{if(cleanup()){logPlacement("startup-cancelled",target,null,{reason});resolve(false);}};
      const input=event=>{if(event.isTrusted)cancel("child-input");};
      const closedObserver=subject=>{if(subject===win||subject===window)cancel("domwindowclosed");};
      let applying=false;
      const apply=async()=>{
        if(done||applying)return;applying=true;
        logPlacement("startup-observed",target,null,{zenReady:!!win.gZenStartup?.isReady});
        // Do not wait indefinitely on Zen session initialization. Either
        // readiness or a bounded settle interval permits native maximize.
        if(target.mode==="maximize"&&!win.gZenStartup?.isReady&&win.gZenStartup?.promiseInitialized){
          await Promise.race([Promise.resolve(win.gZenStartup.promiseInitialized).catch(()=>{}),new Promise(r=>{settle=window.setTimeout(r,600);})]);
        }
        if(!cleanup())return;
        if(dead||window.closed||win.closed){resolve(false);return;}
        const ok=await placeNativeWindow(win,target);
        if(!ok)console.warn("[OnePlane] Placement not verified; native window kept.");
        resolve(ok);
      };
      const observer=subject=>{if(subject===win)void apply();};
      Services.obs.addObserver(observer,"browser-delayed-startup-finished");
      // Initial about:blank document unload is normal when a new chrome
      // window navigates to browser.xhtml. Only actual window destruction
      // (WindowWatcher notification) or verified closed state cancels.
      Services.obs.addObserver(closedObserver,"domwindowclosed");
      win.addEventListener("pointerdown",input,true);win.addEventListener("keydown",input,true);
      timer=window.setTimeout(()=>{logPlacement("startup-timeout",target);cancel("timeout");},15000);
      // Poll only during this startup, so a missed observer or wrapper
      // mismatch cannot leave a correctly sized but non-maximized window.
      const check=()=>{
        if(done||applying)return;
        if(win.closed||window.closed||dead){cancel("closed-state");return;}
        if(win.gBrowserInit?.delayedStartupFinished||win.gZenStartup?.isReady){void apply();return;}
        poll=window.setTimeout(check,100);
      };
      check();
    });
  }
  function onSourceDrag(event){
    if(!draggedTab||draggedGroup||(!event.screenX&&!event.screenY))return;
    if(!pointInSourceWindow(event)){
      if(dragImageMode!=="outside")setDragImageMode("outside",event);
      showPlacementPreview(event,"Tab");
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
    glyph.append(shape);button.append(glyph);button.title="One Plane Hub";
    for(const [key,value] of Object.entries({skipintoolbarset:"true",removable:"false",tooltiptext:"One Plane Hub","aria-label":"One Plane Hub","aria-haspopup":"dialog","aria-expanded":"false"}))button.setAttribute(key,value);
    const panel=html("div","op-hub-panel");
    panel.hidden=true;
    const topLayer=typeof panel.showPopover==="function"&&typeof panel.hidePopover==="function";
    if(topLayer)panel.setAttribute("popover","manual");
    panel.id="oneplane-hub-panel";
    for(const [key,value] of Object.entries({role:"dialog","aria-label":"One Plane Hub"}))panel.setAttribute(key,value);
    const make=(tag,cls,text)=>{const n=html(tag,cls);if(text!==undefined)n.textContent=text;return n;};
    const content=make("div","op-hub-content");
    const spaces=make("div","op-hub-spaces"),status=make("div","op-hub-status");
    status.setAttribute("role","status");status.setAttribute("aria-live","polite");
    const form=make("form","op-hub-create"),name=make("input","op-hub-name"),add=make("button","op-hub-add","+");
    name.type="text";name.maxLength=80;name.placeholder="New workspace";name.setAttribute("aria-label","New workspace name");
    add.type="submit";add.setAttribute("aria-label","Create workspace");form.append(name,add);
    const mode=make("button","op-hub-mode");mode.type="button";
    const titleRow=make("div","op-hub-title-row"),trashToggle=make("button","op-hub-trash-toggle");
    trashToggle.type="button";trashToggle.title="Trash";trashToggle.setAttribute("aria-label","Trash");
    trashToggle.setAttribute("aria-expanded","false");
    const trashIcon=document.createElementNS(glyph.namespaceURI,"svg");
    trashIcon.setAttribute("viewBox","0 0 20 20");trashIcon.setAttribute("aria-hidden","true");
    const trashPath=document.createElementNS(glyph.namespaceURI,"path");
    trashPath.setAttribute("d","M3 5h14M7 5V3h6v2M5 5l1 12h8l1-12M8 8v6M12 8v6");
    trashIcon.append(trashPath);
    const trashSymbol=make("span","op-hub-trash-symbol"),trashCount=make("span","op-hub-trash-count","0");
    trashSymbol.append(trashIcon,trashCount);
    trashToggle.append(make("span","op-hub-trash-title","Trash"),trashSymbol);
    titleRow.append(make("h2","op-hub-title","One Plane Hub"));
    const freeSetup=make("div","op-hub-free-setup"),trashPanel=make("section","op-hub-trash-panel");
    trashPanel.setAttribute("aria-label","Trash");
    const trashList=make("div","op-hub-trash-list"),trashTools=make("div","op-hub-trash-tools");
    const ageSelect=make("button","op-hub-age"),clearTrash=make("button","op-hub-action","Clear");
    clearTrash.type=ageSelect.type="button";
    ageSelect.setAttribute("aria-label","Clear tabs older than");ageSelect.setAttribute("aria-expanded","false");
    ageSelect.setAttribute("aria-controls","oneplane-trash-age-menu");
    const ageLabel=make("span","op-hub-age-label","All tabs"),ageChevron=make("span","op-hub-age-chevron","⌄");
    ageChevron.setAttribute("aria-hidden","true");ageSelect.append(ageLabel,ageChevron);
    const ageMenu=make("div","op-hub-age-menu");ageMenu.id="oneplane-trash-age-menu";ageMenu.hidden=true;
    ageMenu.setAttribute("role","group");ageMenu.setAttribute("aria-label","Clear tabs older than");
    const ageChoices=new Map();
    for(const [value,short,label] of hubTrashAgeOptions()){
      const option=make("button","op-hub-age-option",label);option.type="button";option.setAttribute("aria-pressed",String(value==="all"));
      option.addEventListener("click",()=>selectTrashAge(value));ageChoices.set(value,{short,option});ageMenu.append(option);
    }
    trashTools.append(clearTrash,ageSelect);
    const trashConfirmation=make("div","op-hub-trash-confirm");
    const trashHead=make("div","op-hub-trash-head"),trashDrawer=make("div","op-hub-trash-drawer"),trashInner=make("div","op-hub-trash-inner");
    const trashNotice=make("div","op-hub-trash-notice"),trashRows=make("div","op-hub-trash-rows");
    trashList.append(trashRows);trashHead.append(trashToggle,trashTools);
    trashInner.append(ageMenu,trashConfirmation,trashNotice,trashList);trashDrawer.append(trashInner);trashDrawer.inert=true;
    trashPanel.append(trashHead,trashDrawer);
    trashToggle.addEventListener("click",()=>{
      if(trashDrag)return;
      trashOpen=!trashOpen;purgePlan=null;setTrashAgeOpen(false);renderTrash();
    });
    trashList.addEventListener("scroll",scheduleTrashRows,{passive:true});
    ageSelect.addEventListener("click",()=>{if(open&&trashOpen&&!ageSelect.disabled)setTrashAgeOpen(ageMenu.hidden,true);});
    clearTrash.addEventListener("click",()=>askPurge());
    const freeSlot=make("div","op-hub-free-slot"),freeDivider=make("div","op-hub-divider");
    freeDivider.hidden=true;
    content.append(titleRow,make("h3","op-hub-heading","Workspaces"),freeSetup,freeSlot,freeDivider,spaces,form,status,make("div","op-hub-divider"),make("h3","op-hub-heading","Settings"),mode,trashPanel);
    const returnButton=make("button","op-hub-return","Return to main window");returnButton.type="button";returnButton.hidden=true;content.prepend(returnButton);
    panel.append(content);
    let destroyed=false,busy=false,open=false,contextId=null,hubSession=0;
    let trashOpen=false,purgePlan=null,trashDrag=null,editId=null;
    let trashData=[],trashAllowed=false,trashAgeTimer=0,trashFrame=0,trashRangeKey="",trashTarget=null;
    let trashAge="all";
    const TRASH_ROW_HEIGHT=54;
    const FREE_PREF="zen.oneplane.free-space-id",TRASH_PREF="zen.oneplane.trash-space-id",COLOR_PREF="zen.oneplane.workspace-colors",TRASH_TIME="oneplane-trashed-at";
    let geometryFrame=0,motion=null,confirmation=null,drag=null,suppressClickUntil=0,projectionBusy=false;
    const PROJECTION="__oneplaneWorkspaceProjection";
    let dragBadge=null,dragBadgeFrame=0,dragBadgePoint=null;
    function hideDragBadge(remove=false){
      if(dragBadgeFrame)window.cancelAnimationFrame(dragBadgeFrame);dragBadgeFrame=0;dragBadgePoint=null;
      if(dragBadge){if(dragBadge.matches(":popover-open"))dragBadge.hidePopover();dragBadge.hidden=true;if(remove){dragBadge.remove();dragBadge=null;}}
    }
    function showDragBadge(event,label){
      if(!pointInSourceWindow(event)){hideDragBadge();return;}
      if(!dragBadge){dragBadge=make("div","op-hub-drag-badge");dragBadge.id="oneplane-workspace-drag-badge";dragBadge.setAttribute("aria-hidden","true");dragBadge.hidden=true;if(typeof dragBadge.showPopover==="function")dragBadge.setAttribute("popover","manual");root.append(dragBadge);}
      dragBadge.textContent=label;dragBadgePoint={x:event.clientX+16,y:event.clientY+16};
      if(dragBadgeFrame)return;
      dragBadgeFrame=window.requestAnimationFrame(()=>{dragBadgeFrame=0;if(!drag||!dragBadgePoint)return;
        const p=dragBadgePoint;dragBadge.style.transform="translate("+Math.max(0,Math.min(window.innerWidth-165,p.x))+"px,"+Math.max(0,Math.min(window.innerHeight-42,p.y))+"px)";
        dragBadge.hidden=false;if(typeof dragBadge.showPopover==="function"&&!dragBadge.matches(":popover-open"))try{dragBadge.showPopover();}catch{}
      });
    }
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
      const wasVisible=!panel.hidden;contextId=null;confirmation=null;editId=null;finishTrashDrag();setTrashAgeOpen(false);purgePlan=null;open=false;trashOpen=false;stopTrashUpdates();
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
      if(destroyed||trashDrag)return;
      const snapshot=hubWorkspaceOrder(hubWorkspaceSnapshot(manager()),freeId(),trashId()),focusedId=document.activeElement?.dataset?.workspaceId;
      renderFreeSetup(snapshot);
      renderTrash();
      returnButton.hidden=!window[PROJECTION];returnButton.disabled=projectionBusy;
      spaces.replaceChildren();freeSlot.replaceChildren();freeDivider.hidden=!freeId();
      if(!snapshot?.length)spaces.append(make("p","op-hub-empty",snapshot?"No native workspaces":"Native workspaces unavailable"));
      else for(const space of snapshot){
        const entry=make("button","op-hub-space");entry.type="button";entry.dataset.workspaceId=space.id;entry.disabled=busy;
        entry.setAttribute("aria-current",space.active?"true":"false");
        const icon=make("span","op-hub-icon",space.icon||Array.from(space.name)[0]?.toUpperCase()||"·");icon.setAttribute("aria-hidden","true");
        const accent=workspaceColor(space.id);if(accent)icon.style.setProperty("--op-space-accent",accent);
        if(space.id===freeId())entry.setAttribute("data-op-free","true");
        entry.append(icon,make("span","op-hub-label",space.name));
        if(space.id===freeId()){
          const lock=make("span","op-hub-lock","");lock.title="Default workspace";lock.setAttribute("aria-label","Protected default workspace");
          const svg=document.createElementNS(glyph.namespaceURI,"svg");svg.setAttribute("viewBox","0 0 20 20");svg.setAttribute("aria-hidden","true");
          const path=document.createElementNS(glyph.namespaceURI,"path");path.setAttribute("d","M6 9V6a4 4 0 0 1 8 0v3M5 9h10v8H5z");svg.append(path);lock.append(svg);entry.append(lock);
        }
        if(space.active)entry.append(make("span","op-hub-current","•"));
        entry.addEventListener("click",()=>{if(window.performance.now()>=suppressClickUntil)void select(space.id);});
        entry.addEventListener("pointerdown",event=>beginDrag(event,space.id,entry));
        entry.addEventListener("contextmenu",event=>{event.preventDefault();event.stopPropagation();if(!busy){confirmation=null;editId=null;contextId=contextId===space.id?null:space.id;render();}});
        const slot=space.id===freeId()?freeSlot:spaces;
        slot.append(entry);
        if(contextId===space.id)slot.append(workspaceMenu(space,snapshot));
        if(focusedId===space.id&&open&&!busy)entry.focus({preventScroll:true});
      }
      form.hidden=!snapshot||typeof manager()?.createAndSaveWorkspace!=="function";
      name.disabled=busy;add.disabled=busy||!name.value.trim();
      const compact=root.getAttribute("zen-compact-mode")==="true";
      const modeLabel=make("span","op-hub-mode-label","Compact Mode"),modeState=make("span","op-hub-mode-state",compact?"On":"Off");mode.replaceChildren(modeLabel,modeState);
      mode.setAttribute("aria-pressed",String(compact));mode.disabled=typeof command()?.doCommand!=="function";
    }
    function workspaceMenu(space,snapshot){
      const menu=make("div","op-hub-context");menu.setAttribute("role","group");menu.setAttribute("aria-label","Workspace actions");
      const native=manager(),free=prefs.getStringPref("zen.oneplane.free-space-id","");
      const canDelete=snapshot.length>1&&!!freeId()&&space.id!==free&&singleWindow()&&canManage()&&typeof native?.removeWorkspace==="function";
      const detach=make("button","op-hub-action","Open in another window");detach.type="button";detach.disabled=busy||projectionBusy;
      detach.addEventListener("click",()=>void project(space.id,null));menu.append(detach);
      if(editId===space.id){menu.append(workspaceEditor(space));return menu;}
      if(!confirmation){
        const edit=action("Edit workspace",()=>{editId=space.id;render();});
        edit.disabled=!canManage()||typeof native?.saveWorkspace!=="function";menu.append(edit);
        if(!freeId()&&space.id!==trashId()){
          const designate=action("Make Free (rename)",()=>void designateFree(space.id));designate.disabled=!canManage();menu.append(designate);
        }
        const order=make("div","op-hub-confirm-controls");
        const up=action("Move up",()=>void moveWorkspace(space.id,-1)),down=action("Move down",()=>void moveWorkspace(space.id,1));
        const index=snapshot.findIndex(s=>s.id===space.id);
        up.disabled=!canManage()||space.id===freeId()||index<=Number(!!freeId())||typeof native?.reorderWorkspace!=="function";
        down.disabled=!canManage()||space.id===freeId()||index>=snapshot.length-1||typeof native?.reorderWorkspace!=="function";
        order.append(up,down);menu.append(order);
      }
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
    // Native spaces own tabs and session data; prefs contain roles and Hub accent only.
    function storedId(key){const id=prefs.getStringPref(key,"");return id&&manager()?.getWorkspaceFromId?.(id)?id:"";}
    const freeId=()=>storedId(FREE_PREF),trashId=()=>storedId(TRASH_PREF);
    function canManage(){const native=manager();return !!native?.workspaceEnabled&&!native.privateWindowOrDisabled&&native.currentWindowIsSyncing&&privateState(window)===false;}
    function singleWindow(){
      try{const windows=Services.wm.getEnumerator("navigator:browser");
        while(windows.hasMoreElements()){const win=windows.getNext();if(win!==window&&!win.closed)return false;}return true;
      }catch{return false;}
    }
    function action(label,fn){const btn=make("button","op-hub-action",label);btn.type="button";btn.addEventListener("click",fn);return btn;}
    function workspaceColor(id){try{const v=JSON.parse(prefs.getStringPref(COLOR_PREF,"{}"))[id];return /^#[0-9a-f]{6}$/i.test(v)?v:"";}catch{return "";}}
    function saveWorkspaceColor(id,value){
      let colors={};try{colors=JSON.parse(prefs.getStringPref(COLOR_PREF,"{}"));}catch{}
      if(!colors||typeof colors!=="object"||Array.isArray(colors))colors={};
      if(/^#[0-9a-f]{6}$/i.test(value))colors[id]=value;
      prefs.setStringPref(COLOR_PREF,JSON.stringify(colors));
    }
    async function operation(fn){
      if(busy||projectionBusy||destroyed||!canManage())return;
      busy=true;status.textContent="";
      try{await fn();}catch(error){status.textContent=String(error.message||error);console.warn("[OnePlane] Workspace Engine:",error);}
      finally{busy=false;if(!destroyed&&open)render();}
    }
    function renderFreeSetup(snapshot){
      freeSetup.replaceChildren();freeSetup.hidden=!!freeId()||!snapshot?.length;
      if(freeSetup.hidden)return;
      const msg=make("p","op-hub-confirm-text","Choose an existing workspace → Make Free, or create a new Free.");
      const btn=action("Create Free",()=>void designateFree(null));btn.disabled=busy||!canManage();
      freeSetup.append(msg,btn);
    }
    async function designateFree(id){
      await operation(async()=>{
        if(freeId())throw Error("Free is already designated.");
        const native=manager(),ws=id?native.getWorkspaceFromId(id):await native.createAndSaveWorkspace("Free","⌂",true);
        if(!ws?.uuid||ws.uuid===trashId()||!native.getWorkspaceFromId(ws.uuid))throw Error("Could not designate Free.");
        if(id){if(typeof native.saveWorkspace!=="function")throw Error("Native rename unavailable.");native.saveWorkspace({...ws,name:"Free"});}
        prefs.setStringPref(FREE_PREF,ws.uuid);
        if(typeof native.reorderWorkspace==="function")await native.reorderWorkspace(ws.uuid,0);
        contextId=null;editId=null;
      });
    }
    function workspaceEditor(space){
      const wrap=make("div","op-hub-edit"),label=make("input","op-hub-name"),icon=make("input","op-hub-name"),color=make("input","op-hub-color");
      label.value=space.name;label.maxLength=80;label.placeholder="Workspace name";label.setAttribute("aria-label","Workspace name");label.disabled=space.id===freeId();
      icon.value=space.icon;icon.maxLength=24;icon.placeholder="Icon / emoji";icon.setAttribute("aria-label","Workspace icon");
      color.type="color";color.value=workspaceColor(space.id)||"#7089b8";color.setAttribute("aria-label","Hub icon color");
      let colorEdited=false;color.addEventListener("input",()=>{colorEdited=true;});
      const controls=make("div","op-hub-confirm-controls"),cancel=action("Cancel",()=>{editId=null;render();});
      const save=action("Save",()=>void operation(async()=>{
        const native=manager(),ws=native.getWorkspaceFromId(space.id),value=label.value.trim();
        if(!ws||!value)throw Error("Enter a workspace name.");
        const next={...ws,name:space.id===freeId()?"Free":value};
        if(icon.value.trim()!==space.icon)next.icon=icon.value.trim()||undefined;
        native.saveWorkspace(next);
        if(colorEdited)saveWorkspaceColor(space.id,color.value);
        editId=null;
      }));
      controls.append(cancel,save);wrap.append(label,icon,color,controls);return wrap;
    }
    async function moveWorkspace(id,direction){
      await operation(async()=>{
        const native=manager(),ordered=hubWorkspaceOrder(hubWorkspaceSnapshot(native),freeId(),trashId());
        const index=ordered.findIndex(s=>s.id===id),destination=ordered[index+direction];
        if(id===freeId()||!destination||destination.id===freeId())return;
        const nativeIndex=native.getWorkspaces().findIndex(s=>s.uuid===destination.id);
        if(nativeIndex>=0)await native.reorderWorkspace(id,nativeIndex);
      });
    }
    function trashSessionStore(){
      try{return ChromeUtils.importESModule("moz-src:///browser/components/sessionstore/SessionStore.sys.mjs").SessionStore;}
      catch{return ChromeUtils.importESModule("resource:///modules/sessionstore/SessionStore.sys.mjs").SessionStore;}
    }
    function trashStamp(tab){try{return Number(trashSessionStore().getCustomTabValue(tab,TRASH_TIME))||0;}catch{return 0;}}
    async function ensureTrash(){
      const native=manager();
      if(!singleWindow()||!freeId())throw Error("Set up Free and close other browser windows first.");
      let id=trashId();
      if(!id){
        const result=await native.createAndSaveWorkspace("Trash","🗑",true);
        if(!result?.uuid||!native.getWorkspaceFromId(result.uuid))throw Error("Could not create Trash.");
        id=result.uuid;prefs.setStringPref(TRASH_PREF,id);
      }
      for(let i=0;i<20&&!native.workspaceElement(id);i++)await new Promise(r=>window.setTimeout(r,50));
      if(destroyed||!singleWindow()||!native.workspaceElement(id))throw Error("Trash is not ready.");
      return id;
    }
    function moveNativeTab(tab,destination){
      const native=manager(),element=native.workspaceElement(destination);
      if(!singleWindow()||!canManage()||!hubTrashTabEligible(tab)||tab===browser.selectedTab||
        !native.getWorkspaceFromId(destination)||!(tab.pinned?element?.pinnedTabsContainer:element?.tabsContainer))
        throw Error("Tab cannot be moved safely.");
      native.moveTabsToWorkspace([tab],destination);
      if(tab.getAttribute("zen-workspace-id")!==destination)throw Error("Native tab move did not complete.");
    }
    function deletionDetails(id){
      const native=manager(),snapshot=hubWorkspaceOrder(hubWorkspaceSnapshot(native),freeId(),trashId()),space=snapshot?.find(s=>s.id===id);
      if(!space||!freeId()||id===freeId()||snapshot.length<=1||!canManage()||!singleWindow()||
        typeof native.removeWorkspace!=="function"||typeof native.moveTabsToWorkspace!=="function")return null;
      const tabs=ownedTabs(native,id);
      if(!tabs||tabs.some(t=>!hubTrashTabEligible(t)))return null;
      return {id,native,plan:tabs,description:tabs.length?"Move "+tabs.length+" tab(s) to Trash and delete “"+space.name+"”?":"Delete empty workspace “"+space.name+"”?"};
    }
    function askDelete(id){
      if(busy||destroyed)return;
      confirmation=deletionDetails(id);contextId=id;editId=null;
      if(!confirmation)status.textContent="Cannot delete safely. Set up Free, close other windows, or resolve grouped tabs.";
      render();
    }
    async function removeSpace(id){
      if(busy||destroyed||confirmation?.id!==id)return;
      const approved=confirmation,now=deletionDetails(id);
      if(!now||now.native!==approved.native||now.description!==approved.description||
        now.plan.length!==approved.plan.length||now.plan.some(t=>!approved.plan.includes(t))){
        confirmation=now;status.textContent="Workspace changed. Review again.";render();return;
      }
      confirmation=null;contextId=null;
      const session=hubSession;
      await operation(async()=>{
        const native=now.native,destination=now.plan.length?await ensureTrash():null;
        if(native.activeWorkspace===id){switchGuard();await native.changeWorkspaceWithID(freeId());}
        if(destroyed||!singleWindow()||native.activeWorkspace===id)throw Error("Workspace is still active.");
        const fresh=deletionDetails(id);
        if(!fresh||fresh.plan.length!==now.plan.length||fresh.plan.some(t=>!now.plan.includes(t)))throw Error("Workspace changed. Nothing deleted.");
        const store=destination?trashSessionStore():null;
        for(const tab of fresh.plan){
          store.setCustomTabValue(tab,TRASH_TIME,String(Date.now()));
          moveNativeTab(tab,destination);
        }
        if(!singleWindow()||ownedTabs(native,id)?.length!==0)throw Error("Not all tabs moved. Workspace kept.");
        switchGuard();await native.removeWorkspace(id);
        if(native.getWorkspaceFromId(id))throw Error("Workspace not removed.");
        // Only auto-expand for a deletion from this same Hub opening.
        if(destination&&open&&hubSession===session)trashOpen=true;
      });
    }
    function trashTabs(){const id=trashId();return id?(ownedTabs(manager(),id)||[]):[];}
    function restoreTargets(){return hubWorkspaceOrder(hubWorkspaceSnapshot(manager()),freeId(),trashId())||[];}
    function restoreTrashTab(tab,id){
      return operation(async()=>{
        if(!trashTabs().includes(tab)||id===trashId()||!restoreTargets().some(s=>s.id===id))throw Error("Restore target changed.");
        moveNativeTab(tab,id);
        try{trashSessionStore().deleteCustomTabValue(tab,TRASH_TIME);}catch{}
        purgePlan=null;
      });
    }
    function trashMotionEnabled(){
      return !window.matchMedia("(prefers-reduced-motion: reduce)").matches&&prefs.getIntPref("zen.oneplane.animation-duration",160)!==0;
    }
    function clearTrashTarget(){
      trashTarget?.removeAttribute("data-op-trash-target");trashTarget=null;
    }
    function finishTrashDrag(){
      const d=trashDrag;trashDrag=null;clearTrashTarget();
      if(!d)return;
      if(dragLifecycle.owns(d.token,"trash"))dragLifecycle.finish(d.token);
      if(d.frame)window.cancelAnimationFrame(d.frame);
      d.animation?.cancel();
      try{if(panel.hasPointerCapture(d.pointer))panel.releasePointerCapture(d.pointer);}catch{}
      // Restore the actual row to its original list slot; never clone it.
      d.row.removeAttribute("data-op-trash-floating");
      d.row.removeAttribute("data-op-trash-settling");
      for(const k of ["left","top","width","height","translate","scale"])d.row.style.removeProperty(k);
      if(d.placeholder?.isConnected)d.placeholder.replaceWith(d.row);
      else if(d.moved)d.row.remove();
      if(d.moved)suppressClickUntil=window.performance.now()+400;
    }
    function cancelTrashDrag(){
      finishTrashDrag();
      if(open&&!destroyed)render();
    }
    function beginTrashDrag(event,tab,row){
      if(!event.isTrusted||event.button!==0||!(event.buttons&1)||!open||!trashOpen||busy||projectionBusy||destroyed||
        !trashAllowed||!singleWindow()||!hubTrashTabEligible(tab)||tab===browser.selectedTab)return;
      if(trashDrag?.settling)finishTrashDrag();
      else if(trashDrag)return;
      if(dragLifecycle.current())cancelActiveDrag("superseded");
      event.preventDefault();event.stopPropagation();
      const token=dragLifecycle.begin("trash",{pointerId:event.pointerId,onMove:moveTrashDrag,onUp:endTrashDrag,onCancel:cancelTrashDrag});
      if(token===null)return;
      const rect=row.getBoundingClientRect();
      trashDrag={tab,row,token,pointer:event.pointerId,rect,x:event.clientX,y:event.clientY,point:null,moved:false,frame:0,animation:null,placeholder:null,dx:0,dy:0,settling:false};
      try{panel.setPointerCapture(event.pointerId);}catch{dragLifecycle.cancel("trash-capture-failed",token);}
    }
    function trashDestination(x,y){
      const bounds=panel.getBoundingClientRect();
      if(x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom)return null;
      const hit=document.elementFromPoint(x,y)?.closest(".op-hub-space");
      return hit&&panel.contains(hit)&&!hit.disabled&&hit.dataset.workspaceId!==trashId()?hit:null;
    }
    function liftTrashRow(d){
      // The sole moving element is the real card. An empty spacer retains
      // its 54px virtual-list slot while the card is out of document flow.
      const p=panel.getBoundingClientRect();
      d.placeholder=make("div","op-hub-trash-placeholder");
      d.placeholder.setAttribute("aria-hidden","true");
      d.row.before(d.placeholder);
      d.baseX=d.rect.left-p.left+panel.scrollLeft;
      d.baseY=d.rect.top-p.top+panel.scrollTop;
      d.row.style.left=d.baseX+"px";d.row.style.top=d.baseY+"px";
      d.row.style.width=d.rect.width+"px";d.row.style.height=d.rect.height+"px";
      d.row.setAttribute("data-op-trash-floating","true");
      panel.append(d.row);d.moved=true;
      if(trashMotionEnabled())try{
        d.animation=d.row.animate([
          {scale:"1",offset:0},{scale:"1.12 .84",offset:.26},
          {scale:".94 1.12",offset:.5},{scale:"1.06 .97",offset:.75},{scale:"1.04",offset:1}
        ],{duration:360,easing:"linear",fill:"forwards"});
      }catch{}
    }
    function positionTrashRow(d,event){
      if(trashDrag!==d||!d.moved||d.settling)return;
      const p=panel.getBoundingClientRect();
      // Bound the card to the Hub so moving outside cannot expand its
      // scrollable area or leave any floating element over the page.
      const grabX=d.x-d.rect.left,grabY=d.y-d.rect.top;
      const left=Math.max(p.left,Math.min(p.right-d.rect.width,event.clientX-grabX));
      const top=Math.max(p.top,Math.min(p.bottom-d.rect.height,event.clientY-grabY));
      d.dx=left-p.left+panel.scrollLeft-d.baseX;
      d.dy=top-p.top+panel.scrollTop-d.baseY;
      d.row.style.translate=d.dx+"px "+d.dy+"px";
      const target=trashDestination(event.clientX,event.clientY);
      if(target!==trashTarget){clearTrashTarget();trashTarget=target;target?.setAttribute("data-op-trash-target","true");}
    }
    function moveTrashDrag(event){
      const d=trashDrag;
      if(!d||d.settling||!dragLifecycle.owns(d.token,"trash"))return;
      if(!d.row.isConnected||!singleWindow()){dragLifecycle.cancel("trash-invalid",d.token);return;}
      if(!d.moved&&Math.hypot(event.clientX-d.x,event.clientY-d.y)<6)return;
      event.preventDefault();event.stopPropagation();
      if(!d.moved)liftTrashRow(d);
      d.point={clientX:event.clientX,clientY:event.clientY};
      if(!d.frame)d.frame=window.requestAnimationFrame(()=>{d.frame=0;if(d.point)positionTrashRow(d,d.point);});
    }
    async function endTrashDrag(event){
      const d=trashDrag;
      if(!d||!dragLifecycle.owns(d.token,"trash")||!dragLifecycle.finish(d.token))return;
      if(d.frame)window.cancelAnimationFrame(d.frame);d.frame=0;
      if(!d.moved){finishTrashDrag();return;}
      event.preventDefault();event.stopPropagation();
      positionTrashRow(d,event);
      const target=trashDestination(event.clientX,event.clientY),id=target?.dataset.workspaceId;
      d.settling=true;clearTrashTarget();
      try{if(panel.hasPointerCapture(d.pointer))panel.releasePointerCapture(d.pointer);}catch{}
      // Commit native transfer once at release. Rendering remains frozen
      // until the SAME visual card has finished its absorption.
      if(id)await restoreTrashTab(d.tab,id);
      if(trashDrag!==d)return;
      const moved=!!id&&d.tab.getAttribute("zen-workspace-id")===id&&!trashTabs().includes(d.tab);
      const destination=moved?target:d.placeholder;
      if(!open||!destination?.isConnected||!trashMotionEnabled()){finishTrashDrag();if(open)render();return;}
      const dest=destination.getBoundingClientRect(),p=panel.getBoundingClientRect();
      const tx=dest.left+dest.width/2-d.rect.width/2-p.left+panel.scrollLeft-d.baseX;
      const ty=dest.top+dest.height/2-d.rect.height/2-p.top+panel.scrollTop-d.baseY;
      const pos=(x,y)=>x+"px "+y+"px";
      const start=window.getComputedStyle(d.row).scale||"1";
      d.animation?.cancel();d.row.setAttribute("data-op-trash-settling","true");
      try{
        d.animation=d.row.animate(moved?[
          {translate:pos(d.dx,d.dy),scale:start,opacity:1,offset:0},
          {translate:pos(d.dx+(tx-d.dx)*.3,d.dy+(ty-d.dy)*.3),scale:"1.14 .83",opacity:1,offset:.25},
          {translate:pos(d.dx+(tx-d.dx)*.85,d.dy+(ty-d.dy)*.85),scale:".45 .65",opacity:.95,offset:.72},
          {translate:pos(tx,ty),scale:".05 .1",opacity:0,offset:1}
        ]:[
          {translate:pos(d.dx,d.dy),scale:start,offset:0},
          {translate:pos(tx,ty),scale:".94 1.08",offset:.7},
          {translate:pos(tx,ty),scale:"1",offset:1}
        ],{duration:moved?420:340,easing:"cubic-bezier(.22,.75,.2,1)",fill:"both"});
        await d.animation.finished;
      }catch{}
      if(trashDrag!==d)return;
      finishTrashDrag();if(open)render();
      if(moved&&open&&trashMotionEnabled()){
        const entry=Array.from(panel.querySelectorAll(".op-hub-space")).find(n=>n.dataset.workspaceId===id);
        try{entry?.animate([{scale:"1.035 .94"},{scale:".99 1.045"},{scale:"1"}],{duration:240,easing:"ease-out"});}catch{}
      }
    }
    function purgeEligible(tab){
      return hubTrashTabEligible(tab)&&!tab.pinned&&tab!==browser.selectedTab&&
        !["busy","soundplaying","soundplaying-scheduledremoval","sharing","pictureinpicture"].some(k=>tab.hasAttribute(k));
    }
    function setTrashAgeOpen(value,focus=false){
      ageMenu.hidden=!value;ageSelect.setAttribute("aria-expanded",String(value));
      if(value&&focus)ageChoices.get(trashAge)?.option.focus({preventScroll:true});
    }
    function selectTrashAge(value){
      if(!open||!trashOpen||ageSelect.disabled||!ageChoices.has(value))return;
      trashAge=value;ageLabel.textContent=ageChoices.get(value).short;
      for(const [key,{option}] of ageChoices)option.setAttribute("aria-pressed",String(key===value));
      purgePlan=null;setTrashAgeOpen(false);renderTrash();ageSelect.focus({preventScroll:true});
    }
    function askPurge(){
      if(busy||!canManage()||!singleWindow())return;
      setTrashAgeOpen(false);
      const age=trashAge,now=Date.now();
      purgePlan={age,tabs:trashTabs().filter(t=>purgeEligible(t)&&hubTrashAgeMatches(trashStamp(t),age,now))};renderTrash();
    }
    async function executePurge(){
      const approved=purgePlan;purgePlan=null;if(!approved)return;
      await operation(async()=>{
        const current=trashTabs();
        if(!singleWindow()||approved.tabs.some(t=>!current.includes(t)||!purgeEligible(t)||!hubTrashAgeMatches(trashStamp(t),approved.age,Date.now())))
          throw Error("Trash changed. Review again.");
        for(const tab of approved.tabs){
          if(!singleWindow()||!trashTabs().includes(tab)||!purgeEligible(tab))break;
          browser.removeTab(tab,{animate:false,closeWindowWithLastTab:false});
        }
      });
    }
    function trashTabUrl(tab){
      // Never load a remote favicon or navigate on behalf of this card.
      // The native tab may be lazy; its original URI is the display fallback.
      try{
        const current=tab.linkedBrowser?.currentURI?.spec;
        const value=(current&&current!=="about:blank"?current:tab._originalUrl||current)||"";
        if(typeof value!=="string")return "";
        try{const u=new URL(value);return ["http:","https:"].includes(u.protocol)?u.host+(u.pathname==="/"?"":u.pathname):u.protocol==="about:"?value:"";}catch{return "";}
      }catch{return "";}
    }
    function trashCard(item){
      const {tab,stamp}=item,row=make("div","op-hub-trash-item"),icon=make("span","op-hub-trash-site-icon");
      const image=tab.getAttribute("image");
      // Browser-owned favicon URI only; avoid new HTTP requests from chrome.
      if(image&&/^(?:data:image\/|moz-anno:|page-icon:|chrome:|resource:)/i.test(image)){
        const img=make("img","");img.alt="";img.draggable=false;img.src=image;img.addEventListener("error",()=>{img.remove();icon.textContent="◎";},{once:true});icon.append(img);
      }else icon.textContent="◎";
      const copy=make("span","op-hub-trash-copy"),title=make("span","op-hub-trash-site-title",tab.label||"Tab"),link=make("span","op-hub-trash-url",trashTabUrl(tab)||"No address");
      copy.append(title,link);
      const age=make("span","op-hub-trash-date",hubTrashRelativeAge(stamp,Date.now()));age._stamp=stamp;
      row.append(icon,copy,age);row.title=stamp?new Date(stamp).toLocaleString():"Unknown date";
      row.draggable=false;
      row.toggleAttribute("data-op-trash-draggable",trashAllowed&&hubTrashTabEligible(tab)&&tab!==browser.selectedTab);
      row.addEventListener("dragstart",event=>event.preventDefault());
      row.addEventListener("pointerdown",event=>beginTrashDrag(event,tab,row));
      return row;
    }
    function stopTrashUpdates(){
      if(trashAgeTimer)window.clearInterval(trashAgeTimer);trashAgeTimer=0;
      if(trashFrame)window.cancelAnimationFrame(trashFrame);trashFrame=0;
    }
    function updateTrashAges(){
      if(!open||!trashOpen||trashDrag)return;
      const now=Date.now();
      for(const age of trashRows.querySelectorAll(".op-hub-trash-date")){
        const value=hubTrashRelativeAge(age._stamp,now);if(age.textContent!==value)age.textContent=value;
      }
    }
    function scheduleTrashRows(){
      if(!open||!trashOpen||trashDrag||trashFrame)return;
      trashFrame=window.requestAnimationFrame(()=>{trashFrame=0;renderTrashRows();});
    }
    function renderTrashRows(){
      if(!open||!trashOpen||trashDrag)return;
      const range=hubTrashRange(trashData.length,trashList.scrollTop,trashList.clientHeight||270,TRASH_ROW_HEIGHT);
      const key=range.first+":"+range.end;if(key===trashRangeKey)return;trashRangeKey=key;
      const frag=document.createDocumentFragment();
      for(let i=range.first;i<range.end;i++)frag.append(trashCard(trashData[i]));
      trashRows.style.paddingTop=range.top+"px";trashRows.style.paddingBottom=range.bottom+"px";
      trashRows.replaceChildren(frag);
    }
    function renderTrash(){
      if(trashDrag)return;
      const tabs=trashTabs();
      trashCount.textContent=String(tabs.length);
      trashToggle.setAttribute("aria-expanded",String(trashOpen));
      trashToggle.setAttribute("aria-label",(trashOpen?"Collapse":"Expand")+" Trash ("+tabs.length+" tabs)");
      trashPanel.toggleAttribute("data-op-trash-open",trashOpen);trashDrawer.inert=!trashOpen;trashTools.inert=!trashOpen;
      if(!trashOpen)setTrashAgeOpen(false);
      if(!open||!trashOpen){stopTrashUpdates();return;}
      trashAllowed=!busy&&canManage()&&singleWindow();
      trashData=tabs.map(tab=>({tab,stamp:trashStamp(tab)})).sort((a,b)=>b.stamp-a.stamp);
      trashRangeKey="";trashConfirmation.replaceChildren();trashNotice.replaceChildren();
      if(!tabs.length)trashNotice.append(make("p","op-hub-confirm-text","Trash is empty."));
      else if(!trashAllowed)trashNotice.append(make("p","op-hub-confirm-text","Close other browser windows to restore or clear tabs."));
      trashList.hidden=!tabs.length;
      renderTrashRows();scheduleTrashRows();
      if(!trashAgeTimer)trashAgeTimer=window.setInterval(updateTrashAges,60000);
      clearTrash.disabled=!trashAllowed||!tabs.some(purgeEligible);ageSelect.disabled=!trashAllowed;
      if(ageSelect.disabled)setTrashAgeOpen(false);
      if(purgePlan){
        const n=purgePlan.tabs.length;
        trashConfirmation.append(make("p","op-hub-confirm-text",n?"Close "+n+" matching tab(s)? Native recently closed history may retain them.":"No eligible tabs match this age."));
        const controls=make("div","op-hub-confirm-controls");
        controls.append(action("Cancel",()=>{purgePlan=null;renderTrash();}));
        if(n)controls.append(action("Confirm clear",()=>void executePurge()));
        trashConfirmation.append(controls);
      }
    }
    // A projection is a native synced window, not a copy or adoption of tabs.
    function canProject(){
      return !!manager()?.currentWindowIsSyncing&&!!window.gZenWindowSync&&
        prefs.getBoolPref("zen.window-sync.enabled",true)&&!prefs.getBoolPref("zen.window-sync.sync-only-pinned-tabs",true);
    }
    function beginDrag(event,id,entry){
      if(!event.isTrusted||event.button!==0||!(event.buttons&1)||busy||projectionBusy||destroyed||!open||trashDrag)return;
      if(dragLifecycle.current())cancelActiveDrag("superseded");
      const token=dragLifecycle.begin("workspace",{pointerId:event.pointerId,onMove:moveDrag,onUp:endDrag,onCancel:()=>cleanupDrag()});
      if(token===null)return;
      drag={id,entry,token,pointer:event.pointerId,x:event.screenX,y:event.screenY,moved:false};
      try{entry.setPointerCapture(event.pointerId);}catch{dragLifecycle.cancel("capture-failed",token);}
    }
    function moveDrag(event){
      if(!drag||!dragLifecycle.owns(drag.token,"workspace")||event.pointerId!==drag.pointer)return;
      if(!(event.buttons&1)||!drag.entry.isConnected){cancelDrag();return;}
      if(!drag.moved&&Math.hypot(event.screenX-drag.x,event.screenY-drag.y)>=9){
        drag.moved=true;drag.entry.setAttribute("data-op-dragging","true");
        status.textContent="Drag outside the browser and release to open a synced window.";
      }
      if(drag.moved){
        event.preventDefault();
        const label=manager()?.getWorkspaceFromId(drag.id)?.name||"Workspace";
        showDragBadge(event,label);showPlacementPreview(event,label);
      }
    }
    function cleanupDrag(){
      const d=drag;drag=null;
      hideDragBadge();clearPlacementPreview(true);
      if(!d)return;
      d.entry.removeAttribute("data-op-dragging");
      if(d.moved){suppressClickUntil=window.performance.now()+400;status.textContent="";}
      try{if(d.entry.hasPointerCapture(d.pointer))d.entry.releasePointerCapture(d.pointer);}catch{}
    }
    function cancelDrag(){
      if(drag){const token=drag.token;if(!dragLifecycle.cancel("workspace-cancel",token))cleanupDrag();}
      else cleanupDrag();
    }
    function endDrag(event){
      if(!drag||event.pointerId!==drag.pointer||!dragLifecycle.owns(drag.token,"workspace"))return;
      const d=drag;
      if(!event.isTrusted||event.button!==0||!d.entry.isConnected){cancelDrag();return;}
      const outside=Number.isFinite(event.screenX)&&Number.isFinite(event.screenY)&&
        !(event.screenX===0&&event.screenY===0)&&!pointInSourceWindow(event);
      const point=placementAt(event,true);
      const external=outside||!!point;
      if(!dragLifecycle.finish(d.token))return;
      cleanupDrag();
      if(!d.moved)return;
      event.preventDefault();event.stopPropagation();
      // A genuine external release opens a native synced window. If the
      // screen coordinate contract cannot be verified, retain native placement.
      if(external){
        if(displaySnapEnabled()&&!point){status.textContent="Target monitor not verified. Try the drop again.";logPlacement("workspace-release-unverified",null);return;}
        void project(d.id,point);
      }else status.textContent="Release outside the browser, or use Open in another window.";
    }
    // A projection uses the native Zen empty tab, never a new visible
    // about:blank tab. Capture only the initial native startup identity.
    function projectionStartupCandidate(child){
      const spaces=child.gZenWorkspaces,b=child.gBrowser;
      const initial=spaces?._tabToRemoveForEmpty||spaces?._initialTab;
      if(initial&&b?.isTab(initial)&&!initial.hasAttribute("zen-empty-tab"))return initial;
      if(!child.gBrowserInit?.delayedStartupFinished&&b?.tabs?.length===1){
        const tab=b.tabs[0];
        if(tab&&!tab.hasAttribute("zen-empty-tab"))return tab;
      }
      return null;
    }
    function projectionLog(child,stage,extra={}){
      console.info("[OnePlane] Projection "+stage,JSON.stringify({
        ready:!!child?.gBrowserInit?.delayedStartupFinished,
        zenReady:!!child?.gZenStartup?.isReady,
        emptySelected:!!child?.gBrowser?.selectedTab?.hasAttribute("zen-empty-tab"),
        emptyAvailable:!!child?.gZenWorkspaces?._emptyTab,
        ...extra
      }));
    }
    // Zen's native selectEmptyTab can fall back to creating an ordinary
    // homepage tab. During this specific projection's startup, use its
    // existing transparent placeholder instead. Restore the exact original
    // method before normal user interaction; no profile preference changes.
    function installProjectionEmptyGuard(child,record,interacted){
      let owner=null,original=null,wrapped=null,own=false,stopped=false;
      function install(){
        if(stopped||interacted())return;
        const spaces=child.gZenWorkspaces;
        if(owner||!spaces||typeof spaces.selectEmptyTab!=="function")return;
        owner=spaces;original=spaces.selectEmptyTab;own=Object.hasOwn(spaces,"selectEmptyTab");
        wrapped=function(...args){
          if(this===owner&&!stopped&&!interacted()&&!args[0]){
            const empty=this._emptyTab;
            if(empty?.isConnected&&!empty.closing&&empty.hasAttribute("zen-empty-tab")&&child.gBrowser?.isTab(empty)){
              child.gBrowser.selectedTab=empty;
              projectionLog(child,"native-empty-selected");
              return empty;
            }
            // Capture only a tab actually created by this exact native call.
            const before=new Set(child.gBrowser?.tabs||[]);
            const result=original.apply(this,args);
            if(result&&!before.has(result)&&child.gBrowser?.isTab(result))record(result);
            return result;
          }
          return original.apply(this,args);
        };
        spaces.selectEmptyTab=wrapped;
        projectionLog(child,"startup-guard-installed");
      }
      function stop(){
        if(stopped)return;stopped=true;
        child.removeEventListener("DOMContentLoaded",install,true);
        child.removeEventListener("load",install,true);
        child.removeEventListener("AfterWorkspacesSessionRestore",stop,true);
        // Document unload does not mean the native window has closed.
        if(owner?.selectEmptyTab===wrapped){
          if(own)owner.selectEmptyTab=original;else delete owner.selectEmptyTab;
        }
      }
      child.addEventListener("DOMContentLoaded",install,true);
      child.addEventListener("load",install,true);
      child.addEventListener("AfterWorkspacesSessionRestore",stop,true);
      // The caller owns lifetime via domwindowclosed and bounded readiness.
      install();
      stop.probe=install;
      return stop;
    }
    function untouchedProjectionTab(tab,win){
      if(!tab||tab.closing||tab.pinned||tab.group||tab.hasAttribute("zen-essential")||
        tab.hasAttribute("zen-empty-tab")||tab.hasAttribute("split-view")||tab.hasAttribute("split-view-group")||
        tab.hasAttribute("busy")||tab.hasAttribute("soundplaying")||tab.hasAttribute("muted")||
        tab.linkedBrowser?.userTypedValue)return false;
      // A synced/lazy tab can expose about:blank while holding a real page
      // in SessionStore. Inspect the stored history as well, fail closed.
      try{
        const {SessionStore}=ChromeUtils.importESModule("moz-src:///browser/components/sessionstore/SessionStore.sys.mjs");
        const stored=JSON.parse(SessionStore.getTabState(tab));
        const empty=url=>url==="about:blank"||url==="about:newtab";
        const entries=stored.entries;
        if(!Array.isArray(entries)||entries.length>1||entries.some(entry=>!empty(entry.url))||
          stored.userTypedValue||stored.userTypedClear||stored.formdata)return false;
        const browser=tab.linkedBrowser;
        return !!browser&&empty(browser.currentURI?.spec)&&!browser.canGoBack&&!browser.canGoForward&&
          (!tab._originalUrl||empty(tab._originalUrl));
      }catch{return false;}
    }
    function prepareProjectionStart(child,id,startupTabs,preexistingIds,identifiable,interacted){
      if(interacted||child.closed||destroyed){projectionLog(child,"start-cancelled",{interacted});return false;}
      const manager=child.gZenWorkspaces,b=child.gBrowser,empty=manager?._emptyTab;
      // Do not use selectEmptyTab's fallback, which can create a real tab
      // when the native floating-new-tab mode is unavailable.
      if(manager?.activeWorkspace!==id||!empty?.isConnected||empty.closing||
        !empty.hasAttribute("zen-empty-tab")||!b?.isTab(empty)){projectionLog(child,"empty-unavailable");return false;}
      b.selectedTab=empty;
      if(b.selectedTab!==empty){projectionLog(child,"empty-selection-rejected");return false;}
      let removed=0;
      for(const startupTab of startupTabs)if(identifiable&&startupTab?.id&&!preexistingIds.has(startupTab.id)&&
        startupTab.isConnected&&startupTab!==empty&&b.isTab(startupTab)&&untouchedProjectionTab(startupTab,child)){
        // Verify all extant synced peers, not merely the opener. Never
        // delete a tab whose authoritative copy has been navigated.
        let safe=true;
        try{
          const wins=Services.wm.getEnumerator("navigator:browser");
          while(wins.hasMoreElements()){
            const win=wins.getNext();
            if(win===child||win.closed||win.gZenWindowSync!==child.gZenWindowSync||
              !win.gZenWorkspaces?.currentWindowIsSyncing)continue;
            const peer=win.gZenWindowSync.getItemFromWindow(win,startupTab.id);
            if(peer&&(!win.gBrowser?.isTab(peer)||!untouchedProjectionTab(peer,win))){safe=false;break;}
          }
        }catch{safe=false;}
        if(safe){b.removeTab(startupTab,{animate:false,skipSessionStore:true,closeWindowWithLastTab:false});removed++;}
      }
      projectionLog(child,"start-prepared",{candidates:startupTabs.size,removed,identifiable});
      return b.selectedTab===empty;
    }
    // A synced child can inherit an empty-page search session whose
    // zen-newtab attribute remains set even after native focus/rollup hides
    // its result view. Check the actual floating view, not just its flag.
    async function openProjectionSearch(child,id,interacted){
      const eligible=()=>!child.closed&&!window.closed&&!destroyed&&!interacted()&&
        child.gZenWorkspaces?.activeWorkspace===id&&
        child.gBrowser?.selectedTab?.hasAttribute("zen-empty-tab");
      const isVisible=bar=>!!bar?.hasAttribute("zen-newtab")&&
        !!(bar.view?.isOpen||bar.hasAttribute("open"));
      const wait=()=>new Promise(resolve=>window.setTimeout(resolve,100));
      if(!eligible())return false;
      child.focus();
      // Let the real window activation/size-mode change and native URL-bar
      // rollup settle. Never steal focus again or toggle an existing search.
      for(let attempt=0;attempt<4;attempt++){
        await wait();
        if(!eligible()){projectionLog(child,"search-cancelled",{attempt});return false;}
        const bar=child.gURLBar;
        const focused=child.document?.hasFocus?.()??true;
        if(isVisible(bar)&&focused){projectionLog(child,"search-visible",{attempt});return true;}
        if(!bar||!focused)continue;
        const session=bar.hasAttribute("zen-newtab");
        try{
          if(session){
            // Resume the already-owned native new-tab session, rather than
            // calling handleNewTab again or creating an ordinary tab.
            bar.search("");
            child.document.getElementById("Browser:OpenLocation")?.doCommand();
          }else child.gZenUIManager?.handleNewTab(false,false,"tab",true);
          projectionLog(child,"search-attempt",{attempt,resumed:session,viewOpen:isVisible(bar),focused});
        }catch(error){projectionLog(child,"search-error",{attempt,error:String(error)});}
      }
      await wait();
      const visible=eligible()&&isVisible(child.gURLBar)&&(child.document?.hasFocus?.()??true);
      projectionLog(child,"search-result",{visible:!!visible});
      return !!visible;
    }
    // A newly opened chrome WindowProxy survives its initial document
    // replacement. Never use DOM unload as a window-close notification.
    // Keep probes alive until Zen's workspace promise resolves, even when
    // the Gecko startup notification arrives before our listener.
    function waitForProjectionReady(child,onProbe){
      return new Promise((resolve,reject)=>{
        let finished=false,waiting=false,nativeReady=false,poll=0,timer=0;
        const cleanup=()=>{
          if(finished)return false;finished=true;
          if(poll)window.clearTimeout(poll);if(timer)window.clearTimeout(timer);
          try{Services.obs.removeObserver(startup,"browser-delayed-startup-finished");}catch{}
          try{Services.obs.removeObserver(closed,"domwindowclosed");}catch{}
          return true;
        };
        const fail=error=>{if(cleanup())reject(error);};
        const closed=subject=>{if(subject===child||subject===window)fail(Error("Native window closed"));};
        const startup=subject=>{if(subject===child){nativeReady=true;check();}};
        const check=()=>{
          if(finished)return;
          if(poll)window.clearTimeout(poll);poll=0;
          if(child.closed||window.closed||destroyed){fail(Error("Native window closed or OnePlane disabled"));return;}
          try{
            onProbe?.();
            nativeReady||=!!child.gBrowserInit?.delayedStartupFinished||!!child.gZenStartup?.isReady;
            const spaces=child.gZenWorkspaces;
            if(nativeReady&&spaces?.promiseInitialized&&!waiting){
              waiting=true;
              Promise.resolve(spaces.promiseInitialized).then(()=>{
                if(finished)return;
                if(child.closed||window.closed||destroyed){fail(Error("Native window closed"));return;}
                if(cleanup())resolve();
              },fail);
            }
          }catch(error){fail(error);return;}
          if(!finished)poll=window.setTimeout(check,100);
        };
        Services.obs.addObserver(startup,"browser-delayed-startup-finished");
        Services.obs.addObserver(closed,"domwindowclosed");
        timer=window.setTimeout(()=>fail(Error("Workspace startup timeout")),20000);
        check();
      });
    }
    async function project(id,display){
      if(projectionBusy||busy||destroyed)return;
      if(!canProject()){status.textContent="Enable native window sync for all tabs to use this feature.";return;}
      const native=manager();
      if(!native.getWorkspaceFromId(id))return;
      const preexistingIds=new Set();let identifiable=true;
      try{const wins=Services.wm.getEnumerator("navigator:browser");while(wins.hasMoreElements()){
        const win=wins.getNext();if(win.closed||win.gZenWindowSync!==window.gZenWindowSync||!win.gZenWorkspaces?.currentWindowIsSyncing)continue;
        const tabs=win.gZenWorkspaces.allStoredTabs;if(!Array.isArray(tabs)){identifiable=false;break;}
        for(const tab of tabs){if(tab.hasAttribute("zen-empty-tab"))continue;if(!tab.id)identifiable=false;else preexistingIds.add(tab.id);}
      }}catch{identifiable=false;}
      projectionBusy=true;status.textContent="Opening workspace…";render();
      let child=null,interacted=false,stopEmptyGuard=()=>{},captureStartup=null;
      const onInput=event=>{if(event.isTrusted){interacted=true;stopEmptyGuard();}};
      try{
        const {BrowserWindowTracker}=ChromeUtils.importESModule("resource:///modules/BrowserWindowTracker.sys.mjs");
        // Supply the final snap rectangle at native window creation,
        // before Zen can restore the opener monitor geometry.
        const seed=display?nativeStartupFeatures(display):null;
        if(display&&!seed){status.textContent="Target monitor changed. Try the drop again.";return;}
        const features=seed?Object.entries(seed).map(([k,v])=>k+"="+v).join(","):undefined;
        if(seed)logPlacement("workspace-open",display,null,seed);
        // Use the recognized native initial page, not a user navigation.
        const args=Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);args.data="about:blank";
        const options={openerWindow:window,private:false,zenSyncedWindow:!prefs.getBoolPref("zen.window-sync.prefer-unsynced-windows",false),args,features};
        child=BrowserWindowTracker.openWindow(options);
        if(!child)throw Error("Native window did not open");
        child[PROJECTION]={source:window,id};
        const placementTask=display?placeAfterStartup(child,display):Promise.resolve(true);
        child.addEventListener("pointerdown",onInput,true);child.addEventListener("keydown",onInput,true);
        const startupTabs=new Set();
        const record=tab=>{if(tab)startupTabs.add(tab);};
        captureStartup=()=>record(projectionStartupCandidate(child));
        captureStartup();child.addEventListener("DOMContentLoaded",captureStartup,true);child.addEventListener("load",captureStartup,true);
        stopEmptyGuard=installProjectionEmptyGuard(child,record,()=>interacted);
        projectionLog(child,"opened");
        await waitForProjectionReady(child,()=>{
          captureStartup();stopEmptyGuard.probe?.();
        });
        captureStartup();child.removeEventListener("DOMContentLoaded",captureStartup,true);child.removeEventListener("load",captureStartup,true);
        stopEmptyGuard();
        projectionLog(child,"spaces-ready",{candidates:startupTabs.size});
        if(child.closed||destroyed||!child.gZenWorkspaces?.currentWindowIsSyncing||
          child.gZenWindowSync!==window.gZenWindowSync||!child.gZenWorkspaces.getWorkspaceFromId(id))throw Error("Native sync unavailable");
        const alreadyActive=child.gZenWorkspaces.activeWorkspace===id;
        // The cloned window may already be on the requested workspace.
        // A redundant native switch is a no-op and can disturb focus.
        if(!alreadyActive)await child.gZenWorkspaces.changeWorkspaceWithID(id);
        if(child.gZenWorkspaces.activeWorkspace!==id)throw Error("Workspace not activated");
        projectionLog(child,"workspace-active",{alreadyActive,sourceActive:native.activeWorkspace===id});
        // Select Zen's transparent placeholder first, including when the
        // synthetic startup tab was the selected tab in this window.
        const showStart=prepareProjectionStart(child,id,startupTabs,preexistingIds,identifiable,interacted);
        // Keep empty-tab selection independent of placement. Open the
        // floating search AFTER window placement settles, because native
        // activation/maximize may otherwise dismiss it on the same space.
        const placed=await placementTask;
        const searchVisible=showStart&&await openProjectionSearch(child,id,()=>interacted);
        projectionLog(child,"projection-complete",{placed,searchVisible:!!searchVisible,alreadyActive});
        status.textContent=placed?"":"Window opened; placement could not be verified.";
      }catch(error){
        if(child&&!child.closed)delete child[PROJECTION];
        if(!destroyed)status.textContent="Could not open synced workspace. Check window sync settings.";
        projectionLog(child,"failed",{error:String(error)});
        console.warn("[OnePlane] Workspace projection:",error);
      }finally{stopEmptyGuard();if(child&&!child.closed){if(captureStartup){child.removeEventListener("DOMContentLoaded",captureStartup,true);child.removeEventListener("load",captureStartup,true);}child.removeEventListener("pointerdown",onInput,true);child.removeEventListener("keydown",onInput,true);}projectionBusy=false;if(!destroyed&&open)render();}
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
      try{switchGuard();const transition=window.__zenRefinedWorkspaceTransition;
        const change=()=>native.changeWorkspaceWithID(id);
        await (typeof transition?.run==="function"?transition.run(change):change());
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
      status.textContent="";contextId=null;confirmation=null;open=true;hubSession++;trashOpen=false;
      // A fast reopen can interrupt the closing animation while the old drawer is visible.
      const resetVisibleTrash=!panel.hidden&&trashPanel.hasAttribute("data-op-trash-open");
      if(resetVisibleTrash)trashPanel.setAttribute("data-op-trash-reset","");
      button.setAttribute("aria-expanded","true");setHold(true);
      try{render();}finally{
        if(resetVisibleTrash){trashPanel.getBoundingClientRect();trashPanel.removeAttribute("data-op-trash-reset");}
      }
      try{
        if(!showPopup()){close();return;}
        (panel.querySelector('.op-hub-space[aria-current="true"]:not(:disabled)')||panel.querySelector(".op-hub-space:not(:disabled)")||mode).focus({preventScroll:true});
      }catch(error){close();console.warn("[OnePlane] Hub open:",error);}
    }
    function key(event){
      if(!open||event.key!=="Escape")return;
      event.preventDefault();event.stopPropagation();
      if(!ageMenu.hidden){setTrashAgeOpen(false);ageSelect.focus({preventScroll:true});return;}
      if(trashDrag){cancelTrashDrag();return;}if(drag){cancelDrag();return;}if(confirmation){confirmation=null;render();return;}if(contextId){contextId=null;render();return;}close(true);
    }
    function changed(){if(open){if(drag&&!manager()?.getWorkspaceFromId(drag.id))cancelDrag();if(!drag&&!trashDrag&&!editId)render();scheduleHubGeometry();}}
    function onMode(){if(!supported())close(false,true);else if(open){setHold(true);changed();}}
    function deactivate(){if(drag)cancelDrag();if(trashDrag){finishTrashDrag();renderTrash();}if(open&&!busy&&!projectionBusy)close();}
    function toggleMode(){
      const cmd=command();if(typeof cmd?.doCommand!=="function"||!open)return;
      setHold(true);
      try{cmd.doCommand();changed();}catch(error){console.warn("[OnePlane] Compact Mode:",error);}
    }
    function onInput(){add.disabled=busy||!name.value.trim();}
    function onOutside(event){
      if(!open)return;const path=event.composedPath();
      if(!path.includes(panel)&&!path.includes(button)){close();return;}
      if(!ageMenu.hidden&&!path.includes(ageMenu)&&!path.includes(ageSelect))setTrashAgeOpen(false);
    }
    function stopDrag(event){event.stopPropagation();}
    function stopDouble(event){event.preventDefault();event.stopImmediatePropagation();}
    const listeners=[[button,"click",toggle],[button,"pointerdown",stopDrag],[button,"mousedown",stopDrag],[button,"dblclick",stopDouble],
      [panel,"keydown",key],[form,"submit",create],[mode,"click",toggleMode],[returnButton,"click",()=>void returnProjection()],[window,"deactivate",deactivate],[name,"input",onInput],[window,"resize",scheduleHubGeometry]];
    window.addEventListener("pointerdown",onOutside,true);
    for(const event of ["ZenWorkspaceDataChanged","ZenWorkspacesUIUpdate","ZenCompactMode:Toggled","ZenCompactMode:LayoutUpdate"])listeners.push([window,event,changed]);
    for(const [node,event,fn] of listeners)node.addEventListener(event,fn);
    function destroy(){if(destroyed)return;destroyed=true;close(false,true);hideDragBadge(true);clearPlacementPreview(true);window.removeEventListener("pointerdown",onOutside,true);for(const [node,event,fn] of listeners)node.removeEventListener(event,fn);panel.remove();button.remove();}
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
    if(dead||!toolbarWrapper||!hoverSupported()||root.hasAttribute("data-op-bookmark-wave")||root.hasAttribute("data-zr-workspace-phase"))return;
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
    const compactRows=row.hasAttribute("data-op-overflow-row");
    const base=Math.max(1,Math.round(Math.max(nav.bottom,row.getBoundingClientRect().bottom)-wrapper.top-shiftY-(compactRows?0:5)));
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
    if(now<contourUntil && hoverSupported()&&!root.hasAttribute("data-op-bookmark-wave")&&!root.hasAttribute("data-zr-workspace-phase"))contourFrame=window.requestAnimationFrame(stepContour);
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
  const adaptiveGeometryPrefs={observe(){schedule();scheduleGeometry();}};
  // The plus follows the occupied right lane, not the symmetric row's
  // far edge. Keep the existing expansion reserve in Expand mode.
  function rightPlusOffset(widths, expansion=0){
    return 3+widths.reduce((sum,w)=>sum+Math.max(0,w)+3,0)+Math.max(0,expansion);
  }
  function centerToolbar(){
    if(centering||!hoverSupported()||!toolbarWrapper)return;
    centering=true;
    try {
      const targetRect = target.getBoundingClientRect();
      // Center the collapsed tabs against the WINDOW, not the remaining toolbar.
      // Native window buttons and all left/right controls consume edge space.
      let left = Math.max(0, targetRect.left);
      let right = Math.max(0, window.innerWidth - targetRect.right);
      let addressExtent=0;
      for (const child of target.children) {
        if (centerIds.has(child.id) || child.localName === "toolbarspring") continue;
        const box = child.getBoundingClientRect();
        if (!box.width) continue;
        const style = window.getComputedStyle(child);
        const extent = box.width + (parseFloat(style.marginLeft) || 0) + (parseFloat(style.marginRight) || 0);
        if(child===url){addressExtent=extent;continue;}
        if (leftIds.has(child.id)) left += extent;
        else right += extent;
      }
      const setLength = (node, name, value) => {
        const next = Math.max(0, Math.round(value)) + "px";
        if (node.style.getPropertyValue(name) !== next) node.style.setProperty(name, next);
      };
      const rowWidth = row.getBoundingClientRect().width;
      const style=window.getComputedStyle(row);
      const tabWidth=parseFloat(style.getPropertyValue("--op-tab"))||36;
      const openWidth=parseFloat(style.getPropertyValue("--op-tab-open"))||180;
      const dragRoom=parseFloat(style.getPropertyValue("--op-window-drag-room"))||4;
      const wantsIsland=row.hasAttribute("data-op-show-island");
      const iconHome=row.hasAttribute("data-op-home-icon");
      const frozen=row.hasAttribute("data-op-dragging")||row.hasAttribute("data-op-island-incoming")||row.hasAttribute("data-op-lane-drag")||cascadeState==="hiding"||cascadeState==="showing";
      // Use the very same collapsed geometry for address budgeting and
      // the final partition; painted hover widths never enter the plan.
      const widths=stripOrderSnapshot.map(n=>compactSlotWidth(n,tabWidth));
      const groups=stripOrderSnapshot.map(n=>n.classList.contains("oneplane-split-group"));
      const boundary=islandBoundary(widths,tabWidth+3);
      const returnReserve=row.hasAttribute("data-op-adaptive-compact")?12:0;
      const availableAt=leftEdge=>Math.max(0,2*Math.min(window.innerWidth/2-leftEdge,window.innerWidth/2-right)-4-2*dragRoom);
      const planAt=available=>{
        const title=iconHome?32:Math.max(100,Math.min(180,available-2*(tabWidth+9)));
        return planAdaptiveTabRows(widths,groups,boundary,available,title,tabWidth,3,returnReserve);
      };
      if(!frozen){
        const preferred=prefs.getIntPref("zen.oneplane.address-width",180);
        const natural=stripOrderSnapshot.reduce((n,node)=>n+compactSlotWidth(node,tabWidth)+3,0)+(iconHome?32:180)+tabWidth+18;
        const fullBudget=2*Math.min(window.innerWidth/2-left-preferred-8,window.innerWidth/2-right)-8-2*dragRoom;
        const compactAddress=window.innerWidth<900||(fullBudget<natural&&left+preferred+8>=right);
        // Budget for up to two collapsed cards on each side of Home.
        const pairReserve=16+3+2*tabWidth+3+2+dragRoom+4;
        const singleReserve=16+3+tabWidth+2+dragRoom+4;
        const canFit=reserve=>window.innerWidth/2-right>=reserve&&window.innerWidth/2-left-36-8>=reserve;
        const reserve=compactAddress?(canFit(pairReserve)?pairReserve:canFit(singleReserve)?singleReserve:16+dragRoom+4):16+dragRoom+4;
        const baseline=adaptiveAddressWidth(preferred,window.innerWidth,left,reserve,8,compactAddress);
        const addressHidden=url.hasAttribute("data-op-empty")||url.hasAttribute("data-op-home");
        const urlStyle=window.getComputedStyle(url);
        const addressMargins=(parseFloat(urlStyle.marginLeft)||0)+(parseFloat(urlStyle.marginRight)||0);
        // Only reclaim actual spare width, including native margins and
        // drag-room. Do not move Home, remove upper tabs or change rows.
        const desired=wantsIsland&&!addressHidden?
          reclaimAddressWidth(preferred,baseline,w=>planAt(availableAt(left+w+addressMargins))):baseline;
        url.toggleAttribute("data-op-address-icon",desired<80);
        if(url.style.getPropertyValue("--op-url")!==desired+"px"){
          setLength(url,"--op-url",desired);
          addressCompactWidth=0;addressAnchor=null;alignAddressStart();
        }
        addressExtent=url.hasAttribute("data-op-empty")||url.hasAttribute("data-op-home")?0:
          url.getBoundingClientRect().width+(parseFloat(window.getComputedStyle(url).marginLeft)||0)+(parseFloat(window.getComputedStyle(url).marginRight)||0);
      }
      left+=addressExtent;
      const naturalTabsWidth=stripOrderSnapshot.reduce((n,node)=>n+compactSlotWidth(node,tabWidth)+3,0);
      const collapsedTabsWidth=Math.min(naturalTabsWidth,Math.max(0,rowWidth-tabWidth-3));
      const trailingReserve=Math.max(0,rowWidth-collapsedTabsWidth);
      const available=availableAt(left);
      const centered=wantsIsland;
      if(centered&&!frozen){
        row.removeAttribute("data-op-island-tight");
        const layout=planAt(available);
        applyStripPartition(layout);
        row.toggleAttribute("data-op-island-compact",!iconHome&&layout.title===32);
        const widthOf=indices=>indices.reduce((n,i)=>n+widths[i]+3,6);
        const expandReserve=iconHome&&layout.mode==="wide"?Math.max(0,openWidth-tabWidth):0;
        const half=Math.max(widthOf(layout.topLeft),widthOf(layout.topRight)+(layout.topPlus?tabWidth+3:0),tabWidth+9)+expandReserve;
        const topWidth=layout.mode==="wide"?Math.min(available,layout.title+6+2*half):Math.max(layout.title+6,available);
        const bottomBudget=Math.max(tabWidth+6,window.innerWidth-24);
        const lowerNatural=widthOf(layout.lower)+2*(tabWidth+3)+(iconHome?Math.max(0,openWidth-tabWidth):0);
        const bottomWidth=Math.min(bottomBudget,Math.max(3*tabWidth+12,lowerNatural));
        setLength(row,"--op-island-width",layout.title);
        setLength(row,"--op-island-row-width",Math.max(layout.title+6,topWidth));
        setLength(row,"--op-right-plus-offset",rightPlusOffset(layout.topRight.map(i=>widths[i]),expandReserve));
        setLength(row,"--op-overflow-width",bottomWidth);
        setLength(row,"--op-bottom-open",Math.max(tabWidth,Math.min(openWidth,bottomWidth-2*(tabWidth+3)-6)));
      }else if(!centered)row.style.removeProperty("--op-right-plus-offset");
      const bias=toolbarCenterBias(left,right,trailingReserve,centered);
      setLength(leftSpacer,"--op-center-bias",bias.left);
      setLength(rightSpacer,"--op-center-bias",bias.right);
      if(centered&&!frozen){
        const rect=row.getBoundingClientRect(),previous=parseFloat(row.style.getPropertyValue("--op-center-correction"))||0;
        const correction=centeredRowCorrection(window.innerWidth,left,right,rect.left+rect.width/2-previous,rect.width);
        if(previous!==correction)row.style.setProperty("--op-center-correction",correction+"px");
      }else if(!centered)row.style.removeProperty("--op-center-correction");
      // Cap leftward expansion at actual free space next to navigation.
      setLength(row, "--op-left-room", leftSpacer.getBoundingClientRect().width - 4);
      syncLaneScroll();
      refreshOverflowSlider();
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
      if(!adaptiveHeightDirty&&toolbarWrapper.style.getPropertyValue("--op-measured-toolbar-height") &&
         window.performance.now()<panelSwitchUntil)return;
      adaptiveHeightDirty=false;
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
  const PANEL_HOLD_FLAGS=["oneplane-url-hold","oneplane-drag-hold","oneplane-startup-hold","oneplane-hub-hold","oneplane-tab-menu-hold","oneplane-home-hold","oneplane-workspace-hold"];
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
      else clearTabHover(true);
    }
    if(state.wait>0)panelTimer=window.setTimeout(reconcilePanel,Math.ceil(state.wait)+1);
  }
  function onWorkspaceMotion(){
    const active=root.hasAttribute("data-zr-workspace-phase");
    toolbarWrapper?.toggleAttribute("oneplane-workspace-hold",active);
    reconcilePanel();
    if(!active){scheduleGeometry();scheduleContour();}
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
      root.getAttribute("inFullscreen")!=="true" && !root.hasAttribute("popup-window");
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
  // Native maximize/restore and monitor DPI changes can resize the
  // toolbar without a new pointer movement. Reconcile the current layout
  // and stale visual state, never synthesize a window move.
  function onWindowGeometryChanged(){
    if(dead)return;
    if(!row.hasAttribute("data-op-dragging")&&hoverTab)clearTabHover();
    if(addressTransition){
      const closing=addressTransition.name==="closing-wave";clearAddressAnimation();
      if(closing)finishDismissUrl();
    }
    if(cascadeState==="hiding"||cascadeState==="showing"||!nativeInlineOpen(addressBar())&&cascadeState!=="idle"){
      resetTabCascade();
      if(nativeInlineOpen(addressBar())){row.inert=true;settleHidden(++cascadeGeneration);}
    }
    movePageActions();
    centerToolbar();
    onCompactChanged();
    schedule();
    window.requestAnimationFrame(revealSelectedInStrip);
  }
  function onCompactChanged() {
    hub.onMode();
    if(!hoverSupported()){cancelActiveDrag("unsupported-layout");closeNativeTabMenu();}
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
  let dragHandled = false,dragDetachedOnce=false;
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
    if(useLaneDrop()){
      const tab=readDraggedTab(event),owner=tabOwner(tab),group=owner?.[DRAG_CONTROLLER]?.group();
      const source=owner===window?(group?splitEntries.get(group)?.box:entries.get(tab)?.item):null;
      return laneDropTarget(laneAtPoint({x:event.clientX,y:event.clientY}),event.clientX,isStripNode(source)?source:null);
    }
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
    clearLaneDrag();
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
      dragDetachedOnce=true;
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
  // Use painted lane rectangles, not offscreen native-order slots.
  function useLaneDrop(){
    return row.hasAttribute("data-op-overflow-row")||row.hasAttribute("data-op-lane-drag")||
      (hasCenteredIsland()?[leftLane,rightLane]:[list]).some(l=>l.clientWidth>0&&l.scrollWidth>l.clientWidth+1);
  }
  function laneAtPoint(point){
    const lanes=hasCenteredIsland()?[leftLane,rightLane,...(bottomLane.hidden?[]:[bottomLane])]:[list];
    return lanes.find(lane=>{
      const b=lane.getBoundingClientRect();
      return b.width>0&&b.height>0&&point.y>=b.top&&point.y<b.bottom&&point.x>=b.left-5&&point.x<=b.right+5;
    })||null;
  }
  function laneDropTarget(lane,x,source=null){
    if(!lane)return null;
    const clip=lane.getBoundingClientRect(),nodes=laneNodes(lane).filter(n=>n!==source);
    const slots=nodes.map(node=>({node,rect:node.getBoundingClientRect()}));
    const picked=visibleLaneDropIndex(slots.map(s=>({left:s.rect.left,right:s.rect.right})),clip.left,clip.right,x);
    if(picked)return {...nativeSlot(slots[picked.index].node),before:picked.before};
    if(!nodes.length){
      const all=stripNodes().filter(n=>n!==source);
      if(!all.length)return null;
      const tabWidth=parseFloat(window.getComputedStyle(row).getPropertyValue("--op-tab"))||36;
      const boundary=islandBoundary(all.map(n=>compactSlotWidth(n,tabWidth)),tabWidth+3);
      if(lane===leftLane&&all[boundary])return {...nativeSlot(all[boundary]),before:true};
      if(lane===rightLane&&all[boundary-1])return {...nativeSlot(all[boundary-1]),before:false};
      return {...nativeSlot(all.at(-1)),before:false};
    }
    return null;
  }
  let laneDragFrame=0,laneDragPoint=null,laneDragSource=null,laneDragViewport=null,laneDragLast=0;
  function stopLaneAutoscroll(){
    if(laneDragFrame)window.cancelAnimationFrame(laneDragFrame);
    laneDragFrame=0;laneDragPoint=null;laneDragSource=null;laneDragViewport=null;laneDragLast=0;
  }
  function paintLaneDrop(dest){
    clearDropMarker();
    if(dest?.native){dropMarker=dest.element;dropMarker.setAttribute(dest.before?"data-op-drop-before":"data-op-drop-after","true");}
    liveDragTarget=dest;
  }
  function laneAutoStep(now){
    laneDragFrame=0;
    const lane=laneDragViewport,point=laneDragPoint;
    if(dead||!lane||!point||!row.hasAttribute("data-op-lane-drag"))return;
    const clip=lane.getBoundingClientRect(),edge=Math.min(42,clip.width/3);
    const velocity=laneScrollVelocity(point.x,clip.left,clip.right,edge);
    const dt=laneDragLast?Math.min(32,now-laneDragLast):16;laneDragLast=now;
    if(!velocity)return;
    const before=lane.scrollLeft;
    lane.scrollLeft+=velocity*dt/16;
    if(Math.abs(lane.scrollLeft-before)>.1){
      paintLaneDrop(laneDropTarget(lane,point.x,laneDragSource));
      laneDragFrame=window.requestAnimationFrame(laneAutoStep);
    }
  }
  function clearLaneDrag(){
    stopLaneAutoscroll();
    const active=row.hasAttribute("data-op-lane-drag");
    row.removeAttribute("data-op-lane-drag");
    if(active&&!dead)scheduleGeometry();
    dragNode?.removeAttribute("data-op-lane-ghost");
    if(active&&dragImageMode==="inline")hideGhost();
  }
  function showLaneGhost(event,pull=0){
    if(!dragNode)return;
    makeDragGhost();
    if(!dragGhost||!dragGhostBody)return;
    dragNode.setAttribute("data-op-lane-ghost","true");
    dragGhost.hidden=false;
    positionGhost(event.clientX,event.clientY);
    dragGhostBody.style.transform=pull?"scale("+Math.max(.12,1-.8*pull)+")":"";
  }
  function previewLaneDrag(event,tab,entry){
    if(dragShifted.size||row.hasAttribute("data-op-live-drag"))clearLiveDrag();
    row.setAttribute("data-op-lane-drag","true");
    const local=tabOwner(tab)===window,source=local&&isStripNode(entry)?entry:null;
    const lane=laneAtPoint({x:event.clientX,y:event.clientY});
    const dest=laneDropTarget(lane,event.clientX,source);
    paintLaneDrop(dest);
    if(local&&entry===dragNode&&dragImageMode==="inline")showLaneGhost(event);
    if(lane&&lane.scrollWidth>lane.clientWidth+1){
      laneDragViewport=lane;laneDragPoint={x:event.clientX,y:event.clientY};laneDragSource=source;
      const b=lane.getBoundingClientRect();
      if(!laneDragFrame&&laneScrollVelocity(event.clientX,b.left,b.right,Math.min(42,b.width/3))){laneDragLast=0;laneDragFrame=window.requestAnimationFrame(laneAutoStep);}
    }else stopLaneAutoscroll();
    return dest;
  }
  function previewStripDrag(event, tab) {
    const owner = tabOwner(tab);
    const group = owner?.[DRAG_CONTROLLER]?.group();
    const entry = group ? splitEntries.get(group)?.box : entries.get(tab)?.item;
    if(useLaneDrop())return previewLaneDrag(event,tab,entry);
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
    stopLaneAutoscroll();
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
  function toolbarDragReturnZone(event){
    if(!toolbarWrapper)return false;
    const rect=toolbarWrapper.getBoundingClientRect();
    const measured=parseFloat(toolbarWrapper.style.getPropertyValue("--op-measured-toolbar-height"))||0;
    const navHeight=navbar?.getBoundingClientRect().height||0;
    // Reserve the actual expanded toolbar even while its compact height
    // is still animating. Do not include the decorative fade.
    const stripBottom=row.getBoundingClientRect().bottom;
    return tabReturnZone(event.clientX,event.clientY,rect,Math.max(rect.height,measured,navHeight,stripBottom-rect.top,36)+4);
  }
  function holdToolbarForReturn(){
    toolbarWrapper.setAttribute("oneplane-drag-hold","true");
    reconcilePanel();
    if(dragRevealTimer)window.clearTimeout(dragRevealTimer);
    dragRevealTimer=window.setTimeout(releaseDragReveal,500);
    splitZone.removeAttribute("data-op-side");
  }
  function revealForDrag(event) {
    const tab = readDraggedTab(event);
    if (!hoverSupported() || !tab || !toolbarWrapper) return;
    const within = toolbarDragReturnZone(event);
    if(within)holdToolbarForReturn();
    if(tabOwner(tab)===window)clearPlacementPreview();
    else tabOwner(tab)?.[DRAG_CONTROLLER]?.preview?.(event);
    const local = tabOwner(tab) === window;
    if(local&&dragDetachedOnce&&within){
      // A carried tab returning to its own toolbar is a cancellation,
      // not a top-edge split or a reorder. Leave native tab order intact.
      event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect="move";
      clearLiveDrag();clearDropMarker();
      if(dragImageMode==="content")positionGhost(event.clientX,event.clientY);
      return;
    }
    if (local && dragNode) {
      dragLastPoint = {x:event.clientX,y:event.clientY};
      if (within && dragImageMode !== "content" && dragImageMode !== "outside")
        dragEdge = Math.max(toolbarWrapper.getBoundingClientRect().bottom,row.getBoundingClientRect().bottom,navbar?.getBoundingClientRect().bottom||0);
      const p = within?0:Math.max(0,Math.min(1,(event.clientY-dragEdge)/PULL_DISTANCE));
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
        if(useLaneDrop()){
          clearLiveDrag();clearDropMarker();setPull(p);row.setAttribute("data-op-lane-drag","true");showLaneGhost(event,p);
          return;
        }
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
    const tab=readDraggedTab(event);
    if(!tab||!toolbarDragReturnZone(event))return;
    if(tabOwner(tab)===window&&dragDetachedOnce){
      event.preventDefault();event.stopImmediatePropagation();sourceHandled(tab);schedule();return;
    }
    onStripDrop(event);
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
    dragNode?.removeAttribute("data-op-lane-ghost");
    dragNode?.removeAttribute("data-op-detached");
    dragNode?.removeAttribute("data-op-drag-follow");
    dragNode?.removeAttribute("data-op-pulling");
    for (const name of ["--op-pull-width","--op-pull-y","--op-pull-scale-y","--op-pull-scale-x","--op-pull-gap"])
      dragNode?.style.removeProperty(name);
    hideGhost();
    dragGhost?.remove(); dragGhost = null; dragGhostBody = null;
    dragPull = 0; dragLastPoint = null; dragReentry = false;dragDetachedOnce=false;
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
    cancelOverflowMotion();
    if(dragLifecycle.current())cancelActiveDrag("superseded");
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
    if(!startNativeDragLifecycle(event,tab)){event.preventDefault();return;}
    dragSearch = pointerSearch?.tab === browser.selectedTab ? pointerSearch : readStartupSearch();
    pointerSearch = null;
    groupPullLayout = null;
    draggedTab = tab;
    draggedGroup = group;
    dragHandled = false;dragDetachedOnce=false;
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
      cancelActiveDrag("native-start-failed");
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
    if(!dest?.native){
      if(owner===window)source?.markHandled();
      clearLiveDrag();clearDropMarker();return;
    }
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
    if(toolbarDragReturnZone(event))return "";
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
    if(toolbarDragReturnZone(event)){splitZone.removeAttribute("data-op-side");return;}
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
    if(toolbarDragReturnZone(event)){sourceHandled(tab);schedule();return;}
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
    // Ignore late or duplicate dragend after cancel/handled drop.
    const placement=placementAt(event,true);
    const returned=!placement&&pointInSourceWindow(event)&&dragDetachedOnce&&toolbarDragReturnZone(event);
    if(!finishNativeDragLifecycle(event,tab))return;
    const handled = dragHandled;
    const wasGroup = Boolean(draggedGroup);
    const start = dragStartPoint;
    draggedTab = null; draggedGroup = null; dragHandled = false; dragStartPoint = null;
    endDragVisual();
    if (returned || wasGroup || !start || handled || dt?.mozUserCancelled || dt?.dropEffect !== "none" ||
        !validNativeTab(tab) || tabOwner(tab) !== window) return;
    // A cancelled drag or a drop within this window must never create
    // another window. screenX/Y are browser-chrome desktop CSS coordinates.
    const x = event.screenX, y = event.screenY;
    if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0) ||
        Math.hypot(x-start.x,y-start.y) < 12) return;
    const inside=!placement&&pointInSourceWindow(event);
    if (inside) {
      if(!toolbarContainsPoint(event.clientX,event.clientY)&&emptySplitTarget(browser.selectedTab))browser.selectedTab=tab;
      return;
    }
    try {
      // Native session adoption preserves the live browser, history, audio
      // and private-window state. Zen chooses its native window-sync mode.
      const p=placement;
      const seed=p?nativeStartupFeatures(p):null;
      if(displaySnapEnabled()&&!seed){logPlacement("tab-release-unverified",p);return;}
      if (isSplit(tab) && !unsplitTab(tab)) return;
      if(seed)logPlacement("tab-open",p,null,seed);
      const win=browser.replaceTabWithWindow(tab,{replaceLastTab:true,...(seed||{})});
      if(win&&p)placeAfterStartup(win,p);
    } catch (error) { console.error("[OnePlane] Detach tab:", error); }
  }
  const dragController = {
    source: () => draggedTab,
    group: () => draggedGroup,
    outside: event => setDragImageMode("outside",event),
    preview: event => {if(draggedTab&&!draggedGroup)showPlacementPreview(event,"Tab");},
    clearIncoming: () => {
      if(draggedTab||dead)return;
      clearLiveDrag();clearDropMarker();releaseDragReveal();refreshIndicator();
    },
    markHandled: () => {
      if(!finishNativeDragLifecycle())return;
      dragHandled = true;
      endDragVisual();
      draggedTab = null;
      draggedGroup = null;
      dragStartPoint=null;
    }
  };
  window[DRAG_CONTROLLER] = dragController;

  // Single hover target; preserve momentum across tabs and short gaps.
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
  let hoverTab = null, hoverX = null, hoverTimer = 0, indicatorFrame = 0;
  let lastHoverPointer = null, indicatorHover = null, indicatorReturnTimer = 0;
  const INDICATOR_RETURN_DELAY = 2000;
  function cancelIndicatorReturn(){
    if(indicatorReturnTimer)window.clearTimeout(indicatorReturnTimer);
    indicatorReturnTimer=0;
  }
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
    if(s.width<=0||s.height<=0||row.hasAttribute("data-op-lane-drag")||row.hasAttribute("data-op-overflow-row"))return null;
    const dragging=Boolean(dragNode && row.hasAttribute("data-op-dragging"));
    const homeOpen=row.hasAttribute("data-op-home-open");
    const item=dragging?dragNode:indicatorHover && list.contains(indicatorHover)?
      indicatorHover:homeOpen?null:entries.get(browser.selectedTab)?.item;
    if(!item||!list.contains(item)||item.hasAttribute("data-op-detached")||
        item.closest(".oneplane-split-group[data-op-detached]"))return null;
    if(dragging && (dragImageMode!=="inline" || dragPull>=.62))return null;
    // For a shrinking group use the visible ghost rather than its
    // invisible layout placeholder when determining vertical clearance.
    const visual=dragging && dragPull>0 && draggedGroup && dragGhost &&
      !dragGhost.hidden && dragGhostBody ? dragGhostBody : item;
    let a=visual.getBoundingClientRect(),center=(a.left+a.right)/2;
    if(a.width<=0)return null;
    // A scrolled-off card must not paint its underline over Home or controls.
    if(!dragging){
      const lane=item.closest(".oneplane-island-lane")||list;
      const clip=lane.getBoundingClientRect();
      if(clip.width>0&&(center<clip.left+3||center>clip.right-3))return null;
    }
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
  // OnePlane-only trigger and Compact Mode adapter; core is host-neutral.
  let homeLease=null, homeUnsubscribe=null, homeIdleTimer=0, homeIdle=false, homeTitleKey=null, homeNativeTitle="";
  function clearHomeIdle(){if(homeIdleTimer)window.clearTimeout(homeIdleTimer);homeIdleTimer=0;}
  function markHomeTitleActivity(){
    clearHomeIdle();homeIdle=false;if(!homeLease||homeLease.open)return;
    homeIdleTimer=window.setTimeout(()=>{homeIdleTimer=0;homeIdle=true;refreshIslandTitle();},5000);
  }
  function mountHome(){
    try{homeLease=acquireZenHome(window,Services);}catch(error){console.warn("[OnePlane] Home unavailable",error);}
    island.toggleAttribute("data-op-home-enabled",!!homeLease);island.disabled=!homeLease;
    if(!homeLease)return;
    homeUnsubscribe=homeLease.subscribe(open=>{
      row.toggleAttribute("data-op-home-open",open);island.setAttribute("aria-expanded",String(open));
      url.toggleAttribute("data-op-home",open);
      toolbarWrapper?.toggleAttribute("oneplane-home-hold",open);
      // Update the mirror and geometry without changing native tab selection.
      if(open){clearTabHover();hideIndicator();}
      centerToolbar();schedule();scheduleGeometry();refreshIndicator();
      if(open){clearHomeIdle();homeIdle=true;}else markHomeTitleActivity();
      refreshIslandTitle();reconcilePanel();
    });
    island.addEventListener("click",onHomeTrigger);island.addEventListener("dblclick",stopHomeDoubleClick);island.addEventListener("pointerdown",stopHomePointer);
    window.addEventListener("OnePlane:StartupState",onHomeStartup);
  }
  async function onHomeStartup(){
    if(root.getAttribute("data-op-startup-ready")!=="true")return;
    window.removeEventListener("OnePlane:StartupState",onHomeStartup);
    if(dead||disposed||reloadingLayout||window.__oneplaneWorkspaceProjection||!hoverSupported())return;
    // URL bar blur records an engagement using the native default engine.
    const selected=browser.selectedTab;
    try{if(Services.search&&!Services.search.isInitialized)await Services.search.init();}
    catch(error){window.console.warn("[OnePlane] Startup search initialization:",error);return;}
    if(dead||disposed||window.closed||!hoverSupported()||browser.selectedTab!==selected)return;
    // Both hosts use one window startup claim, not independent auto-open timers.
    homeLease?.showOnStartup?.();
  }
  function stopHomeDoubleClick(e){e.preventDefault();e.stopPropagation();}
  function stopHomePointer(e){e.stopPropagation();}
  function onHomeTrigger(e){
    e.stopPropagation();
    if(!hoverSupported()||cascadeState!=="idle"||row.hasAttribute("data-op-dragging"))return;
    homeLease?.show();
  }
  function destroyHome(){
    clearHomeIdle();homeUnsubscribe?.();homeUnsubscribe=null;
    window.removeEventListener("OnePlane:StartupState",onHomeStartup);
    island.removeEventListener("click",onHomeTrigger);island.removeEventListener("dblclick",stopHomeDoubleClick);island.removeEventListener("pointerdown",stopHomePointer);
    url.removeAttribute("data-op-home");
    toolbarWrapper?.removeAttribute("oneplane-home-hold");homeLease?.release();homeLease=null;
  }

  let islandTextAnimation = null;
  function refreshIslandTitle(){
    if(dead || !row.hasAttribute("data-op-show-island")) return;
    const item=dragNode && row.hasAttribute("data-op-dragging")?dragNode:
      indicatorHover && list.contains(indicatorHover)?indicatorHover:entries.get(browser.selectedTab)?.item;
    const nativeTitle=item?.classList.contains("oneplane-split-group")?
      Array.from(item.querySelectorAll(".oneplane-tab-title")).map(n=>n.textContent).filter(Boolean).join(" · "):
      item?.querySelector(".oneplane-tab-title")?.textContent || "";
    const key=item||null;
    if(homeLease && (homeTitleKey!==key || homeNativeTitle!==nativeTitle)){homeTitleKey=key;homeNativeTitle=nativeTitle;markHomeTitleActivity();}
    const title=homeLease&&(homeLease.open||homeIdle||!nativeTitle)?"Home":nativeTitle;
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
    const titleMode=mode==="island" && prefs.getBoolPref("zen.oneplane.show-center-island",true);
    const show=titleMode||!!homeLease;
    row.toggleAttribute("data-op-home-icon",show&&!titleMode);
    if(row.getAttribute("data-op-hover-mode")===mode && row.hasAttribute("data-op-show-island")===show){scheduleGeometry();return;}
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
    cancelIndicatorReturn();
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
  function clearTabHover(keepIndicator=false) {
    cancelHoverTimer();
    hoverTab?.removeAttribute("data-op-expanded");
    hoverTab?.removeAttribute("data-op-hovered");
    hoverTab = null; hoverX = null; lastHoverPointer = null;
    if(keepIndicator===true)releaseIndicatorHover();
    else {cancelIndicatorReturn();indicatorHover=null;}
    refreshIndicator();
    refreshIslandTitle();
  }
  function queueTabCollapse() {
    if (cascadeState!=="idle" || !hoverTab || hoverTimer) return;
    hoverTimer = window.setTimeout(() => {
      hoverTimer = 0;
      // Keep the plus stationary until the pointer actually leaves it.
      if (plus.matches(":hover") || plus.matches(":active")) return;
      clearTabHover(true);
    }, hoverDelay());
  }
  function pointOverTabStrip(event) {
    return [list,...(bottomLane.hidden?[]:[bottomLane])].some(l=>{
      const a=l.getBoundingClientRect();
      return a.width>0&&a.height>0&&event.clientX>=a.left-3&&event.clientX<=a.right+3&&event.clientY>=a.top-2&&event.clientY<=a.bottom+2;
    });
  }
  function releaseIndicatorHover() {
    if(!indicatorHover||indicatorReturnTimer)return;
    indicatorReturnTimer=window.setTimeout(()=>{
      indicatorReturnTimer=0;indicatorHover=null;hoverX=null;
      if(!dead){refreshIndicator();refreshIslandTitle();}
    },INDICATOR_RETURN_DELAY);
  }
  function indicatorSelectionChanged(){
    // An explicit selection during the cooldown should retarget from the
    // held position to the newly selected tab, not wait for the old timer.
    if(!indicatorReturnTimer)return;
    cancelIndicatorReturn();indicatorHover=null;hoverX=null;refreshIndicator();refreshIslandTitle();
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
    if(event.target?.closest?.(".oneplane-title-island")===island){
      if(hoverTab||indicatorHover)clearTabHover();
      return;
    }
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
  // Scroll only the viewport beneath the pointer, never the other lane
  // or the web page. A trackpad's horizontal axis takes precedence.
  function onLaneWheel(event){
    const lane=event.currentTarget;
    // The list is a grid wrapper while centered lanes are active. It must
    // never consume an event bubbling from a non-overflowing child lane.
    if(lane===list&&row.hasAttribute("data-op-show-island")&&!row.hasAttribute("data-op-island-tight"))return;
    if(!hoverSupported()||cascadeState!=="idle"||row.hasAttribute("data-op-dragging")||
       event.ctrlKey||event.metaKey||lane.scrollWidth<=lane.clientWidth+1)return;
    const raw=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
    if(!raw||!Number.isFinite(raw))return;
    const unit=event.deltaMode===1?32:event.deltaMode===2?lane.clientWidth:1;
    event.preventDefault();event.stopPropagation();
    if(lane.id==="oneplane-overflow-tabs")scrollOverflowBy(raw*unit,event.deltaMode===0&&Math.abs(event.deltaX)>Math.abs(event.deltaY));
    else lane.scrollLeft+=raw*unit;
    refreshIndicator();
  }
  let leftScrollMax=null;
  function syncLaneScroll(){
    if(!row.hasAttribute("data-op-show-island")||row.hasAttribute("data-op-island-tight")||
       row.hasAttribute("data-op-dragging")||!leftLane.clientWidth)return;
    const max=Math.max(0,leftLane.scrollWidth-leftLane.clientWidth);
    // The first overflowing left lane reveals its center-facing edge.
    // Preserve a manually scrolled position when subsequent tabs arrive.
    if(leftScrollMax===null||leftScrollMax<=1||Math.abs(leftLane.scrollLeft-leftScrollMax)<=1)
      leftLane.scrollLeft=max;
    leftScrollMax=max;
  }
  function onNewTabClick() { clearTabHover(); }


  let overflowSliderFrame=0,overflowSliderUntil=0;
  let overflowMotionFrame=0,overflowMotion=null,overflowPointer=null;
  function cancelOverflowMotion(){
    if(overflowMotionFrame)window.cancelAnimationFrame(overflowMotionFrame);
    overflowMotionFrame=0;overflowMotion=null;
  }
  function overflowMotionAllowed(){
    return !dead&&!bottomLane.hidden&&cascadeState==="idle"&&!row.hasAttribute("data-op-dragging")&&!row.hasAttribute("data-op-island-incoming");
  }
  function tickOverflowMotion(now){
    overflowMotionFrame=0;
    if(!overflowMotion||!overflowMotionAllowed()){cancelOverflowMotion();return;}
    const m=overflowMotion,max=Math.max(0,bottomLane.scrollWidth-bottomLane.clientWidth);
    const target=Math.max(0,Math.min(max,m.target)),elapsed=Math.max(0,now-m.startTime);
    bottomLane.scrollLeft=overflowScrollEase(m.start,target,elapsed,m.duration);
    refreshOverflowSlider();
    if(!overflowMotion)return;
    if(elapsed<m.duration&&Math.abs(bottomLane.scrollLeft-target)>.5)
      overflowMotionFrame=window.requestAnimationFrame(tickOverflowMotion);
    else{bottomLane.scrollLeft=target;cancelOverflowMotion();refreshOverflowSlider();}
  }
  function scrollOverflowTo(target,direct=false){
    if(!overflowMotionAllowed())return;
    const max=Math.max(0,bottomLane.scrollWidth-bottomLane.clientWidth);
    target=Math.max(0,Math.min(max,target));
    cancelOverflowMotion();
    if(direct||reducedMotion.matches||prefs.getIntPref("zen.oneplane.animation-duration",160)===0||Math.abs(target-bottomLane.scrollLeft)<1){
      bottomLane.scrollLeft=target;refreshOverflowSlider();return;
    }
    overflowMotion={start:bottomLane.scrollLeft,target,startTime:window.performance.now(),duration:145};
    overflowMotionFrame=window.requestAnimationFrame(tickOverflowMotion);
  }
  function scrollOverflowBy(delta,direct=false){
    const from=direct?bottomLane.scrollLeft:overflowMotion?.target??bottomLane.scrollLeft;
    scrollOverflowTo(from+delta,direct);
  }
  function onOverflowPointerDown(event){
    if(event.button!==0)return;
    cancelOverflowMotion();
    const r=overflowSlider.getBoundingClientRect(),m=overflowScrollMetrics(bottomLane.clientWidth,bottomLane.scrollWidth,bottomLane.scrollLeft);
    const center=r.left+m.thumb/2+m.position*Math.max(0,r.width-m.thumb);
    overflowPointer={id:event.pointerId,x:event.clientX,direct:Math.abs(event.clientX-center)<=m.thumb/2+2};
  }
  function onOverflowPointerMove(event){
    if(!overflowPointer||overflowPointer.id!==event.pointerId||overflowPointer.direct)return;
    if(Math.abs(event.clientX-overflowPointer.x)>3){
      overflowPointer.direct=true;cancelOverflowMotion();
    }
  }
  function onOverflowPointerEnd(event){
    if(overflowPointer?.id===event.pointerId)overflowPointer=null;
  }
  function refreshOverflowSlider(){
    if(dead)return;
    const m=overflowScrollMetrics(bottomLane.clientWidth,bottomLane.scrollWidth,bottomLane.scrollLeft);
    overflowSlider.hidden=bottomLane.hidden||!row.hasAttribute("data-op-overflow-row")||!m.visible;
    if(overflowSlider.hidden){cancelOverflowMotion();return;}
    const width=m.thumb.toFixed(2)+"px";
    if(overflowSlider.style.getPropertyValue("--op-scroll-thumb")!==width)overflowSlider.style.setProperty("--op-scroll-thumb",width);
    if(Number(overflowSlider.value)!==m.value)overflowSlider.value=String(m.value);
    const label=Math.round(m.position*100)+"% scrolled";
    if(overflowSlider.getAttribute("aria-valuetext")!==label)overflowSlider.setAttribute("aria-valuetext",label);
  }
  function onOverflowSliderInput(){
    if(dead||bottomLane.hidden||cascadeState!=="idle"||row.hasAttribute("data-op-dragging"))return;
    const m=overflowScrollMetrics(bottomLane.clientWidth,bottomLane.scrollWidth,bottomLane.scrollLeft);
    scrollOverflowTo(m.max*Number(overflowSlider.value)/1000,overflowPointer?.direct===true);
  }
  function onOverflowSliderWheel(event){
    if(event.ctrlKey||event.metaKey||cascadeState!=="idle"||row.hasAttribute("data-op-dragging"))return;
    const m=overflowScrollMetrics(bottomLane.clientWidth,bottomLane.scrollWidth,bottomLane.scrollLeft);
    if(!m.visible)return;
    const raw=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
    if(!raw)return;
    event.preventDefault();event.stopPropagation();
    scrollOverflowBy(raw*(event.deltaMode===1?32:event.deltaMode===2?bottomLane.clientWidth:1),
      event.deltaMode===0&&Math.abs(event.deltaX)>Math.abs(event.deltaY));
  }
  function onOverflowSliderEnter(){if(hoverTab||indicatorHover)clearTabHover();}
  function onOverflowSliderDragStart(event){event.preventDefault();event.stopPropagation();}
  function tickOverflowSlider(now){
    overflowSliderFrame=0;if(dead)return;
    refreshOverflowSlider();
    if(!bottomLane.hidden&&now<overflowSliderUntil)overflowSliderFrame=window.requestAnimationFrame(tickOverflowSlider);
  }
  function onOverflowWidthTransition(event){
    if(bottomLane.hidden||!["width","flex-basis","max-width"].includes(event.propertyName))return;
    if(event.type==="transitionrun"){
      overflowSliderUntil=window.performance.now()+500;
      if(!overflowSliderFrame)overflowSliderFrame=window.requestAnimationFrame(tickOverflowSlider);
    }else refreshOverflowSlider();
  }
  function mountOverflowSlider(){
    overflowSlider.addEventListener("input",onOverflowSliderInput);
    overflowSlider.addEventListener("pointerdown",onOverflowPointerDown);
    window.addEventListener("pointermove",onOverflowPointerMove,true);
    window.addEventListener("pointerup",onOverflowPointerEnd,true);
    window.addEventListener("pointercancel",onOverflowPointerEnd,true);
    window.addEventListener("blur",cancelOverflowPointer);
    overflowSlider.addEventListener("wheel",onOverflowSliderWheel,{passive:false});
    overflowSlider.addEventListener("pointerenter",onOverflowSliderEnter);
    overflowSlider.addEventListener("dragstart",onOverflowSliderDragStart);
    bottomLane.addEventListener("scroll",refreshOverflowSlider,{passive:true});
    for(const type of ["transitionrun","transitionend","transitioncancel"])bottomLane.addEventListener(type,onOverflowWidthTransition);
  }
  function cancelOverflowPointer(){overflowPointer=null;cancelOverflowMotion();}
  function destroyOverflowSlider(){
    cancelOverflowPointer();
    if(overflowSliderFrame)window.cancelAnimationFrame(overflowSliderFrame);
    overflowSliderFrame=0;
    overflowSlider.removeEventListener("input",onOverflowSliderInput);
    overflowSlider.removeEventListener("pointerdown",onOverflowPointerDown);
    window.removeEventListener("pointermove",onOverflowPointerMove,true);
    window.removeEventListener("pointerup",onOverflowPointerEnd,true);
    window.removeEventListener("pointercancel",onOverflowPointerEnd,true);
    window.removeEventListener("blur",cancelOverflowPointer);
    overflowSlider.removeEventListener("wheel",onOverflowSliderWheel);
    overflowSlider.removeEventListener("pointerenter",onOverflowSliderEnter);
    overflowSlider.removeEventListener("dragstart",onOverflowSliderDragStart);
    bottomLane.removeEventListener("scroll",refreshOverflowSlider);
    for(const type of ["transitionrun","transitionend","transitioncancel"])bottomLane.removeEventListener(type,onOverflowWidthTransition);
  }
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
      if(!tab.closing)homeLease?.close();
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
      if(member)homeLease?.close();
      if (member && splitGroup(browser.selectedTab) !== group) browser.selectedTab = member;
    });
    // Keyboard alternative to drag. Move the whole group one top-level slot.
    handle.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const before = event.key === "ArrowLeft";
      const slots=stripNodes(),index=slots.indexOf(box);
      const other=slots[index+(before?-1:1)];
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
    const homeOpen=row.hasAttribute("data-op-home-open");
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
        if (hoverTab === entry.item || indicatorHover === entry.item) clearTabHover();
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
      entry.box.toggleAttribute("data-op-split-active", !homeOpen && group === splitGroup(browser.selectedTab));
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
      const nativeSelected = tab === browser.selectedTab;
      const selected = !homeOpen && nativeSelected;
      entry.item.toggleAttribute("data-selected", selected);
      const group = splitGroup(tab);
      const split = isSplit(tab);
      entry.item.toggleAttribute("data-op-split", split);
      entry.item.toggleAttribute("data-op-split-active", !homeOpen && split && Boolean(group && group === splitGroup(browser.selectedTab)));
      // First/last flags are assigned after groups are laid out in visual order.
      entry.item.removeAttribute("data-op-split-prev");
      entry.item.removeAttribute("data-op-split-next");
      if (split) entry.item.style.setProperty("--op-split-color", splitColors.get(group) || splitPalette[0]);
      else entry.item.style.removeProperty("--op-split-color");
      entry.item.toggleAttribute("data-pinned", Boolean(tab.pinned));
      entry.item.toggleAttribute("data-busy", tab.hasAttribute("busy"));
      entry.item.toggleAttribute("data-unloaded", !nativeSelected && (tab.hasAttribute("pending") || tab.hasAttribute("discarded")));
      const muted = tab.hasAttribute("muted");
      const audible = tab.hasAttribute("soundplaying") || tab.hasAttribute("soundplaying-scheduledremoval");
      entry.item.toggleAttribute("data-audio", audible && !muted);
      entry.item.toggleAttribute("data-muted", muted);
      entry.audio.title = muted ? "Tab muted" : audible ? "Playing audio" : "";
      entry.button.setAttribute("aria-selected", String(selected));
      entry.button.title=label;
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
    const visualTabs=stripNodes().flatMap(n=>n.classList.contains("oneplane-tab")?[n]:Array.from(n.querySelectorAll(".oneplane-tab")));
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
    if(Math.abs(delta)>1){
      if(viewport===bottomLane)cancelOverflowMotion();
      viewport.scrollLeft+=delta;
    }
  }
  function onSelect() {
    markHomeTitleActivity();
    indicatorSelectionChanged();
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
    destroyHome();
    destroyOverflowSlider();
    overflowRevealAnimation?.cancel();overflowRevealAnimation=null;
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
    releaseDragEngine();
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
    for(const lane of [list,leftLane,rightLane,bottomLane]){
      lane.removeEventListener("scroll",refreshIndicator);
      lane.removeEventListener("wheel",onLaneWheel);
    }
    islandTextAnimation?.cancel();
    prefs.removeObserver("zen.oneplane.hover-mode",hoverModePreferenceObserver);
    for(const key of ["tab-width","expanded-tab-width","address-width"])prefs.removeObserver("zen.oneplane."+key,adaptiveGeometryPrefs);
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
    url.removeAttribute("data-op-address-icon");compactSearch.remove();
    url.style.removeProperty("--op-url");
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
    window.removeEventListener("resize", onWindowGeometryChanged);
    window.removeEventListener("sizemodechange", onWindowGeometryChanged);
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
    window.removeEventListener("ZenRefined:WorkspaceTransition",onWorkspaceMotion);
    toolbarWrapper?.removeAttribute("oneplane-workspace-hold");
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
    url.after(row);url.append(compactSearch);
    hub.ensure();
    releaseDragEngine=installDragEngine();
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
    mountHome();
    applyHoverMode();
    sync();
    try { browser.addProgressListener(progressListener); } catch {}
    for(const lane of [list,leftLane,rightLane,bottomLane]){
      lane.addEventListener("scroll",refreshIndicator,{passive:true});
      lane.addEventListener("wheel",onLaneWheel,{passive:false});
    }
    prefs.addObserver("zen.oneplane.hover-mode",hoverModePreferenceObserver);
    for(const key of ["tab-width","expanded-tab-width","address-width"])prefs.addObserver("zen.oneplane."+key,adaptiveGeometryPrefs);
    prefs.addObserver("zen.oneplane.show-center-island",hoverModePreferenceObserver);
    prefs.addObserver("zen.oneplane.tab-indicator", indicatorPreferenceObserver);
    window.addEventListener("pointermove", trackTabPointer, true);
    window.addEventListener("deactivate", clearTabHover);
    row.addEventListener("pointerleave", leaveTabPointer);
    row.addEventListener("focusin", focusTab);
    row.addEventListener("focusout", blurTab);
    plus.addEventListener("pointerleave", leaveTabPointer);
    plus.addEventListener("click", onNewTabClick);
    mountOverflowSlider();
    for (const event of events) browser.tabContainer.addEventListener(event, schedule);
    browser.tabContainer.addEventListener("TabSelect", onSelect);
    for(const event of ["TabOpen","TabClose"])browser.tabContainer.addEventListener(event,onTabOpenOrClose,true);
    window.addEventListener("ZenWorkspaceDataChanged", schedule);
    window.addEventListener("ZenRefined:WorkspaceTransition",onWorkspaceMotion);
    onWorkspaceMotion();
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
    window.addEventListener("resize", onWindowGeometryChanged);
    window.addEventListener("sizemodechange", onWindowGeometryChanged);
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

// One startup selection per browser process. Never redirect a projected
// child, a private/unsynced window or a live reload of this mod.
async function initializeFreeAtStartup(){
  try{
    const native=window.gZenWorkspaces;
    if(window.__oneplaneWorkspaceProjection||!native?.workspaceEnabled||native.privateWindowOrDisabled||!native.currentWindowIsSyncing)return;
    // Default-branch prefs are process-local and not saved in prefs.js.
    // Unlike hiddenDOMWindow, this works in Windows browser chrome.
    const runtime=Services.prefs.getDefaultBranch("");
    const key="zen.oneplane.runtime.free-startup-claimed";
    if(runtime.getBoolPref(key,false))return;
    runtime.setBoolPref(key,true);
    const snapshot=native.getWorkspaces().map(s=>({id:s.uuid,name:typeof s.name==="string"?s.name:""}));
    const stored=prefs.getStringPref("zen.oneplane.free-space-id","");
    const trash=prefs.getStringPref("zen.oneplane.trash-space-id","");
    let id=stored&&stored!==trash&&snapshot.some(s=>s.id===stored)?stored:"";
    if(!id){
      if(snapshot.some(s=>s.name.trim().toLowerCase()==="free"))return;
      const ws=await native.createAndSaveWorkspace("Free","⌂",true);
      if(!ws?.uuid||!native.getWorkspaceFromId(ws.uuid))return;
      id=ws.uuid;prefs.setStringPref("zen.oneplane.free-space-id",id);
      if(typeof native.reorderWorkspace==="function")await native.reorderWorkspace(id,0);
    }
    if(disposed||window.closed||window.__oneplaneWorkspaceProjection)return;
    if(native.activeWorkspace!==id)await native.changeWorkspaceWithID(id);
    console.info("[OnePlane] Free startup",JSON.stringify({selected:native.activeWorkspace===id}));
  }catch(error){console.warn("[OnePlane] Free startup:",error);}
}

async function activate() {
  try {
    await window.SessionStore?.promiseAllWindowsRestored;
    await window.gZenWorkspaces?.promiseInitialized;
    if (disposed || window.closed || root.hasAttribute("popup-window")) return;
    if(!reloadingLayout)await initializeFreeAtStartup();
    if(disposed||window.closed)return;
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

const reloadingLayout=!!window[CONTROLLER];
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
