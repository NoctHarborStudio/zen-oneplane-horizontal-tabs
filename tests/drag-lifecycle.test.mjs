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

test("Bunny uses one reversible curve for card and slot, including split groups",async()=>{
  const {readFile}=await import("node:fs/promises");
  const read=p=>readFile(new URL("../src/interactions/"+p,import.meta.url),"utf8");
  const [img,state,strip,ctrl]=await Promise.all([read("native-drag-image.js.part"),read("drag-state.js.part"),read("strip-drag.js.part"),read("drag-controller.js.part")]);
  const a=img.indexOf("function bunnyPose("),b=img.indexOf("function captureBunnyAnchor(",a);
  const {pose,progress}=new Function("BUNNY_DETACH_THRESHOLD",img.slice(a,b)+"return {pose:bunnyPose,progress:bunnyProgress}")(.96);
  for(const anchor of [{x:120,y:28,width:36,height:30},{x:400,y:73,width:115,height:34}]){
    const full={width:anchor.width+6,height:anchor.height+9},edge=anchor.y+anchor.height/2+3;
    const curve=Array.from({length:101},(_,i)=>{const p=i/100;return pose(p,anchor,{x:anchor.x+12,y:edge+30*.96*p},full)});
    const reversed=Array.from({length:101},(_,i)=>{const p=(100-i)/100;return pose(p,anchor,{x:anchor.x+12,y:edge+30*.96*p},full)});
    assert.deepEqual(curve,reversed.reverse());
    assert.equal(curve[0].x,anchor.x);assert.equal(curve[0].y,anchor.y);assert.equal(curve[0].width,anchor.width);assert.equal(curve[0].slot,1);
    assert.ok(Math.abs(curve.at(-1).width-full.width)<1e-8);assert.ok(Math.abs(curve.at(-1).slot-.05)<1e-8);
    assert.ok(curve[70].width<full.width*.2);
    assert.ok(curve[40].width>curve[70].width&&curve[90].width>curve[70].width);
    for(let i=1;i<curve.length;i++)assert.ok(curve[i].slot<=curve[i-1].slot);
    assert.equal(progress(.96),1);assert.equal(progress(.48),.5);assert.equal(progress(0),0);
  }
  assert.ok(state.includes("BUNNY_DETACH_THRESHOLD=.96"));
  assert.ok(ctrl.includes("dragEdge = grabbed.bottom + BUNNY_EDGE_PAD"));
  assert.ok(strip.includes("const p = bunnyPullProgress(event.clientY,dragEdge)"));
  assert.ok(strip.includes("const threshold=BUNNY_DETACH_THRESHOLD"));
  assert.ok(strip.includes("if(p>0&&paintBunnyPull(event,p))"));
  assert.ok(img.includes("setPull(t,pose.slot);"));
  assert.ok(img.includes("bunnyPose(t*(1-u),anchor,point,full)"));
  assert.ok(!img.includes("bunnyInsertionFrames"));assert.ok(!strip.includes("seekInsertion"));
  assert.ok(!strip.includes("const p = within?0"));
});
test("single shared ghost, no timer while pointer holds or reverses",async()=>{
  const {readFile}=await import("node:fs/promises");
  const img=await readFile(new URL("../src/interactions/native-drag-image.js.part",import.meta.url),"utf8");
  const css=await readFile(new URL("../src/styles/drag.css.part",import.meta.url),"utf8");
  const a=img.indexOf("function bunnyPose("),b=img.indexOf("function clearBunnyPull(",a);
  let transforms=[],positions=[],pulls=[],attrs=new Set();
  const node={setAttribute:(k)=>attrs.add(k)},ghost={hidden:true},body={style:{set transform(v){transforms.push(v)}}};
  const f=new Function("BUNNY_DETACH_THRESHOLD","dragNode","dragGhost","dragGhostBody","setPull","positionGhost","window","let dragBunnyAnchor={x:100,y:25,width:36,height:30},dragBunnyFull={width:42,height:39},dragImageMode='inline';"+img.slice(a,b)+"return paintBunnyPull")(.96,node,ghost,body,p=>pulls.push(p),(x,y)=>positions.push([x,y]),{});
  for(const p of [.24,.48,.72,.48,.24])assert.equal(f({clientX:110,clientY:70},p),true);
  assert.equal(transforms[0],transforms[4]);assert.equal(transforms[1],transforms[3]);assert.deepEqual(positions[1],positions[3]);assert.deepEqual(pulls,[.25,.5,.75,.5,.25]);
  assert.ok(attrs.has("data-op-lane-ghost"));assert.equal(ghost.hidden,false);
  assert.ok(css.includes(':is([data-op-lane-ghost],[data-op-reinsert])'));
  assert.ok(!img.slice(a,b).includes(".animate("));
});
test("early toolbar return drop finishes native ownership but retains the visual tail",async()=>{
  const {readFile}=await import("node:fs/promises");
  const read=p=>readFile(new URL("../src/interactions/"+p,import.meta.url),"utf8");
  const [end,img,ctrl,strip,engine]=await Promise.all([read("drag-end.js.part"),read("native-drag-image.js.part"),read("drag-controller.js.part"),read("strip-drag.js.part"),read("drag-engine.js.part")]);
  const a=end.indexOf("markHandled: "),b=end.indexOf("\n  };",a);
  const setup=new Function("let dragHandled=false,draggedTab={},draggedGroup={},dragStartPoint={},dragImageMode='inline',dragInsertAnimation={currentTime:250},dragInsertPending=false,ended=0,finished=0,held=0;const finishNativeDragLifecycle=()=>++finished===1,endDragVisual=()=>ended++,finishInsertionAfterDrop=()=>{dragInsertPending=true;held++;};const controller={"+end.slice(a,b)+"};return {mark:controller.markHandled,read:()=>({dragHandled,draggedTab,draggedGroup,dragStartPoint,dragInsertPending,ended,finished,held})}")();
  setup.mark(true);
  assert.deepEqual(setup.read(),{dragHandled:true,draggedTab:null,draggedGroup:null,dragStartPoint:null,dragInsertPending:true,ended:0,finished:1,held:1});
  setup.mark(true);assert.equal(setup.read().ended,0);
  assert.ok(img.includes("if(dragInsertPending){endDragVisual();return;}"));
  assert.ok(ctrl.includes("dragInsertPending=false;"));
  assert.ok(strip.includes("prepareBunnyDrop(event);"));
  assert.ok(strip.includes("sourceHandled(tab,true);"));
  assert.ok(engine.includes("if(dragInsertPending)endDragVisual();"));
});
