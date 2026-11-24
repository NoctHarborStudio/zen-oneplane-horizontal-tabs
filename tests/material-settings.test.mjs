import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const base=read("src/styles/base.css.part"),prefs=JSON.parse(read("preferences.json"));
test("every supported material property has an independently inherited override and valid CSS options",()=>{
 const roles={"top-plane":["tint"],"address":["tint","radius","border"],"home-search":["tint","radius","border"],"hub":["tint","radius","border","shadow"],"downloads":["tint","radius","border","shadow"],"library":["tint","radius","border","shadow"]};
 const get=k=>prefs.find(p=>p.property==="zen.nocturne.material."+k);
 for(const [role,keys] of Object.entries(roles))for(const key of keys){
  const global=get(key),local=get(role+"."+key),token=["border","shadow"].includes(key)?key+"-strength":key;
  assert.equal(local.defaultValue,-1);
  assert.deepEqual(local.options.slice(1),global.options);
  assert.ok(base.includes("--nocturne-"+role+"-"+token+": var(--nocturne-glass-"+token+")"));
  for(const opt of local.options.slice(1))assert.ok(base.includes('(-moz-pref("zen.nocturne.material.'+role+'.'+key+'", '+opt.value+')) { --nocturne-'+role+'-'+token+':'));
  for(const opt of global.options)assert.ok(base.includes('(-moz-pref("zen.nocturne.material.'+key+'", '+opt.value+')) { --nocturne-glass-'+token+':'));
 }
 assert.equal(get("radius").defaultValue,12);
 assert.equal(get("border").defaultValue,12);
 assert.equal(get("shadow").defaultValue,20);
 assert.ok(!get("top-plane.radius"));
});
test("download wave final geometry uses the selected radius including zero",()=>{
 const source=read("downloads-indicator.uc.mjs");
 const part=source.slice(source.indexOf("function wavePath("),source.indexOf("function updateOverlayMask("));
 const geometry=new Function("r","radius","width","height",`const clamp=(v,lo,hi)=>Math.max(lo,Math.min(Math.max(lo,hi),v));${part}return panelGeometry(r,width,height,40,60,radius);`);
 for(const radius of [0,4,8,12,16,20])for(const hosted of [false,true]){
  const g=geometry({hosted,side:"right",edge:40,x:60,y:80},radius,430,160);
  assert.equal(g.radius,radius);
  assert.equal(g.full,"inset(0px 0px 0px 0px round "+radius+"px)");
  assert.equal(g.frames.length,11);
  assert.ok(!g.frames.at(-1).clipPath.includes("NaN"));
 }
 assert.ok(source.includes("getComputedStyle(dock).borderTopLeftRadius"));
 assert.ok(source.includes("round ${g.radius}px"));
 assert.ok(read("src/toolbar/address-controller.js.part").includes("Number.isFinite(configuredRadius)?Math.max(0,configuredRadius):12"));
});
