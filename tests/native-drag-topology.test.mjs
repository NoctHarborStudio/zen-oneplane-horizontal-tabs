import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL("../src/"+p,import.meta.url),"utf8");
const engine=read("interactions/drag-engine.js.part");
const adapter=read("native/tab-adapter.js.part");
const sync=read("toolbar/tab-sync.js.part");
const lifecycle=read("core/window-lifecycle.js.part");
const ctrl=read("interactions/drag-controller.js.part");
const end=read("interactions/drag-end.js.part");
const topologyCode=engine.slice(engine.indexOf("  let nativeDragTopology=null;"),
  engine.indexOf("  const dragService="));
const startCode=engine.slice(engine.indexOf("  function startNativeDragLifecycle("),
  engine.indexOf("  function cancelActiveDrag("));

function fixture(){
  const attrs=new Set(),calls=[],window={gZenWorkspaces:{activeWorkspace:"w1"},__nocturneTrace:(name,payload)=>{
    calls.push(["trace",name,typeof payload==="function"?payload():payload]);
  }};
  const owner=window,source={id:"src",owner},other={id:"other",owner},group={id:"group"};
  const tabs=[source,other],roles=new Map(tabs.map(tab=>[tab,{group:null,split:false,pinned:false}]));
  const browser={selectedTab:source};
  let throwRead=false,visible=tabs;
  const readStripTopology=()=>{if(throwRead)throw Error("native inaccessible");
    return {selected:browser.selectedTab,tabs:visible.map(tab=>({tab,...roles.get(tab)}))};};
  const validNativeTab=tab=>!!tab&&!tab.closing&&tab.owner===window&&tabs.includes(tab);
  const tabOwner=tab=>tab?.owner;
  const body=[
    "let nativeDragToken=null,nativeDragIdentity=null,dragInsertPending=false,dragHandled=false;",
    "let dragCommit=false,active=true;",
    "const row={hasAttribute:k=>k==='data-op-drag-commit'&&dragCommit};",
    "const dragLifecycle={owns:token=>active&&token===nativeDragToken,",
    " current:()=>active&&nativeDragToken!==null?{kind:'tab',token:nativeDragToken}:null,",
    " begin:()=>{active=true;return 17;},finish:()=>{active=false;return true;}};",
    "const cancelActiveDrag=reason=>{calls.push(['cancel',reason]);active=false;nativeDragToken=null;",
    " nativeDragIdentity=null;nativeDragTopology=null;dragInsertPending=false;};",
    "const endDragVisual=()=>{calls.push(['tail-end']);nativeDragTopology=null;dragInsertPending=false;};",
    "const watchNativeDrag=()=>{},stopNativeDragWatch=()=>{};",
    "const cancelNativeDrag=()=>{calls.push(['engine-cancel']);};",
    topologyCode,startCode,
    "return {start:tab=>startNativeDragLifecycle({target:tab},tab),",
    " captured:()=>nativeDragTopology,current:nativeDragTopologyCurrent,retire:retireChangedNativeDragTopology,",
    " finish:()=>finishNativeDragLifecycle(),setCommit:v=>dragCommit=v,",
    " setTail:v=>{dragInsertPending=v;},setNativeToken:v=>nativeDragToken=v};"
  ].join("\n");
  const fn=new Function("window","browser","readStripTopology","validNativeTab","tabOwner","calls",body);
  const api=fn(window,browser,readStripTopology,validNativeTab,tabOwner,calls);
  return {api,calls,source,other,group,tabs,roles,owner,window,browser,
    select:tab=>browser.selectedTab=tab,order:newOrder=>visible=newOrder,
    failRead:()=>throwRead=true};
}

test("gesture snapshot ignores native selection, title and icon-only changes",()=>{
  const f=fixture();assert.equal(f.api.start(f.source),true);
  assert.equal(f.api.current(),true);
  f.select(f.other);f.source.label="Changed";
  assert.equal(f.api.retire("native-select"),false);
  assert.equal(f.api.current(),true);
  assert.deepEqual(f.calls.filter(x=>x[0]==="cancel"),[]);
});

test("external reorder retires exact gesture before mirror sync and only once",()=>{
  const f=fixture();f.api.start(f.source);
  f.order([f.other,f.source]);
  assert.equal(f.api.retire("projection-sync"),true);
  assert.equal(f.api.retire("projection-sync"),false);
  assert.deepEqual(f.calls.filter(x=>x[0]==="cancel"),[["cancel","native-topology-changed"]]);
  const event=f.calls.find(x=>x[0]==="trace"&&x[1]==="drag.topology.changed");
  assert.equal(event[2].previous,2);
  assert.equal(event[2].stage,"projection-sync");
});

test("native closing/removing drag source invalidates its lease",()=>{
  for(const removal of [f=>f.source.closing=true,f=>f.tabs.splice(0,1),
    f=>f.source.owner={}]){
    const f=fixture();f.api.start(f.source);removal(f);
    assert.equal(f.api.current(),false);
    assert.equal(f.api.retire("native-tab-change"),true);
    assert.equal(f.calls.filter(x=>x[0]==="cancel").length,1);
  }
});

test("group, split, pinned, visibility, Workspace and native read failures invalidate",()=>{
  for(const change of [
    f=>f.roles.get(f.source).group=f.group,
    f=>f.roles.get(f.source).split=true,
    f=>f.roles.get(f.other).pinned=true,
    f=>f.order([f.source]),
    f=>f.source.parentElement={},
    f=>f.source.getAttribute=key=>key==="zen-workspace-id"?"w2":null,
    f=>f.window.gZenWorkspaces.activeWorkspace="w2",
    f=>f.window.gZenWorkspaces={activeWorkspace:"w1"},
    f=>f.failRead()
  ]){
    const f=fixture();f.api.start(f.source);
    change(f);
    assert.equal(f.api.retire("native-mutation"),true);
    assert.equal(f.calls.filter(x=>x[0]==="cancel").length,1);
  }
});

test("source not in current native projection cannot begin OS gesture",()=>{
  const f=fixture();f.order([f.other]);
  assert.equal(f.api.start(f.source),false);
  assert.equal(f.api.captured(),null);
  assert.equal(f.api.current(),false);
});

test("own in-flight TabMove does not interrupt accepted native transaction",()=>{
  const f=fixture();f.api.start(f.source);f.api.setCommit(true);
  f.order([f.other,f.source]);
  assert.equal(f.api.retire("native-TabMove"),false);
  assert.deepEqual(f.calls.filter(x=>x[0]==="cancel"),[]);
  assert.equal(f.api.finish(),true,"exact source token can still finish");
});

test("post-drag insertion tail retires if native topology changes",()=>{
  const f=fixture();f.api.start(f.source);f.api.finish();f.api.setTail(true);
  f.order([f.other,f.source]);
  assert.equal(f.api.retire("native-tab-observer"),true);
  assert.equal(f.api.retire("native-tab-observer"),false);
  assert.deepEqual(f.calls.filter(x=>x[0]==="tail-end"),[["tail-end"]]);
  assert.equal(f.calls.some(x=>x[0]==="cancel"),false);
});

test("delivered custom drop rejects a stale source before native command",()=>{
  const code=adapter.slice(adapter.indexOf("  function readDraggedTab("),adapter.indexOf("  function splitGroup("));
  const source={};
  const owner={closed:false},destination={__nocturneTrace:()=>{}};
  const tab={owner},TYPE="application/x-oneplane-native-tab",KEY="__oneplaneTabDrag",calls=[];
  owner[KEY]={source:()=>tab,sourceToken:()=>3,group:()=>null,
    topologyCurrent:()=>false,retireTopology:()=>calls.push("retired")};
  const fn=new Function("Services","window","DRAG_TYPE","DRAG_CONTROLLER","tabOwner",
    "validNativeTab","privateState",code+"return readDraggedTab")(
      {wm:{}},destination,TYPE,KEY,t=>t?.owner,t=>t===tab,()=>false);
  const e=type=>({type,isTrusted:true,dataTransfer:{types:[TYPE],mozGetDataAt:()=>tab}});
  assert.equal(fn(e("dragover")),tab);
  assert.equal(fn(e("drop")),null);
  assert.deepEqual(calls,["retired"]);
});

test("actual Tab Sync and native events use the topology fence before projection",()=>{
  const a=sync.indexOf("  function syncNow("),b=sync.indexOf("  function schedule()",a);
  assert.ok(a>=0&&b>a);
  assert.match(sync.slice(a,b),/retireChangedNativeDragTopology\("projection-sync"\)/);
  assert.match(sync,/function onNativeTabEvent\(event\)/);
  assert.match(sync,/retireChangedNativeDragTopology\(event\?\.type\|\|"native-tab-event"\)/);
  assert.match(sync,/retireChangedNativeDragTopology\("native-tab-observer"\)/);
  assert.match(sync,/retireChangedNativeDragTopology\("native-workspace-observer"\)/);
  assert.match(lifecycle,/browser\.tabContainer\.addEventListener\(event, onNativeTabEvent\)/);
  assert.match(lifecycle,/browser\.tabContainer\.removeEventListener\(event, onNativeTabEvent\)/);
  assert.match(end,/topologyCurrent: \(\) => nativeDragTopologyCurrent\(\)/);
  assert.match(end,/retireChangedNativeDragTopology\("dragend"\)/);
  assert.match(ctrl,/dragChromeFrame=null;nativeDragTopology=null;/);
});

test("existing source event/cleanup owners remain single and do not add polling",()=>{
  assert.doesNotMatch(engine.slice(engine.indexOf("  let nativeDragTopology=null;"),
    engine.indexOf("  const dragService=")),/setTimeout|requestAnimationFrame|MutationObserver/);
  assert.match(lifecycle,/window\.addEventListener\("ZenWorkspaceDataChanged", onNativeTabEvent\)/);
  assert.match(lifecycle,/window\.removeEventListener\("ZenWorkspaceDataChanged", onNativeTabEvent\)/);
  assert.ok(!sync.includes("new MutationObserver(retireChangedNativeDragTopology)"));
});
