import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const source=readFileSync(new URL("../src/hub/controller.js.part",import.meta.url),"utf8");
const a=source.indexOf("    async function openProjectionSearch("),b=source.indexOf("    // A newly opened chrome WindowProxy",a);
assert.ok(a>=0&&b>a);
function harness(session=false,visible=false){
  const attrs=new Set(session?["zen-newtab"]:[]);
  let opened=0,resumed=0,focused=0,interacted=false;
  const bar={view:{isOpen:visible},hasAttribute:k=>attrs.has(k),search(){resumed++;}};
  const child={closed:false,gURLBar:bar,gZenWorkspaces:{activeWorkspace:"work"},gBrowser:{selectedTab:{hasAttribute:k=>k==="zen-empty-tab"}},
    document:{hasFocus:()=>true,getElementById:()=>({doCommand(){bar.view.isOpen=true;}})},
    focus(){focused++;},gZenUIManager:{handleNewTab(){opened++;attrs.add("zen-newtab");bar.view.isOpen=true;return true;}}};
  const run=runInNewContext(source.slice(a,b)+"\nopenProjectionSearch",{
    window:{closed:false,setTimeout(fn){queueMicrotask(fn)}},destroyed:false,projectionLog(){}
  });
  return {child,bar,run:()=>run(child,"work",()=>interacted),counts:()=>({opened,resumed,focused}),interact(){interacted=true;}};
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
