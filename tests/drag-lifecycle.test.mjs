import test from "node:test";
import assert from "node:assert/strict";
import {createDragLifecycle,dragPointerSignal,dragInterruptionKey,dragEndMatches} from "../src/algorithms/drag-lifecycle.mjs";
test("cancel invalidates before cleanup; late release cannot commit",()=>{
  const life=createDragLifecycle();let calls=0;
  const token=life.begin("workspace",{onCancel:()=>{calls++;assert.equal(life.current(),null);assert.equal(life.finish(token),false);}});
  assert.equal(life.cancel("capture-lost",token),true);assert.equal(life.cancel("duplicate",token),false);
  assert.equal(calls,1);assert.equal(life.finish(token),false);
  const next=life.begin("workspace");assert.notEqual(next,token);
  assert.equal(life.cancel("stale-timer",token),false);assert.equal(life.finish(next),true);
});
test("only one owner; successful drop does not invoke cancel cleanup",()=>{
  const life=createDragLifecycle();let calls=0;
  const token=life.begin("tab",{onCancel:()=>calls++});
  assert.equal(life.begin("workspace"),null);assert.equal(life.owns(token,"tab"),true);
  assert.equal(life.finish(token),true);assert.equal(calls,0);assert.equal(life.current(),null);
});
test("lost mouse release cancels without dropping; unrelated pointer ignored",()=>{
  const event=(type,buttons=1,button=0,pointerId=7)=>({type,buttons,button,pointerId});
  assert.equal(dragPointerSignal(event("pointermove",0),7),"cancel");
  assert.equal(dragPointerSignal(event("pointermove"),7),"move");
  assert.equal(dragPointerSignal(event("pointerup",0),7),"drop");
  assert.equal(dragPointerSignal(event("pointerup",0,2),7),"cancel");
  assert.equal(dragPointerSignal(event("lostpointercapture"),7),"cancel");
  assert.equal(dragPointerSignal(event("pointercancel"),7),"cancel");
  assert.equal(dragPointerSignal(event("pointerup",0,0,8),7),"ignore");
});
test("escape and screenshot shortcuts are interruption signals",()=>{
  assert.equal(dragInterruptionKey({key:"Escape"}),true);
  assert.equal(dragInterruptionKey({key:"PrintScreen"}),true);
  assert.equal(dragInterruptionKey({key:"S",metaKey:true,shiftKey:true}),true);
  assert.equal(dragInterruptionKey({key:"s",shiftKey:true}),false);
});

test("late native dragend from another origin cannot finish active drag",()=>{
  const node={},tab={},identity={target:node,tab};
  assert.equal(dragEndMatches(identity,{target:node},tab),true);
  assert.equal(dragEndMatches(identity,{target:{}},tab),false);
  assert.equal(dragEndMatches(identity,{target:node},{}),false);
  assert.equal(dragEndMatches(null,{target:node},tab),false);
});

test("handoff preserves the actual painted rectangle, including long returns and split groups",async()=>{
  const {readFile}=await import("node:fs/promises");
  const s=await readFile(new URL("../src/interactions/native-drag-image.js.part",import.meta.url),"utf8");
  const a=s.indexOf("function handoffTransform("),b=s.indexOf("function cancelInsertion(",a);
  const handoff=new Function(s.slice(a,b)+"return handoffTransform")();
  for(const from of [{x:240,y:146,width:42,height:39},{x:280,y:95,width:2,height:4},{x:600,y:185,width:150,height:39}]){
    const to={x:500,y:21,width:42,height:39},h=handoff(from,to);
    assert.equal(to.x+h.x,from.x);assert.equal(to.y+h.y,from.y);
    assert.ok(Math.abs(to.width*h.sx-from.width)<1e-8);
    assert.ok(Math.abs(to.height*h.sy-from.height)<1e-8);
  }
  assert.ok(s.includes('dragGhostBody.animate(frames'));
  assert.ok(!s.includes('Math.min(34,event.clientY'));
});
test("return hysteresis rearms pull without requiring the pointer to enter the row",async()=>{
  const {readFile}=await import("node:fs/promises");
  const s=await readFile(new URL("../src/interactions/strip-drag.js.part",import.meta.url),"utf8");
  const a=s.indexOf("if(dragReentry){"),b=s.indexOf("if(dragInsertAnimation||dragReentry)",a);
  const step=new Function("p","dragReentry","dragReturnFloor","dragInsertAnimation","window",s.slice(a,b)+"return {dragReentry,dragReturnFloor}");
  let state={dragReentry:true,dragReturnFloor:.70};
  for(const p of [.6,.4,.35,.37])state=step(p,state.dragReentry,state.dragReturnFloor,null,{});
  assert.equal(state.dragReentry,true);assert.equal(state.dragReturnFloor,.35);
  state=step(.53,state.dragReentry,state.dragReturnFloor,null,{});
  assert.equal(state.dragReentry,false);
  assert.equal(step(0,true,.6,null,{}).dragReentry,false);
  assert.equal(step(0,true,.6,{},{}).dragReentry,true);
  assert.ok(s.indexOf('setDragImageMode(detach ? "content" : "inline",event)')<s.indexOf('if(dragDetachedOnce&&within)'));
});
test("Bunny return owns a single visible card and preserves native cancellation",async()=>{
  const {readFile}=await import("node:fs/promises");
  const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8");
  const [s,css,strip]=await Promise.all([read("src/interactions/native-drag-image.js.part"),read("src/styles/drag.css.part"),read("src/interactions/strip-drag.js.part")]);
  assert.ok(css.includes(':is([data-op-lane-ghost],[data-op-reinsert])'));
  assert.ok(css.includes("visibility:hidden!important;opacity:0!important;"));
  assert.ok(s.includes('node.removeAttribute("data-op-reinsert");hideGhost();animation.cancel();'));
  assert.ok(strip.includes('if(tabOwner(tab)===window&&dragDetachedOnce)'));
});
