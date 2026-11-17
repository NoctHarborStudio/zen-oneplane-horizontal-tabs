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

test("Bunny uses a frozen card-local edge, independent of the native toolbar zone",async()=>{
  const {readFile}=await import("node:fs/promises");
  const read=p=>readFile(new URL("../src/interactions/"+p,import.meta.url),"utf8");
  const [state,start,strip]=await Promise.all([read("drag-state.js.part"),read("drag-controller.js.part"),read("strip-drag.js.part")]);
  const a=state.indexOf("function bunnyPullProgress("),b=state.indexOf("  let dragGhost",a);
  const progress=new Function("PULL_DISTANCE",state.slice(a,b)+"return bunnyPullProgress")(30);
  const upper=36+3,lower=88+3;
  for(const edge of [upper,lower]){
    assert.equal(progress(edge-1,edge),0);
    assert.equal(progress(edge,edge),0);
    assert.equal(progress(edge+15,edge),.5);
    assert.equal(progress(edge+30,edge),1);
    assert.ok(progress(edge+29,edge)>=.96);
    assert.ok(progress(edge+21,edge)<.72);
  }
  assert.equal(progress(upper+15,lower),0);
  assert.ok(start.includes("dragEdge = grabbed.bottom + BUNNY_EDGE_PAD"));
  assert.ok(strip.includes("const p = bunnyPullProgress(event.clientY,dragEdge)"));
  assert.ok(!strip.includes("dragEdge = Math.max"));
  assert.ok(!strip.includes("const p = within?0"));
});
test("lane pull keeps the same visible ghost across repeated pointer events",async()=>{
  const {readFile}=await import("node:fs/promises");
  const s=await readFile(new URL("../src/interactions/strip-drag.js.part",import.meta.url),"utf8");
  const a=s.indexOf("function prepareLanePull("),b=s.indexOf("function showLaneGhost(",a);
  const attrs=new Set(),row={hasAttribute:k=>attrs.has(k),setAttribute:k=>attrs.add(k)};
  let clears=0,stops=0,markers=0;
  const step=new Function("row","dragShifted","clearLiveDrag","stopLaneAutoscroll","clearDropMarker","let liveDragTarget={};"+s.slice(a,b)+"return prepareLanePull")(row,new Set(),()=>{clears++;attrs.clear();},()=>stops++,()=>markers++);
  step();step();step();
  assert.equal(clears,1);assert.equal(stops,3);assert.equal(markers,3);
  assert.ok(attrs.has("data-op-lane-drag"));
  assert.ok(s.includes("prepareLanePull();setPull(p);showLaneGhost(event,p)"));
  assert.ok(s.includes("clearLaneDrag();clearDropMarker();return;"));
});

test("Bunny insertion preserves travel before a visible compression and rebound",async()=>{
  const {readFile}=await import("node:fs/promises");
  const s=await readFile(new URL("../src/interactions/native-drag-image.js.part",import.meta.url),"utf8");
  const a=s.indexOf("const BUNNY_INSERT_DURATION="),b=s.indexOf("function cancelInsertion(",a);
  const {frames,duration}=new Function(s.slice(a,b)+"return {frames:bunnyInsertionFrames,duration:BUNNY_INSERT_DURATION}")();
  assert.equal(duration,400);
  const start={x:4,y:43,sx:1,sy:1},sx=36/42,sy=30/39,f=frames(start,sx,sy);
  assert.deepEqual(f.map(x=>x.offset),[0,.30,.57,.77,.91,1]);
  assert.equal(f[0].transform,"translate(4px,43px) scale(1,1)");
  assert.ok(f[1].transform.includes(String(43*.57)+"px"));
  assert.ok(f[2].transform.includes("scale("+sx*.43+","+sy*.69+")"));
  assert.ok(f[3].transform.includes("scale("+sx*1.13+","+sy*.84+")"));
  assert.equal(f.at(-1).transform,"translate(0px,0px) scale("+sx+","+sy+")");
  assert.ok(s.includes('duration:BUNNY_INSERT_DURATION,easing:"linear"'));
});
test("early toolbar return drop finishes native ownership but retains the visual tail",async()=>{
  const {readFile}=await import("node:fs/promises");
  const read=p=>readFile(new URL("../src/interactions/"+p,import.meta.url),"utf8");
  const [end,img,ctrl,strip,engine]=await Promise.all([read("drag-end.js.part"),read("native-drag-image.js.part"),read("drag-controller.js.part"),read("strip-drag.js.part"),read("drag-engine.js.part")]);
  const a=end.indexOf("markHandled: "),b=end.indexOf("\n  };",a);
  const setup=new Function("let dragHandled=false,draggedTab={},draggedGroup={},dragStartPoint={},dragImageMode='inline',dragInsertAnimation={currentTime:250},dragInsertPending=false,ended=0,finished=0,held=0;const BUNNY_INSERT_DURATION=400,window={};const finishNativeDragLifecycle=()=>++finished===1,endDragVisual=()=>ended++,holdToolbarForReturn=()=>held++,finishInsertionAfterDrop=()=>{dragInsertPending=true;holdToolbarForReturn();};const controller={"+end.slice(a,b)+"};return {mark:controller.markHandled,read:()=>({dragHandled,draggedTab,draggedGroup,dragStartPoint,dragInsertPending,ended,finished,held})}")();
  setup.mark(true);
  assert.deepEqual(setup.read(),{dragHandled:true,draggedTab:null,draggedGroup:null,dragStartPoint:null,dragInsertPending:true,ended:0,finished:1,held:1});
  setup.mark(true);assert.equal(setup.read().ended,0);
  assert.ok(img.includes("if(dragInsertPending){endDragVisual();return;}"));
  assert.ok(ctrl.includes("dragInsertPending=false;"));
  assert.ok(strip.includes("sourceHandled(tab,true);"));
  assert.ok(engine.includes("if(dragInsertPending)endDragVisual();"));
});

test("Bunny insertion scrubs the pointer both ways, holds still and only plays on accepted drop",async()=>{
  const {readFile}=await import("node:fs/promises");
  const s=await readFile(new URL("../src/interactions/native-drag-image.js.part",import.meta.url),"utf8");
  const a=s.indexOf("function bunnyInsertionProgress("),b=s.indexOf("function cancelInsertion(",a);
  const harness=()=>new Function("let played=0,ended=0,hidden=0,cancelled=0,held=0,refreshed=0;let dragInsertAnimation={currentTime:0,play(){played++},cancel(){cancelled++}},dragInsertNode={removeAttribute(){}},dragInsertPending=false,dragImageMode='inline';const BUNNY_RETURN_THRESHOLD=.72,BUNNY_INSERT_DURATION=400,window={},holdToolbarForReturn=()=>held++,hideGhost=()=>hidden++,endDragVisual=()=>ended++,refreshIndicator=()=>refreshed++;"+s.slice(a,b)+"return {seekInsertion,finishInsertionAfterDrop,read:()=>({time:dragInsertAnimation?.currentTime,played,ended,hidden,cancelled,held,refreshed,pending:dragInsertPending})}")();
  const f=harness();
  for(const [p,expected] of [[.72,0],[.36,200],[.36,200],[.54,100],[.9,0],[.18,300]]){
    assert.equal(f.seekInsertion(p),true);assert.ok(Math.abs(f.read().time-expected)<1e-7);assert.equal(f.read().played,0);
  }
  f.finishInsertionAfterDrop();assert.equal(f.read().time,300);assert.equal(f.read().played,1);assert.equal(f.read().pending,true);assert.equal(f.seekInsertion(.6),false);
  const g=harness();g.seekInsertion(0);assert.equal(g.read().hidden,1);assert.equal(g.read().cancelled,1);assert.equal(g.read().played,0);assert.equal(g.finishInsertionAfterDrop(),false);
  assert.ok(s.includes("animation.pause();"));assert.ok(s.includes("animation.currentTime=0;"));
});
