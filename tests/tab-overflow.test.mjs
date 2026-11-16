import test from "node:test";
import assert from "node:assert/strict";
import {planTabOverflow} from "../src/algorithms/tab-overflow.mjs";
test("no overflow preserves original lanes",()=>{
  const p=planTabOverflow([36,36,36,36],2,75,75);
  assert.deepEqual(p.topLeft,[0,1]);assert.deepEqual(p.topRight,[2,3]);assert.equal(p.hasSecondRow,false);
});
test("only outer slots move down",()=>{
  const p=planTabOverflow(Array(12).fill(36),6,114,75);
  assert.deepEqual(p.topLeft,[3,4,5]);assert.deepEqual(p.topRight,[6,7]);
  assert.deepEqual(p.lower,[0,1,2,8,9,10,11]);assert.equal(p.hasSecondRow,true);
});
test("split group is an indivisible slot",()=>{
  const p=planTabOverflow([36,100,36,36,100,36],3,75,75);
  assert.deepEqual(p.topLeft,[2]);assert.deepEqual(p.topRight,[3]);
  assert.deepEqual(p.lower,[0,1,4,5]);assert.ok(p.leftUsed<=75&&p.rightUsed<=75);
});
test("every slot occurs once in logical order across capacity combinations",()=>{
  const widths=[32,76,44,36,110,36,36,40];
  for(let b=0;b<=widths.length;b++)for(let l=0;l<=300;l+=15)for(let r=0;r<=300;r+=15){
    const p=planTabOverflow(widths,b,l,r);
    assert.deepEqual([...p.lowerLeft,...p.topLeft,...p.topRight,...p.lowerRight],widths.map((_,i)=>i));
    assert.ok(p.leftUsed<=l&&p.rightUsed<=r);
  }
});
