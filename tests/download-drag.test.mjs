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
