import {createDisposableScope} from "../src/core/disposable-scope.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const source=readFileSync(new URL("../src/hub/controller.js.part",import.meta.url),"utf8");
const a=source.indexOf("    async function openProjectionSearch("),b=source.indexOf("    // A newly opened chrome WindowProxy",a);
assert.ok(a>=0&&b>a);
function harness(session=false,visible=false,{manual=false,failTimer=false}={}){
  const attrs=new Set(session?["zen-newtab"]:[]);
  let opened=0,resumed=0,focused=0,interacted=false,next=0;
  const scope=createDisposableScope(),timers=new Map();
  const bar={view:{isOpen:visible},hasAttribute:k=>attrs.has(k),search(){resumed++;}};
  const empty={isConnected:true,closing:false,hasAttribute:k=>k==="zen-empty-tab"};
  const child={closed:false,gURLBar:bar,gZenWorkspaces:{activeWorkspace:"work",_emptyTab:empty},gBrowser:{selectedTab:empty,isTab:t=>t===child.gZenWorkspaces._emptyTab},
    document:{hasFocus:()=>true,getElementById:()=>({doCommand(){bar.view.isOpen=true;}})},
    focus(){focused++;},gZenUIManager:{handleNewTab(){opened++;attrs.add("zen-newtab");bar.view.isOpen=true;return true;}}};
  const native=child.gZenWorkspaces,browser=child.gBrowser;
  const run=runInNewContext(source.slice(a,b)+"\nopenProjectionSearch",{
    window:{closed:false,setTimeout(fn){if(failTimer)throw Error("timer unavailable");const id=++next;timers.set(id,fn);if(!manual)queueMicrotask(()=>timers.get(id)?.());return id;},clearTimeout(id){timers.delete(id);}},destroyed:false,projectionLog(){}
  });
  return {child,bar,scope,timers,run:()=>run(child,"work",native,browser,empty,scope,()=>interacted),counts:()=>({opened,resumed,focused}),interact(){interacted=true;scope.dispose();}};
}
test("inherited zen-newtab flag with closed view resumes native search",async()=>{
  const h=harness(true,false);assert.equal(await h.run(),true);
  assert.deepEqual(h.counts(),{opened:0,resumed:1,focused:1});
});
test("fresh search opens once; already visible search never toggles",async()=>{
  const fresh=harness();assert.equal(await fresh.run(),true);assert.equal(fresh.counts().opened,1);
  const visible=harness(true,true);assert.equal(await visible.run(),true);assert.deepEqual(visible.counts(),{opened:0,resumed:0,focused:1});
});
test("real input or changed workspace prevents startup takeover",async()=>{
  const h=harness(true,false),p=h.run();h.interact();assert.equal(await p,false);assert.equal(h.counts().resumed,0);
  const j=harness(),q=j.run();j.child.gZenWorkspaces.activeWorkspace="other";assert.equal(await q,false);assert.equal(j.counts().opened,0);
});

test("synchronous search callback takeover prevents native OpenLocation",async()=>{
  const h=harness(true,false);h.bar.search=()=>h.interact();
  assert.equal(await h.run(),false);assert.equal(h.bar.view.isOpen,false);
});

test("disposal settles an outstanding search wait without another timer tick",async()=>{
  const h=harness(false,false,{manual:true});const p=h.run();assert.equal(h.timers.size,1);
  h.scope.dispose();assert.equal(await p,false);assert.equal(h.timers.size,0);assert.equal(h.counts().opened,0);
});
test("placeholder replaced before placement completion prevents automatic focus and search",async()=>{
  const h=harness();const replacement={...h.child.gZenWorkspaces._emptyTab};
  h.child.gZenWorkspaces._emptyTab=replacement;h.child.gBrowser.selectedTab=replacement;
  assert.equal(await h.run(),false);assert.deepEqual(h.counts(),{opened:0,resumed:0,focused:0});
});
test("placeholder replaced during search wait prevents native search",async()=>{
  const h=harness(),p=h.run();const replacement={...h.child.gZenWorkspaces._emptyTab};
  h.child.gZenWorkspaces._emptyTab=replacement;h.child.gBrowser.selectedTab=replacement;
  assert.equal(await p,false);assert.equal(h.counts().opened,0);assert.equal(h.scope.size,0);
});
test("timer acquisition failure aborts search without retrying native actions",async()=>{
  const h=harness(false,false,{failTimer:true});assert.equal(await h.run(),false);
  assert.equal(h.counts().opened,0);assert.equal(h.scope.size,0);
});
