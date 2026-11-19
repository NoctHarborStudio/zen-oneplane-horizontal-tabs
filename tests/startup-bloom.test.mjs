import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {startupBloomTimeline,startupBloomStagger,startupBloomOrder,startupBloomFrames} from "../src/algorithms/startup-bloom.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const near=(a,b)=>Math.abs(a-b)<1e-7;

test("reconstructed Bloom preserves documented stage windows on one nonnegative visible clock",()=>{
 const p=startupBloomTimeline();
 assert.deepEqual([p.panel.start,p.islandShape.start,p.islandLabel.end,p.tabs.start,p.tabs.end,p.bookmarks.start,p.bookmarks.end,p.search.start,p.search.end,p.pins.start,p.pins.end,p.workspaces.start,p.workspaces.end,p.footer.start,p.footer.end,p.end],[0,140,700,390,1000,660,1120,770,1290,990,1560,1280,1750,1540,1850,1920]);
 assert.ok(p.islandShape.end<=p.islandLabel.start);
 assert.ok(p.footer.end<=p.end);
 assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.tabs));
});
test("Bloom stagger stays finite and inside every stage at all supported durations and large counts",()=>{
 for(let duration=400;duration<=1500;duration++){
  const p=startupBloomTimeline(duration/1050);
  for(const k of ["tabs","bookmarks","pins","workspaces"]){
   const stage=p[k];
   assert.deepEqual(startupBloomStagger(0,stage),[]);
   for(const count of [1,5,30,100,1000]){
    const schedule=startupBloomStagger(count,stage);
    assert.equal(schedule.length,count);
    assert.ok(near(schedule[0].delay,stage.start));
    assert.ok(near(schedule.at(-1).delay+schedule.at(-1).duration,stage.end));
    for(let i=0;i<schedule.length;i++){
     const {delay,duration}=schedule[i];
     assert.ok(Number.isFinite(delay)&&Number.isFinite(duration));
     assert.ok(delay>=stage.start-1e-7&&duration>=stage.min-1e-7&&delay+duration<=stage.end+1e-7);
     if(i)assert.ok(delay>=schedule[i-1].delay-1e-7&&delay-schedule[i-1].delay<=stage.step+1e-7);
    }
   }
  }
 }
});
test("large collections compress stagger rather than item duration",()=>{
 const stage=startupBloomTimeline().tabs;
 const few=startupBloomStagger(5,stage),many=startupBloomStagger(1000,stage);
 assert.ok(few[0].duration>many[0].duration);
 assert.ok(near(many[0].duration,stage.min));
 assert.ok(many[1].delay-many[0].delay<few[1].delay-few[0].delay);
});
test("center wave orders visible slots stably and treats split groups as a unit",()=>{
 const slots=[{id:"far",x:300,y:20},{id:"lower",x:520,y:70},{id:"left",x:480,y:20},{id:"group",x:520,y:20},{id:"center",x:500,y:70}];
 const before=slots.slice();
 assert.deepEqual(startupBloomOrder(slots,{x:500,y:20}).map(x=>x.id),["center","left","group","lower","far"]);
 assert.deepEqual(slots,before);
 assert.equal(startupBloomOrder([slots[3]],{x:500,y:20})[0],slots[3]);
});
test("all Bloom card keyframes and interpolated rectangles remain inside disjoint resting slots",()=>{
 for(const opacity of [0,.42,1]){
  const frames=startupBloomFrames("card",opacity);
  assert.equal(frames[0].opacity,0);assert.equal(frames.at(-1).opacity,opacity);
  assert.equal(frames.at(-1).scale,"1");
  // The easing curves have monotone y control points in [0,1];
  // interpolation cannot escape either endpoint's scale.
  for(let i=1;i<frames.length;i++)for(let j=0;j<=100;j++){
   const t=j/100,s=Number(frames[i-1].scale)*(1-t)+Number(frames[i].scale)*t;
   assert.ok(s>=0&&s<=1+1e-12);
   for(const w of [1,20,80,400]){
    const half=w*s/2;
    assert.ok(half<=w/2+1e-10);
   }
  }
 }
 assert.equal(startupBloomFrames("search")[0].scale,"0.86");
 assert.equal(startupBloomFrames("islandShape").at(-1).scale,"1 1");
});
test("Bloom rejects invalid scale, stage, slot and visual input",()=>{
 for(const v of [0,-1,NaN,Infinity,Number.MAX_VALUE])assert.throws(()=>startupBloomTimeline(v),RangeError);
 assert.throws(()=>startupBloomStagger(-1,startupBloomTimeline().tabs),RangeError);
 assert.throws(()=>startupBloomStagger(1,{start:0,end:0,min:1,step:0}),RangeError);
 assert.throws(()=>startupBloomOrder([{x:NaN,y:0}],{x:0,y:0}),RangeError);
 assert.throws(()=>startupBloomFrames("card",2),RangeError);
});
test("generated comparison Lab uses shared Fold, startup timeline and candidate functions without Sine registration",()=>{
 const plan=JSON.parse(read("scripts/build-plan.json")),html=read("docs/nocturne/labs/startup-motion.html");
 const assemble=entries=>entries.map(({path,kind})=>{
  const s=read(path);
  return kind==="esm-inline"?s.replace(/^import [^\n]+\n/gm,"").replace(/^([ \t]*)export (function|const) /gm,"$1$2 "):s;
 }).join("");
 assert.equal(html,assemble(plan.startupMotionLab));
 assert.ok(html.includes("const plan=startupTimeline(0,scale);"));
 assert.ok(html.includes("const plan=startupBloomTimeline(scale);"));
 assert.ok(html.includes("fold.keyframes(card)"));
 assert.ok(html.includes("a.startTime=epoch;"));
 const layout=read("layout.uc.mjs");
 assert.ok(layout.includes(assemble([{path:"src/algorithms/magnetic-fold.mjs",kind:"esm-inline"}])));
 assert.ok(!layout.includes("function startupBloomTimeline("));
 assert.ok(!read("theme.json").includes("startup-motion.html"));
 assert.ok(!read("startup-animation.uc.mjs").includes("startupBloomTimeline("));
 assert.doesNotThrow(()=>new Function(html.split("<script>")[1].split("</script>")[0]));
});
