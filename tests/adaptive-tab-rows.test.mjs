import test from "node:test";
import assert from "node:assert/strict";
import {planAdaptiveTabRows,adaptiveAddressWidth,visibleLaneDropIndex,laneScrollVelocity} from "../src/algorithms/tab-overflow.mjs";
test("wide layout keeps all slots in their original halves",()=>{
  const p=planAdaptiveTabRows([36,100,36,36], [false,true,false,false],2,700,180,36);
  assert.equal(p.mode,"wide");assert.deepEqual(p.topLeft,[0,1]);assert.deepEqual(p.topRight,[2,3]);assert.equal(p.hasSecondRow,false);
});
test("compact layout keeps no more than one ordinary tab per side",()=>{
  const p=planAdaptiveTabRows([36,100,100,36,100,36], [false,true,true,false,true,false],3,260,100,36);
  assert.equal(p.mode,"compact");assert.deepEqual(p.topLeft,[0]);assert.deepEqual(p.topRight,[3]);assert.deepEqual(p.lower,[1,2,4,5]);assert.equal(p.topPlus,false);
});
test("group-only overflow keeps Home above and every group below",()=>{
  const p=planAdaptiveTabRows([100,139,100],[true,true,true],1,180,100,36);
  assert.deepEqual(p.topLeft,[]);assert.deepEqual(p.topRight,[]);assert.deepEqual(p.lower,[0,1,2]);assert.equal(p.hasSecondRow,true);
});
test("ultra mode preserves Home and moves every tab to the lower lane",()=>{
  const p=planAdaptiveTabRows([36,36,100],[false,false,true],1,60,100,36);
  assert.equal(p.mode,"ultra");assert.equal(p.title,32);assert.deepEqual(p.lower,[0,1,2]);assert.equal(p.topPlus,false);
});
test("adaptive allocation does not duplicate or lose slots at any width",()=>{
  const widths=[36,100,36,139,36,36,100,36],groups=widths.map(w=>w>36);
  for(const tab of [32,36,44])for(let w=0;w<=1600;w+=5)for(let b=0;b<=widths.length;b++){
    const p=planAdaptiveTabRows(widths,groups,b,w,180,tab);
    assert.deepEqual([...p.topLeft,...p.topRight,...p.lower].sort((a,b)=>a-b),widths.map((_,i)=>i));
    if(p.mode!=="wide"){assert.ok(p.topLeft.length<=1&&p.topRight.length<=1);assert.ok([...p.topLeft,...p.topRight].every(i=>!groups[i]));}
    if(!p.hasSecondRow)assert.equal(p.lower.length,0);
  }
});
test("address prefers 30 percent reduction and is constrained by actual space",()=>{
  assert.equal(adaptiveAddressWidth(180,960,100,40,8,true),126);
  assert.equal(adaptiveAddressWidth(140,960,100,40,8,true),98);
  assert.equal(adaptiveAddressWidth(220,960,100,40,8,true),154);
  assert.equal(adaptiveAddressWidth(180,620,140,36,8,true),126);
  assert.equal(adaptiveAddressWidth(180,360,60,36,8,true),76);
  assert.equal(adaptiveAddressWidth(180,1920,130,40),180);
});
test("clipped lane hit testing excludes entirely invisible tabs",()=>{
  const slots=[{left:-60,right:-20},{left:-20,right:20},{left:23,right:59},{left:62,right:98},{left:101,right:137}];
  assert.deepEqual(visibleLaneDropIndex(slots,0,90,5),{index:1,before:true});
  assert.deepEqual(visibleLaneDropIndex(slots,0,90,50),{index:3,before:true});
  assert.deepEqual(visibleLaneDropIndex(slots,0,90,89),{index:3,before:false});
  assert.equal(visibleLaneDropIndex([{left:-60,right:-20}],0,90,5),null);
  assert.ok(laneScrollVelocity(2,0,200,32)<0);assert.equal(laneScrollVelocity(100,0,200,32),0);assert.ok(laneScrollVelocity(199,0,200,32)>0);
});
