import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const version=JSON.parse(readFileSync(new URL("../theme.json",import.meta.url),"utf8")).version;
const source=readFileSync(new URL("../src/core/diagnostics.js.part",import.meta.url),"utf8");
function fixture({isPrivate=false,on=true,prior=null,failWrite=false,writeHook=()=>{},removeFails=false}={}){
 let time=0,serial=0,enabled=on,unload;const timers=new Map(),frames=new Map(),logs=[],writes=[],listeners=new Map();
 const attrs=new Map(),root={hasAttribute:k=>attrs.has(k),getAttribute:k=>attrs.get(k)??null};
 const doc={documentElement:root,getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]};
 const win={performance:{now:()=>time},innerWidth:1200,innerHeight:800,PrivateBrowsingUtils:{isWindowPrivate:()=>isPrivate},console:{info:s=>logs.push(s),warn:s=>logs.push(s)},addUnloadListener(fn){unload=fn;},
 MutationObserver:class{observe(){}disconnect(){}},addEventListener(k,f){listeners.set(k,f);},removeEventListener(k){if(removeFails)throw Error("injected remove failure");listeners.delete(k);},
 setTimeout(f,ms){const id=++serial;timers.set(id,{f,ms});return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame(f){const id=++serial;frames.set(id,f);return id;},cancelAnimationFrame:id=>frames.delete(id),
 __nocturneEarlyTrace:[{event:"assembly.script",t:0,data:{version:"0.3.0-preview.19"}}]};
 const io={readUTF8:async()=>writes.at(-1)?.data??JSON.stringify(prior),makeDirectory:async()=>{},getChildren:async()=>[],writeUTF8:async(path,data)=>{if(failWrite)throw Error("injected write failure");writeHook(data);writes.push({path,data});}};
 const paths={profileDir:"profile",join:(...p)=>p.join("/"),filename:p=>p.split("/").at(-1)};
 const reload=()=>{new Function("window","document","Services","IOUtils","PathUtils",source)(win,doc,{prefs:{getBoolPref:()=>enabled},wm:{getEnumerator(){let sent=false;return {hasMoreElements:()=>!sent,getNext:()=>{sent=true;return win;}};}}},io,paths);return win.__nocturneDiagnostics;};
 reload();
 return {reload,win,timers,frames,logs,writes,listeners,attrs,unload:()=>unload(),setTime:t=>time=t,disable:()=>enabled=false,api:win.__nocturneDiagnostics};
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
