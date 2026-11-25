import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const base=read("src/styles/base.css.part"),prefs=JSON.parse(read("preferences.json"));
const contour=read("src/styles/contour.css.part");
test("all Glass preference options, defaults and independent overrides match CSS tokens",function(){
 const roles={"top-plane":["tint","opacity","blur"],address:["tint","opacity","blur","radius","border"],"home-search":["tint","opacity","blur","radius","border"],hub:["tint","opacity","blur","radius","border","shadow"],downloads:["tint","opacity","blur","radius","border","shadow"],library:["tint","opacity","blur","radius","border","shadow"]};
 const defaults={tint:0,opacity:70,blur:24,radius:12,border:12,shadow:20};
 const prefix="zen.nocturne.material.";
 const get=k=>{const matches=prefs.filter(p=>p.property===prefix+k);assert.equal(matches.length,1,k);return matches[0]};
 const rules=[...(base+"\n"+contour).matchAll(/@media \(-moz-pref\("zen\.nocturne\.material\.([^"]+)", (-?\d+)\)\) \{ (--[\w-]+): ([^;]+); \}/g)].map(([,key,value,token,paint])=>({key,value:Number(value),token,paint}));
 const tokenName=key=>["border","shadow"].includes(key)?key+"-strength":key;
 const globals={};
 const expected=new Set(Object.keys(defaults));
 for(const [key,value] of Object.entries(defaults)){
  const pref=get(key),token="--nocturne-glass-"+tokenName(key),list=rules.filter(r=>r.key===key);
  assert.equal(pref.defaultValue,value,key);
  assert.deepEqual(list.map(r=>r.value).sort((a,b)=>a-b),pref.options.map(o=>o.value).sort((a,b)=>a-b),key);
  assert.ok(list.every(r=>r.token===token),key);
  assert.ok(base.includes(token+": "+list.find(r=>r.value===value).paint+";"),key);
  globals[key]=list;
 }
 for(const [role,keys] of Object.entries(roles))for(const key of keys){
  const name=role+"."+key;expected.add(name);
  const local=get(name),global=get(key),suffix=tokenName(key);
  const topLocal=role==="top-plane"&&["opacity","blur"].includes(key);
  const token="--nocturne-"+(topLocal?"surface":role)+"-"+suffix;
  assert.equal(local.defaultValue,-1,name);
  assert.equal(local.options[0].value,-1,name);
  assert.deepEqual(local.options.slice(1),global.options,name);
  assert.ok((topLocal?contour:base).includes(token+": var(--nocturne-glass-"+suffix+");"),name);
  const list=rules.filter(r=>r.key===name);
  assert.deepEqual(list.map(r=>r.value).sort((a,b)=>a-b),global.options.map(o=>o.value).sort((a,b)=>a-b),name);
  for(const rule of list){assert.equal(rule.token,token,name);assert.equal(rule.paint,globals[key].find(r=>r.value===rule.value).paint,name);}
 }
 assert.deepEqual(prefs.filter(p=>p.property?.startsWith(prefix)&&p.property!==prefix+"legacy-toolbar").map(p=>p.property.slice(prefix.length)).sort(),[...expected].sort());
 assert.ok(rules.every(r=>expected.has(r.key)));
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
