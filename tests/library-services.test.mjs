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
