import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../downloads-indicator.uc.mjs",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/styles/refined-features.css.part",import.meta.url),"utf8");
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)+a.length));
const {canDragFile,latestCompleted,populateFileTransfer}=new Function(section("  function canDragFile(","  function beginFileDrag(")+"return {canDragFile,latestCompleted,populateFileTransfer};")();
const completed=path=>({succeeded:true,target:{path,exists:true}});
test("latest completed download is independent of current active transfers",()=>{
 const a=completed("a"),b=completed("b"),c={target:{path:"c"}},d=completed("d");d.target.exists=false;
 assert.equal(latestCompleted(new Map([[a,{time:10,completedAt:40}],[b,{time:20,completedAt:30}],[c,{time:50}],[d,{time:60}]])),a);
 assert.equal(latestCompleted(new Map([[c,{time:50}]])),null);
});
test("file drag exports real Gecko file and URI with native copy/move negotiation",()=>{
 const d=completed("C:\\Downloads\\hello world.txt"),file={exists:()=>true,isFile:()=>true},source={};
 const calls=[],dt={mozSetDataAt:(...args)=>calls.push(args),setData:(...args)=>calls.push(args),addElement:n=>calls.push(n)};
 assert.equal(populateFileTransfer(dt,d,source,p=>{assert.equal(p,d.target.path);return file;},f=>{assert.equal(f,file);return "file:///C:/Downloads/hello%20world.txt";}),true);
 assert.deepEqual(calls,[["application/x-moz-file",file,0],["text/uri-list","file:///C:/Downloads/hello%20world.txt"],source]);
 assert.equal(dt.effectAllowed,"copyMove");
});
test("active, failed, canceled, blocked, partial and missing files are rejected",()=>{
 for(const patch of [{succeeded:false},{error:{}},{canceled:true},{hasPartialData:true},{hasBlockedData:true},{target:{path:"x",exists:false}},{target:{path:""}}]){
   const d={...completed("x"),...patch};assert.equal(canDragFile(d),false);
   assert.equal(populateFileTransfer({},d,{},()=>{throw Error("must not inspect path")},()=>""),false);
 }
 const d=completed("x"),dt={mozSetDataAt(){throw Error("must not export missing file")}};
 assert.equal(populateFileTransfer(dt,d,{},()=>({exists:()=>false,isFile:()=>true}),()=>""),false);
 assert.equal(populateFileTransfer(dt,d,{},()=>({exists:()=>true,isFile:()=>false}),()=>""),false);
 assert.equal(populateFileTransfer(dt,d,{},()=>{throw Error("invalid file")},()=>""),false);
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
 assert.ok(source.includes("maxAngle:q.maxAngle"));assert.ok(source.includes("maxGap:q.maxGap"));assert.ok(source.includes("q.missing>=3"));
});
