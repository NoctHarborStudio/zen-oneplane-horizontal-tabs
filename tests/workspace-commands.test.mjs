import test from "node:test";
import assert from "node:assert/strict";
import {runWorkspaceCommand,requireWorkspaceCommand,requestWorkspaceSwitch,inspectWorkspaceSwitch,switchWorkspaceWithin,designateWorkspaceFree,workspaceCommandGate} from "../src/core/workspace-commands.mjs";
function fixture(){
 const entries=[{uuid:"a",name:"A"},{uuid:"b",name:"B"}],elements=new Map(),events=[],calls=[],values=new Map();
 let active="a",selected,changing=false;
 const tab=id=>({isConnected:true,attrs:new Map([["zen-workspace-id",id]]),getAttribute(k){return this.attrs.get(k)??null;},hasAttribute(k){return this.attrs.has(k);}});
 const element=id=>{if(!elements.has(id)){
  const e={isConnected:true,active:id==="a",tabsContainer:{isConnected:true,contains:t=>t===selected&&t.getAttribute("zen-workspace-id")===id},pinnedTabsContainer:{isConnected:true,contains:()=>false},scrollbox:{}};
  elements.set(id,e);
 }return elements.get(id);};
 const browser={visibleTabs:[],tabContainer:{},get selectedTab(){return selected;}};
 function settle(id){
  active=id;selected=tab(id);browser.visibleTabs=[selected];
  for(const s of entries)element(s.uuid).active=s.uuid===id;
  browser.tabContainer.arrowScrollbox=element(id).scrollbox;
  browser.tabContainer.pinnedTabsContainer=browser.pinnedTabsContainer=element(id).pinnedTabsContainer;
 }
 const native={workspaceEnabled:true,get isChangingWorkspace(){return changing;},get activeWorkspace(){return active;},
  getWorkspaces:()=>entries.slice(),getWorkspaceFromId:id=>entries.find(s=>s.uuid===id),workspaceElement:element,
  async changeWorkspaceWithID(id){calls.push(id);settle(id);return this.getWorkspaceFromId(id);},
  async createAndSaveWorkspace(name){calls.push("create");const ws={uuid:"new",name};entries.push(ws);element(ws.uuid);return ws;},
  saveWorkspace(ws){entries[entries.findIndex(s=>s.uuid===ws.uuid)]=ws;},
  async reorderWorkspace(id,n){calls.push("reorder");entries.splice(n,0,...entries.splice(entries.findIndex(s=>s.uuid===id),1));}};
 const win={gZenWorkspaces:native,gBrowser:browser,__nocturneTrace:(event,data)=>events.push({event,data})};
 const prefs={getStringPref:(k,d)=>values.get(k)??d,setStringPref:(k,v)=>values.set(k,v)};
 settle("a");
 return {win,native,browser,entries,events,calls,prefs,values,element,settle,setActive:id=>active=id,setChanging:v=>changing=v,anchor:{}};
}
const code=expected=>e=>e?.code===expected;
const request=(f,id,kind="home")=>requestWorkspaceSwitch(f.win,f.native,id,kind,()=>true,{motion:false});
test("native fulfilled promise and active ID do not certify structural switch",async()=>{
 const f=fixture();f.native.changeWorkspaceWithID=async id=>{f.setActive(id);return f.native.getWorkspaceFromId(id);};
 await assert.rejects(request(f,"b"),code("container-unready"));
 assert.equal(workspaceCommandGate(f.win).pending,null);
 assert.ok(f.events.some(e=>e.event==="workspace.command.switch-result"&&e.data.outcome!=="confirmed"));
});
test("native switch requires physical tab ownership and browser container binding",async()=>{
 const f=fixture();f.settle("b");assert.equal(inspectWorkspaceSwitch(f.win,f.native,"b"),"confirmed");
 f.browser.tabContainer.arrowScrollbox={};assert.equal(inspectWorkspaceSwitch(f.win,f.native,"b"),"binding-mismatch");
 f.browser.tabContainer.arrowScrollbox=f.element("b").scrollbox;
 f.browser.selectedTab.attrs.set("zen-workspace-id","a");assert.equal(inspectWorkspaceSwitch(f.win,f.native,"b"),"selection-mismatch");
});
test("placeholder can be selected even if excluded from visibleTabs; ordinary hidden tabs cannot",()=>{
 const f=fixture();f.browser.visibleTabs=[];assert.equal(inspectWorkspaceSwitch(f.win,f.native,"a"),"selection-unverified");
 const tab=f.browser.selectedTab;tab.attrs.set("zen-empty-tab","true");f.native._emptyTab=tab;
 assert.equal(inspectWorkspaceSwitch(f.win,f.native,"a"),"confirmed");
});
test("direct and visual paths share the same lease and only native outcome confirms",async()=>{
 const f=fixture();let wrapped=0;
 f.win.__zenRefinedWorkspaceTransition={run(fn,{lease}){wrapped++;assert.equal(workspaceCommandGate(f.win).owner,lease);return fn();}};
 assert.equal((await requestWorkspaceSwitch(f.win,f.native,"b","home",()=>true)).status,"confirmed");
 assert.equal(wrapped,1);assert.deepEqual(f.calls,["b"]);assert.equal(workspaceCommandGate(f.win).pending,null);
 await request(f,"b");assert.deepEqual(f.calls,["b"]);
});
test("busy window rejects competitors, even synchronously during diagnostics, without overlapping mutation",async()=>{
 const f=fixture();let release,nested;
 f.win.__nocturneTrace=(event)=>{if(event==="workspace.command.begin")nested=request(f,"a","hub");};
 f.native.changeWorkspaceWithID=id=>new Promise(r=>{release=()=>{f.settle(id);r();};});
 const a=request(f,"b");await assert.rejects(nested,code("busy"));
 await assert.rejects(request(f,"a","hub"),code("busy"));
 assert.ok(workspaceCommandGate(f.win).pending);release();assert.equal((await a).status,"confirmed");
});
test("native switch already in progress rejects without calling Zen",async()=>{
 const f=fixture();f.setChanging(true);await assert.rejects(request(f,"b"),code("native-busy"));assert.deepEqual(f.calls,[]);
});
test("manager replacement and view disposal cannot release a live command early",async()=>{
 const f=fixture();let current=true,release;
 f.native.changeWorkspaceWithID=id=>new Promise(r=>{release=()=>{f.settle(id);r();};});
 const p=requestWorkspaceSwitch(f.win,f.native,"b","home",()=>current,{motion:false});
 current=false;await assert.rejects(request(f,"a"),code("busy"));f.win.gZenWorkspaces={...f.native};
 await assert.rejects(requestWorkspaceSwitch(f.win,f.win.gZenWorkspaces,"a","hub",()=>true,{motion:false}),code("busy"));
 release();await assert.rejects(p,code("stale"));assert.equal(workspaceCommandGate(f.win).pending,null);
});
test("data token serializes distinct windows, releases on failure, never blocks independent selection",async()=>{
 const a=fixture(),b=fixture(),anchor={};let release;
 const held=runWorkspaceCommand(a.win,a.native,"data",()=>true,()=>new Promise(r=>release=r),{data:true,anchor});
 await assert.rejects(runWorkspaceCommand(b.win,b.native,"data",()=>true,()=>{}, {data:true,anchor}),code("data-busy"));
 assert.equal((await request(b,"b")).status,"confirmed");
 release();await held;
 await assert.rejects(runWorkspaceCommand(b.win,b.native,"data",()=>true,()=>{throw Error("failure");},{data:true,anchor}),/failure/);
 assert.equal(await runWorkspaceCommand(a.win,a.native,"data",()=>true,()=>42,{data:true,anchor}),42);
});
test("unavailable process anchor fails closed for data mutations",async()=>{
 const f=fixture();let calls=0;
 await assert.rejects(runWorkspaceCommand(f.win,f.native,"data",()=>true,()=>calls++,{data:true,anchor:null}),code("data-unavailable"));
 assert.equal(calls,0);assert.equal(workspaceCommandGate(f.win).pending,null);
});
test("Free designation checks external role changes, preserves partial creation, never auto-deletes",async()=>{
 const f=fixture();let resolve;
 f.native.createAndSaveWorkspace=()=>new Promise(r=>resolve=r);
 const p=runWorkspaceCommand(f.win,f.native,"free",()=>true,lease=>designateWorkspaceFree(f.win,f.native,f.prefs,lease),{data:true,anchor:f.anchor});
 f.prefs.setStringPref("zen.oneplane.free-space-id","a");
 const ws={uuid:"new",name:"Free"};f.entries.push(ws);resolve(ws);
 await assert.rejects(p,code("free-changed"));assert.equal(f.prefs.getStringPref("zen.oneplane.free-space-id",""),"a");
 assert.ok(f.native.getWorkspaceFromId("new"));assert.deepEqual(f.calls,[]);
});
test("explicit Free designation uses native rename and verified order, ambiguity does not create duplicate",async()=>{
 const f=fixture();f.entries[1].name="Free";
 const designate=id=>runWorkspaceCommand(f.win,f.native,"free",()=>true,lease=>designateWorkspaceFree(f.win,f.native,f.prefs,lease,id),{data:true,anchor:f.anchor});
 await assert.rejects(designate(null),code("free-ambiguous"));assert.deepEqual(f.calls,[]);
 assert.equal(await designate("b"),"b");assert.deepEqual(f.calls,["reorder"]);assert.equal(f.entries[0].uuid,"b");
});
test("lost data token blocks continuation and does not clear a foreign owner",async()=>{
 const f=fixture(),symbol=Symbol.for("nocturne.workspace.data-command.v1"),foreign=Symbol();let release;
 const p=runWorkspaceCommand(f.win,f.native,"data",()=>true,async lease=>{await new Promise(r=>release=r);requireWorkspaceCommand(f.win,f.native,lease);},{data:true,anchor:f.anchor});
 Object.defineProperty(f.anchor,symbol,{value:foreign,configurable:true});release();await assert.rejects(p,code("data-lease-lost"));
 assert.equal(f.anchor[symbol],foreign);
});
