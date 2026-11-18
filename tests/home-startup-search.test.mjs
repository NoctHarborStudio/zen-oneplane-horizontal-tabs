import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=readFileSync(new URL("../src/home/oneplane-trigger.js.part",import.meta.url),"utf8");
const code=src.slice(src.indexOf("  async function onHomeStartup("),src.indexOf("  function stopHomeDoubleClick("));
function fixture(){
 let resolve;const wait=new Promise(r=>{resolve=r;});const calls=[];
 const browser={selectedTab:{id:1}},win={closed:false,removeEventListener(){},console:{warn(){}},__nocturneLayoutStartup:{homeState:"pending"}};
 const services={search:{isInitialized:false,init(){calls.push("init");return wait;}}};
 const run=new Function("root","window","browser","Services","homeLease",`
  let dead=false,disposed=false,reloadingLayout=false;
  const hoverSupported=()=>true;
  ${code}
  return onHomeStartup;
 `)({getAttribute:()=>"true"},win,browser,services,{showOnStartup(){calls.push("show");return true;}});
 return {calls,browser,win,resolve,run};
}
test("startup Home waits for Search Service before blurring the address editor",async()=>{
 const f=fixture(),pending=f.run();
 assert.deepEqual(f.calls,["init"]);f.resolve();await pending;assert.deepEqual(f.calls,["init","show"]);
});
test("startup Home does not interrupt a tab selected during search initialization",async()=>{
 const f=fixture(),pending=f.run();f.browser.selectedTab={id:2};f.resolve();await pending;assert.deepEqual(f.calls,["init"]);
});

test("late search initialization cannot auto-open Home after Assembly launch or finish",async()=>{
 for(const finished of [false,true]){
  const f=fixture();f.win.__zenRefinedStartupAnimationSeen=true;f.win.__zenRefinedStartupAnimation=()=>{};
  const pending=f.run();
  if(finished)delete f.win.__zenRefinedStartupAnimation;
  else f.win.__nocturneStartupTimeline={};
  f.resolve();await pending;
  assert.deepEqual(f.calls,["init"]);assert.equal(f.win.__nocturneLayoutStartup.homeState,"skipped");
 }
});
test("late Home initialization never writes readiness into a replacement Layout record",async()=>{
 const f=fixture(),pending=f.run();f.win.__nocturneLayoutStartup={homeState:"pending"};
 f.resolve();await pending;assert.deepEqual(f.calls,["init"]);assert.equal(f.win.__nocturneLayoutStartup.homeState,"pending");
});
