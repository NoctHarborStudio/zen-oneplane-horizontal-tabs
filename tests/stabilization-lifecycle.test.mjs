import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createDownloadsService} from "../src/services/downloads-service.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const downloads=read("downloads-indicator.uc.mjs");
const segment=downloads.slice(downloads.indexOf("  async function install(){"),downloads.indexOf("  function sync(){"));
function downloadFixture(source){
 return new Function("source",`let dead=false,node=null,epoch=0,unsubscribeDownloads=null,list=null,hydrating=false,teardowns=0,events=0;
 const window={__nocturneLibraryServices:{downloads:source},closed:false};
 const console={warn(){}};const root={setAttribute(){}};const ACTIVE="active";let enabledFlag=true;const enabled=()=>enabledFlag;
 function build(){node={};}function added(){events++;}function changed(){events++;}function removed(){events++;}
 function schedule(){}function teardown(){epoch++;unsubscribeDownloads?.();unsubscribeDownloads=null;node=null;list=null;hydrating=false;teardowns++;}
 ${segment}
 return {install,replace(source){teardown();window.__nocturneLibraryServices={downloads:source};},disable(){enabledFlag=false;teardown();},enable(){enabledFlag=true;},status:()=>({node:!!node,epoch,teardowns,hydrating,events})};`)(source);
}
function pendingList(){
 let resolve,reject,enter,view,removed=0;
 const entered=new Promise(r=>enter=r);
 const pending=new Promise((r,j)=>{resolve=r;reject=j;});
 const list={addView(v){view=v;enter();return pending;},async removeView(v){assert.equal(v,view);removed++;}};
 return {list,entered,resolve,reject,emit(kind,d){view[kind](d);},removed:()=>removed};
}
test("old rejected download service cannot tear down replacement or replay events",async()=>{
 const oldList=pendingList();
 const source=createDownloadsService({loadList:async()=>oldList.list});
 const f=downloadFixture(source);const old=f.install();await oldList.entered;
 const barrier=source.dispose();
 let newView,addCount=0;
 const next=createDownloadsService({barrier,loadList:async()=>({async addView(v){newView=v;addCount++;},async removeView(){}})});
 f.replace(next);const replacement=f.install();
 oldList.emit("onDownloadAdded",{});assert.equal(addCount,0);
 oldList.reject(Error("late failure"));await old;await replacement;
 assert.equal(oldList.removed(),1);assert.equal(addCount,1);
 const before=f.status();assert.equal(before.node,true);assert.equal(before.events,0);
 oldList.emit("onDownloadAdded",{});assert.deepEqual(f.status(),before);
 newView.onDownloadAdded({});assert.equal(f.status().events,1);await next.dispose();
});
test("late successful addView is detached by the service after Dock teardown",async()=>{
 const oldList=pendingList(),source=createDownloadsService({loadList:async()=>oldList.list});
 const f=downloadFixture(source);const old=f.install();await oldList.entered;f.disable();
 const disposal=source.dispose();oldList.emit("onDownloadChanged",{});oldList.resolve();
 await old;await disposal;
 assert.equal(oldList.removed(),1);assert.equal(f.status().events,0);assert.equal(f.status().node,false);
});
test("Dock disable and re-enable share the same in-flight native subscription",async()=>{
 const native=pendingList(),source=createDownloadsService({loadList:async()=>native.list});
 const f=downloadFixture(source);const old=f.install();await native.entered;
 f.disable();f.enable();const next=f.install();native.emit("onDownloadAdded",{});native.resolve();
 await Promise.all([old,next]);assert.equal(f.status().node,true);assert.equal(f.status().events,1);
 native.emit("onDownloadChanged",{});assert.equal(f.status().events,2);
 f.disable();native.emit("onDownloadChanged",{});assert.equal(f.status().events,2);
 assert.equal(native.removed(),0);await source.dispose();assert.equal(native.removed(),1);
});
test("layout cleanup continues after feature disposal throws",()=>{
 const src=read("src/core/bootstrap.js.part"),cleanup=src.slice(0,src.indexOf("const controller ="));
 const result=new Function(`let disposed=false,applied=true,ownsPreferences=true,closing=false,closeTimer=0,startupObserver=null,preferenceMutation=false,pendingCleanup=null;
 const root={removeAttribute(){}};const window={dispatchEvent(){},CustomEvent:class{},removeEventListener(){},layout:{}};
 const CONTROLLER="layout",controller=window.layout;function markClosing(){}function nativeUnload(){}function updateNativeAfterCleanup(){}let restored=false;
 function otherActiveWindow(){return false}function restorePrefs(){restored=true}
 let removeTabStrip=()=>{throw Error("injected feature cleanup failure")};const console={warn(){}};
 const CustomEvent=window.CustomEvent;${cleanup}cleanup();
 return {disposed,applied,restored,controllerStillRegistered:window.layout===controller};`)();
 assert.deepEqual(result,{disposed:true,applied:false,restored:true,controllerStillRegistered:false});
});

test("layout preference restore isolates failed keys and retains complete backup",()=>{
 const src=read("src/core/preferences.js.part");
 const code=src.slice(src.indexOf("function restorePrefs()"),src.indexOf("function markClosing"));
 const backup={a:{value:false,user:true},b:{value:true,user:false},c:{value:false,user:true}};
 const values=new Map([["a",true],["b",false],["c",false]]);
 const cleared=[],traces=[];let fail=true,raw=JSON.stringify(backup);
 const prefs={getStringPref:()=>raw,setStringPref(k,v){raw=v;},getBoolPref:k=>values.get(k),setBoolPref(k,v){if(k==="a"&&fail)throw Error("locked");values.set(k,v);},
  clearUserPref(k){cleared.push(k);if(k==="backup")raw="";else values.set(k,true);}};
 const restore=new Function("prefs","window","console","TARGET","KEY",code+"return restorePrefs;")(prefs,{__nocturneTrace:(event,data)=>traces.push({event,data})},{warn(){}},{a:true,b:false,c:true},"backup");
 assert.equal(restore(),false);assert.equal(values.get("b"),true);assert.equal(values.get("c"),false);
 assert.deepEqual(JSON.parse(raw),{a:backup.a,b:{...backup.b,released:true},c:{...backup.c,released:true}});
 assert.deepEqual(cleared,["b"]);
 assert.deepEqual(traces[0].data,{restored:1,skipped:1,failed:1,alreadyReleased:0,checkpointFailed:false,backupRetained:true});
 // The user selects the old mod target after b was restored.
 values.set("b",false);
 fail=false;assert.equal(restore(),true);assert.equal(values.get("a"),false);assert.equal(values.get("b"),false);assert.equal(raw,"");
 assert.deepEqual(cleared,["b","backup"]);
});

test("new activation captures released preference keys without losing unresolved originals",()=>{
 const src=read("src/core/preferences.js.part");
 const code=src.slice(src.indexOf("function snapshot()"),src.indexOf("function otherActiveWindow"));
 const saved={a:{value:false,user:true},b:{value:true,user:false,released:true},startup:{value:false,user:false}};
 let raw=JSON.stringify(saved);
 const prefs={PREF_BOOL:128,getPrefType:()=>128,getStringPref:()=>raw,setStringPref(k,v){raw=v;},
  getBoolPref:k=>false,prefHasUserValue:k=>true};
 const snapshot=new Function("prefs","TARGET","STARTUP","KEY",code+"return snapshot;")(prefs,{a:true,b:false},"startup","backup");
 assert.deepEqual(snapshot(),{a:saved.a,b:{value:false,user:true,owned:false},startup:saved.startup});
 assert.deepEqual(JSON.parse(raw),{a:saved.a,b:{value:false,user:true,owned:false},startup:saved.startup});
});
test("failed backup removal checkpoints release progress before retry",()=>{
 const src=read("src/core/preferences.js.part");
 const code=src.slice(src.indexOf("function restorePrefs()"),src.indexOf("function markClosing"));
 let raw=JSON.stringify({a:{value:false,user:true}}),value=true,fail=true,sets=0;
 const prefs={getStringPref:()=>raw,setStringPref(k,v){raw=v;},getBoolPref:()=>value,
  setBoolPref(k,v){sets++;value=v;},clearUserPref(){if(fail)throw Error("locked backup");raw="";}};
 const restore=new Function("prefs","window","console","TARGET","KEY",code+"return restorePrefs;")(prefs,{}, {warn(){}},{a:true},"backup");
 assert.equal(restore(),false);assert.equal(JSON.parse(raw).a.released,true);
 value=true;fail=false;assert.equal(restore(),true);assert.equal(value,true);assert.equal(sets,1);assert.equal(raw,"");
});

test("Hub and drag publication occur only in guarded strip mount",()=>{
 const hub=read("src/hub/controller.js.part"),drag=read("src/interactions/drag-end.js.part"),life=read("src/core/window-lifecycle.js.part");
 assert.doesNotMatch(drag,/window\[DRAG_CONTROLLER\]\s*=\s*dragController/);
 assert.match(life,/try \{\s*\/\/ No globally visible[\s\S]*?mountScope\.defer\("hub"[\s\S]*?window\[DRAG_CONTROLLER\]=dragController;\s*hub\.mount\(\)/);
 assert.match(hub,/function mount\(\)\{[\s\S]*?bindOverlay\(\);[\s\S]*?hubScope\.listen/);
});

test("layout activation releases strip returned after synchronous cleanup and never publishes readiness",async()=>{
 const src=read("src/core/bootstrap.js.part");
 const code=src.slice(src.indexOf("async function activate()"),src.indexOf("const reloadingLayout="));
 const run=new Function(`let disposed=false,applied=false,ownsPreferences=false,removeTabStrip=null,preferenceMutation=false;
 const reloadingLayout=true,startupRecord={},CONTROLLER="controller",controller={};const marks=[],calls=[];
 const root={hasAttribute:()=>false,setAttribute:k=>marks.push(k)};
 const prefs={getBoolPref:()=>true};const TARGET={};
 const window={controller,gZenCompactModeManager:{hideToolbar(){}},dispatchEvent(){},CustomEvent:class{},requestAnimationFrame(){calls.push("raf")}};
 function otherActiveWindow(){return false;}function snapshot(){return {};}function cleanup(){disposed=true;}function finishCleanup(){}function cleanupStep(label,fn){fn();}
 function installTabStrip(){cleanup();return ()=>calls.push("strip cleanup");}const console={error(){}};
 ${code}return async()=>{await activate();return {marks,calls,disposed,installed:!!removeTabStrip};};`)();
 assert.deepEqual(await run(),{marks:[],calls:["strip cleanup"],disposed:true,installed:false});
});
test("Hub overlay stale generation cannot handle Escape after rebinding",()=>{
 const source=read("src/hub/controller.js.part"),code=source.slice(source.indexOf("    const hubScope="),source.indexOf('    listeners.push([window,"Nocturne:OverlayReady"'));
 const scope=read("src/core/disposable-scope.mjs").replace("export function","function");
 const run=new Function(`${scope}
 let destroyed=false,open=true,busy=false,projectionBusy=false,drag=null,trashDrag=null,escapes=0;
 const panel={hidden:false},specs=[];const window={__nocturneOverlay:{register(id,spec){specs.push(spec);return()=>{throw Error("native");};}}};
 function close(){}function key(){escapes++;}
 ${code}bindOverlay();bindOverlay();const old=specs[0],live=specs[1];
 return {old:old.isActive(),oldEscape:old.onEscape({}),live:live.isActive(),liveEscape:live.onEscape({}),escapes};`);
 assert.deepEqual(run(),{old:false,oldEscape:false,live:true,liveEscape:true,escapes:1});
});
