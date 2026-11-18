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
 const registered=new Map();
 const node={addEventListener(type,callback){calls.push("add:"+type);registered.set(type,callback);if(type==="bad")throw Error("failed");},removeEventListener(type,callback,capture){assert.equal(callback,registered.get(type));assert.equal(capture,type==="first");calls.push("remove:"+type);}};
 assert.throws(()=>{s.listen(node,"first",fn,{capture:true,passive:true});s.listen(node,"bad",fn);},/failed/);
 assert.deepEqual(s.dispose(),{released:1,failed:0});assert.deepEqual(calls,["add:first","add:bad","remove:bad","remove:first"]);assert.throws(()=>s.listen(node,"late",fn),/closed/);
});
test("reentrant release and disposal do not run old callbacks twice",()=>{
 const s=createDisposableScope(),calls=[];const a=s.defer("a",()=>calls.push("a"));s.defer("b",()=>{calls.push("b");a();s.dispose();s.defer("late",()=>calls.push("late"));});
 assert.deepEqual(s.dispose(),{released:3,failed:0});assert.deepEqual(calls,["b","a","late"]);assert.equal(s.size,0);
});

test("failed release retains original outcome and listener callback becomes inert",()=>{
 const s=createDisposableScope(),events=[];let cb,registered;
 const node={addEventListener(type,fn){cb=fn;registered=fn;},removeEventListener(type,fn){assert.equal(fn,registered);throw Error("native");}};
 const off=s.listen(node,"event",function(event){assert.equal(this,node);events.push(event);});
 cb.call(node,"before");assert.equal(off(),false);assert.equal(off(),false);cb.call(node,"after");
 assert.deepEqual(events,["before"]);
});
test("nested release failures are counted in outer disposal",()=>{
 const s=createDisposableScope();const a=s.defer("a",()=>{throw Error("native");});
 s.defer("b",()=>{a();s.defer("late",()=>{throw Error("late");});});
 assert.deepEqual(s.dispose(),{released:1,failed:2});assert.equal(a(),false);
});
test("scope disposal inside listener acquisition removes late wrapper and blocks delivery",()=>{
 const s=createDisposableScope();let callback,removed=0,notified=0;
 const node={addEventListener(type,fn){callback=fn;s.dispose();fn({});},removeEventListener(type,fn){assert.equal(fn,callback);removed++;}};
 const off=s.listen(node,"event",()=>notified++);callback({});assert.equal(off(),true);assert.equal(removed,1);assert.equal(notified,0);
});
