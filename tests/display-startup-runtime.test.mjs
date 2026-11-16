import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const source=readFileSync(new URL("../src/interactions/display-engine.js.part",import.meta.url),"utf8");
const start=source.indexOf("  function placeAfterStartup("),end=source.indexOf("  function onSourceDrag(",start);
assert.ok(start>=0&&end>start);
function harness(ready=false){
  const window=new EventTarget(),child=new EventTarget(),observers=new Map();
  const calls=[];
  window.setTimeout=setTimeout;window.clearTimeout=clearTimeout;
  child.gBrowserInit={delayedStartupFinished:ready};child.closed=false;
  const place=runInNewContext(source.slice(start,end)+"\nplaceAfterStartup",{
    window,dead:false,displaySnapEnabled:()=>true,
    Services:{obs:{addObserver(fn,topic){observers.set(fn,topic)},removeObserver(fn){observers.delete(fn)}}},
    placeNativeWindow:async(w,t)=>{calls.push([w,t]);return true},
    console:{warn(){}},logPlacement(){}
  });
  return {window,child,observers,calls,place,notify(subject,topic="browser-delayed-startup-finished"){for(const [fn,t] of [...observers])if(t===topic)fn(subject)}};
}
test("placement waits only for its own native startup and runs once",async()=>{
  const h=harness(),target={mode:"maximize"};
  const pending=h.place(h.child,target);
  assert.equal(h.calls.length,0);
  h.notify({});assert.equal(h.calls.length,0);
  h.notify(h.child);h.notify(h.child);
  assert.equal(await pending,true);assert.deepEqual(h.calls,[[h.child,target]]);
  assert.equal(h.observers.size,0);
});
test("already-ready child is placed immediately without a workspace promise",async()=>{
  const h=harness(true);
  assert.equal(await h.place(h.child,{mode:"right"}),true);
  assert.equal(h.calls.length,1);assert.equal(h.observers.size,0);
});
test("closing the child before startup cancels placement and removes observer",async()=>{
  const h=harness();const pending=h.place(h.child,{mode:"left"});
  h.child.closed=true;h.notify(h.child,"domwindowclosed");h.notify(h.child);
  assert.equal(await pending,false);assert.equal(h.calls.length,0);
  assert.equal(h.observers.size,0);
});

test("maximize waits for Zen startup and ignores duplicate notifications",async()=>{
  const h=harness(true);let ready;
  h.child.gZenStartup={promiseInitialized:new Promise(resolve=>{ready=resolve;})};
  const pending=h.place(h.child,{mode:"maximize"});
  h.notify(h.child);assert.equal(h.calls.length,0);
  ready();assert.equal(await pending,true);assert.equal(h.calls.length,1);
});
test("closing during Zen initialization prevents late maximize",async()=>{
  const h=harness(true);let ready;
  h.child.gZenStartup={promiseInitialized:new Promise(resolve=>{ready=resolve;})};
  const pending=h.place(h.child,{mode:"maximize"});
  h.child.closed=true;h.notify(h.child,"domwindowclosed");ready();
  assert.equal(await pending,false);await Promise.resolve();assert.equal(h.calls.length,0);
});

test("maximize does not remain blocked by unresolved Zen initialization",async()=>{
  const h=harness(true);h.child.gZenStartup={promiseInitialized:new Promise(()=>{})};
  assert.equal(await h.place(h.child,{mode:"maximize"}),true);
  assert.equal(h.calls.length,1);
});

test("initial chrome document unload is not a native window close",async()=>{
  const h=harness(),target={mode:"maximize"};
  const pending=h.place(h.child,target);
  h.child.dispatchEvent(new Event("unload"));
  h.window.dispatchEvent(new Event("unload"));
  h.notify({},"domwindowclosed");
  assert.equal(h.calls.length,0);assert.equal(h.observers.size,2);
  h.child.gBrowserInit.delayedStartupFinished=true;
  h.notify(h.child);
  assert.equal(await pending,true);assert.deepEqual(h.calls,[[h.child,target]]);
  assert.equal(h.observers.size,0);
});
