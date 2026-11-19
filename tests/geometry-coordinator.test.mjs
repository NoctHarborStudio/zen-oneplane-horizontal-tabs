import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const source=read("src/layout/geometry.js.part");
function setup(){
 const jobs=new Map(),calls=[],reads={nav:0,row:0,bookmark:0};
 let serial=0,height="90px",nextHeight=90,phase=null,callback=null;
 const mk=(key,h)=>({getBoundingClientRect(){reads[key]++;return {height:h()};}});
 const navbar=mk("nav",()=>50),row=mk("row",()=>nextHeight-20),bookmarks=mk("bookmark",()=>20);
 row.hasAttribute=()=>false;
 const toolbarWrapper={style:{getPropertyValue:()=>height,setProperty(k,v){height=v;calls.push("height:"+v);}}};
 const root={hasAttribute:k=>k===phase,getAttribute:()=>phase};
 const window={performance:{now:()=>1000},requestAnimationFrame(fn){jobs.set(++serial,fn);return serial;},cancelAnimationFrame(id){jobs.delete(id);},__zenMagneticBookmarksShared:{syncAddressState(){calls.push("suspend");}}};
 const body=source.slice(source.indexOf("  function readToolbarRows("),source.indexOf("  function observeGeometry("));
 const api=new Function("window","root","navbar","row","bookmarks","toolbarWrapper","calls","callback",
  'let dead=false,geometryFrame=0,geometryDirty=0,geometryRunning=false,contourRevision=0,adaptiveHeightDirty=false,panelSwitchUntil=0,frame=0;const GEOMETRY_HEIGHT=1,GEOMETRY_CONTOUR=2;function hoverSupported(){return true}function centerToolbar(){calls.push("center");callback()}function refreshIndicator(){calls.push("indicator")}function stepContour(now,rows){calls.push(rows?"contour:shared":"contour:fresh")}function paintContour(force,prehover,rows){calls.push(rows?"force:shared":"force:fresh")}function sync(){calls.push("sync")}'+body+
  'return {scheduleGeometry,queueGeometry,cancelGeometry,prepareWorkspaceGeometry,kill(){dead=true;cancelGeometry()},pending:()=>geometryDirty,revision:()=>contourRevision};')
  (window,root,navbar,row,bookmarks,toolbarWrapper,calls,()=>callback?.());
 return {api,jobs,calls,reads,set height(v){nextHeight=v;},set phase(v){phase=v;},set callback(v){callback=v;},
  tick(){const batch=[...jobs];for(const [id,fn] of batch){jobs.delete(id);fn(1000);}}};
}
test("height and contour requests coalesce into one pass with shared row snapshot",()=>{
 const x=setup();x.api.scheduleGeometry();x.api.queueGeometry(2);x.api.scheduleGeometry();
 assert.equal(x.jobs.size,1);x.tick();assert.deepEqual(x.calls,["center","contour:shared","indicator"]);
 assert.deepEqual(x.reads,{nav:1,row:1,bookmark:1});assert.equal(x.jobs.size,0);
});
test("height change defers contour and never reuses pre-write rectangles",()=>{
 const x=setup();x.height=130;x.api.scheduleGeometry();x.tick();
 assert.deepEqual(x.calls,["center","height:130px","indicator"]);assert.equal(x.jobs.size,1);
 x.tick();assert.deepEqual(x.calls,["center","height:130px","indicator","contour:fresh"]);assert.equal(x.jobs.size,0);
});
test("invalidation raised during centering is preserved in next frame",()=>{
 const x=setup();x.callback=()=>{x.callback=null;x.api.scheduleGeometry();};
 x.api.scheduleGeometry();x.tick();assert.equal(x.jobs.size,1);x.tick();
 assert.equal(x.jobs.size,0);assert.equal(x.calls.filter(v=>v==="center").length,2);
});
test("workspace force cancels queued work and measures fresh after changed height",()=>{
 const x=setup();x.height=130;x.api.scheduleGeometry();x.api.prepareWorkspaceGeometry();
 assert.deepEqual(x.calls,["suspend","center","height:130px","force:fresh","indicator"]);assert.equal(x.jobs.size,0);
 x.api.scheduleGeometry();x.api.prepareWorkspaceGeometry();assert.deepEqual(x.calls.slice(-4),["suspend","center","force:shared","indicator"]);assert.equal(x.jobs.size,0);
});
test("contour-only work does not center; teardown cancels queued work",()=>{
 const x=setup();x.api.queueGeometry(2);x.tick();assert.deepEqual(x.calls,["contour:fresh"]);
 x.api.scheduleGeometry();x.api.kill();x.tick();assert.equal(x.jobs.size,0);assert.equal(x.calls.length,1);
});
test("one geometry RAF owner and retained native preflight",()=>{
 const c=read("src/layout/contour-controller.js.part"),s=read("src/layout/contour-settings.js.part"),l=read("src/core/window-lifecycle.js.part");
 assert.ok(!c.includes("requestAnimationFrame"));assert.ok(!s.includes("contourFrame"));
 assert.ok(l.includes('cleanupStep("cancelGeometry()"'));
 assert.ok(source.includes("queueGeometry(GEOMETRY_HEIGHT|GEOMETRY_CONTOUR)"));
 assert.ok(source.includes("paintContour(true,false,measured&&!measured.changed?measured.rows:null)"));
});
