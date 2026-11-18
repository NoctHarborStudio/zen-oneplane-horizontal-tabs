import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../startup-animation.uc.mjs",import.meta.url),"utf8");
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
 'let dead=false,playing=true,settling=false,bootPreparing=false,lateObserver=null,lateResize=null,lateFrame=0,timer=0;const reduced={matches:false},PHASE="phase",FADE="ease",root={setAttribute(){}},log=[];const a={cancel(){log.push("cancel");}},n={},complete=()=>{};const animations=new Map([[a,{n,frames:[{"--p":"0"},{"--p":"1"}],complete}]]);const window={getComputedStyle(){return {getPropertyValue(){return ".37"}}},setTimeout(fn,t){log.push(t);return 1},clearTimeout(){}};function play(n,f,d,t){log.push(f[0]["--p"],f[1]["--p"],t);return true}function finish(){log.push("finish")}settle();settle();return log;');
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
 assert.ok(source.includes("if(playing&&changed){if(bootPreparing)finish();else settle();}"));
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
 const a=source.indexOf("function startupTimeline("),b=source.indexOf("const started=",a);
 const plan=new Function(source.slice(a,b)+"return startupTimeline")();
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
 assert.ok(source.includes('if(!prefs.getBoolPref(BOOT_PREF,true))window.__nocturneEarlyBoot?.cleanup?.()'));
 assert.ok(source.includes('root.append(boot)'));
 assert.ok(source.includes('boot.inert=true'));
 assert.ok(source.includes('pointerEvents:"none"'));
 assert.ok(source.includes('bootPreparing=false;step(removeBoot);'));
});
test("all prepared effects remain paused until the boot handoff",()=>{
 const launch=source.slice(source.indexOf("function launch("),source.indexOf("function schedule(){"));
 assert.ok(launch.includes('timeline.paused=bootPreparing'));
 assert.ok(launch.includes('paused:bootPreparing'));
 assert.ok(launch.includes('exitBoot(resume)'));
 assert.ok(launch.includes('timer=window.setTimeout(finish,Math.max(0,deadline-now()))'));
 assert.ok(launch.includes('centerHandle?.resume?.();bookmarkHandle?.resume?.()'));
 assert.ok(source.includes('if(bootPreparing){a.pause();a.currentTime=0;}'));
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
 assert.ok(pre.includes('timer=win.setTimeout(cleanup,8000)'));
 assert.ok(source.includes('earlyBoot=window.__nocturneEarlyBoot?.adopt?.()'));
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
 const code=source.slice(source.indexOf("  function finish(){"),source.indexOf("  function settle(){"));
 const run=new Function(`
 let dead=false,playing=true,settling=false,raf=1,timer=2,nativeTimer=3,nativeFrame=0,nativeFrame2=0,lateFrame=4,lateObserver={disconnect(){throw Error("observer");}},lateResize=null,nativeObserver=null,centerHandle={seal(){throw Error("seal");},release(){log.push("center");}},bookmarkHandle={seal(){},release(){log.push("bookmarks");}},sheetURI=null,style=null,holdNode=null,bootPreparing=true;
 const log=[],KEY="assembly",PHASE="phase",HOLD="hold",MANAGED="managed",EXISTING="existing",ENABLE="enable",started=0,now=()=>1;
 const window={cancelAnimationFrame(){},clearTimeout(){},removeEventListener(){},__nocturneCenterMotion:{releasePending(){log.push("pending");}},__zenSharedHomeV1:{finishStartup(){throw Error("home");}},__nocturneTrace(e,d){if(e==="assembly.cleanup")log.push(d.failed);}};
 const root={removeAttribute(){log.push("phase");}},reduced={removeEventListener(){}},prefs={removeObserver(){}},Services={};
 const animations=new Map(),owned=new Map(),seen=new Set(),baseline=new Set(),inputs=[];
 let pendingEngine=window.__nocturneCenterMotion,homeRegistry=window.__zenSharedHomeV1,ownedTimeline={},phaseOwned=true,phaseBaseline=null,holdBaseline=null;
 function restoreMark(n,k,v){n.removeAttribute(k);}
 function restore(){}function removeBoot(){log.push("boot");}function interrupt(){}function onResize(){}function schedule(){}function preferenceChanged(){}
 ${code}window[KEY]=finish;finish();finish();return {log,registered:!!window[KEY]};`);
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
 const code=source.slice(source.indexOf("  function play(n,"),source.indexOf("  function save("));
 return new Function("paused","pauseFails","cancelDuringAnimate",`
  let dead=false,bootPreparing=paused,animations=new Map(),events=[],callbacks=[],EASE="ease";
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
 const code=source.slice(source.indexOf("  function acquireStartupBookmarks("),source.indexOf("  function scheduleLate("));
 return new Function("mode",`
 let dead=false,centerHandle={},seen=new Set(),bootPreparing=true,scale=1;const MANAGED="managed",events=[];
 const attrs=new Map(),n={getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
 const items={children:[n]},timeline={bookmarks:470};
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
 const f=fixture(),record=f.window.__nocturneEarlyBoot;const adopted=record.adopt();assert.equal(adopted.node,f.node);assert.equal(adopted.phaseBaseline,"prior-phase");assert.equal(adopted.bootBaseline,"prior-boot");record.cleanup();assert.equal(f.node.isConnected,true);
 const g=fixture();g.timer();assert.equal(g.node.isConnected,false);assert.equal(g.attrs.get("data-zr-startup-phase"),"prior-phase");assert.equal(g.attrs.get("data-nocturne-boot"),"prior-boot");
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
 const code=source.slice(source.indexOf("  function tick(){"),source.indexOf("  function checkReadiness(){"));
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
