import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const s=readFileSync(new URL("../src/hub/controller.js.part",import.meta.url),"utf8");
const a=s.indexOf("    function waitForProjectionReady("),b=s.indexOf("    async function project(",a);
assert.ok(a>=0&&b>a);
function harness(){
  const child=new EventTarget(),window=new EventTarget(),observers=new Map();
  window.setTimeout=setTimeout;window.clearTimeout=clearTimeout;
  child.closed=false;window.closed=false;
  let resolveSpaces;
  const spaces=new Promise(r=>{resolveSpaces=r});
  const wait=runInNewContext(s.slice(a,b)+"\nwaitForProjectionReady",{
    window,destroyed:false,Services:{obs:{addObserver(fn,topic){observers.set(fn,topic)},removeObserver(fn){observers.delete(fn)}}}
  });
  return {child,window,observers,wait,resolveSpaces,spaces,
    notify(subject,topic){for(const [fn,t] of [...observers])if(t===topic)fn(subject);}};
}
test("projection survives initial document unload and waits for actual workspace readiness",async()=>{
  const h=harness();let probes=0,done=false;
  const p=h.wait(h.child,()=>probes++).then(()=>{done=true});
  h.child.dispatchEvent(new Event("unload"));h.window.dispatchEvent(new Event("unload"));
  h.notify({},"domwindowclosed");
  h.child.gBrowserInit={delayedStartupFinished:true};
  h.child.gZenWorkspaces={promiseInitialized:h.spaces};
  h.notify(h.child,"browser-delayed-startup-finished");
  await Promise.resolve();assert.equal(done,false);
  h.resolveSpaces();await p;
  assert.ok(probes>=2);assert.equal(done,true);assert.equal(h.observers.size,0);
});
test("real window close rejects projection and releases observers",async()=>{
  const h=harness();const p=h.wait(h.child);
  h.child.closed=true;h.notify(h.child,"domwindowclosed");
  await assert.rejects(p,/Native window closed/);assert.equal(h.observers.size,0);
});
test("already-ready window does not require a later startup notification",async()=>{
  const h=harness();
  h.child.gBrowserInit={delayedStartupFinished:true};
  h.child.gZenWorkspaces={promiseInitialized:Promise.resolve()};
  await h.wait(h.child);assert.equal(h.observers.size,0);
});
