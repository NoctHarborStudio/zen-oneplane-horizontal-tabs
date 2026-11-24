import test from "node:test";
import assert from "node:assert/strict";
import {createCenterFlowPlan} from "../src/algorithms/magnetic-fold.mjs";
const hub={left:445,right:555,top:10,bottom:40};
function makeCards(widths,dual){
 const cards=[];
 function add(x,y,w,lower=false){cards.push({x,y,cx:500,cy:25,opacity:1,r:{width:w,height:28},lower,hub});}
 let x=440;
 for(const w of widths){add(x-w/2,25,w);x-=w+5;}
 x=560;for(const w of widths.slice(0,Math.max(1,widths.length-2))){add(x+w/2,25,w);x+=w+5;}
 if(dual){x=500-(widths.reduce((a,b)=>a+b,0)+5*(widths.length-1))/2;for(const w of widths){add(x+w/2,58,w,true);x+=w+5;}}
 return cards;
}
function visible(c,f){
 const [t,r,b,l]=f.clip,w=c.r.width,h=c.r.height;
 return {a:f.a,l:c.x-w/2+f.x+Math.max(0,l),r:c.x+w/2+f.x-Math.max(0,r),t:c.y-h/2+f.y+Math.max(0,t),b:c.y+h/2+f.y-Math.max(0,b)};
}
test("conveyor preserves resting geometry and exact reverse frames",()=>{
 for(const widths of [[24],[24,24,24,24,24,24],[24,68,24,44,24],[110,24,26,72,24,40,24],[120,24]])for(const dual of [false,true]){
  const cards=makeCards(widths,dual),plan=createCenterFlowPlan(cards);
  cards.forEach((c,i)=>{
   const frames=plan.keyframes(i),reverse=plan.keyframes(i,true);
   assert.equal(frames[0].opacity,0);
   assert.deepEqual(plan.sample(i,1),{x:0,y:0,a:1,clip:[-8,-8,-8,-8]});
   for(let j=0;j<frames.length;j++){
    const {offset,...a}=frames[j],{offset:other,...b}=reverse[frames.length-1-j];
    assert.deepEqual(a,b);
   }
  });
  for(let k=0;k<=160;k++){
   const boxes=cards.map((c,i)=>visible(c,plan.sample(i,k/160)));
   for(let i=0;i<boxes.length;i++)for(let j=0;j<i;j++){
    const a=boxes[i],b=boxes[j];
    if(a.a<=0||b.a<=0)continue;
    assert.ok(Math.min(a.r,b.r)-Math.max(a.l,b.l)<=.51||Math.min(a.b,b.b)-Math.max(a.t,b.t)<=.51,`overlap ${i}/${j} at ${k}`);
   }
  }
 }
});
test("side members share one translation and lower row begins later",()=>{
 const cards=makeCards([24,68,24,44,24],true),plan=createCenterFlowPlan(cards);
 for(let k=0;k<=80;k++){
  const p=k/80;
  assert.equal(plan.sample(0,p).x,plan.sample(1,p).x);
  if(p<=.18)cards.forEach((c,i)=>{if(c.lower)assert.equal(plan.sample(i,p).a,0);});
 }
});
test("invalid native geometry is not silently animated",()=>{
 const cards=makeCards([24,24],true);
 assert.throws(()=>createCenterFlowPlan([cards[0],{...cards[0]}]),/slot-overlap/);
 assert.throws(()=>createCenterFlowPlan([{...cards[0],r:{width:NaN,height:28}}]),/geometry/);
});
