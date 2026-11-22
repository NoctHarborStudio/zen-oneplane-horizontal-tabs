import test from "node:test";
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
 assert.deepEqual(await service.clearCompleted(),{removed:2,failed:0});assert.deepEqual(removed,[a,e]);await service.dispose();assert.equal(service.isReady(),false);
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

test("failed media refresh keeps committed rows actionable and successful refresh preserves IDs",async()=>{
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
 files=[{path:"old.jpg"}];assert.equal((await session.refresh())[0].id,old.id);
 files=[];await session.refresh();assert.equal(service.action(old.id,"open"),false);
 session.close();await service.dispose();
});
