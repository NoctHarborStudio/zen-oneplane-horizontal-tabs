import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const s=readFileSync(new URL("../src/hub/controller.js.part",import.meta.url),"utf8");
function cut(start,end){const a=s.indexOf(start),b=s.indexOf(end,a);assert.ok(a>=0&&b>a);return s.slice(a,b);}
function tab(id,attrs={}){return {id,isConnected:true,closing:false,pinned:false,hasAttribute:k=>Object.hasOwn(attrs,k),getAttribute:k=>attrs[k]??null};}
test("projection startup selects native placeholder but never removes residual synced tabs",()=>{
  const empty=tab("empty",{"zen-empty-tab":""}),residual=tab("residual"),records=[];
  const native={activeWorkspace:"work",_emptyTab:empty};
  const browser={selectedTab:residual,isTab:()=>true,removeTab(){throw Error("unexpected native close");}};
  const child={gBrowser:browser,gZenWorkspaces:native};
  const run=runInNewContext(cut("    function prepareProjectionStart(","    // A synced child can inherit")+"\nprepareProjectionStart",{
    requireWorkspaceCommand(){},projectionLog(win,stage,data){records.push(data);}
  });
  assert.equal(run(child,"work",new Set([residual]),native,browser,{}),empty);
  assert.equal(browser.selectedTab,empty);assert.equal(records[0].retained,1);assert.equal(records[0].removed,0);
});
test("reentrant placeholder selection invalidates the projection lease",()=>{
  const empty=tab("empty",{"zen-empty-tab":""}),native={activeWorkspace:"work",_emptyTab:empty};
  const browser={isTab:()=>true,set selectedTab(t){stale=true;},get selectedTab(){return empty;}};
  let stale=false;const child={gBrowser:browser,gZenWorkspaces:native};
  const run=runInNewContext(cut("    function prepareProjectionStart(","    // A synced child can inherit")+"\nprepareProjectionStart",{
    requireWorkspaceCommand(){if(stale)throw Error("stale");},projectionLog(){}
  });
  assert.throws(()=>run(child,"work",new Set(),native,browser,{}),/stale/);
});
const inspect=runInNewContext(cut("    function inspectProjectionReturn(","    async function returnProjection(")+"\ninspectProjectionReturn");
function harness(){
  const sync={getItemFromWindow(w,id){return w.gZenWorkspaces.allStoredTabs.find(t=>t.id===id);}};
  const make=()=>{const t=tab("tab",{"zen-workspace-id":"work"}),tabs=[t];
    const native={workspaceEnabled:true,currentWindowIsSyncing:true,isChangingWorkspace:false,allStoredTabs:tabs};
    const browser={tabs,isTab:()=>true,tabContainer:{_invalidateCachedTabs(){}}};
    return {gZenWindowSync:sync,gZenWorkspaces:native,gZenStartup:{isReady:true},gBrowser:browser};
  };
  const child=make(),source=make(),native=child.gZenWorkspaces,sourceNative=source.gZenWorkspaces;
  return {child,source,native,sourceNative,run:()=>inspect(child,source,native,sourceNative,sync)};
}
test("Return accepts only live exact native identities in a ready synced source",()=>{
  const h=harness();assert.equal(h.run(),true);
  h.sourceNative.allStoredTabs[0].isConnected=false;assert.equal(h.run(),false);
});
test("Return fails closed on duplicate or missing native cache identity",()=>{
  const h=harness();h.sourceNative.allStoredTabs.push(tab("tab"));assert.equal(h.run(),false);
  const j=harness();j.child.gBrowser.tabs=[...j.native.allStoredTabs,tab("unlisted")];assert.equal(j.run(),false);
});
test("Return rejects changed manager, window close, container or native switch",()=>{
  const h=harness();h.source.gZenWorkspaces={...h.sourceNative};assert.equal(h.run(),false);
  const j=harness();j.source._zenClosingWindow=true;assert.equal(j.run(),false);
  const k=harness();k.sourceNative.allStoredTabs[0].pinned=true;assert.equal(k.run(),false);
  const l=harness();l.sourceNative.isChangingWorkspace=true;assert.equal(l.run(),false);
});
