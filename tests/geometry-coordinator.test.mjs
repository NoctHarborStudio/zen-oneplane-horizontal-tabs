import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const source=read("src/layout/geometry.js.part");
function setup(){
 const jobs=new Map(),calls=[],reads={nav:0,row:0,bookmark:0};
 let serial=0,height="90px",nextHeight=90,phase=null,callback=null,reject=false,painted=true,centered=true,topology=true,matched=true;
 const mk=(key,h)=>({getBoundingClientRect(){reads[key]++;return {height:h()};}});
 const navbar=mk("nav",()=>50),row=mk("row",()=>nextHeight-20),bookmarks=mk("bookmark",()=>20);
 row.hasAttribute=()=>false;
 const toolbarWrapper={style:{getPropertyValue:()=>height,setProperty(k,v){if(!reject){height=v;calls.push("height:"+v);}}}};
 const root={hasAttribute:k=>k===phase,getAttribute:()=>phase};
 const window={performance:{now:()=>1000},requestAnimationFrame(fn){jobs.set(++serial,fn);return serial;},cancelAnimationFrame(id){jobs.delete(id);},__zenMagneticBookmarksShared:{syncAddressState(){calls.push("suspend");}}};
 const body=source.slice(source.indexOf("  function readToolbarRows("),source.indexOf("  function observeGeometry("));
 const api=new Function("window","root","navbar","row","bookmarks","toolbarWrapper","calls","callback","outcome",
  'let dead=false,geometryFrame=0,geometryDirty=0,geometryRunning=false,geometryTicket=0,centering=false,contourRevision=0,adaptiveHeightDirty=false,panelSwitchUntil=0,frame=0;const GEOMETRY_HEIGHT=1,GEOMETRY_CONTOUR=2,GEOMETRY_CENTER=4;let syncing=false,contourPainting=false;function hoverSupported(){return true}function centerToolbar(){calls.push("center");callback();return outcome.centered()}function refreshIndicator(){calls.push("indicator")}function stepContour(now,rows){calls.push(rows?"contour:shared":"contour:fresh")}function paintContour(force,prehover,rows){calls.push(rows?"force:shared":"force:fresh");return outcome.painted()}function sync(){calls.push("sync");outcome.match()}function schedule(){calls.push("schedule-sync")}let syncedTopology={};function readStripTopology(){return {}}function sameStripTopology(){return outcome.matched()}function captureCenterTopology(){return outcome.topology()?()=>outcome.topology():null}function restingGeometryBlocked(){return false}'+body+
  'return {scheduleGeometry,scheduleMeasuredGeometry,queueGeometry,cancelGeometry,prepareWorkspaceGeometry,kill(){dead=true;cancelGeometry()},pending:()=>geometryDirty,revision:()=>contourRevision,setBusy(s,c){syncing=s;contourPainting=c}};')
  (window,root,navbar,row,bookmarks,toolbarWrapper,calls,()=>callback?.(),{centered:()=>centered,painted:()=>typeof painted==="function"?painted():painted,matched:()=>matched,match:()=>{matched=true},topology:()=>topology});
 return {api,jobs,calls,reads,set height(v){nextHeight=v;},set phase(v){phase=v;},set callback(v){callback=v;},set reject(v){reject=v;},set painted(v){painted=v;},set centered(v){centered=v;},set matched(v){matched=v;},set topology(v){topology=v;},
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

test("all resting centering refuses drag and address cascade before any geometry reads",()=>{
 const code=source.slice(source.indexOf("  function restingGeometryBlocked("),source.indexOf("  // Read actual resting rows"));
 const run=new Function("marker","cascadeState","requireResting",`
 let centering=false,dead=false,stripOrderSnapshot=[];const toolbarWrapper={},root={hasAttribute:()=>false};
 function geometryWriteAllowed(){return !restingGeometryBlocked()}
 const row={hasAttribute:k=>k===marker},hoverSupported=()=>true;
 const window={innerWidth:1200},target={getBoundingClientRect(){throw Error("read");}};
 ${code}
 return centerToolbar(requireResting);`);
 for(const marker of ["data-op-dragging","data-op-island-incoming","data-op-lane-drag","data-op-live-drag","data-op-magnetic-pull"])
  for(const force of [false,true])assert.equal(run(marker,"idle",force),false);
 for(const phase of ["hiding","showing"])for(const force of [false,true])assert.equal(run(null,phase,force),false);
 for(const phase of ["idle","hidden"])assert.throws(()=>run(null,phase,true),/read/);
});
test("native topology snapshot resolves each Split group once before projection",()=>{
 const sync=read("src/toolbar/tab-sync.js.part"),adapter=read("src/native/tab-adapter.js.part");
 const functions=adapter.slice(adapter.indexOf("  function splitGroup("),adapter.indexOf("  function unsplitTab("));
 const code=sync.slice(sync.indexOf("  function readStripTopology("),sync.indexOf("  function sameStripTopology("));
 const run=new Function(`let reads=0;const group={hasAttribute:k=>k==="split-view-group"};
 const tab={get group(){reads++;return group;},hasAttribute:()=>false,pinned:true},browser={visibleTabs:[tab],selectedTab:tab},row={hasAttribute:()=>false};
 ${functions}${code}const state=readStripTopology();return {reads,group:state.tabs[0].group===group,split:state.tabs[0].split,pinned:state.tabs[0].pinned};`);
 assert.deepEqual(run(),{reads:1,group:true,split:true,pinned:true});
 assert.ok(sync.includes("const {tab,group,split,pinned}=nativeTopology.tabs[index];"));
 assert.ok(sync.includes("const groups = [...new Set(nativeTopology.tabs.map(x=>x.group).filter(Boolean))];"));
});

test("rejected force restores old geometry requests; stale native projection is synced even with no frame",()=>{
 const x=setup();x.api.scheduleGeometry();x.centered=false;
 assert.equal(x.api.prepareWorkspaceGeometry(),false);assert.equal(x.jobs.size,1);assert.equal(x.api.pending(),7);
 x.centered=true;x.tick();assert.equal(x.jobs.size,0);
 const y=setup();y.matched=false;assert.equal(y.api.prepareWorkspaceGeometry(),true);
 assert.deepEqual(y.calls,["sync","suspend","center","force:shared","indicator"]);
});
test("preflight refuses reentry from projection or contour and rejects invalidated mirror after paint",()=>{
 for(const [s,c] of [[true,false],[false,true]]){
  const x=setup();x.api.setBusy(s,c);assert.equal(x.api.prepareWorkspaceGeometry(),false);
  assert.ok(!x.calls.includes("center"));assert.equal(x.jobs.size,1);
 }
 const y=setup();y.painted=()=>{y.topology=false;return true;};
 assert.equal(y.api.prepareWorkspaceGeometry(),false);assert.ok(y.calls.includes("schedule-sync"));assert.ok(!y.calls.includes("indicator"));
});
test("height cannot write under a newly acquired center owner",()=>{
 const x=setup();x.height=130;x.callback=()=>{x.phase="data-zr-center-motion";};
 x.api.scheduleGeometry();x.tick();assert.ok(!x.calls.includes("height:130px"));
 assert.deepEqual(x.reads,{nav:0,row:0,bookmark:0});
});
test("projection sync reentry preserves pending work and cancelled callbacks cannot consume a successor",()=>{
 const s=read("src/toolbar/tab-sync.js.part"),sync=s.slice(s.indexOf("  function sync() {"),s.indexOf("  function syncNow("));
 const schedule=s.slice(s.indexOf("  function schedule() {"),s.indexOf("  function revealSelectedInStrip("));
 const api=new Function(`let dead=false,syncing=false,frame=0,serial=0,calls=0,reenter=true;
 const jobs=new Map(),window={requestAnimationFrame(fn){jobs.set(++serial,fn);return serial},cancelAnimationFrame(id){jobs.delete(id)}};
 function syncNow(){calls++;if(reenter){reenter=false;sync();}}
 ${sync}${schedule}return {sync,schedule,jobs,count:()=>calls,frame:()=>frame};`)();
 api.schedule();const stale=[...api.jobs.values()][0];api.sync();
 assert.equal(api.count(),1);assert.equal(api.jobs.size,1);
 stale();assert.equal(api.count(),1);assert.equal(api.jobs.size,1);
 const [id,fn]=[...api.jobs][0];api.jobs.delete(id);fn();assert.equal(api.count(),2);assert.equal(api.frame(),0);
});

test("lane mounting stops after a synchronous owner change within the same lane",()=>{
 const s=read("src/toolbar/strip-order.js.part"),code=s.slice(s.indexOf("  function mountLaneNodes("),s.indexOf("  function applyStripPartition("));
 const run=new Function(`let dead=false;const inserted=[],nodes=[{},{},{}];let valid=true;
 const lane={children:[],insertBefore(n){inserted.push(n);valid=false;}};
 ${code}return {result:mountLaneNodes(lane,nodes,()=>valid),count:inserted.length};`);
 assert.deepEqual(run(),{result:false,count:1});
});

test("preflight cannot acknowledge a contour after startup or workspace phase changed",()=>{
 const x=setup();x.painted=()=>{x.phase="in";return true;};
 assert.equal(x.api.prepareWorkspaceGeometry(),false);assert.ok(!x.calls.includes("indicator"));
});

test("frozen projection only updates icons and does not read native topology or mutate slots",()=>{
 const sync=read("src/toolbar/tab-sync.js.part"),code=sync.slice(sync.indexOf("  function syncNow()"),sync.indexOf("  function schedule()"));
 const run=new Function(`let dead=false,icons=0;const root={hasAttribute:()=>false},row={};
 const entries=new Map([[{closing:false},{}],[{closing:true},{}]]);
 function restingGeometryBlocked(){return true}
 function refreshEntryIcon(){icons++}
 function readStripTopology(){throw Error("native read")}
 ${code}syncNow();return icons;`);
 assert.equal(run(),1);
});
test("freeze release replays projection after foreign lane/live drag and address cascade",()=>{
 const lane=read("src/interactions/strip-drag.js.part"),reorder=read("src/interactions/reorder.js.part"),cascade=read("src/toolbar/address-cascade.js.part");
 const code=reorder.slice(reorder.indexOf("  function clearLiveDrag()"),reorder.indexOf("  function finishStripCommit()"));
 const run=new Function("marker",`let dead=false,liveDragTarget=null;const calls=[],dragShifted=new Set(),attrs=new Set([marker]);
 const row={hasAttribute:k=>attrs.has(k),removeAttribute:k=>attrs.delete(k),style:{removeProperty(){}}};
 function clearLaneDrag(){}function schedule(){calls.push("projection")}function scheduleGeometry(){calls.push("geometry")}
 ${code}clearLiveDrag();return {calls,remaining:[...attrs]};`);
 for(const marker of ["data-op-live-drag","data-op-island-incoming"])assert.deepEqual(run(marker),{calls:["projection","geometry"],remaining:[]});
 assert.ok(lane.includes("if(active&&!dead){schedule();scheduleGeometry();}"));
 assert.ok(cascade.includes("if(!dead){schedule();scheduleGeometry();}"));
 assert.ok(cascade.includes("if(!dead){refreshIndicator();schedule();scheduleGeometry();scheduleContour();}"));
});

test("drop rejects closed or regrouped frozen mirror before native movement",()=>{
 const s=read("src/interactions/drag-controller.js.part"),code=s.slice(s.indexOf("  function validStripDropTarget("),s.indexOf("  function moveNativeNextTo("));
 const run=new Function(`const window={},other={},tab={},group={},member={},owner=new Map([[tab,window],[member,window]]);
 let tabs=[{tab,group:null},{tab:member,group}];
 const readStripTopology=()=>({tabs}),tabOwner=t=>owner.get(t);
 ${code}return {valid:validStripDropTarget,tab,group,member,setTabs:t=>tabs=t,setOwner:(t,w)=>owner.set(t,w),other};`)();
 const a={native:run.tab,tab:run.tab},b={native:run.group,group:run.group};
 assert.equal(run.valid(a),true);assert.equal(run.valid(b),true);
 run.setTabs([{tab:run.member,group:run.group}]);assert.equal(run.valid(a),false);
 run.setTabs([{tab:run.tab,group:run.group}]);assert.equal(run.valid(a),false);assert.equal(run.valid(b),true);
 run.setOwner(run.tab,run.other);assert.equal(run.valid(b),false);
 assert.equal(run.valid({native:run.tab,group:run.group}),false);
});
