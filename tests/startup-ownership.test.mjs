import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../startup.uc.mjs",import.meta.url),"utf8");
const run=new Function("Services","window","document","console",source);
const OPTION="zen.refined.startup.disable-placeholders",BACKUP="zen.refined.startup.previous-placeholders";
const TARGETS=["browser.startup.blankWindow","browser.startup.preXulSkeletonUI"];
function fixture(initial={}){
 const values=new Map(Object.entries(initial)),defaults=new Map(TARGETS.map(k=>[k,true])),windows=[],observers=new Set();
 const prefs={PREF_BOOL:128,getStringPref:(k,d)=>values.get(k)??d,setStringPref:(k,v)=>values.set(k,v),
  getBoolPref:(k,d)=>values.get(k)??defaults.get(k)??d,setBoolPref:(k,v)=>values.set(k,v),
  prefHasUserValue:k=>values.has(k),clearUserPref:k=>values.delete(k),prefIsLocked:()=>false,getPrefType:()=>128,
  savePrefFile(){},addObserver(k,f){assert.equal(k,OPTION);observers.add(f);},removeObserver(k,f){observers.delete(f);}};
 const Services={prefs,startup:{shuttingDown:false},wm:{getEnumerator(){const items=[...windows];return {hasMoreElements:()=>items.length>0,getNext:()=>items.shift()};}}};
 const document={documentElement:{hasAttribute:()=>false}};
 function mount(existing){
  const events=new Map();let unload;
  const window=existing??{closed:false};if(!existing)windows.push(window);
  Object.assign(window,{addUnloadListener(f){unload=f;},addEventListener(k,f){events.set(k,f);},removeEventListener(k,f){if(events.get(k)===f)events.delete(k);},setTimeout(){return 1;},clearTimeout(){}});
  run(Services,window,document,{warn(){}});
  return {window,unload:()=>unload(),close(){events.get("beforeunload")?.({target:window});events.get("unload")?.();window.closed=true;},nativeUnload(){events.get("unload")?.();window.closed=true;}};
 }
 return {mount,values,observers,Services,states:()=>TARGETS.map(k=>prefs.getBoolPref(k)),option(v){values.set(OPTION,v);for(const f of [...observers])f();}};
}
test("two windows share one startup observer and last mod unload restores defaults",()=>{
 const f=fixture(),a=f.mount(),b=f.mount();assert.deepEqual(f.states(),[false,false]);assert.equal(f.observers.size,1);
 a.unload();assert.deepEqual(f.states(),[false,false]);assert.equal(f.observers.size,1);assert.ok(f.values.has(BACKUP));
 b.unload();assert.deepEqual(f.states(),[true,true]);assert.equal(f.observers.size,0);assert.equal(f.values.has(BACKUP),false);
});
test("non-owner unload does not release owner; option toggles restore exact user/default",()=>{
 const f=fixture({[TARGETS[0]]:true}),a=f.mount(),b=f.mount();b.unload();assert.equal(f.observers.size,1);
 f.option(false);assert.deepEqual(f.states(),[true,true]);assert.equal(f.values.get(TARGETS[0]),true);assert.equal(f.values.has(TARGETS[1]),false);
 f.option(true);assert.deepEqual(f.states(),[false,false]);a.unload();assert.deepEqual(f.states(),[true,true]);
});
test("normal close transfers observation and last native close preserves backup",()=>{
 const f=fixture(),a=f.mount(),b=f.mount();a.close();assert.equal(f.observers.size,1);
 b.nativeUnload();assert.equal(f.observers.size,0);assert.deepEqual(f.states(),[false,false]);assert.ok(f.values.has(BACKUP));
 const c=f.mount();assert.equal(f.observers.size,1);c.unload();assert.deepEqual(f.states(),[true,true]);
});
test("replacement keeps backup; stale callback cannot restore a new owner",()=>{
 const f=fixture(),a=f.mount(),backup=f.values.get(BACKUP),b=f.mount(a.window);
 assert.equal(f.observers.size,1);assert.equal(f.values.get(BACKUP),backup);a.unload();
 assert.deepEqual(f.states(),[false,false]);b.unload();assert.deepEqual(f.states(),[true,true]);
});
test("shutdown does not restore; external preference edits survive",()=>{
 const f=fixture(),a=f.mount();f.Services.startup.shuttingDown=true;a.unload();assert.deepEqual(f.states(),[false,false]);assert.ok(f.values.has(BACKUP));
 f.Services.startup.shuttingDown=false;const b=f.mount();f.values.set(TARGETS[0],true);b.unload();assert.equal(f.values.get(TARGETS[0]),true);assert.equal(f.values.has(TARGETS[1]),false);
});

test("legacy conflict diagnostic only warns for an enabled Refined entry",async()=>{
 const section=source.slice(source.indexOf('const LEGACY_ID='),source.indexOf('function readBackup('));
 const warn=new Function(section+"return warnLegacyConflict;")();
 const id="9d788b55-d497-41da-8444-993c603e89e4",messages=[],logger={warn:m=>messages.push(m)};
 for(const mods of [{},{[id]:{enabled:false}},{[id]:{enabled:true}}]){
   assert.equal(await warn(async()=>mods,logger),mods[id]?.enabled===true);
 }
 assert.equal(await warn(async()=>{throw Error("unavailable");},logger),false);
 assert.equal(messages.length,1);assert.ok(messages[0].includes("Disable it in Sine"));
});
