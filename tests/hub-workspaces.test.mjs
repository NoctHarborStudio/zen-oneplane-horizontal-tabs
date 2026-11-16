import test from "node:test";
import assert from "node:assert/strict";
import {hubWorkspaceSnapshot,hubPanelWidth,hubWorkspaceBrowserEligible,hubOtherDisplay,hubSnapRect} from "../src/algorithms/hub-workspaces.mjs";
test("native identities and current state; no mutation",()=>{
  const native=[{uuid:"a",name:"Study",icon:"📚"},{uuid:"b",name:"Free",icon:"chrome://x.svg"},{uuid:"a",name:"duplicate"}];
  const manager={activeWorkspace:"b",getWorkspaces:()=>native,changeWorkspaceWithID(){}};
  assert.deepEqual(hubWorkspaceSnapshot(manager),[{id:"a",name:"Study",icon:"📚",active:false},{id:"b",name:"Free",icon:"",active:true}]);assert.equal(native.length,3);
});
test("no invented Free; unavailable manager fails closed",()=>{
  assert.equal(hubWorkspaceSnapshot(null),null);assert.equal(hubWorkspaceSnapshot({workspaceEnabled:false}),null);
  assert.deepEqual(hubWorkspaceSnapshot({getWorkspaces:()=>[],changeWorkspaceWithID(){}}),[]);
  assert.equal(hubWorkspaceSnapshot({getWorkspaces(){throw Error("unavailable")},changeWorkspaceWithID(){}}),null);
});

test("hub follows navigation right edge and clamps to viewport",()=>{
  assert.equal(hubPanelWidth(5,255,1920),250);
  assert.equal(hubPanelWidth(5,100,1920),180);
  assert.equal(hubPanelWidth(850,1100,900),42);
});

test("workspace reuse is local; global visible Essentials remain available",()=>{
  const tab=(attrs,extra={})=>({getAttribute:k=>attrs[k]??null,hasAttribute:k=>k in attrs,...extra});
  assert.equal(hubWorkspaceBrowserEligible(tab({"zen-workspace-id":"work"}),"work"),true);
  assert.equal(hubWorkspaceBrowserEligible(tab({"zen-workspace-id":"free"}),"work"),false);
  assert.equal(hubWorkspaceBrowserEligible(tab({"zen-essential":"true"}),"work"),true);
  assert.equal(hubWorkspaceBrowserEligible(tab({"zen-essential":"true"},{hidden:true}),"work"),false);
  assert.equal(hubWorkspaceBrowserEligible(tab({"zen-workspace-id":"work","zen-empty-tab":"true"}),"work"),false);
});

test("projection requires a release inside a different monitor",()=>{
  const a={x:0,y:0,width:1920,height:1080},b={x:-1200,y:0,width:1200,height:1920};
  assert.equal(hubOtherDisplay(a,b,-500,500),true);
  assert.equal(hubOtherDisplay(a,a,500,500),false);
  assert.equal(hubOtherDisplay(a,b,-1201,500),false);
});

test("snap zones stay inside work area with negative coordinates",()=>{
  const d={x:-1920,y:40,width:1920,height:1040};
  assert.deepEqual(hubSnapRect(d,-960,45),{x:-1920,y:40,width:1920,height:1040,mode:"maximize"});
  assert.deepEqual(hubSnapRect(d,-1915,500),{x:-1920,y:40,width:960,height:1040,mode:"left"});
  assert.deepEqual(hubSnapRect(d,-5,1070),{x:-960,y:560,width:960,height:520,mode:"right-bottom"});
  const c=hubSnapRect(d,-960,600);assert.equal(c.mode,"center");assert.deepEqual(c,hubSnapRect(d,-800,650));assert.ok(c.x>=d.x&&c.x+c.width<=d.x+d.width&&c.y>=d.y&&c.y+c.height<=d.y+d.height);
});
