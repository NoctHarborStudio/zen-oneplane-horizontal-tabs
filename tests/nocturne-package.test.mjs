import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const manifest=JSON.parse(read("theme.json"));
test("Nocturne retains Sine identity and one entry per runtime owner",()=>{
 assert.equal(manifest.id,"8b2e214c-e1ba-4b81-9fbf-e08161bf2da4");
 assert.equal(manifest.homepage,"https://github.com/NoctHarborStudio/zen-oneplane-horizontal-tabs/tree/preview");
 assert.equal(manifest.version,JSON.parse(read("package.json")).version);
 assert.deepEqual(Object.keys(manifest.scripts).sort(),["bookmarks.uc.mjs","closing-animation.uc.mjs","downloads-indicator.uc.mjs","layout.uc.mjs","page-progress.uc.mjs","smart-search.uc.mjs","startup-animation.uc.mjs","startup.uc.mjs","workspace-transition.uc.mjs"]);
 for(const name of Object.keys(manifest.scripts))assert.ok(read(name).length>0);
});
test("Nocturne includes each preserved preference exactly once",()=>{
 const prefs=JSON.parse(read("preferences.json"));
 assert.equal(prefs.length,33);
 assert.equal(new Set(prefs.map(p=>p.property)).size,prefs.length);
 assert.deepEqual(prefs.map(p=>p.property).sort(),["zen.nocturne.boot.enabled","zen.oneplane.address-diagnostics","zen.oneplane.address-width","zen.oneplane.animation-duration","zen.oneplane.expanded-tab-width","zen.oneplane.experimental-display-snap","zen.oneplane.fade-curve","zen.oneplane.fade-hold","zen.oneplane.fade-length","zen.oneplane.fade-padding","zen.oneplane.fade-radius","zen.oneplane.fade-strength","zen.oneplane.fade-transparency","zen.oneplane.hover-close-delay","zen.oneplane.hover-mode","zen.oneplane.show-center-island","zen.oneplane.tab-indicator","zen.oneplane.tab-width","zen.refined.bookmarks.duration","zen.refined.bookmarks.enabled","zen.refined.bookmarks.glow","zen.refined.bookmarks.indicator","zen.refined.bookmarks.scale","zen.refined.bookmarks.stable-background","zen.refined.closing.animation","zen.refined.downloads.indicator","zen.refined.downloads.statistics","zen.refined.page-progress.enabled","zen.refined.smart-search.enabled","zen.refined.startup.animation","zen.refined.startup.animation-duration","zen.refined.startup.disable-placeholders","zen.refined.workspace.transition"]);
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
