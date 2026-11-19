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

test("Motion Lab magnet reverses exactly and anchors only the source side",async()=>{
  const {readFile}=await import("node:fs/promises");
  const read=p=>readFile(new URL("../src/interactions/"+p,import.meta.url),"utf8");
  const [img,state,strip,ctrl]=await Promise.all([read("native-drag-image.js.part"),read("drag-state.js.part"),read("strip-drag.js.part"),read("drag-controller.js.part")]);
  const a=img.indexOf("const bunnyClamp"),b=img.indexOf("function bunnyRect(",a);
  const {pose,slot,shift,progress}=new Function("BUNNY_EDGE_PAD","PULL_DISTANCE","BUNNY_DETACH_THRESHOLD",img.slice(a,b)+"return {pose:bunnyPose,slot:bunnySlot,shift:bunnyNeighborShift,progress:bunnyProgress}")(3,30,.96);
  const intersect=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1e-7;
  for(const side of ["L","R"])for(const y of [28,73])for(const width of [36,115])for(const sourceIndex of [0,1,2,3]){
    const gap=3,sign=side==="L"?-1:1,home=side==="L"?250:390,items=[];let edge=home+sign*gap;
    for(let i=0;i<4;i++){const w=i===sourceIndex?width:36;const x=edge+sign*w/2;items.push({x,width:w,left:x-w/2,right:x+w/2});edge+=sign*(w+gap);}
    const anchor={...items[sourceIndex],y,height:30},full={width:width+6,height:39},frozenEdge=y+18;
    const at=i=>{const p=i/100;return pose(p,anchor,{x:anchor.x+24,y:frozenEdge+30*.96*p},full,side,gap,frozenEdge)};
    const curve=Array.from({length:101},(_,i)=>at(i)),reverse=Array.from({length:101},(_,i)=>at(100-i)).reverse();
    assert.deepEqual(curve,reverse);
    assert.equal(curve[0].x,anchor.x);assert.equal(curve[0].width,width);assert.equal(curve[0].slot,1);
    assert.ok(Math.abs(curve.at(-1).width-full.width)<1e-8);assert.ok(Math.abs(curve.at(-1).slot-.04)<1e-8);
    assert.ok(curve[62].width<full.width*.2);
    for(let j=0;j<=100;j++){
      const p=j/100,sl=slot(p,anchor,side,gap),g=curve[j];
      const boxes=items.map((r,i)=>{if(i===sourceIndex)return {left:sl.x-sl.width/2,right:sl.x+sl.width/2};const dx=shift(p,anchor,side,gap,i>sourceIndex);if(i<sourceIndex)assert.equal(dx,0);return {left:r.left+dx,right:r.right+dx};});
      for(let i=0;i<boxes.length;i++){assert.ok(side==="L"?boxes[i].right<=home:boxes[i].left>=home);for(let k=i+1;k<boxes.length;k++)assert.equal(intersect(boxes[i],boxes[k]),false);}
      if(g.free===0){assert.ok(g.x-g.width/2>=boxes[sourceIndex].left-1e-7);assert.ok(g.x+g.width/2<=boxes[sourceIndex].right+1e-7);}
      if(j)assert.ok(curve[j].slot<=curve[j-1].slot);
    }
  }
  assert.equal(progress(.96),1);assert.equal(progress(.48),.5);assert.equal(progress(0),0);
  assert.ok(state.includes("BUNNY_DETACH_THRESHOLD=.96"));
  assert.ok(ctrl.includes("dragEdge = grabbed.bottom + BUNNY_EDGE_PAD"));
  assert.ok(strip.includes("const p = bunnyPullProgress(event.clientY,dragEdge)"));
  assert.ok(strip.includes("const threshold=BUNNY_DETACH_THRESHOLD"));
  assert.ok(strip.includes("if(p>0&&paintBunnyPull(event,p))"));
  assert.ok(img.includes("paintBunnyAt(p,{x:bunnyMix"));
  assert.ok(!img.includes("bunnyInsertionFrames"));assert.ok(!strip.includes("seekInsertion"));
});
test("magnetic paint freezes native slots, reverses neighbors and clips chrome without a timer",async()=>{
  const {readFile}=await import("node:fs/promises");
  const img=await readFile(new URL("../src/interactions/native-drag-image.js.part",import.meta.url),"utf8");
  const css=await readFile(new URL("../src/styles/drag.css.part",import.meta.url),"utf8");
  const a=img.indexOf("const bunnyClamp"),b=img.indexOf("function clearBunnyPull(",a);
  const transforms=[],positions=[],shifts=[],attrs=new Set(),clips=[];
  const node={setAttribute:k=>attrs.add(k)},outer={style:{setProperty:(k,v)=>shifts.push(v)}};
  const ghost={hidden:true,style:{setProperty:(k,v)=>clips.push(v),removeProperty:()=>clips.push("")}},body={style:{set transform(v){transforms.push(v)}}};
  const f=new Function("BUNNY_EDGE_PAD","PULL_DISTANCE","BUNNY_DETACH_THRESHOLD","dragNode","dragGhost","dragGhostBody","positionGhost","refreshIndicator","window","outer","let dragBunnyAnchor={x:100,y:25,width:36,height:30},dragBunnyFull={width:42,height:39},dragBunnyLayout={side:'L',gap:3,obstacles:[{node:outer,box:{left:43,right:79,top:10,bottom:40},outer:true}]},dragImageMode='inline',dragEdge=43,dragPull=0;"+img.slice(a,b)+"return {paint:paintBunnyPull,clip:bunnyClip}") (3,30,.96,node,ghost,body,(x,y)=>positions.push([x,y]),()=>{},{},outer);
  for(const p of [.24,.48,.72,.48,.24])assert.equal(f.paint({clientX:110,clientY:70},p),true);
  assert.equal(transforms[0],transforms[4]);assert.equal(transforms[1],transforms[3]);assert.deepEqual(positions[1],positions[3]);assert.equal(shifts[0],shifts[4]);assert.equal(shifts[1],shifts[3]);
  assert.ok(attrs.has("data-op-lane-ghost"));assert.equal(ghost.hidden,false);
  assert.ok(css.includes('[data-op-detached]:not([data-op-magnetic-source])'));
  assert.ok(css.includes("var(--op-bunny-x,0px)"));
  assert.ok(!img.slice(a,b).includes("requestAnimationFrame"));
  const pose={x:100,y:50,width:42,height:39},full={width:42,height:39};
  const one={left:80,right:115,top:30,bottom:65},two={left:95,right:125,top:30,bottom:65};
  const union=f.clip(pose,full,[one,two]);assert.ok(union.startsWith('path(evenodd,'));
  assert.equal((union.match(/M /g)||[]).length,2,"overlapping holes must merge");
  assert.equal(f.clip(pose,full,[{left:200,right:220,top:100,bottom:130}]),"");
});
test("early toolbar return drop finishes native ownership but retains the visual tail",async()=>{
  const {readFile}=await import("node:fs/promises");
  const read=p=>readFile(new URL("../src/interactions/"+p,import.meta.url),"utf8");
  const [end,img,ctrl,strip,engine]=await Promise.all([read("drag-end.js.part"),read("native-drag-image.js.part"),read("drag-controller.js.part"),read("strip-drag.js.part"),read("drag-engine.js.part")]);
  const a=end.indexOf("markHandled: "),b=end.indexOf("\n  };",a);
  const setup=new Function("let dragHandled=false,draggedTab={},draggedGroup={},dragStartPoint={},dragImageMode='inline',dragInsertAnimation={currentTime:250},dragInsertPending=false,nativeDragToken=1,ended=0,finished=0,held=0;const clearSourceIncoming=()=>{},finishNativeDragLifecycle=()=>++finished===1,endDragVisual=()=>ended++,finishInsertionAfterDrop=()=>{dragInsertPending=true;held++;};const controller={"+end.slice(a,b)+"};return {mark:controller.markHandled,read:()=>({dragHandled,draggedTab,draggedGroup,dragStartPoint,dragInsertPending,ended,finished,held})}")();
  setup.mark(true);
  assert.deepEqual(setup.read(),{dragHandled:true,draggedTab:null,draggedGroup:null,dragStartPoint:null,dragInsertPending:true,ended:0,finished:1,held:1});
  setup.mark(true);assert.equal(setup.read().ended,0);
  assert.ok(img.includes("if(dragInsertPending)endDragVisual(true);"));
  assert.ok(ctrl.includes("dragInsertPending=false;"));
  assert.ok(strip.includes("prepareBunnyDrop(event);"));
  assert.ok(strip.includes("sourceHandled(tab,true);"));
  assert.ok(engine.includes("if(dragInsertPending)endDragVisual();"));
});

test("Bunny return restores source highlight and hover only on the visible card",async()=>{
  const {readFile}=await import("node:fs/promises");
  const read=p=>readFile(new URL("../src/interactions/"+p,import.meta.url),"utf8");
  const [ctrl,strip,end,img]=await Promise.all([read("drag-controller.js.part"),read("strip-drag.js.part"),read("drag-end.js.part"),read("native-drag-image.js.part")]);
  const a=strip.indexOf("if(dragDetachedOnce&&within)"),b=strip.indexOf("\n    }\n    if (!within)",a);
  const branch=strip.slice(a,b);
  const attrs=new Set();let refresh=0;
  const restore=new Function("event","dragNode","clearLaneDrag","clearDropMarker","refreshIndicator","const dragDetachedOnce=true,within=true;"+branch);
  const event={preventDefault(){},stopPropagation(){},dataTransfer:{}};
  const node={setAttribute:k=>attrs.add(k)};
  for(let i=0;i<3;i++)restore(event,node,()=>attrs.delete("data-op-drag-follow"),()=>{},()=>refresh++);
  assert.ok(attrs.has("data-op-drag-follow"));assert.equal(refresh,3);
  const start=ctrl.indexOf("function restoreReturnedHover("),stop=ctrl.indexOf("function endDragVisual(",start);
  const clip={getBoundingClientRect:()=>({left:5,right:70,top:0,bottom:50})};
  const card={matches:()=>true,getBoundingClientRect:()=>({left:10,right:46,top:6,bottom:36}),closest:()=>clip};
  const h=new Function("list","hoverSupported","let hoverTab=null,lastHoverPointer=null;const selectHover=(n)=>hoverTab=n;"+ctrl.slice(start,stop)+"return restoreReturnedHover")({contains:()=>true},()=>true);
  assert.equal(h(card,{x:20,y:20}),true);assert.equal(h(card,{x:50,y:20}),false);assert.equal(h(card,{x:20,y:40}),false);
  assert.equal(h(card,null),false);
  assert.ok(end.includes("endDragVisual(returned&&!dt?.mozUserCancelled)"));
  assert.ok(end.includes("if(!keep)endDragVisual(finishReturn);"));
  assert.ok(img.includes("dragReturnPoint={x:event.clientX,y:event.clientY}"));
});
