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

test("native close reentry during clear does not invoke native twice",()=>{
 let calls=0,gate,once=false;
 gate=factory({eligible:()=>true,begin:()=>false,clear(){if(!once){once=true;gate.request({},[]);}},later(){return 1;},cancelLater(){},invoke(){calls++;}});
 gate.request({},[]);assert.equal(calls,1);
});
test("close reentry during begin waits until acquisition finishes",()=>{
 let gate,calls=0,clears=0;const events=[];
 gate=factory({eligible:()=>true,begin(){events.push("begin");gate.request({},[]);events.push("acquired");return true;},clear(){clears++;},seal(){events.push("seal");},later(){throw Error("unexpected timer");},cancelLater(){},invoke(){calls++;events.push("native");}});
 gate.request({},[]);assert.equal(calls,1);assert.equal(clears,1);assert.deepEqual(events,["begin","acquired","seal","native"]);
});
test("disposal during begin takes precedence over nested close intent",()=>{
 let gate,calls=0,clears=0;
 gate=factory({eligible:()=>true,begin(){gate.request({},[]);gate.dispose();gate.flush();return true;},clear(){clears++;},later(){throw Error("unexpected timer");},cancelLater(){},invoke(){calls++;}});
 gate.request({},[]);assert.equal(calls,0);assert.equal(clears,1);
});
test("close reentry during seal does not seal twice or schedule another dwell",()=>{
 let gate,timer,calls=0,seals=0,scheduled=0;
 gate=factory({eligible:()=>true,begin:()=>true,clear(){},seal(){seals++;gate.request({},[]);},later(fn){scheduled++;timer=fn;return scheduled;},cancelLater(){},invoke(){calls++;}});
 gate.request({},[]);timer();assert.equal(calls,1);assert.equal(seals,1);assert.equal(scheduled,1);
});

function closeAcquisitionFixture({tabs=true,bookmarks=true,missingEngine=false,missingBookmarks=false,failTab=false,failBookmark=false,failControl=false,replaceEngine=false}={}){
 const effects=[],events=[],timers=[],reasons=[];
 function node(name,children=[]){
  const attrs=new Map(),props=new Map();
  return {name,children,isConnected:true,hidden:false,collapsed:false,
   style:{getPropertyValue:k=>props.get(k)?.value||"",getPropertyPriority:k=>props.get(k)?.priority||"",setProperty(k,v,p=""){props.set(k,{value:v,priority:p});},removeProperty:k=>props.delete(k)},
   hasAttribute:k=>attrs.has(k),getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),
   getBoundingClientRect:()=>({left:20,top:10,right:220,bottom:50,width:200,height:40}),
   contains(n){return this===n||children.some(c=>c.contains(n));},querySelector(){return null;},querySelectorAll(){return [];},
   animate(){if(failControl&&name==="island")throw Error("control");const a={name,cancelled:0,finished:Promise.resolve(),cancel(){this.cancelled++;},finish(){}};effects.push(a);return a;}
  };
 }
 const card=node("card"),plus=node("plus"),island=node("island"),row=node("row",[card,plus,island]);
 row.querySelector=k=>({".oneplane-title-island":island,".oneplane-new-tab":plus}[k]||null);
 row.querySelectorAll=()=>tabs?[card]:[];
 const bm=node("bookmark"),items=node("items",bookmarks?[bm]:[]),root=node("root"),url=node("url"),sidebar=node("sidebar");
 const get=id=>({"oneplane-tabs":tabs?row:null,"PlacesToolbarItems":items,"urlbar-container":url,"zen-tabs-wrapper":sidebar}[id]||null);
 let closed=false;
 const win={innerWidth:1000,innerHeight:700,CSS:{registerProperty(){throw Error("unsupported");}},
  getComputedStyle:()=>({display:"block",visibility:"visible",opacity:"1",translate:"none"}),
  __nocturneTrace(event,data){if(event==="disassembly.bypass")reasons.push(data.reason);}
 };
 const handle=name=>({count:1,release(){events.push("release-"+name);},seal(){events.push("seal-"+name);}});
 if(!missingEngine){
  const engine={start(){events.push("tabs");return failTab?null:handle("tabs");}};
  if(!missingBookmarks)engine.bookmarks=()=>{events.push("bookmarks");if(replaceEngine)win.__nocturneCenterMotion={};return failBookmark?null:handle("bookmarks");};
  win.__nocturneCenterMotion=engine;
 }
 const code=source.slice(source.indexOf("  function visible("),source.indexOf("  function eligible("));
 const setup=new Function("window","root","get","factory","events","timers","closedState",`
  const MARK="data-zr-close-effect",MOVE="data-zr-close-move",CLIP="data-zr-close-clip",PROGRESS="--zr-close-progress",DURATION=760;
  let centerHandle=null,bookmarkHandle=null,sheet=null,style=null;
  const animations=new Set(),owned=new Map();
  ${code}
  const controller=factory({eligible:()=>true,begin,clear:restore,seal(){centerHandle?.seal();bookmarkHandle?.seal();for(const a of animations)a.finish();},isClosed:()=>closedState.value,later(fn){timers.push(fn);return timers.length;},cancelLater(){},invoke(){events.push("native");closedState.value=true;return "closed";}});
  return controller;
 `);
 const state={value:closed},gate=setup(win,root,get,factory,events,timers,state);
 return {gate,root,effects,events,timers,reasons};
}
test("visible horizontal tabs with missing or failed proxy acquisition bypass close motion",()=>{
 for(const options of [{missingEngine:true},{failTab:true}]){
  const h=closeAcquisitionFixture(options);assert.equal(h.gate.request({},[]),"closed");
  assert.equal(h.events.filter(x=>x==="native").length,1);assert.equal(h.timers.length,0);
  assert.equal(h.effects.length,0);assert.equal(h.root.hasAttribute("data-zr-closing"),false);
  assert.equal(h.reasons.length,1);
 }
});
test("failed bookmark fold releases acquired tab proxy before native close",()=>{
 const h=closeAcquisitionFixture({failBookmark:true});h.gate.request({},[]);
 assert.deepEqual(h.events,["tabs","bookmarks","release-tabs","native"]);
 assert.equal(h.effects.length,0);assert.equal(h.timers.length,0);assert.equal(h.root.hasAttribute("data-zr-closing"),false);
 assert.deepEqual(h.reasons,["bookmark-acquisition-failed"]);
});
test("partial control effect or replaced engine rolls back before native close",()=>{
 for(const options of [{failControl:true},{replaceEngine:true}]){
  const h=closeAcquisitionFixture(options);h.gate.request({},[]);
  assert.deepEqual(h.events,["tabs","bookmarks","release-tabs","release-bookmarks","native"]);
  assert.ok(h.effects.every(a=>a.cancelled===1));assert.equal(h.root.hasAttribute("data-zr-closing"),false);assert.equal(h.timers.length,0);
 }
});
test("successful acquisition keeps existing close dwell and native sidebar bookmark fallback",()=>{
 const h=closeAcquisitionFixture();h.gate.request({},[]);
 assert.deepEqual(h.events,["tabs","bookmarks"]);assert.equal(h.timers.length,1);h.timers[0]();h.timers[1]();
 assert.deepEqual(h.events,["tabs","bookmarks","seal-tabs","seal-bookmarks","native"]);
 const fallback=closeAcquisitionFixture({tabs:false,missingEngine:true});fallback.gate.request({},[]);
 assert.ok(fallback.effects.some(a=>a.name==="bookmark"));assert.equal(fallback.timers.length,1);
 fallback.timers[0]();fallback.timers[1]();assert.deepEqual(fallback.events,["native"]);
 const empty=closeAcquisitionFixture({bookmarks:false,failBookmark:true});empty.gate.request({},[]);assert.equal(empty.timers.length,1);
});
