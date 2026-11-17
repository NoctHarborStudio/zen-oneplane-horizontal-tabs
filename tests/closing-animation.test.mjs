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
