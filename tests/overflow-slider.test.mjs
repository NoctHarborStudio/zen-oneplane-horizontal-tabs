import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {overflowScrollMetrics} from "../src/algorithms/tab-overflow.mjs";
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
  const row={hasAttribute:k=>k==="data-op-overflow-row"};let dead=false,cascadeState="idle";
  ${code}
  return {refreshOverflowSlider,onOverflowSliderInput};
 `)(lane,slider,overflowScrollMetrics);
 api.refreshOverflowSlider();assert.equal(slider.hidden,false);assert.equal(slider.value,"0");
 slider.value="750";api.onOverflowSliderInput();assert.equal(lane.scrollLeft,300);
 lane.scrollLeft=100;api.refreshOverflowSlider();assert.equal(slider.value,"250");
 lane.scrollWidth=400;api.refreshOverflowSlider();assert.equal(slider.hidden,true);
});
test("opaque compact backing is scoped before the root closes",()=>{
 const css=readFileSync(new URL("../src/styles/contour.css.part",import.meta.url),"utf8");
 const opaque=css.indexOf("#nav-bar:has(#oneplane-tabs[data-op-overflow-row])");
 assert.ok(opaque>css.indexOf("background: transparent !important;"));
 assert.ok(opaque<css.indexOf("/* Persistent mode:"));
 assert.ok(css.includes("background:var(--op-surface-tint)!important;"));
 assert.ok(css.trimEnd().endsWith("}\n}"));
 assert.ok(css.includes("mask-image: var(--op-contour-mask"));
});
