import {readFileSync} from "node:fs";
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
  const native={activeWorkspace:"free",removeWorkspace:()=>gate,getWorkspaceFromId:()=>null,workspaceElement:()=>null};
  const tab={isConnected:true};
  const attrs=new Set();
  const state=new Function("native","tab","attrs",`
    let open=false,trashOpen=false,hubSession=0,destroyed=false,busy=false,contextId=null,confirmation=null,editId=null,purgePlan=null,drag=null,geometryFrame=0;
    const browser={selectedTab:null};
    const window={gZenWorkspaces:native,gBrowser:browser,__nocturneOverlay:{request:()=>true}};
    const panel={hidden:true,isConnected:true,querySelector:()=>null},mode={focus(){}},button={setAttribute(){},focus(){}},status={};
    const trashPanel={hasAttribute:k=>attrs.has(k),setAttribute:k=>attrs.add(k),removeAttribute:k=>attrs.delete(k),getBoundingClientRect(){}};
    const supported=()=>true,ensure=()=>{},setHold=()=>{},render=()=>{if(trashOpen)attrs.add("data-op-trash-open");else attrs.delete("data-op-trash-open");},
      showPopup=()=>{panel.hidden=false;return true;},finishTrashDrag=()=>{},setTrashAgeOpen=()=>{},stopTrashUpdates=()=>{},
      hideNow=()=>{panel.hidden=true;},fluid=()=>{},switchGuard=()=>{},singleWindow=()=>true,freeId=()=>"free",
      ensureTrash=async()=>"trash",trashId=()=>"trash",requireWorkspaceDataCommand=()=>{},workspaceDataGuard=()=>{},
      readWorkspaceOwnership=(w,n,id)=>({tabs:id==="trash"?(moved?[tab]:[]):moved?[]:[tab],normal:{contains:()=>true}}),
      trashSessionStore=()=>({setCustomTabValue(){}}),moveNativeTab=()=>{moved=true;return {attempted:true,state:"confirmed"};},TRASH_TIME="stamp",
      workspaceTabJournal=(tabs,step)=>{tabs.forEach(step);return {planned:1,confirmed:1};},workspaceJournalComplete=()=>true,reportWorkspaceJournal=()=>{},hubTrashTabEligible=()=>true,
      deletionDetails=id=>({id,native,free:"free",trash:"trash",description:"delete",plan:[tab]}),operation=async fn=>{moved=false;await fn({native});if(open)render();};let moved=false;
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

function uriScopeFixture({splitMismatch=false,restoreFailure=false,foreign=false}={}){
 const code=readFileSync(new URL("../src/hub/controller.js.part",import.meta.url),"utf8");
 const segment=code.slice(code.indexOf("  function installWorkspaceLinkScope(){"),code.indexOf("  let releaseWorkspaceLinkScope="));
 const logs=[],opens=[],calls=[],nativeLists=[],providerCalls=[],history=[],removed=[];
 function manager(name){
  const b={currentURI:{spec:"https://example.org"},getAttribute:()=>""},tab={workspace:"local",linkedBrowser:b};
  let browsers=[b];const proto={get allUsedBrowsers(){return browsers;}};
  const m=Object.create(proto);m.workspaceEnabled=true;m.activeWorkspace="local";
  const browser={getTabForBrowser:x=>x===b?tab:null,tabs:splitMismatch?[{}]:[tab],selectedTab:{splitview:splitMismatch?{}:null},removeTab:t=>removed.push(t)};
  nativeLists.push({m,b,tab,replace:next=>{browsers=next;}});
  return {name,gZenWorkspaces:m,gBrowser:browser,__nocturneTrace:(e,d)=>logs.push({e,d})};
 }
 const window=manager("local"),other=manager("other");let native=()=>true;
 window.switchToTabHavingURI=function(...args){calls.push(args);return native(...args);};
 const original=window.switchToTabHavingURI;
 class Controller{switchToTab(data){providerCalls.push(data);calls.push(data);return native(data);}addToInputHistory(...args){history.push(args);}}
 const originalProto=Controller.prototype.switchToTab;
 const Services={wm:{getEnumerator(){const q=[window,other];return {hasMoreElements:()=>q.length>0,getNext:()=>q.shift()};}}};
 const helper={openTrustedLinkIn(...args){opens.push(args);},switchToTabHavingURI(...args){calls.push(args);return native(...args);}};
 const ChromeUtils={importESModule:p=>p.includes("URILoadingHelper")?{URILoadingHelper:helper}:{UrlbarParentController:Controller}};
 const install=new Function("window","root","browser","Services","ChromeUtils","hubWorkspaceBrowserEligible","console",segment+"return installWorkspaceLinkScope;")(window,{hasAttribute:()=>true},window.gBrowser,Services,ChromeUtils,(t,w)=>t?.workspace===w,{warn(){}});
 const release=install(),controller=new Controller();controller.browserWindow=window;
 return {window,other,original,originalProto,Controller,controller,release,logs,opens,calls,nativeLists,providerCalls,history,removed,helper,setNative:fn=>native=fn,lookup:(...args)=>window.switchToTabHavingURI(...args)};
}
test("Hub restores all temporary getters after native success and native exception",()=>{
 const f=uriScopeFixture();
 f.setNative(()=>{assert.equal(f.window.gZenWorkspaces.allUsedBrowsers.length,1);assert.equal(f.other.gZenWorkspaces.allUsedBrowsers.length,0);return true;});
 assert.equal(f.lookup("https://example.org",true),true);
 assert.equal(f.other.gZenWorkspaces.allUsedBrowsers.length,1);
 assert.equal(Object.hasOwn(f.window.gZenWorkspaces,"allUsedBrowsers"),false);
 f.setNative(()=>{throw Error("native failure");});
 assert.throws(()=>f.lookup("https://example.org",true),/native failure/);
 assert.equal(Object.hasOwn(f.other.gZenWorkspaces,"allUsedBrowsers"),false);
 f.release();assert.equal(f.window.switchToTabHavingURI,f.original);assert.equal(f.Controller.prototype.switchToTab,f.originalProto);
});
test("Hub failed getter restoration remains live native data and does not prevent other restores",()=>{
 const f=uriScopeFixture();
 f.setNative(()=>{
  const m=f.other.gZenWorkspaces,d=Object.getOwnPropertyDescriptor(m,"allUsedBrowsers");
  Object.defineProperty(m,"allUsedBrowsers",{...d,configurable:false});return true;
 });
 assert.equal(f.lookup("https://example.org",true),true);
 assert.equal(Object.hasOwn(f.window.gZenWorkspaces,"allUsedBrowsers"),false);
 assert.equal(f.other.gZenWorkspaces.allUsedBrowsers.length,1);
 f.nativeLists[1].replace([{},{}]);assert.equal(f.other.gZenWorkspaces.allUsedBrowsers.length,2);
 assert.equal(f.opens.length,0);assert.ok(f.logs.some(x=>x.e==="hub.uri.scope.restore"&&x.d.failed===1));
 f.release();
});
test("Hub preserves foreign getters and foreign prototype/window wrappers",()=>{
 const f=uriScopeFixture(),foreign=()=>["foreign"],wrapper=()=>false;
 f.setNative(()=>{Object.defineProperty(f.other.gZenWorkspaces,"allUsedBrowsers",{configurable:true,get:foreign});return true;});
 assert.equal(f.lookup("https://example.org",true),true);
 assert.equal(Object.getOwnPropertyDescriptor(f.other.gZenWorkspaces,"allUsedBrowsers").get,foreign);
 f.Controller.prototype.switchToTab=wrapper;f.window.switchToTabHavingURI=wrapper;f.release();
 assert.equal(f.Controller.prototype.switchToTab,wrapper);assert.equal(f.window.switchToTabHavingURI,wrapper);
});
test("Hub nested URI reuse is suppressed and native scope remains intact",()=>{
 const f=uriScopeFixture();f.setNative(()=>{
  assert.equal(f.lookup("https://example.org",true),false);
  f.controller.switchToTab({url:"https://example.org"});
  assert.equal(f.other.gZenWorkspaces.allUsedBrowsers.length,0);return true;
 });
 assert.equal(f.lookup("https://example.org",true),true);assert.equal(f.calls.length,1);assert.equal(f.opens.length,0);
 assert.equal(f.other.gZenWorkspaces.allUsedBrowsers.length,1);f.release();
});
test("Hub split lookup with mismatched native tab index fails to local open, never native move",()=>{
 const f=uriScopeFixture({splitMismatch:true});
 assert.equal(f.lookup("https://example.org",true,{},null,{}),false);
 f.controller.switchToTab({url:"https://example.org"});
 assert.equal(f.calls.length,0);assert.equal(f.opens.length,2);
 assert.ok(f.logs.some(x=>x.e==="hub.uri.scope.restore"&&x.d.phase==="split-index"));
 f.release();
});
test("Hub prototype restore failure does not prevent window wrapper restoration",()=>{
 const f=uriScopeFixture();
 const proto=f.Controller.prototype,d=Object.getOwnPropertyDescriptor(proto,"switchToTab");
 Object.defineProperty(proto,"switchToTab",{...d,writable:false,configurable:false});
 f.release();assert.equal(f.window.switchToTabHavingURI,f.original);
 f.controller.switchToTab({url:"https://example.org"});assert.equal(f.calls.length,1);
 assert.ok(f.logs.some(x=>x.e==="hub.uri.dispose"&&x.d.failed===1));
});

test("Hub blocks reentry from the first native getter before any override exists",()=>{
 const f=uriScopeFixture(),m=f.window.gZenWorkspaces;
 const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(m),"allUsedBrowsers");
 let nested=false;
 Object.defineProperty(m,"allUsedBrowsers",{configurable:true,get(){
   if(!nested){nested=true;assert.equal(f.lookup("https://example.org",true),false);f.controller.switchToTab({url:"https://example.org"});}
   return d.get.call(this);
 }});
 assert.equal(f.lookup("https://example.org",true),true);
 assert.equal(f.calls.length,1);assert.equal(f.opens.length,0);
 assert.equal(f.helper[Symbol.for("oneplane.workspace-uri-transaction")],undefined);f.release();
});
test("Hub native URL bar miss opens once without calling provider unregister path",()=>{
 const f=uriScopeFixture();f.setNative((win,uri,openNew,params,context)=>{
   assert.equal(win,f.window);assert.equal(openNew,false);assert.equal(context,3);return false;
 });
 f.controller.switchToTab({url:"https://example.org",searchString:"test",userContextId:3});
 assert.equal(f.calls.length,1);assert.equal(f.providerCalls.length,0);assert.equal(f.opens.length,1);
 assert.equal(f.opens[0][3].userContextId,3);assert.equal(f.history.length,1);f.release();
});
test("Hub native URL bar success keeps native empty-tab cleanup and avoids extra open",()=>{
 const f=uriScopeFixture(),b=f.window.gBrowser,previous=b.selectedTab;previous.isEmpty=true;
 f.setNative((win,uri,openNew,params,context)=>{assert.equal(context,null);b.selectedTab=b.tabs[0];return true;});
 f.controller.switchToTab({url:"https://example.org",userContextId:-1,heuristic:true});
 assert.equal(f.providerCalls.length,0);assert.equal(f.opens.length,0);assert.equal(f.removed[0],previous);assert.equal(f.history.length,0);f.release();
});
test("Hub cleanup during getter acquisition cancels native lookup and restores descriptor",()=>{
 const f=uriScopeFixture(),m=f.window.gZenWorkspaces;
 const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(m),"allUsedBrowsers");
 const getter=function(){f.release();return d.get.call(this);};
 Object.defineProperty(m,"allUsedBrowsers",{configurable:true,get:getter});
 assert.equal(f.lookup("https://example.org",true),false);assert.equal(f.calls.length,0);assert.equal(f.opens.length,0);
 assert.equal(Object.getOwnPropertyDescriptor(m,"allUsedBrowsers").get,getter);
});

test("Hub suppresses fallback when a native getter releases scope then throws",()=>{
 const f=uriScopeFixture(),m=f.window.gZenWorkspaces;
 Object.defineProperty(m,"allUsedBrowsers",{configurable:true,get(){f.release();throw Error("cancelled getter");}});
 assert.equal(f.lookup("https://example.org",true),false);assert.equal(f.calls.length,0);assert.equal(f.opens.length,0);
});
test("Hub shared URL bar wrapper suppresses a nested unregistered window client",()=>{
 const f=uriScopeFixture();const foreign=new f.Controller();foreign.browserWindow=f.other;
 f.setNative(()=>{foreign.switchToTab({url:"https://example.org"});return true;});
 assert.equal(f.lookup("https://example.org",true),true);assert.equal(f.calls.length,1);assert.equal(f.providerCalls.length,0);f.release();
});
