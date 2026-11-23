import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {startupTimeline,startupFits,startupLateEffect,createStartupOutcome,startupBoundaryOutcome} from "../src/algorithms/startup-timeline.mjs";
const source=readFileSync(new URL("../startup-animation.uc.mjs",import.meta.url),"utf8");
const assemblyErrorContext=source.slice(source.indexOf("const ASSEMBLY_ERROR_CLASSES="),source.indexOf("function canStartBeforePaint("));
const css=readFileSync(new URL("../chrome.css",import.meta.url),"utf8");
const first=source.slice(source.indexOf("function canStartBeforePaint("),source.indexOf("// No replay on Sine"));
const before=new Function(first+"return canStartBeforePaint;")();
test("Gecko first-paint gate fails open for already painted windows",()=>{
 assert.equal(before({paintCount:0},"complete"),true);
 assert.equal(before({paintCount:1},"loading"),false);
 assert.equal(before({paintCount:9,paintingSuppressed:true},"loading"),false);
 assert.equal(before({paintingSuppressed:true},"complete"),true);
 assert.equal(before({},"complete"),false);
 assert.equal(before({},"loading"),true);
});
test("startup uses only the explicit optional chrome boot layer, never a page layer",()=>{
 assert.ok(!/zr-startup-cover|zr-startup-page-veil|pageVeil|cover=veil/.test(source));
 assert.ok(!source.includes("light-dark(#eef0f4"));
 assert.ok(!css.includes(":root[data-zr-startup-phase] :is(#zr-download-indicator"));
 assert.ok(!source.includes('slide(sidebar,'));
});
test("interruption samples current progress and settles before cleanup",()=>{
 const segment=source.slice(source.indexOf("function settle()"),source.indexOf("function interrupt("));
 const run=new Function(segment+
 'let dead=false,playing=true,settling=false,bootPreparing=false,ownedTimeline=null,lateObserver=null,lateResize=null,lateFrame=0,timer=0;const reduced={matches:false},PHASE="phase",FADE="ease",root={setAttribute(){}},log=[];const a={cancel(){log.push("cancel");}},n={},complete=()=>{};const animations=new Map([[a,{n,frames:[{"--p":"0"},{"--p":"1"}],complete}]]);const window={getComputedStyle(){return {getPropertyValue(){return ".37"}}},setTimeout(fn,t){log.push(t);return 1},clearTimeout(){}};function play(n,f,d,t){log.push(f[0]["--p"],f[1]["--p"],t);return true}function finish(){log.push("finish")}function now(){return 0}function armFinish(t){log.push(t)}settle();settle();return log;');
 assert.deepEqual(run(),["cancel",".37","1",120,155]);
});

test("late startup allowed only during initial chrome setup; established windows never replay",()=>{
 const i=source.indexOf("function startupEligible("),j=source.indexOf("let lateStart",i);
 const eligible=new Function(source.slice(i,j)+"return startupEligible;")();
 assert.equal(eligible(true,false,null,900),true);
 assert.equal(eligible(true,true,"pending",4000),true);
 assert.equal(eligible(true,true,"true",1000),false);
 assert.equal(eligible(true,true,null,824),true);
 assert.equal(eligible(true,true,null,1800),false);
 assert.equal(eligible(true,true,"pending",900,{initial:false}),false);
 assert.equal(eligible(true,false,null,8000),false);
 assert.equal(eligible(true,true,"true",1800,{initial:true,readyAt:1600}),true);
 assert.equal(eligible(true,true,"true",1800,{initial:false,readyAt:1600}),false);
 assert.equal(eligible(true,true,"true",5000,{initial:true,readyAt:1600}),false);
 assert.ok(source.includes("deadline=started+8000"));
 assert.ok(source.includes("baseline.add(n)"));
 assert.ok(source.includes("alreadyPainted ? .72 : 0"));
});

test("startup waits for horizontal readiness and ignores duplicate resize",()=>{
 assert.ok(source.includes("if(active&&!one){schedule();return;}"));
 assert.ok(source.includes("window.__nocturneLayoutStartup"));
 assert.ok(source.includes('if(playing&&changed){if(bootPreparing)finish("interrupted");else settle();}'));
});

test("startup keeps the waiting gate until targets own their resting styles",()=>{
 const launch=source.slice(source.indexOf("function launch("),source.indexOf("function schedule(){"));
 assert.ok(launch.indexOf('engine?.start(row')<launch.indexOf('root.setAttribute(PHASE,"playing")'));
 assert.ok(source.includes(':is(#zr-startup-specificity,[data-zr-startup-managed])'));
 assert.ok(source.includes('const painted=!gated&&!cold&&cards.some(n=>baseline.has(n))'));
});

test("typing or scrolling in Home does not abort startup, explicit toolbar interaction does",()=>{
 const a=source.indexOf("function interrupt("),b=source.indexOf("let viewport=",a);
 const run=new Function(source.slice(a,b)+'let playing=true,calls=0,boot=null;function decision(){}function settle(){calls++}const target=toolbar=>({closest:()=>toolbar?{}:null});for(const type of ["keydown","wheel","pointerdown"])interrupt({type,isTrusted:true,target:target(false)});interrupt({type:"keydown",isTrusted:true,target:target(true)});interrupt({type:"pointerdown",isTrusted:false,target:target(true)});interrupt({type:"pointerdown",isTrusted:true,target:target(true)});return calls;');
 assert.equal(run(),1);
 assert.ok(source.includes("now()-iconWaitAt<(boot?1400:600)"));
 assert.ok(source.includes("assembly.center.result"));
 assert.ok(source.includes("assembly.icons.ready"));
});

test("startup gate excludes nested OnePlane buttons from the generic toolbar gate",()=>{
 const targets=source.slice(source.indexOf("const earlyTargets=["),source.indexOf("const waitingGate="));
 assert.ok(targets.includes('#oneplane-tabs :is(.oneplane-tab,.oneplane-split-group,.oneplane-title-island,.oneplane-new-tab)'));
 assert.ok(targets.includes('#nav-bar :is(toolbarbutton,button,.titlebar-button,[role=button]):not(#oneplane-tabs *)'));
 assert.ok(!targets.includes('"#nav-bar :is(toolbarbutton,button,.titlebar-button,[role=button])",'));
});

test("cold assembly stages panel, cards, bookmarks and Home on one bounded timeline",()=>{
 const plan=startupTimeline;
 const pure=readFileSync(new URL("../src/algorithms/startup-timeline.mjs",import.meta.url),"utf8");
 const bloom=readFileSync(new URL("../src/algorithms/startup-bloom.mjs",import.meta.url),"utf8");
 const inline=s=>s.replace(/^import [^\n]+\n/gm,"").replace(/^export (function|const) /gm,"$1 ");
 assert.ok(source.startsWith(inline(bloom)+inline(pure)));
 for(const scale of [.4,1,1.4]){
   const t=plan(123,scale);
   assert.ok(t.panel+t.panelLength<t.cards);
   assert.ok(t.cards<t.bookmarks&&t.bookmarks<t.home);
   assert.ok(t.home+195+t.homeLength<t.end);
   assert.equal(t.start,123);assert.equal(t.scale,scale);
 }
 assert.ok(source.includes('reveal(surface,{y:-18,delay:timeline.panel,length:timeline.panelLength})'));
 assert.ok(source.includes('delay:Math.round(timeline.cards*scale)'));
 assert.ok(source.includes('warmStartupIcons?.()'));
 assert.ok(source.includes('playStartup?.(timeline)'));
 assert.ok(source.includes('finishStartup?.()'));
});

test("boot waits for minimum visibility and a quiet readiness window, with hard deadline",()=>{
 const a=source.indexOf("function bootReady("),b=source.indexOf("function mountBoot(",a);
 const ready=new Function(source.slice(a,b)+"return bootReady")();
 assert.equal(ready(1009,0,1010,0,8000),false);
 assert.equal(ready(1010,0,1010,890,8000),true);
 assert.equal(ready(1100,0,1010,1050,8000),false);
 assert.equal(ready(8000,0,1010,7999,8000),true);
 assert.ok(source.includes('if(!prefs.getBoolPref(BOOT_PREF,true))prelude?.cleanup?.()'));
 assert.ok(source.includes('root.append(boot)'));
 assert.ok(source.includes('boot.inert=true'));
 assert.ok(source.includes('pointerEvents:"none"'));
 assert.ok(source.includes('bootPreparing=false;step(removeBoot);'));
});
test("all prepared effects remain paused until the boot handoff",()=>{
 const launch=source.slice(source.indexOf("function launch("),source.indexOf("function schedule(){"));
 assert.ok(launch.includes('timeline.paused=true'));
 assert.ok(launch.includes('paused:timeline.paused'));
 assert.ok(launch.includes('exitBoot(resume)'));
 assert.ok(launch.includes('armFinish()'));
 assert.ok(launch.includes('resumePrepared(timeline)'));
 assert.ok(source.includes('if(prepare){a.pause();a.currentTime=0;}'));
 assert.ok(source.includes('if(dead||boot!==overlay)return;'));
 const center=readFileSync(new URL("../src/core/center-motion.js.part",import.meta.url),"utf8");
 assert.ok(center.includes('if(paused){a.pause();a.currentTime=0;}'));
 const home=readFileSync(new URL("../src/home/shared-home.js.part",import.meta.url),"utf8");
 assert.ok(home.includes('if(timeline.paused){a.pause();a.currentTime=0;}'));
});

test("early boot is installed before layout and adopted without duplicate cover",()=>{
 const pre=readFileSync(new URL("../src/core/boot-prelude.js.part",import.meta.url),"utf8");
 const layout=readFileSync(new URL("../layout.uc.mjs",import.meta.url),"utf8");
 const manifest=JSON.parse(readFileSync(new URL("../theme.json",import.meta.url),"utf8"));
 assert.ok(layout.startsWith(pre));
 assert.equal(Object.keys(manifest.scripts)[0],"startup-animation.uc.mjs");
 assert.ok(pre.includes('win.__zenRefinedStartupAnimationSeen||win.__nocturneLayoutStartup'));
 assert.ok(pre.includes('timer=win.setTimeout(expire,Math.max(0,record.deadline-win.performance.now()))'));
 assert.ok(source.includes('earlyBoot=prelude?.adopt?.()'));
 assert.ok(source.includes('if(!early)root.append(boot)'));
 assert.ok(source.includes('BOOT_MIN=1010,BOOT_EXIT=320,BOOT_LEAD=150,BOOT_ENTER=460'));
 assert.ok(source.indexOf('decision("boot.ready"')<source.indexOf('decision("assembly.icons.ready"'));
});

test("startup animation preserves explicit 760 ms and does not migrate saved choices",()=>{
 const block=source.slice(source.indexOf("  window[SEEN]=true;"),source.indexOf("  const scale=duration/1050;"));
 const prefs={getIntPref:()=>760,setIntPref(){throw Error("unexpected write");},getBoolPref:()=>false,setBoolPref(){throw Error("unexpected write");}};
 assert.equal(new Function("window","SEEN","prefs","DURATION",block+"return duration;")({},"seen",prefs,"duration"),760);
 assert.ok(!block.includes("setIntPref"));assert.ok(!block.includes("setBoolPref"));
});
test("Assembly cleanup continues after Center Motion and Home failures",()=>{
 const code=source.slice(source.indexOf("  function finish(reason="),source.indexOf("  function settle(){"));
 const run=new Function(`
 let dead=false,playing=true,settling=false,raf=1,timer=2,nativeTimer=3,nativeFrame=0,nativeFrame2=0,lateFrame=4,lateObserver={disconnect(){throw Error("observer");}},lateResize=null,nativeObserver=null,centerHandle={seal(){throw Error("seal");},release(){log.push("center");}},bookmarkHandle={seal(){},release(){log.push("bookmarks");}},sheetURI=null,style=null,holdNode=null,bootPreparing=true;
 const log=[],KEY="assembly",PHASE="phase",HOLD="hold",MANAGED="managed",EXISTING="existing",ENABLE="enable",started=0,now=()=>1;
 const window={cancelAnimationFrame(){},clearTimeout(){},removeEventListener(){},__nocturneCenterMotion:{releasePending(){log.push("pending");}},__zenSharedHomeV1:{finishStartup(){throw Error("home");}},__nocturneTrace(e,d){if(e==="assembly.cleanup")log.push(d.failed);}};
 const root={removeAttribute(){log.push("phase");}},reduced={removeEventListener(){}},prefs={removeObserver(){}},Services={};
 const animations=new Map(),owned=new Map(),seen=new Set(),baseline=new Set(),inputs=[];
 let pendingEngine=window.__nocturneCenterMotion,homeRegistry=window.__zenSharedHomeV1,ownedTimeline={},phaseOwned=true,phaseBaseline=null,holdBaseline=null;
 function restoreMark(n,k,v){n.removeAttribute(k);}
 function restore(){}function removeBoot(){log.push("boot");}function interrupt(){}function onResize(){}function schedule(){}function preferenceChanged(){}
 ${code}window[KEY]=finish;finish("completed");finish();return {log,registered:!!window[KEY]};`);
 assert.deepEqual(run(),{log:["center","bookmarks","pending","phase","boot",3],registered:false});
});

test("Boot teardown continues after timer failure and preserves replacement marker",()=>{
 const code=source.slice(source.indexOf("  function removeBoot(){"),source.indexOf("  function exitBoot("));
 const run=new Function(`
 let bootOwned=true,bootBaseline=null,earlyBoot=null,bootTimer=1,bootFrame=2,bootEffects=[{cancel(){log.push("effect");}}],boot={remove(){log.push("node");}},bootMark={};
 const log=[],KEY="assembly",window={assembly:()=>{},clearTimeout(){throw Error("timer");},cancelAnimationFrame(){log.push("frame");}};
 const root={removeAttribute(){log.push("marker");}};function finish(){}function decision(e,d){log.push(d.failed);}
 ${code}removeBoot();return log;`);
 assert.deepEqual(run(),["frame","effect","node",1]);
});

function directEffectFixture({paused=true,pauseFails=false,cancelDuringAnimate=false}={}){
 const code=assemblyErrorContext+source.slice(source.indexOf("  function play(n,"),source.indexOf("  function save("));
 return new Function("paused","pauseFails","cancelDuringAnimate",`
  let dead=false,bootPreparing=paused,ownedTimeline=null,animations=new Map(),events=[],callbacks=[],EASE="ease";
  const a={cancelled:0,finished:{then(ok,fail){callbacks.push({ok,fail});}},pause(){if(pauseFails)throw Error("pause");},cancel(){this.cancelled++;}};
  const n={animate(){if(cancelDuringAnimate)dead=true;return a;}};
  function decision(e){events.push(e);}
  ${code}
  return {a,animations,callbacks,events,run(retain=false){return play(n,[{opacity:0},{opacity:1}],0,1,retain,EASE,()=>events.push("complete"));}};
 `)(paused,pauseFails,cancelDuringAnimate);
}
test("startup direct effect owns WAAPI before pause failure and rolls back",()=>{
 const h=directEffectFixture({pauseFails:true});assert.equal(h.run(),false);
 assert.equal(h.a.cancelled,1);assert.equal(h.animations.size,0);assert.equal(h.callbacks.length,1);
 h.callbacks[0].fail();assert.deepEqual(h.events,["assembly.effect.error"]);
});
test("external cancellation settles only the exact direct effect record",()=>{
 const h=directEffectFixture({paused:false});assert.equal(h.run(true),true);
 h.callbacks[0].ok();assert.equal(h.animations.size,1);
 h.callbacks[0].fail();h.callbacks[0].fail();assert.equal(h.animations.size,0);
 assert.deepEqual(h.events,["complete","assembly.effect.cancel"]);
});
test("disposal during direct animate cancels late returned effect",()=>{
 const h=directEffectFixture({cancelDuringAnimate:true});assert.equal(h.run(),false);assert.equal(h.a.cancelled,1);assert.equal(h.animations.size,0);
});
function foldFixture({mode="null"}={}){
 const code=assemblyErrorContext+source.slice(source.indexOf("  function acquireStartupBookmarks("),source.indexOf("  function scheduleLate("));
 return new Function("mode",`
 let dead=false,centerHandle={},seen=new Set(),bootPreparing=true,scale=1;const MANAGED="managed",events=[];
 const attrs=new Map(),n={getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
 const items={children:[n]},timeline={bookmarks:470,paused:true};
 const h={release(){events.push("release");}},engine={bookmarks(){events.push("fold");if(mode==="throw")throw Error("fold");if(mode==="replace")window.__nocturneCenterMotion={};return mode==="null"?null:h;}};
 const window={__nocturneCenterMotion:engine};function decision(e){events.push(e);}
 ${code}
 const handle=acquireStartupBookmarks(engine,items,timeline);
 return {seen:seen.has(n),mark:n.getAttribute(MANAGED),handle:!!handle,events};
 `)(mode);
}
test("failed shared bookmark acquisition restores fallback eligibility",()=>{
 for(const mode of ["null","throw","replace"]){
  const h=foldFixture({mode});assert.equal(h.handle,false);assert.equal(h.seen,false);assert.equal(h.mark,null);
  assert.ok(h.events.includes("assembly.bookmarks.fallback"));if(mode==="replace")assert.ok(h.events.includes("release"));
 }
});
test("successful bookmark acquisition keeps temporary gates owned by Assembly",()=>{
 assert.deepEqual(foldFixture({mode:"ok"}),{seen:true,mark:"true",handle:true,events:["fold"]});
});
test("direct reveal rollback continues after individual style restoration failure",()=>{
 const code=source.slice(source.indexOf("  function restore(n)"),source.indexOf("  function reveal(n,"));
 const run=new Function(`
 const events=[],EFFECT="effect",MOVE="move",CLIP="clip";
 const n={style:{removeProperty(k){events.push(k);if(k==="bad")throw Error("style");}},removeAttribute:k=>events.push(k)};
 const owned=new Map([[n,new Map([["bad",{value:""}],["good",{value:""}]])]]);
 function decision(e,d){events.push(d.failed);}
 ${code}restore(n);return {events,size:owned.size};`);
 assert.deepEqual(run(),{events:["bad","good","effect","move","clip",1],size:0});
});

test("native readiness frame callbacks cannot schedule successors after disposal",()=>{
 const code=source.slice(source.indexOf("  function onNativeReady()"),source.indexOf("  try{\n    window[KEY]?.()",source.indexOf("  function onNativeReady()")));
 const run=new Function(`
 let dead=false,nativeReady=false,nativeTimer=0,nativeFrame=0,nativeFrame2=0,settled=false,readyAt=0,schedules=0;
 const frames=[],timers=[],window={requestAnimationFrame(fn){frames.push(fn);return frames.length;},setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){}};
 const Promise={allSettled(){return {then(){}}}};function decision(){}function schedule(){schedules++;}function now(){return 1;}function finish(){dead=true;}
 ${code}
 onNativeReady();timers[0]();dead=true;frames[0]();return {frames:frames.length,schedules,settled};
 `);
 assert.deepEqual(run(),{frames:1,schedules:0,settled:false});
});
test("Home owns an exact timeline lease and rolls back all partial pause effects",()=>{
 const home=readFileSync(new URL("../src/home/shared-home.js.part",import.meta.url),"utf8");
 const code=home.slice(home.indexOf("  let startupRun="),home.indexOf("  function stopMotion()"));
 const run=new Function(`
 let open=true,dead=false,searchToken=null,mark=true,fail=true;
 const panel={hasAttribute:()=>mark,removeAttribute(){mark=false;}},effects=[];
 const nodes=[0,1].map(i=>({animate(){const a={cancelled:0,played:0,finished:Promise.resolve(),pause(){if(i===1&&fail)throw Error("pause");},cancel(){this.cancelled++;},play(){this.played++;}};effects.push(a);return a;}}));
 const content={children:nodes},win={matchMedia:()=>({matches:false}),performance:{now:()=>0}};
 ${code}
 const timeline={start:0,scale:1,home:650,homeLength:330,paused:true};
 const first=playStartupHome(timeline);const afterFail={lease:!!timeline.homeLease,mark,cancelled:effects.map(a=>a.cancelled)};
 fail=false;mark=true;const a=playStartupHome(timeline);a.release();
 mark=true;const next={...timeline};const b=playStartupHome(next);a.release();a.resume();b.resume();
 const afterStale={owned:next.homeLease===b,mark,played:effects.slice(-2).map(a=>a.played)};b.release();
 return {first,afterFail,afterStale,final:!!next.homeLease};
 `);
 assert.deepEqual(run(),{first:null,afterFail:{lease:false,mark:false,cancelled:[1,1]},afterStale:{owned:true,mark:true,played:[1,1]},final:false});
});
test("early prelude restores exact baseline and stale cleanup cannot erase a replacement",()=>{
 const pre=readFileSync(new URL("../src/core/boot-prelude.js.part",import.meta.url),"utf8");
 function fixture({failAppend=false}={}){
  const attrs=new Map([["data-zr-startup-phase","prior-phase"],["data-nocturne-boot","prior-boot"]]);
  const node={isConnected:false,style:{setProperty(){}},setAttribute(){},remove(){this.isConnected=false;}};
  const root={hasAttribute:k=>attrs.has(k),getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),append(n){n.isConnected=true;if(failAppend)throw Error("append");}};
  let timer;const window={performance:{now:()=>1},matchMedia:()=>({matches:false}),setTimeout(fn){timer=fn;return 1;},clearTimeout(){throw Error("timer");},addUnloadListener(){}};
  new Function("window","document","Services",pre)(window,{documentElement:root,createElementNS:()=>node},{prefs:{getBoolPref:()=>true}});
  return {window,attrs,node,timer};
 }
 const f=fixture(),record=f.window.__nocturneEarlyBoot;const adopted=record.adopt();assert.equal(adopted.node,f.node);assert.equal(adopted.deadline,8001);assert.equal(adopted.phaseBaseline,"prior-phase");assert.equal(adopted.bootBaseline,"prior-boot");record.cleanup();assert.equal(f.node.isConnected,true);
 const g=fixture();g.timer();assert.equal(g.window.__zenRefinedStartupAnimationSeen,true);assert.equal(g.node.isConnected,false);assert.equal(g.attrs.get("data-zr-startup-phase"),"prior-phase");assert.equal(g.attrs.get("data-nocturne-boot"),"prior-boot");
 const h=fixture();h.window.__nocturneEarlyBoot={};h.attrs.set("data-nocturne-boot","replacement");h.timer();assert.equal(h.attrs.get("data-nocturne-boot"),"replacement");
 const partial=fixture({failAppend:true});assert.equal(partial.node.isConnected,false);assert.equal(partial.window.__nocturneEarlyBoot,undefined);
});

test("closed startup timeline cannot acquire a late Home lease",()=>{
 const home=readFileSync(new URL("../src/home/shared-home.js.part",import.meta.url),"utf8");
 const code=home.slice(home.indexOf("  let startupRun="),home.indexOf("  function stopMotion()"));
 const run=new Function(`
 let open=true,dead=false,searchToken=null,mark=true,calls=0;
 const panel={hasAttribute:()=>mark,removeAttribute(){mark=false;}},content={children:[{animate(){calls++;}}]};
 const win={matchMedia:()=>({matches:false})};
 ${code}
 const timeline={closed:true};return {lease:playStartupHome(timeline),calls,registered:!!timeline.homeLease};
 `);
 assert.deepEqual(run(),{lease:null,calls:0,registered:false});
});

test("startup resource preflight samples Home without a horizontal row and resets stale owner snapshots",()=>{
 const code=source.slice(source.indexOf("  let readinessKey="),source.indexOf("  function tick(){"));
 const run=new Function(`
 let time=100,started=0,iconCheckAt=-Infinity,iconStatus=null,homeIcons=null;
 let cards=[{}],calls=0;const row={querySelectorAll:()=>cards};
 const window={__nocturneCenterMotion:{warmIcons(){calls++;return {total:1,pending:0};}},__zenSharedHomeV1:{warmStartupIcons(){return {total:2,pending:1};}}};
 const now=()=>time;
 ${code}
 sampleStartupResources(null);const native={homeIcons,iconStatus,revision:resourceRevision};
 sampleStartupResources(row);const first=resourceRevision;
 cards=[{}];time+=80;sampleStartupResources(row);const changed=resourceRevision;
 window.__nocturneCenterMotion={warmIcons(){return {total:1,pending:1};}};sampleStartupResources(row);
 return {native,first,changed,revision:resourceRevision,iconStatus,calls};
 `);
 assert.deepEqual(run(),{native:{homeIcons:{total:2,pending:1},iconStatus:null,revision:1},first:2,changed:3,revision:4,iconStatus:{total:1,pending:1},calls:2});
});
test("startup readiness exception uses existing fail-open cleanup",()=>{
 const code=assemblyErrorContext+source.slice(source.indexOf("  function tick(){"),source.indexOf("  function checkReadiness(){"));
 const run=new Function(`
 let raf=1,dead=false,playing=false,calls=0,events=[];function checkReadiness(){throw Error("readiness");}function finish(){calls++;dead=true;}function decision(e){events.push(e);}
 ${code}
 tick();tick();return {raf,calls,events};
 `);
 assert.deepEqual(run(),{raf:0,calls:1,events:["assembly.readiness.error"]});
});
test("Home startup lease coalesces passive structural refresh and flushes once",()=>{
 const home=readFileSync(new URL("../src/home/shared-home.js.part",import.meta.url),"utf8");
 const code=home.slice(home.indexOf("  let startupRun="),home.indexOf("  function warmStartupIcons()"));
 const run=new Function(`
 let open=true,dead=false,searchToken=null,renders=0,mark=true,cancelled=0;
 const panel={removeAttribute(){mark=false;}};function render(){renders++;}
 ${code}
 const timeline={},lease={},run={timeline,lease,effects:[{cancel(){cancelled++;}}],dirty:false};timeline.homeLease=lease;startupRun=run;
 refreshHomeStructure();refreshHomeStructure();const before={renders,mark};finishStartupHome(run);finishStartupHome(run);
 return {before,renders,mark,cancelled,owned:!!timeline.homeLease};
 `);
 assert.deepEqual(run(),{before:{renders:0,mark:true},renders:1,mark:false,cancelled:1,owned:false});
});
test("late native Home remains visible without replaying its startup stage",()=>{
 const home=readFileSync(new URL("../src/home/shared-home.js.part",import.meta.url),"utf8");
 const code=home.slice(home.indexOf("  let startupRun="),home.indexOf("  function stopMotion()"));
 const run=new Function(`
 let open=true,dead=false,searchToken=null,mark=true,calls=0;const panel={hasAttribute:()=>mark,removeAttribute(){mark=false;}},content={children:[{animate(){calls++;}}]};
 const win={performance:{now:()=>900},matchMedia:()=>({matches:false})};function render(){}
 ${code}
 const timeline={start:0,scale:1,home:650,paused:false};return {lease:playStartupHome(timeline),calls,mark};
 `);
 assert.deepEqual(run(),{lease:null,calls:0,mark:false});
});

test("Assembly completion cannot extend the inherited deadline or execute stale timers",()=>{
 const code=assemblyErrorContext+source.slice(source.indexOf("  function armFinish("),source.indexOf("  function mountBoot("));
 const run=new Function(`
 let dead=false,settling=false,ownedTimeline=null,deadline=8000,timerEpoch=0,timer=0,time=7000,calls=0;
 const timers=[],window={setTimeout(fn,delay){timers.push({fn,delay});return timers.length;},clearTimeout(){throw Error("clear");}};
 const now=()=>time;function finish(){dead=true;calls++;}function decision(){}
 ${code}
 armFinish(9000);armFinish(7500);timers[0].fn();const stale=calls;timers[1].fn();
 return {delays:timers.map(t=>t.delay),stale,calls};
 `);
 assert.deepEqual(run(),{delays:[1000,500],stale:0,calls:1});
});
test("Assembly inherits the original prelude deadline before mounting",()=>{
 const code=source.slice(source.indexOf("  function claimBoot("),source.indexOf("  // One Assembly timer"));
 const run=new Function(`
 let deadline=10000,earlyBoot=null,phaseBaseline=null,bootBaseline=null,boot=null,phaseOwned=false,bootOwned=false;
 const BOOT_PREF="boot",PHASE="phase",node={};
 const prefs={getBoolPref:()=>true},root={getAttribute:()=>null};
 const window={__nocturneEarlyBoot:{deadline:8000,adopt:()=>({node,deadline:8000,phaseBaseline:null,bootBaseline:null})}};
 ${code}claimBoot();return {deadline,owned:boot===node,phaseOwned,bootOwned};
 `);
 assert.deepEqual(run(),{deadline:8000,owned:true,phaseOwned:true,bootOwned:true});
});

test("shared timing preserves every supported duration and bounds launch and resume",()=>{
 for(let duration=400;duration<=1500;duration++){
   const p=startupTimeline(123,duration/1050);
   assert.equal(p.finishLength,Math.max(duration+80,1190*(duration/1050)));
   assert.equal(p.lateLimit,duration+420);
   assert.equal(startupFits(p,0,p.finishLength),false);
   assert.equal(startupFits(p,0,p.finishLength+1),true);
   assert.equal(startupFits(p,0,p.finishLength+470,470),false);
 }
 const launch=source.slice(source.indexOf("function launch("),source.indexOf("function schedule(){"));
 assert.ok(launch.includes("startupFits(plan,playStart,deadline,overhead)"));
 assert.ok(launch.includes("startupFits(plan,resumedAt,deadline)"));
 assert.ok(source.includes("startupFits(plan,now(),deadline,overhead)"));
});
test("late reveal uses one bounded completion plan or leaves the target ungated",()=>{
 const p=startupTimeline(0,1);
 assert.deepEqual(startupLateEffect(p,0,1190,8000,800,590,440),{delay:0,length:330,finishAt:1195});
 assert.deepEqual(startupLateEffect(p,0,1190,1100,800,590,440),null);
 assert.deepEqual(startupLateEffect(p,0,1190,8000,1300,590,440),null);
 const capped=startupLateEffect(p,0,1190,1105,800,590,440);
 assert.deepEqual(capped,{delay:0,length:240,finishAt:1105});
 assert.ok(source.includes('if(late&&!lateEffect)'));
 assert.ok(source.includes('extendFinish(lateEffect.finishAt)'));
});

test("initial effects use a single document epoch even when prepared at different times",()=>{
 const code=source.slice(source.indexOf("  function bindStartupEpoch("),source.indexOf("  function launch("));
 const run=new Function(`
 let dead=false;const clock={currentTime:500},timeline={paused:true},ownedTimeline=timeline,starts=[],window={};
 const effect=label=>({timeline:clock,playState:"paused",set startTime(value){starts.push([label,value]);}});
 const direct=effect("direct"),tab=effect("tab"),bookmark=effect("bookmark"),home=effect("home");
 const animations=new Map([[direct,{}]]);
 const centerHandle={startupOutcomeVersion:1,resumeAt(fn){clock.currentTime+=7;fn(tab);}},bookmarkHandle={startupOutcomeVersion:1,resumeAt(fn){clock.currentTime+=9;fn(bookmark);}};
 timeline.homeLease={startupOutcomeVersion:1,resumeAt(fn){clock.currentTime+=13;fn(home);}};
 const homeRegistry=null;
 ${code}
 bindStartupEpoch(timeline,clock);timeline.paused=false;
 const legacy=resumePrepared(timeline);const elapsed=timeline.elapsed();
 timeline.startEffect(effect("late"),elapsed);
 return {starts,legacy,elapsed,epoch:timeline.epoch};
 `);
 assert.deepEqual(run(),{starts:[["direct",500],["tab",500],["bookmark",500],["home",500],["late",529]],legacy:0,elapsed:29,epoch:500});
 assert.ok(source.includes("timeline.paused=true"));
 assert.ok(source.includes("}else resume();"));
});
test("document epoch rejects inactive, foreign, cancelled and stale effects",()=>{
 const code=source.slice(source.indexOf("  function bindStartupEpoch("),source.indexOf("  function resumePrepared("));
 const run=new Function(`
 let dead=false,ownedTimeline={paused:false},timeline=ownedTimeline,errors=[],writes=0;
 const clock={currentTime:null};const effect={timeline:clock,playState:"paused",set startTime(v){writes++;}};
 ${code}
 const check=fn=>{try{fn();}catch(e){errors.push(e.message);}};
 check(()=>bindStartupEpoch(timeline,clock));clock.currentTime=10;bindStartupEpoch(timeline,clock);
 check(()=>timeline.startEffect({...effect,timeline:{}}));
 check(()=>timeline.startEffect({...effect,playState:"idle"}));
 check(()=>timeline.startEffect(effect,Infinity));
 timeline.paused=true;check(()=>timeline.startEffect(effect));timeline.paused=false;
 clock.currentTime=null;check(()=>timeline.startEffect(effect));clock.currentTime=20;
 timeline.closed=true;check(()=>timeline.startEffect(effect));timeline.closed=false;
 ownedTimeline={};check(()=>timeline.startEffect(effect));
 return {errors,writes};
 `);
 assert.deepEqual(run(),{errors:["startup-timeline-inactive","startup-effect-timeline","startup-effect-timeline","startup-effect-timeline","startup-epoch-stale","startup-effect-timeline","startup-epoch-stale","startup-epoch-stale"],writes:0});
});
test("epoch resume stops after synchronous disposal and retains explicit legacy fallback",()=>{
 const code=source.slice(source.indexOf("  function resumePrepared("),source.indexOf("  function launch("));
 const run=new Function(`
 let dead=false,ownedTimeline={paused:false},timeline=ownedTimeline,legacyCalls=0,homeCalls=0;
 const animations=new Map(),homeRegistry={resumeStartup(){homeCalls++;}},window={__zenSharedHomeV1:homeRegistry};
 const centerHandle={resume(){legacyCalls++;}},bookmarkHandle={resumeAt(){dead=true;}};
 ${code}
 let reason;try{resumePrepared(timeline);}catch(e){reason=e.message;}
 return {reason,legacyCalls,homeCalls};
 `);
 assert.deepEqual(run(),{reason:"startup-epoch-stale",legacyCalls:1,homeCalls:0});
});
test("late Home uses its absolute delay against document epoch and never replays",()=>{
 const home=readFileSync(new URL("../src/home/shared-home.js.part",import.meta.url),"utf8");
 const code=home.slice(home.indexOf("  let startupRun="),home.indexOf("  function stopMotion()"));
 const run=new Function(`
 let open=true,dead=false,searchToken=null,mark=true,elapsed=300,delays=[],starts=0;
 const panel={hasAttribute:()=>mark,removeAttribute(){mark=false;}};
 const content={children:[0,1].map(()=>({animate(f,o){delays.push(o.delay);return {finished:new Promise(()=>{}),cancel(){}};}}))};
 const win={performance:{now:()=>9999},matchMedia:()=>({matches:false})};function render(){}
 ${code}
 const timeline={start:0,scale:1,home:650,homeLength:330,paused:false,elapsed:()=>elapsed,startEffect(){starts++;}};
 const lease=playStartupHome(timeline);lease.release();mark=true;elapsed=650;
 const late=playStartupHome(timeline);
 return {delays,starts,late,mark};
 `);
 assert.deepEqual(run(),{delays:[650,715],starts:2,late:null,mark:false});
});

test("late reveal uses document elapsed for its stage but performance time for the cap",()=>{
 const p=startupTimeline(0,1);
 const effect=startupLateEffect(p,0,1190,8000,400,590,440,300);
 assert.deepEqual(effect,{delay:290,length:440,finishAt:1195});
 assert.equal(startupLateEffect(p,0,1190,8000,400,590,440,Infinity),null);
});

test("startup outcome separates exact completion, external cancellation and retired effects",async()=>{
 const cancelled=[],progress=[];
 const ledger=createStartupOutcome(s=>cancelled.push(s),()=>progress.push(true));
 const make=()=>{let resolve,reject;const finished=new Promise((a,b)=>{resolve=a;reject=b;});return {finished,resolve,reject,playState:"running"};};
 const a=make(),b=make(),c=make(),d=make();let bCurrent=true;
 ledger.observe(a,"direct",()=>true);ledger.observe(b,"home",()=>bCurrent);
 ledger.observe(c,"tabs",()=>true);ledger.observe(d,"bookmarks",()=>true);
 ledger.observe(a,"direct",()=>true);
 a.resolve();bCurrent=false;b.reject(Error("own release"));c.reject(Error("external"));d.playState="finished";
 await Promise.resolve();
 assert.deepEqual(ledger.snapshot(),{pending:0,finished:2,cancelled:1,retired:1});
 assert.deepEqual(cancelled,["tabs"]);assert.equal(progress.length,2);
 assert.equal(startupBoundaryOutcome(ledger.snapshot()),"effect-cancelled");
 ledger.close();d.reject(Error("stale"));await Promise.resolve();
 assert.deepEqual(cancelled,["tabs"]);assert.deepEqual(ledger.snapshot(),{pending:0,finished:0,cancelled:0,retired:0});
});
test("boundary distinguishes incomplete, retired and legacy completion",()=>{
 assert.equal(startupBoundaryOutcome({pending:1,finished:2}),"boundary-incomplete");
 assert.equal(startupBoundaryOutcome({retired:1,finished:2}),"completed-with-retired");
 assert.equal(startupBoundaryOutcome({finished:2},1),"completed-unverified");
 assert.equal(startupBoundaryOutcome({finished:2}),"completed");
 const ledger=createStartupOutcome(()=>{throw Error("unexpected cancellation");});
 const effect={finished:new Promise(()=>{}),playState:"idle"};
 ledger.observe(effect,"tabs",()=>true);
 assert.equal(startupBoundaryOutcome(ledger.snapshot()),"effect-cancelled");
 ledger.close();
});
test("normal boundary allows one capped grace period and no stale timer completion",()=>{
 const code=assemblyErrorContext+source.slice(source.indexOf("  function armFinish("),source.indexOf("  function mountBoot("));
 const run=new Function(`
 let dead=false,settling=false,deadline=8000,timerEpoch=0,timer=0,time=1000,playStart=0;
 const plan={lateLimit:1100},ownedTimeline={outcome:{snapshot:()=>({pending:1,cancelled:0})}},timers=[],events=[];
 const now=()=>time,window={setTimeout(fn,delay){timers.push({fn,delay});return timers.length;},clearTimeout(){}};
 function finish(reason){events.push(reason);dead=true;}function decision(){}
 ${code}
 armFinish(1010);time=1010;timers[0].fn();timers[0].fn();
 const before={closed:ownedTimeline.closed,reached:ownedTimeline.boundaryReached,events:[...events],delays:timers.map(t=>t.delay)};
 time=1100;timers[1].fn();timers[1].fn();return {before,events};
 `);
 assert.deepEqual(run(),{before:{closed:true,reached:true,events:[],delays:[10,90]},events:["boundary"]});
});
test("current Home keeps the exact lease through normal effect completion until Assembly releases it",async()=>{
 const home=readFileSync(new URL("../src/home/shared-home.js.part",import.meta.url),"utf8");
 const code=home.slice(home.indexOf("  let startupRun="),home.indexOf("  function stopMotion()"));
 const run=new Function("createStartupOutcome",`
 let open=true,dead=false,searchToken=null,mark=true,dirty=0,cancelled=0,resolve;
 const panel={hasAttribute:()=>mark,removeAttribute(){mark=false;}};
 const a={finished:new Promise(r=>resolve=r),pause(){},cancel(){cancelled++;}};
 const content={children:[{animate(){return a;}}]},win={matchMedia:()=>({matches:false})};
 function render(){dirty++;}
 ${code}
 const ledger=createStartupOutcome(()=>{throw Error("unexpected");});
 const timeline={start:0,scale:1,home:650,homeLength:330,paused:true,observeEffect:ledger.observe};
 const lease=playStartupHome(timeline);refreshHomeStructure();resolve();
 return Promise.resolve().then(()=>{
   const before={owned:timeline.homeLease===lease,mark,dirty,counts:ledger.snapshot()};
   timeline.closed=true;ledger.close();lease.release();
   return {before,owned:!!timeline.homeLease,mark,dirty,cancelled};
 });
 `);
 assert.deepEqual(await run(createStartupOutcome),{before:{owned:true,mark:true,dirty:0,counts:{pending:0,finished:1,cancelled:0,retired:0}},owned:false,mark:false,dirty:1,cancelled:1});
});
test("Assembly abort does not seal cancelled proxy effects",()=>{
 const code=source.slice(source.indexOf("  function finish(reason="),source.indexOf("  function settle(){"));
 const run=new Function(`
 let dead=false,playing=true,settling=false,raf=0,timer=0,nativeTimer=0,nativeFrame=0,nativeFrame2=0,lateFrame=0,lateObserver=null,lateResize=null,nativeObserver=null,centerHandle={seal(){log.push("seal");},release(){log.push("release");}},bookmarkHandle=null,sheetURI=null,style=null,holdNode=null,bootPreparing=false;
 const log=[],KEY="assembly",PHASE="phase",HOLD="hold",MANAGED="managed",EXISTING="existing",ENABLE="enable",started=0,now=()=>1;
 const window={removeEventListener(){},__nocturneTrace(){}};const root={},reduced={removeEventListener(){}},prefs={removeObserver(){}},Services={};
 const animations=new Map(),owned=new Map(),seen=new Set(),baseline=new Set(),inputs=[];
 let pendingEngine=null,homeRegistry=null,ownedTimeline={outcome:{snapshot:()=>({cancelled:1}),close(){log.push("close");}}},phaseOwned=false,phaseBaseline=null,holdBaseline=null;
 function restoreMark(){}function restore(){}function removeBoot(){}function interrupt(){}function onResize(){}function schedule(){}function preferenceChanged(){}
 ${code}window[KEY]=finish;finish("effect-cancelled");finish("completed");return log;
 `);
 assert.deepEqual(run(),["close","release"]);
});

test("settlement retires Home before direct replacement and prevents late admission",()=>{
 const code=source.slice(source.indexOf("  function settle(){"),source.indexOf("  function interrupt("));
 const run=new Function(`
 let dead=false,playing=true,settling=false,bootPreparing=false,lateObserver=null,lateResize=null,lateFrame=0,log=[];
 const a={cancel(){log.push("cancel");}},animations=new Map([[a,{n:{},frames:[{opacity:0},{opacity:1}]}]]);
 const ownedTimeline={paused:false,homeLease:{release(){log.push(ownedTimeline.closed?"home-closed":"home-open");}}};
 let centerHandle={seal(){log.push("unexpected-seal");},release(){log.push("tabs-release");}},bookmarkHandle={seal(){log.push("unexpected-seal");},release(){log.push("bookmarks-release");}};
 const reduced={matches:false},root={setAttribute(){}},PHASE="phase",FADE="ease",window={getComputedStyle(){return {opacity:".5"};}};
 function play(){log.push("settle");return true;}function armFinish(){log.push("timer");}function now(){return 0;}function finish(){dead=true;}function decision(){}
 ${code}settle();return {log,closed:ownedTimeline.closed};
 `);
 assert.deepEqual(run(),{log:["home-closed","tabs-release","bookmarks-release","cancel","settle","timer"],closed:true});
});

test("terminal snapshot sees active ownership before dead flag and classifies incomplete",()=>{
 const code=source.slice(source.indexOf("  function finish(reason="),source.indexOf("  function settle(){"));
 const run=new Function("createStartupOutcome","startupBoundaryOutcome",`
 let dead=false,playing=true,settling=false,raf=0,timer=0,nativeTimer=0,nativeFrame=0,nativeFrame2=0,lateFrame=0,lateObserver=null,lateResize=null,nativeObserver=null,centerHandle={seal(){log.push("seal");},release(){log.push("release");}},bookmarkHandle=null,sheetURI=null,style=null,holdNode=null,bootPreparing=false;
 const log=[],KEY="assembly",PHASE="phase",HOLD="hold",MANAGED="managed",EXISTING="existing",ENABLE="enable",started=0,now=()=>1;
 const window={removeEventListener(){},__nocturneTrace(e,fn){if(e==="assembly.finish"){const d=fn();log.push(d.reason,d.counts);}}};
 const root={},reduced={removeEventListener(){}},prefs={removeObserver(){}},Services={};
 const animations=new Map(),owned=new Map(),seen=new Set(),baseline=new Set(),inputs=[];
 const outcome=createStartupOutcome(()=>{throw Error("unexpected");});
 outcome.observe({finished:new Promise(()=>{}),playState:"running"},"tabs",()=>!dead);
 let pendingEngine=null,homeRegistry=null,ownedTimeline={outcome},phaseOwned=false,phaseBaseline=null,holdBaseline=null;
 function restoreMark(){}function restore(){}function removeBoot(){}function interrupt(){}function onResize(){}function schedule(){}function preferenceChanged(){}
 ${code}window[KEY]=finish;finish("boundary");return log;
 `);
 assert.deepEqual(run(createStartupOutcome,startupBoundaryOutcome),["boundary-incomplete",{pending:1,finished:0,cancelled:0,retired:0},"release"]);
});
test("retained finished WAAPI cancellation reaches ledger and detaches listener on close",async()=>{
 const cancelled=[],listeners=new Map();
 const ledger=createStartupOutcome(s=>cancelled.push(s));
 let resolve;const effect={finished:new Promise(r=>resolve=r),playState:"running",addEventListener(k,f){listeners.set(k,f);},removeEventListener(k,f){if(listeners.get(k)===f)listeners.delete(k);}};
 ledger.observe(effect,"home",()=>true);effect.playState="finished";resolve();await Promise.resolve();
 assert.equal(ledger.snapshot().finished,1);
 effect.playState="idle";assert.equal(ledger.snapshot().cancelled,1);listeners.get("cancel")();
 assert.deepEqual(cancelled,["home"]);assert.equal(ledger.snapshot().cancelled,1);
 ledger.close();assert.equal(listeners.size,0);
});
test("intentional direct fill removal preserves successful outcome",async()=>{
 const ledger=createStartupOutcome(()=>{throw Error("unexpected");});let current=true,resolve,listener;
 const effect={finished:new Promise(r=>resolve=r),playState:"running",addEventListener(k,f){listener=f;},removeEventListener(){}};
 ledger.observe(effect,"direct",()=>current);effect.playState="finished";resolve();await Promise.resolve();
 current=false;effect.playState="idle";listener();
 assert.equal(ledger.snapshot().finished,1);assert.equal(ledger.snapshot().cancelled,0);ledger.close();
});
test("epoch-capable legacy handles without outcome capability remain unverified",()=>{
 const code=source.slice(source.indexOf("  function resumePrepared("),source.indexOf("  function launch("));
 const run=new Function(`
 let dead=false,ownedTimeline={paused:false,startEffect(){}},timeline=ownedTimeline,starts=0;
 const animations=new Map(),homeRegistry={startupLeaseVersion:1,startupOutcomeVersion:1},window={__zenSharedHomeV1:homeRegistry};
 const centerHandle={resumeAt(){starts++;}},bookmarkHandle={startupOutcomeVersion:1,resumeAt(){starts++;}};
 ${code}return {legacy:resumePrepared(timeline),starts};
 `);
 assert.deepEqual(run(),{legacy:1,starts:2});
});
test("finish timer acquisition failure cannot strand Assembly",()=>{
 const code=assemblyErrorContext+source.slice(source.indexOf("  function armFinish("),source.indexOf("  function mountBoot("));
 const run=new Function(`
 let dead=false,deadline=8000,timerEpoch=0,timer=0,time=1000,log=[];
 const window={setTimeout(){throw Error("timer");}},now=()=>time;
 function finish(reason){log.push(reason);dead=true;}function decision(){}
 ${code}armFinish(1200);return log;
 `);
 assert.deepEqual(run(),["setup-failed"]);
});

test("late reveal cannot write styles after synchronous boundary cleanup",()=>{
 const code=source.slice(source.indexOf("    if(lateEffect)extendFinish("),source.indexOf("    let acquired=false;",source.indexOf("    if(lateEffect)extendFinish(")));
 const run=new Function(`
 let dead=false;const timeline={},lateEffect={finishAt:100};let effects=0;
 function extendFinish(){dead=true;timeline.closed=true;}
 function reveal(){${code}effects++;return true;}
 return {value:reveal(),effects};
 `);
 assert.deepEqual(run(),{value:false,effects:0});
});

test("startup geometry rejection releases startup rather than acquiring effects",()=>{
 const start=source.indexOf("  function launch(one)"),end=source.indexOf("      const engine=",start);
 const prefix=source.slice(start,end);
 const run=new Function("mode",`
 let dead=false,playing=false,settling=false,boot=null,bootPreparing=false,started=0;
 const root={getAttribute:()=>null},PHASE="phase",READY="ready",now=()=>0,events=[];
 const window={__nocturneTrace(){},__oneplaneLayoutController:{geometryPreflightVersion:1,prepareWorkspaceGeometry(){
   if(mode==="replacement")window.__oneplaneLayoutController={};
   if(mode==="disposed")dead=true;
   return mode==="false"?false:mode==="undefined"||mode==="legacy"?undefined:true;
 }}};
 if(mode==="missing")delete window.__oneplaneLayoutController;
 if(mode==="missing-method")delete window.__oneplaneLayoutController.prepareWorkspaceGeometry;
 if(mode==="legacy")delete window.__oneplaneLayoutController.geometryPreflightVersion;
 function finish(reason){events.push(reason);dead=true;}
 ${prefix}events.push("effects");}catch(error){throw error;}}
 launch(mode!=="native");return events;
 `);
 for(const mode of ["false","undefined","missing","replacement","missing-method"])assert.deepEqual(run(mode),["geometry-unready"],mode);
 for(const mode of ["ready","legacy","native"])assert.deepEqual(run(mode),["effects"],mode);
 assert.deepEqual(run("disposed"),[]);
});
