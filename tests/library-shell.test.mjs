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

test("Library Downloads bulk clear truthfully reports a skipped native entry",async()=>{
 const source=read("src/library/controller.js.part");
 const code=source.slice(source.indexOf("  async function clearDownloads("),source.indexOf("  function openNativeDownloads("));
 assert.ok(code.includes("result.failed||result.skipped"));
 const result={requested:2,removed:1,skipped:1,failed:0},notices=[],events=[];let retries=0;
 const win={__nocturneLibraryServices:{downloads:{clearCompleted:async()=>result}}},state={section:"downloads",phase:"open"};
 const action=new Function("win","state","notice","trace","syncTools","data",`
   let confirmation=true,clearing=false,actionSerial=0;
   const active=()=>true;
   ${code}
   return {clearDownloads};
 `)(win,state,message=>notices.push(message),(event,data)=>events.push({event,data}),()=>{},{retry(){retries++;}});
 await action.clearDownloads();
 assert.equal(notices.at(-1),"Some records were not cleared. Files were not deleted.");
 assert.deepEqual(events,[{event:"downloads.clear.result",data:result}]);assert.equal(retries,1);
});

test("Library Downloads clear treats a concurrent Dock clear as busy, not success",async()=>{
 const source=read("src/library/controller.js.part");
 const code=source.slice(source.indexOf("  async function clearDownloads("),source.indexOf("  function openNativeDownloads("));
 const events=[],notices=[];let retried=0;
 const win={__nocturneLibraryServices:{downloads:{clearCompleted:async predicate=>{
   assert.equal(typeof predicate,"function");return null;
 }}}},state={section:"downloads",phase:"open"};
 const run=new Function("win","state","notice","trace","syncTools","data",`
   let confirmation=true,clearing=false,actionSerial=0,dead=false;
   const active=()=>true;
   ${code}
   return {clearDownloads};
 `)(win,state,x=>notices.push(x),(e,d)=>events.push([e,d]),()=>{},{retry(){retried++;}});
 await run.clearDownloads();
 assert.deepEqual(notices,["Downloads are already being cleared."]);
 assert.deepEqual(events,[]);assert.equal(retried,1);
});

test("Library preserves local DOM row/scroll across capability refresh, but changes them on rename",()=>{
 const source=read("src/library/controller.js.part");
 const code=source.slice(source.indexOf("  function renderResults("),source.indexOf("  function renderBody("));
 const rowKey=source.slice(source.indexOf("  function rowKey("),source.indexOf("  function fileBytes("));
 let created=0,rows=new Map();
 const body={children:[],scrollTop:42,insertBefore(node,ref){
   const old=this.children.indexOf(node);if(old>=0)this.children.splice(old,1);
   const i=ref?this.children.indexOf(ref):-1;this.children.splice(i<0?this.children.length:i,0,node);
 }};
 const shell={body},state={section:"pictures",phase:"open",query:""};
 const doc={activeElement:{closest:()=>({dataset:{recordId:"local-view-1"}}),isConnected:true,focus(){}}};
 const createFileRow=()=>{created++;const node={dataset:{},remove(){const i=body.children.indexOf(node);if(i>=0)body.children.splice(i,1);}};return {node,record:null};};
 const updateFileRow=(entry,row)=>{entry.record=row;entry.node.dataset.recordId=row.viewKey;};
 const render=new Function("rows","shell","state","doc","createFileRow","updateFileRow",`
   const active=()=>true,fileSection=()=>true,syncTools=()=>{};
   let renderedSection="pictures",dragSource=null,pendingResult=null;
   ${rowKey}
   ${code}
   return renderResults;
 `)(rows,shell,state,doc,createFileRow,updateFileRow);
 render({rows:[{id:"local-1",viewKey:"local-view-1",kind:"local"}],hasMore:false});
 const node=body.children[0];render({rows:[{id:"local-2",viewKey:"local-view-1",kind:"local"}],hasMore:false});
 assert.equal(body.children[0],node);assert.equal(created,1);assert.equal(rows.get("local-view-1").record.id,"local-2");assert.equal(body.scrollTop,42);
 render({rows:[{id:"local-3",viewKey:"local-view-2",kind:"local"}],hasMore:false});
 assert.notEqual(body.children[0],node);assert.equal(created,2);assert.equal(rows.has("local-view-1"),false);
});

function historyHeadingFixture(){
 const source=read("src/library/controller.js.part");
 const start=source.indexOf("  function renderResults("),end=source.indexOf("  function renderBody(",start);
 const key=source.match(/^  function rowKey\([^\n]+\}/m)?.[0];
 assert.ok(start>=0&&end>start&&key,"production render and key contracts are present");
 const body={children:[],scrollTop:0,insertions:0,insertBefore(node,ref){
   const previous=this.children.indexOf(node);if(previous>=0)this.children.splice(previous,1);
   const pos=ref?this.children.indexOf(ref):-1;
   this.children.splice(pos<0?this.children.length:pos,0,node);node.parent=this;this.insertions++;
 },replaceChildren(...nodes){
   for(const child of this.children)child.parent=null;
   this.children=[...nodes];for(const child of nodes)child.parent=this;
 }};
 const make=(tag,cls="",text="")=>{
   const n={tag,className:cls,textContent:text,children:[],dataset:{},attributes:new Map(),parent:null,
     get classList(){return {contains:name=>this.className.split(" ").includes(name)};},
     getAttribute:name=>n.attributes.get(name)||null,
     removeAttribute:name=>n.attributes.delete(name),
     remove(){const index=this.parent?.children.indexOf(this);if(index>=0)this.parent.children.splice(index,1);this.parent=null;}};
   return n;
 };
 const rows=new Map(),state={section:"history",phase:"open",query:""};
 const doc={activeElement:null},shell={body,more:make("button","nl-more","Load more")};
 const createRow=()=>{
   const node=make("div","nl-history-row"),main=make("button"),icon=make("img"),
     title=make("span"),url=make("span"),time=make("time"),forget=make("button");
   const entry={node,main,icon,title,url,time,forget,record:null};
   node.querySelector=()=>main;
   return entry;
 };
 const script="const active=()=>true,fileSection=()=>false,syncTools=()=>{},updateFileRow=()=>{throw Error('file render unexpected');};\n"+
   "let renderedSection='history',dragSource=null,pendingResult=null;\n"+key+"\n"+source.slice(start,end)+"\nreturn renderResults;";
 const render=new Function("rows","shell","state","doc","make","createRow","placeholder","libraryWebURL",script)(
   rows,shell,state,doc,make,createRow,()=>body.replaceChildren(make("p","nl-placeholder")),()=>null);
 const headings=()=>body.children.filter(n=>n.className==="nl-day");
 const row=(id,time)=>({id,kind:"history",url:"https://example.test/"+id,title:id,time});
 return {body,doc,rows,state,render,headings,row};
}
test("History repeated native result reuses exact day headings and skips DOM reordering",()=>{
 const f=historyHeadingFixture(),now=new Date(2026,10,20,12).getTime(),day=86400000;
 const records=[f.row("a",now),f.row("b",now-3*day),f.row("c",now-3*day)];
 f.render({rows:records,hasMore:false,limit:50});
 const headings=f.headings(),firstNodes=[...f.body.children],firstCount=f.body.insertions;
 assert.equal(headings.length,2);
 f.body.scrollTop=91;let refocus=0;
 f.doc.activeElement={closest:()=>({dataset:{recordId:"a"}}),isConnected:true,focus(){refocus++;}};
 f.render({rows:records.map(r=>({...r,title:r.title+" changed"})),hasMore:false,limit:50});
 assert.deepEqual(f.body.children,firstNodes);
 assert.equal(f.body.insertions,firstCount,"unchanged History projection should not detach or insert nodes");
 assert.equal(f.headings()[0],headings[0]);assert.equal(f.headings()[1],headings[1]);
 assert.equal(f.rows.get("a").record.title,"a changed");
 assert.equal(refocus,0,"focus must remain on the original live control");
 assert.equal(f.body.scrollTop,91);
});
test("History repeated date runs remain separate across site ordering and reuse live headings",()=>{
 const f=historyHeadingFixture(),now=new Date(2026,10,20,12).getTime(),day=86400000;
 const a=f.row("a",now),b=f.row("b",now-day),c=f.row("c",now);
 f.render({rows:[a,b,c],hasMore:false,limit:50});
 const before=f.headings(),count=f.body.insertions;
 assert.equal(before.length,3);
 assert.notEqual(before[0],before[2],"same day in nonadjacent runs needs a distinct heading");
 assert.notEqual(before[0].dataset.dayKey,before[2].dataset.dayKey);
 f.render({rows:[a,b,c],hasMore:false,limit:50});
 assert.equal(f.body.insertions,count);
 assert.deepEqual(f.headings(),before);
 f.render({rows:[a,c],hasMore:false,limit:50});
 assert.equal(f.headings().length,1,"adjacent same-day records use one heading");
 assert.equal(f.headings()[0],before[0],"original run heading remains the authority");
 assert.equal(f.body.children.includes(before[1]),false);
 assert.equal(f.body.children.includes(before[2]),false);
});
test("History heading reconcile preserves row focus and scroll on page extension, then releases DOM on empty state",()=>{
 const f=historyHeadingFixture(),now=new Date(2026,10,20,12).getTime(),day=86400000;
 const a=f.row("a",now),b=f.row("b",now-day),c=f.row("c",now-2*day);
 f.render({rows:[a,b],hasMore:false,limit:50});
 const first=f.headings(),savedRow=f.rows.get("a").node;
 f.body.scrollTop=117;let refocus=0;
 f.doc.activeElement={closest:()=>({dataset:{recordId:"a"}}),isConnected:true,focus(){refocus++;}};
 f.render({rows:[a,b,c],hasMore:false,limit:100});
 assert.equal(f.rows.get("a").node,savedRow);
 assert.equal(f.headings()[0],first[0]);assert.equal(f.headings()[1],first[1]);
 assert.equal(f.headings().length,3);assert.equal(f.body.scrollTop,117);assert.equal(refocus,1);
 f.doc.activeElement=null;
 f.render({rows:[],hasMore:false,limit:50});
 assert.equal(f.headings().length,0);assert.equal(f.rows.size,0);
 f.render({rows:[a],hasMore:false,limit:50});
 assert.equal(f.headings().length,1);
 assert.notEqual(f.headings()[0],first[0],"new section/renderBody after empty does not revive stale headings");
});
