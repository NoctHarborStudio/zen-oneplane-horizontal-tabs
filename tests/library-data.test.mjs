import test from "node:test";
import assert from "node:assert/strict";
import {createLibraryData,libraryWebURL,libraryHistoryCommand} from "../src/library/data.mjs";
import {createClosedTabsService} from "../src/services/closed-tabs-service.mjs";
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
 let services,closed=0,off=0,changes=[],requests=[],results=[],errors=0,timers=new Map(),serial=0;
 const query=args=>new Promise(resolve=>requests.push({args,resolve}));
 services={openHistory(fn){changes.push(fn);return {query,close(){closed++;}};},closedTabs:{query,subscribe(fn){changes.push(fn);return()=>off++;}}};
 const data=createLibraryData({getServices:()=>services,onResult:r=>results.push(r),onError:()=>errors++,schedule:fn=>{timers.set(++serial,fn);return serial;},cancel:id=>timers.delete(id)});
 return {data,requests,results,changes,counts:()=>[closed,off,errors],flush(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}},replace(){services={};}};
}
test("section switches cancel queries and release exact native session",async()=>{
 const f=fixture();f.data.start("history");f.data.start("closed");
 assert.deepEqual(f.counts(),[1,0,0]);
 f.requests[0].resolve({rows:["old"]});f.requests[1].resolve({rows:["new"]});await tick();
 assert.deepEqual(f.results,[{rows:["new"]}]);f.data.stop();assert.deepEqual(f.counts(),[1,1,0]);
});
test("search invalidates pending results immediately, debounces and resets page",async()=>{
 const f=fixture();f.data.start("history");f.data.search("a");f.data.search("ab");f.requests[0].resolve({rows:["stale"]});await tick();assert.deepEqual(f.results,[]);
 f.flush();assert.equal(f.requests.length,2);assert.deepEqual(f.requests[1].args,{text:"ab",limit:50});
 f.data.more();assert.equal(f.requests[2].args.limit,100);f.data.search("abc",true);assert.deepEqual(f.requests[3].args,{text:"abc",limit:50});
 f.requests[3].resolve({rows:["current"]});await tick();assert.deepEqual(f.results,[{rows:["current"]}]);f.data.dispose();
});
test("same-section reopen ignores old observer and service replacement suppresses result",async()=>{
 const f=fixture();f.data.start("history");f.data.start("history");f.changes[0]();f.flush();assert.equal(f.requests.length,2);
 f.replace();f.requests[1].resolve({rows:["stale"]});await tick();assert.deepEqual(f.results,[]);f.data.dispose();
});
test("bounded pagination and no queries on other sections",()=>{
 const f=fixture();assert.equal(f.data.start("unsupported"),false);assert.equal(f.requests.length,0);f.data.start("closed");
 for(let i=0;i<9;i++)assert.equal(f.data.more(),true);assert.equal(f.data.more(),false);assert.equal(f.requests.at(-1).args.limit,500);f.data.dispose();
});
test("history URL rejects privileged, local, credential and executable schemes",()=>{
 assert.equal(libraryWebURL("https://example.com"),"https://example.com/");
 for(const url of ["javascript:alert(1)","data:text/html,x","file:///tmp/a","about:config","chrome://browser/content/browser.xhtml","https://user:pass@example.com","not a URL"])assert.equal(libraryWebURL(url),null);
});
test("native command routing recognizes only history command IDs and unhandled events",()=>{
 for(const id of ["Browser:ShowAllHistory","key_gotoHistory"])assert.equal(libraryHistoryCommand({target:{id}}),true);
 assert.equal(libraryHistoryCommand({target:{id:"Tools:Downloads"}}),false);
 assert.equal(libraryHistoryCommand({target:{id:"key_gotoHistory"},defaultPrevented:true}),false);
});
test("closed tab restore revalidates exact native id and privacy at action time",()=>{
 let entries=[{closedId:12}],calls=[],allowed=true;
 const s=createClosedTabsService({getClosed:()=>entries,restoreNative:(id,bg)=>calls.push([id,bg]),allowed:()=>allowed});
 assert.equal(s.restore(12,{background:true}),true);entries=[];assert.equal(s.restore(12),false);entries=[{closedId:12}];allowed=false;assert.equal(s.restore(12),false);
 assert.deepEqual(calls,[[12,true]]);s.dispose();assert.equal(s.restore(12),false);
});
