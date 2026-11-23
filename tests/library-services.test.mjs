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
 let getCount=0;const native={getHistory:()=>++getCount===1?first:new Map(),searchHistory:async()=>[v],observeHistory(fn){observer=fn;},close(){closed++;}};
 const s=createHistorySession({createQuery:()=>native,now:()=>2000,onChange:()=>notify++});
 const old=s.query();const result=await s.query({text:"example"});resolve(new Map([[1,[v]]]));assert.equal(await old,null);
 assert.equal(result.rows[0].id,"g-1000");observer();assert.equal(notify,1);s.close();observer();assert.equal(notify,1);assert.equal(closed,1);
});
test("history accepts native Places maps from a different JavaScript realm",async()=>{
  const {runInNewContext}=await import("node:vm");
  const grouped=runInNewContext("new Map([[1700000000000,[{guid:'cross-global',url:'https://example.test/visit',title:'Cross-global visit',date:new Date(1700000000000)}]]])");
  assert.equal(grouped instanceof Map,false,"must exercise the cross-realm failure, not a local Map");
  assert.equal(Object.prototype.toString.call(grouped),"[object Map]");
  const native={getHistory:async()=>grouped,searchHistory:async()=>[],close(){}};
  const session=createHistorySession({now:()=>1700000001000,createQuery:()=>native});
  try{
    const result=await session.query({limit:50});
    assert.equal(result.rows.length,1);
    assert.equal(result.rows[0].url,"https://example.test/visit");
    assert.equal(result.rows[0].group,"1700000000000");
    assert.equal(result.rows[0].time,1700000000000);
    assert.equal(result.hasMore,false);
  }finally{session.close();}
});
test("grouped Places results retain native grouping and bounded pagination",async()=>{
 const v={guid:"g",url:"https://example.com",date:new Date(1000)};let args;
 const s=createHistorySession({now:()=>2000,createQuery:()=>({getHistory:async a=>{args=a;return new Map([[42,[v,v]]]);},searchHistory:async()=>[],close(){}})});
 const r=await s.query({limit:1});assert.equal(args.limit,2);assert.equal(r.rows[0].group,"42");assert.equal(r.rows.length,1);assert.equal(r.hasMore,true);s.close();
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

test("native Dock and Library drags use one current Download identity, with distinct purpose",async()=>{
 const f=fake(),calls=[],s=createDownloadsService({loadList:async()=>f.list,dragFile:(d,e,node,purpose)=>{
  calls.push([d,e,node,purpose]);return true;
 }});
 const event={isTrusted:true},node={};
 assert.equal(s.dragNative(f.d,event,node),false);
 await s.start();
 const id=s.getSnapshot()[0].id;
 assert.equal(s.dragNative(f.d,event,node),true);
 assert.equal(s.drag(id,event,node),true);
 assert.deepEqual(calls.map(x=>x[3]),["dock","library"]);
 assert.ok(calls.every(x=>x[0]===f.d));
 assert.equal(s.dragNative({...f.d},event,node),false);
 assert.equal(s.dragNative(null,event,node),false);
 for(const field of ["succeeded","hasBlockedData","hasPartialData","canceled","error"]){
  const prev=f.d[field];f.d[field]=field==="succeeded"?false:true;
  assert.equal(s.dragNative(f.d,event,node),false);
  assert.equal(s.drag(id,event,node),false);
  f.d[field]=prev;
 }
 f.d.target.exists=false;
 assert.equal(s.dragNative(f.d,event,node),false);
 assert.equal(s.drag(id,event,node),false);
 f.d.target.exists=true;
 f.emit("onDownloadRemoved",f.d);
 assert.equal(s.dragNative(f.d,event,node),false);
 assert.equal(s.drag(id,event,node),false);
 assert.deepEqual(calls.map(x=>x[3]),["dock","library"]);
 await s.dispose();
 assert.equal(s.dragNative(f.d,event,node),false);
});

test("filtered first history page can reach a recent visit and exact boundaries end pagination",async()=>{
 const now=200*86400000;
 const visits=[0,0,now].map((date,i)=>({url:"https://example.test/"+i,date}));
 const session=createHistorySession({now:()=>now,createQuery:()=>({
   getHistory(){},searchHistory:async(term,limit)=>visits.slice(0,limit),close(){}
 })});
 try{
   const first=await session.query({text:"example",limit:2});
   assert.deepEqual(first.rows,[]);assert.equal(first.hasMore,true);
   const all=await session.query({text:"example",limit:3});
   assert.deepEqual(all.rows.map(row=>row.time),[now]);assert.equal(all.hasMore,false);
 }finally{session.close();}
});

test("fresh native Places search primes cache options before first typed query",async()=>{
 const calls=[],now=2000000;
 const native={cachedHistoryOptions:null,
   async getHistory(options){calls.push(["getHistory",options]);this.cachedHistoryOptions=options;return new Map();},
   async searchHistory(text,limit){assert.ok(this.cachedHistoryOptions,"native search requires cache options");calls.push(["searchHistory",text,limit]);return [{url:"https://example.test/first",guid:"first",date:new Date(now-1000)}];},
   close(){}};
 const session=createHistorySession({now:()=>now,createQuery:()=>native});
 try{
   const result=await session.query({text:"first",limit:2,sort:"site",days:90});
   assert.deepEqual(calls,[["getHistory",{daysOld:90,limit:3,sortBy:"site"}],["searchHistory","first",3]]);
   assert.equal(result.rows[0].id,"first-"+(now-1000));
   assert.equal(result.hasMore,false);
 }finally{session.close();}
});
test("superseded native History initialization cannot dispatch an old search",async()=>{
 let release;const wait=new Promise(resolve=>release=resolve),terms=[];
 let priming=0;
 const native={async getHistory(){if(++priming===1)await wait;return new Map();},async searchHistory(term){terms.push(term);return [];},close(){}};
 const session=createHistorySession({createQuery:()=>native});
 try{
   const stale=session.query({text:"old"});const latest=await session.query({text:"new"});
   assert.deepEqual(latest.rows,[]);release();assert.equal(await stale,null);
   assert.deepEqual(terms,["new"]);
 }finally{session.close();}
});

test("Dock and Library cannot run overlapping bulk clears on one native list",async()=>{
 let view,entered,release,removes=0;
 const started=new Promise(resolve=>entered=resolve),waiting=new Promise(resolve=>release=resolve);
 const d={stopped:true,succeeded:true,target:{path:"test.txt"}};
 const native={addView(v){view=v;v.onDownloadAdded(d);},removeView(){},async remove(item){
   removes++;entered();await waiting;view.onDownloadRemoved(item);
 }};
 const service=createDownloadsService({loadList:async()=>native});await service.start();
 const dock=service.clearCompleted();await started;
 assert.equal(await service.clearCompleted(),null);
 assert.equal(removes,1);
 release();assert.deepEqual(await dock,{requested:1,removed:1,skipped:0,failed:0});
 assert.deepEqual(await service.clearCompleted(),{requested:0,removed:0,skipped:0,failed:0});
 await service.dispose();
});
test("the same native Download cannot be removed by a row while bulk removal is pending",async()=>{
 let view,entered,release,removes=0;
 const started=new Promise(resolve=>entered=resolve),waiting=new Promise(resolve=>release=resolve);
 const d={stopped:true,succeeded:true,target:{path:"test.txt"}};
 const native={addView(v){view=v;v.onDownloadAdded(d);},removeView(){},async remove(item){
   removes++;entered();await waiting;view.onDownloadRemoved(item);
 }};
 const service=createDownloadsService({loadList:async()=>native});await service.start();
 const id=service.getSnapshot()[0].id;
 const bulk=service.clearCompleted();await started;
 assert.equal(await service.action(id,"remove"),false);
 assert.equal(await service.remove(d),false);
 assert.equal(removes,1);
 release();assert.equal((await bulk).removed,1);await service.dispose();
});
test("bulk clear honors an existing Dock generation guard between native removals",async()=>{
 let view,entered,release;const calls=[],first={stopped:true,target:{path:"first.txt"}},second={stopped:true,target:{path:"second.txt"}};
 const started=new Promise(resolve=>entered=resolve),waiting=new Promise(resolve=>release=resolve);
 const native={addView(v){view=v;v.onDownloadAdded(first);v.onDownloadAdded(second);},removeView(){},async remove(d){
   calls.push(d);if(d===first){entered();await waiting;}view.onDownloadRemoved(d);
 }};
 const service=createDownloadsService({loadList:async()=>native});await service.start();
 let current=true;const inFlight=service.clearCompleted(()=>current);await started;
 current=false;release();
 assert.deepEqual(await inFlight,{requested:2,removed:1,skipped:1,failed:0});
 assert.deepEqual(calls,[first]);assert.equal(service.getSnapshot().length,1);
 assert.deepEqual(await service.clearCompleted(),{requested:1,removed:1,skipped:0,failed:0});await service.dispose();
});

test("service reload cannot reattach while the old native removal Promise is pending",async()=>{
 const d={stopped:true,succeeded:true,target:{path:"fixture.txt"}};
 const views=new Set();let entered,release,removed=0,detached=0,attached=0,peak=0;
 const started=new Promise(resolve=>entered=resolve),waiting=new Promise(resolve=>release=resolve);
 const list={
   addView(v){views.add(v);attached++;peak=Math.max(peak,views.size);v.onDownloadAdded(d);},
   removeView(v){detached++;views.delete(v);},
   async remove(item){removed++;entered();await waiting;for(const view of views)view.onDownloadRemoved(item);}
 };
 const old=createDownloadsService({loadList:async()=>list});await old.start();
 const oldClear=old.clearCompleted();await started;
 const barrier=old.dispose();
 const next=createDownloadsService({loadList:async()=>list,barrier});
 const nextStart=next.start();
 await Promise.resolve();await Promise.resolve();
 assert.equal(detached,0);assert.equal(attached,1);assert.equal(removed,1);
 release();await oldClear;await barrier;await nextStart;
 assert.equal(detached,1);assert.equal(attached,2);assert.equal(peak,1);
 assert.equal((await next.clearCompleted()).removed,1);assert.equal(removed,2);
 await next.dispose();assert.equal(views.size,0);
});
test("failed native removal releases the old service lease only after rejection",async()=>{
 const d={stopped:true,succeeded:true,target:{path:"failure.txt"}};
 const views=new Set();let entered,reject,removed=0;
 const started=new Promise(resolve=>entered=resolve),waiting=new Promise((_,fail)=>reject=fail);
 const native={
   addView(v){views.add(v);v.onDownloadAdded(d);},removeView(v){views.delete(v);},
   remove(){removed++;entered();return waiting;}
 };
 const old=createDownloadsService({loadList:async()=>native});await old.start();
 const clear=old.clearCompleted();await started;
 const barrier=old.dispose();let settled=false;void barrier.then(()=>{settled=true;});
 await Promise.resolve();await Promise.resolve();
 assert.equal(settled,false);assert.equal(views.size,1);
 reject(Error("native remove failed"));
 assert.deepEqual(await clear,{requested:1,removed:0,skipped:0,failed:1});
 assert.equal(await barrier,true);assert.equal(views.size,0);
 const fresh=createDownloadsService({loadList:async()=>native,barrier});
 await fresh.start();assert.equal(views.size,1);
 await fresh.dispose();assert.equal(views.size,0);assert.equal(removed,1);
});

test("History date search does not advertise a page beyond the valid time range",async()=>{
 const now=200*86400000,day=86400000;
 const rows=[1,2,121].map((days,i)=>({guid:"visit-"+i,url:"https://example.test/"+i,date:new Date(now-days*day)}));
 let searches=0;
 const s=createHistorySession({now:()=>now,createQuery:()=>({
   getHistory:async()=>new Map(),searchHistory:async(_term,limit)=>{searches++;return rows.slice(0,limit);},close(){}
 })});
 try{
   const date=await s.query({text:"example",limit:2,days:120,sort:"date"});
   assert.deepEqual(date.rows.map(r=>r.url),rows.slice(0,2).map(r=>r.url));
   assert.equal(date.hasMore,false,"next native date-ordered row is beyond the 120-day cutoff");
   const site=await s.query({text:"example",limit:2,days:120,sort:"site"});
   assert.equal(site.hasMore,true,"URL-sorted searches cannot infer exhaustion from one old lookahead");
   assert.equal(searches,2);
 }finally{s.close();}
});
test("History date search includes cutoff boundary and retains pagination for newer lookahead",async()=>{
 const now=200*86400000,day=86400000;
 const rows=[1,2,120].map((days,i)=>({guid:"visit-"+i,url:"https://example.test/"+i,date:new Date(now-days*day)}));
 const s=createHistorySession({now:()=>now,createQuery:()=>({
   getHistory:async()=>new Map(),searchHistory:async(_term,limit)=>rows.slice(0,limit),close(){}
 })});
 try{
   const first=await s.query({text:"example",limit:2,days:120,sort:"date"});
   assert.equal(first.rows.length,2);assert.equal(first.hasMore,true);
   const last=await s.query({text:"example",limit:3,days:120,sort:"date"});
   assert.equal(last.rows.length,3);assert.equal(last.hasMore,false);
 }finally{s.close();}
});
test("per-window Downloads snapshots and native leases remain isolated on the same public list",async()=>{
 const download={stopped:true,succeeded:true,target:{path:"a.pdf",exists:true}};
 const views=new Set(),nativeList={addView(view){views.add(view);view.onDownloadAdded(download);},removeView(view){views.delete(view);}};
 const a=createDownloadsService({loadList:async()=>nativeList,idPrefix:"one"});
 const b=createDownloadsService({loadList:async()=>nativeList,idPrefix:"two"});
 await Promise.all([a.start(),b.start()]);
 assert.equal(views.size,2);
 const [ra]=a.getSnapshot(),[rb]=b.getSnapshot();assert.notEqual(ra.id,rb.id);
 assert.equal(a.withNative(rb.id,()=>true),false);assert.equal(b.withNative(ra.id,()=>true),false);
 await a.dispose();assert.equal(views.size,1);assert.equal(a.getSnapshot().length,0);
 assert.equal(b.getSnapshot()[0].id,rb.id);assert.equal(b.withNative(rb.id,d=>d===download),true);
 await b.dispose();assert.equal(views.size,0);
});
