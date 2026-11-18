import test from "node:test";
import assert from "node:assert/strict";
import {createDisposableScope} from "../src/core/disposable-scope.mjs";
test("scope disposes in reverse order with isolated failures and idempotence",()=>{
 const calls=[],errors=[],s=createDisposableScope({onError:(label)=>{errors.push(label);throw Error("logger");}});
 const a=s.defer("a",()=>calls.push("a"));s.defer("b",()=>{calls.push("b");throw Error("native");});s.defer("c",()=>calls.push("c"));
 assert.deepEqual(s.dispose(),{released:2,failed:1});assert.deepEqual(calls,["c","b","a"]);assert.deepEqual(errors,["b"]);
 assert.equal(a(),true);assert.deepEqual(s.dispose(),{released:0,failed:0});assert.equal(s.size,0);
});
test("early manual release and late acquisition never release twice",()=>{
 const s=createDisposableScope(),calls=[];const off=s.defer("a",()=>calls.push("a"));
 off();off();s.dispose();const late=s.defer("late",()=>calls.push("late"));late();
 assert.deepEqual(calls,["a","late"]);assert.equal(s.closed,true);
});
test("listener acquisition preserves exact node and capture flag; partial mount rolls back",()=>{
 const s=createDisposableScope(),calls=[],fn=()=>{};
 const node={addEventListener(type){calls.push("add:"+type);if(type==="bad")throw Error("failed");},removeEventListener(type,callback,capture){assert.equal(callback,fn);assert.equal(capture,true);calls.push("remove:"+type);}};
 assert.throws(()=>{s.listen(node,"first",fn,{capture:true,passive:true});s.listen(node,"bad",fn);},/failed/);
 assert.deepEqual(s.dispose(),{released:1,failed:0});assert.deepEqual(calls,["add:first","add:bad","remove:first"]);assert.throws(()=>s.listen(node,"late",fn),/closed/);
});
test("reentrant release and disposal do not run old callbacks twice",()=>{
 const s=createDisposableScope(),calls=[];const a=s.defer("a",()=>calls.push("a"));s.defer("b",()=>{calls.push("b");a();s.dispose();s.defer("late",()=>calls.push("late"));});
 s.dispose();assert.deepEqual(calls,["b","a","late"]);assert.equal(s.size,0);
});
