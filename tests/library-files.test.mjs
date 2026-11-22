import test from "node:test";
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import {createLibraryData,libraryDownloadsCommand} from "../src/library/data.mjs";
import {createMediaService,mediaKind,mediaPathKey,safeRaster,queryDownloadRows} from "../src/services/media-service.mjs";
import {createDownloadsService} from "../src/services/downloads-service.mjs";
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const row=(id,name,extra={})=>({id,name,kind:"download",success:true,exists:true,time:1,total:10,...extra});
test("download projections use one source, classify complete files and sort active first",()=>{
 const rows=[row("a","a.PDF"),row("b","b.png",{active:true,success:false}),row("c","c.JPG"),row("d","d.pdf",{exists:false}),row("e","e.docx",{partial:true})];
 assert.deepEqual(queryDownloadRows(rows,{section:"documents"}).rows.map(r=>r.id),["a"]);
 assert.deepEqual(queryDownloadRows(rows,{section:"pictures"}).rows.map(r=>r.id),["c"]);
 assert.equal(queryDownloadRows(rows,{section:"downloads",sort:"size"}).rows[0].id,"b");
 assert.deepEqual(queryDownloadRows(rows,{filter:"active",text:"B.PNG"}).rows.map(r=>r.id),["b"]);
 assert.equal(queryDownloadRows(rows,{limit:2}).hasMore,true);
 assert.equal(mediaKind("pdf"),null);assert.equal(mediaKind("X.PDF"),"documents");
});
test("local scan deduplicates Windows paths and excludes clouds, active image formats and oversized thumbnails",async()=>{
 const files=[{path:"C:/Downloads/A.JPG"},{path:"C:/Pictures/B.png"},{path:"C:/Pictures/b.PNG"},{path:"C:/Pictures/cloud.png",cloudPlaceholder:true},{path:"C:/Pictures/a.exe"}];
 const actions=[];const service=createMediaService({scan:async()=>files,windows:true,describe:(f,id)=>({id,name:f.path.split("/").pop()}),perform:(path,kind)=>{actions.push([path,kind]);return true;}});
 const s=service.open("pictures",()=>new Set([mediaPathKey("c:\\downloads\\a.jpg",true)]));
 const result=await s.refresh();assert.equal(result.length,1);assert.equal(result[0].name,"B.png");
 assert.equal(service.action(result[0].id,"reveal"),true);assert.equal(service.action(result[0].id,"remove"),false);s.close();assert.equal(service.action(result[0].id,"open"),false);
 assert.equal(safeRaster("a.svg",10),false);assert.equal(safeRaster("a.jpg",2097153),false);assert.equal(safeRaster("a.jpg",2097152),true);service.dispose();
});
test("closed scan suppresses stale result and serialized scans never overlap",async()=>{
 const first=deferred();let calls=0;const service=createMediaService({scan:()=>++calls===1?first.promise:Promise.resolve([]),describe:()=>({}),perform:()=>true});
 const a=service.open("pictures"),b=service.open("documents");const p=a.refresh();await tick();a.close();const q=b.refresh();await tick();assert.equal(calls,1);first.resolve([{path:"a.jpg"}]);assert.equal(await p,null);await q;assert.equal(calls,2);b.close();service.dispose();
});
test("download view cancels delayed attach and never subscribes after close",async()=>{
 const gate=deferred();let subs=0,scans=0;const service={downloads:{start:()=>gate.promise,subscribe(){subs++;return()=>{};},getSnapshot:()=>[]},openMedia(){scans++;}};
 const data=createLibraryData({getServices:()=>service,onResult(){},onError(){},schedule:setTimeout,cancel:clearTimeout});
 data.start("pictures");data.stop();gate.resolve();await tick();assert.equal(subs,0);assert.equal(scans,0);data.dispose();
});
test("download views subscribe once, throttle progress and do not scan All Downloads",async()=>{
 let subs=0,off=0,scans=0,changed,results=[],timers=[];
 const service={downloads:{start:async()=>{},subscribe(fn){subs++;changed=fn;return()=>off++;},getSnapshot:()=>[row("a","a.png")]},openMedia(){scans++;}};
 const data=createLibraryData({getServices:()=>service,onResult:r=>results.push(r),onError:()=>assert.fail("unexpected error"),schedule:fn=>{timers.push(fn);return timers.length;},cancel:()=>{}});
 data.start("downloads");await tick();assert.equal(subs,1);assert.equal(scans,0);assert.equal(results.length,1);
 changed();changed();changed();assert.equal(timers.length,1);timers[0]();await tick();assert.equal(results.length,2);
 data.stop();assert.equal(off,1);data.dispose();
});
test("clear finished records never removes active, partial or blocked downloads",async()=>{
 let view;const removed=[];const a={stopped:true,succeeded:true,target:{path:"a.pdf"}},b={stopped:false},c={stopped:true,hasPartialData:true},d={stopped:true,hasBlockedData:true},e={stopped:true,canceled:true};
 const list={addView(v){view=v;for(const x of [a,b,c,d,e])v.onDownloadAdded(x);},removeView(){},remove(x){removed.push(x);view.onDownloadRemoved(x);}};
 const service=createDownloadsService({loadList:async()=>list});await service.start();assert.equal(service.isReady(),true);
 assert.deepEqual(await service.clearCompleted(),{requested:2,removed:2,skipped:0,failed:0});assert.deepEqual(removed,[a,e]);await service.dispose();assert.equal(service.isReady(),false);
});
test("download routing only recognizes native downloads command IDs",()=>{
 assert.equal(libraryDownloadsCommand({target:{id:"Tools:Downloads"}}),true);assert.equal(libraryDownloadsCommand({target:{id:"key_openDownloads"}}),true);assert.equal(libraryDownloadsCommand({target:{id:"key_gotoHistory"}}),false);assert.equal(libraryDownloadsCommand({target:{id:"Tools:Downloads"},defaultPrevented:true}),false);
});

test("opaque native access is restricted to existing completed records",async()=>{
 let view;const d={stopped:true,succeeded:true,target:{path:"x.png",exists:true}};
 const service=createDownloadsService({loadList:async()=>({addView(v){view=v;v.onDownloadAdded(d);},removeView(){}})});
 await service.start();const id=service.getSnapshot()[0].id;
 assert.equal(service.withNative(id,x=>x===d),true);assert.equal(service.withNative("unknown",()=>assert.fail("unknown ID")),false);
 d.hasPartialData=true;assert.equal(service.withNative(id,()=>assert.fail("partial")),false);
 d.hasPartialData=false;view.onDownloadRemoved(d);assert.equal(service.withNative(id,()=>assert.fail("removed")),false);
 await service.dispose();
});

test("media reload waits for previous native scan to release",async()=>{
 const gate=deferred();let scans=0;
 const first=createMediaService({scan:()=>gate.promise,describe:()=>({}),perform:()=>true});
 const session=first.open("pictures");const result=session.refresh();await tick();session.close();
 const barrier=first.dispose();const second=createMediaService({barrier,scan:async()=>{scans++;return [];},describe:()=>({}),perform:()=>true});
 const next=second.open("documents"),read=next.refresh();await tick();assert.equal(scans,0);gate.resolve([]);
 assert.equal(await result,null);await read;assert.equal(scans,1);next.close();await second.dispose();
});

test("failed media refresh keeps committed rows actionable and rotates IDs while retaining view keys",async()=>{
 let files=[{path:"old.jpg"}],opened;
 const service=createMediaService({scan:()=>files,describe(f,id){
   if(f.path==="bad.jpg")throw Error("metadata unavailable");
   return {id,name:f.path};
 },perform(path){opened=path;return true;}});
 const session=service.open("pictures");
 const [old]=await session.refresh();
 files=[{path:"new.jpg"},{path:"bad.jpg"}];
 await assert.rejects(session.refresh(),/metadata unavailable/);
 assert.deepEqual(session.rows(),[old]);
 assert.equal(service.action(old.id,"open"),true);assert.equal(opened,"old.jpg");
 files=[{path:"old.jpg"}];const next=(await session.refresh())[0];
 assert.notEqual(next.id,old.id);assert.equal(next.viewKey,old.viewKey);
 assert.equal(service.action(old.id,"open"),false);assert.equal(service.action(next.id,"open"),true);
 files=[];await session.refresh();assert.equal(service.action(next.id,"open"),false);
 session.close();await service.dispose();
});

test("revoked local-media sessions cannot regain rows or actions after re-enable",async()=>{
 let enabled=true,calls=0;const pending=deferred();
 const service=createMediaService({allowed:()=>enabled,scan(){
   return ++calls===2?pending.promise:[{path:"saved.pdf"}];
 },describe:(f,id)=>({id}),perform:()=>true});
 const old=service.open("documents"),[item]=await old.refresh();
 const inflight=old.refresh();await tick();
 enabled=false;service.invalidate();enabled=true;
 pending.resolve([{path:"stale.pdf"}]);
 assert.equal(await inflight,null);assert.deepEqual(old.rows(),[]);
 assert.equal(await old.refresh(),null);assert.equal(calls,2);
 assert.equal(service.action(item.id,"open"),false);
 const fresh=service.open("documents"),[next]=await fresh.refresh();
 old.close();assert.equal(service.action(next.id,"reveal"),true);
 await service.dispose();assert.deepEqual(fresh.rows(),[]);
});

test("media pref invalidation/reopen is safe for either Sine observer order",async()=>{
 const runtime=readFileSync(new URL("../src/services/library-services-runtime.js.part",import.meta.url),"utf8");
 const controller=readFileSync(new URL("../src/library/controller.js.part",import.meta.url),"utf8");
 const nativeHandler=runtime.match(/^  function onMediaScopeChange\(\)\{[^\n]+\}/m)?.[0];
 const start=controller.indexOf("  // Pref observers of independent Sine scripts");
 const end=controller.indexOf("  function onWorkspace(",start);
 assert.ok(nativeHandler&&start>=0&&end>start);
 // Evaluate the exact production callbacks against the real media service.
 const init=new Function("win","media","state","renderBody","trace",`
   let folderGeneration=0,dead=false,dragSource=null,pendingClose=false;
   const active=()=>state.phase!=="closed";
   ${nativeHandler}
   ${controller.slice(start,end)}
   return {onMediaScopeChange,onMediaPref,dispose(){dead=true;},drag(){dragSource={};},pendingClose:()=>pendingClose};
 `);
 for(const first of ["service","controller"]){
   const media=createMediaService({scan:async()=>[{path:"picture.png"}],
     describe:(f,id)=>({id,name:f.path}),perform:()=>true});
   let session=null,renders=0,read=null;const win={queueMicrotask};
   const callbacks=init(win,media,{phase:"open",section:"pictures"},()=>{
     renders++;session?.close();session=media.open("pictures");read=session.refresh();
   },()=>{});
   if(first==="service"){callbacks.onMediaScopeChange();callbacks.onMediaPref();}
   else{callbacks.onMediaPref();callbacks.onMediaScopeChange();}
   callbacks.onMediaPref(); // A second preference event in the same turn coalesces.
   await tick();
   assert.equal(renders,1,first+" observer ordering rendered more than once");
   assert.equal((await read)?.length,1,first+" observer ordering invalidated its new session");
   assert.equal(session.rows().length,1);
   session.close();await media.dispose();
 }
});
test("queued media preference refresh respects disposal and a native file drag",async()=>{
 const src=readFileSync(new URL("../src/library/controller.js.part",import.meta.url),"utf8");
 const start=src.indexOf("  // Pref observers of independent Sine scripts");
 const end=src.indexOf("  function onWorkspace(",start);assert.ok(start>=0&&end>start);
 let rendered=0;const state={phase:"open",section:"pictures"},win={queueMicrotask};
 const init=new Function("win","state","renderBody","trace",`
   let dead=false,dragSource=null,pendingClose=false;
   const active=()=>state.phase!=="closed";
   ${src.slice(start,end)}
   return {onMediaPref,dispose(){dead=true;},drag(){dragSource={};},pendingClose:()=>pendingClose};
 `);
 const stale=init(win,state,()=>rendered++,()=>{});stale.onMediaPref();stale.dispose();
 await tick();assert.equal(rendered,0);
 const drag=init(win,state,()=>rendered++,()=>{});drag.drag();drag.onMediaPref();
 await tick();assert.equal(rendered,0);assert.equal(drag.pendingClose(),true);
});

test("bulk clear reports native state changes that skip a previously eligible record",async()=>{
 const a={stopped:true,succeeded:true,target:{path:"a.pdf"}},b={stopped:true,succeeded:true,target:{path:"b.pdf"}};
 let view;const removed=[];
 const list={addView(v){view=v;v.onDownloadAdded(a);v.onDownloadAdded(b);},removeView(){},remove(d){
   removed.push(d);if(d===a){b.hasPartialData=true;view.onDownloadChanged(b);}view.onDownloadRemoved(d);
 }};
 const s=createDownloadsService({loadList:async()=>list});await s.start();
 assert.deepEqual(await s.clearCompleted(),{requested:2,removed:1,skipped:1,failed:0});
 assert.deepEqual(removed,[a]);assert.equal(s.getSnapshot().length,1);assert.equal(s.getSnapshot()[0].partial,true);
 await s.dispose();
});
test("bulk clear distinguishes native errors and eligibility skips without retrying",async()=>{
 const a={stopped:true,succeeded:true,target:{path:"a"}},b={stopped:true,succeeded:true,target:{path:"b"}},c={stopped:true,succeeded:true,target:{path:"c"}};
 let view;const attempts=[];
 const list={addView(v){view=v;for(const d of [a,b,c])v.onDownloadAdded(d);},removeView(){},remove(d){
   attempts.push(d);if(d===a){b.hasPartialData=true;view.onDownloadChanged(b);view.onDownloadRemoved(a);return;}
   if(d===c)throw Error("native error");
 }};
 const s=createDownloadsService({loadList:async()=>list});await s.start();
 assert.deepEqual(await s.clearCompleted(),{requested:3,removed:1,skipped:1,failed:1});
 assert.deepEqual(attempts,[a,c]);assert.equal(s.getSnapshot().length,2);await s.dispose();
});

test("local-media handles rotate while view keys survive normalized paths, then expire on rename and close",async()=>{
 let files=[{path:"C:\\Pictures\\FILE.JPG"}],opened=[],events=[];
 const service=createMediaService({windows:true,scan:async()=>files,describe:(file,id)=>({id,name:file.path}),perform:path=>{opened.push(path);return true;},onRefresh:event=>events.push(event)});
 const session=service.open("pictures"),[a]=await session.refresh();
 files=[{path:"c:/pictures/file.jpg"}];const [b]=await session.refresh();
 assert.equal(a.viewKey,b.viewKey);assert.notEqual(a.id,b.id);
 assert.equal(service.action(a.id,"open"),false);assert.equal(service.action(b.id,"reveal"),true);
 assert.deepEqual(opened,["c:/pictures/file.jpg"]);
 assert.deepEqual(events.at(-1),{section:"pictures",status:"committed",count:1});
 files=[{path:"C:/Pictures/renamed.jpg"}];const [renamed]=await session.refresh();
 assert.notEqual(renamed.viewKey,b.viewKey);assert.equal(service.action(b.id,"open"),false);
 session.close();assert.equal(service.action(renamed.id,"open"),false);
 const fresh=service.open("pictures"),[again]=await fresh.refresh();
 assert.notEqual(again.viewKey,renamed.viewKey);assert.equal(service.action(again.id,"open"),true);
 fresh.close();await service.dispose();
});
test("metadata staging failure preserves the old cache; a delayed scan cannot reopen a closed session",async()=>{
 let files=[{path:"one.jpg"}],gate=null,events=[];
 const service=createMediaService({scan:()=>gate?gate.promise:files,describe:(file,id)=>{if(file.path==="bad.jpg")throw Error("bad metadata");return {id,name:file.path};},
   perform:()=>true,onRefresh:e=>events.push(e)});
 const session=service.open("pictures"),[saved]=await session.refresh();
 files=[{path:"two.jpg"},{path:"bad.jpg"}];
 await assert.rejects(session.refresh(),/bad metadata/);
 assert.deepEqual(session.rows(),[saved]);assert.equal(service.action(saved.id,"open"),true);
 assert.equal(service.action("local-2","open"),false);
 assert.deepEqual(events.map(e=>e.status),["committed","error"]);
 gate=deferred();const stale=session.refresh();await tick();session.close();gate.resolve([{path:"three.jpg"}]);
 assert.equal(await stale,null);assert.equal(service.action(saved.id,"open"),false);
 assert.deepEqual(events.map(e=>e.status),["committed","error"]);await service.dispose();
});

test("same media session coalesces repeated refresh into one native scan and retains the disposal barrier",async()=>{
 const gate=deferred();let calls=0,events=[];
 const service=createMediaService({scan:()=>{calls++;return gate.promise;},describe:(f,id)=>({id,name:f.path}),perform:()=>true,onRefresh:e=>events.push(e)});
 const s=service.open("pictures"),first=s.refresh(),duplicate=s.refresh(),another=s.refresh();
 assert.equal(first,duplicate);assert.equal(first,another);
 await tick();assert.equal(calls,1);
 const disposing=service.dispose();let finished=false;void disposing.then(()=>{finished=true;});
 await tick();assert.equal(finished,false,"native scan completion must retain the barrier after UI disposal");
 gate.resolve([{path:"a.png"}]);assert.equal(await first,null);
 await disposing;assert.equal(finished,true);assert.deepEqual(events,[]);
 s.close();
});
test("Library UI media deadline is non-native: repeated Refresh shares one operation and a late callback updates rows",async()=>{
 const gate=deferred(),notices=[],statuses=[],results=[],timers=new Map();let timerId=0,scans=0,lastNotice="";
 const media=createMediaService({scan:()=>{scans++;return gate.promise;},describe:(f,id)=>({id,kind:"local",name:f.path,time:2,success:true,exists:true}),
   perform:()=>true});
 const service={downloads:{start:async()=>{},subscribe:()=>()=>{},getSnapshot:()=>[row("download-1","download.png")]},
   openMedia:section=>media.open(section)};
 const notice=(message,onlyIf)=>{if(onlyIf!==undefined&&lastNotice!==onlyIf)return;lastNotice=message;notices.push(message);};
 const data=createLibraryData({getServices:()=>service,onResult:r=>results.push(r),onError:()=>assert.fail("unexpected error"),onNotice:notice,onScanWait:status=>statuses.push(status),
   schedule:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},cancel:id=>timers.delete(id)});
 data.start("pictures");await tick();assert.equal(scans,1);
 assert.deepEqual(results.at(-1).rows.map(r=>r.name),["download.png"]);
 const deadline=[...timers].find(([,t])=>t.ms===15000);
 assert.ok(deadline,"existing schedule should carry only a UI deadline");
 const first=data.refresh(),second=data.refresh();assert.equal(first,second);
 timers.delete(deadline[0]);deadline[1].fn();assert.equal(await first,false);
 assert.deepEqual(statuses,["deadline"]);assert.match(lastNotice,/still running/);
 assert.equal(await data.refresh(),false);assert.equal(scans,1);
 gate.resolve([{path:"folder.png"}]);await tick();
 assert.deepEqual(statuses,["deadline","late-complete"]);
 assert.equal(lastNotice,"");assert.deepEqual(results.at(-1).rows.map(r=>r.name).sort(),["download.png","folder.png"]);
 assert.equal(timers.size,0);
 data.dispose();await media.dispose();
});
test("Library section stop cancels the deadline and blocks stale native media callback",async()=>{
 const gate=deferred(),timers=new Map(),results=[],notices=[],statuses=[];let serial=0,scans=0;
 const media=createMediaService({scan:()=>{scans++;return gate.promise;},describe:(f,id)=>({id,kind:"local",name:f.path}),perform:()=>true});
 const service={downloads:{start:async()=>{},subscribe:()=>()=>{},getSnapshot:()=>[]},openMedia:section=>media.open(section)};
 const data=createLibraryData({getServices:()=>service,onResult:r=>results.push(r),onError:()=>assert.fail("unexpected error"),
   onNotice:x=>notices.push(x),onScanWait:x=>statuses.push(x),
   schedule:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},cancel:id=>timers.delete(id)});
 data.start("pictures");await tick();assert.equal(scans,1);
 const pending=data.refresh();data.stop();assert.equal(await pending,false);
 assert.equal(timers.size,0);
 gate.resolve([{path:"late.png"}]);await tick();
 assert.deepEqual(statuses,[]);assert.deepEqual(notices,[]);
 assert.ok(results.every(r=>r.rows.every(x=>x.name!=="late.png")));
 data.dispose();await media.dispose();
});

test("failed native media scan after the UI deadline frees the exact wait and allows a later retry",async()=>{
 let rejectFirst,scans=0,last="",statuses=[],results=[],timers=new Map(),serial=0;
 const first=new Promise((_,reject)=>{rejectFirst=reject;});
 const media=createMediaService({scan:()=>++scans===1?first:Promise.resolve([{path:"recovered.png"}]),
   describe:(f,id)=>({id,kind:"local",name:f.path,time:2,success:true,exists:true}),perform:()=>true});
 const services={downloads:{start:async()=>{},subscribe:()=>()=>{},getSnapshot:()=>[]},openMedia:section=>media.open(section)};
 const data=createLibraryData({getServices:()=>services,onResult:r=>results.push(r),onError:()=>assert.fail("unexpected error"),
   onNotice:(msg,expected)=>{if(expected===undefined||last===expected)last=msg;},onScanWait:x=>statuses.push(x),
   schedule:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},cancel:id=>timers.delete(id)});
 data.start("pictures");await tick();assert.equal(scans,1);
 const deadline=[...timers].find(([,t])=>t.ms===15000);assert.ok(deadline);
 const pending=data.refresh();timers.delete(deadline[0]);deadline[1].fn();
 assert.equal(await pending,false);assert.deepEqual(statuses,["deadline"]);
 rejectFirst(Error("native scanner failure"));await tick();
 assert.deepEqual(statuses,["deadline","late-error"]);assert.match(last,/could not be scanned/);
 assert.equal(timers.size,0);
 assert.equal(await data.refresh(),true);await tick();
 assert.equal(scans,2);assert.equal(results.at(-1).rows[0].name,"recovered.png");
 data.dispose();await media.dispose();assert.equal(timers.size,0);
});
