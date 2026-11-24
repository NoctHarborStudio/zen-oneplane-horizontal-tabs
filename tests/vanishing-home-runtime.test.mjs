import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../src/"+p,import.meta.url),"utf8");
const img=read("interactions/native-drag-image.js.part");
const pure=img.slice(img.indexOf("  const bunnyClamp"),img.indexOf("  function bunnyRect"));
const clip=img.slice(img.indexOf("  function bunnyClip"),img.indexOf("  function paintBunnyAt"));
const alg=read("algorithms/vanishing-home.mjs").replace(/^export /gm,"");
const runtime=read("interactions/vanishing-home.js.part");
const fixture=()=>new Function(alg+pure+clip+runtime+"\nlet clock=0,seq=0,dead=false,blocked=false,overflow=false,centered=true,active=false;\nconst traces=[],frames=new Map(),window={performance:{now:()=>clock},\n  requestAnimationFrame:f=>{frames.set(++seq,f);return seq},cancelAnimationFrame:i=>frames.delete(i),\n  clearTimeout:()=>{},__nocturneTrace:(n,data)=>traces.push([n,data])};\nfunction advance(ms=16){clock+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(f=>f(clock));}\nfunction drain(){for(let i=0;i<150&&frames.size;i++)advance();if(frames.size)throw Error(\"unbounded RAF\");}\nfunction node(x,w=36,y=24,h=30){\n const attrs=new Set(),props=new Map();\n return {attrs,props,isConnected:true,parentElement:null,\n  style:{setProperty:(k,v)=>props.set(k,v),removeProperty:k=>props.delete(k),getPropertyValue:k=>props.get(k)||\"\"},\n  setAttribute:k=>attrs.add(k),removeAttribute:k=>attrs.delete(k),\n  toggleAttribute:(k,v)=>v?attrs.add(k):attrs.delete(k),hasAttribute:k=>attrs.has(k),\n  base:{x,y,w,h},\n  getBoundingClientRect(){const b=this.base,dx=parseFloat(props.get(\"--op-drag-x\"))||0;return {left:b.x+dx-b.w/2,right:b.x+dx+b.w/2,top:b.y-b.h/2,bottom:b.y+b.h/2,width:b.w,height:b.h};}\n };\n}\nconst row=node(400,600,24,38),leftLane={},rightLane={},island=node(400,150),plus=node(554);\nconst toolbarWrapper=node(400,800,24,80);\nconst a=node(246),b=node(285),c=node(495),d=node(534);\na.parentElement=b.parentElement=leftLane;c.parentElement=d.parentElement=rightLane;\nlet order=[a,b,c,d];\nconst source=b,tab={};let dragNode=source,dragImageMode=\"inline\",dragGrabRatio=.5,dragEdge=42,dragLastPoint=null,dragPull=0;\nlet dragSearch=null,nativeDragToken=1,liveDragTarget=null,dragInsertAnimation=null,dragInsertNode=null,dragInsertPending=false;\nlet dragReturnPoint=null,dragViewport=null,dragChromeFrame=null,nativeDragTopology=null,dragRevealTimer=0,dragDetachedOnce=false;\nconst dragGhost=node(0,42,0,39),dragGhostBody=node(0,42,0,39);dragGhost.hidden=true;\nconst reducedMotion={matches:false},prefs={getIntPref:()=>160},PULL_DISTANCE=30,BUNNY_EDGE_PAD=3,BUNNY_DETACH_THRESHOLD=.96,REORDER_BUFFER=8;\nconst dragLifecycle={current:()=>active?{kind:\"tab\"}:null};\nconst hasCenteredIsland=()=>centered,useLaneDrop=()=>overflow,isStripNode=n=>order.includes(n),stripNodes=()=>order;\nconst nativeSlot=n=>({native:n,element:n,tab:n}),validNativeTab=()=>true;\nconst dragPhaseInputAllowed=()=>!blocked,retireChangedDragViewport=()=>false,retireBlockedNativeTabDrag=()=>false;\nconst readDragChromeFrame=()=>({}),readNativeDragTopology=()=>({}),dragViewportState=()=>[800,600,1,0];\nconst refreshIndicator=()=>{},holdToolbarForReturn=()=>{},restoreStartupSearch=()=>{},nocturneErrorClass=e=>e?.name;\nconst shiftDragNode=(n,x,follow=false)=>{n.style.setProperty(\"--op-drag-x\",String(x));n.toggleAttribute(\"data-op-drag-follow\",follow);};\nconst hideGhost=()=>{dragGhost.hidden=true;dragGhostBody.style.removeProperty(\"transform\")};\nconst positionGhost=(x,y)=>{dragGhost.base.x=x;dragGhost.base.y=y;};\nconst setDragImageMode=(m,e)=>{if(dragImageMode===\"outside\")return;dragImageMode=m;dragNode.toggleAttribute(\"data-op-detached\",m===\"content\");if(m===\"content\")dragDetachedOnce=true;};\nconst bunnyPullProgress=(y,edge,distance=PULL_DISTANCE)=>Math.max(0,Math.min(1,(y-edge)/distance));\nfunction endDragVisual(){\n if(dragInsertAnimation)dragInsertAnimation.cancel();\n dragInsertAnimation=null;dragInsertPending=false;dragInsertNode=null;\n clearVanishingHome();\n for(const n of [...order,plus]){n.style.removeProperty(\"--op-drag-x\");n.removeAttribute(\"data-op-drag-follow\");}\n source.removeAttribute(\"data-op-detached\");row.removeAttribute(\"data-op-dragging\");row.removeAttribute(\"data-op-live-drag\");\n dragNode=null;dragImageMode=null;\n}\nreturn {\n begin:(x=285,y=24)=>beginVanishingHome({clientX:x,clientY:y},tab),\n move:(x,y)=>previewVanishingHome({clientX:x,clientY:y}),\n advance,drain,source,a,b,c,d,plus,row,ghost:dragGhost,\n read:()=>vanishingHome,frames:()=>frames.size,trace:traces,\n clear:()=>endDragVisual(),capture:()=>captureVanishingReturn(),\n restore:(snap,confirmed,arr)=>{if(arr){order=arr;order.forEach((n,i)=>{n.base.x=i<2?246+i*39:495+(i-2)*39;});}return startVanishingReturn(snap,confirmed);},\n setOutside:()=>{dragImageMode=\"outside\";},setOverflow:v=>overflow=v,setBlocked:v=>blocked=v,setMotion:v=>reducedMotion.matches=!v,\n tail:()=>dragInsertPending\n};\n")();
test("join keeps the native source and grip, never draws a ghost during ordinary sorting",()=>{
 const f=fixture();assert.equal(f.begin(),true);f.drain();
 assert.equal(f.read().scale,0);assert.ok(Math.abs(f.read().paint.get(f.source).x-285)<.15);
 assert.equal(f.ghost.hidden,true);assert.equal(f.frames(),0);
 assert.equal(f.move(590,24).native,f.d);f.drain();assert.equal(f.read().index,3);
 assert.equal(f.ghost.hidden,true);assert.equal(f.source.parentElement,f.a.parentElement);
 assert.equal(f.move(150,24).native,f.a);f.drain();assert.equal(f.read().index,0);
});
test("pull, cross, reinsert and continue sorting inside one gesture",()=>{
 const f=fixture();f.begin();f.drain();f.move(285,73);f.drain();
 assert.equal(f.ghost.hidden,false);assert.equal(f.read().p,1);
 assert.equal(f.move(590,100).native,f.d);f.drain();
 assert.equal(f.source.hasAttribute("data-op-lane-ghost"),true);
 f.move(590,24);f.drain();assert.equal(f.ghost.hidden,true);
 assert.equal(f.source.hasAttribute("data-op-lane-ghost"),false);
 f.move(150,24);f.drain();assert.equal(f.read().index,0);
 f.move(150,73);f.drain();assert.equal(f.ghost.hidden,false);
 f.clear();assert.equal(f.frames(),0);assert.equal(f.row.hasAttribute("data-op-vanishing-home"),false);
 assert.equal(f.row.props.has("--op-vanishing-origin"),false);assert.equal(f.ghost.hidden,true);
});
test("OS image is exclusive, and unsupported lane geometry does not start a new owner",()=>{
 const f=fixture();f.setOverflow(true);assert.equal(f.begin(),false);assert.equal(f.frames(),0);
 f.setOverflow(false);assert.equal(f.begin(),true);f.drain();
 f.move(285,100);f.drain();f.setOutside();f.move(500,24);f.drain();
 assert.equal(f.ghost.hidden,true);assert.equal(f.capture(),null);
 f.clear();assert.equal(f.frames(),0);
});
test("confirmed native order reopens Home from virtual insertion; cancellation and interruption clean the lease",()=>{
 const f=fixture();f.begin();f.drain();f.move(590,58);f.drain();
 const snap=f.capture();assert.ok(snap.p>0);f.clear();
 assert.equal(f.restore(snap,true,[f.a,f.c,f.d,f.b]),true);assert.equal(f.tail(),true);
 f.drain();assert.equal(f.tail(),false);assert.equal(f.frames(),0);
 assert.equal(f.row.hasAttribute("data-op-vanishing-home"),false);
 assert.equal(f.source.props.has("--op-vanishing-sx"),false);
 const g=fixture();g.begin();g.drain();g.move(590,24);g.drain();const cancelled=g.capture();g.clear();
 assert.equal(g.restore(cancelled,false),true);g.advance();g.setBlocked(true);g.advance();
 assert.equal(g.tail(),false);assert.equal(g.frames(),0);assert.equal(g.row.props.has("--op-vanishing-origin"),false);
});
test("motion off collapses without a persistent frame loop and skips the return tail",()=>{
 const f=fixture();f.setMotion(false);f.begin();f.drain();assert.equal(f.read().scale,0);assert.equal(f.frames(),0);
 const snap=f.capture();f.clear();assert.equal(f.restore(snap,false),false);assert.equal(f.frames(),0);
});
