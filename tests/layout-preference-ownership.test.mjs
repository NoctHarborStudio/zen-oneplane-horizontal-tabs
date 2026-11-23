import {createDisposableScope} from "../src/core/disposable-scope.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {nocturneErrorClass} from "../src/core/error-class.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const source=read("src/core/preferences.js.part"),boot=read("src/core/bootstrap.js.part");
const KEY="zen.oneplane.original-layout",CTRL="__oneplaneLayoutController",A="zen.view.use-single-toolbar",B="zen.tabs.vertical.right-side";
function fixture(){
 const values=new Map(),defaults=new Map([[A,true],[B,false],["zen.view.sidebar-expanded",true],["zen.view.compact.hide-tabbar",false],["zen.view.compact.hide-toolbar",true],["zen.view.compact.enable-at-startup",false]]);
 const windows=[],writes=[],observers=new Set(),prefs={PREF_BOOL:128,getPrefType:()=>128,getStringPref:(k,d)=>values.get(k)??d,setStringPref:(k,v)=>values.set(k,v),getBoolPref:k=>values.get(k)??defaults.get(k),prefHasUserValue:k=>values.has(k),setBoolPref(k,v){writes.push([k,v]);values.set(k,v);},clearUserPref:k=>values.delete(k)};
 const Services={prefs,startup:{shuttingDown:false},obs:{addObserver(fn){observers.add(fn);},removeObserver(fn){observers.delete(fn);}},wm:{getEnumerator(){const items=[...windows];return {hasMoreElements:()=>items.length>0,getNext:()=>items.shift()};}}};
 function mount(resources={},register=false,onEvent=()=>{}){
  const root={hasAttribute:()=>false,setAttribute(){},removeAttribute(){}},document={documentElement:root},timers=new Map(),events=[],unload=new Map();
  let n=0,release=()=>{},sine;const window={...resources,closed:false,CustomEvent:class{constructor(type){this.type=type;}},gZenCompactModeManager:{hideToolbar(){}},dispatchEvent:e=>{events.push(e.type);onEvent(window,e);},requestAnimationFrame(){},addEventListener:(k,f)=>unload.set(k,f),removeEventListener:k=>unload.delete(k),setTimeout(fn){timers.set(++n,fn);return n;},clearTimeout:id=>timers.delete(id)};
  if(register)window.addUnloadListener=fn=>{sine=fn;};
  windows.push(window);
  const run=new Function("Services","window","document","console","getRelease","createDisposableScope","nocturneErrorClass",source+"\n"+(register?boot:boot.slice(0,boot.indexOf("const reloadingLayout=")))+
    "\n"+(register?"":"const reloadingLayout=true,startupRecord={};window[CONTROLLER]=controller;")+"function installTabStrip(){return getRelease();}return {activate,cleanup,markClosing,nativeUnload,controller};");
  const h=run(Services,window,document,{warn(){},error(){},info(){}},()=>release,createDisposableScope,nocturneErrorClass);
  return {...h,window,document,events,timers,sine:()=>sine?.(),listeners:unload,fireUnload:event=>unload.get("unload")?.(event),onRelease(fn){release=fn;},tick(){const q=[...timers.values()];timers.clear();q.forEach(fn=>fn());}};
 }
 return {mount,values,writes,prefs,Services,observers};
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
 const f=fixture(),a=f.mount();await a.activate();a.events.length=0;a.markClosing({target:a.document});a.nativeUnload({target:a.document});
 assert.equal(a.timers.size,0);assert.equal(a.events.includes("ZenCompactMode:LayoutUpdate"),false);
});

test("native hideToolbar setter is never called on initial or joining acquisition",async()=>{
 const f=fixture(),a=f.mount(),b=f.mount(),hide="zen.view.compact.hide-toolbar",tab="zen.view.compact.hide-tabbar";let calls=0;
 for(const h of [a,b])h.window.gZenCompactModeManager.hideToolbar=()=>{calls++;f.prefs.setBoolPref(hide,true);f.prefs.setBoolPref(tab,false);};
 await a.activate();f.prefs.setBoolPref(hide,false);f.prefs.setBoolPref(tab,true);await b.activate();
 assert.equal(calls,0);assert.equal(f.prefs.getBoolPref(hide),false);assert.equal(f.prefs.getBoolPref(tab),true);
 a.cleanup();b.cleanup();assert.equal(f.prefs.getBoolPref(hide),false);assert.equal(f.prefs.getBoolPref(tab),true);
});
test("cleanup during initial snapshot retains lease until write returns and removes unused backup",async()=>{
 const f=fixture(),a=f.mount(),set=f.prefs.setStringPref;
 f.prefs.setStringPref=(k,v)=>{set(k,v);if(k===KEY){a.cleanup();assert.equal(a.controller.ownsPreferences,true);assert.equal(a.window[CTRL],a.controller);}};
 await a.activate();assert.equal(f.values.has(KEY),false);assert.equal(a.controller.ownsPreferences,false);assert.equal(a.window[CTRL],undefined);assert.deepEqual(f.writes,[]);
});
test("cleanup during native target write restores after observer returns",async()=>{
 const f=fixture(),a=f.mount(),set=f.prefs.setBoolPref;
 f.prefs.setBoolPref=(k,v)=>{set(k,v);if(k===A&&v===false){a.cleanup();assert.equal(a.controller.ownsPreferences,true);assert.equal(f.prefs.getBoolPref(A),false);}};
 await a.activate();assert.equal(f.prefs.getBoolPref(A),true);assert.equal(f.values.has(KEY),false);assert.equal(a.controller.ownsPreferences,false);
});
test("backup write failure does not mutate native preferences or restore invalid backup",async()=>{
 const f=fixture(),a=f.mount();f.values.set(KEY,"invalid json");
 await a.activate();assert.equal(f.values.get(KEY),"invalid json");assert.deepEqual(f.writes,[]);assert.equal(a.controller.ownsPreferences,false);
});
test("partial target application failure releases previously acquired preferences",async()=>{
 const f=fixture(),a=f.mount(),set=f.prefs.setBoolPref;f.values.set(B,true);
 f.prefs.setBoolPref=(k,v)=>{if(k===B&&v===false)throw Error("locked");set(k,v);};
 await a.activate();assert.equal(f.prefs.getBoolPref(A),true);assert.equal(f.prefs.getBoolPref(B),true);assert.equal(f.values.has(KEY),false);assert.equal(a.controller.ownsPreferences,false);
});

test("final Layout callback releases captured resources and recorder after preference cleanup",async()=>{
 const f=fixture(),order=[];let a;
 const diagnostics={requestDispose(){order.push("diagnostics");assert.equal(f.values.has(KEY),false);}};
 a=f.mount({__nocturneDiagnostics:diagnostics,__nocturneEarlyBoot:{cleanup(){order.push("boot");}},__nocturneCenterMotion:{dispose(){order.push("center");throw Error("injected center failure");}}});
 a.onRelease(()=>order.push("strip"));await a.activate();
 a.window.__nocturneDiagnostics={requestDispose(){order.push("replacement");}};
 a.window.__nocturneTrace=(event,data)=>{if(event==="layout.cleanup.end"){assert.equal(data.failedSteps,1);order.push("end");}};
 a.cleanup();a.cleanup();
 assert.deepEqual(order,["boot","center","strip","end","diagnostics"]);
});

test("Layout stops Assembly before disposing Center Motion or detaching strip",async()=>{
 const f=fixture(),order=[];
 const a=f.mount({__zenRefinedStartupAnimation:()=>order.push("assembly"),__nocturneCenterMotion:{dispose(){order.push("center");}}});
 a.onRelease(()=>order.push("strip"));await a.activate();a.cleanup();assert.deepEqual(order,["assembly","center","strip"]);
});

test("descendant unload does not release Layout lease or consume native fallback",async()=>{
 const f=fixture(),a=f.mount();await a.activate();
 a.nativeUnload({target:{}});a.nativeUnload({target:a.window,originalTarget:{}});
 assert.equal(a.controller.ownsPreferences,true);assert.ok(f.values.has(KEY));
 a.nativeUnload({target:a.document,originalTarget:a.document});
 assert.equal(a.controller.ownsPreferences,false);assert.equal(f.values.has(KEY),false);
});
test("actual bootstrap claims owner before listeners and completes after lease release on Sine or native path",async()=>{
 for(const nativeExit of [false,true]){
  const f=fixture(),order=[];let owner,a;
  a=f.mount({__nocturneDiagnostics:{claimLayout(fn){owner=fn;return ()=>{order.push("complete");assert.equal(f.values.has(KEY),false);};}},__nocturneTrace(event,data){if(event==="layout.cleanup.end"){order.push("end");assert.equal(data.nativeExit,nativeExit);}}},true);
  assert.equal(typeof owner,"function");await a.activate();
  a.fireUnload({target:{}});assert.equal(a.controller.ownsPreferences,true);
  if(nativeExit)owner(true);else a.sine();
  a.fireUnload({target:a.document});a.sine();assert.deepEqual(order,["end","complete"]);
  assert.equal(a.controller.ownsPreferences,false);
 }
});
test("actual bootstrap defers terminal completion until a reentrant preference write unwinds",async()=>{
 const f=fixture(),order=[];let owner,entered=false;
 const a=f.mount({__nocturneDiagnostics:{claimLayout(fn){owner=fn;return ()=>{order.push("complete");assert.equal(f.values.has(KEY),false);};}}},true);
 const set=f.prefs.setBoolPref;
 f.prefs.setBoolPref=(k,v)=>{set(k,v);if(k===A&&v===false){entered=true;owner(true);assert.equal(a.controller.ownsPreferences,true);assert.deepEqual(order,[]);}};
 await a.activate();assert.equal(entered,true);assert.deepEqual(order,["complete"]);assert.equal(a.controller.ownsPreferences,false);
});

test("bootstrap does not register stale resources after synchronous StartupState disposal",()=>{
 const f=fixture();let first=true,completed=0;
 const a=f.mount({__nocturneDiagnostics:{claimLayout(){return ()=>completed++;}}},true,(w,e)=>{
  if(first&&e.type==="OnePlane:StartupState"){first=false;w[CTRL].cleanup();}
 });
 assert.equal(a.window[CTRL],undefined);assert.equal(f.observers.size,0);
 assert.equal(a.listeners.size,0);assert.equal(completed,1);a.sine();assert.equal(completed,1);
});
test("bootstrap registration rolls back claim and listeners when StartupState dispatch throws",()=>{
 const f=fixture();let completed=0,first=true;
 const a=f.mount({__nocturneDiagnostics:{claimLayout(){return ()=>completed++;}}},true,()=>{
  if(first){first=false;throw Error("injected startup publication failure");}
 });
 assert.equal(a.window[CTRL],undefined);assert.equal(a.listeners.size,0);
 assert.equal(f.observers.size,0);assert.equal(completed,1);a.sine();assert.equal(completed,1);
});
