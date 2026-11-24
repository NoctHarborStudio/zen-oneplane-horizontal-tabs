import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const base=read("src/styles/base.css.part"),hub=read("src/styles/hub.css.part"),dl=read("src/styles/refined-features.css.part");
test("anchored panels inherit each property and allow zero overrides",()=>{
 const prefs=JSON.parse(read("preferences.json"));
 for(const role of ["hub","downloads"])for(const [prop,unit] of [["opacity","%"],["blur","px"]]){
  const token="--nocturne-"+role+"-"+prop,key="zen.nocturne.material."+role+"."+prop,pref=prefs.find(x=>x.property===key);
  assert.equal(pref.defaultValue,-1);
  assert.ok(base.includes(token+": var(--nocturne-glass-"+prop+")"));
  for(const o of pref.options.filter(x=>x.value!==-1))assert.ok(base.includes('(-moz-pref("'+key+'", '+o.value+')) { '+token+': '+o.value+unit+'; }'));
 }
 for(const role of ["hub","downloads"]){
  assert.ok(base.includes("var(--nocturne-"+role+"-tint) var(--nocturne-"+role+"-opacity)"));
  assert.ok(base.includes("--nocturne-"+role+"-opacity: 100%"));
  assert.ok(base.includes("--nocturne-"+role+"-blur: 0px"));
  assert.ok(base.includes("--nocturne-"+role+"-paint: Canvas"));
 }
});
test("Hub resolves material in CSS and clip uses the actual resting radius",()=>{
 const controller=read("src/hub/controller.js.part");
 assert.ok(hub.includes("background:var(--nocturne-hub-paint,var(--op-hub-bg))"));
 assert.ok(hub.includes("backdrop-filter:blur(var(--nocturne-hub-blur,0px))"));
 assert.ok(hub.includes("round var(--nocturne-hub-radius,12px)"));
 assert.ok(controller.includes('const radius=computed.borderTopLeftRadius||"12px"'));
 assert.ok(!controller.includes('panel.style.setProperty("--op-hub-bg"'));
 assert.ok(!controller.includes('panel.style.setProperty("--op-hub-fg"'));
});
test("Downloads applies tint once on the same decorative backing and retains native flight palette",()=>{
 const backing=dl.split("#zr-download-dock::before {")[1].split("}")[0];
 assert.ok(backing.includes("background:var(--nocturne-downloads-paint,var(--zr-download-surface))"));
 assert.ok(!backing.includes("opacity:"));
 assert.ok(dl.includes("backdrop-filter:blur(var(--nocturne-downloads-blur,0px))"));
 const runtime=read("downloads-indicator.uc.mjs");
 assert.ok(runtime.includes("targets=targets.filter(n=>n&&n!==dock)"));
 assert.ok(runtime.includes('if(window.__nocturneLibrary?.open("downloads"))return;openDock(true);'));
 assert.ok(runtime.includes("syncTheme(flight)"));
});
