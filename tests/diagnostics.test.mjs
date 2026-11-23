import test from "node:test";
import assert from "node:assert/strict";
import {createClosedTabsService} from "../src/services/closed-tabs-service.mjs";
import {nocturneErrorClass} from "../src/core/error-class.mjs";
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
 return {reload,win,doc,timers,frames,logs,writes,io,listeners,attrs,unload:()=>unload(),setTime:t=>time=t,disable:()=>enabled=false,api:win.__nocturneDiagnostics};
}
test("NC4-089-R7 restricts native error classes without reading messages",()=>{
 const secret="https://private.example/tab?query=account&token=confidential";
 for(const [name,wanted] of [
   ["TypeError","TypeError"],["DOMException","DOMException"],["WorkspaceCommandError","WorkspaceCommandError"],
   ["NS_ERROR_FAILURE","NS_ERROR_FAILURE"],["AccountTokenError","Error"],["private.example","Error"],[123,"Error"]
 ]){
   const input={name,get message(){throw new Error("Unexpected access to "+secret);},get stack(){throw new Error("stack access");}};
   assert.equal(nocturneErrorClass(input),wanted,String(name));
 }
 assert.equal(nocturneErrorClass(null),"Error");
 assert.equal(nocturneErrorClass({get name(){throw new Error(secret);}}),"Error");
 assert.equal(nocturneErrorClass(new TypeError(secret)),"TypeError");
});

test("NC4-089-R7 real Home subscriber catch and Hub status do not leak native errors",()=>{
 const secret="https://private.example/tab?query=account&token=confidential";
 const home=readFileSync(new URL("../src/home/shared-home.js.part",import.meta.url),"utf8");
 const hub=readFileSync(new URL("../src/hub/controller.js.part",import.meta.url),"utf8");
 const line=home.split("\n").find(x=>x.includes("  function notify(){"));
 assert.ok(line&&line.includes("nocturneErrorClass(error)"));
 const logs=[],win={console:{warn:(...args)=>logs.push(args)}};
 const notify=new Function("win","nocturneErrorClass","listeners",
  "const leases=new Set([{listeners:new Set(listeners)}]);const open=true;"+line+";return notify;")(
  win,nocturneErrorClass,[()=>{throw new TypeError(secret);}]);
 notify();
 assert.deepEqual(logs,[["[Zen Home] subscriber","TypeError"]]);
 assert.ok(!JSON.stringify(logs).includes(secret));
 assert.ok(!hub.includes("String(error.message||error)"));
 assert.ok(!hub.includes('error?.code==="data-busy"?error.message:'));
 assert.ok(hub.includes('status.textContent="Workspace command could not be completed."'));
 assert.ok(hub.includes('error?.code==="data-busy"?"Another native Workspace data command is pending."'));
 for(const path of [
  "src/core/bootstrap.js.part","src/core/window-lifecycle.js.part","src/home/shared-home.js.part",
  "src/hub/controller.js.part","src/interactions/drag-controller.js.part","src/interactions/drag-end.js.part",
  "src/interactions/display-engine.js.part","src/interactions/startup-search.js.part","src/toolbar/address-controller.js.part"
 ]){
  const code=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  const lines=code.split("\n").filter(x=>/\bconsole\.(?:warn|error)\(/.test(x)&&/\berror\b/.test(x));
  assert.ok(lines.length>0,path);
  for(const l of lines)assert.ok(l.includes("nocturneErrorClass(error)"),path+": "+l);
 }
 const layout=readFileSync(new URL("../layout.uc.mjs",import.meta.url),"utf8");
 assert.ok(layout.includes("const NOCTURNE_EXCEPTION_CLASSES=new Set("));
 assert.ok(layout.includes('status.textContent="Workspace command could not be completed."'));
});

test("NC4-089-R5 enforces source-declared event-specific reasons and statuses",()=>{
 const f=fixture(),trace=f.win.__nocturneTrace;
 const library=readFileSync(new URL("../src/library/controller.js.part",import.meta.url),"utf8");
 const media=readFileSync(new URL("../src/services/media-service.mjs",import.meta.url),"utf8");
 const data=readFileSync(new URL("../src/library/data.mjs",import.meta.url),"utf8");
 const transfer=readFileSync(new URL("../src/services/library-services-runtime.js.part",import.meta.url),"utf8");
 const progress=readFileSync(new URL("../page-progress.uc.mjs",import.meta.url),"utf8");
 for(const reason of ["busy","disabled","section","startup","window","overlay-missing","services-missing","exception","mount","geometry","overlay-busy","surface-hidden"]){
   assert.ok(library.includes('fail("'+reason+'")'),reason);
   trace("library.open.rejected",{reason});
   assert.equal(JSON.parse(f.api.dump()).events.at(-1).data.reason,reason);
 }
 for(const status of ["deadline","late-complete","late-error"]){
   assert.ok(data.includes('onScanWait("'+status+'")'));
   trace("library.media.scan.wait",{status});
   assert.equal(JSON.parse(f.api.dump()).events.at(-1).data.status,status);
 }
 for(const status of ["committed","error"]){
   assert.ok(media.includes('report(section,"'+status+'"'));
   trace("library.media.refresh",{status});
   assert.equal(JSON.parse(f.api.dump()).events.at(-1).data.status,status);
 }
 for(const reason of ["ineligible","file-unavailable","payload-written","native-error"]){
   assert.ok(transfer.includes('report("'+reason+'"'));
   trace("downloads.native.transfer",{reason});
   assert.equal(JSON.parse(f.api.dump()).events.at(-1).data.reason,reason);
 }
 for(const reason of ["overlap-start","stale-stop"]){
   assert.ok(progress.includes('reason:"'+reason+'"'));
   trace("page-progress.network",{reason});
   assert.equal(JSON.parse(f.api.dump()).events.at(-1).data.reason,reason);
 }
 for(const [event,field] of [
   ["library.open.rejected","reason"],["library.shortcut","reason"],
   ["library.media.scan.wait","status"],["library.media.refresh","status"],
   ["downloads.native.transfer","reason"],["downloads.drag.payload","reason"],
   ["home.search.close-start","reason"],["home.search.close-finish","reason"],
   ["home.search.snapshot-unavailable","reason"],["page-progress.network","reason"],
   ["library.file.drag.recovered","reason"],["library.surface.fallback","reason"],
   ["center.bloom.fallback","reason"],["center.motion.skip","reason"],["center.fold.reject","reason"]
 ]){
   trace(event,{[field]:"personal-workspace-token"});
   assert.equal(JSON.parse(f.api.dump()).events.at(-1).data[field],null,event);
 }
 assert.ok(!f.api.dump().includes("personal-workspace-token"));
 assert.ok(f.logs.every(s=>!s.includes("personal-workspace-token")));
 f.api.dispose();
});
test("NC4-089-R5 Home Search console cannot echo unfiltered event fields",()=>{
 const f=fixture(),home=readFileSync(new URL("../src/home/shared-home.js.part",import.meta.url),"utf8");
 const start=home.indexOf("  function searchLog("),end=home.indexOf("  // A card starts appearing",start);
 assert.ok(start>=0&&end>start);
 const searchLog=new Function("win",home.slice(start,end)+";return searchLog;")(f.win);
 searchLog("close-start",{reason:"private-workspace-token",query:"sensitive search phrase"});
 searchLog("snapshot-unavailable",{name:"PrivateAccount",reason:"personal-workspace-token"});
 searchLog("snapshot-unavailable",{name:"TypeError"});
 const events=JSON.parse(f.api.dump()).events;
 assert.equal(events.at(-3).data.reason,null);
 assert.equal(events.at(-2).data.name,null);
 assert.equal(events.at(-2).data.reason,null);
 assert.equal(events.at(-1).data.name,"TypeError");
 for(const secret of ["private-workspace-token","personal-workspace-token","sensitive search phrase","PrivateAccount"])
   assert.ok(!f.api.dump().includes(secret)&&f.logs.every(s=>!s.includes(secret)),secret);
 f.api.dispose();
});

test("NC4-089-R4 Closed Tabs native observer errors retain class without private message",()=>{
 const f=fixture();
 const code=readFileSync(new URL("../src/services/library-services-runtime.js.part",import.meta.url),"utf8");
 const start=code.indexOf('onError:(resource,error)=>trace("library.scope.error"');
 const end=code.indexOf("),getClosed:",start);
 assert.ok(start>=0&&end>start,"extract actual service producer, not a test-only imitation");
 const callbackSource=code.slice(start+"onError:".length,end+1);
 const onError=new Function("trace","return "+callbackSource)((event,data)=>f.win.__nocturneTrace(event,data));
 const service=createClosedTabsService({getClosed:()=>[],observe:()=>()=>{throw new TypeError("sensitive-raw-error-message");},onError});
 service.subscribe(()=>{});
 assert.deepEqual(service.dispose(),{released:0,failed:1});
 const saved=JSON.parse(f.api.dump()).events.find(e=>e.event==="library.scope.error");
 assert.ok(saved);
 assert.deepEqual(saved.data,{owner:"closed-tabs",resource:"closed-tabs-observer",name:"TypeError"});
 assert.ok(!f.api.dump().includes("sensitive-raw-error-message"));
 assert.ok(f.logs.every(log=>!log.includes("sensitive-raw-error-message")));
 f.api.dispose();
});

test("NC4-089-R3 restores finite Workspace error codes from source producers",()=>{
 const f=fixture(),trace=f.win.__nocturneTrace;
 const command=readFileSync(new URL("../src/core/workspace-commands.mjs",import.meta.url),"utf8");
 const hub=readFileSync(new URL("../src/hub/controller.js.part",import.meta.url),"utf8");
 const codes=new Set([...command.matchAll(/workspaceCommandError\(["']([^"']+)["']/g),
   ...hub.matchAll(/workspaceCommandError\(["']([^"']+)["']/g)].map(m=>m[1]));
 for(const code of ["selection-unverified","selection-mismatch","inspection-error","return-unavailable","return-target","return-unverified"])codes.add(code);
 for(const code of codes)trace("workspace.command.end",{code,ok:false});
 const events=JSON.parse(f.api.dump()).events.filter(e=>e.event==="workspace.command.end");
 assert.equal(events.length,codes.size);
 assert.deepEqual(events.map(e=>e.data.code),[...codes]);
 trace("workspace.command.end",{code:"profile-secret",ok:false});
 assert.equal(JSON.parse(f.api.dump()).events.at(-1).data.code,null);
 f.api.dispose();
});
test("NC4-089-R3 preserves only known chrome attribute names and lifecycle states",()=>{
 const f=fixture();
 f.win.__nocturneTrace("chrome.attributes",[
   {node:"root",attr:"data-zr-startup-phase",value:"playing"},
   {node:"root",attr:"data-op-startup-ready",value:"pending"},
   {node:"root",attr:"oneplane-active",value:"true"},
   {node:"root",attr:"data-op-startup-ready",value:"user-secret"},
   {node:"root",attr:"data-op-startup-ready",value:""},
   {node:"root",attr:"data-op-startup-ready",value:null},
   {node:"root",attr:"data-op-dragging",value:"true"},
   {node:"unrecognized-node",attr:"data-op-startup-ready",value:"true"},
   {node:"root",attr:"url",value:"https://example.org"},
   {node:"root",attr:"data-op-startup-ready",value:"https://example.org/private"}
 ]);
 const last=JSON.parse(f.api.dump()).events.at(-1);
 assert.equal(last.event,"chrome.attributes");
 assert.deepEqual(last.data,[
   {node:"root",attr:"data-zr-startup-phase",value:"playing"},
   {node:"root",attr:"data-op-startup-ready",value:"pending"},
   {node:"root",attr:"oneplane-active",value:"true"},
   {node:"root",attr:"data-op-startup-ready",value:null},
   {node:"root",attr:"data-op-startup-ready",value:""},
   {node:"root",attr:"data-op-startup-ready",value:null},
   {node:"root",attr:"data-op-startup-ready",value:null}
 ]);
 assert.ok(!f.api.dump().includes("user-secret"));
 assert.ok(!f.api.dump().includes("example.org"));
 assert.ok(f.logs.every(s=>!s.includes("user-secret")&&!s.includes("example.org")));
 f.api.dispose();
});
test("NC4-089-R3 restores bounded Popup Bunny CSS evidence without private text",()=>{
 const f=fixture(),trace=f.win.__nocturneTrace;
 trace("downloads.drag.popup-shown",{state:"open",via:"watch",surface:{
   background:"rgb(42, 42, 42)",appearance:"-moz-panel",opacity:"1",radius:"3px",
   stage:"rgba(0, 0, 0, 0)",part:"rgb(255, 255, 255)",panelBackground:"rgb(24, 24, 24)",flip:"both"
 }});
 trace("downloads.drag.start",{os:"Linux",seed:[320,48]});
 const events=JSON.parse(f.api.dump()).events;
 const popup=events.find(e=>e.event==="downloads.drag.popup-shown").data;
 assert.equal(popup.via,"watch");
 assert.equal(popup.surface.background,"rgb(42, 42, 42)");
 assert.equal(popup.surface.appearance,"-moz-panel");
 assert.equal(popup.surface.stage,"rgba(0, 0, 0, 0)");
 assert.equal(popup.surface.part,"rgb(255, 255, 255)");
 assert.equal(popup.surface.panelBackground,"rgb(24, 24, 24)");
 assert.equal(popup.surface.radius,"3px");
 assert.equal(popup.surface.flip,"both");
 assert.equal(events.find(e=>e.event==="downloads.drag.start").data.os,"Linux");
 trace("downloads.drag.popup-shown",{state:"open",via:"password",surface:{
   background:"url(https://example.org/secret)",stage:"private-user-secret",part:"private-user-secret",panelBackground:"private-user-secret",
   radius:"private-user-secret",appearance:"private-user-secret",flip:"private-user-secret"
 }});
 const unsafe=JSON.parse(f.api.dump()).events.at(-1);
 assert.equal(unsafe.data.via,null);
 for(const key of ["background","stage","part","panelBackground","radius","appearance","flip"])
   assert.equal(unsafe.data.surface[key],null,key);
 assert.ok(!f.api.dump().includes("example.org"));
 assert.ok(!f.api.dump().includes("private-user-secret"));
 f.api.dispose();
});
test("NC4-089-R3 actual Popup source and scope-error producers retain typed evidence",()=>{
 const f=fixture();
 const popupSource=readFileSync(new URL("../downloads-indicator.uc.mjs",import.meta.url),"utf8");
 const start=popupSource.indexOf("  function filePopupSurface("),end=popupSource.indexOf("  function prepareFilePopup()",start);
 assert.ok(start>0&&end>start);
 const getComputedStyle=node=>({backgroundColor:node.kind==="stage"?"rgba(0, 0, 0, 0)":"rgb(42, 42, 42)",
   appearance:"-moz-panel",opacity:"1",borderTopLeftRadius:"3px",getPropertyValue:()=> "rgb(24, 24, 24)"});
 const win={getComputedStyle},fileStage={kind:"stage"};
 const popup={kind:"popup",shadowRoot:{querySelector:()=>({kind:"part"})},getAttribute:()=> "both"};
 const sample=new Function("window","fileStage",popupSource.slice(start,end)+";return filePopupSurface;")(win,fileStage)(popup);
 f.win.__nocturneTrace("downloads.drag.popup-shown",{state:"open",surface:sample});
 const saved=JSON.parse(f.api.dump()).events.at(-1).data.surface;
 assert.equal(saved.background,"rgb(42, 42, 42)");
 assert.equal(saved.stage,"rgba(0, 0, 0, 0)");
 assert.equal(saved.flip,"both");
 for(const path of ["../src/core/window-scope.js.part","../src/hub/controller.js.part"]){
   const code=readFileSync(new URL(path,import.meta.url),"utf8");
   assert.match(code,/__nocturneTrace\?\.\("layout\.scope\.error",\{owner:"[^"]+",resource,name:error\?\.name\|\|"Error"\}/);
 }
 f.win.__nocturneTrace("layout.scope.error",{owner:"layout",resource:"scope",name:"TypeError"});
 assert.equal(JSON.parse(f.api.dump()).events.at(-1).data.name,"TypeError");
 f.api.dispose();
});
test("NC4-089-R2 preserves known native and animation diagnostic strings",()=>{
 const f=fixture(),emit=f.win.__nocturneTrace;
 const examples=[
  ["drag.mode.request",{previous:"inline",requested:"outside"}],
  ["drag.mode.applied",{mode:"outside",previous:"content"}],
  ["drag.end",{drop:"copy"}],
  ["workspace.command.rejected",{kind:"hub-data",code:"native-busy"}],
  ["workspace.command.end",{code:"data-lease-lost",ok:false}],
  ["address.begin",{phase:"opening-wave"}],
  ["address.finish",{engine:"waapi-shape"}],
  ["workspace.phase",{from:"out",to:"swap"}],
  ["workspace.bypass",{startup:"playing",ready:"pending"}],
  ["assembly.ready",{homeState:"failed"}],
  ["disassembly.native.after",{resultType:"undefined"}],
  ["tabs.partition.height",{easing:"ease-out"}]
 ];
 for(const [event,data] of examples)emit(event,data);
 const byEvent=new Map(JSON.parse(f.api.dump()).events.map(e=>[e.event,e.data]));
 for(const [event,data] of examples)for(const [k,v] of Object.entries(data))
  assert.equal(byEvent.get(event)?.[k],v,event+"."+k);
 f.api.dispose();
});
test("NC4-089-R2 rejects unexpected event-specific string payloads",()=>{
 const f=fixture(),emit=f.win.__nocturneTrace;
 const examples=[
  ["drag.mode.request",{previous:"private-account",requested:"sensitive"}],
  ["drag.end",{drop:"secret-value"}],
  ["workspace.command.end",{code:"private-code"}],
  ["address.finish",{engine:"private-engine"}],
  ["workspace.phase",{from:"secret-from",to:"secret-to"}],
  ["workspace.bypass",{startup:"secret-startup",ready:"secret-ready"}],
  ["assembly.ready",{homeState:"secret-home"}],
  ["disassembly.native.after",{resultType:"secret-type"}],
  ["tabs.partition.height",{easing:"secret-easing"}]
 ];
 for(const [event,data] of examples)emit(event,data);
 const byEvent=new Map(JSON.parse(f.api.dump()).events.map(e=>[e.event,e.data]));
 for(const [event,data] of examples)for(const k of Object.keys(data))
  assert.equal(byEvent.get(event)?.[k],null,event+"."+k);
 f.api.dispose();
});
test("NC4-089-R2 extracted Home producer and address phase survive the recorder",()=>{
 const f=fixture(),home=readFileSync(new URL("../src/home/shared-home.js.part",import.meta.url),"utf8");
 const address=readFileSync(new URL("../src/toolbar/address-controller.js.part",import.meta.url),"utf8");
 const start=home.indexOf("  function searchLog("),end=home.indexOf("  // A card starts appearing",start);
 assert.ok(start>0&&end>start);
 assert.ok(home.includes('searchLog("snapshot-unavailable",{name:error?.name||"Error"})'));
 assert.ok(address.includes('__nocturneTrace?.("address.begin",()=>({phase:name,'));
 const searchLog=new Function("win",home.slice(start,end)+";return searchLog;")(f.win);
 searchLog("snapshot-unavailable",{name:"Error"});
 const found=JSON.parse(f.api.dump()).events.find(e=>e.event==="home.search.snapshot-unavailable");
 assert.ok(found);assert.equal(found.data.name,"Error");
 f.api.dispose();
});
test("NC4-089 drops unstructured content fields, URI/path values and malicious keys",()=>{
 const f=fixture(),trace=f.win.__nocturneTrace;
 trace("drag.lifecycle.begin",{
   reason:"native-session-ended",count:2,name:"Error",label:"before-drag",
   transform:"matrix(1,0,0,1,10,20)",phase:"startup",
   url:"https://bank.example/private",filePath:"C:\\\\Users\\\\secret.png",tabTitle:"Bank account",query:"very private search",
   nested:{"bad title":"sensitive heading",constructor:"unsafe",status:"confirmed",path:"/home/user/secret",note:"user written message",unexpected:"oneword",searchQuery:"trivia",
     statusText:"hello world",image:"file:///home/user/photo.png","safe-key":"unsafe value"},
   [["a".repeat(100)]]:"sensitive key",badValue:"https://example.org/hidden"
 },{flush:true});
 const dumped=f.api.dump(),event=JSON.parse(dumped).events.at(-1);
 assert.equal(event.event,"drag.lifecycle.begin");
 assert.equal(event.data.reason,"native-session-ended");assert.equal(event.data.name,"Error");
 assert.equal(event.data.label,"before-drag");assert.equal(event.data.transform,"matrix(1,0,0,1,10,20)");
 assert.equal(event.data.nested.status,"confirmed");
 for(const content of ["bank.example","secret.png","Bank account","private search","sensitive heading","user written message","example.org","hello world","bad title","oneword","trivia"])
   assert.ok(!dumped.includes(content),content);
 assert.ok(f.logs.every(x=>!x.includes("bank.example")&&!x.includes("secret.png")));
 f.api.dispose();
});
test("NC4-089 refuses arbitrary mark labels and preserves short manual checkpoints",()=>{
 const f=fixture(),api=f.api;
 for(const label of ["human readable title","https://example.org/private","C:\\\\Users\\\\file.txt","a".repeat(80),{},null,"UPPER","before.drag"])
   assert.equal(api.mark(label),false);
 assert.equal(api.mark("before-drag"),true);
 const marks=JSON.parse(api.dump()).events.filter(e=>e.event==="user.mark");
 assert.deepEqual(marks.map(e=>e.data.label),["before-drag"]);
 f.api.dispose();
});
test("NC4-089 limits throttle identities without breaking native event spellings",()=>{
 const f=fixture(),trace=f.win.__nocturneTrace;
 trace("event.OnePlane:StartupState",{phase:"playing"});
 trace("native.TabSelect",{count:3});
 trace("native.TabSelect",{count:4},{key:"native.TabSelect",throttle:1000});
 trace("native.TabSelect",{count:5},{key:"native.TabSelect",throttle:1000});
 assert.equal(JSON.parse(f.api.dump()).events.filter(e=>e.event==="native.TabSelect").length,2);
 let lazy=0;for(const event of ["http://bad.example/","foo\\nbar","x".repeat(120),null,{},42])
   trace(event,()=>++lazy);
 assert.equal(lazy,0);
 const evilKey={id:99};trace("drag.end",{count:1},{throttle:10000,key:evilKey});
 trace("drag.end",{count:2},{throttle:10000,key:evilKey});
 assert.equal(JSON.parse(f.api.dump()).events.filter(e=>e.event==="drag.end").length,1);
 trace("drag.drop",{count:1},{throttle:10000,key:"first-key"});
 for(let i=0;i<290;i++)trace("drag.drop",{n:i},{key:"key."+i,throttle:10000});
 trace("drag.drop",{count:2},{throttle:10000,key:"first-key"});
 assert.equal(JSON.parse(f.api.dump()).events.filter(e=>e.event==="drag.drop"&&e.data?.count===2).length,1,
   "the oldest identity expires when throttle map reaches its cap");
 assert.ok(JSON.parse(f.api.dump()).events.some(e=>e.event==="event.OnePlane:StartupState"));
 f.api.dispose();
});
test("NC4-089 bounded nested trace handles cycles and excessive fanout",()=>{
 const f=fixture(),node={mode:"native"};node.back=node;
 const branch=()=>Object.fromEntries(Array.from({length:45},(_,i)=>["node"+i,{children:Array.from({length:32},()=>({phase:"running"}))}]));
 f.win.__nocturneTrace("diagnostics.fixture",{node,big:branch()},{flush:true});
 const event=JSON.parse(f.api.dump()).events.at(-1);
 assert.equal(event.data.node.mode,"native");
 let cycle=event.data.node;for(let i=0;i<5;i++)cycle=cycle.back;assert.equal(cycle,null);
 assert.ok(JSON.stringify(event).length<50000);
 f.api.dispose();
});
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

test("NC4-088 disabling diagnostics blocks a queued but unsubmitted snapshot",async()=>{
 const f=fixture();await f.api.flush();
 const initialWrites=f.writes.length;
 f.win.__nocturneTrace("pending.before.optout",{count:1});
 const pending=[...f.timers].find(([,t])=>t.ms===2200);
 assert.ok(pending,"dirty snapshot should have an ordinary deferred flush");
 f.disable();
 let evaluated=0;
 f.win.__nocturneTrace("forbidden.after.optout",()=>{evaluated++;return {count:2};},{flush:true});
 assert.equal(evaluated,0,"opt-out prevents lazy payload evaluation");
 assert.ok(JSON.parse(f.api.dump()).events.some(e=>e.event==="pending.before.optout"));
 f.timers.delete(pending[0]);pending[1].f();
 assert.equal(await f.api.flush(),false);
 assert.equal(f.writes.length,initialWrites,"no new disk submission after opt-out");
 f.api.dispose();
});

test("NC4-088 pref off honors an already submitted write without capturing new events",async()=>{
 const f=fixture();await f.api.flush();
 let unlock,notify;
 const gate=new Promise(resolve=>unlock=resolve),started=new Promise(resolve=>notify=resolve);
 const previousWrite=f.io.writeUTF8;
 f.io.writeUTF8=async(...args)=>{notify();await gate;return previousWrite(...args);};
 f.win.__nocturneTrace("preauthorized.snapshot",{count:1},{flush:true});
 await started;
 const previousCount=f.writes.length;
 f.disable();let evaluated=0;
 f.win.__nocturneTrace("after.optout",()=>{evaluated++;return {count:2};},{flush:true});
 assert.equal(evaluated,0);assert.equal(f.writes.length,previousCount);
 unlock();
 assert.equal(await f.api.flush(),true,"a previously authorized in-flight write can finish");
 assert.equal(f.writes.length,previousCount+1);
 const events=JSON.parse(f.writes.at(-1).data).sessions.at(-1).events;
 assert.ok(events.some(e=>e.event==="preauthorized.snapshot"));
 assert.ok(!events.some(e=>e.event==="after.optout"));
 assert.equal(await f.api.flush(),false,"opt-out cannot authorize another write");
 f.api.dispose();
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

test("native unload delegates to claimed Layout before closing trace across microtask checkpoints",async()=>{
 const f=fixture({standalone:true}),events=()=>JSON.parse(f.api.dump()).events;
 let calls=0,complete=f.api.claimLayout(nativeExit=>{calls++;assert.equal(nativeExit,true);});
 assert.equal(typeof complete,"function");assert.equal(f.api.claimLayout(()=>{}),null);
 const unload=f.listeners.get("unload");
 unload({target:f.doc});await Promise.resolve();
 assert.equal(calls,1);assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
 assert.equal(typeof f.win.__nocturneTrace,"function");
 f.win.__nocturneTrace("layout.cleanup.end",{failedSteps:0});
 complete();complete();await Promise.resolve();await f.api.flush();
 assert.equal(f.win.__nocturneTrace,undefined);
 assert.ok(events().some(e=>e.event==="layout.cleanup.end"));assert.equal(events().at(-1).event,"diagnostics.dispose");
});
test("descendant lifecycle events cannot quiesce recorder or consume window unload",async()=>{
 const f=fixture(),unload=f.listeners.get("unload"),before=f.listeners.get("beforeunload");
 let calls=0,complete=f.api.claimLayout(()=>{calls++;complete();});
 before({target:{}});unload({target:f.win,originalTarget:{}});await Promise.resolve();
 assert.equal(calls,0);assert.equal(f.listeners.get("unload"),unload);assert.ok(f.frames.size>0);
 assert.ok(!JSON.parse(f.api.dump()).events.some(e=>e.event==="window.unload"||e.event==="window.beforeunload"));
 unload({target:f.doc,originalTarget:f.doc});await Promise.resolve();assert.equal(calls,1);
});
test("Sine fallback delegates only to captured Layout and completion is generation-safe",async()=>{
 const f=fixture(),old=f.api;let calls=0,complete=old.claimLayout(nativeExit=>{assert.equal(nativeExit,false);calls++;});
 f.unload();await Promise.resolve();assert.equal(calls,1);assert.equal(f.win.__nocturneDiagnostics,old);
 const next=f.reload();complete();await Promise.resolve();assert.equal(f.win.__nocturneDiagnostics,next);next.dispose();
});
test("explicit Layout completion without native unload retains terminal trace and disposes once",async()=>{
 const f=fixture();let calls=0,complete=f.api.claimLayout(()=>calls++);
 f.win.__nocturneTrace("layout.cleanup.end",{failedSteps:0});complete();complete();await Promise.resolve();
 const events=JSON.parse(f.api.dump()).events;assert.equal(calls,0);
 assert.equal(events.filter(e=>e.event==="diagnostics.dispose").length,1);
 assert.ok(events.some(e=>e.event==="layout.cleanup.end"));
});
test("failed owner handoff is recorded and partial init fallback still disposes",async()=>{
 const f=fixture(),complete=f.api.claimLayout(()=>{throw Error("injected owner failure");});
 f.listeners.get("unload")({target:f.win});await Promise.resolve();complete();
 const events=JSON.parse(f.api.dump()).events;
 assert.ok(events.some(e=>e.event==="diagnostics.layout.handoff-error"));assert.equal(events.at(-1).event,"diagnostics.dispose");
 const p=fixture();p.listeners.get("unload")({target:p.doc});await Promise.resolve();assert.equal(p.win.__nocturneTrace,undefined);
});
test("reentrant completion during native handoff and disabled recorder do not strand owner",async()=>{
 const f=fixture({on:false});let calls=0,complete=f.api.claimLayout(()=>{calls++;f.api.requestDispose(true);complete();});
 f.listeners.get("unload")({target:f.doc});await Promise.resolve();assert.equal(calls,1);
 assert.equal(f.win.__nocturneTrace,undefined);assert.equal(f.timers.size,0);assert.equal(f.writes.length,0);
});
