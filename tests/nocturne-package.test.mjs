import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const manifest=JSON.parse(read("theme.json"));
test("Nocturne retains Sine identity and one entry per runtime owner",()=>{
 assert.equal(manifest.id,"8b2e214c-e1ba-4b81-9fbf-e08161bf2da4");
 assert.equal(manifest.homepage,"https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/tree/preview");
 assert.equal(manifest.version,JSON.parse(read("package.json")).version);
 assert.equal(Object.keys(manifest.scripts)[0],"startup-animation.uc.mjs");
 assert.deepEqual(Object.keys(manifest.scripts).sort(),["bookmarks.uc.mjs","closing-animation.uc.mjs","downloads-indicator.uc.mjs","layout.uc.mjs","library-services.uc.mjs","library.uc.mjs","overlay.uc.mjs","page-progress.uc.mjs","smart-search.uc.mjs","startup-animation.uc.mjs","startup.uc.mjs","workspace-transition.uc.mjs"]);
 for(const name of Object.keys(manifest.scripts))assert.ok(read(name).length>0);
});
test("Nocturne includes each preserved preference exactly once",()=>{
 const prefs=JSON.parse(read("preferences.json"));
 assert.equal(prefs.length,58);
 assert.equal(new Set(prefs.map(p=>p.property)).size,prefs.length);
 assert.deepEqual(prefs.map(p=>p.property).sort(),["widget.transparent-windows","widget.windows.mica","widget.windows.mica.toplevel-backdrop","zen.nocturne.bookmarks.always-show","zen.nocturne.boot.enabled","zen.nocturne.diagnostics.enabled","zen.nocturne.fullscreen.disable-animation","zen.nocturne.home.direct-alpha","zen.nocturne.home.tint-opacity","zen.nocturne.home.transparent","zen.nocturne.library.downloads-shortcut","zen.nocturne.library.history-shortcut","zen.nocturne.library.local-media","zen.nocturne.library.preview","zen.nocturne.material.address.blur","zen.nocturne.material.address.opacity","zen.nocturne.material.blur","zen.nocturne.material.home-search.blur","zen.nocturne.material.home-search.opacity","zen.nocturne.material.legacy-toolbar","zen.nocturne.material.opacity","zen.nocturne.material.top-plane.blur","zen.nocturne.material.top-plane.opacity","zen.nocturne.motion.enabled","zen.oneplane.address-diagnostics","zen.oneplane.address-width","zen.oneplane.animation-duration","zen.oneplane.expanded-tab-width","zen.oneplane.experimental-display-snap","zen.oneplane.fade-curve","zen.oneplane.fade-hold","zen.oneplane.fade-length","zen.oneplane.fade-padding","zen.oneplane.fade-radius","zen.oneplane.fade-strength","zen.oneplane.fade-transparency","zen.oneplane.hover-close-delay","zen.oneplane.hover-mode","zen.oneplane.show-center-island","zen.oneplane.tab-indicator","zen.oneplane.tab-width","zen.refined.bookmarks.duration","zen.refined.bookmarks.enabled","zen.refined.bookmarks.glow","zen.refined.bookmarks.indicator","zen.refined.bookmarks.scale","zen.refined.bookmarks.stable-background","zen.refined.closing.animation","zen.refined.downloads.indicator","zen.refined.downloads.statistics","zen.refined.page-progress.enabled","zen.refined.smart-search.enabled","zen.refined.startup.animation","zen.refined.startup.animation-duration","zen.refined.startup.disable-placeholders","zen.refined.workspace.transition","zen.widget.linux.transparency","zen.widget.macos.window-vibrancy"]);
});
test("Nocturne builds one bookmark stylesheet and one Refined feature stylesheet",()=>{
 const css=read("chrome.css");
 const shared=read("src/styles/magnetic-bookmarks.css.part");
 const refined=read("src/styles/refined-features.css.part");
 assert.equal(css.split(shared).length,2);
 assert.equal(css.split(refined).length,2);
 assert.ok(css.endsWith(refined));
 const plan=JSON.parse(read("scripts/build-plan.json"));
 assert.equal(plan.stylesheet.filter(x=>x.path==="src/styles/magnetic-bookmarks.css.part").length,1);
 assert.equal(plan.stylesheet.filter(x=>x.path==="src/styles/refined-features.css.part").length,1);
});

test("clean-profile feature defaults enable experimental Library but leave diagnostics and paused scanner safe",()=>{
  const prefs=JSON.parse(read("preferences.json"));
  const get=name=>prefs.find(p=>p.property===name)?.defaultValue;
  for(const name of ["zen.nocturne.library.preview","zen.nocturne.library.history-shortcut","zen.nocturne.library.downloads-shortcut","zen.nocturne.library.local-media","zen.nocturne.boot.enabled","zen.refined.startup.animation","zen.refined.closing.animation","zen.refined.bookmarks.enabled","zen.refined.smart-search.enabled","zen.refined.downloads.indicator","zen.refined.page-progress.enabled","zen.oneplane.experimental-display-snap"])assert.equal(get(name),true,name);
  assert.equal(get("zen.oneplane.address-diagnostics"),false);
  const runtime=read("src/services/library-services-runtime.js.part");
  assert.ok(runtime.includes("const LOCAL_MEDIA_SCAN_SUSPENDED=true"));
  assert.ok(runtime.includes("!LOCAL_MEDIA_SCAN_SUSPENDED&&allowed()"));
  const home=read("src/home/shared-home.js.part");
  assert.ok(home.includes("background:transparent"));
});

test("Startup and transparency settings expose real native prefs without silently overwriting choices",()=>{
 const list=JSON.parse(read("preferences.json")),get=k=>list.find(x=>x.property===k);
 assert.equal(get("zen.nocturne.motion.enabled").defaultValue,true);
 assert.equal(get("zen.nocturne.home.transparent").defaultValue,true);
 assert.equal(get("zen.nocturne.diagnostics.enabled").defaultValue,true);
 for(const key of ["widget.transparent-windows","widget.windows.mica","zen.widget.macos.window-vibrancy","zen.widget.linux.transparency"]){assert.equal(get(key).type,"checkbox");assert.equal(Object.hasOwn(get(key),"defaultValue"),false);assert.equal(get(key).restart,true);}
 assert.equal(get("widget.windows.mica.toplevel-backdrop").defaultValue,2);
 assert.match(read("src/home/shared-home.js.part"),/-moz-pref\("zen.nocturne.home.transparent", false\)/);
});

test("experimental direct alpha keeps native backing changes scoped to visible normal Home",()=>{
 const list=JSON.parse(read("preferences.json")),get=k=>list.find(x=>x.property===k);
 assert.equal(get("zen.nocturne.home.direct-alpha").defaultValue,false);
 assert.equal(get("zen.nocturne.home.tint-opacity").defaultValue,65);
 assert.deepEqual(get("zen.nocturne.home.tint-opacity").options.map(x=>x.value),[0,25,45,65,85,100]);
 const source=read("src/styles/base.css.part");
 const block=source.slice(source.indexOf("/* Experimental Home-only direct alpha:"),source.indexOf("/* OnePlane — native toolbar tab view."));
 for(const fragment of ['(-moz-platform: windows)','(forced-colors: none)','(-moz-pref("widget.transparent-windows"))','(not (-moz-pref("widget.windows.mica")))','(not (-moz-pref("zen.nocturne.home.transparent", false)))','[oneplane-active="true"]',':has(#zen-tabbox-wrapper[data-zr-home-host] > #zen-shared-home:not([hidden]))','[zen-private-window="true"]','[inDOMFullscreen="true"]','opacity: var(--nocturne-home-tint-opacity) !important','--nocturne-home-tint-opacity: .65'])assert.ok(block.includes(fragment),fragment);
 assert.doesNotMatch(block,/backdrop-filter|pointer-events:|position:|z-index:|transform:|transition:|display:|visibility:/);
 assert.ok(read("chrome.css").includes(block));
});

test("packaged Nocturne runtime has no system motion admission gates",()=>{
 const pref=JSON.parse(read("preferences.json")).find(x=>x.property==="zen.nocturne.motion.enabled");
 assert.equal(pref.defaultValue,true);assert.equal(pref.restart,true);
 const css=read("chrome.css");assert.doesNotMatch(css,/prefers-reduced-motion|zen\.nocturne\.startup\.force-motion/);
 for(const path of Object.keys(manifest.scripts)){
  const runtime=read(path).split("\n").filter(line=>!line.includes('record("diagnostics.ready"')).join("\n");
  assert.doesNotMatch(runtime,/prefers-reduced-motion|zen\.nocturne\.startup\.force-motion|ui\.prefersReducedMotion/,path);
 }
});

test("fullscreen animation opt-out is default-on and separate from Nocturne motion",()=>{
 const p=JSON.parse(read("preferences.json")).find(x=>x.property==="zen.nocturne.fullscreen.disable-animation");
 assert.equal(p.defaultValue,true);assert.equal(p.type,"checkbox");
});
