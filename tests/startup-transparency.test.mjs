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
 'let dead=false,playing=true,settling=false,lateObserver=null,lateResize=null,lateFrame=0,timer=0;const reduced={matches:false},PHASE="phase",FADE="ease",root={setAttribute(){}},log=[];const a={cancel(){log.push("cancel");}},n={},complete=()=>{};const animations=new Map([[a,{n,frames:[{"--p":"0"},{"--p":"1"}],complete}]]);const window={getComputedStyle(){return {getPropertyValue(){return ".37"}}},setTimeout(fn,t){log.push(t);return 1},clearTimeout(){}};function play(n,f,d,t){log.push(f[0]["--p"],f[1]["--p"],t);return true}function finish(){log.push("finish")}settle();settle();return log;');
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
 assert.equal(ready(649,0,650,0,8000),false);
 assert.equal(ready(650,0,650,530,8000),true);
 assert.equal(ready(700,0,650,650,8000),false);
 assert.equal(ready(8000,0,650,7999,8000),true);
 assert.ok(source.includes('if(!prefs.getBoolPref(BOOT_PREF,true))return;'));
 assert.ok(source.includes('root.append(boot)'));
 assert.ok(source.includes('boot.inert=true'));
 assert.ok(source.includes('pointerEvents:"none"'));
 assert.ok(source.includes('bootPreparing=false;removeBoot();'));
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
