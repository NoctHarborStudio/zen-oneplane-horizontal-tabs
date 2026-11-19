import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const source=read("src/layout/geometry.js.part");
function setup(){
 const jobs=new Map(),calls=[],reads={nav:0,row:0,bookmark:0};
 let serial=0,height="90px",nextHeight=90,phase=null,callback=null,reject=false,painted=true,centered=true;
 const mk=(key,h)=>({getBoundingClientRect(){reads[key]++;return {height:h()};}});
 const navbar=mk("nav",()=>50),row=mk("row",()=>nextHeight-20),bookmarks=mk("bookmark",()=>20);
 row.hasAttribute=()=>false;
 const toolbarWrapper={style:{getPropertyValue:()=>height,setProperty(k,v){if(!reject){height=v;calls.push("height:"+v);}}}};
 const root={hasAttribute:k=>k===phase,getAttribute:()=>phase};
 const window={performance:{now:()=>1000},requestAnimationFrame(fn){jobs.set(++serial,fn);return serial;},cancelAnimationFrame(id){jobs.delete(id);},__zenMagneticBookmarksShared:{syncAddressState(){calls.push("suspend");}}};
 const body=source.slice(source.indexOf("  function readToolbarRows("),source.indexOf("  function observeGeometry("));
 const api=new Function("window","root","navbar","row","bookmarks","toolbarWrapper","calls","callback","outcome",
  'let dead=false,geometryFrame=0,geometryDirty=0,geometryRunning=false,geometryTicket=0,centering=false,contourRevision=0,adaptiveHeightDirty=false,panelSwitchUntil=0,frame=0;const GEOMETRY_HEIGHT=1,GEOMETRY_CONTOUR=2,GEOMETRY_CENTER=4;function hoverSupported(){return true}function centerToolbar(){calls.push("center");callback();return outcome.centered()}function refreshIndicator(){calls.push("indicator")}function stepContour(now,rows){calls.push(rows?"contour:shared":"contour:fresh")}function paintContour(force,prehover,rows){calls.push(rows?"force:shared":"force:fresh");return outcome.painted()}function sync(){calls.push("sync")}'+body+
  'return {scheduleGeometry,scheduleMeasuredGeometry,queueGeometry,cancelGeometry,prepareWorkspaceGeometry,kill(){dead=true;cancelGeometry()},pending:()=>geometryDirty,revision:()=>contourRevision};')
  (window,root,navbar,row,bookmarks,toolbarWrapper,calls,()=>callback?.(),{centered:()=>centered,painted:()=>painted});
 return {api,jobs,calls,reads,set height(v){nextHeight=v;},set phase(v){phase=v;},set callback(v){callback=v;},set reject(v){reject=v;},set painted(v){painted=v;},set centered(v){centered=v;},
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
 assert.ok(source.includes("queueGeometry(GEOMETRY_CENTER|GEOMETRY_HEIGHT|GEOMETRY_CONTOUR)"));
 assert.ok(source.includes("paintContour(true,false,measured.changed?null:measured.rows)===true"));
});

test("completed immediate center queues height only and never clears pending center",()=>{
 const x=setup();x.api.scheduleMeasuredGeometry(true);x.tick();
 assert.deepEqual(x.calls,["contour:shared","indicator"]);
 x.api.scheduleGeometry();x.api.scheduleMeasuredGeometry(true);x.tick();
 assert.deepEqual(x.calls.slice(-3),["center","contour:shared","indicator"]);
});
test("cancelled callback cannot consume a newer geometry request",()=>{
 const x=setup();x.api.scheduleGeometry();const stale=[...x.jobs.values()][0];
 x.api.cancelGeometry();x.api.scheduleMeasuredGeometry(true);stale(999);
 assert.equal(x.jobs.size,1);assert.equal(x.calls.length,0);x.tick();
 assert.deepEqual(x.calls,["contour:shared","indicator"]);
});
test("preflight reentry cannot nest a centering transaction",()=>{
 const x=setup();x.callback=()=>{x.callback=null;assert.equal(x.api.prepareWorkspaceGeometry(),false);};
 x.api.scheduleGeometry();x.tick();assert.equal(x.jobs.size,1);
 x.tick();assert.equal(x.calls.filter(v=>v==="center").length,2);
 assert.ok(!x.calls.includes("suspend"));
});
test("forced pass preserves invalidation raised during centering",()=>{
 const x=setup();x.callback=()=>{x.callback=null;x.api.scheduleGeometry();};
 assert.equal(x.api.prepareWorkspaceGeometry(),true);
 assert.equal(x.jobs.size,1);x.tick();assert.equal(x.jobs.size,0);
});
test("invalid or rejected height does not publish shared pre-write geometry",()=>{
 const x=setup();x.height=NaN;x.api.scheduleGeometry();x.tick();
 assert.deepEqual(x.calls,["center","contour:fresh"]);
 x.height=130;x.reject=true;x.api.scheduleGeometry();x.tick();
 assert.deepEqual(x.calls.slice(-2),["center","contour:fresh"]);
 x.reject=false;x.api.scheduleGeometry();x.tick();assert.ok(x.calls.includes("height:130px"));
});
test("immediate native resize and toolbar reconciliation do not request redundant centering",()=>{
 assert.ok(read("src/core/window-lifecycle.js.part").includes("scheduleMeasuredGeometry(centerToolbar());"));
 assert.ok(read("src/toolbar/tab-sync.js.part").includes("const centered=centerToolbar();\n    observeGeometry(centered);"));
 assert.ok(source.includes("if(iconChanged||widthChanged||addressMarginsAtRead===null)"));
});

test("forced preflight rejects blocked center, invalid height and failed contour",()=>{
 const x=setup();x.centered=false;assert.equal(x.api.prepareWorkspaceGeometry(),false);
 assert.deepEqual(x.calls,["suspend","center"]);
 x.centered=true;x.height=NaN;assert.equal(x.api.prepareWorkspaceGeometry(),false);
 assert.deepEqual(x.calls.slice(-2),["suspend","center"]);
 x.height=90;x.painted=false;assert.equal(x.api.prepareWorkspaceGeometry(),false);
 x.painted=true;assert.equal(x.api.prepareWorkspaceGeometry(),true);
});
test("preflight cancels old work before diagnostics and preserves new invalidations",()=>{
 const x=setup();
 assert.ok(source.indexOf("cancelGeometry();",source.indexOf("function prepareWorkspaceGeometry"))<
   source.indexOf('("geometry.workspace.prepare"',source.indexOf("function prepareWorkspaceGeometry")));
 x.callback=()=>{x.callback=null;x.api.scheduleGeometry();};
 assert.equal(x.api.prepareWorkspaceGeometry(),true);assert.equal(x.jobs.size,1);x.tick();assert.equal(x.jobs.size,0);
});
