import test from "node:test";
import assert from "node:assert/strict";
import {elasticChainGaps,elasticChainSlots,elasticChainIndex,elasticChainPull,vanishingHomeEase} from "../src/algorithms/vanishing-home.mjs";
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8);
test("distributed gaps preserve the grabbed slot and both edges for every source, including unequal Split widths",()=>{
 const widths=[36,100,36,36,36,36,36],left=100,gaps=[3,3,183,3,3,3];
 const before=elasticChainSlots(widths,left,gaps);
 for(let i=0;i<widths.length-1;i++){
  const g=elasticChainGaps(gaps,i,2),after=elasticChainSlots(widths,left,g);
  close(after[0],before[0]);close(after.at(-1),before.at(-1));close(after[i],before[i]);
  close(g.reduce((a,b)=>a+b,0),gaps.reduce((a,b)=>a+b,0));
  assert.ok(g.every(x=>x>=3));assert.ok(g[2]<183);
  if(i<=2)assert.ok(after[3]<before[3]);else assert.ok(after[2]>before[2]);
 }
});
test("adjacent reorder changes only crossed interval with unequal widths",()=>{
 const w=[36,100,36,36,36],g=[10,20,30,40],left=100;
 const before=elasticChainSlots(w,left,g),after=elasticChainSlots([36,36,100,36,36],left,g);
 close(before[0],after[0]);close(before[3],after[3]);close(before[4],after[4]);
 assert.equal(elasticChainIndex(w,left,g,1,1,1000,1),3);
 assert.equal(elasticChainIndex(w,left,g,1,3,0,-1),0);
 assert.equal(elasticChainIndex(w,left,g,1,1,1000,0),1);
});
test("Bunny only shifts immediate neighbors and retains plus",()=>{
 const w=[36,100,36,36,36],g=[3,20,30,3],s=elasticChainSlots(w,100,g);
 for(let i=0;i<w.length-1;i++){
  assert.deepEqual(elasticChainPull(s,w,i,0),s);
  for(const p of [.2,.62,1]){
   const r=elasticChainPull(s,w,i,p),loss=(w[i]+3)*.96*p*p*(3-2*p);
   r.forEach((x,j)=>close(x,s[j]+(j===i-1?loss/2:j===i+1&&j<w.length-1?-loss/2:0)));
  }
 }
});
test("invalid measured gaps reject and common clock retains endpoints",()=>{
 assert.equal(elasticChainGaps([3,-4,3],0,1),null);
 assert.equal(vanishingHomeEase(0),0);assert.equal(vanishingHomeEase(.5),.5);assert.equal(vanishingHomeEase(1),1);
});
