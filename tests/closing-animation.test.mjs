import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../closing-animation.uc.mjs",import.meta.url),"utf8");
const start=source.indexOf("function makeCloseController("),end=source.indexOf("function visible(",start);
const factory=new Function("DURATION",source.slice(start,end)+"return makeCloseController;")(760);
function harness({eligible=true,begin=true,throws=false,cancel=false,nativeThrows=false}={}){
 let timer=null,events=[],receiver=null,args=null,closed=false;
 const gate=factory({eligible:()=>eligible,begin:()=>{events.push("begin");if(throws)throw Error("animation");return begin;},clear:()=>events.push("restore"),seal:()=>events.push("seal"),isClosed:()=>closed,later:(fn,ms)=>{assert.ok(ms===650||ms===110);timer=fn;return 1;},cancelLater:()=>{timer=null;},invoke:(r,a)=>{events.push("native");receiver=r;args=a;if(nativeThrows)throw Error("native");closed=!cancel;return "native-result";}});
 return {gate,events,fire:()=>{const fn=timer;timer=null;fn?.();},get receiver(){return receiver;},get args(){return args;}};
}
test("seals hidden chrome through one native close",()=>{const h=harness(),r={},a=[{}];h.gate.request(r,a);assert.deepEqual(h.events,["begin"]);h.fire();assert.deepEqual(h.events,["begin","seal"]);h.fire();assert.deepEqual(h.events,["begin","seal","native"]);assert.equal(h.receiver,r);assert.equal(h.args,a);});
test("ineligible command bypasses motion",()=>{const h=harness({eligible:false});assert.equal(h.gate.request({},[]),"native-result");assert.deepEqual(h.events,["native"]);});
test("second close skips remaining animation",()=>{const h=harness();h.gate.request({},[]);h.gate.request({},[]);h.fire();assert.deepEqual(h.events,["begin","seal","native"]);});
test("unload cancels without issuing another close",()=>{const h=harness();h.gate.request({},[]);h.gate.dispose();h.fire();assert.deepEqual(h.events,["begin","restore"]);});
test("failed or empty visual effect fails open",()=>{for(const options of [{begin:false},{throws:true}]){const h=harness(options);h.gate.request({},[]);assert.deepEqual(h.events,["begin","restore","native"]);}});
test("preference change completes pending native command",()=>{const h=harness();h.gate.request({},[]);h.gate.flush();h.fire();assert.deepEqual(h.events,["begin","seal","native"]);});

test("cancelled native close restores only after native returns",()=>{const h=harness({cancel:true});h.gate.request({},[]);h.fire();h.fire();assert.deepEqual(h.events,["begin","seal","native","restore"]);});
test("native error restores hidden chrome",()=>{const h=harness({nativeThrows:true});h.gate.request({},[]);h.fire();assert.throws(()=>h.fire(),/native/);assert.deepEqual(h.events,["begin","seal","native","restore"]);});

test("failed timer cancellation cannot swallow close or dispatch an old timer into a new request",()=>{
 let callbacks=[],calls=0,clears=0,seals=0;
 const gate=factory({eligible:()=>true,begin:()=>true,clear:()=>clears++,seal:()=>seals++,later:fn=>{callbacks.push(fn);return callbacks.length;},cancelLater(){throw Error("cancel timer");},invoke:()=>++calls});
 gate.request({},[]);const stale=callbacks[0];gate.dispose();gate.request({},[]);stale();
 assert.equal(calls,0);assert.equal(seals,0);assert.equal(clears,1);
 callbacks[1]();callbacks[2]();assert.equal(calls,1);assert.equal(seals,1);
});
test("failed terminal dwell timer still performs exactly one native close",()=>{
 let first,calls=0,seals=0,scheduled=0;
 const gate=factory({eligible:()=>true,begin:()=>true,clear(){},seal:()=>seals++,later:fn=>{if(scheduled++)throw Error("timer");first=fn;return 1;},cancelLater(){},invoke:()=>++calls});
 gate.request({},[]);first();first();assert.equal(calls,1);assert.equal(seals,1);
});
test("close restore releases remaining properties and markers after center failure",()=>{
 const code=source.slice(source.indexOf("  function restore(){"),source.indexOf("  function set("));
 const run=new Function(`
 const log=[],window={windowUtils:{USER_SHEET:1,removeSheet(){log.push("sheet");}},__nocturneTrace(e,d){if(e==="disassembly.cleanup")log.push(d.failed);}};
 const root={hasAttribute:()=>true,removeAttribute(){log.push("root");}};
 let centerHandle={release(){throw Error("center");}},bookmarkHandle={release(){log.push("bookmark");}},sheet={},style={remove(){log.push("style");}};
 const n={style:{removeProperty(k){if(k==="bad")throw Error("style");log.push(k);}},removeAttribute:k=>log.push(k)};
 const animations=new Set([{cancel(){throw Error("animation");}}]),owned=new Map([[n,{styles:new Map([["bad",{value:""}],["good",{value:""}]]),attrs:new Map([["mark",null]])}]]);
 ${code}restore();return {log,size:owned.size,animations:animations.size};`);
 assert.deepEqual(run(),{log:["bookmark","good","mark","sheet","style","root",3],size:0,animations:0});
});
