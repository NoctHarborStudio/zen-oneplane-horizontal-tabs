import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const s=readFileSync(new URL("../src/hub/controller.js.part",import.meta.url),"utf8");
const a=s.indexOf("    function installProjectionEmptyGuard("),b=s.indexOf("    function untouchedProjectionTab(",a);
assert.ok(a>=0&&b>a);
const install=runInNewContext(s.slice(a,b)+"\ninstallProjectionEmptyGuard",{projectionLog(){}});
function harness(hasEmpty=true){
  const child=new EventTarget(),recorded=[],tabs=[];
  const empty={isConnected:true,closing:false,hasAttribute:n=>n==="zen-empty-tab"};
  const browser=child.gBrowser={tabs,isTab:t=>!!t,selectedTab:null};
  const original=function(){const t={};tabs.push(t);return t;};
  const spaces=child.gZenWorkspaces={_emptyTab:hasEmpty?empty:null,selectEmptyTab:original};
  const stop=install(child,t=>recorded.push(t),()=>false);
  return {child,spaces,original,stop,empty,browser,recorded};
}
test("projection startup selects existing native placeholder, creates no ordinary tab",()=>{
  const h=harness();assert.equal(h.spaces.selectEmptyTab(),h.empty);
  assert.equal(h.browser.selectedTab,h.empty);assert.equal(h.browser.tabs.length,0);
  h.child.dispatchEvent(new Event("AfterWorkspacesSessionRestore"));
  assert.equal(h.spaces.selectEmptyTab,h.original);
});
test("missing placeholder records only native-created fallback; explicit URL untouched",()=>{
  const h=harness(false);const fallback=h.spaces.selectEmptyTab();
  assert.deepEqual(h.recorded,[fallback]);h.spaces.selectEmptyTab("https://example.com");
  assert.equal(h.recorded.length,1);h.stop();assert.equal(h.spaces.selectEmptyTab,h.original);
});
