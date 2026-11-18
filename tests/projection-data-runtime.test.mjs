import {runWorkspaceCommand,requireWorkspaceDataCommand,workspaceCommandGate,workspaceCommandError,workspaceCommandState,workspaceEssentialSection} from "../src/core/workspace-commands.mjs";
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
const inspect=runInNewContext(cut("    function inspectProjectionReturn(","    // Zen chooses the first eligible")+"\ninspectProjectionReturn",{workspaceEssentialSection});
function harness(){
  const sync={getItemFromWindow(w,id){return w.gZenWorkspaces.allStoredTabs.find(t=>t.id===id)||w.groups?.get(id);}};
  const make=()=>{const t=tab("tab",{"zen-workspace-id":"work"}),tabs=[t];
    const physical=[t],normal={isConnected:true,querySelectorAll:()=>physical},pinned={isConnected:true,querySelectorAll:()=>[]};
    const element={isConnected:true,tabsContainer:normal,pinnedTabsContainer:pinned};
    const native={workspaceEnabled:true,currentWindowIsSyncing:true,isChangingWorkspace:false,allStoredTabs:tabs,
      getWorkspaces:()=>[{uuid:"work"}],workspaceElement:()=>element};
    const browser={tabs,isTab:()=>true,tabContainer:{_invalidateCachedTabs(){}}};
    const win={gZenWindowSync:sync,gZenWorkspaces:native,gZenStartup:{isReady:true},gBrowser:browser,
      document:{querySelectorAll:()=>[]},physical,groups:new Map()};
    t.documentGlobal=win;t.linkedBrowser={isRemoteBrowser:true};
    return win;
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

const target=runInNewContext(cut("    function projectionReturnTarget(","    // Runs in the SURVIVING")+"\nprojectionReturnTarget");
test("Return target requires the intended sole native survivor rather than focus order",()=>{
 const child={},source={},third={gZenWorkspaces:{privateWindowOrDisabled:false}},store={getWindowId:()=>true};
 assert.equal(target(child,source,{orderedWindows:[child,source]},store),true);
 assert.equal(target(child,source,{orderedWindows:[third,child,source]},store),false);
 third.gZenWorkspaces.privateWindowOrDisabled=true;
 assert.equal(target(child,source,{orderedWindows:[third,child,source]},store),true);
});
function closeHarness({failRegistration=false}={}){
 const context={isDiscarded:false},child={closed:false,browsingContext:context},window={closed:false},observers=new Map(),logs=[];
 const obs={addObserver(fn,topic){observers.set(fn,topic);if(failRegistration&&topic==="xul-window-destroyed")throw Error("registration");},removeObserver(fn){observers.delete(fn);}};
 const invoke=runInNewContext(cut("    async function invokeProjectionClose(","    async function acceptProjectionReturn(")+"\ninvokeProjectionClose",{
   window,projectionLog:(w,stage)=>logs.push(stage),workspaceCommandError:code=>Error(code)
 });
 const notify=(subject,topic)=>{for(const [fn,t] of [...observers])if(t===topic)fn(subject);};
 return {child,window,context,observers,logs,obs,invoke,notify};
}
test("Return retains source command after closed flag until exact close and native context discard",async()=>{
 const h=closeHarness();let done=false,calls=0;
 const p=h.invoke(h.child,()=>{},()=>{calls++;h.child.closed=true;},h.obs).then(v=>{done=true;return v;});
 await Promise.resolve();assert.equal(done,false);
 h.notify({},"domwindowclosed");h.notify(null,"xul-window-destroyed");await Promise.resolve();assert.equal(done,false);
 h.notify(h.child,"domwindowclosed");await Promise.resolve();assert.equal(done,false);
 h.context.isDiscarded=true;h.notify(null,"xul-window-destroyed");
 assert.equal((await p).status,"closed");assert.equal(calls,1);assert.equal(h.observers.size,0);
});
test("native veto settles without claiming the window closed",async()=>{
 const h=closeHarness();assert.equal((await h.invoke(h.child,()=>{},()=>{},h.obs)).status,"not-closed");assert.equal(h.observers.size,0);
});
test("partial observation failure invokes no native close and cleans observers",async()=>{
 const h=closeHarness({failRegistration:true});let calls=0;
 await assert.rejects(h.invoke(h.child,()=>{},()=>calls++,h.obs),/registration/);
 assert.equal(calls,0);assert.equal(h.observers.size,0);
});
test("source destruction before native close completion never certifies release",async()=>{
 const h=closeHarness();let settled=false;
 const p=h.invoke(h.child,()=>{},()=>{h.child.closed=true;},h.obs);p.then(()=>settled=true,()=>settled=true);
 h.notify(h.window,"domwindowclosed");h.context.isDiscarded=true;h.notify(h.child,"domwindowclosed");h.notify(null,"xul-window-destroyed");
 await Promise.resolve();await Promise.resolve();assert.equal(settled,false);assert.equal(h.observers.size,0);assert.deepEqual(h.logs,["return-owner-closed"]);
});
test("opener cancellation settles its wait without settling the native child command",async()=>{
 const wait=runInNewContext(cut("    function waitProjectionSelection(","    async function project(")+"\nwaitProjectionSelection");
 let callback,resolveNative,nativeSettled=false;
 const scope={defer(label,fn){callback=fn;return ()=>{callback=null;};}};
 const native=new Promise(r=>resolveNative=r).then(()=>nativeSettled=true);
 const p=wait(scope,native);callback();await assert.rejects(p,/owner disposed/);assert.equal(nativeSettled,false);
 resolveNative();await native;assert.equal(nativeSettled,true);
});

test("surviving source owns Return lease through actual child close, then releases global token",async()=>{
 const f=harness(),child=f.child,window=f.source,projection={source:window};
 const anchor={},observers=new Map(),context={isDiscarded:false};
 child.closed=false;window.closed=false;child.browsingContext=context;child.marker=projection;
 const tracker={orderedWindows:[window,child]},store={getWindowId:()=>true};
 const obs={addObserver(fn,topic){observers.set(fn,topic);},removeObserver(fn){observers.delete(fn);}};
 let closeCalls=0;child.BrowserCommands={tryToCloseWindow(){closeCalls++;child.closed=true;}};
 const accept=runInNewContext(cut("    function inspectProjectionReturn(","    async function returnProjection(")+"\nacceptProjectionReturn",{
   window,manager:()=>f.sourceNative,canProject:()=>true,destroyed:false,PROJECTION:"marker",
   ChromeUtils:{importESModule:()=>({BrowserWindowTracker:tracker})},Services:{obs},trashSessionStore:()=>store,
   workspaceCommandGate,workspaceCommandError,requireWorkspaceDataCommand,workspaceEssentialSection,
   runWorkspaceCommand:(w,n,k,current,execute,opts)=>runWorkspaceCommand(w,n,k,current,execute,{...opts,anchor}),
   projectionLog(){}
 });
 workspaceCommandGate(window).returnEndpoint=accept;
 const pending=accept(child,projection);
 assert.equal(closeCalls,1);assert.equal(workspaceCommandState(window).blocked,true);
 assert.equal(workspaceCommandState(child).reserved,true);
 await assert.rejects(runWorkspaceCommand(window,f.sourceNative,"select",()=>true,()=>{}),e=>e.code==="busy");
 const third=harness().source;
 await assert.rejects(runWorkspaceCommand(third,third.gZenWorkspaces,"data",()=>true,()=>{}, {data:true,anchor}),e=>e.code==="data-busy");
 const notify=(subject,topic)=>{for(const [fn,t] of [...observers])if(t===topic)fn(subject);};
 notify(child,"domwindowclosed");await Promise.resolve();assert.equal(workspaceCommandState(window).blocked,true);
 context.isDiscarded=true;notify(null,"xul-window-destroyed");
 assert.equal((await pending).status,"closed");assert.equal(workspaceCommandState(window).blocked,false);
 assert.equal(observers.size,0);assert.equal(await runWorkspaceCommand(third,third.gZenWorkspaces,"data",()=>true,()=>42,{data:true,anchor}),42);
});

test("Return rejects unlisted physical tabs and physically mismatched workspace ownership",()=>{
 const h=harness();h.source.physical.push(tab("hidden",{"zen-workspace-id":"work"}));assert.equal(h.run(),false);
 const j=harness();j.source.physical.length=0;assert.equal(j.run(),false);
 const k=harness();k.sourceNative.workspaceElement().tabsContainer.querySelectorAll=()=>[tab("other",{"zen-workspace-id":"work"})];assert.equal(k.run(),false);
});
test("Return rejects mismatched native group membership despite matching tab IDs",()=>{
 const h=harness(),t=h.sourceNative.allStoredTabs[0];
 t.group={id:"group",isConnected:true,contains:x=>x===t,hasAttribute:()=>false};
 assert.equal(h.run(),false);
});

test("Return rejects visible child docshell if native swap cannot run",()=>{
 const h=harness(),tab=h.native.allStoredTabs[0],peer=h.sourceNative.allStoredTabs[0];
 tab._zenContentsVisible=true;assert.equal(h.run(),true);
 peer.linkedBrowser.isRemoteBrowser=false;assert.equal(h.run(),false);
 peer.linkedBrowser.isRemoteBrowser=true;peer._zenContentsVisible=true;assert.equal(h.run(),false);
 peer._zenContentsVisible=false;peer.linkedBrowser=null;assert.equal(h.run(),false);
});
test("Return verifies nested group ancestry, not only the immediate group",()=>{
 const h=harness();
 const assign=(win,outerId)=>{
   const t=win.gZenWorkspaces.allStoredTabs[0],outer={id:outerId,isConnected:true,pinned:false,contains:()=>true,hasAttribute:()=>false};
   const inner={id:"inner",isConnected:true,pinned:false,contains:x=>x===t,hasAttribute:()=>false,group:outer};
   t.group=inner;win.groups.set(inner.id,inner);win.groups.set(outer.id,outer);
 };
 assign(h.child,"outer");assign(h.source,"outer");assert.equal(h.run(),true);
 assign(h.source,"different");assert.equal(h.run(),false);
});
test("Return fails closed on Glance topology rather than assuming a transferable tab",()=>{
 const h=harness(),t=h.native.allStoredTabs[0],p=h.sourceNative.allStoredTabs[0];
 t.hasAttribute=p.hasAttribute=k=>k==="glance-id";
 assert.equal(h.run(),false);
});
test("Return requires native tab document identity even for an otherwise matching peer",()=>{
 const h=harness();h.sourceNative.allStoredTabs[0].documentGlobal=h.child;
 assert.equal(h.run(),false);
});

test("Return observer acquisition interrupted by source close leaves no late observer",async()=>{
 const h=closeHarness(),add=h.obs.addObserver;let calls=0;
 h.obs.addObserver=function(fn,topic){add.call(this,fn,topic);h.notify(h.window,"domwindowclosed");};
 await assert.rejects(h.invoke(h.child,()=>{},()=>calls++,h.obs),/close-unavailable/);
 assert.equal(calls,0);assert.equal(h.observers.size,0);
});
