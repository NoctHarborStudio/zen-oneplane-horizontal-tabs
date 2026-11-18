import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const s=readFileSync(new URL("../src/core/bootstrap.js.part",import.meta.url),"utf8");
const a=s.indexOf("async function initializeFreeAtStartup"),b=s.indexOf("async function activate",a);
function harness(stored="",names=["Space"],projection=false){
  const entries=names.map((name,i)=>({name,uuid:"id"+i})),host={},map=new Map([["zen.oneplane.free-space-id",stored]]),calls=[];
  const native={workspaceEnabled:true,currentWindowIsSyncing:true,activeWorkspace:"id0",getWorkspaces:()=>entries,getWorkspaceFromId:id=>entries.find(s=>s.uuid===id),
    async createAndSaveWorkspace(name){calls.push("create");const ws={name,uuid:"new"};entries.push(ws);return ws;},
    async reorderWorkspace(){calls.push("reorder");},async changeWorkspaceWithID(id){calls.push(id);this.activeWorkspace=id;}};
  const window={gZenWorkspaces:native,closed:false,__oneplaneWorkspaceProjection:projection};
  const context={window,disposed:false,Services:{prefs:{getDefaultBranch:()=>({getBoolPref:(k,f)=>host[k]??f,setBoolPref:(k,v)=>host[k]=v})}},prefs:{getStringPref:(k,f)=>map.get(k)||f,setStringPref:(k,v)=>map.set(k,v)},console:{info(){},warn(){}}};
  const run=runInNewContext(s.slice(a,b)+"\ninitializeFreeAtStartup",context);
  return {run,calls,native,entries,context,map,window};
}
test("first normal startup creates Free without renaming existing spaces",async()=>{
  const h=harness();await h.run();await h.run();assert.deepEqual(h.calls,["create","reorder","new"]);assert.equal(h.entries[0].name,"Space");
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
