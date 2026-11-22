import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../downloads-indicator.uc.mjs",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/styles/refined-features.css.part",import.meta.url),"utf8");
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)+a.length));
const {canDragFile,latestCompleted}=new Function(section("  function canDragFile(","  function fileIconURL(")+"return {canDragFile,latestCompleted};")();
const services=readFileSync(new URL("../src/services/library-services-runtime.js.part",import.meta.url),"utf8");
const dragBody=services.slice(services.indexOf("  function dragFile("),services.indexOf("  const downloads=createDownloadsService("));
function dragFixture({allow=true,exists=true,isFile=true,closed=false}={}){
 const calls=[],file={exists:()=>exists,isFile:()=>isFile};
 const dragFile=new Function("allowed","fileFor","Services","win","dead",dragBody+"return dragFile;")(
  ()=>allow,path=>{calls.push(["lookup",path]);return file;},
  {io:{newFileURI:f=>{assert.equal(f,file);return {spec:"file:///C:/Downloads/hello%20world.txt"};}}},
  {closed},false);
 const dt={mozSetDataAt:(...args)=>calls.push(args),setData:(...args)=>calls.push(args),addElement:n=>calls.push(n)};
 return {dragFile,calls,file,dt};
}
const completed=path=>({succeeded:true,target:{path,exists:true}});
test("latest completed download is independent of current active transfers",()=>{
 const a=completed("a"),b=completed("b"),c={target:{path:"c"}},d=completed("d");d.target.exists=false;
 assert.equal(latestCompleted(new Map([[a,{time:10,completedAt:40}],[b,{time:20,completedAt:30}],[c,{time:50}],[d,{time:60}]])),a);
 assert.equal(latestCompleted(new Map([[c,{time:50}]])),null);
});
test("the sole native service exports Gecko file and URI synchronously",()=>{
 const f=dragFixture(),d=completed("C:\\Downloads\\hello world.txt"),node={};
 assert.equal(f.dragFile(d,{isTrusted:true,dataTransfer:f.dt},node,"dock"),true);
 assert.deepEqual(f.calls,[
  ["lookup",d.target.path],
  ["application/x-moz-file",f.file,0],
  ["text/uri-list","file:///C:/Downloads/hello%20world.txt"],node
 ]);
 assert.equal(f.dt.effectAllowed,"copyMove");
});
test("active, failed, canceled, blocked, partial and removed downloads cannot begin",()=>{
 for(const patch of [{succeeded:false},{error:{}},{canceled:true},{hasPartialData:true},{hasBlockedData:true},{target:{path:"x",exists:false}},{target:{path:""}}]){
  const d={...completed("x"),...patch};assert.equal(canDragFile(d),false);
 }
 for(const options of [{exists:false},{isFile:false},{closed:true}]){
  const f=dragFixture(options);
  assert.equal(f.dragFile(completed("x"),{isTrusted:true,dataTransfer:f.dt},{},"dock"),false);
  assert.equal(f.calls.some(x=>Array.isArray(x)&&x[0]==="application/x-moz-file"),false);
 }
 const f=dragFixture();
 for(const event of [{isTrusted:false,dataTransfer:f.dt},{dataTransfer:f.dt},{isTrusted:true,dataTransfer:{}}])
  assert.equal(f.dragFile(completed("x"),event,{},"dock"),false);
 assert.equal(f.dragFile(completed("x"),{isTrusted:true,dataTransfer:f.dt},{},"other"),false);
});
test("private Library denies file drag while native private Dock remains eligible",()=>{
 const f=dragFixture({allow:false}),d=completed("x"),e={isTrusted:true,dataTransfer:f.dt};
 assert.equal(f.dragFile(d,e,{},"library"),false);
 assert.equal(f.calls.length,0);
 assert.equal(f.dragFile(d,e,{},"dock"),true);
 assert.ok(f.calls.some(x=>Array.isArray(x)&&x[0]==="application/x-moz-file"));
 assert.ok(source.includes("list?.dragNative?.(d,e,source)"));
 assert.ok(!source.includes("populateFileTransfer"));
});
test("row and indicator share native drag; clicks and source stability are protected",()=>{
 assert.ok(source.includes('bindFileDrag(node,()=>latestCompleted(history))'));
 assert.ok(source.includes('bindFileDrag(el,()=>download,{row:true})'));
 assert.ok(source.includes('row.el.draggable=canDragFile(d)'));
 assert.ok(source.includes('if(fileDragSource&&fileDragSource!==node)return;'));
 assert.ok(source.includes('if(ignoreFileDragClick(e))return;'));
 assert.ok(source.includes('!ignoreFileDragClick(e)&&cardOpen'));
 assert.ok(source.includes('fileDragSource=dragClickSource=null'));
 assert.ok(css.includes('.zr-dock-row[draggable="true"]'));
 const handlers={};let starts=0,ends=0,prevented=0;
 const n={addEventListener:(k,fn)=>handlers[k]=fn},d=completed("x");
 const bind=new Function("beginFileDrag","endFileDrag",section("  function bindFileDrag(","  function makeRow(")+"return bindFileDrag")((e,s,file)=>{assert.equal(file,d);starts++},()=>ends++);
 bind(n,()=>d,{row:true});
 const evt=button=>({target:{closest:()=>button?{}:null},preventDefault(){prevented++}});
 handlers.pointerdown(evt(true));handlers.dragstart(evt(false));assert.equal(prevented,1);assert.equal(starts,0);
 handlers.pointerdown(evt(false));handlers.dragstart(evt(false));handlers.dragend();assert.equal(starts,1);assert.equal(ends,1);
});

test("native file icons refresh on completion and use the same URI for the drag card",()=>{
 const iconURL=new Function(section("  function fileIconURL(","  function createFileIcon(")+"return fileIconURL")();
 assert.equal(iconURL({target:{path:"C:\\Downloads\\setup.exe"}}),"moz-icon://C:\\Downloads\\setup.exe?size=32");
 assert.equal(iconURL(completed("C:\\Downloads\\setup.exe")),"moz-icon://C:\\Downloads\\setup.exe?size=32&state=normal");
 assert.equal(iconURL({}),"moz-icon://.unknown?size=32");
 assert.ok(source.includes("syncFileIcon(row.fileIcon,d)"));
 assert.ok(source.includes("syncFileIcon(icon,d,32)"));
});
test("Bunny reverses swing and locks the top grip after spring lift",()=>{
 const motion=new Function("const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),FILE_CARD_W=186,FILE_CARD_H=51,FILE_LIFT=320;"+section("  const fileMix=","  function fileOrigin(")+"return {fileSwingTarget,fileBunnyStep}")();
 assert.ok(motion.fileSwingTarget(500)<0);assert.ok(motion.fileSwingTarget(-500)>0);
 assert.equal(motion.fileSwingTarget(100000),-23);
 const origin={x:20,y:40,w:430,h:65},q={origin,point:{x:300,y:180},started:0,last:0,vx:900,s:Object.fromEntries(Object.entries({...origin,angle:0,scale:1}).map(([k,x])=>[k,{x,v:0}]))};
 let p;for(let i=8;i<=1000;i+=8){p=motion.fileBunnyStep(q,i);assert.ok(Math.abs(p.angle)<=28);assert.ok(Number.isFinite(p.w));}
 assert.equal(p.x,300);assert.equal(p.y,180);assert.ok(Math.abs(p.w-186)<.1);assert.ok(Math.abs(p.h-51)<.1);assert.ok(Math.abs(p.angle)<1);
});
test("single live Windows drag popup uses a timer rather than native-image handoffs",()=>{
 assert.ok(source.includes('e.dataTransfer.setDragImage(filePopup,FILE_GRIP_X,FILE_GRIP_Y)'));
 assert.ok(source.includes('e.dataTransfer.setDragImage(native.card,FILE_CARD_W/2,0)'));
 assert.ok(!source.includes('updateFileDragImage'));assert.ok(!source.includes('onFileDragLeave'));
 assert.ok(source.includes('q.timer=window.setTimeout(step,16)'));
 assert.ok(source.includes('filePopup?.remove();filePopup=fileStage=null;'));
 assert.ok(css.includes('pointer-events:none!important;-moz-window-shadow:none!important'));
 assert.ok(css.includes('transform-origin:50% 0%'));
});
test("popup screen movement drives swing inside and outside the source window",()=>{
 const code=section("  function filePointInside(","  function tickFilePopup(");
 const events=[],win={mozInnerScreenX:100,mozInnerScreenY:50,innerWidth:600,innerHeight:400};
 const sample=new Function("window","fileMix","clamp","fileBunnyTrace",code+"return sampleFilePopup")(win,(a,b,t)=>a+(b-a)*t,(v,a,b)=>Math.max(a,Math.min(b,v)),(event,data)=>events.push([event,data.inside]));
 const q={screenPoint:null,lastMove:0,vx:0,moves:0,crossings:0,inside:null,frames:0};
 sample(q,{x:200,y:100},0);sample(q,{x:300,y:100},40);assert.ok(q.vx>0);
 sample(q,{x:800,y:100},100);assert.equal(q.inside,false);assert.ok(q.vx>0);
 sample(q,{x:600,y:100},140);assert.equal(q.inside,true);assert.ok(q.vx<0);
 assert.equal(q.moves,3);assert.deepEqual(events,[["boundary",true],["boundary",false],["boundary",true]]);
});
test("drag telemetry includes popup readiness, motion and final summary",()=>{
 for(const event of ["start","popup-shown","popup-not-shown","tick","end","popup-hidden","return-finish"])assert.ok(source.includes('fileBunnyTrace("'+event+'"'));
 assert.ok(source.includes("maxAngle:q.maxAngle"));assert.ok(source.includes("maxGap:q.maxGap"));assert.ok(source.includes("fileDragMissing>=3"));assert.ok(source.includes("fileDragUnknown>=6"));
});

test("native file drag card is attached only after Bunny cleanup ownership exists",()=>{
 const sectionSource=section("  function beginFileBunny(","  function finishExternalDrag(");
 const ownership=sectionSource.indexOf("fileBunny={"),append=sectionSource.indexOf("root.append(native.card)");
 assert.ok(ownership>=0&&append>ownership);
 assert.ok(sectionSource.indexOf("source.setAttribute(\"data-file-lift\"")>append);
});
test("native file watchdog has bounded unknown and absent-session recovery",()=>{
 const code=section("  function fileDragSession(","  function createFileCard(");
 function fixture(read){
   let next=0;const pending=new Map(),ends=[];
   const window={setTimeout(fn){const id=++next;pending.set(id,fn);return id;},
     clearTimeout(id){pending.delete(id);},__nocturneTrace(){}};
   const Cc={"@mozilla.org/widget/dragservice;1":{getService(){return {getCurrentSession:read};}}};
   const Ci={nsIDragService:{}};
   const api=new Function("window","Cc","Ci","ends",`
     let fileDragSource=null,dead=false,fileBunny=null,fileDragWatchTimer=0,fileDragMissing=0,fileDragUnknown=0;
     function current(){return 0;}
     function filePopupSurface(){return null;}
     function tickFilePopup(){}
     function endFileDrag(source,event,reason){
       if(fileDragSource!==source)return;
       fileDragSource=null;ends.push(reason);stopFileDragWatch();
     }
     `+code+`
     return {start(source){fileDragSource=source;watchFileDrag(source);},
       stop:stopFileDragWatch,source:()=>fileDragSource};
   `)(window,Cc,Ci,ends);
   return {api,pending,ends,tick(){
     const [id,fn]=pending.entries().next().value??[];
     assert.ok(fn);pending.delete(id);fn();
   }};
 }
 for(const read of [()=>{throw Error("native error")},undefined]){
   const f=fixture(read),src={};f.api.start(src);
   for(let i=0;i<5;i++)f.tick();
   assert.equal(f.ends.length,0);f.tick();
   assert.deepEqual(f.ends,["native-session-unavailable"]);
   assert.equal(f.api.source(),null);assert.equal(f.pending.size,0);
 }
 const missing=fixture(()=>null),src={};missing.api.start(src);
 missing.tick();missing.tick();assert.equal(missing.ends.length,0);
 missing.tick();assert.deepEqual(missing.ends,["native-session-ended"]);
 assert.equal(missing.pending.size,0);
 let n=0;const intermittent=fixture(()=>++n%4===0?{}:undefined);
 intermittent.api.start({});for(let i=0;i<16;i++)intermittent.tick();
 assert.equal(intermittent.ends.length,0);
 intermittent.api.stop();assert.equal(intermittent.pending.size,0);
});

test("file source recovery arms before optional Bunny artwork failure",()=>{
 const code=section("  function beginFileDrag(","  function ignoreFileDragClick(");
 const sourceNode={setAttribute(){},removeAttribute(){}},download=completed("file"),calls=[];
 const f=new Function("sourceNode","download","calls",`
   let dead=false,fileDragSource=null,dragClickSource=null,fileBunny=null,externalDrag=null;
   const node={},history=new Map([[download,{}]]);
   const list={dragNative(d){calls.push("payload");return d===download;}};
   const window={__nocturneTrace(){}};
   function watchFileDrag(){calls.push("watch");}
   function stopFileDragWatch(){calls.push("stop");}
   function cancelHide(){}function cancelFlight(){}function pinPanel(){}
   function beginFileBunny(){calls.push("art");throw Error("optional artwork failed");}
   function clearFileBunny(){calls.push("clear-art");}
   function fileBunnyTrace(){}
   function syncDownloadHolds(){}
   function finishFileBunny(){calls.push("finish-art");}
   function finishExternalDrag(){}
   function schedule(){}function scheduleMount(){}function armHide(){}
   let cardOpen=false;
   `+code+`
   return {start:beginFileDrag,end:endFileDrag,source:()=>fileDragSource};
 `)(sourceNode,download,calls);
 const e={isTrusted:true,stopPropagation(){},preventDefault(){throw Error("native payload already accepted");}};
 assert.equal(f.start(e,sourceNode,download),true);
 assert.deepEqual(calls.slice(0,4),["payload","watch","art","clear-art"]);
 assert.equal(f.source(),sourceNode);
 f.end(sourceNode,undefined,"native-session-unavailable");
 f.end(sourceNode,undefined,"duplicate");
 assert.equal(f.source(),null);
 assert.equal(calls.filter(c=>c==="stop").length,1);
});
test("hidden native file popup stops artwork without ending its source gesture",()=>{
 const code=section("  function prepareFilePopup(","  function paintFileBunny(");
 const events={},trace=[];let stopped=0;
 const popup={style:{setProperty(){}},getOuterScreenRect(){},setAttribute(){},
   append(){},addEventListener(k,v){events[k]=v;},isConnected:true,state:"closed"};
 const set={append(){}};
 const prepare=new Function("popup","set","trace","onStop",`
   let filePopup=null,fileStage=null,fileBunny=null;
   const document={createXULElement:()=>popup},get=()=>set,make=()=>({});
   function current(){return 0;}
   function fileBunnyTrace(event){trace.push(event);}
   function filePopupSurface(){return null;}
   function stopFileBunnyFrame(){onStop();}
   function tickFilePopup(){}
   `+code+`
   return {prepare:prepareFilePopup,set(q){fileBunny=q;}};
 `)(popup,set,trace,()=>stopped++);
 assert.equal(prepare.prepare(),true);
 const q={popup,ending:false,shown:true,frames:8};
 prepare.set(q);events.popuphidden();
 assert.equal(stopped,1);assert.equal(q.shown,false);
 assert.ok(trace.includes("popup-hidden"));
});
test("Dock-free Library fallback owns a bounded native file drag source lease",()=>{
 const library=readFileSync(new URL("../src/library/controller.js.part",import.meta.url),"utf8");
 const a=library.indexOf("  function stopFallbackDragWatch(");
 const b=library.indexOf("  function createFileRow(",a);
 assert.ok(a>=0&&b>a);
 const code=library.slice(a,b);
 function fixture(read){
   let next=0;const pending=new Map(),events=[];
   const win={setTimeout(fn){const id=++next;pending.set(id,fn);return id;},clearTimeout(id){pending.delete(id);}};
   const Cc={"@mozilla.org/widget/dragservice;1":{getService(){return {getCurrentSession:read};}}},Ci={nsIDragService:{}};
   const api=new Function("win","Cc","Ci","events",`
     let fallbackDragTimer=0,fallbackDragMissing=0,fallbackDragUnknown=0,dragSource=null,dragOwner=null,dead=false;
     function trace(event,data){events.push([event,data]);}
     function finishDrag(node){if(dragSource!==node)return;stopFallbackDragWatch();dragSource=null;events.push(["finished"]);}
     `+code+`
     return {start(node){dragSource=node;watchFallbackDrag(node);},stop:stopFallbackDragWatch,source:()=>dragSource};
   `)(win,Cc,Ci,events);
   return {api,pending,events,tick(){
     const [id,fn]=pending.entries().next().value??[];assert.ok(fn);
     pending.delete(id);fn();
   }};
 }
 const absent=fixture(()=>null);absent.api.start({});
 absent.tick();absent.tick();assert.equal(absent.events.length,0);
 absent.tick();assert.deepEqual(absent.events,[
   ["file.drag.recovered",{reason:"native-session-ended"}],["finished"]]);
 assert.equal(absent.pending.size,0);
 const unavailable=fixture(()=>{throw Error("API failed")});unavailable.api.start({});
 for(let i=0;i<5;i++)unavailable.tick();assert.equal(unavailable.events.length,0);
 unavailable.tick();assert.deepEqual(unavailable.events,[
   ["file.drag.recovered",{reason:"native-session-unavailable"}],["finished"]]);
 assert.equal(unavailable.pending.size,0);
 let n=0;const live=fixture(()=>++n===5?{}:undefined);live.api.start({});
 for(let i=0;i<10;i++)live.tick();
 assert.equal(live.events.length,0);live.api.stop();assert.equal(live.pending.size,0);
 assert.match(library,/if\(fallback\)watchFallbackDrag\(node\)/);
 assert.match(library,/if\(dragSource\)\{pendingClose=true;return;\}if\(active\(\)\)closeNow\(\);/);
 assert.match(library,/if\(dragSource!==node\)return;stopFallbackDragWatch\(\)/);
});
test("Library uses the existing Bunny owner and releases the external drag lease once",()=>{
 const code=section("  function finishExternalDrag(","  function clearFileBunny(");
 let externalDrag=null,fileDragSource=null,fileBunny=null,dead=false,node={},cardOpen=false,dockOpen=false;
 const document={},window={__nocturneOverlay:{current:()=>"library"}},sourceNode={isConnected:true,ownerDocument:document,closest:()=>true};
 const calls=[];let list={withNative:(id,fn)=>id==="valid"&&fn({id})};
 const run=new Function("document","window","node","list","sourceNode","calls",`
 let externalDrag=null,fileDragSource=null,fileBunny=null,dead=false,cardOpen=false,dockOpen=false;
 function beginFileDrag(e,s,d){fileDragSource=s;calls.push(d.id);return true;}
 function endFileDrag(s,e){fileDragSource=null;finishExternalDrag();}
 ${code}
 return {beginExternalDrag,endExternalDrag,finishExternalDrag,get:()=>externalDrag};`)(document,window,node,list,sourceNode,calls);
 assert.equal(run.beginExternalDrag({},sourceNode,"invalid",()=>{}),false);
 assert.equal(run.beginExternalDrag({},sourceNode,"valid",()=>calls.push("done")),true);
 assert.equal(run.beginExternalDrag({},sourceNode,"valid",()=>{}),false);
 assert.equal(run.endExternalDrag(sourceNode,{}),true);run.finishExternalDrag();
 assert.deepEqual(calls,["valid","done"]);assert.equal(run.get(),null);
 const library=readFileSync(new URL("../src/library/controller.js.part",import.meta.url),"utf8");
 assert.match(library,/beginExternalDrag\?\.\(e,node,entry\.record\.id,finish\)/);
 assert.match(library,/if\(dragSource\)\{pendingResult=result;return;\}/);
 assert.match(library,/syncIndicator\(false\)/);
});

test("native drag popup requests transparent window before widget creation",()=>{
 assert.ok(source.includes('"border-radius":"1px","opacity":".999"'));
 assert.ok(source.includes('"--panel-background-color":"transparent"'));
 assert.ok(source.includes('surface:filePopupSurface(popup)'));
 assert.ok(css.includes('border-radius:1px!important;opacity:.999!important'));
 assert.ok(css.includes('--panel-background-color:transparent!important'));
 assert.ok(css.includes('#zr-file-bunny-popup .zr-file-bunny-stage {background:transparent!important'));
});

test("live drag popup disables Gecko screen-edge constraints before attachment",()=>{
 const code=section("  function prepareFilePopup(","  function paintFileBunny(");
 assert.match(code,/flip:"none"/);
 const attrs=new Map(),events={};let attached=false;
 const popup={style:{setProperty(){}},getOuterScreenRect(){},setAttribute(k,v){assert.equal(attached,false);attrs.set(k,v);},append(){},addEventListener(k,v){events[k]=v;}};
 const set={append(){assert.equal(attrs.get("flip"),"none");attached=true;}};
 const prepare=new Function("document","get","make",`let filePopup=null,fileStage=null,fileBunny=null;\n${code}\nreturn prepareFilePopup;`)({createXULElement:()=>popup},()=>set,()=>({}));
 assert.equal(prepare(),true);assert.equal(attrs.get("flip"),"none");assert.equal(attrs.get("mousethrough"),"always");assert.equal(attached,true);
});


test("File Bunny OLE loop suppresses unchanged forced layout without stopping samples",()=>{
  const code=section("  function fileBunnyVisualChanged(","  function stopFileBunnyFrame(");
  const poses=[0,.01,.02,.06,.06,.06,0].map(x=>({x,y:45,w:186,h:51,angle:0,scale:1,morph:1}));
  const run=new Function("poses",`
    let fileBunny=null,now=0,next=0,index=0,flushes=0;const writes=[],timers=new Map(),events=[];
    const window={setTimeout(fn){const id=++next;timers.set(id,fn);return id;},windowUtils:{paintCount:0}};
    function current(){return now;}
    function popupPoint(){return {x:20,y:20};}
    function sampleFilePopup(q){q.moves++;}
    function fileBunnyStep(){return poses[Math.min(index++,poses.length-1)];}
    function paintFileBunny(q,p){q.pose=p;writes.push(p.x);}
    function fileBunnyTrace(name,data){events.push([name,data]);}
    ${code}
    const q={ending:false,shown:true,timer:0,started:0,last:0,lastReport:-300,frames:0,moves:0,maxGap:0,maxAngle:0,
      popup:{state:"open",getAttribute:()=>null},visual:{card:{getBoundingClientRect(){flushes++;}}},
      paintPose:null,paints:0,skips:0};
    fileBunny=q;tickFilePopup(q);
    return {tick(){const [id,fn]=timers.entries().next().value??[];if(!fn)throw Error("missing native timer");timers.delete(id);now+=16;fn();},
      read(){return {writes,flushes,frames:q.frames,paints:q.paints,skips:q.skips,pose:q.pose,pending:timers.size,
        telemetry:events.find(e=>e[0]==="tick")?.[1]}}};
  `)(poses);
  for(let i=0;i<poses.length;i++)run.tick();
  const state=run.read();
  assert.deepEqual(state.writes,[0,.06,0]);
  assert.equal(state.flushes,3);assert.equal(state.paints,3);assert.equal(state.skips,4);
  assert.equal(state.frames,7);assert.equal(state.pending,1);
  assert.equal(state.pose.x,0,"release pose stays current even on skipped frames");
  assert.equal(state.telemetry.paints,1);assert.equal(state.telemetry.skips,0);
});
test("File Bunny relative pose gate checks all visible dimensions",()=>{
  const changed=new Function(section("  function fileBunnyVisualChanged(","  function tickFilePopup(")+"return fileBunnyVisualChanged;")();
  const q={x:10,y:20,w:100,h:35,angle:0,scale:1,morph:0};
  assert.equal(changed(null,q),true);
  assert.equal(changed(q,{...q,x:q.x+.01,y:q.y+.02,w:q.w+.01,h:q.h+.01,angle:.01,scale:1.0001,morph:.0005}),false);
  for(const [key,delta] of [["x",.06],["y",.06],["w",.06],["h",.06],["angle",.04],["scale",.0006],["morph",.003]])
    assert.equal(changed(q,{...q,[key]:q[key]+delta}),true,key);
});
