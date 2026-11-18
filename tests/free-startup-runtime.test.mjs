import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const s=readFileSync(new URL("../src/core/bootstrap.js.part",import.meta.url),"utf8");
const a=s.indexOf("async function initializeFreeAtStartup"),b=s.indexOf("async function activate",a);
const service=["disposable-scope.mjs","workspace-commands.mjs"].map(p=>readFileSync(new URL("../src/core/"+p,import.meta.url),"utf8").replace(/^export (function|const) /gm,"$1 ")).join("\n");
function harness(stored="",names=["Space"],projection=false){
  const entries=names.map((name,i)=>({name,uuid:"id"+i})),host={},map=new Map([["zen.oneplane.free-space-id",stored]]),calls=[];
  const elements=new Map(),anchor={};
  const selected={isConnected:true,getAttribute:k=>k==="zen-workspace-id"?native.activeWorkspace:null,hasAttribute:()=>false};
  const element=id=>{if(!elements.has(id))elements.set(id,{isConnected:true,get active(){return native.activeWorkspace===id;},tabsContainer:{isConnected:true,contains:t=>t===selected},pinnedTabsContainer:{isConnected:true,contains:()=>false},scrollbox:{}});return elements.get(id);};
  const native={workspaceEnabled:true,currentWindowIsSyncing:true,isChangingWorkspace:false,activeWorkspace:"id0",getWorkspaces:()=>entries,getWorkspaceFromId:id=>entries.find(s=>s.uuid===id),workspaceElement:element,
    async createAndSaveWorkspace(name){calls.push("create");const ws={name,uuid:"new"};entries.push(ws);return ws;},
    async reorderWorkspace(id){calls.push("reorder");entries.unshift(...entries.splice(entries.findIndex(s=>s.uuid===id),1));},async changeWorkspaceWithID(id){calls.push(id);this.activeWorkspace=id;}};
  const gBrowser={selectedTab:selected,visibleTabs:[selected],get pinnedTabsContainer(){return element(native.activeWorkspace).pinnedTabsContainer;},tabContainer:{get arrowScrollbox(){return element(native.activeWorkspace).scrollbox;},get pinnedTabsContainer(){return element(native.activeWorkspace).pinnedTabsContainer;}}};
  const listeners=new Map();
  const window={gZenWorkspaces:native,gBrowser,closed:false,__oneplaneWorkspaceProjection:projection,
    addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);}};
  const context={window,disposed:false,cancelFreeStartupWait:null,ChromeUtils:{importESModule:()=>({BrowserWindowTracker:anchor})},Services:{prefs:{getDefaultBranch:()=>({getBoolPref:(k,f)=>host[k]??f,setBoolPref:(k,v)=>host[k]=v})}},prefs:{getStringPref:(k,f)=>map.get(k)||f,setStringPref:(k,v)=>map.set(k,v)},console:{info(){},warn(){}}};
  const run=runInNewContext(service+"\n"+s.slice(a,b)+"\n({run:initializeFreeAtStartup,wait:waitFreeAtStartup,gate:()=>workspaceCommandGate(window)})",context);
  return {...run,calls,native,entries,context,map,window,listeners};
}
test("first normal startup creates Free without renaming existing spaces",async()=>{
  const h=harness();await h.run();await h.run();assert.deepEqual(h.calls,["create","reorder","new"]);assert.ok(h.entries.some(s=>s.name==="Space"));assert.equal(h.entries[0].name,"Free");
});
test("designated Free selected once; projected child and same-name ambiguity untouched",async()=>{
  const h=harness("id1",["Space","Free"]);await h.run();await h.run();assert.deepEqual(h.calls,["id1"]);
  const p=harness("",["Space"],true);await p.run();assert.deepEqual(p.calls,[]);
  const a=harness("",["Space","Free"]);await a.run();assert.deepEqual(a.calls,[]);
});

test("late Free creation after disposal cannot write preference, reorder or select",async()=>{
  const h=harness();let resolve;
  h.native.createAndSaveWorkspace=()=>new Promise(r=>{resolve=r;});
  const p=h.run();h.context.disposed=true;
  const ws={name:"Free",uuid:"late"};h.entries.push(ws);resolve(ws);await p;
  assert.equal(h.map.get("zen.oneplane.free-space-id"),"");
  assert.deepEqual(h.calls,[]);
  assert.equal(h.entries.length,2); // native creation is not rolled back
});
test("replacement native workspace manager invalidates pending Free creation",async()=>{
  const h=harness();let resolve;
  h.native.createAndSaveWorkspace=()=>new Promise(r=>{resolve=r;});
  const p=h.run();h.window.gZenWorkspaces={...h.native};
  const ws={name:"Free",uuid:"late"};h.entries.push(ws);resolve(ws);await p;
  assert.equal(h.map.get("zen.oneplane.free-space-id"),"");assert.deepEqual(h.calls,[]);
});
test("disposal during Free reorder suppresses subsequent native selection",async()=>{
  const h=harness();let entered,resolve;const started=new Promise(r=>{entered=r;});
  h.native.reorderWorkspace=()=>new Promise(r=>{resolve=r;entered();});
  const p=h.run();await started;h.context.disposed=true;resolve();await p;
  assert.deepEqual(h.calls,["create"]);assert.equal(h.map.get("zen.oneplane.free-space-id"),"new");
});

test("Free removed during reorder is not selected",async()=>{
  const h=harness();
  h.native.reorderWorkspace=async()=>{h.entries.pop();};
  await h.run();assert.deepEqual(h.calls,["create"]);
});
test("Free designation changed during create is not overwritten",async()=>{
  const h=harness();let resolve;h.native.createAndSaveWorkspace=()=>new Promise(r=>{resolve=r;});
  const pending=h.run();h.map.set("zen.oneplane.free-space-id","id0");
  const ws={name:"Free",uuid:"late"};h.entries.push(ws);resolve(ws);await pending;
  assert.equal(h.map.get("zen.oneplane.free-space-id"),"id0");assert.deepEqual(h.calls,[]);
});
test("Free reassigned during reorder is not selected",async()=>{
  const h=harness();h.native.reorderWorkspace=async()=>h.map.set("zen.oneplane.trash-space-id","new");
  await h.run();assert.deepEqual(h.calls,["create"]);
});
test("synchronous preference observer can invalidate Free before reorder",async()=>{
  const h=harness(),set=h.context.prefs.setStringPref;
  h.context.prefs.setStringPref=(k,v)=>{set(k,v);h.context.disposed=true;};
  await h.run();assert.deepEqual(h.calls,["create"]);
});

test("failed native creation does not consume startup claim and retries without duplicate",async()=>{
 const h=harness(),create=h.native.createAndSaveWorkspace;let failed=true;
 h.native.createAndSaveWorkspace=async function(...args){if(failed){failed=false;throw Error("injected");}return create.apply(this,args);};
 await h.run();await h.run();await h.run();assert.deepEqual(h.calls,["create","reorder","new"]);assert.equal(h.entries.filter(s=>s.name==="Free").length,1);
});
test("partial native creation without role designation is not repeated or silently claimed",async()=>{
 const h=harness(),create=h.native.createAndSaveWorkspace;
 h.native.createAndSaveWorkspace=async function(...args){await create.apply(this,args);throw Error("partial");};
 await h.run();await h.run();assert.deepEqual(h.calls,["create"]);assert.equal(h.map.get("zen.oneplane.free-space-id"),"");
});

test("Free startup deadline releases only Layout waiting, not native ownership or stale role writes",async()=>{
 const h=harness();let resolve,deadline;const timers=new Set();
 h.window.setTimeout=fn=>{deadline=fn;timers.add(1);return 1;};h.window.clearTimeout=id=>timers.delete(id);
 h.native.createAndSaveWorkspace=()=>new Promise(r=>resolve=r);
 const p=h.wait();assert.ok(h.gate().pending);deadline();await p;
 assert.equal(timers.size,0);assert.ok(h.gate().pending);
 const ws={name:"Free",uuid:"late"};h.entries.push(ws);const nativePending=h.gate().pending;
 resolve(ws);await assert.rejects(nativePending,e=>e.code==="stale");
 assert.equal(h.gate().pending,null);assert.equal(h.map.get("zen.oneplane.free-space-id"),"");assert.deepEqual(h.calls,[]);
});

test("trusted startup input stops automatic follow-up without unlocking a live native command",async()=>{
 const h=harness();let resolve;const timers=new Set();
 h.window.setTimeout=()=>{timers.add(1);return 1;};h.window.clearTimeout=id=>timers.delete(id);
 h.native.createAndSaveWorkspace=()=>new Promise(r=>resolve=r);
 const p=h.wait(),pending=h.gate().pending;assert.ok(pending);
 h.listeners.get("keydown")({isTrusted:false});assert.equal(h.listeners.size,2);
 h.listeners.get("pointerdown")({isTrusted:true});await p;
 assert.equal(h.listeners.size,0);assert.equal(timers.size,0);assert.equal(h.gate().pending,pending);
 const ws={name:"Free",uuid:"late"};h.entries.push(ws);resolve(ws);
 await assert.rejects(pending,e=>e.code==="stale");assert.equal(h.map.get("zen.oneplane.free-space-id"),"");
});
