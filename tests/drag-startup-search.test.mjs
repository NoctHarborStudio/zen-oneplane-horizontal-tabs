import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const search=read("src/interactions/startup-search.js.part");
const engine=read("src/interactions/drag-engine.js.part");
const controller=read("src/interactions/drag-controller.js.part");
const address=read("src/toolbar/address-controller.js.part");
const tabs=read("src/toolbar/tab-sync.js.part");
const lifecycle=read("src/core/window-lifecycle.js.part");

function fixture(){
  let next=0,active=null,empty=true,barOpen=false;
  const queue=new Map(),calls=[],events=[];
  const tab={
    hasAttribute:key=>key==="zen-empty-tab"&&empty,
    linkedBrowser:{currentURI:{spec:"about:newtab"}}
  };
  const browser={selectedTab:tab};
  const bar={
    value:"draft",view:{get isOpen(){return barOpen;}},
    hasAttribute:key=>key==="zen-newtab" || (barOpen && (key==="open" || key==="focused")),
    search(value){calls.push(["search",value]);}
  };
  const win={
    gURLBar:bar,
    __nocturneTrace(name,detail){events.push([name,detail]);},
    setTimeout(fn,ms){assert.equal(ms,80);const id=++next;queue.set(id,fn);return id;},
    clearTimeout(id){queue.delete(id);}
  };
  const body=[
    "let dead=false,restoreSearchTimer=0,pointerSearch=null,dragSearch=null;",
    "let dragInsertPending=false,incomingDrag=null,nativeDragToken=null;",
    "const row={hasAttribute(){return false;}};",
    "const dragLifecycle={current:()=>control.active()};",
    search,
    "return {readStartupSearch,restoreStartupSearch,cancelStartupSearchRestore,rememberStartupSearch,",
    " timer:()=>restoreSearchTimer,epoch:()=>startupSearchEpoch,",
    " setGesture(token){nativeDragToken=token;},setDead(v){dead=v;},setIncoming(v){incomingDrag=v;}};"
  ].join("\n");
  const api=new Function("window","browser","validNativeTab","document","control",body)(
    win,browser,x=>x===tab,{getElementById:()=>({doCommand(){calls.push(["open-location"]);}})},{
      active:()=>active
    });
  const state=(token,query="draft")=>({tab,empty:true,newtab:true,gestureToken:token,query,
    uri:tab.linkedBrowser.currentURI.spec});
  const tick=id=>{const fn=queue.get(id);assert.ok(fn,"timer absent");queue.delete(id);fn();};
  return {api,queue,calls,events,tab,browser,bar,win,state,tick,
    setActive:v=>{active=v;},setEmpty:v=>{empty=v;},setBarOpen:v=>{barOpen=v;}};
}

test("native search returns exactly once for a completed untouched gesture",()=>{
  const f=fixture();
  f.api.restoreStartupSearch(f.state(41));
  const id=f.api.timer();assert.ok(id);
  f.tick(id);
  assert.deepEqual(f.calls,[["search","draft"],["open-location"]]);
  assert.equal(f.api.timer(),0);
  f.api.restoreStartupSearch({tab:f.tab,query:"unsafe",newtab:true});
  assert.equal(f.api.timer(),0,"missing gesture token cannot restore search");
});

test("stale callbacks cannot reset or consume a successor's pending timer",()=>{
  const f=fixture();
  f.api.restoreStartupSearch(f.state(1,"old"));
  const oldId=f.api.timer(),stale=f.queue.get(oldId);
  f.api.cancelStartupSearchRestore("dragstart");
  f.api.restoreStartupSearch(f.state(2,"new"));
  const nextId=f.api.timer();
  stale();
  assert.equal(f.api.timer(),nextId,"stale timer cannot erase new owner");
  assert.deepEqual(f.calls,[]);
  f.tick(nextId);
  assert.deepEqual(f.calls,[["search","new"],["open-location"]]);
});

test("trusted pointer reentry and active native gesture fence delayed search",()=>{
  const f=fixture();
  f.api.restoreStartupSearch(f.state(1));
  const stale=f.queue.get(f.api.timer());
  f.api.rememberStartupSearch({button:0,isTrusted:true});
  stale();assert.deepEqual(f.calls,[]);assert.equal(f.api.timer(),0);
  f.api.restoreStartupSearch(f.state(2));
  f.setActive({kind:"tab",token:3});f.tick(f.api.timer());
  assert.deepEqual(f.calls,[],"new tab gesture may not reopen an old search");
  f.setActive(null);
  f.api.restoreStartupSearch(f.state(4));
  f.api.setGesture(5);f.tick(f.api.timer());
  assert.deepEqual(f.calls,[],"another owned drag blocks search recovery");
});

test("native navigation, empty-tab identity and selection changes fail closed",()=>{
  const f=fixture();
  f.api.restoreStartupSearch(f.state(1));
  f.tab.linkedBrowser.currentURI.spec="https://example.invalid/";
  f.tick(f.api.timer());
  assert.deepEqual(f.calls,[],"same native tab with different URI must not reopen search");
  f.tab.linkedBrowser.currentURI.spec="about:newtab";
  f.api.restoreStartupSearch(f.state(2));
  f.setEmpty(false);f.tab.linkedBrowser.currentURI.spec="https://example.invalid/";
  f.tick(f.api.timer());
  assert.deepEqual(f.calls,[]);
  f.setEmpty(true);f.tab.linkedBrowser.currentURI.spec="about:newtab";
  f.api.restoreStartupSearch(f.state(3));
  f.browser.selectedTab={};f.tick(f.api.timer());
  assert.deepEqual(f.calls,[]);
});

test("trusted native address input invalidates search, synthetic input does not",()=>{
  const f=fixture();
  const a=address.indexOf("  function onAddressInput("),b=address.indexOf("  function alignAddressStart(",a);
  assert.ok(a>=0&&b>a);
  const body=[
    "let addressSettling=false,addressTransition=null;",
    "function rememberCompactAddress(){}",
    address.slice(a,b),
    "return onAddressInput;"
  ].join("\n");
  const onInput=new Function("cancelStartupSearchRestore","restoreSearchTimer",body)(
    f.api.cancelStartupSearchRestore,1);
  f.api.restoreStartupSearch(f.state(1));const stale=f.queue.get(f.api.timer());
  onInput({type:"input",isTrusted:false});
  assert.ok(f.api.timer(),"synthetic input must not cancel native recovery");
  onInput({type:"input",isTrusted:true});
  stale();assert.deepEqual(f.calls,[]);
});

test("layout wires exact native input, gesture and cleanup owners",()=>{
  assert.match(controller,/cancelStartupSearchRestore\("dragstart"\)/);
  assert.match(controller,/gestureToken:nativeDragToken/);
  assert.match(engine,/cancelStartupSearchRestore\("drag-cancel"\)/);
  assert.match(engine,/cancelStartupSearchRestore\("new-pointerdown"\)/);
  assert.match(engine,/cancelStartupSearchRestore\("new-keydown"\)/);
  assert.match(tabs,/cancelStartupSearchRestore\("native-tab-select"\)/);
  assert.match(tabs,/cancelStartupSearchRestore\("native-tab-change"\)/);
  assert.match(lifecycle,/cancelStartupSearchRestore\("destroy"\)/);
  assert.match(lifecycle,/row.addEventListener\("pointerdown", rememberStartupSearch, true\)/);
  assert.match(lifecycle,/bar.addEventListener\("input", onAddressInput, true\)/);
});
