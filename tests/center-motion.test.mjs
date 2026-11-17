import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const source=read("src/core/center-motion.js.part");
const a=source.indexOf("const clamp="),b=source.indexOf("function collect(",a);
const {magnetState,keyframes}=new Function(source.slice(a,b)+"return {magnetState,keyframes};")();
const card=(x,y,lower=false)=>({x,y,cx:500,cy:26,unit:1,opacity:1,lower});
test("Magnetic Fold reaches the real two-dimensional hub and reverses exactly",()=>{
 for(const c of [card(200,26),card(770,26),card(340,61,true),card(500,61,true)]){
  const f=keyframes(c),r=keyframes(c,true);
  assert.equal(f[0].opacity,0);assert.equal(f.at(-1).opacity,1);
  const start=magnetState(c,0),end=magnetState(c,1);
  assert.equal(c.x+start.x,500);assert.equal(c.y+start.y,26);
  assert.ok(end.x===0);assert.ok(end.y===0);assert.equal(end.s,1);
  for(let i=0;i<f.length;i++){assert.equal(f[i].transform,r.at(-1-i).transform);assert.equal(f[i].opacity,r.at(-1-i).opacity);}
  for(let i=1;i<=100;i++){
   const prev=magnetState(c,(i-1)/100),next=magnetState(c,i/100);
   assert.ok(Math.abs(next.x)<=Math.abs(prev.x)+1e-8);
   assert.ok(next.s>=prev.s-1e-8);assert.ok(next.a>=prev.a-1e-8);
  }
 }
});
test("neighbor spacing and width shrink together; near cards disappear first",()=>{
 const near=card(450,26),far=card(390,26);
 for(let i=0;i<=100;i++){
  const p=i/100,n=magnetState(near,p),f=magnetState(far,p);
  assert.ok(n.a<=f.a+1e-8);
  assert.ok((near.x+n.x)-(far.x+f.x)+1e-8>=20*(n.s+f.s)/2||p<.06);
 }
});
test("proxies isolate chrome mirrors from scroll clips and native selectors",()=>{
 assert.ok(source.includes('host.attachShadow({mode:"closed"})'));
 assert.ok(source.includes('host.inert=true'));
 assert.ok(source.includes('cloneNode(true)'));
 assert.ok(source.includes('host.remove()'));
 assert.ok(source.includes('holdHandoff()'));
 assert.ok(read("chrome.css").includes("data-zr-center-handoff"));
});
test("all three lifecycle controllers use the same window engine",()=>{
 for(const p of ["startup-animation.uc.mjs","closing-animation.uc.mjs","workspace-transition.uc.mjs"])assert.ok(read(p).includes("__nocturneCenterMotion"));
 assert.ok(read("layout.uc.mjs").includes(source));
 assert.ok(!read("workspace-transition.uc.mjs").includes("function cardOffsets("));
 assert.ok(!read("startup-animation.uc.mjs").includes("function collectTabs("));
});
test("ordinary tab selection is immediate and does not inspect content",()=>{
 assert.ok(source.includes('tc.addEventListener("TabSelect",onSelect)'));
 assert.ok(source.includes('selection.native'));assert.ok(!source.includes("deck.animate("));
 for(const forbidden of ["contentDocument","contentWindow","drawSnapshot","setTimeout(onSelect"])assert.ok(!source.includes(forbidden));
});

test("shared workspace card alpha is not multiplied by a second row fade",()=>{
 const css=read("chrome.css");
 assert.ok(css.includes('data-zr-center-motion="workspace"'));
 assert.ok(css.includes('opacity:1!important;\n  --zr-workspace-ui-progress:var(--zr-workspace-progress);'));
 assert.ok(css.includes(':not([data-zr-workspace-phase="swap"])'));
 assert.ok(read("src/layout/visibility.js.part").includes('if(phase==="out"||phase==="swap"){clearTabHover()'));
});
