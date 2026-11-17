import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../workspace-transition.uc.mjs",import.meta.url),"utf8");
const i=source.indexOf("function eligible("),j=source.indexOf("function units()",i);
const eligible=new Function(source.slice(i,j)+"return eligible;")();
test("workspace animates stable surfaces without per-tab translation",()=>{
 assert.ok(source.includes('const candidates=[one?row:get("tabbrowser-tabs"),get("PlacesToolbarItems")]'));
 assert.ok(!source.includes("--zr-workspace-dx"));
 assert.ok(!source.includes("--zr-workspace-dy"));
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
 assert.ok(source.includes('phase("swap");cancelEffects(tx);'));
 assert.ok(source.includes('phase("in");'));
});

function lifecycleFixture(){
 const attrs=()=>new Map(),events=[],timers=new Map(),listeners=new Map(),prefs={getBoolPref:()=>true,addObserver(){},removeObserver(){}};
 let clock=0,id=0;
 const node=()=>{const a=attrs(),styles=new Map();return {isConnected:true,children:[],hidden:false,collapsed:false,
   hasAttribute:k=>a.has(k),setAttribute:(k,v)=>a.set(k,v),removeAttribute:k=>a.delete(k),getAttribute:k=>a.get(k),
   style:{getPropertyValue:k=>styles.get(k)?.[0]||"",getPropertyPriority:k=>styles.get(k)?.[1]||"",setProperty:(k,v,p)=>styles.set(k,[v,p]),removeProperty:k=>styles.delete(k)},
   getBoundingClientRect:()=>({left:30,right:100,top:30,bottom:50,width:70,height:20}),
   animate(){return {finished:Promise.resolve(),cancel(){}};},append(){},remove(){}};};
 const root=node(),bookmarks=node(),old=node(),fresh=node();bookmarks.children=[old];
 const win={innerWidth:1200,innerHeight:800,performance:{now:()=>clock},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),
   addUnloadListener(){},addEventListener(k,f){listeners.set(k,f);},removeEventListener(k,f){if(listeners.get(k)===f)listeners.delete(k);},CSS:{registerProperty(){}},
   windowUtils:{USER_SHEET:1,loadSheet(){},removeSheet(){}},getComputedStyle:()=>({display:"block",visibility:"visible",opacity:"1"}),
   CustomEvent:class{constructor(type,o){this.type=type;this.detail=o.detail;}},dispatchEvent:e=>events.push(e.detail.phase),
   MutationObserver:class{observe(){} disconnect(){}},setTimeout(fn,ms){const n=++id;timers.set(n,{fn,at:clock+ms});return n;},clearTimeout:n=>timers.delete(n)};
 const doc={documentElement:root,getElementById:k=>k==="PlacesToolbarItems"?bookmarks:null};
 const reinstall=()=>new Function("window","document","Services","console",source)(win,doc,{prefs,io:{newURI:x=>x}},{warn(){}});
 reinstall();
 async function flush(){for(let j=0;j<12;j++)await Promise.resolve();}
 async function advance(){await flush();const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(next){timers.delete(next[0]);clock=next[1].at;next[1].fn();}await flush();}
 return {win,root,bookmarks,old,fresh,events,timers,advance,flush,reinstall,escape:()=>listeners.get("keydown")?.({key:"Escape"})};
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
 const surface=node(160,0),page=node(600,120),bm=node(24,100),row=node(90,0);
 const nodes={"oneplane-toolbar-surface":surface,"tabbrowser-tabpanels":page,"PlacesToolbarItems":bm};
 const get=k=>nodes[k],root={getAttribute:()=>"true"},win={getComputedStyle:()=>({translate:"none"})};
 const PROGRESS="--zr-workspace-progress",MARK="motion",SURFACE="surface",PAGE="page",MOVE="move";
 const rect=n=>n?.getBoundingClientRect(),pause=()=>new Promise(()=>{});
 ${source.slice(restoreStart,restoreEnd)}${source.slice(start,end)}
 const tx={styles:new Map(),animations:new Set()};
 animate(tx,[row,bm],false,{surfaceHeight:100,bookmarkTop:60,pageTop:80});
 const count=effects.length,ratio=surface.style.getPropertyValue("--zr-workspace-height-scale"),pageOffset=page.style.getPropertyValue("--zr-workspace-page-y");
 cancelEffects(tx);return {count,ratio,pageOffset,clean:[surface,page,bm,row].every(n=>!n.styles.size&&!n.attrs.size)};
 `);
 assert.deepEqual(run(),{count:4,ratio:"0.625",pageOffset:"-32px",clean:true});
});
