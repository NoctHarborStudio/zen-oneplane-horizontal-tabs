import test from "node:test";
import assert from "node:assert/strict";
import {libraryClientRect,libraryDuration} from "../src/library/geometry.mjs";
test("Library geometry clips to browser client, not monitor, and declines unusable space",()=>{
 assert.deepEqual(libraryClientRect({left:80,top:90,right:1200,bottom:800},1000,700),{left:80,top:90,width:920,height:610});
 assert.deepEqual(libraryClientRect({left:-20,top:-5,right:360,bottom:640},360,640),{left:0,top:0,width:360,height:640});
 assert.equal(libraryClientRect({left:0,top:0,right:200,bottom:600},360,640),null);
 assert.equal(libraryClientRect(null,360,640),null);
});
test("Library motion honors reduced motion and disabled animations",()=>{
 assert.equal(libraryDuration(true,true,300),0);assert.equal(libraryDuration(false,false,300),0);assert.equal(libraryDuration(false,true,300),300);
});
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Library L3 is opt-in, built independently, and guards experimental native command routing",()=>{
 const source=read("src/library/controller.js.part"),plan=JSON.parse(read("scripts/build-plan.json"));
 assert.deepEqual(plan.library.map(x=>x.path),["src/algorithms/library-state.mjs","src/library/geometry.mjs","src/services/media-service.mjs","src/library/data.mjs","src/library/controller.js.part"]);
 assert.match(source,/getBoolPref\(PREF,false\)/);
 assert.match(source,/overlay\.request\(OWNER\)/);
 assert.match(source,/state\.motionEpoch===epoch/);
 assert.doesNotMatch(source,/ZenLibrary\.toggle|Downloads\.getList/);
 assert.match(source,/getBoolPref\(SHORTCUT,false\)/);
 assert.match(source,/getBoolPref\(DOWNLOADS_SHORTCUT,false\)/);
 const pref=JSON.parse(read("preferences.json")).find(x=>x.property==="zen.nocturne.library.preview");assert.equal(pref.defaultValue,false);
});

test("shortcut routing only consumes the event on a successful open and reports refusal",()=>{
 const source=read("src/library/controller.js.part");
 const code=source.slice(source.indexOf("  function route("),source.indexOf("  function onServicesGone("));
 const calls=[];let allowed=true,opened=true,ready=true;
 const win={__nocturneLibraryServices:{historyReady:()=>ready}},prefs={getBoolPref:()=>allowed};
 const run=new Function("win","prefs","enabled","privateWindow","toggle","trace",`const SHORTCUT="history",DOWNLOADS_SHORTCUT="downloads";let nativeFallback=false,lastFailure=null;${code}return route;`)(win,prefs,()=>allowed,()=>false,()=>opened,(e,d)=>calls.push(d));
 let consumed=0;const event={preventDefault(){consumed++;},stopImmediatePropagation(){consumed++;}};
 assert.equal(run(event,"history","keydown"),true);assert.equal(consumed,2);
 opened=false;assert.equal(run(event,"history","command"),false);assert.equal(consumed,2);
 ready=false;assert.equal(run(event,"history","keydown"),false);assert.equal(calls.at(-1).reason,"history-unready");
 allowed=false;assert.equal(run(event,"history","keydown"),false);assert.equal(calls.at(-1).reason,"disabled");
 assert.match(source,/function showLayer\(/);assert.match(source,/layer.removeAttribute\("popover"\)/);
});

test("History range clear serializes duplicate and row removal while native promise is pending",async()=>{
 const source=read("src/library/controller.js.part");
 const code=source.slice(source.indexOf("  async function clearRecentHistory("),source.indexOf("  function fileBytes("));
 assert.ok(code.includes("const token=++actionSerial;clearing=true;"));
 assert.ok(source.includes("shell.clearHistory.disabled=clearing;"));
 let resolve,commands=[],confirmations=0,refreshes=0,enabled=null;
 const pending=new Promise(r=>resolve=r);
 const row={id:"history-id",kind:"history",url:"https://example.test/"},entry={record:row};
 const service={clearHistoryRange:hours=>{commands.push(["range",hours]);return pending;},
   removeHistoryURL:url=>{commands.push(["row",url]);return pending;},copyHistoryURL:()=>true};
 const win={__nocturneLibraryServices:service,confirm(){confirmations++;return true;}};
 const state={section:"history",phase:"open",motionEpoch:1},rows=new Map([[row.id,entry]]);
 const fixture=new Function("win","state","rows","data","notice","syncTools",`
   let clearing=false,actionSerial=0,renderedSection="history";
   const active=()=>state.phase!=="closed",current=e=>state.motionEpoch===e;
   ${code}
   return {clearRecentHistory,historyAction,busy:()=>clearing};
 `)(win,state,rows,{retry(){refreshes++;}},()=>{},()=>{enabled=!fixture.busy();});
 const first=fixture.clearRecentHistory(24);
 assert.equal(fixture.busy(),true);assert.equal(enabled,false);
 const duplicate=fixture.clearRecentHistory(24);
 const rowRemoval=fixture.historyAction(entry,"forget");
 await Promise.all([duplicate,rowRemoval]);
 assert.deepEqual(commands,[["range",24]]);
 assert.equal(confirmations,1);
 resolve(true);await first;
 assert.equal(fixture.busy(),false);assert.equal(enabled,true);assert.equal(refreshes,1);
 await fixture.clearRecentHistory(1);
 assert.deepEqual(commands,[["range",24],["range",1]]);
});
test("History row deletion blocks overlapping range clear, then releases gate on native failure",async()=>{
 const source=read("src/library/controller.js.part");
 const code=source.slice(source.indexOf("  async function clearRecentHistory("),source.indexOf("  function fileBytes("));
 let reject,commands=[],confirmations=0,refreshes=0,notices=[],copied=0,tools=0;
 const pending=new Promise((_,fail)=>reject=fail),row={id:"row",kind:"history",url:"https://example.test/"},entry={record:row};
 const win={confirm(){confirmations++;return true;},__nocturneLibraryServices:{
   removeHistoryURL:url=>{commands.push(["row",url]);return pending;},
   clearHistoryRange:hours=>{commands.push(["range",hours]);return Promise.resolve(true);},
   copyHistoryURL:()=>{copied++;return true;}
 }};
 const state={section:"history",motionEpoch:1,phase:"open"},rows=new Map([[row.id,entry]]);
 const fixture=new Function("win","state","rows","data","notice","syncTools",`
   let clearing=false,actionSerial=0,renderedSection="history";
   const active=()=>state.phase!=="closed",current=e=>state.motionEpoch===e;
   ${code}
   return {clearRecentHistory,historyAction,busy:()=>clearing};
 `)(win,state,rows,{retry(){refreshes++;}},message=>notices.push(message),()=>tools++);
 const deleting=fixture.historyAction(entry,"forget");
 assert.equal(fixture.busy(),true);
 await fixture.clearRecentHistory(168);await fixture.historyAction(entry,"forget");
 await fixture.historyAction(entry,"copy");
 assert.deepEqual(commands,[["row",row.url]]);assert.equal(confirmations,1);assert.equal(copied,1);
 reject(Error("native operation failed"));await deleting;
 assert.equal(fixture.busy(),false);assert.equal(refreshes,0);assert.ok(notices.includes("History action unavailable."));
 await fixture.clearRecentHistory(1);assert.deepEqual(commands[1],["range",1]);assert.equal(fixture.busy(),false);
 assert.ok(tools>=4);
});
