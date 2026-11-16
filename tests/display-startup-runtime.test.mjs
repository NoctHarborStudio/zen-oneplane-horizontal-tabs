import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const source=readFileSync(new URL("../src/interactions/display-engine.js.part",import.meta.url),"utf8");
const start=source.indexOf("  function placeAfterStartup("),end=source.indexOf("  function onSourceDrag(",start);
assert.ok(start>=0&&end>start);
function harness(ready=false){
  const window=new EventTarget(),child=new EventTarget(),observers=new Set();
  const calls=[];
  window.setTimeout=setTimeout;window.clearTimeout=clearTimeout;
  child.gBrowserInit={delayedStartupFinished:ready};child.closed=false;
  const place=runInNewContext(source.slice(start,end)+"\nplaceAfterStartup",{
    window,dead:false,displaySnapEnabled:()=>true,
    Services:{obs:{addObserver(fn){observers.add(fn)},removeObserver(fn){observers.delete(fn)}}},
    placeNativeWindow:async(w,t)=>{calls.push([w,t]);return true},
    console:{warn(){}},logPlacement(){}
  });
  return {window,child,observers,calls,place,notify(subject){for(const fn of [...observers])fn(subject)}};
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
  h.child.dispatchEvent(new Event("unload"));h.notify(h.child);
  assert.equal(await pending,false);assert.equal(h.calls.length,0);
  assert.equal(h.observers.size,0);
});
