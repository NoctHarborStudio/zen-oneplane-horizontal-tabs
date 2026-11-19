import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../workspace-transition.uc.mjs",import.meta.url),"utf8");
const css=readFileSync(new URL("../chrome.css",import.meta.url),"utf8");
const i=source.indexOf("function eligible("),j=source.indexOf("function units()",i);
const eligible=new Function(source.slice(i,j)+"return eligible;")();
test("workspace animates stable surfaces and card offsets with shared progress",()=>{
 assert.ok(source.includes('const candidates=[one?row:get("tabbrowser-tabs"),get("PlacesToolbarItems")]'));
 assert.ok(!source.includes("--zr-workspace-dx"));
 assert.ok(!source.includes("--zr-workspace-dy"));
 assert.ok(source.includes("win.__nocturneCenterMotion?.start(row"));
 assert.ok(css.includes("data-zr-magnetic-layer"));
});
test("transition bypasses startup, disabled and reduced-motion states",()=>{
 const state={dead:false,busy:false,reduced:false,startup:false,enabled:true,fullscreen:false};
 assert.equal(eligible(state),true);
 for(const flag of ["dead","busy","reduced","startup","fullscreen","interacting"])assert.equal(eligible({...state,[flag]:true}),false);
 assert.equal(eligible({...state,enabled:false}),false);
});
test("native switch stays single-owned and chrome-only",()=>{
 assert.ok(!source.includes("changeWorkspaceWithID="));
 assert.ok(source.includes('get("tabbrowser-tabpanels")'));
 assert.ok(!source.includes("contentDocument"));assert.ok(!source.includes("contentWindow"));assert.ok(source.includes("Keep the page opaque"));
 assert.ok(!source.includes("zen-main-browser-background"));
 assert.ok(source.includes('phase("swap");if(!tx.cancelled&&!dead&&!req.superseded)visualStep(()=>cancelEffects(tx));'));
 assert.ok(source.includes('phase("in");'));
});

function lifecycleFixture({withRow=false}={}){
 const attrs=()=>new Map(),events=[],timers=new Map(),listeners=new Map(),prefs={getBoolPref:()=>true,addObserver(){},removeObserver(){}};
 let clock=0,id=0;
 const node=()=>{const a=attrs(),styles=new Map();return {isConnected:true,children:[],hidden:false,collapsed:false,
   hasAttribute:k=>a.has(k),setAttribute:(k,v)=>a.set(k,v),removeAttribute:k=>a.delete(k),getAttribute:k=>a.get(k),
   style:{getPropertyValue:k=>styles.get(k)?.[0]||"",getPropertyPriority:k=>styles.get(k)?.[1]||"",setProperty:(k,v,p)=>styles.set(k,[v,p]),removeProperty:k=>styles.delete(k)},
   getBoundingClientRect:()=>({left:30,right:100,top:30,bottom:50,width:70,height:20}),
   animate(){return {finished:Promise.resolve(),cancel(){}};},append(){},remove(){}};};
 const root=node(),bookmarks=node(),old=node(),fresh=node(),row=withRow?node():null;bookmarks.children=[old];
 if(row){root.setAttribute("oneplane-active","true");row.setAttribute("data-ready","true");}
 const win={innerWidth:1200,innerHeight:800,performance:{now:()=>clock},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),
   addUnloadListener(){},addEventListener(k,f){listeners.set(k,f);},removeEventListener(k,f){if(listeners.get(k)===f)listeners.delete(k);},CSS:{registerProperty(){}},
   windowUtils:{USER_SHEET:1,loadSheet(){},removeSheet(){}},getComputedStyle:()=>({display:"block",visibility:"visible",opacity:"1"}),
   CustomEvent:class{constructor(type,o){this.type=type;this.detail=o.detail;}},dispatchEvent:e=>events.push(e.detail.phase),
   MutationObserver:class{observe(){} disconnect(){}},setTimeout(fn,ms){const n=++id;timers.set(n,{fn,at:clock+ms});return n;},clearTimeout:n=>timers.delete(n)};
 if(row)win.__oneplaneLayoutController={prepareWorkspaceGeometry(){}};
 const doc={documentElement:root,getElementById:k=>k==="PlacesToolbarItems"?bookmarks:k==="oneplane-tabs"?row:null};
 const reinstall=()=>new Function("window","document","Services","console",source)(win,doc,{prefs,io:{newURI:x=>x}},{warn(){}});
 reinstall();
 async function flush(){for(let j=0;j<12;j++)await Promise.resolve();}
 async function advance(){await flush();const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(next){timers.delete(next[0]);clock=next[1].at;next[1].fn();}await flush();}
 return {win,root,bookmarks,old,fresh,row,events,timers,listeners,prefs,advance,flush,reinstall,escape:()=>listeners.get("keydown")?.({key:"Escape"})};
}
test("workspace transition keeps native callback single, phases ordered and styles restored",async()=>{
 const f=lifecycleFixture();let calls=0;
 const result=f.win.__zenRefinedWorkspaceTransition.run(()=>{calls++;assert.equal(f.root.getAttribute("data-zr-workspace-phase"),"swap");f.bookmarks.children=[f.fresh];return "ok";});
 await f.flush();assert.equal(calls,1);await f.advance();await f.advance();assert.equal(await result,"ok");
 assert.deepEqual(f.events,["out","swap","in","idle"]);
 assert.equal(f.old.hasAttribute("data-zr-workspace-motion"),false);
 assert.equal(f.fresh.hasAttribute("data-zr-workspace-motion"),false);
 assert.equal(f.timers.size,0);f.win.__zenRefinedWorkspaceTransition.dispose();
});
test("superseding a transition does not execute the older delayed selection",async()=>{
 const f=lifecycleFixture(),calls=[];
 const a=f.win.__zenRefinedWorkspaceTransition.run(()=>calls.push("old"));
 const b=f.win.__zenRefinedWorkspaceTransition.run(()=>calls.push("new"));
 await f.flush();await f.advance();await f.advance();await Promise.all([a,b]);
 assert.deepEqual(calls,["new"]);assert.equal(f.timers.size,0);
});
test("slow native switch cannot leave the chrome hidden indefinitely",async()=>{
 const f=lifecycleFixture();let resolve;
 const result=f.win.__zenRefinedWorkspaceTransition.run(()=>new Promise(r=>resolve=r));
 await f.flush();assert.equal(f.root.getAttribute("data-zr-workspace-phase"),"swap");
 await f.advance();await f.advance();
 assert.equal(f.root.hasAttribute("data-zr-workspace-phase"),false);
 resolve("native");assert.equal(await result,"native");assert.equal(f.timers.size,0);
});

test("native calls serialize and coalesce a newer queued request",async()=>{
 const f=lifecycleFixture(),calls=[];let resolveOld;
 const api=f.win.__zenRefinedWorkspaceTransition;
 const a=api.run(()=>{calls.push("old-start");return new Promise(r=>resolveOld=()=>{calls.push("old-end");r("old");});});
 await f.flush();assert.deepEqual(calls,["old-start"]);
 const b=api.run(()=>calls.push("superseded"));
 const c=api.run(()=>calls.push("new"));
 await f.flush();assert.deepEqual(calls,["old-start"]);
 resolveOld();await f.flush();await f.advance();await f.advance();
 await Promise.all([a,b,c]);assert.deepEqual(calls,["old-start","old-end","new"]);
});
test("dispose cancels unstarted native command",async()=>{
 const f=lifecycleFixture();let calls=0;
 const api=f.win.__zenRefinedWorkspaceTransition;
 const result=api.run(()=>calls++);api.dispose();await f.flush();await result;
 assert.equal(calls,0);assert.equal(f.timers.size,0);
});
test("replacement waits for already started native command",async()=>{
 const f=lifecycleFixture(),calls=[];let resolveOld;
 const a=f.win.__zenRefinedWorkspaceTransition.run(()=>{calls.push("old");return new Promise(r=>resolveOld=r);});
 await f.flush();
 // Reinstall actual script in the same window; the gate must survive.
 f.reinstall();
 const b=f.win.__zenRefinedWorkspaceTransition.run(()=>calls.push("new"));
 await f.flush();assert.deepEqual(calls,["old"]);
 resolveOld();await f.flush();await f.advance();await f.advance();await Promise.all([a,b]);
 assert.deepEqual(calls,["old","new"]);
});

test("Escape during swap retains the gate until native and mirror settle",async()=>{
 const f=lifecycleFixture();let complete,calls=0;
 const result=f.win.__zenRefinedWorkspaceTransition.run(()=>{calls++;return new Promise(r=>complete=r);});
 await f.flush();assert.equal(f.root.getAttribute("data-zr-workspace-phase"),"swap");
 f.escape();assert.equal(f.root.getAttribute("data-zr-workspace-phase"),"swap");
 complete("native");await f.flush();assert.equal(f.root.getAttribute("data-zr-workspace-phase"),"swap");
 await f.advance();await f.advance();assert.equal(await result,"native");
 assert.equal(calls,1);assert.deepEqual(f.events,["out","swap","idle"]);
});
test("new request retains hidden toolbar while old native switch is in flight",async()=>{
 const f=lifecycleFixture(),api=f.win.__zenRefinedWorkspaceTransition;let finish;
 const a=api.run(()=>new Promise(r=>finish=r));await f.flush();
 const b=api.run(()=>42);await f.flush();assert.equal(f.root.getAttribute("data-zr-workspace-phase"),"swap");
 assert.deepEqual(f.events,["out","swap"]);
 finish();await f.flush();await f.advance();await f.advance();await Promise.all([a,b]);
 assert.deepEqual(f.events,["out","swap","in","idle"]);
 assert.equal(f.root.hasAttribute("data-zr-workspace-phase"),false);
});

test("shelf FLIP ratio is bounded and matches old/new heights",()=>{
 const i=source.indexOf("function heightScale("),j=source.indexOf("function neutralTranslate(",i);
 const ratio=new Function(source.slice(i,j)+"return heightScale;")();
 assert.equal(ratio(80,120),80/120);assert.equal(ratio(120,80),1.5);
 assert.equal(ratio(0,80),1);assert.equal(ratio(1000,1),4);
});
test("geometry lock is released once and leaves no temporary dimensions",()=>{
 const i=source.indexOf("  let geometryLock=null;"),j=source.indexOf("  function phase(value)",i);
 const run=new Function(`const attrs=new Set(),styles=new Map();
 const node=(height,top=0)=>({isConnected:true,getBoundingClientRect:()=>({height,top}),style:{setProperty:(k,v)=>styles.set(k,v),removeProperty:k=>styles.delete(k)},setAttribute:k=>attrs.add(k),removeAttribute:k=>attrs.delete(k)});
 const nodes={"zen-appcontent-navbar-wrapper":node(80),"oneplane-toolbar-surface":node(120),"PlacesToolbarItems":node(20,60),"tabbrowser-tabpanels":node(600,80)};
 const get=k=>nodes[k],root={getAttribute:()=>"true"};
 ${source.slice(i,j)}
 lockGeometry();const locked=[...styles];const first=releaseGeometry();const second=releaseGeometry();
 return {locked,old:first.surfaceHeight,top:first.bookmarkTop,empty:styles.size===0&&attrs.size===0,second};`);
 assert.deepEqual(run(),{locked:[["--zr-workspace-height","80px"],["--zr-workspace-surface-height","120px"]],old:120,top:60,empty:true,second:null});
});

test("incoming shelf and page effects restore every owned style",()=>{
 const start=source.indexOf("  function saveEffect("),end=source.indexOf("  async function settled(",start);
 const restoreStart=source.indexOf("  function restore(tx)"),restoreEnd=source.indexOf("  function cleanup(tx",restoreStart);
 const run=new Function(`const attrs=new Map(),effects=[];
 const node=(height,top)=>{const a=new Map(),s=new Map();return {isConnected:true,hasAttribute:k=>a.has(k),setAttribute:(k,v)=>a.set(k,v),removeAttribute:k=>a.delete(k),
 style:{getPropertyValue:k=>s.get(k)?.[0]||"",getPropertyPriority:k=>s.get(k)?.[1]||"",setProperty:(k,v,p)=>s.set(k,[v,p]),removeProperty:k=>s.delete(k)},getBoundingClientRect:()=>({height,top,width:800}),animate(frames){effects.push({node:this,frames});return {finished:Promise.resolve(),cancel(){}};},attrs:a,styles:s};};
 const surface=node(160,0),page=node(600,120),bm=node(24,100),row=node(90,0),nav=node(90,0);
 row.setAttribute("data-op-overflow-row","true");
 const nodes={"oneplane-toolbar-surface":surface,"tabbrowser-tabpanels":page,"PlacesToolbarItems":bm,"oneplane-tabs":row,"nav-bar":nav};
 const get=k=>nodes[k],root={getAttribute:()=>"true"},win={getComputedStyle:()=>({translate:"none"})};
 const PROGRESS="--zr-workspace-progress",MARK="motion",SURFACE="surface",PAGE="page",MOVE="move",BACKING="backing";
 const rect=n=>n?.getBoundingClientRect(),pause=()=>new Promise(()=>{});
 ${source.slice(restoreStart,restoreEnd)}${source.slice(start,end)}
 const tx={styles:new Map(),animations:new Set()};
 animate(tx,[row,bm],false,{surfaceHeight:100,bookmarkTop:60,pageTop:80});
 const count=effects.length,ratio=surface.style.getPropertyValue("--zr-workspace-height-scale"),pageOffset=page.style.getPropertyValue("--zr-workspace-page-y");
 cancelEffects(tx);row.removeAttribute("data-op-overflow-row");return {count,ratio,pageOffset,clean:[surface,page,bm,row,nav].every(n=>!n.styles.size&&!n.attrs.size)};
 `);
 assert.deepEqual(run(),{count:3,ratio:"0.625",pageOffset:"",clean:true});
});

test("two-row backing is gated during swap and animated separately from tabs",()=>{
 assert.ok(!source.includes('saveEffect(tx,nav,BACKING'));
 assert.ok(css.includes('#nav-bar#nav-bar#nav-bar#nav-bar:has(#oneplane-tabs[data-op-overflow-row])'));
 assert.ok(css.includes('background:transparent!important'));
 assert.ok(css.includes("One compact contour owns the background"));
});

test("workspace uses packaged style motion and locks geometry before outgoing effect",()=>{
 assert.ok(css.includes("@property --zr-workspace-progress"));
 assert.ok(css.includes("opacity: var(--zr-workspace-progress) !important"));
 assert.ok(css.includes("height: var(--zr-workspace-height) !important"));
 assert.ok(source.includes('if(value==="out"||value==="swap")lockGeometry();'));
 assert.ok(!source.includes("loadSheet("));
});

test("compact geometry and card displacement share the incoming timeline",()=>{
 assert.ok(css.includes("--zr-workspace-painted-height"));
 assert.ok(css.includes("data-zr-magnetic-layer"));
 assert.ok(source.includes('const length=outgoing?460:560'));
 assert.ok(source.includes('old.bookmarkTop-n.getBoundingClientRect().top'));
});
test("workspace delegates card trajectories to the shared engine and fixes the unscaled surface height",()=>{
 assert.ok(source.includes("Number(surface.offsetHeight)||sr?.height"));
 assert.ok(css.includes("min-height: var(--zr-workspace-final-surface-height) !important"));
 assert.ok(css.includes("max-height: var(--zr-workspace-final-surface-height) !important"));
 assert.ok(!source.includes("function cardOffsets("));
});

test("workspace captures resting geometry after hover suspension and labels first transition",()=>{
 const phase=source.slice(source.indexOf("function phase(value)"),source.indexOf("function restore(tx)"));
 assert.ok(phase.indexOf("syncAddressState")<phase.indexOf("lockGeometry()"));
 assert.ok(phase.indexOf("dispatchEvent")<phase.indexOf("lockGeometry()"));
 assert.ok(source.includes("tx.sequence===1?100:65"));
 assert.ok(source.includes("workspace.visual.boundary"));
});

test("workspace cleanup releases remaining styles, waiters and listeners after native release faults",async()=>{
 const f=lifecycleFixture(),api=f.win.__zenRefinedWorkspaceTransition;let calls=0;
 f.bookmarks.animate=()=>({finished:new Promise(()=>{}),cancel(){throw Error("cancel");}});
 const result=api.run(()=>calls++);
 const remove=f.bookmarks.style.removeProperty;
 f.bookmarks.style.removeProperty=k=>{if(k==="--zr-workspace-progress")throw Error("style");remove(k);};
 const clear=f.win.clearTimeout;let failed=false;
 f.win.clearTimeout=id=>{if(!failed){failed=true;throw Error("timer");}clear(id);};
 api.dispose();await f.flush();await result;
 assert.equal(calls,0);assert.equal(f.root.hasAttribute("data-zr-workspace-phase"),false);
 assert.equal(f.bookmarks.hasAttribute("data-zr-workspace-motion"),false);
 assert.equal(f.bookmarks.style.getPropertyValue("--zr-workspace-row-y"),"");
 assert.equal(f.listeners.size,0);assert.equal(f.win.__zenRefinedWorkspaceTransition,undefined);
});
test("workspace incoming visual failure does not change resolved native outcome",async()=>{
 const f=lifecycleFixture();let count=0;
 const result=f.win.__zenRefinedWorkspaceTransition.run(()=>{count++;f.bookmarks.style.setProperty=()=>{throw Error("incoming style");};return 42;});
 await f.flush();await f.advance();assert.equal(await result,42);
 assert.equal(count,1);assert.equal(f.root.hasAttribute("data-zr-workspace-phase"),false);
});
test("workspace native rejection remains a rejection after visual cleanup",async()=>{
 const f=lifecycleFixture();const result=f.win.__zenRefinedWorkspaceTransition.run(()=>{throw Error("native rejected");});
 await assert.rejects(result,/native rejected/);
 assert.equal(f.root.hasAttribute("data-zr-workspace-phase"),false);
});

test("workspace watchdog acquisition failure falls back to native command once",async()=>{
 const f=lifecycleFixture();let calls=0;
 f.win.setTimeout=()=>{throw Error("watchdog");};
 const result=await f.win.__zenRefinedWorkspaceTransition.run(()=>{calls++;return "native";});
 assert.equal(result,"native");assert.equal(calls,1);assert.equal(f.root.hasAttribute("data-zr-workspace-phase"),false);
});

test("idle cleanup dispatch reentry preserves latest workspace intent",async()=>{
 const f=lifecycleFixture(),calls=[];let nested;
 const dispatch=f.win.dispatchEvent;
 f.win.dispatchEvent=e=>{dispatch(e);if(e.detail.phase==="idle"&&!nested)nested=f.win.__zenRefinedWorkspaceTransition.run(()=>calls.push("nested"));};
 const api=f.win.__zenRefinedWorkspaceTransition;
 const first=api.run(()=>calls.push("first")),second=api.run(()=>calls.push("second"));
 await f.flush();for(let i=0;i<10&&f.timers.size;i++)await f.advance();
 await Promise.all([first,second,nested]);assert.deepEqual(calls,["nested"]);
 assert.equal(f.root.hasAttribute("data-zr-workspace-phase"),false);
});
test("out phase nested request supersedes before old animation or native mutation",async()=>{
 const f=lifecycleFixture(),calls=[];let nested;
 const dispatch=f.win.dispatchEvent;
 f.win.dispatchEvent=e=>{dispatch(e);if(e.detail.phase==="out"&&!nested)nested=f.win.__zenRefinedWorkspaceTransition.run(()=>calls.push("nested"));};
 const first=f.win.__zenRefinedWorkspaceTransition.run(()=>calls.push("first"));
 await f.flush();for(let i=0;i<10&&f.timers.size;i++)await f.advance();
 await Promise.all([first,nested]);assert.deepEqual(calls,["nested"]);
 assert.equal(f.root.hasAttribute("data-zr-workspace-phase"),false);
});

test("managed Workspace command uses existing gate without acquiring a second native promise",async()=>{
 const f=lifecycleFixture(),gate=f.win.__nocturneWorkspaceCommandGate,lease={};let resolve,calls=0;
 gate.owner=lease;gate.pending=new Promise(r=>resolve=r);
 const api=f.win.__zenRefinedWorkspaceTransition;
 const result=api.run(()=>{calls++;return "managed";},{lease});
 await f.flush();assert.equal(calls,1);
 assert.equal(await api.run(()=>{calls++;}),undefined);assert.equal(calls,1);
 await f.advance();await f.advance();assert.equal(await result,"managed");
 assert.equal(gate.owner,lease);resolve();gate.pending=null;gate.owner=null;api.dispose();
});
test("managed native verification rejection cleans swap gate without incoming motion",async()=>{
 const f=lifecycleFixture(),gate=f.win.__nocturneWorkspaceCommandGate,lease={};gate.owner=lease;gate.pending=new Promise(()=>{});
 const result=f.win.__zenRefinedWorkspaceTransition.run(()=>{throw Error("unconfirmed");},{lease});
 await assert.rejects(result,/unconfirmed/);assert.equal(f.root.hasAttribute("data-zr-workspace-phase"),false);assert.ok(!f.events.includes("in"));assert.equal(f.timers.size,0);
});

test("unowned compatibility transition cannot invoke native while source is reserved by Return",async()=>{
 const f=lifecycleFixture(),gate=f.win.__nocturneWorkspaceCommandGate,token=Symbol("return");gate.reservation=token;
 let called=0;await f.win.__zenRefinedWorkspaceTransition.run(()=>{called++;});
 assert.equal(called,0);assert.equal(gate.reservation,token);assert.equal(gate.pending,null);
 f.win.__zenRefinedWorkspaceTransition.dispose();
});

test("workspace topology invalidation retires visuals but preserves the native command exactly once",async()=>{
 for(const during of ["out","in"]){
  const f=lifecycleFixture({withRow:true});let calls=0,invalidated=null,releases=0;
  f.win.__nocturneCenterMotion={start(row,options){
    if(options.direction!==during)return null;
    let resolve;const finished=new Promise(r=>resolve=r);
    invalidated=options.onTopologyInvalidated;
    return {finished,validateTopology:()=>true,release(){releases++;resolve();}};
  }};
  const result=f.win.__zenRefinedWorkspaceTransition.run(()=>{calls++;return "native";});
  await f.flush();
  for(let i=0;i<8&&!invalidated&&f.timers.size;i++)await f.advance();
  assert.equal(typeof invalidated,"function",during);
  assert.equal(f.root.getAttribute("data-zr-workspace-phase"),during);
  invalidated();invalidated();
  await f.flush();assert.equal(await result,"native");
  assert.equal(calls,1);assert.equal(releases,1);assert.equal(f.timers.size,0);
  assert.equal(f.root.hasAttribute("data-zr-workspace-phase"),false);
  f.win.__zenRefinedWorkspaceTransition.dispose();
 }
});

test("workspace preflight rejection, missing owner or replacement preserves native result and clears swap",async()=>{
 for(const mode of ["false","throw","missing","replacement","undefined","ready","legacy","missing-method"]){
  const f=lifecycleFixture({withRow:true});let calls=0,preflights=0;
  const layout={geometryPreflightVersion:1,prepareWorkspaceGeometry(){preflights++;
   if(mode==="throw")throw Error("preflight");
   if(mode==="replacement")f.win.__oneplaneLayoutController={};
   return mode==="false"?false:mode==="undefined"||mode==="legacy"?undefined:true;
  }};
  if(mode==="legacy")delete layout.geometryPreflightVersion;
  if(mode==="missing-method")delete layout.prepareWorkspaceGeometry;
  f.win.__oneplaneLayoutController=mode==="missing"?undefined:layout;
  const result=f.win.__zenRefinedWorkspaceTransition.run(()=>{calls++;return "native";});
  await f.flush();for(let i=0;i<10&&f.timers.size;i++)await f.advance();
  assert.equal(await result,"native",mode);assert.equal(calls,1,mode);
  assert.equal(preflights,["missing","missing-method"].includes(mode)?0:1,mode);
  assert.equal(f.events.includes("in"),mode==="ready"||mode==="legacy",mode);
  assert.equal(f.root.hasAttribute("data-zr-workspace-phase"),false,mode);
  assert.equal(f.timers.size,0,mode);f.win.__zenRefinedWorkspaceTransition.dispose();
 }
});
