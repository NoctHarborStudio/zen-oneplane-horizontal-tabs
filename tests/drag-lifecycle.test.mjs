import test from "node:test";
import assert from "node:assert/strict";
import {createDragLifecycle,dragPointerSignal,dragInterruptionKey} from "../src/algorithms/drag-lifecycle.mjs";
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
