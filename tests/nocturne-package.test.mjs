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
 assert.equal(prefs.length,37);
 assert.equal(new Set(prefs.map(p=>p.property)).size,prefs.length);
 assert.deepEqual(prefs.map(p=>p.property).sort(),["zen.nocturne.boot.enabled","zen.nocturne.library.downloads-shortcut","zen.nocturne.library.history-shortcut","zen.nocturne.library.local-media","zen.nocturne.library.preview","zen.oneplane.address-diagnostics","zen.oneplane.address-width","zen.oneplane.animation-duration","zen.oneplane.expanded-tab-width","zen.oneplane.experimental-display-snap","zen.oneplane.fade-curve","zen.oneplane.fade-hold","zen.oneplane.fade-length","zen.oneplane.fade-padding","zen.oneplane.fade-radius","zen.oneplane.fade-strength","zen.oneplane.fade-transparency","zen.oneplane.hover-close-delay","zen.oneplane.hover-mode","zen.oneplane.show-center-island","zen.oneplane.tab-indicator","zen.oneplane.tab-width","zen.refined.bookmarks.duration","zen.refined.bookmarks.enabled","zen.refined.bookmarks.glow","zen.refined.bookmarks.indicator","zen.refined.bookmarks.scale","zen.refined.bookmarks.stable-background","zen.refined.closing.animation","zen.refined.downloads.indicator","zen.refined.downloads.statistics","zen.refined.page-progress.enabled","zen.refined.smart-search.enabled","zen.refined.startup.animation","zen.refined.startup.animation-duration","zen.refined.startup.disable-placeholders","zen.refined.workspace.transition"]);
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
