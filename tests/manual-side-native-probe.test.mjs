import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const source=read("scripts/manual-side-native-probe.js");
const key="nocturne.manual-side.probe.v1";
const arm="disposable-profile";
function fixture(){
  const windows=[],values=new Map(),writes=[],traces=[],sync={};
  let current,enabled=true,pinnedOnly=false,afterRead=()=>{},afterWrite=()=>{};
  function make(id="same-native-id"){
    const w={gZenStartup:{isReady:true},gZenWindowSync:sync};
    const attrs=new Map([["zen-workspace-id","workspace-id"]]);
    const t={id,isConnected:true,userContextId:0,ownerDocument:{defaultView:w},
      hasAttribute:k=>attrs.has(k),getAttribute:k=>attrs.get(k)};
    const container={isConnected:true,contains:n=>n===t};
    w.gBrowser={selectedTab:t,isTab:n=>n===t};
    w.gZenWorkspaces={workspaceEnabled:true,currentWindowIsSyncing:true,privateWindowOrDisabled:false,
      allStoredTabs:[t],workspaceElement:()=>({tabsContainer:container})};
    w.document={getElementById:k=>t.id===k?t:null};
    w.__nocturneTrace=(event,data)=>traces.push({event,data});
    windows.push(w);return {w,t,attrs};
  }
  const a=make(),b=make();current=a.w;
  const store={getWindowId:w=>w.untracked?null:"tracked",
    getCustomTabValue(t,k){assert.equal(k,key);const v=values.get(t)??"";afterRead();return v;},
    setCustomTabValue(t,k,v){assert.equal(k,key);writes.push(["set",t]);values.set(t,v);afterWrite();},
    deleteCustomTabValue(t,k){assert.equal(k,key);writes.push(["delete",t]);values.delete(t);afterWrite();}};
  const ChromeUtils={importESModule(path){
    if(path.endsWith("/SessionStore.sys.mjs"))return {SessionStore:store};
    if(path.endsWith("/PrivateBrowsingUtils.sys.mjs"))return {PrivateBrowsingUtils:{isWindowPrivate:w=>w.private===true}};
    if(path.endsWith("/BrowserWindowTracker.sys.mjs"))return {BrowserWindowTracker:{get orderedWindows(){return windows}}};
    throw Error("unexpected module");
  }};
  const Services={wm:{getMostRecentWindow:()=>current},prefs:{getBoolPref:k=>k==="zen.window-sync.enabled"?enabled:pinnedOnly}};
  const api=new Function("ChromeUtils","Services",source+"\nreturn nocturneSideProbe;")(ChromeUtils,Services);
  const call=(method,...args)=>JSON.parse(api[method](...args));
  return {a,b,make,call,values,writes,traces,focus:w=>{current=w},setPinnedOnly:v=>{pinnedOnly=v},
    setEnabled:v=>{enabled=v},afterRead:fn=>{afterRead=fn},afterWrite:fn=>{afterWrite=fn}};
}
test("loading and sampling do not mutate native values; probe remains outside runtime",()=>{
  const f=fixture();assert.equal(f.writes.length,0);assert.equal(f.traces.length,0);
  const s=f.call("snapshot");assert.equal(s.status,"read");assert.equal(s.missing,2);
  assert.equal(f.writes.length,0);assert.equal(f.traces.length,1);
  assert.ok(!read("scripts/build-plan.json").includes("manual-side-native-probe"));
  assert.ok(!read("theme.json").includes("manual-side-native-probe"));
});
test("explicit test key write is local; peers can be checked independently and cleanup is local",()=>{
  const f=fixture();
  const a=f.call("write","left",arm);assert.equal(a.status,"verified");assert.equal(a.left,1);assert.equal(a.missing,1);
  f.focus(f.b.w);assert.equal(f.call("snapshot").local,"missing");
  assert.equal(f.call("write","right",arm).right,1);
  assert.equal(f.call("clear",arm).local,"missing");assert.equal(f.values.get(f.a.t),"left");
  assert.equal(f.writes.length,3);
});
test("unarmed, invalid or unknown value commands do not write or delete",()=>{
  const f=fixture();
  assert.equal(f.call("write","left").status,"rejected");
  assert.equal(f.call("write","future",arm).status,"rejected");
  assert.equal(f.call("clear").status,"rejected");
  f.values.set(f.a.t,"future");assert.equal(f.call("write","left",arm).status,"rejected");
  assert.equal(f.call("clear",arm).status,"rejected");assert.equal(f.writes.length,0);
});
test("private, unsynced, untracked, missing/ambiguous and special sources are refused",()=>{
  for(const fault of ["private","unsynced","untracked","not-ready","id","duplicate","role","closing","workspace"]){
    const f=fixture();
    if(fault==="private")f.a.w.private=true;
    if(fault==="unsynced")f.a.w.gZenWorkspaces.currentWindowIsSyncing=false;
    if(fault==="untracked")f.a.w.untracked=true;
    if(fault==="not-ready")f.a.w.gZenStartup.isReady=false;
    if(fault==="id")f.a.t.id="";
    if(fault==="duplicate")f.a.w.gZenWorkspaces.allStoredTabs.push({...f.a.t});
    if(fault==="role")f.a.attrs.set("zen-empty-tab","true");
    if(fault==="closing")f.a.t.closing=true;
    if(fault==="workspace")f.a.attrs.delete("zen-workspace-id");
    assert.equal(f.call("write","left",arm).status,"unavailable",fault);
    assert.equal(f.writes.length,0);assert.equal(f.traces.length,0);
  }
});
test("scope, absent peers, invalid values, and privacy are counted without leaking raw identifiers",()=>{
  const f=fixture();f.make("other-id");const p=f.make();p.w.private=true;
  const unknown=f.make();unknown.w.untracked=true;
  f.values.set(f.b.t,"secret-user-data");
  f.setPinnedOnly(true);const s=f.call("snapshot");
  assert.equal(s.scope,"local");assert.equal(s.absent,1);assert.equal(s.excluded,1);
  assert.equal(s.unavailable,1);assert.equal(s.other,1);
  f.setPinnedOnly(false);f.setEnabled(false);assert.equal(f.call("snapshot").scope,"local");
  const raw=JSON.stringify(f.traces);
  for(const secret of ["secret-user-data","same-native-id","workspace-id","other-id"])assert.ok(!raw.includes(secret));
});
test("reentrant selection changes stop writes and partial native exceptions remain unverified",()=>{
  const f=fixture();f.afterRead(()=>f.focus(f.b.w));
  assert.equal(f.call("write","left",arm).status,"rejected");assert.equal(f.writes.length,0);
  const g=fixture();g.afterWrite(()=>{throw Error("secret")});
  assert.equal(g.call("write","right",arm).status,"unverified");assert.equal(g.values.get(g.a.t),"right");
  assert.ok(!JSON.stringify(g.traces).includes("secret"));
});
