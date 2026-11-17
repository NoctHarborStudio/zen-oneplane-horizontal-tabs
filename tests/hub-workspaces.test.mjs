import test from "node:test";
import assert from "node:assert/strict";
import {hubWorkspaceSnapshot,hubPanelWidth,hubWorkspaceBrowserEligible,hubOtherDisplay,hubSnapRect,hubTrashAgeMatches,hubWorkspaceOrder,hubTrashTabEligible,hubTrashRange,hubTrashRelativeAge,hubTrashAgeOptions,hubTrashFlightGeometry} from "../src/algorithms/hub-workspaces.mjs";
test("native identities and current state; no mutation",()=>{
  const native=[{uuid:"a",name:"Study",icon:"📚"},{uuid:"b",name:"Free",icon:"chrome://x.svg"},{uuid:"a",name:"duplicate"}];
  const manager={activeWorkspace:"b",getWorkspaces:()=>native,changeWorkspaceWithID(){}};
  assert.deepEqual(hubWorkspaceSnapshot(manager),[{id:"a",name:"Study",icon:"📚",active:false},{id:"b",name:"Free",icon:"",active:true}]);assert.equal(native.length,3);
});
test("no invented Free; unavailable manager fails closed",()=>{
  assert.equal(hubWorkspaceSnapshot(null),null);assert.equal(hubWorkspaceSnapshot({workspaceEnabled:false}),null);
  assert.deepEqual(hubWorkspaceSnapshot({getWorkspaces:()=>[],changeWorkspaceWithID(){}}),[]);
  assert.equal(hubWorkspaceSnapshot({getWorkspaces(){throw Error("unavailable")},changeWorkspaceWithID(){}}),null);
});

test("hub follows navigation right edge and clamps to viewport",()=>{
  assert.equal(hubPanelWidth(5,255,1920),250);
  assert.equal(hubPanelWidth(5,100,1920),180);
  assert.equal(hubPanelWidth(850,1100,900),42);
});

test("workspace reuse is local; global visible Essentials remain available",()=>{
  const tab=(attrs,extra={})=>({getAttribute:k=>attrs[k]??null,hasAttribute:k=>k in attrs,...extra});
  assert.equal(hubWorkspaceBrowserEligible(tab({"zen-workspace-id":"work"}),"work"),true);
  assert.equal(hubWorkspaceBrowserEligible(tab({"zen-workspace-id":"free"}),"work"),false);
  assert.equal(hubWorkspaceBrowserEligible(tab({"zen-essential":"true"}),"work"),true);
  assert.equal(hubWorkspaceBrowserEligible(tab({"zen-essential":"true"},{hidden:true}),"work"),false);
  assert.equal(hubWorkspaceBrowserEligible(tab({"zen-workspace-id":"work","zen-empty-tab":"true"}),"work"),false);
});

test("projection requires a release inside a different monitor",()=>{
  const a={x:0,y:0,width:1920,height:1080},b={x:-1200,y:0,width:1200,height:1920};
  assert.equal(hubOtherDisplay(a,b,-500,500),true);
  assert.equal(hubOtherDisplay(a,a,500,500),false);
  assert.equal(hubOtherDisplay(a,b,-1201,500),false);
});

test("snap zones stay inside work area with negative coordinates",()=>{
  const d={x:-1920,y:40,width:1920,height:1040};
  assert.deepEqual(hubSnapRect(d,-960,45),{x:-1920,y:40,width:1920,height:1040,mode:"maximize"});
  assert.deepEqual(hubSnapRect(d,-1915,500),{x:-1920,y:40,width:960,height:1040,mode:"left"});
  assert.deepEqual(hubSnapRect(d,-5,1070),{x:-960,y:560,width:960,height:520,mode:"right-bottom"});
  const c=hubSnapRect(d,-960,600);assert.equal(c.mode,"center");assert.deepEqual(c,hubSnapRect(d,-800,650));assert.ok(c.x>=d.x&&c.x+c.width<=d.x+d.width&&c.y>=d.y&&c.y+c.height<=d.y+d.height);
});

test("Free first, Trash separate, native order otherwise intact",()=>{
 const s=[{id:"a"},{id:"trash"},{id:"b"},{id:"free"}];
 assert.deepEqual(hubWorkspaceOrder(s,"free","trash").map(x=>x.id),["free","a","b"]);
 assert.equal(s.length,4);assert.equal(s[0].id,"a");
});
test("Trash ages use removal time; unknown and future ages do not match finite cutoffs",()=>{
 const now=2000000000000;
 assert.equal(hubTrashAgeMatches(now-300000,"5m",now),true);
 assert.equal(hubTrashAgeMatches(now-299999,"5m",now),false);
 assert.equal(hubTrashAgeMatches(0,"5m",now),false);
 assert.equal(hubTrashAgeMatches(now+1,"1y",now),false);
 assert.equal(hubTrashAgeMatches(0,"all",now),true);
 assert.equal(hubTrashAgeMatches(now-31536000000,"1y",now),true);
 assert.equal(hubTrashAgeMatches(now-31536000000,"invalid",now),false);
});
test("Trash refuses grouped, split, essential, placeholder and closing tabs",()=>{
 const t=(attrs=[],extra={})=>({hasAttribute:k=>attrs.includes(k),...extra});
 assert.equal(hubTrashTabEligible(t()),true);
 for(const k of ["zen-essential","zen-empty-tab","split-view","glance-id","zen-glance-tab"])assert.equal(hubTrashTabEligible(t([k])),false);
 assert.equal(hubTrashTabEligible(t([],{group:{}})),false);
 assert.equal(hubTrashTabEligible(t([],{closing:true})),false);
});

test("large Trash only mounts visible rows with bounded overscan",()=>{
  const r=hubTrashRange(10000,54000,270);
  assert.deepEqual(r,{first:997,end:1008,top:53838,bottom:485568});
  assert.ok(r.end-r.first<=12);
  assert.deepEqual(hubTrashRange(0,0,270),{first:0,end:0,top:0,bottom:0});
  assert.equal(hubTrashRange(10000,539730,270).end,10000);
});
test("relative time is derived from fixed timestamps",()=>{
  const n=2000000000000;
  assert.equal(hubTrashRelativeAge(n,n),"Just now");
  assert.equal(hubTrashRelativeAge(n-120000,n),"2 min");
  assert.equal(hubTrashRelativeAge(n-3600000,n),"1 h");
  assert.equal(hubTrashRelativeAge(n-86400000,n),"1 d");
  assert.equal(hubTrashRelativeAge(n-31536000000,n),"1 y");
  assert.equal(hubTrashRelativeAge(0,n),"Unknown");
});

test("inline age choices use valid clear filter keys",()=>{
 const options=hubTrashAgeOptions();
 assert.deepEqual(options.map(o=>o[0]),["all","5m","1h","1d","7d","30d","1y"]);
 const now=2000000000000;
 for(const [key] of options)assert.equal(hubTrashAgeMatches(now-31536000000,key,now),true);
});
test("trash flight stays in Hub and converges on target center",()=>{
 const rect={width:180,height:50},panel={left:10,top:20,right:250,bottom:600},dest={left:20,top:90,width:210,height:34};
 const f=hubTrashFlightGeometry(rect,{x:130,y:110},dest,panel);
 assert.deepEqual(f,{x:70,y:85,dx:-35,dy:-3});
 assert.equal(f.x+rect.width/2+f.dx,dest.left+dest.width/2);
 assert.equal(f.y+rect.height/2+f.dy,dest.top+dest.height/2);
 assert.equal(hubTrashFlightGeometry(rect,{x:500,y:110},dest,panel),null);
});

test("Hub Trash resets on a fresh opening and stale workspace deletion cannot expand it",async()=>{
  const {readFile}=await import("node:fs/promises");
  const source=await readFile(new URL("../src/hub/controller.js.part",import.meta.url),"utf8");
  // Execute the actual controller entry point with only the popup/UI boundaries stubbed.
  const toggle=source.slice(source.indexOf("    function toggle(event){"),source.indexOf("    function key(event){"));
  const close=source.slice(source.indexOf("    function close(restoreFocus"),source.indexOf("    function updateGeometry(){"));
  const deletion=source.slice(source.indexOf("    async function removeSpace(id){"),source.indexOf("    function trashTabs(){"));
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const native={activeWorkspace:"free",removeWorkspace:()=>gate,getWorkspaceFromId:()=>null};
  const tab={};
  const attrs=new Set();
  const state=new Function("native","tab","attrs",`
    let open=false,trashOpen=false,hubSession=0,destroyed=false,busy=false,contextId=null,confirmation=null,editId=null,purgePlan=null,drag=null,geometryFrame=0;
    const window={__nocturneOverlay:{request:()=>true}};
    const panel={hidden:true,isConnected:true,querySelector:()=>null},mode={focus(){}},button={setAttribute(){},focus(){}},status={};
    const trashPanel={hasAttribute:k=>attrs.has(k),setAttribute:k=>attrs.add(k),removeAttribute:k=>attrs.delete(k),getBoundingClientRect(){}};
    const supported=()=>true,ensure=()=>{},setHold=()=>{},render=()=>{if(trashOpen)attrs.add("data-op-trash-open");else attrs.delete("data-op-trash-open");},
      showPopup=()=>{panel.hidden=false;return true;},finishTrashDrag=()=>{},setTrashAgeOpen=()=>{},stopTrashUpdates=()=>{},
      hideNow=()=>{panel.hidden=true;},fluid=()=>{},switchGuard=()=>{},singleWindow=()=>true,freeId=()=>"free",
      ensureTrash=async()=>"trash",ownedTabs=()=>[],trashSessionStore=()=>({setCustomTabValue(){}}),moveNativeTab=()=>{},TRASH_TIME="stamp",
      deletionDetails=id=>({id,native,description:"delete",plan:[tab]}),operation=async fn=>{await fn();if(open)render();};
    ${toggle}
    ${close}
    ${deletion}
    const event={preventDefault(){},stopPropagation(){}};
    return {toggle:()=>toggle(event),expand:()=>{trashOpen=true;render();},close,expanded:()=>trashOpen,deleteSpace:()=>{confirmation=deletionDetails("work");return removeSpace("work");}};
  `)(native,tab,attrs);
  state.toggle();assert.equal(state.expanded(),false);
  state.expand();assert.equal(state.expanded(),true);
  state.close();state.toggle();assert.equal(state.expanded(),false);assert.equal(attrs.has("data-op-trash-open"),false);assert.equal(attrs.has("data-op-trash-reset"),false);
  const pending=state.deleteSpace();state.close();state.toggle();release();await pending;
  assert.equal(state.expanded(),false);
  await state.deleteSpace();assert.equal(state.expanded(),true);
});
