import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {overflowScrollMetrics,overflowScrollEase} from "../src/algorithms/tab-overflow.mjs";
test("overflow slider represents visible fraction and position",()=>{
 assert.deepEqual(overflowScrollMetrics(400,800,200),{visible:true,max:400,position:.5,value:500,thumb:200});
 assert.equal(overflowScrollMetrics(400,800,400).value,1000);
 assert.equal(overflowScrollMetrics(400,800,-20).value,0);
 assert.equal(overflowScrollMetrics(400,800,900).value,1000);
 assert.equal(overflowScrollMetrics(400,401,0).visible,false);
 assert.equal(overflowScrollMetrics(0,800,0).visible,false);
 assert.equal(overflowScrollMetrics(100,10000,0).thumb,20);
});
test("range controls the real bottom viewport and reflects scroll",()=>{
 const src=readFileSync(new URL("../src/toolbar/hover.js.part",import.meta.url),"utf8");
 const code=src.slice(src.indexOf("  let overflowSliderFrame="));
 const lane={clientWidth:400,scrollWidth:800,scrollLeft:0,hidden:false};
 const slider={hidden:true,value:"0",style:{getPropertyValue(){return ""},setProperty(){}},getAttribute(){},setAttribute(){}};
 const api=new Function("bottomLane","overflowSlider","overflowScrollMetrics",`
  const row={hasAttribute:k=>k==="data-op-overflow-row"};let dead=false,cascadeState="idle";const reducedMotion={matches:true};
  ${code}
  return {refreshOverflowSlider,onOverflowSliderInput};
 `)(lane,slider,overflowScrollMetrics);
 api.refreshOverflowSlider();assert.equal(slider.hidden,false);assert.equal(slider.value,"0");
 slider.value="750";api.onOverflowSliderInput();assert.equal(lane.scrollLeft,300);
 lane.scrollLeft=100;api.refreshOverflowSlider();assert.equal(slider.value,"250");
 lane.scrollWidth=400;api.refreshOverflowSlider();assert.equal(slider.hidden,true);
});
test("compact backing uses the single contour before the root closes",()=>{
 const css=readFileSync(new URL("../src/styles/contour.css.part",import.meta.url),"utf8");
 const opaque=css.indexOf("#nav-bar:has(#oneplane-tabs[data-op-overflow-row])");
 assert.ok(opaque>css.indexOf("background: transparent !important;"));
 assert.ok(opaque<css.indexOf("/* Persistent mode:"));
 assert.match(css.slice(opaque,css.indexOf("/* Persistent mode:")),/background:\s*transparent\s*!important/);
 assert.ok(css.trimEnd().endsWith("}\n}"));
 assert.ok(css.includes("mask-image: var(--op-contour-mask"));
});

test("smooth scroll eases to the target without overshooting",()=>{
 assert.equal(overflowScrollEase(0,300,0),0);
 assert.ok(overflowScrollEase(0,300,40)>0&&overflowScrollEase(0,300,40)<300);
 assert.ok(overflowScrollEase(0,300,80)>overflowScrollEase(0,300,40));
 assert.equal(overflowScrollEase(0,300,145),300);
 assert.equal(overflowScrollEase(300,0,200),0);
 assert.equal(overflowScrollEase(10,20,0,0),20);
});
test("real scroll controller accumulates wheel targets and direct drag cancels easing",()=>{
 const src=readFileSync(new URL("../src/toolbar/hover.js.part",import.meta.url),"utf8");
 const code=src.slice(src.indexOf("  let overflowSliderFrame="));
 const lane={clientWidth:400,scrollWidth:1000,scrollLeft:0,hidden:false};
 const slider={hidden:false,value:"0",style:{getPropertyValue(){return ""},setProperty(){}},getAttribute(){},setAttribute(){},getBoundingClientRect(){return {left:0,width:400}}};
 let now=0,serial=0;const frames=new Map();
 const win={performance:{now:()=>now},requestAnimationFrame(f){frames.set(++serial,f);return serial},cancelAnimationFrame(id){frames.delete(id)}};
 const api=new Function("bottomLane","overflowSlider","overflowScrollMetrics","overflowScrollEase","window",`
  const row={hasAttribute:k=>k==="data-op-overflow-row"};let dead=false,cascadeState="idle";const reducedMotion={matches:false},prefs={getIntPref:()=>160};
  ${code}
  return {scrollOverflowBy,onOverflowSliderInput,onOverflowPointerDown,onOverflowPointerEnd};
 `)(lane,slider,overflowScrollMetrics,overflowScrollEase,win);
 const step=t=>{now=t;const batch=[...frames.values()];frames.clear();for(const f of batch)f(t)};
 api.scrollOverflowBy(100);api.scrollOverflowBy(100);
 assert.equal(lane.scrollLeft,0);step(70);assert.ok(lane.scrollLeft>0&&lane.scrollLeft<200);step(145);assert.equal(lane.scrollLeft,200);
 api.scrollOverflowBy(150);step(180);assert.ok(lane.scrollLeft>200);
 const m=overflowScrollMetrics(400,1000,lane.scrollLeft);
 api.onOverflowPointerDown({button:0,pointerId:1,clientX:m.thumb/2+m.position*(400-m.thumb)});
 slider.value="500";api.onOverflowSliderInput();assert.equal(lane.scrollLeft,300);assert.equal(frames.size,0);
 api.onOverflowPointerEnd({pointerId:1});
});
