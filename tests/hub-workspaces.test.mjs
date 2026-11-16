import test from "node:test";
import assert from "node:assert/strict";
import {hubWorkspaceSnapshot,hubPanelWidth} from "../src/algorithms/hub-workspaces.mjs";
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
