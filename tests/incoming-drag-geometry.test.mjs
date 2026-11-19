import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../src/"+p,import.meta.url),"utf8");
const strip=read("interactions/strip-drag.js.part"),ctrl=read("interactions/drag-controller.js.part"),end=read("interactions/drag-end.js.part");
const helper=strip.slice(0,strip.indexOf("  // Use painted lane rectangles"));
const drop=ctrl.slice(ctrl.indexOf("  function onStripDrop("));
function fixture(){
 return new Function(helper+drop+`
 let viewport=[1200,800,1,0],cascadeState="idle",draggedTab=null,dragInsertPending=false,token=1,supported=true,allowPreview=false;
 const window={},tab={},owner={},DRAG_CONTROLLER="drag",attrs=new Set(),calls=[];
 const root={hasAttribute:k=>attrs.has(k)},dragLifecycle={current:()=>null},hoverSupported=()=>supported,dragViewportState=()=>viewport;
 const source={source:()=>tab,sourceToken:()=>token,group:()=>null,markHandled:(finish,t)=>calls.push(["handled",t])};
 owner.drag=source;
 const tabOwner=()=>owner,readDraggedTab=()=>tab,retireChangedDragViewport=()=>false,toolbarDragReturnZone=()=>true;
 const clearLiveDrag=()=>calls.push("live"),clearDropMarker=()=>calls.push("marker"),releaseDragReveal=()=>calls.push("hold"),refreshIndicator=()=>calls.push("indicator");
 const target={},browser={tabs:[target],adoptTab:(tab,opts)=>{calls.push(["adopt",opts.tabIndex]);return tab;}};
 const row={setAttribute:()=>{}},isSplit=()=>false,validStripDropTarget=()=>true,schedule=()=>{},finishStripCommit=()=>calls.push("commit");
 const previewStripDrag=()=>{if(!allowPreview)throw Error("stale native drop reached preview");return {native:target,tab:target,before:true};};
 const event=(type="dragover",isTrusted=true)=>({type,isTrusted,preventDefault(){calls.push("prevent")},stopPropagation(){calls.push("stop")}});
 return {tab,owner,source,calls,attrs,event,admit:e=>admitIncomingDrag(e,tab,owner),allowed:()=>incomingDropAllowed(tab,owner),
 retire:retireIncomingDrag,clear:clearIncomingDrag,drop:()=>onStripDrop(event("drop")),viewport:v=>viewport=v,token:t=>token=t,read:()=>incomingDrag,support:v=>supported=v,allowPreview:()=>allowPreview=true};
 `)();
}
test("incoming resize or DPI invalidates preview once; fresh trusted dragover re-arms it",()=>{
 for(const viewport of [[1100,800,1,0],[1200,700,1,0],[1200,800,1.5,0],[1200,800,1,1]]){
  const f=fixture();assert.equal(f.admit(f.event()),true);assert.equal(f.allowed(),true);
  f.viewport(viewport);assert.equal(f.retire(),true);assert.equal(f.allowed(),false);
  assert.deepEqual(f.calls,["live","marker","hold","indicator"]);assert.equal(f.read().invalid,true);
  f.retire();assert.equal(f.calls.length,4);
  assert.equal(f.admit(f.event("drop")),false);assert.equal(f.admit(f.event("dragover",false)),false);
  assert.equal(f.admit(f.event()),true);assert.equal(f.allowed(),true);assert.equal(f.read().invalid,false);
 }
});
test("retargeted incoming drop after resize is a no-op, suppressing only exact source detach",()=>{
 const f=fixture();f.admit(f.event());f.viewport([1100,800,1,0]);f.retire();f.drop();
 assert.deepEqual(f.calls,["live","marker","hold","indicator","prevent","stop",["handled",1]]);
 assert.equal(f.read(),null);
});
test("source supersession or controller replacement rejects old destination preview without handling new gesture",()=>{
 for(const mutate of [f=>f.token(2),f=>f.owner.drag={...f.source}]){
  const f=fixture();f.admit(f.event());mutate(f);assert.equal(f.allowed(),false);f.drop();
  assert.equal(f.calls.some(x=>Array.isArray(x)),false);assert.equal(f.read(),null);
 }
});
test("foreign drag cannot acquire a preview under conflicting motion or unsupported layout",()=>{
 for(const attr of ["data-zr-closing","data-zr-center-motion","data-zr-workspace-phase","data-zr-startup-phase"]){
  const f=fixture();f.admit(f.event());f.attrs.add(attr);assert.equal(f.admit(f.event()),false);assert.equal(f.read().invalid,true);
  assert.equal(f.allowed(),false);f.attrs.clear();assert.equal(f.admit(f.event()),true);
 }
 const f=fixture();f.support(false);assert.equal(f.admit(f.event()),false);assert.equal(f.read(),null);
});
test("source lease completion and destination cleanup are wired to existing owners",()=>{
 assert.ok(end.includes("sourceToken: () => nativeDragToken"));
 assert.ok(end.includes("expectedToken!==null&&expectedToken!==nativeDragToken"));
 assert.ok(end.includes('clearIncomingDrag("source-ended",lease)'));
 assert.ok(strip.includes("if(retireChangedDragViewport()||retireIncomingDrag())return;"));
 assert.ok(ctrl.includes("if(incoming&&incomingDrag===incoming){incomingDrag=null;releaseDragReveal();}"));
 assert.ok(read("interactions/native-drag-image.js.part").includes('clearIncomingDrag("leave-window")'));
});
test("fresh re-admitted incoming drop adopts once and completes the captured source token",()=>{
 const f=fixture();f.admit(f.event());f.viewport([1100,800,1,0]);f.retire();f.admit(f.event());f.allowPreview();f.drop();
 assert.equal(f.calls.filter(x=>Array.isArray(x)&&x[0]==="adopt").length,1);
 assert.equal(f.calls.filter(x=>Array.isArray(x)&&x[0]==="handled").length,1);
 assert.ok(f.calls.includes("commit"));assert.equal(f.read(),null);
});
test("source end clears only its captured preview and skips the destination committing the drop",()=>{
 const start=end.indexOf("    clearIncoming: "),stop=end.indexOf("    markHandled: ",start);
 const make=new Function("source","let dead=false,incomingDrag={source,token:3},cleared=0;function clearIncomingDrag(reason,lease){if(lease===incomingDrag){cleared++;incomingDrag=null;}}const controller={"+end.slice(start,stop)+"};return {clear:controller.clearIncoming,count:()=>cleared};");
 const source={},f=make(source);f.clear({},3);f.clear(source,2);assert.equal(f.count(),0);f.clear(source,3);f.clear(source,3);assert.equal(f.count(),1);
 const engine=read("interactions/drag-engine.js.part"),a=engine.indexOf("  function clearSourceIncoming("),b=engine.indexOf("  function cancelNativeDrag(",a);
 const run=new Function(engine.slice(a,b)+`
 const calls=[],window={},skip={},closed={closed:true},DRAG_CONTROLLER="drag",dragController={};
 const failed={drag:{clearIncoming(){throw Error("foreign failure")}}},other={drag:{clearIncoming:(s,t)=>calls.push([s===dragController,t])}};
 skip.drag={clearIncoming:()=>calls.push("skip")};
 const Services={wm:{getEnumerator(){const list=[window,skip,closed,failed,other];return {hasMoreElements:()=>list.length>0,getNext:()=>list.shift()}}}};
 clearSourceIncoming(5,skip);return calls;`)();
 assert.deepEqual(run,[[true,5]]);
});
test("foreign source placement remains active even outside the destination toolbar",()=>{
 const s=strip.slice(strip.indexOf("  function revealForDrag("),strip.indexOf("  function onToolbarDrop("));
 const f=new Function(s+`
 const calls=[],window={},tab={},owner={drag:{preview:()=>calls.push("preview"),outside:()=>calls.push("outside")}},DRAG_CONTROLLER="drag";
 const retireChangedDragViewport=()=>false,readDraggedTab=()=>tab,hoverSupported=()=>true,toolbarWrapper={},dragInsertPending=false,toolbarDragReturnZone=()=>false,tabOwner=()=>owner;
 const clearIncomingDrag=r=>calls.push(r);
 revealForDrag({});return calls;`)();
 assert.deepEqual(f,["preview","outside","outside-toolbar"]);
});
