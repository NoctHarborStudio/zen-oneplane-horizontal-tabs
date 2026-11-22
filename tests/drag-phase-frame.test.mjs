import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../src/"+p,import.meta.url),"utf8");
const state=read("interactions/drag-state.js.part");
const code=state.slice(state.indexOf("  function dragViewportState("),state.indexOf("  let dropMarker"));
function fixture(){
 return new Function(code+`
    let dead=false,dragViewport=null,cascadeState="idle",active=true,supported=true;
    const attrs=new Set(),barAttrs=new Set(),shieldAttrs=new Set(),calls=[];
    const window={innerWidth:1100,innerHeight:800,devicePixelRatio:1,windowState:0,__nocturneTrace:()=>{}};
    const root={hasAttribute:k=>attrs.has(k)},shield={hasAttribute:k=>shieldAttrs.has(k)},bar={hasAttribute:k=>barAttrs.has(k)};
    const addressBar=()=>bar,hoverSupported=()=>supported,dragLifecycle={current:()=>active?{kind:"tab"}:null};
    const row={},centerIds=new Set(["oneplane-tabs","oneplane-center-start","oneplane-center-end"]);
    const rect=(left,right)=>({left,right,width:right-left});
    const x={left:50,right:1000,outer:1100};
    const left={id:"left",localName:"toolbarbutton",getBoundingClientRect:()=>rect(x.left,x.left+30)};
    const right={id:"right",localName:"toolbarbutton",getBoundingClientRect:()=>rect(x.right,x.right+30)};
    const spacer={id:"oneplane-center-start",localName:"box",getBoundingClientRect:()=>rect(0,0)};
    const target={isConnected:true,children:[left,spacer,right,row],getBoundingClientRect:()=>rect(0,x.outer)};
    const cancelActiveDrag=reason=>{calls.push(reason);dragChromeFrame=null;active=false};
    return {x,calls,attrs,barAttrs,shieldAttrs,target,left,right,window,
      phase:dragPhaseInputAllowed,blocked:retireBlockedNativeTabDrag,
      capture:()=>dragChromeFrame=readDragChromeFrame(),same:()=>sameDragChromeFrame(dragChromeFrame,readDragChromeFrame()),
      retire:retireChangedDragChromeFrame,read:readDragChromeFrame,setActive:v=>active=v,setSupported:v=>supported=v};
  `)();
}
test("chrome frame ignores moving tab lanes and subpixel jitter",()=>{
 const f=fixture();f.capture();assert.equal(f.same(),true);
 f.target.children[3].getBoundingClientRect=()=>({left:5,right:600});assert.equal(f.same(),true);
 f.x.left+=.45;assert.equal(f.same(),true);
});
test("native edge movement, width, replacement and unavailable host invalidate local gesture",()=>{
 for(const key of ["left","right","outer"]){
  const f=fixture();f.capture();f.x[key]+=4;assert.equal(f.same(),false);
  assert.equal(f.retire("drop"),true);assert.deepEqual(f.calls,["chrome-frame-changed"]);assert.equal(f.retire(),false);
 }
 const replaced=fixture();replaced.capture();replaced.target.children[0]={...replaced.left};assert.equal(replaced.retire(),true);
 const detached=fixture();detached.capture();detached.target.isConnected=false;assert.equal(detached.retire(),true);
});
test("native phase guard rejects motion, address and shield, but not unrelated pointer gestures",()=>{
 const f=fixture();assert.equal(f.phase(),true);assert.equal(f.blocked(),false);
 for(const key of ["data-zr-closing","data-zr-center-motion","data-zr-workspace-phase","data-zr-startup-phase"]){
  const t=fixture();t.attrs.add(key);assert.equal(t.phase(),false);assert.equal(t.blocked(),true);assert.equal(t.calls[0],"phase-conflict");
 }
 for(const [which,key] of [["barAttrs","focused"],["barAttrs","open"],["shieldAttrs","data-pressed"]]){
  const t=fixture();t[which].add(key);assert.equal(t.phase(),false);assert.equal(t.blocked(),true);
 }
 const t=fixture();t.setActive(false);t.attrs.add("data-zr-closing");assert.equal(t.blocked(),false);
 const d=fixture();d.setSupported(false);assert.equal(d.phase(),false);
});
test("phase-blocked local strip drop cannot invoke native tab commands",()=>{
 const src=read("interactions/drag-controller.js.part"),body=src.slice(src.indexOf("  function onStripDrop("));
 const run=new Function("foreign",body+`
  const calls=[],window={},tab={},owner=foreign?{}:window,incomingDrag={},DRAG_CONTROLLER="drag";
  const event={isTrusted:true,preventDefault:()=>calls.push("prevent"),stopPropagation:()=>calls.push("stop")};
  const readDraggedTab=()=>tab,tabOwner=()=>owner,retireChangedDragViewport=()=>false,retireChangedDragChromeFrame=()=>false;
  const dragPhaseInputAllowed=()=>false,cancelActiveDrag=reason=>calls.push(reason),rejectIncomingDrop=()=>calls.push("reject");
  onStripDrop(event);return calls;`);
 assert.deepEqual(run(false),["prevent","stop","strip-phase"]);
 assert.deepEqual(run(true),["reject"]);
});
test("phase-blocked dragend does not prepare a native detach",()=>{
 const src=read("interactions/drag-end.js.part"),body=src.slice(0,src.indexOf("  const dragController = {"));
 const run=new Function(body+`
 const calls=[],tab={},nativeDragIdentity={token:1},nativeDragToken=1,dragLifecycle={owns:()=>true};
 const dragEndMatches=()=>true,retireChangedDragViewport=()=>false,retireChangedDragChromeFrame=()=>false;
 const retireBlockedNativeTabDrag=reason=>{calls.push(reason);return true;};
 const placementAt=()=>{throw Error("native placement must not run")};
 onDragEnd({isTrusted:true},tab);return calls;`);
 assert.deepEqual(run(),["dragend-phase"]);
});
test("existing native observers and commit paths use common fences without new scheduling",()=>{
 const ctrl=read("interactions/drag-controller.js.part"),end=read("interactions/drag-end.js.part"),
 split=read("interactions/split-drop.js.part"),display=read("interactions/display-engine.js.part"),
 vis=read("layout/visibility.js.part"),tabsync=read("toolbar/tab-sync.js.part"),life=read("core/window-lifecycle.js.part");
 assert.ok(ctrl.includes("if(!dragPhaseInputAllowed()){"));
 assert.ok(end.includes('retireChangedDragChromeFrame("dragend")'));
 assert.ok(split.includes('retireChangedDragChromeFrame("split-drop")'));
 assert.ok(display.includes('retireBlockedNativeTabDrag("source-phase")'));
 assert.ok(vis.includes('retireBlockedNativeTabDrag("workspace-phase")'));
 assert.ok(life.includes('retireChangedDragChromeFrame("native-edge-resize")'));
 assert.ok(tabsync.includes('retireChangedDragChromeFrame("toolbar-children")'));
 const chrome=state.slice(state.indexOf("  let dragChromeFrame"),state.indexOf("  let dropMarker"));
 assert.ok(!chrome.includes("requestAnimationFrame"));
});
