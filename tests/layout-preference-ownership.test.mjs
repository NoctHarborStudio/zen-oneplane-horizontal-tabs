import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const source=read("src/core/preferences.js.part"),boot=read("src/core/bootstrap.js.part");
const KEY="zen.oneplane.original-layout",CTRL="__oneplaneLayoutController",A="zen.view.use-single-toolbar",B="zen.tabs.vertical.right-side";
function fixture(){
 const values=new Map(),defaults=new Map([[A,true],[B,false],["zen.view.sidebar-expanded",true],["zen.view.compact.hide-tabbar",false],["zen.view.compact.hide-toolbar",true],["zen.view.compact.enable-at-startup",false]]);
 const windows=[],writes=[],prefs={PREF_BOOL:128,getPrefType:()=>128,getStringPref:(k,d)=>values.get(k)??d,setStringPref:(k,v)=>values.set(k,v),getBoolPref:k=>values.get(k)??defaults.get(k),prefHasUserValue:k=>values.has(k),setBoolPref(k,v){writes.push([k,v]);values.set(k,v);},clearUserPref:k=>values.delete(k)};
 const Services={prefs,startup:{shuttingDown:false},wm:{getEnumerator(){const items=[...windows];return {hasMoreElements:()=>items.length>0,getNext:()=>items.shift()};}}};
 function mount(){
  const root={hasAttribute:()=>false,setAttribute(){},removeAttribute(){}},document={documentElement:root},timers=new Map(),events=[],unload=new Map();
  let n=0,release=()=>{};const window={closed:false,CustomEvent:class{constructor(type){this.type=type;}},gZenCompactModeManager:{hideToolbar(){}},dispatchEvent:e=>events.push(e.type),requestAnimationFrame(){},addEventListener:(k,f)=>unload.set(k,f),removeEventListener:k=>unload.delete(k),setTimeout(fn){timers.set(++n,fn);return n;},clearTimeout:id=>timers.delete(id)};
  windows.push(window);
  const run=new Function("Services","window","document","console","getRelease",source+"\n"+boot.slice(0,boot.indexOf("const reloadingLayout="))+
    "\nconst reloadingLayout=true,startupRecord={};function installTabStrip(){return getRelease();}window[CONTROLLER]=controller;return {activate,cleanup,markClosing,nativeUnload,controller};");
  const h=run(Services,window,document,{warn(){},error(){},info(){}},()=>release);
  return {...h,window,document,events,timers,onRelease(fn){release=fn;},tick(){const q=[...timers.values()];timers.clear();q.forEach(fn=>fn());}};
 }
 return {mount,values,writes,prefs,Services};
}
test("joining window shares native preferences without overwriting user edits",async()=>{
 const f=fixture(),a=f.mount();await a.activate();assert.equal(f.prefs.getBoolPref(A),false);
 f.prefs.setBoolPref(A,true);const b=f.mount();await b.activate();assert.equal(f.prefs.getBoolPref(A),true);
 assert.equal(a.controller.ownsPreferences,true);assert.equal(b.controller.ownsPreferences,true);
 a.cleanup();assert.ok(f.values.has(KEY));b.cleanup();assert.equal(f.prefs.getBoolPref(A),true);assert.equal(f.values.has(KEY),false);
});
test("nested window teardown retains lease until final owner releases",async()=>{
 const f=fixture(),a=f.mount(),b=f.mount();a.onRelease(()=>{b.cleanup();assert.equal(f.prefs.getBoolPref(A),false);assert.ok(f.values.has(KEY));});
 await a.activate();await b.activate();a.cleanup();assert.equal(f.prefs.getBoolPref(A),true);assert.equal(f.values.has(KEY),false);
});
test("unchanged native default is not claimed or cleared by layout",async()=>{
 const f=fixture(),a=f.mount();await a.activate();f.prefs.setBoolPref(B,false);a.cleanup();
 assert.equal(f.values.get(B),false);assert.equal(f.prefs.prefHasUserValue(B),true);
});
test("externally cleared user value is not recreated during release",async()=>{
 const f=fixture();f.values.set(A,true);const a=f.mount();await a.activate();
 f.values.delete(A);a.cleanup();assert.equal(f.values.has(A),false);
});
test("cancelled close hint expires and later mod unload updates native layout",async()=>{
 const f=fixture(),a=f.mount();await a.activate();a.events.length=0;a.markClosing({target:a.document});a.tick();a.cleanup();
 assert.ok(a.events.includes("ZenCompactMode:LayoutUpdate"));assert.equal(a.timers.size,0);
});
test("Sine unload during close hint schedules fallback only without replacement",async()=>{
 const f=fixture(),a=f.mount();await a.activate();a.events.length=0;a.markClosing({target:a.window});a.cleanup();
 assert.equal(a.events.includes("ZenCompactMode:LayoutUpdate"),false);a.tick();assert.ok(a.events.includes("ZenCompactMode:LayoutUpdate"));
 const b=f.mount();await b.activate();b.events.length=0;b.markClosing({target:b.document});b.cleanup();b.window[CTRL]={};b.tick();
 assert.equal(b.events.includes("ZenCompactMode:LayoutUpdate"),false);
});
test("actual native unload never schedules layout fallback",async()=>{
 const f=fixture(),a=f.mount();await a.activate();a.events.length=0;a.markClosing({target:a.document});a.nativeUnload();
 assert.equal(a.timers.size,0);assert.equal(a.events.includes("ZenCompactMode:LayoutUpdate"),false);
});
