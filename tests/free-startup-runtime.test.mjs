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
  const run=runInNewContext(s.slice(a,b)+"\ninitializeFreeAtStartup",{window,disposed:false,Services:{prefs:{getDefaultBranch:()=>({getBoolPref:(k,f)=>host[k]??f,setBoolPref:(k,v)=>host[k]=v})}},prefs:{getStringPref:(k,f)=>map.get(k)||f,setStringPref:(k,v)=>map.set(k,v)},console:{info(){},warn(){}}});
  return {run,calls,native,entries};
}
test("first normal startup creates Free without renaming existing spaces",async()=>{
  const h=harness();await h.run();await h.run();assert.deepEqual(h.calls,["create","reorder","new"]);assert.equal(h.entries[0].name,"Space");
});
test("designated Free selected once; projected child and same-name ambiguity untouched",async()=>{
  const h=harness("id1",["Space","Free"]);await h.run();await h.run();assert.deepEqual(h.calls,["id1"]);
  const p=harness("",["Space"],true);await p.run();assert.deepEqual(p.calls,[]);
  const a=harness("",["Space","Free"]);await a.run();assert.deepEqual(a.calls,[]);
});
