import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const base=read("src/styles/base.css.part"),address=read("src/styles/address.css.part"),home=read("src/home/shared-home.js.part");
test("search surfaces independently inherit global opacity and blur, including explicit zero",()=>{
 const prefs=JSON.parse(read("preferences.json"));
 for(const role of ["address","home-search"])for(const [prop,unit] of [["opacity","%"],["blur","px"]]){
  const token="--nocturne-"+role+"-"+prop,key="zen.nocturne.material."+role+"."+prop;
  const pref=prefs.find(p=>p.property===key);
  assert.equal(pref.defaultValue,-1);
  assert.ok(base.includes(token+": var(--nocturne-glass-"+prop+")"));
  for(const option of pref.options.filter(o=>o.value!==-1))assert.ok(base.includes('(-moz-pref("'+key+'", '+option.value+')) { '+token+': '+option.value+unit+'; }'));
 }
 assert.ok(base.includes("var(--nocturne-address-tint) var(--nocturne-address-opacity)"));
 assert.ok(base.includes("var(--nocturne-home-search-tint) var(--nocturne-home-search-opacity)"));
});
test("one address paint, no nested blur; live Home and resting Home share material",()=>{
 assert.ok(base.includes("--op-url-surface: var(--nocturne-address-paint"));
 assert.ok(address.includes("background: var(--op-url-surface) !important"));
 assert.ok(address.includes("backdrop-filter: blur(var(--nocturne-address-blur, 0px)) !important"));
 assert.ok(address.includes("backdrop-filter: none !important;\n      overflow: clip"));
 assert.ok(home.includes("--zh-search-glass:var(--nocturne-home-search-paint"));
 assert.ok(home.includes("--zh-glass:var(--zh-search-glass)"));
 assert.ok(home.includes("backdrop-filter:blur(var(--zh-search-blur));"));
 assert.ok(home.includes("backdrop-filter:blur(var(--zh-search-blur))!important"));
 assert.ok(home.includes("--zh-search-radius:var(--nocturne-home-search-radius,14px)"));
 assert.ok(base.includes("--op-url-radius: var(--nocturne-address-radius, 12px)"));
 assert.ok(home.includes("background:transparent!important;border:0!important;outline:0!important;box-shadow:none!important;backdrop-filter:none!important"));
});
test("accessibility overrides both global and local material",()=>{
 const a=base.slice(base.indexOf("@media (prefers-reduced-transparency: reduce), (forced-colors: active)"),base.indexOf("/* Experimental Home-only"));
 for(const role of ["address","home-search"]){
  assert.ok(a.includes("--nocturne-"+role+"-opacity: 100%"));
  assert.ok(a.includes("--nocturne-"+role+"-blur: 0px"));
  assert.ok(a.includes("--nocturne-"+role+"-paint: Canvas"));
 }
});
