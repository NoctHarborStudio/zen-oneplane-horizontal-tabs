import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const source=read("src/core/center-motion.js.part");
const a=source.indexOf("function planLane("),b=source.indexOf("function collect(",a);
const {planLane,keyframes}=new Function('const X="--zr-center-x",A="--zr-center-alpha";'+source.slice(a,b)+"return {planLane,keyframes};")();
const make=(left,width)=>({left,right:left+width,opacity:1});
function at(frames,t,key){
 const next=frames.findIndex(f=>f.offset>=t);
 if(next<=0)return parseFloat(frames[0][key]);
 const a=frames[next-1],b=frames[next],p=(t-a.offset)/(b.offset-a.offset);
 return parseFloat(a[key])+(parseFloat(b[key])-parseFloat(a[key]))*p;
}
test("mixed width cards stay in order and never overlap when visible",()=>{
 const cards=[make(10,40),make(53,95),make(151,36),make(220,36),make(259,110),make(372,42)];
 const plan=planLane(cards,200),total=Math.max(24,...plan.map(c=>c.start+Math.max(c.near,24)));
 for(const reverse of [false,true]){
  const frames=plan.map(c=>keyframes(c,total,reverse));
  for(let k=0;k<=1000;k++){
   const t=k/1000,visible=plan.map((c,i)=>({left:c.left+at(frames[i],t,"--zr-center-x"),right:c.right+at(frames[i],t,"--zr-center-x"),alpha:at(frames[i],t,"--zr-center-alpha")})).filter(c=>c.alpha>1e-7).sort((a,b)=>a.left-b.left);
   for(let i=1;i<visible.length;i++)assert.ok(visible[i-1].right<=visible[i].left+1e-6,`overlap at ${t}`);
  }
 }
});
test("shared choreography has monotonic movement and exact reverse endpoints",()=>{
 const plan=planLane([make(20,36),make(59,36),make(98,36)],160);
 const total=Math.max(24,...plan.map(c=>c.start+Math.max(c.near,24)));
 for(const c of plan){
  const f=keyframes(c,total),r=keyframes(c,total,true);
  assert.equal(f[0]["--zr-center-alpha"],"0");
  assert.equal(f.at(-1)["--zr-center-x"],"0px");
  assert.equal(f.at(-1)["--zr-center-alpha"],"1");
  assert.equal(r[0]["--zr-center-x"],"0px");
  assert.equal(r.at(-1)["--zr-center-alpha"],"0");
  for(let i=1;i<f.length;i++)assert.ok(Math.abs(parseFloat(f[i]["--zr-center-x"]))<=Math.abs(parseFloat(f[i-1]["--zr-center-x"])));
 }
});
test("all three lifecycle controllers use the same window engine",()=>{
 for(const p of ["startup-animation.uc.mjs","closing-animation.uc.mjs","workspace-transition.uc.mjs"])assert.ok(read(p).includes("__nocturneCenterMotion"));
 assert.ok(read("layout.uc.mjs").includes(source));
 assert.ok(!read("workspace-transition.uc.mjs").includes("function cardOffsets("));
 assert.ok(!read("startup-animation.uc.mjs").includes("function collectTabs("));
});
test("ordinary tab selection is immediate and does not inspect content",()=>{
 assert.ok(source.includes('tc.addEventListener("TabSelect",onSelect)'));
 assert.ok(source.includes('duration:180'));
 for(const forbidden of ["contentDocument","contentWindow","drawSnapshot","setTimeout(onSelect"])assert.ok(!source.includes(forbidden));
});
