import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/core/diagnostics.js.part",import.meta.url),"utf8");
function fixture({isPrivate=false,on=true}={}){
 let time=0,serial=0,enabled=on;const timers=new Map(),frames=new Map(),logs=[],writes=[],listeners=new Map();
 const root={hasAttribute:()=>false,getAttribute:()=>null};
 const doc={documentElement:root,getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]};
 const win={performance:{now:()=>time},innerWidth:1200,innerHeight:800,PrivateBrowsingUtils:{isWindowPrivate:()=>isPrivate},console:{info:s=>logs.push(s),warn:s=>logs.push(s)},addUnloadListener(){},
 MutationObserver:class{observe(){}disconnect(){}},addEventListener(k,f){listeners.set(k,f);},removeEventListener(k){listeners.delete(k);},
 setTimeout(f,ms){const id=++serial;timers.set(id,{f,ms});return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame(f){const id=++serial;frames.set(id,f);return id;},cancelAnimationFrame:id=>frames.delete(id),
 __nocturneEarlyTrace:[{event:"assembly.script",t:0,data:{version:"0.3.0-preview.8"}}]};
 const io={makeDirectory:async()=>{},getChildren:async()=>[],writeUTF8:async(path,data)=>writes.push({path,data})};
 const paths={profileDir:"profile",join:(...p)=>p.join("/"),filename:p=>p.split("/").at(-1)};
 new Function("window","document","Services","IOUtils","PathUtils",source)(win,doc,{prefs:{getBoolPref:()=>enabled}},io,paths);
 return {win,timers,frames,logs,writes,listeners,setTime:t=>time=t,disable:()=>enabled=false,api:win.__nocturneDiagnostics};
}
test("recorder keeps ordered events, early markers, lazy detail and bounded ring",async()=>{
 const f=fixture();const trace=f.win.__nocturneTrace;
 let evaluated=0;trace("drag",()=>({p:++evaluated}),{throttle:100});f.setTime(10);trace("drag",()=>({p:++evaluated}),{throttle:100});
 assert.equal(evaluated,1);f.setTime(120);trace("drag",()=>({p:++evaluated}),{throttle:100});
 assert.equal(evaluated,2);
 const early=JSON.parse(f.api.dump());assert.ok(early.events.some(e=>e.event==="assembly.script"));
 for(let i=0;i<1700;i++)trace("bounded",{i});
 const data=JSON.parse(f.api.dump());assert.equal(data.events.length,1600);assert.ok(data.dropped>0);
 assert.ok(data.events.every((e,i)=>i===0||e.n>data.events[i-1].n));
 await f.api.flush();assert.ok(f.writes.length>0);f.api.dispose();assert.equal(f.win.__nocturneTrace,undefined);assert.equal(f.frames.size,0);
});
test("disabled recording never evaluates detail and private recording never writes files",async()=>{
 const f=fixture({isPrivate:true});f.win.__nocturneTrace("private",{count:1});await f.api.flush();assert.equal(f.writes.length,0);
 let count=0;f.disable();f.win.__nocturneTrace("disabled",()=>++count);assert.equal(count,0);f.api.dispose();assert.equal(f.timers.size,0);
});
test("recorder is included at start of layout, versioned and avoids content fields",()=>{
 const layout=readFileSync(new URL("../layout.uc.mjs",import.meta.url),"utf8");
 assert.ok(layout.startsWith(source));assert.ok(source.includes("0.3.0-preview.8"));
 for(const forbidden of ["currentURI","contentDocument","contentWindow","documentURI","textContent","\.label","\.title"])assert.ok(!source.includes(forbidden),forbidden);
});
