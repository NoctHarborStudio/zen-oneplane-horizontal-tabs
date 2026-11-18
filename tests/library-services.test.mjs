import {readFileSync} from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {createDownloadsService} from "../src/services/downloads-service.mjs";
import {createHistorySession} from "../src/services/history-service.mjs";
import {createClosedTabsService} from "../src/services/closed-tabs-service.mjs";
const fake=()=>{
 const d={stopped:true,succeeded:true,target:{path:"C:\\Downloads\\a.png",exists:true},startTime:new Date(100),launch:async()=>{},showContainingDirectory:async()=>{}};
 let view,adds=0,removes=0;
 const list={async addView(v){adds++;view=v;v.onDownloadAdded(d);},async removeView(v){assert.equal(v,view);removes++;},async remove(d){view.onDownloadRemoved(d);}};
 return {d,list,counts:()=>[adds,removes],emit:(kind,d)=>view[kind](d)};
};
test("two consumers share one native subscription and replay without duplicate rows",async()=>{
 const f=fake(),s=createDownloadsService({loadList:async()=>f.list});await Promise.all([s.start(),s.start()]);
 let a=0,b=0,changes=0;const off=s.subscribeNative({onDownloadAdded(){a++},onDownloadChanged(){a++}});
 s.subscribeNative({onDownloadAdded(){b++},onDownloadChanged(){b++}});s.subscribe(()=>changes++);
 assert.deepEqual(f.counts(),[1,0]);assert.equal(a,1);assert.equal(b,1);
 const old=s.getSnapshot()[0];assert.equal(old.name,"a.png");f.d.currentBytes=4;f.emit("onDownloadChanged",f.d);
 assert.equal(s.getSnapshot()[0].id,old.id);assert.equal(old.bytes,0);assert.equal(s.getSnapshot()[0].bytes,4);
 off();f.emit("onDownloadChanged",f.d);assert.equal(a,2);assert.equal(b,3);assert.equal(changes,2);
 await s.dispose();assert.deepEqual(f.counts(),[1,1]);
});
test("clear only eligible native records; stale IDs and blocked or active downloads are rejected",async()=>{
 const f=fake(),s=createDownloadsService({loadList:async()=>f.list});await s.start();
 const id=s.getSnapshot()[0].id;f.d.hasBlockedData=true;assert.equal(await s.action(id,"remove"),false);assert.equal(await s.action(id,"open"),false);
 f.d.hasBlockedData=false;f.d.stopped=false;assert.equal(await s.action(id,"remove"),false);
 f.d.stopped=true;assert.equal(await s.action(id,"open"),true);assert.equal(await s.action(id,"remove"),true);
 assert.equal(s.getSnapshot().length,0);assert.equal(await s.action(id,"open"),false);await s.dispose();
});
test("reload waits for old addView and removal, stale replay is ignored",async()=>{
 let resolve,entered;const enteredPromise=new Promise(r=>entered=r);const wait=new Promise(r=>resolve=r);
 let count=0,peak=0;
 const list={async addView(){count++;peak=Math.max(peak,count);entered();await wait;},async removeView(){count--;}};
 const s=createDownloadsService({loadList:async()=>list});const start=s.start().catch(()=>{});await enteredPromise;
 const barrier=s.dispose();const next=createDownloadsService({loadList:async()=>list,barrier});const p=next.start();resolve();await start;await p;
 assert.equal(peak,1);await next.dispose();assert.equal(count,0);
});
test("history supports grouped and search results, invalidates old query, closes native observer",async()=>{
 let resolve,closed=0,notify=0,observer;
 const first=new Promise(r=>resolve=r),v={guid:"g",url:"https://example.com",title:"Example",date:new Date(1000)};
 const native={getHistory:()=>first,searchHistory:async()=>[v],observeHistory(fn){observer=fn;},close(){closed++;}};
 const s=createHistorySession({createQuery:()=>native,now:()=>2000,onChange:()=>notify++});
 const old=s.query();const result=await s.query({text:"example"});resolve(new Map([[1,[v]]]));assert.equal(await old,null);
 assert.equal(result.rows[0].id,"g-1000");observer();assert.equal(notify,1);s.close();observer();assert.equal(notify,1);assert.equal(closed,1);
});
test("grouped Places results retain native grouping and bounded pagination",async()=>{
 const v={guid:"g",url:"https://example.com",date:new Date(1000)};let args;
 const s=createHistorySession({now:()=>2000,createQuery:()=>({getHistory:async a=>{args=a;return new Map([[42,[v,v]]]);},searchHistory:async()=>[],close(){}})});
 const r=await s.query({limit:1});assert.equal(args.limit,1);assert.equal(r.rows[0].group,"42");assert.equal(r.rows.length,1);assert.equal(r.hasMore,true);s.close();
});
test("private history fails before constructing a Places query",()=>{
 assert.throws(()=>createHistorySession({allowed:()=>false,createQuery:()=>{throw Error("must not touch Places");}}),/unavailable/);
});
test("closed tabs use source-window entries and native identity, clean up observation",()=>{
 let off=0;const s=createClosedTabsService({now:()=>2000,getClosed:()=>[
  {closedId:9,closedAt:1000,state:{index:2,entries:[{url:"https://old.example"},{url:"https://example.com",title:"Current"}]}},
  {closedAt:1000,state:{index:1,entries:[{url:"https://invalid.example"}]}}
 ],observe:()=>()=>off++});
 const r=s.query({text:"Current"});assert.equal(r.rows.length,1);assert.equal(r.rows[0].closedId,9);assert.equal(r.rows[0].url,"https://example.com");
 s.subscribe(()=>{});s.dispose();assert.equal(off,1);assert.throws(()=>s.query(),/unavailable/);
});

test("closed tab disposal attempts every observer even when removal fails",()=>{
 const removed=[],errors=[],callbacks=[];let serial=0,notified=0;
 const s=createClosedTabsService({getClosed:()=>[],observe(fn){const id=++serial;callbacks.push(fn);return()=>{removed.push(id);if(id===2)throw Error("remove");};},onError:(label,error)=>errors.push([label,error.message])});
 const first=s.subscribe(()=>notified++);s.subscribe(()=>notified++);
 assert.deepEqual(s.dispose(),{released:1,failed:1});assert.deepEqual(removed,[2,1]);
 assert.deepEqual(errors,[["closed-tabs-observer","remove"]]);
 callbacks.forEach(fn=>fn());assert.equal(notified,0);first();s.dispose();assert.deepEqual(removed,[2,1]);
});
test("failed manual unsubscribe disables its callback and does not prevent another release",()=>{
 let cb,notified=0,released=0,errors=0;
 const s=createClosedTabsService({getClosed:()=>[],observe(fn){cb=fn;return()=>{released++;throw Error("remove");};},onError:()=>errors++});
 const off=s.subscribe(()=>notified++);assert.equal(off(),false);cb();
 assert.equal(notified,0);assert.equal(errors,1);assert.equal(released,1);s.dispose();assert.equal(released,1);
});
test("subscription acquired during synchronous disposal is immediately released",()=>{
 let s,removed=0; s=createClosedTabsService({getClosed:()=>[],observe(fn){fn();return()=>removed++;}});
 s.subscribe(()=>s.dispose());assert.equal(removed,1);
});

test("closed tabs subscriber failure during acquisition does not lose native unsubscribe",()=>{
 let removed=0,errors=[];
 const s=createClosedTabsService({getClosed:()=>[],observe(fn){fn();return()=>removed++;},onError:label=>errors.push(label)});
 s.subscribe(()=>{throw Error("consumer");});assert.deepEqual(errors,["closed-tabs-callback"]);
 assert.deepEqual(s.dispose(),{released:1,failed:0});assert.equal(removed,1);
});

test("failed native detach retains lease, blocks replacement and retries the exact view",async()=>{
 const lease={release:null},views=new Set(),events=[];let fail=true,adds=0,oldView;
 const list={addView(v){adds++;views.add(v);oldView??=v;},removeView(v){if(fail)throw Error("remove failure");views.delete(v);}};
 const a=createDownloadsService({lease,loadList:async()=>list,onDetach:r=>events.push(r)});
 await a.start();let callbacks=0;a.subscribe(()=>callbacks++);
 assert.equal(await a.dispose(),false);assert.equal(lease.release,a.dispose);assert.equal(views.size,1);
 oldView.onDownloadAdded({});assert.equal(callbacks,0);
 const b=createDownloadsService({lease,loadList:async()=>list});
 await assert.rejects(b.start(),/detach unresolved/);assert.equal(adds,1);
 assert.equal(await b.dispose(),true);assert.equal(lease.release,a.dispose);
 fail=false;const c=createDownloadsService({lease,loadList:async()=>list});
 await c.start();assert.equal(views.size,1);assert.equal(adds,2);assert.equal(lease.release,c.dispose);
 assert.equal(await c.dispose(),true);assert.equal(lease.release,null);assert.equal(views.size,0);
 assert.deepEqual(events,[{released:false,retained:true},{released:false,retained:true},{released:true,retained:false}]);
});
test("partial addView failure retains its inert view until retry can remove it",async()=>{
 const lease={release:null},views=new Set();let failAdd=true,failRemove=true,adds=0;
 const list={addView(v){views.add(v);adds++;v.onDownloadAdded({});if(failAdd)throw Error("add failure");},removeView(v){if(failRemove)throw Error("remove failure");views.delete(v);}};
 const s=createDownloadsService({lease,loadList:async()=>list});
 await assert.rejects(s.start(),/add failure/);assert.equal(s.isReady(),false);assert.equal(views.size,1);
 await assert.rejects(s.start(),/detach unresolved/);assert.equal(adds,1);
 failAdd=false;failRemove=false;await s.start();assert.equal(views.size,1);assert.equal(s.getSnapshot().length,1);
 assert.equal(await s.dispose(),true);assert.equal(views.size,0);
});
test("failed legacy detach barrier prevents replacement addView",async()=>{
 let loads=0;const s=createDownloadsService({barrier:Promise.resolve(false),loadList:async()=>{loads++;}});
 await assert.rejects(s.start(),/detach unresolved/);assert.equal(loads,0);await s.dispose();
});
test("lease serializes concurrent replacements and a pending addView",async()=>{
 const lease={release:null},views=new Set();let entered,resolve;
 const entry=new Promise(r=>entered=r),wait=new Promise(r=>resolve=r);
 const list={async addView(v){views.add(v);assert.equal(views.size,1);entered();await wait;},removeView(v){views.delete(v);}};
 const a=createDownloadsService({lease,loadList:async()=>list}),first=a.start();await entry;
 const b=createDownloadsService({lease,loadList:async()=>list}),second=b.start();
 resolve();await assert.rejects(first,/disposed/);await second;assert.equal(views.size,1);
 assert.equal(await b.dispose(),true);assert.equal(views.size,0);
});

test("legacy pending barrier survives a replacement generation that never started",async()=>{
 const src=readFileSync(new URL("../src/services/library-services-runtime.js.part",import.meta.url),"utf8");
 const code=src.slice(src.indexOf("  const BARRIER="),src.indexOf("  const mediaBarrier="));
 let finish;const pending=new Promise(r=>finish=r);
 const win={__nocturneLibraryServices:{dispose:()=>pending}};
 const mount=new Function("win","KEY",code+"return {lease,barrier};");
 const a=mount(win,"__nocturneLibraryServices");
 delete win.__nocturneLibraryServices;
 const b=mount(win,"__nocturneLibraryServices");
 assert.equal(a.lease,b.lease);assert.equal(b.barrier,pending);
 finish();await pending;await Promise.resolve();
 assert.equal(b.lease.barrier,null);
});

test("disposed pre-attach loadList cannot block or attach after replacement",async()=>{
 const lease={release:null},views=new Set();let entered,resolve;
 const entry=new Promise(r=>entered=r),waiting=new Promise(r=>resolve=r);
 const list={addView(v){views.add(v);},removeView(v){views.delete(v);}};
 const a=createDownloadsService({lease,loadList:()=>{entered();return waiting;}});
 const old=a.start();const rejected=assert.rejects(old,/disposed/);await entry;
 assert.equal(await a.dispose(),true);assert.equal(lease.release,null);
 const b=createDownloadsService({lease,loadList:async()=>list});await b.start();
 assert.equal(views.size,1);resolve(list);await rejected;
 assert.equal(views.size,1);assert.equal(lease.release,b.dispose);await b.dispose();
});
test("disposal waiting on an inherited barrier does not require the barrier to settle",async()=>{
 let finish;const barrier=new Promise(r=>finish=r),lease={release:null};let loads=0;
 const a=createDownloadsService({lease,barrier,loadList:()=>{loads++;}});
 const p=a.start(),rejected=assert.rejects(p,/disposed/);
 assert.equal(await a.dispose(),true);finish();await rejected;assert.equal(loads,0);
});
