import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../src/"+p,import.meta.url),"utf8");
const native=read("native/tab-adapter.js.part"),ctrl=read("interactions/drag-controller.js.part"),split=read("interactions/split-drop.js.part");
const nativeCode=native.slice(native.indexOf("  function nativeStripPlacement("),native.indexOf("  function tabFromItem("));
const moveCode=ctrl.slice(ctrl.indexOf("  function moveNativeNextTo("),ctrl.indexOf("  function onStripDrop("));
function fixture(){
 const window={},sourceGroup={hasAttribute:k=>k==="split-view-group"},targetGroup={hasAttribute:k=>k==="split-view-group"};
 const make=(id,group=null,owner=window)=>({id,group,owner});
 const a=make("a",sourceGroup),b=make("b",sourceGroup),c=make("c"),d=make("d",targetGroup),e=make("e",targetGroup),f=make("f");
 const order=[a,b,c,d,e,f],readStripTopology=()=>({tabs:order.map(tab=>({tab,group:tab.group}))});
 const tabOwner=tab=>tab?.owner,validNativeTab=tab=>!!tab&&tab.owner===window&&order.includes(tab);
 const {nativeStripPlacement,nativeAdoptionOutcome}=new Function("readStripTopology","window","validNativeTab","tabOwner",nativeCode+"return {nativeStripPlacement,nativeAdoptionOutcome};")(readStripTopology,window,validNativeTab,tabOwner);
 let behavior="move",invoked=0;
 const nativeMove=(element,target,before)=>{
  invoked++;if(behavior==="throw")throw Error("native failure");if(behavior!=="move")return;
  const moved=element===sourceGroup?[a,b]:[element];
  for(const tab of moved){const i=order.indexOf(tab);if(i>=0)order.splice(i,1);}
  const targets=target===targetGroup?[d,e]:[target],boundary=before?targets[0]:targets.at(-1);
  order.splice(order.indexOf(boundary)+(before?0:1),0,...moved);
 };
 const browser={moveTabBefore:(a,b)=>nativeMove(a,b,true),moveTabAfter:(a,b)=>nativeMove(a,b,false)};
 const move=new Function("browser","nativeStripPlacement",moveCode+"return moveNativeNextTo;")(browser,nativeStripPlacement);
 return {a,b,c,d,e,f,sourceGroup,targetGroup,order,window,make,placement:nativeStripPlacement,adoption:nativeAdoptionOutcome,move,behavior:v=>behavior=v,invoked:()=>invoked};
}
test("native visible order verifies adjacent tab and atomic Split group boundaries",()=>{
 const t=fixture();
 assert.equal(t.placement(t.a,{native:t.c,before:true}),false);
 assert.equal(t.placement(t.sourceGroup,{native:t.c,before:true}),true);
 assert.equal(t.placement(t.sourceGroup,{native:t.targetGroup,before:true}),false);
 assert.equal(t.placement(t.c,{native:t.targetGroup,before:true}),true);
 assert.equal(t.placement(t.f,{native:t.targetGroup,before:false}),true);
 t.order.splice(1,1);t.order.push(t.b);
 assert.equal(t.placement(t.sourceGroup,{native:t.c,before:true}),false);
});
test("native void moves require actual order; no-op avoids command; group stays together",()=>{
 const t=fixture();
 assert.equal(t.move(t.a,{native:t.c,before:true}),true);
 assert.equal(t.invoked(),1);assert.deepEqual(t.order.map(x=>x.id),["b","a","c","d","e","f"]);
 assert.equal(t.move(t.a,{native:t.c,before:true}),true);assert.equal(t.invoked(),1);
 const ignored=fixture();ignored.behavior("ignore");
 assert.equal(ignored.move(ignored.c,{native:ignored.a,before:true}),false);
 assert.equal(ignored.invoked(),1);
 const group=fixture();assert.equal(group.move(group.sourceGroup,{native:group.targetGroup,before:true}),true);
 assert.deepEqual(group.order.map(x=>x.id),["c","a","b","d","e","f"]);
});
test("native adoption distinguishes null, wrong owner, transferred off-target and confirmed slot",()=>{
 const t=fixture(),foreign=t.make("foreign",null,{});
 assert.equal(t.adoption(null,{native:t.c,before:true}),"rejected");
 assert.equal(t.adoption(foreign,{native:t.c,before:true}),"unverified");
 const adopted=t.make("adopted");t.order.push(adopted);
 assert.equal(t.adoption(adopted,{native:t.c,before:true}),"transferred-off-target");
 t.order.splice(t.order.indexOf(adopted),1);t.order.splice(t.order.indexOf(t.c),0,adopted);
 assert.equal(t.adoption(adopted,{native:t.c,before:true}),"confirmed");
});
function foreignDrop(mode){
 const code=ctrl.slice(ctrl.indexOf("  function onStripDrop("));
 return new Function("mode",code+
  'const calls=[],window={__nocturneTrace:(n,data)=>calls.push(["trace",data.operation,data.outcome])},tab={},owner={},target={},DRAG_CONTROLLER="drag";let incomingDrag={token:7};'+
  'owner.drag={group:()=>null,markHandled:()=>calls.push("settled")};'+
  'const readDraggedTab=()=>tab,tabOwner=()=>owner,retireChangedDragViewport=()=>false,retireChangedDragChromeFrame=()=>false;'+
  'const dragPhaseInputAllowed=()=>true,toolbarDragReturnZone=()=>true,incomingDropAllowed=()=>true,dragNode=null;'+
  'const row={setAttribute:()=>{}},previewStripDrag=()=>({native:target,tab:target,before:true}),dropTarget=()=>null,validStripDropTarget=()=>true;'+
  'const isSplit=()=>false,nativeAdoptionOutcome=adopted=>adopted?"transferred-off-target":"rejected";'+
  'const clearDropMarker=()=>{},finishStripCommit=()=>calls.push("finish"),schedule=()=>{},releaseDragReveal=()=>{},console={error:()=>calls.push("error")};'+
  'const browser={tabs:[target],adoptTab:()=>{calls.push("adopt");if(mode==="throw")throw Error("native");return mode==="null"?null:{};}};'+
  'const event={isTrusted:true,preventDefault(){},stopPropagation(){}};onStripDrop(event);return calls;'
 )(mode);
}
test("rejected, partial and throwing adoption each settle source exactly once",()=>{
 for(const [mode,outcome] of [["null","rejected"],["partial","transferred-off-target"],["throw","error"]]){
  const calls=foreignDrop(mode);
  assert.equal(calls.filter(x=>x==="adopt").length,1);
  assert.equal(calls.filter(x=>x==="settled").length,1);
  assert.ok(calls.some(x=>Array.isArray(x)&&x[0]==="trace"&&x[1]==="adopt-tab"&&x[2]===outcome));
  assert.ok(calls.includes("finish"));
 }
});
function splitDrop(mode){
 const code=split.slice(split.indexOf("  function onSplitDrop("));
 return new Function("mode",code+
  'const calls=[],window={__nocturneTrace:(n,d)=>calls.push(["trace",d.operation,d.outcome])},tab={group:null,hasAttribute:()=>false},current={group:null};'+
  'const browser={selectedTab:current},tabOwner=()=>window,draggedGroup=null,draggedTab=tab;let nativeDragToken=1;const dragLifecycle={owns:t=>t===nativeDragToken},readDraggedTab=()=>tab;'+
  'const retireChangedDragViewport=()=>false,retireChangedDragChromeFrame=()=>false,splitDropAllowed=()=>true,splitDropPoint=()=>({x:.1,y:.1});'+
  'const toolbarDragReturnZone=()=>false,emptySplitTarget=()=>false,splitSide=()=>"left",validNativeTab=()=>true,dragPhaseInputAllowed=()=>true,splitSourceCurrent=(t,token)=>t===tab&&token===nativeDragToken,nativeSplitPreflight=()=>"";'+
  'const group={hasAttribute:()=>true},splitGroup=t=>t.group,isSplit=t=>!!t.group;'+
  'if(mode.startsWith("unsplit"))tab.group=group;'+
  'const unsplitTab=t=>{calls.push("unsplit");if(mode==="unsplit-success"){t.group=null;return true;}return false;};'+
  'window.gZenViewSplitter={splitTabs:()=>{calls.push("split");if(mode==="split-failure")return null;if(mode==="split-success"){tab.group=group;current.group=group;}return {};}};'+
  'const sourceHandled=()=>{calls.push("settled");calls.push("visual");nativeDragToken=null;},cancelActiveDrag=()=>calls.push("cancel"),schedule=()=>{},console={error:()=>calls.push("error")};'+
  'const event={isTrusted:true,preventDefault(){},stopPropagation(){}};onSplitDrop(event);return {calls,selected:browser.selectedTab===tab};'
 )(mode);
}
test("Split failure, partial and unsplit outcome are not treated as confirmed",()=>{
 for(const [mode,operation,outcome] of [
  ["unsplit-failure","unsplit","unverified"],["unsplit-success","unsplit","confirmed"],
  ["split-failure","split","rejected"],["split-unverified","split","unverified"],["split-success","split","confirmed"]]){
  const f=splitDrop(mode);
  assert.ok(f.calls.some(x=>Array.isArray(x)&&x[1]===operation&&x[2]===outcome));
  assert.equal(f.calls.filter(x=>x==="settled").length,1);
  assert.equal(f.calls.filter(x=>x==="visual").length,1);
  if(mode==="split-failure")assert.equal(f.selected,false);
 }
});
test("dragend rejects untrusted and stale token before accessing native placement",()=>{
 const s=read("interactions/drag-end.js.part"),body=s.slice(0,s.indexOf("  const dragController = {"));
 const run=new Function("trusted","same",body+
  'const calls=[],nativeDragToken=4,nativeDragIdentity={token:same?4:3},dragLifecycle={owns:()=>true},tab={};'+
  'const dragEndMatches=()=>true,retireChangedDragViewport=()=>false,retireChangedDragChromeFrame=()=>false;'+
  'const retireBlockedNativeTabDrag=()=>{calls.push("phase");return true;};'+
  'const placementAt=()=>{throw Error("native placement must not run")};onDragEnd({isTrusted:trusted},tab);return calls;');
 assert.deepEqual(run(false,true),[]);assert.deepEqual(run(true,false),[]);
 assert.deepEqual(run(true,true),["phase"]);
});
