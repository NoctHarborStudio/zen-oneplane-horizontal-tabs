import test from "node:test";
import assert from "node:assert/strict";
import {createOverlayCoordinator} from "../src/core/overlay-coordinator.mjs";
function fixture(){
 const calls=[],active=new Set(),blocked=new Set();
 const c=createOverlayCoordinator();
 function add(id,priority){
   return c.register(id,{priority,isActive:()=>active.has(id),canYield:()=>!blocked.has(id),
     yield:()=>{calls.push(id);active.delete(id);return true;},onEscape:()=>{calls.push("escape:"+id);return true;}});
 }
 add("downloads",10);add("hub",20);add("library",40);
 return {c,calls,active,blocked,add};
}
test("passive download flight never displaces an active Hub",()=>{
 const f=fixture();f.active.add("hub");assert.equal(f.c.request("downloads",{passive:true}),false);assert.deepEqual(f.calls,[]);
});
test("explicit handoff dismisses only conflicting owners",()=>{
 const f=fixture();f.active.add("downloads");assert.equal(f.c.request("hub"),true);assert.deepEqual(f.calls,["downloads"]);f.active.add("hub");assert.equal(f.c.current(),"hub");assert.equal(f.c.request("hub"),true);
});
test("blocked drag prevents all handoff side effects",()=>{
 const f=fixture();f.active.add("hub");f.active.add("downloads");f.blocked.add("downloads");
 assert.equal(f.c.request("library"),false);assert.deepEqual(f.calls,[]);
});
test("non-yielding native search defers another overlay",()=>{
 const f=fixture();f.c.register("home-search",{priority:30,isActive:()=>true,canYield:()=>false});
 assert.equal(f.c.request("library"),false);assert.equal(f.c.allowsEscape("home-search",{}),true);assert.equal(f.c.allowsEscape("hub",{}),false);
});
test("stale release cannot unregister a replacement",()=>{
 const f=fixture(),release=f.add("hub",20);f.add("hub",20);release();f.active.add("hub");assert.equal(f.c.current(),"hub");f.c.dispose();assert.equal(f.c.current(),null);assert.equal(f.c.request("hub"),false);
});
test("Escape belongs to top owner, native popup takes precedence",()=>{
 const f=fixture();f.active.add("downloads");f.active.add("hub");
 let stopped=0;const e={key:"Escape",preventDefault(){stopped++},stopImmediatePropagation(){stopped++}};
 assert.equal(f.c.dispatchEscape(e),true);assert.deepEqual(f.calls,["escape:hub"]);assert.equal(stopped,2);
 const c=createOverlayCoordinator({nativeEscape:()=>true});c.register("hub",{isActive:()=>true,onEscape:()=>{throw Error("not native owner")}});
 assert.equal(c.dispatchEscape(e),false);assert.equal(c.allowsEscape("hub",e),false);
});
test("a failed or reentrant yield does not authorize a new panel",()=>{
 const c=createOverlayCoordinator();let inner;
 c.register("a",{isActive:()=>true,yield(){inner=c.request("b");return true;}});
 c.register("b",{isActive:()=>false});assert.equal(c.request("b"),false);assert.equal(inner,false);
});
