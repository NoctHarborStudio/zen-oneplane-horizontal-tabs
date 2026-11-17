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
test("startup does not create an opaque full-window or page layer",()=>{
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
 assert.ok(source.includes("if(playing&&changed)settle()"));
});

test("startup keeps the waiting gate until targets own their resting styles",()=>{
 const launch=source.slice(source.indexOf("function launch("),source.indexOf("function schedule(){"));
 assert.ok(launch.indexOf('engine?.start(row')<launch.indexOf('root.setAttribute(PHASE,"playing")'));
 assert.ok(source.includes(':is(#zr-startup-specificity,[data-zr-startup-managed])'));
 assert.ok(source.includes('const painted=!gated&&cards.some(n=>baseline.has(n))'));
});
