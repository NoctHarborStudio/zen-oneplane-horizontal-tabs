import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../src/"+p,import.meta.url),"utf8");
const src=read("interactions/split-drop.js.part");
const snippets=src.slice(src.indexOf("  function nativeSplitPreflight("));
function fixture(mode="normal",o={}){
 const calls=[],window={__nocturneTrace:(n,d)=>calls.push(["trace",d])};
 const mk=(p,a)=>({hidden:!!p.hidden,pinned:!!p.pinned,attrs:new Set(p.attrs||[]),group:null,hasAttribute(k){return this.attrs.has(k)}});
 const tab=mk(o.source||{}),current=mk(o.target||{}),tabs=[tab,current],group={tabs:[current],hasAttribute:k=>k==="split-view-group"};
 const validNativeTab=t=>tabs.includes(t),tabOwner=()=>window,isSplit=t=>!!t.group;
 const splitGroup=t=>t.group?.hasAttribute("split-view-group")?t.group:null,groupMembers=g=>g.tabs;
 let nativeDragToken=1,draggedTab=tab,draggedGroup=null,selected=current,nativeCalls=0,phaseAllowed=true;
 const dragLifecycle={owns:t=>t===nativeDragToken};
 const browser={get selectedTab(){return selected},set selectedTab(t){
  selected=t;calls.push(["select",t===tab]);
  if(mode==="reentry")nativeDragToken=2;
  if(mode==="deleted")tabs.splice(tabs.indexOf(current),1);
  if(mode==="regroup")current.group=group;
  if(mode==="phase-change")phaseAllowed=false;
 }};
 window.gZenViewSplitter={MAX_TABS:o.limit??4,splitTabs:()=>{
  nativeCalls++;if(mode==="partial"){tab.group=current.group=group;return null;}
  if(mode==="throw"){tab.group=current.group=group;throw Error("native");}
  if(mode==="reject")return null;
  tab.group=current.group=group;return {};
 }};
 const splitZone={hasAttribute:()=>true,removeAttribute:()=>{},setAttribute:()=>{}};
 const event={isTrusted:true,clientX:1,clientY:40,preventDefault:()=>calls.push(["prevent"]),stopPropagation:()=>calls.push(["stop"]),dataTransfer:{}};
 const readDraggedTab=()=>tab,retireChangedDragViewport=()=>false,retireChangedDragChromeFrame=()=>false;
 const dragPhaseInputAllowed=()=>phaseAllowed,splitDropAllowed=()=>true,splitDropPoint=()=>({x:.01,y:.4});
 const splitSide=()=>"left",toolbarDragReturnZone=()=>mode==="return",emptySplitTarget=()=>false;
 const unsplitTab=()=>true,schedule=()=>{},console={error:()=>{}};
 const sourceHandled=(t,keep,token)=>{calls.push(["settled",token]);if(mode!=="unsettled")nativeDragToken=null};
 const cancelActiveDrag=reason=>{calls.push(["cancel",reason]);nativeDragToken=null};
 const env={window,browser,splitZone,event,validNativeTab,tabOwner,isSplit,splitGroup,groupMembers,dragLifecycle,
  get nativeDragToken(){return nativeDragToken},get draggedTab(){return draggedTab},get draggedGroup(){return draggedGroup},
  readDraggedTab,retireChangedDragViewport,retireChangedDragChromeFrame,dragPhaseInputAllowed,splitDropAllowed,splitDropPoint,
  splitSide,toolbarDragReturnZone,emptySplitTarget,unsplitTab,schedule,console,sourceHandled,cancelActiveDrag};
 const api=new Function("env","with(env){"+snippets+"return {check:nativeSplitPreflight,over:onSplitDragOver,drop:onSplitDrop};}")(env);
 return {api,tab,current,group,tabs,calls,event,browser,nativeCalls:()=>nativeCalls,token:()=>nativeDragToken};
}
test("mixed pinned, essential and live folder clone paths are not invoked as move",()=>{
 for(const [source,target] of [
  [{pinned:true},{}],[{},{pinned:true}],
  [{pinned:true,attrs:["zen-live-folder-item-id"]},{pinned:true}]]){
  const f=fixture("normal",{source,target});assert.equal(f.api.check(f.tab,f.current),"native-may-clone");
  f.api.drop(f.event);assert.equal(f.nativeCalls(),0);assert.equal(f.browser.selectedTab,f.current);
  assert.equal(f.calls.filter(x=>x[0]==="settled").length,1);
 }
});
test("Essentials never enters native splitter while support is unspecified",()=>{
 for(const [source,target] of [
  [{attrs:["zen-essential"]},{}],
  [{},{attrs:["zen-essential"]}],
  [{pinned:true},{pinned:true,attrs:["zen-essential"]}]]){
  const f=fixture("normal",{source,target});
  assert.equal(f.api.check(f.tab,f.current),"native-essentials-unsupported");
  f.api.drop(f.event);assert.equal(f.nativeCalls(),0);
 }
});
test("hidden, glance, empty and native maximum are rejected without mutation",()=>{
 for(const [source,target,reason] of [
  [{hidden:true},{},"native-hidden-or-empty"],
  [{attrs:["zen-glance-tab"]},{},"native-glance-remap"],
  [{},{attrs:["zen-empty-tab"]},"native-hidden-or-empty"]]){
  const f=fixture("normal",{source,target});assert.equal(f.api.check(f.tab,f.current),reason);
  f.api.drop(f.event);assert.equal(f.nativeCalls(),0);
 }
 const f=fixture("normal",{limit:1});f.current.group=f.group;
 assert.equal(f.api.check(f.tab,f.current),"native-split-limit");
 f.api.drop(f.event);assert.equal(f.nativeCalls(),0);
});
test("ordinary and pinned-with-pinned inputs preserve expected native split",()=>{
 for(const o of [{},{source:{pinned:true},target:{pinned:true}}]){
  const f=fixture("normal",o);assert.equal(f.api.check(f.tab,f.current),"");
  f.api.drop(f.event);assert.equal(f.nativeCalls(),1);
  assert.equal(f.calls.filter(x=>x[0]==="settled").length,1);
  assert.ok(f.calls.some(x=>x[0]==="trace"&&x[1].outcome==="confirmed"));
 }
});
test("new gesture arriving through native selection prevents stale split and cleanup",()=>{
 const f=fixture("reentry");f.api.drop(f.event);
 assert.equal(f.nativeCalls(),0);assert.equal(f.token(),2);
 assert.equal(f.calls.filter(x=>x[0]==="settled").length,0);
 assert.equal(f.calls.filter(x=>x[0]==="cancel").length,0);
});
test("selection callback removing or regrouping partner prevents stale split",()=>{
 for(const m of ["deleted","regroup","phase-change"]){
  const f=fixture(m);f.api.drop(f.event);assert.equal(f.nativeCalls(),0);
  assert.equal(f.calls.filter(x=>x[0]==="settled").length,1);
 }
});
test("partial native mutation even if null/exception never restores old selection",()=>{
 for(const m of ["partial","throw"]){
  const f=fixture(m);f.api.drop(f.event);
  assert.equal(f.nativeCalls(),1);assert.equal(f.browser.selectedTab,f.tab);
  assert.equal(f.calls.filter(x=>x[0]==="settled").length,1);
 }
});
test("dragover refuses to advertise a native cloning drop",()=>{
 const f=fixture("normal",{source:{pinned:true}});
 f.api.over(f.event);assert.equal(f.calls.filter(x=>x[0]==="prevent").length,0);
});
test("Split toolbar return and failed source finish share the exact-token finalizer",()=>{
 const returned=fixture("return");returned.api.drop(returned.event);
 assert.equal(returned.nativeCalls(),0);assert.equal(returned.calls.filter(x=>x[0]==="settled").length,1);
 assert.equal(returned.calls.filter(x=>x[0]==="cancel").length,0);
 assert.ok(returned.calls.some(x=>x[0]==="trace"&&x[1].operation==="return-to-strip"&&x[1].outcome==="no-op"));
 const unsettled=fixture("unsettled");unsettled.api.drop(unsettled.event);
 assert.equal(unsettled.nativeCalls(),1);
 assert.equal(unsettled.calls.filter(x=>x[0]==="settled").length,1);
 assert.ok(unsettled.calls.some(x=>x[0]==="cancel"&&x[1]==="split-settle-incomplete"));
 assert.equal(unsettled.token(),null);
});
