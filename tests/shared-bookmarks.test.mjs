import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const script=readFileSync(new URL("../bookmarks.uc.mjs",import.meta.url),"utf8");
const registrySource=script.slice(script.indexOf("function createSharedRegistry()"),script.indexOf("const lease={}"));
function setup(legacyFirst=false,onInstall=null){
  const queue=[],events=[];
  const win={closed:false,queueMicrotask:f=>queue.push(f)};
  const make=()=>{events.push("install");onInstall?.(win);return {destroy(){events.push("destroy");},syncAddressState(){events.push("sync");}};};
  if(legacyFirst)win.legacy=()=>{events.push("legacy-cleanup");delete win.legacy;};
  const registry=new Function("window","install","CONTROLLER","SHARED","REVISION",registrySource+"return createSharedRegistry();")(win,make,"legacy","shared",1);
  win.shared=registry;
  return {win,registry,events,queue};
}
test("one Magnetic Bookmarks controller survives either consumer unload order",()=>{
  for(const order of [[0,1],[1,0]])for(const legacyFirst of [false,true]){
    const {win,registry,events}=setup(legacyFirst),tokens=[{},{}];
    registry.acquire(tokens[0]);registry.acquire(tokens[1]);registry.syncAddressState();
    assert.equal(events.filter(e=>e==="install").length,1);
    assert.equal(events.filter(e=>e==="sync").length,1);
    registry.release(tokens[order[0]]);
    assert.equal(events.filter(e=>e==="destroy").length,0);
    registry.release(tokens[order[1]]);
    assert.equal(events.filter(e=>e==="destroy").length,1);
    assert.equal(win.shared,undefined);
  }
});
test("legacy late registration yields and reclaims without concurrent controllers",()=>{
  const {win,registry,events,queue}=setup(),token={};
  registry.acquire(token);win.legacy();
  assert.deepEqual(events,["install","destroy"]);
  win.legacy=()=>{events.push("legacy-cleanup");delete win.legacy;};
  queue.shift()();
  assert.deepEqual(events,["install","destroy","legacy-cleanup","install"]);
  registry.release(token);
  assert.equal(win.shared,undefined);
});

test("workspace outgoing phase suspends magnetic bookmarks before geometry lock",()=>{
 const source=readFileSync(new URL("../bookmarks.uc.mjs",import.meta.url),"utf8");
 const code=source.slice(source.indexOf("function syncAddressState(){"),source.indexOf("// Measure the native row"));
 const run=new Function(`let addressSuspended=false,addressPointer=null,lastPointer=null,settingsPending=false,phase=null,wave=false,clears=0,resumes=0;
 const root={hasAttribute:k=>k==="data-op-bookmark-wave"&&wave,getAttribute:()=>phase},list={hasAttribute:()=>false};
 function clear(){clears++;}function updateReserve(){resumes++;}function scheduleContour(){}
 ${code}
 const states=[];for(const p of ["out","swap","in",null]){phase=p;syncAddressState();states.push(addressSuspended);}
 return {states,clears,resumes};`);
 assert.deepEqual(run(),{states:[true,true,true,false],clears:1,resumes:1});
});

test("bookmark suspension is shared across startup, closing, center and bookmark fold",()=>{
 const code=script.slice(script.indexOf("function syncAddressState(){"),script.indexOf("// Measure the native row"));
 const run=new Function(`let addressSuspended=false,addressPointer=null,lastPointer=null,settingsPending=false,clears=0,resumes=0;
 const markers=new Set(),root={hasAttribute:k=>markers.has(k),getAttribute:()=>null},list={hasAttribute:k=>markers.has(k)};
 function clear(){clears++;}function updateReserve(){resumes++;}function scheduleContour(){}
 ${code}
 const states=[];for(const k of ["data-zr-startup-phase","data-zr-closing","data-zr-center-motion","data-zr-fold-bookmarks"]){markers.add(k);syncAddressState();states.push(addressSuspended);}
 for(const k of [...markers]){markers.delete(k);syncAddressState();states.push(addressSuspended);}
 return {states,clears,resumes};`);
 assert.deepEqual(run(),{states:[true,true,true,true,true,true,true,false],clears:1,resumes:1});
});

test("preference updates are coalesced until the last exclusive bookmark phase ends",()=>{
 const code=script.slice(script.indexOf("function syncAddressState(){"),script.indexOf("// Measure the native row"));
 const run=new Function(`let addressSuspended=false,addressPointer=null,lastPointer=null,settingsPending=false,clears=0,reads=0,reserves=0;
 const markers=new Set(),root={hasAttribute:k=>markers.has(k),getAttribute:()=>null},list={hasAttribute:k=>markers.has(k)};
 function clear(){clears++;}function updateReserve(){reserves++;}function scheduleContour(){}function readSettings(){reads++;updateReserve();}
 ${code}
 markers.add("data-zr-startup-phase");refreshSettings();refreshSettings();
 const during={reads,reserves};markers.add("data-zr-fold-bookmarks");markers.delete("data-zr-startup-phase");syncAddressState();refreshSettings();
 const overlap={reads,reserves};markers.clear();syncAddressState();syncAddressState();
 const after={reads,reserves};refreshSettings();return {during,overlap,after,idle:{reads,reserves},clears};`);
 assert.deepEqual(run(),{during:{reads:0,reserves:0},overlap:{reads:0,reserves:0},after:{reads:1,reserves:1},idle:{reads:2,reserves:2},clears:1});
});

test("release of final lease during installation retires the unreturned controller",()=>{
 const token={};const {win,registry,events}=setup(false,w=>w.shared.release(token));
 registry.acquire(token);
 assert.deepEqual(events,["install","destroy"]);assert.equal(win.shared,undefined);assert.equal(win.legacy,undefined);
});
test("stale registry cannot acquire, notify or delete a successor",()=>{
 const {win,registry,events}=setup(),token={};registry.acquire(token);registry.release(token);
 const successor={};win.shared=successor;registry.acquire({});registry.release(token);
 assert.equal(win.shared,successor);assert.deepEqual(events,["install","destroy"]);
});
test("Nocturne registry revision upgrade releases old leases before acquiring new owner",()=>{
 const token={},events=[],win={closed:false};
 const old={revision:1,clients:new Set([token]),release(t){events.push("old-release");this.clients.delete(t);delete win.shared;}};
 win.shared=old;
 const get=new Function("window","install","CONTROLLER","SHARED","REVISION",registrySource+"return currentBookmarkRegistry;")
  (win,()=>{events.push("install");return {destroy(){events.push("destroy");}}},"legacy","shared",2);
 const registry=get();assert.equal(registry.revision,2);assert.deepEqual(events,["old-release"]);
 registry.acquire({});assert.deepEqual(events,["old-release","install"]);assert.equal(win.shared,registry);
 old.release=()=>{};old.release(token);assert.equal(win.shared,registry);
});
