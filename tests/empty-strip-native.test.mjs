import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {nocturneErrorClass} from "../src/core/error-class.mjs";
const read=p=>readFileSync(new URL("../src/"+p,import.meta.url),"utf8");
const native=read("native/tab-adapter.js.part");
const ctrl=read("interactions/drag-controller.js.part");
const strip=read("interactions/strip-drag.js.part");
const reorder=read("interactions/reorder.js.part");
const nativeCode=native.slice(native.indexOf("  function emptyStripDestination("),native.indexOf("  function nativeAdoptionOutcome("));
const ctrlCode=ctrl.slice(ctrl.indexOf("  function validStripDropTarget("),ctrl.indexOf("  function moveNativeNextTo("))+
  ctrl.slice(ctrl.indexOf("  function onStripDrop("));

function fixture(){
 const calls=[],attrs=new Set(),nativeNodes=[],mirrors=[],projected=[],targetTabs=[];
 const owner={tabs:[]},window={closed:false,tabs:targetTabs,__nocturneTrace:(name,data)=>{
   if(name==="drag.native.outcome")calls.push(["outcome",data.operation,data.outcome]);
 }};
 const tab={owner,pinned:false,hidden:false,group:null,splitView:false,closing:false,hasAttribute:()=>false};
 owner.tabs.push(tab);
 const container={isConnected:true,nodes:nativeNodes,tabs:[],querySelectorAll:()=>nativeNodes,
   querySelector:()=>null,contains:node=>container.tabs.includes(node)};
 const workspace={tabsContainer:container};
 const manager={workspaceEnabled:true,activeWorkspace:"space-a",activeWorkspaceStrip:container,
   getWorkspaceFromId:id=>id==="space-a"?{uuid:"space-a"}:null,
   workspaceElement:id=>id==="space-a"?workspace:null,
   moveTabToWorkspace(node,id){calls.push(["native-space",id]);node.attrs={"zen-workspace-id":id};container.tabs.push(node);}};
 window.gZenWorkspaces=manager;
 const box=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
 const list={isConnected:true,hidden:false,getBoundingClientRect:()=>box(10,4,140,38)};
 const plus={isConnected:true,hidden:false,getBoundingClientRect:()=>box(153,4,36,38)};
 const row={hasAttribute:key=>attrs.has(key),setAttribute:key=>attrs.add(key)};
 const tabOwner=t=>t?.owner||null,validNativeTab=t=>!!t&&!t.closing&&t.owner?.tabs?.includes(t);
 const stripNodes=()=>mirrors,readStripTopology=()=>({tabs:projected});
 const nativeFns=new Function("window","tabOwner","validNativeTab","stripNodes","readStripTopology","row","list","plus",
   nativeCode+"return {emptyStripDestination,validEmptyStripDestination,nativeEmptyAdoptionOutcome};")(
   window,tabOwner,validNativeTab,stripNodes,readStripTopology,row,list,plus);
 const event=(x=28,y=22,override={})=>({type:"drop",isTrusted:true,clientX:x,clientY:y,
   target:{closest:()=>null},preventDefault(){calls.push("prevent")},stopPropagation(){calls.push("stop")},...override});
 let dest=nativeFns.emptyStripDestination(event(),tab),mode="ok",settled=0;
 const source={group:()=>null,source:()=>tab,sourceToken:()=>7,markHandled:()=>{settled++;calls.push("handled");}};
 owner.drag=source;
 const browser={tabs:targetTabs,adoptTab:(original,opts)=>{
   calls.push(["adopt",opts]);
   if(mode==="throw")throw Error("native error");
   if(mode==="null")return null;
   const adopted={owner:window,closing:false,attrs:{"zen-workspace-id":"other"},
     getAttribute(k){return this.attrs[k]??null;}};
   targetTabs.push(adopted);
   if(mode==="wrong-owner")adopted.owner={tabs:[adopted]};
   return adopted;
 }};
 const run=new Function("fixture","nocturneErrorClass",ctrlCode+[
   'const {window,tab,owner,browser,row,event,calls,nativeFns}=fixture;',
   'const DRAG_CONTROLLER="drag",readDraggedTab=()=>tab,tabOwner=fixture.tabOwner;',
   'const validNativeTab=fixture.validNativeTab,readStripTopology=fixture.readStripTopology;',
   'let incomingDrag={token:7},dragNode=null,draggedTab=null;',
   'const retireChangedDragViewport=()=>false,retireChangedDragChromeFrame=()=>false,dragPhaseInputAllowed=()=>true;',
   'const toolbarDragReturnZone=()=>true,incomingDropAllowed=()=>true,previewStripDrag=()=>fixture.destination(),dropTarget=()=>null;',
   'const validEmptyStripDestination=nativeFns.validEmptyStripDestination;',
   'const nativeEmptyAdoptionOutcome=nativeFns.nativeEmptyAdoptionOutcome;',
   'const clearIncomingDrag=()=>false,clearLiveDrag=()=>{},clearDropMarker=()=>{},releaseDragReveal=()=>{};',
   'const schedule=()=>calls.push("schedule"),finishStripCommit=()=>calls.push("commit");',
   'const console={error:()=>calls.push("error")};onStripDrop(event());return calls;'
 ].join("\n"));
 return {tab,owner,window,manager,container,nativeNodes,mirrors,projected,attrs,
   browser,event,nativeFns,calls,source,
   run:()=>run({window,tab,owner,browser,row,event,calls,nativeFns,tabOwner,validNativeTab,readStripTopology,
     destination:()=>dest},nocturneErrorClass),setDestination:value=>dest=value,mode:value=>mode=value,settled:()=>settled};
}

test("native empty workspace and actual strip/plus coordinates gate drop",()=>{
 const f=fixture(),target=f.nativeFns.emptyStripDestination(f.event(),f.tab);
 assert.ok(target?.empty);assert.equal(target.spaceId,"space-a");
 assert.ok(f.nativeFns.emptyStripDestination(f.event(160,22),f.tab));
 for(const e of [f.event(240,22),f.event(25,100),f.event(NaN,10),
   f.event(25,10,{isTrusted:false}),f.event(25,10,{target:{closest:()=>({})}})])
   assert.equal(f.nativeFns.emptyStripDestination(e,f.tab),null);
 assert.equal(f.nativeFns.validEmptyStripDestination(target,f.event(),f.tab),true);
 f.manager.activeWorkspace="other";
 assert.equal(f.nativeFns.validEmptyStripDestination(target,f.event(),f.tab),false);
});

test("hidden tabs, native group, stale mirrors and unavailable Zen workspace fail closed",()=>{
 for(const mutate of [
   f=>f.nativeNodes.push({closing:false,hasAttribute:()=>false}),
   f=>f.container.querySelector=()=>({}),f=>f.projected.push({tab:{}}),
   f=>f.mirrors.push({}),f=>f.attrs.add("data-op-home-open"),
   f=>f.container.isConnected=false,f=>f.manager.activeWorkspaceStrip={},
   f=>f.manager.workspaceEnabled=false,f=>f.manager.moveTabToWorkspace=null,
   f=>f.manager.getWorkspaceFromId=()=>null,f=>f.manager.workspaceElement=()=>null
 ]){
   const f=fixture();mutate(f);
   assert.equal(f.nativeFns.emptyStripDestination(f.event(),f.tab),null);
 }
});

test("pinned, Essentials, Split, Folder, hidden and Glance source roles are rejected",()=>{
 for(const mutate of [
   t=>t.pinned=true,t=>t.group={},t=>t.hidden=true,t=>t.splitView=true,
   t=>t.hasAttribute=k=>k==="zen-essential",t=>t.hasAttribute=k=>k==="zen-glance-tab",
   t=>t.hasAttribute=k=>k==="split-view",t=>t.hasAttribute=k=>k==="zen-empty-tab"
 ]){
   const f=fixture();mutate(f.tab);
   assert.equal(f.nativeFns.emptyStripDestination(f.event(),f.tab),null);
 }
});

test("empty destination uses native adoption without a guessed tabIndex and verifies container",()=>{
 const f=fixture();f.run();
 assert.deepEqual(f.calls.find(x=>Array.isArray(x)&&x[0]==="adopt"),["adopt",{selectTab:true}]);
 assert.deepEqual(f.calls.find(x=>Array.isArray(x)&&x[0]==="native-space"),["native-space","space-a"]);
 assert.ok(f.calls.some(x=>Array.isArray(x)&&x[0]==="outcome"&&x[1]==="adopt-empty-workspace"&&x[2]==="confirmed"));
 assert.equal(f.settled(),1);assert.ok(f.calls.includes("commit"));
});

test("rejected, throwing and wrong-owner adoption settle exact source once",()=>{
 for(const [mode,outcome] of [["null","rejected"],["throw","error"],["wrong-owner","unverified"]]){
   const f=fixture();f.mode(mode);f.run();
   assert.equal(f.settled(),1,mode);
   assert.equal(f.calls.filter(x=>Array.isArray(x)&&x[0]==="adopt").length,1);
   assert.ok(f.calls.some(x=>Array.isArray(x)&&x[0]==="outcome"&&x[2]===outcome),mode);
 }
 const stale=fixture();stale.manager.activeWorkspace="other";stale.run();
 assert.equal(stale.calls.some(x=>Array.isArray(x)&&x[0]==="adopt"),false);
 assert.equal(stale.settled(),1);
});

test("postcondition cannot confirm a transferred tab in wrong workspace or container",()=>{
 const f=fixture(),dest=f.nativeFns.emptyStripDestination(f.event(),f.tab);
 const adopted={owner:f.window,attrs:{"zen-workspace-id":"space-a"},
   getAttribute(k){return this.attrs[k]??null;}};
 f.window.tabs.push(adopted);
 assert.equal(f.nativeFns.nativeEmptyAdoptionOutcome(adopted,dest),"transferred-off-target");
 f.container.tabs.push(adopted);
 assert.equal(f.nativeFns.nativeEmptyAdoptionOutcome(adopted,dest),"confirmed");
 adopted.attrs["zen-workspace-id"]="wrong";
 assert.equal(f.nativeFns.nativeEmptyAdoptionOutcome(adopted,dest),"transferred-off-target");
});

test("existing incoming lease tracks Workspace and cleans preview on release",()=>{
 assert.match(strip,/workspaceManager:window.gZenWorkspaces\?\?null/);
 assert.match(strip,/workspaceId:window.gZenWorkspaces\?\.activeWorkspace\?\?null/);
 assert.match(strip,/lease.workspaceManager===/);
 assert.match(strip,/lease.workspaceId===/);
 assert.match(strip,/row.setAttribute\("data-op-empty-incoming","true"\)/);
 assert.match(reorder,/row.removeAttribute\("data-op-empty-incoming"\)/);
 assert.match(ctrl,/operation="adopt-empty-workspace"/);
});

test("native move no-op never certifies an off-target transferred tab",()=>{
 const f=fixture();
 f.manager.moveTabToWorkspace=()=>{};
 f.run();
 assert.equal(f.settled(),1);
 assert.ok(f.calls.some(x=>Array.isArray(x)&&x[0]==="outcome"&&x[2]==="transferred-off-target"));
});

test("empty incoming preview is invalidated when its pointer leaves the verified hit area",()=>{
 assert.match(strip,/if\(liveDragTarget\?\.empty\|\|row.hasAttribute\("data-op-empty-incoming"\)\)clearLiveDrag\(\)/);
 assert.match(reorder,/row.hasAttribute\("data-op-empty-incoming"\)/);
});

test("native workspace getter failures fail closed without any source operation",()=>{
 for(const mutate of [
   f=>f.manager.getWorkspaceFromId=()=>{throw Error("Zen not ready");},
   f=>f.container.querySelectorAll=()=>{throw Error("native DOM replaced");}
 ]){
   const f=fixture();mutate(f);
   assert.equal(f.nativeFns.emptyStripDestination(f.event(),f.tab),null);
 }
});

test("reentrant Workspace switch during adopt does not issue an extra native move",()=>{
 const f=fixture();
 const adopt=f.browser.adoptTab;
 f.browser.adoptTab=(tab,opts)=>{
   const adopted=adopt(tab,opts);
   f.manager.activeWorkspace="other";
   return adopted;
 };
 f.run();
 assert.equal(f.calls.filter(x=>Array.isArray(x)&&x[0]==="adopt").length,1);
 assert.equal(f.calls.filter(x=>Array.isArray(x)&&x[0]==="native-space").length,0);
 assert.equal(f.settled(),1);
 assert.ok(f.calls.some(x=>Array.isArray(x)&&x[0]==="outcome"&&x[2]==="transferred-off-target"));
});
