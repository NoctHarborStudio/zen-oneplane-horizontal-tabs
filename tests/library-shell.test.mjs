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

test("shortcut routing consumes rejected requests during Nocturne cutover and preserves native opt-out",()=>{
 const source=read("src/library/controller.js.part");
 const code=source.slice(source.indexOf("  function route("),source.indexOf("  function onServicesGone("));
 const calls=[];let allowed=true,opened=true,ready=true,nativeEnabled=true;
 const win={__nocturneLibraryServices:{historyReady:()=>ready}},prefs={getBoolPref:k=>k==="zen.library.enabled"?nativeEnabled:allowed};
 const run=new Function("win","prefs","enabled","privateWindow","toggle","trace",`const SHORTCUT="history",DOWNLOADS_SHORTCUT="downloads";let nativeFallback=false,lastFailure=null;${code}return route;`)(win,prefs,()=>allowed,()=>false,()=>opened,(e,d)=>calls.push(d));
 let consumed=0;const event={preventDefault(){consumed++;},stopImmediatePropagation(){consumed++;}};
 assert.equal(run(event,"history","keydown"),true);assert.equal(consumed,2);
 opened=false;assert.equal(run(event,"history","command"),true);assert.equal(consumed,4);
 ready=false;assert.equal(run(event,"history","keydown"),true);assert.equal(calls.at(-1).reason,"history-unready");
 allowed=false;assert.equal(run(event,"history","keydown"),false);assert.equal(calls.at(-1).reason,"disabled");
 nativeEnabled=false;assert.equal(run(event,"history","keydown"),true);assert.equal(calls.at(-1).reason,"disabled");
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
 const code=source.slice(source.indexOf("  async function clearDownloads("),source.indexOf("  async function changeFolders("));
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
 const code=source.slice(source.indexOf("  async function clearDownloads("),source.indexOf("  async function changeFolders("));
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


test("Library appearance and dismissal preserve text scale and use the CSS terminal pose",()=>{
 const source=readFileSync(new URL("../src/library/controller.js.part",import.meta.url),"utf8");
 const css=readFileSync(new URL("../src/styles/library.css.part",import.meta.url),"utf8");
 assert.equal(source.split('opacity:0,transform:"translateY(8px)"').length-1,2);
 assert.ok(source.includes('play(shell.panel,[panel,{opacity:1,transform:"translateY(0px)"}]'));
 assert.doesNotMatch(source,/translateY\(8px\) scale\(/);
 assert.match(css,/transform:translateY\(0px\);opacity:1;/);
});
test("Library terminal motion probe respects epoch and opt-out and samples both sides of cancel",()=>{
 const source=readFileSync(new URL("../src/library/controller.js.part",import.meta.url),"utf8");
 const start=source.indexOf("  function settle(epoch)"),end=source.indexOf("  function hide(",start);
 assert.ok(start>=0&&end>start);
 const run=(enabled,phase,epoch)=>{
   const events=[],calls=[],shell={panel:{}};
   const f=new Function("prefs","shell","sample","cancelMotion","reduceLibrary","trace","calls",`let state={phase:${JSON.stringify(phase)},section:"history",motionEpoch:2}; const current=e=>e===state.motionEpoch;${source.slice(start,end)}return settle;`)(
     {getBoolPref:()=>enabled},shell,()=>{calls.push("sample");return {opacity:"1",transform:"matrix(1, 0, 0, 1, 0, 0)"};},
     ()=>calls.push("cancel"),s=>({...s,phase:"open"}),(name,data)=>events.push({name,data}),calls);
   f(epoch);return {calls,events};
 };
 assert.deepEqual(run(true,"opening",1).calls,[]);
 assert.deepEqual(run(false,"opening",2).calls,["cancel"]);
 assert.deepEqual(run(true,"switching",2).calls,["cancel"]);
 const result=run(true,"opening",2);
 assert.deepEqual(result.calls,["sample","cancel","sample"]);
 assert.deepEqual(result.events,[{name:"motion.settled",data:{section:"history",opacityStable:true,transformStable:true,beforeOpacity:1,afterOpacity:1}}]);
});


test("Library uses stationary glass and an independent filter drawer with reserved scroll padding",()=>{
 const source=read("src/library/controller.js.part"),css=read("src/styles/library.css.part");
 assert.match(source,/layer\.append\(shade,glass,panel\)/);
 assert.match(source,/play\(shell\.glass,\[glass,\{opacity:1\}\]/);
 assert.match(source,/duration\(reopening\?360:480\)/);
 assert.match(source,/duration\(360\)\),play\(shell\.glass/);
 assert.match(source,/historyDrawer\.inert=!open/);
 assert.match(source,/setHistoryDrawer\(false,true\)/);
 assert.match(source,/periodButtons,"FILTER"/);
 assert.match(source,/orderButtons,"SORT"/);
 assert.doesNotMatch(source,/button\("Native (?:history|downloads)"/);
 assert.match(css,/scrollbar-gutter:stable;padding-inline-end:14px/);
 assert.match(css,/\.nl-glass\{[^}]*backdrop-filter:blur\(30px\)/s);
 assert.doesNotMatch(css,/\.nl-panel\{[^}]*backdrop-filter:/s);
 assert.match(css,/\.nl-history-filter\[data-open\]/);
});


test("Library motion probe is bounded, opt-out-aware and releases scheduled frames",()=>{
 const source=read("src/library/controller.js.part");
 const begin=source.indexOf("  function startMotionProbe("),end=source.indexOf("  function play(",begin);
 const frames=new Map(),events=[];let id=0,t=0,enabled=true;
 const win={performance:{now:()=>t},requestAnimationFrame(fn){frames.set(++id,fn);return id;},cancelAnimationFrame(key){frames.delete(key);}};
 const run=new Function("win","prefs","trace",`let motionProbe=null,dead=false,animations=[],state={section:"history",phase:"opening",motionEpoch:3};${source.slice(begin,end)}return {startMotionProbe,cancelMotion};`)(win,{getBoolPref:()=>enabled},(name,detail)=>events.push({name,detail}));
 run.startMotionProbe(480);
 for(const time of [16,24,32,64,72]){t=time;const [key,fn]=frames.entries().next().value;frames.delete(key);fn(t);}
 run.cancelMotion(true);assert.equal(frames.size,0);
 assert.equal(events[0].name,"motion.frames");assert.equal(events[0].detail.frames,4);
 assert.equal(events[0].detail.p50,8);assert.equal(events[0].detail.max,32);assert.equal(events[0].detail.over25,1);
 enabled=false;run.startMotionProbe(480);assert.equal(frames.size,0);
 enabled=true;run.startMotionProbe(0);assert.equal(frames.size,0);
 run.startMotionProbe(480);run.cancelMotion();assert.equal(frames.size,0);assert.equal(events[1].detail.completed,false);
});

test("Library captured descendant unload cannot dispose its live window owner",()=>{
 const source=read("src/library/controller.js.part");
 const doc={documentElement:{hasAttribute:()=>false}},events=new Map(),unloads=[],traces=[],observers=new Map();
 let releases=0,disposals=0;
 const prefs={getBoolPref:()=>true,addObserver:(k,fn)=>observers.set(k,fn),removeObserver:(k,fn)=>{assert.equal(observers.get(k),fn);observers.delete(k);}};
 const win={document:doc,gBrowserInit:{delayedStartupFinished:true},
   __nocturneTrace:(event,data)=>traces.push({event,data}),
   __nocturneOverlay:{register:()=>()=>{releases++;}},__nocturneLibraryServices:{},
   addEventListener:(name,fn,capture)=>events.set(name,{fn,capture}),
   removeEventListener:(name,fn,capture)=>{if(events.get(name)?.fn===fn&&events.get(name)?.capture===capture)events.delete(name);},
   addUnloadListener:fn=>unloads.push(fn)};
 const run=new Function("window","Services","createLibraryState","createLibraryData","ChromeUtils",source);
 const mount=()=>run(win,{prefs},()=>({phase:"closed",section:"history",motionEpoch:0}),()=>({dispose(){disposals++;}}),{importESModule:()=>({PrivateBrowsingUtils:{isWindowPrivate:()=>false}})});
 mount();const first=win.__nocturneLibrary,unload=events.get("unload").fn;
 assert.equal(events.get("unload").capture,true);
 const child={};unload({target:child});unload({target:doc,originalTarget:child});
 assert.equal(win.__nocturneLibrary,first);assert.equal(disposals,0);assert.equal(events.get("unload").fn,unload);
 assert.equal(traces.filter(x=>x.event==="library.unload.ignored").length,1);
 mount();const second=win.__nocturneLibrary;assert.notEqual(second,first);
 assert.equal(disposals,1);assert.equal(releases,1);unloads[0]();unload({target:doc});
 assert.equal(win.__nocturneLibrary,second);assert.equal(disposals,1);
 events.get("unload").fn({target:doc,originalTarget:doc});
 assert.equal(win.__nocturneLibrary,undefined);assert.equal(disposals,2);assert.equal(releases,2);
 assert.equal(events.size,0);assert.equal(observers.size,0);
 unloads[1]();assert.equal(disposals,2);
 assert.deepEqual(traces.filter(x=>x.event==="library.dispose.end").map(x=>x.data),[{reason:"replacement",failed:0},{reason:"window-unload",failed:0}]);
 mount();unloads[2]();assert.equal(disposals,3);assert.equal(win.__nocturneLibrary,undefined);
 assert.equal(traces.at(-1).data.reason,"sine-unload");
});
test("Library dependencies reject foreign originalTarget on native unload",()=>{
 for(const path of ["src/services/library-services-runtime.js.part","src/core/overlay-runtime.js.part"]){
   const source=read(path),start=source.indexOf("  function onUnload(event){"),end=source.indexOf("\n  const api=",start);
   assert.ok(start>=0&&end>start);
   const doc={},win={document:doc};let calls=0;
   const unload=new Function("win","doc","dispose",source.slice(start,end)+"return onUnload;")(win,doc,()=>calls++);
   unload({target:{}});unload({target:win,originalTarget:{}});assert.equal(calls,0);
   unload({target:doc,originalTarget:doc});unload({target:win});assert.equal(calls,2);
   assert.match(source,/addEventListener\("unload",onUnload\)/);
   assert.match(source,/removeEventListener\("unload",onUnload\)/);
 }
});
