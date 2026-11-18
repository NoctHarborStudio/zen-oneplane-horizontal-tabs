import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const version=JSON.parse(readFileSync(new URL("../theme.json",import.meta.url),"utf8")).version;
const source=readFileSync(new URL("../src/core/diagnostics.js.part",import.meta.url),"utf8");
function fixture({isPrivate=false,on=true,prior=null,failWrite=false,writeHook=()=>{},removeFails=false,standalone=false,shared=null,anchor=null,peers=[]}={}){
 let time=0,serial=0,enabled=on,unload;const timers=new Map(),frames=new Map(),logs=[],writes=[],listeners=new Map();
 const attrs=new Map(),root={hasAttribute:k=>attrs.has(k),getAttribute:k=>attrs.get(k)??null};
 const doc={documentElement:root,getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]};
 const win={performance:{now:()=>time},innerWidth:1200,innerHeight:800,PrivateBrowsingUtils:{isWindowPrivate:()=>isPrivate},console:{info:s=>logs.push(s),warn:s=>logs.push(s)},addUnloadListener(fn){unload=fn;},
 MutationObserver:class{observe(){}disconnect(){}},addEventListener(k,f){listeners.set(k,f);},removeEventListener(k){if(removeFails)throw Error("injected remove failure");listeners.delete(k);},
 setTimeout(f,ms){const id=++serial;timers.set(id,{f,ms});return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame(f){const id=++serial;frames.set(id,f);return id;},cancelAnimationFrame:id=>frames.delete(id),
 __nocturneEarlyTrace:[{event:"assembly.script",t:0,data:{version:"0.3.0-preview.19"}}]};
 const io=shared?.io||{readUTF8:async()=>writes.at(-1)?.data??JSON.stringify(prior),makeDirectory:async()=>{},getChildren:async()=>[],writeUTF8:async(path,data)=>{if(failWrite)throw Error("injected write failure");writeHook(data);writes.push({path,data});}};
 const paths={profileDir:"profile",join:(...p)=>p.join("/"),filename:p=>p.split("/").at(-1)};
 const components=standalone?{utils:{Sandbox:()=>({}),evalInSandbox:code=>new Function("IOUtils","PathUtils","TextEncoder","return "+code)(io,paths,TextEncoder)}}:undefined;
 const chrome=anchor?{importESModule:()=>({BrowserWindowTracker:anchor})}:undefined;
 if(shared?.store)win.__nocturneDiagnosticStore=shared.store;
 const reload=()=>{new Function("window","document","Services","IOUtils","PathUtils","Components","ChromeUtils","TextEncoder",source)(win,doc,{scriptSecurityManager:{getSystemPrincipal:()=>({})},prefs:{getBoolPref:()=>enabled},wm:{getEnumerator(){let i=0;const windows=[win,...peers];return {hasMoreElements:()=>i<windows.length,getNext:()=>windows[i++]};}}},io,paths,components,chrome,TextEncoder);return win.__nocturneDiagnostics;};
 reload();
 return {reload,win,timers,frames,logs,writes,io,listeners,attrs,unload:()=>unload(),setTime:t=>time=t,disable:()=>enabled=false,api:win.__nocturneDiagnostics};
}
test("recorder keeps ordered events, early markers, lazy detail and bounded ring",async()=>{
 const f=fixture();const trace=f.win.__nocturneTrace;
 let evaluated=0;trace("drag",()=>({p:++evaluated}),{throttle:100});f.setTime(10);trace("drag",()=>({p:++evaluated}),{throttle:100});
 assert.equal(evaluated,1);f.setTime(120);trace("drag",()=>({p:++evaluated}),{throttle:100});
 assert.equal(evaluated,2);
 const early=JSON.parse(f.api.dump());assert.ok(early.events.some(e=>e.event==="assembly.script"));
 for(let i=0;i<3300;i++)trace("bounded",{i});
 const data=JSON.parse(f.api.dump());assert.equal(data.events.length,3200);assert.ok(data.dropped>0);assert.ok(data.startup.some(e=>e.event==="assembly.script"));
 assert.ok(data.events.every((e,i)=>i===0||e.n>data.events[i-1].n));
 await f.api.flush();assert.ok(f.writes.length>0);assert.ok(f.writes.every(w=>w.path.endsWith('/nocturne-diagnostics.json')));assert.equal(JSON.parse(f.writes.at(-1).data).schema,2);assert.ok(f.writes.at(-1).data.includes('\n  '));f.api.dispose();assert.equal(f.win.__nocturneTrace,undefined);assert.equal(f.frames.size,0);
});
test("disabled recording never evaluates detail and private recording never writes files",async()=>{
 const f=fixture({isPrivate:true});f.win.__nocturneTrace("private",{count:1});await f.api.flush();assert.equal(f.writes.length,0);
 let count=0;f.disable();f.win.__nocturneTrace("disabled",()=>++count);assert.equal(count,0);f.api.dispose();assert.equal(f.timers.size,0);
});
test("recorder is included at start of layout, versioned and avoids content fields",()=>{
 const layout=readFileSync(new URL("../layout.uc.mjs",import.meta.url),"utf8");
 const prelude=readFileSync(new URL("../src/core/boot-prelude.js.part",import.meta.url),"utf8");
 assert.ok(layout.startsWith(prelude+source));assert.ok(source.includes(version));
 for(const forbidden of ["currentURI","contentDocument","contentWindow","documentURI","textContent","\.label","\.title"])assert.ok(!source.includes(forbidden),forbidden);
});

test("persist retains three most recent sessions by creation and trims each independently",async()=>{
 const prior={schema:2,sessions:[1,2,3,4].map(started=>({window:"old"+started,started,updated:100-started,dropped:0,startup:[{event:"assembly.script"}],events:Array.from({length:1800},()=>({event:"sample",data:"я".repeat(500)}))}))};
 const f=fixture({prior});
 for(let i=0;i<3200;i++)f.win.__nocturneTrace("bounded",{data:"я".repeat(180)});
 await f.api.flush();
 const sessions=JSON.parse(f.writes.at(-1).data).sessions;
 assert.equal(sessions.length,3);
 assert.deepEqual(sessions.slice(0,2).map(s=>s.started),[3,4]);
 assert.ok(sessions.every(s=>s.events.length>0&&s.dropped>0&&s.startup.length>0));
 assert.ok(new TextEncoder().encode(f.writes.at(-1).data).length<=2000000);
});

test("cold assembly keeps frame telemetry without expensive style snapshots",()=>{
 const f=fixture();f.attrs.set("data-zr-startup-phase","playing");
 const sample=[...f.timers.values()].find(x=>x.ms===50);assert.ok(sample);sample.f();
 const data=JSON.parse(f.api.dump());const event=data.events.filter(e=>e.event==="sample").at(-1);
 assert.equal(event.data.light,true);assert.deepEqual(event.data.metrics,{});assert.ok(event.data.frame);assert.equal(event.data.root["data-zr-startup-phase"],"playing");
 f.api.dispose();
});

test("Sine teardown quiesces active resources and retains later synchronous producer events",async()=>{
 const f=fixture();await f.api.flush();f.unload();
 assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);assert.equal(f.listeners.size,0);
 f.win.__nocturneTrace("layout.cleanup.end",{failedSteps:0},{sample:1000,flush:true});
 assert.equal(f.frames.size,0);
 await Promise.resolve();assert.equal(f.win.__nocturneTrace,undefined);
 await f.api.flush();
 const saved=JSON.parse(f.writes.at(-1).data).sessions.at(-1).events;
 assert.ok(saved.some(e=>e.event==="layout.cleanup.end"));
 assert.equal(saved.at(-1).event,"diagnostics.dispose");
});
test("coalesced flush reports actual write failure",async()=>{
 const f=fixture({failWrite:true});
 assert.equal(await f.api.flush(),false);
 f.win.__nocturneTrace("terminal",{count:1});
 const first=f.api.flush(),second=f.api.flush();
 assert.equal(await first,false);assert.equal(await second,false);f.api.dispose();
});
test("oversize startup archive cannot consume the entire file budget",async()=>{
 const prior={schema:2,sessions:[{window:"old",started:1,dropped:0,startup:Array.from({length:100},()=>({event:"assembly.script",data:"я".repeat(12000)})),events:[{event:"terminal",data:{count:1}}]}]};
 const f=fixture({prior});await f.api.flush();
 const saved=JSON.parse(f.writes.at(-1).data).sessions[0];
 assert.ok(saved.startupDropped>0);assert.ok(saved.startup.length>0);
 assert.equal(saved.events.at(-1).event,"terminal");
 assert.ok(new TextEncoder().encode(f.writes.at(-1).data).length<=2000000);
 f.api.dispose();
});

test("same-window recorder reload shares pending writes and retains both sessions",async()=>{
 const f=fixture(),old=f.api;const store=f.win.__nocturneDiagnosticStore;
 f.win.__nocturneTrace("old.pending",{count:1});
 old.requestDispose();
 const next=f.reload();
 assert.equal(f.win.__nocturneDiagnosticStore,store);
 f.win.__nocturneTrace("replacement.pending",{count:2});
 await old.flush();await next.flush();
 const sessions=JSON.parse(f.writes.at(-1).data).sessions;
 assert.equal(sessions.length,2);
 assert.ok(sessions.some(s=>s.events.some(e=>e.event==="old.pending")));
 assert.ok(sessions.some(s=>s.events.some(e=>e.event==="replacement.pending")));
 assert.equal(f.win.__nocturneDiagnostics,next);next.dispose();
});
test("all coalesced flush callers join the failing follow-up write",async()=>{
 const f=fixture({writeHook:data=>{if(data.includes('"followup.failure"'))throw Error("injected follow-up failure");}});
 await f.api.flush();
 f.win.__nocturneTrace("first.write",{count:1});const first=f.api.flush();
 f.win.__nocturneTrace("followup.failure",{count:2});
 const a=f.api.flush(),b=f.api.flush();
 assert.equal(await first,true);assert.equal(await a,false);assert.equal(await b,false);f.api.dispose();
});
test("failed listener removal cannot re-arm diagnostic sampling",async()=>{
 const f=fixture({removeFails:true});
 const stale=f.listeners.get("resize");assert.ok(stale);
 f.unload();stale();assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
 await Promise.resolve();await f.api.flush();
 const events=JSON.parse(f.writes.at(-1).data).sessions.at(-1).events;
 assert.ok(events.some(e=>e.event==="diagnostics.quiesce"&&e.data.failed>0));
 assert.ok(!events.some(e=>e.event==="event.resize"));
});

test("terminal snapshot enters independent writer before pending write completes",async()=>{
 const f=fixture({standalone:true});await f.api.flush();
 const original=f.io.writeUTF8;let resolve,entered;const held=new Promise(r=>resolve=r),started=new Promise(r=>entered=r);
 let first=true;f.io.writeUTF8=async(...args)=>{if(first){first=false;entered();await held;}return original(...args);};
 f.win.__nocturneTrace("preclose",{count:1},{flush:true});await started;
 f.unload();f.win.__nocturneTrace("layout.cleanup.end",{failedSteps:0});
 await Promise.resolve();assert.equal(f.win.__nocturneTrace,undefined);
 const writer=f.win.__nocturneDiagnosticStore;
 // Do not call producer flush after simulated destruction: join the
 // writer directly, with a later unrelated session as a queue barrier.
 resolve();await writer.submit(JSON.stringify({schema:2,version,window:"barrier",started:Date.now()+1,events:[],startup:[]}));
 const events=JSON.parse(f.writes.at(-1).data).sessions.find(s=>s.window!=="barrier").events;
 assert.equal(events.find(e=>e.event==="diagnostics.ready").data.writer,"independent");
 assert.ok(events.some(e=>e.event==="layout.cleanup.end"));assert.equal(events.at(-1).event,"diagnostics.dispose");
});
test("writer retains latest queued snapshot per session and bounds queued sessions",async()=>{
 const f=fixture({standalone:true});await f.api.flush();const writer=f.win.__nocturneDiagnosticStore;
 const original=f.io.writeUTF8;let release,entered;const held=new Promise(r=>release=r),started=new Promise(r=>entered=r);let first=true;
 f.io.writeUTF8=async(...args)=>{if(first){first=false;entered();await held;}return original(...args);};
 const submit=(id,n)=>writer.submit(JSON.stringify({schema:2,version,window:"test"+id,started:id,events:[{n,event:"test"}],startup:[]}));
 const a=submit(1,1);await started;const b=submit(2,1),b2=submit(2,2);assert.equal(b,b2);
 const c=submit(3,1),d=submit(4,1),e=submit(5,1);assert.equal(await b,false);
 release();await Promise.all([a,c,d,e]);const sessions=JSON.parse(f.writes.at(-1).data).sessions;
 assert.equal(sessions.length,3);assert.ok(!sessions.some(s=>s.window==="test2"));assert.ok(sessions.some(s=>s.window==="test5"));
});
test("process anchor reuses independent writer after zero-window interval; private cannot submit",async()=>{
 const anchor={},a=fixture({standalone:true,anchor});await a.api.flush();const store=a.win.__nocturneDiagnosticStore;
 a.api.dispose();await a.api.flush();
 const b=fixture({standalone:true,anchor,shared:{io:a.io}});assert.equal(b.win.__nocturneDiagnosticStore,store);
 b.win.__nocturneTrace("second.window",{count:2},{flush:true});await b.api.flush();
 const p=fixture({isPrivate:true,standalone:true,anchor,shared:{io:a.io}});p.win.__nocturneTrace("private.forbidden",{count:1},{flush:true});await p.api.flush();p.api.dispose();
 const sessions=JSON.parse(a.writes.at(-1).data).sessions;assert.equal(sessions.length,2);assert.ok(sessions.some(s=>s.events.some(e=>e.event==="second.window")));assert.ok(!JSON.stringify(sessions).includes("private.forbidden"));
 assert.equal(JSON.parse(b.api.dump()).events.find(e=>e.event==="diagnostics.ready").data.writer,"process");
});
test("legacy store is not replaced by a competing file writer",async()=>{
 const store={tail:Promise.resolve(),sessions:null},f=fixture({standalone:true,shared:{store}});
 assert.equal(f.win.__nocturneDiagnosticStore,store);assert.equal(await f.api.flush(),false);assert.equal(f.writes.length,0);
 assert.equal(JSON.parse(f.api.dump()).events.find(e=>e.event==="diagnostics.ready").data.writer,"legacy-blocked");
});

test("legacy peer blocks a modern alias regardless of enumeration order",async()=>{
 const anchor={},a=fixture({standalone:true,anchor});await a.api.flush();
 const legacy={tail:Promise.resolve(),sessions:null},peer={__nocturneDiagnosticStore:legacy};
 for(const shared of [null,{store:a.win.__nocturneDiagnosticStore}]){
  const f=fixture({standalone:true,anchor,shared,peers:[a.win,peer]});
  assert.equal(f.win.__nocturneDiagnosticStore,legacy);
  assert.equal(JSON.parse(f.api.dump()).events.find(e=>e.event==="diagnostics.ready").data.writer,"legacy-blocked");
  assert.equal(await f.api.flush(),false);assert.equal(f.writes.length,0);f.api.dispose();
 }
 a.api.dispose();await a.api.flush();
});
test("distinct modern peer queues block rather than silently switching owners",async()=>{
 const a=fixture({standalone:true}),b=fixture({standalone:true});
 await Promise.all([a.api.flush(),b.api.flush()]);
 const anchor={},f=fixture({standalone:true,anchor,peers:[a.win,b.win]});
 assert.equal(JSON.parse(f.api.dump()).events.find(e=>e.event==="diagnostics.ready").data.writer,"conflict-blocked");
 assert.equal(await f.api.flush(),false);assert.equal(f.writes.length,0);
 assert.equal(anchor[Symbol.for("nocturne.diagnostics.writer.v1")],undefined);
 f.api.dispose();a.api.dispose();b.api.dispose();await Promise.all([a.api.flush(),b.api.flush()]);
});
test("reentrant lazy detail commits events in monotonic sequence and time",()=>{
 const f=fixture();f.setTime(10);
 f.win.__nocturneTrace("outer",()=>{f.setTime(20);f.win.__nocturneTrace("inner");f.setTime(30);return {};});
 const events=JSON.parse(f.api.dump()).events;
 assert.deepEqual(events.slice(-2).map(e=>e.event),["inner","outer"]);
 assert.ok(events.every((e,i)=>i===0||e.n>events[i-1].n&&e.t>=events[i-1].t));
 f.api.dispose();
});
test("lazy detail cannot append after synchronous dispose or disable",async()=>{
 const a=fixture();a.win.__nocturneTrace("late",()=>{a.api.dispose();return {};});
 const events=JSON.parse(a.api.dump()).events;
 assert.equal(events.at(-1).event,"diagnostics.dispose");assert.ok(!events.some(e=>e.event==="late"));
 await a.api.flush();
 const b=fixture();b.win.__nocturneTrace("disabled.during.detail",()=>{b.disable();return {};});
 assert.ok(!JSON.parse(b.api.dump()).events.some(e=>e.event==="disabled.during.detail"));
 b.api.dispose();
});
