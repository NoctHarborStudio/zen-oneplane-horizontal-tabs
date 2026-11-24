import test from "node:test";
import assert from "node:assert/strict";
import {vanishingHomeSlots,vanishingHomeIndex,vanishingHomePull,vanishingHomePressure} from "../src/algorithms/vanishing-home.mjs";

test("continuous row is centered including plus; unequal group widths retain exact gaps",()=>{
  const w=[36,100,36,36],s=vanishingHomeSlots(w,600,36);
  assert.equal(s.positions[0]+s.total/2,600);
  assert.equal(s.plus+36-s.positions[0],s.total);
  for(let i=1;i<w.length;i++)assert.equal(s.positions[i]-s.positions[i-1]-w[i-1],3);
});

test("both reorder directions use stable symmetric hysteresis",()=>{
  const mid=[100,139,178];
  assert.equal(vanishingHomeIndex(mid,146,1),1);
  assert.equal(vanishingHomeIndex(mid,148,1),2);
  assert.equal(vanishingHomeIndex(mid,132,2),2);
  assert.equal(vanishingHomeIndex(mid,130,2),1);
  assert.equal(vanishingHomeIndex(mid,500,0),3);
  assert.equal(vanishingHomeIndex(mid,0,3),0);
});

test("pull closes the gap symmetrically; zero pull returns the same full geometry",()=>{
  const w=[36,100,36,36],full=vanishingHomeSlots(w,600,36);
  for(let i=0;i<w.length;i++){
    const zero=vanishingHomePull(w,i,600,36,0);
    assert.deepEqual(zero.positions,full.positions);
    assert.equal(zero.plus,full.plus);
    for(const p of [.2,.62,1]){
      const q=vanishingHomePull(w,i,600,36,p);
      assert.ok(Math.abs(q.ratio-(1-.96*p*p*(3-2*p)))<1e-10);
      assert.equal(q.anchor,full.positions[i]+w[i]/2);
      for(let j=0;j<w.length;j++)assert.ok(Math.abs(q.positions[j]-full.positions[j]-(j<i?q.loss/2:j>i?-q.loss/2:0))<1e-10);
      assert.ok(Math.abs(q.plus-(full.plus-q.loss/2))<1e-10);
    }
  }
});

test("pressure mirrors direction and cannot exceed edge room",()=>{
  for(const delta of [1,8,30,100]){
    assert.equal(vanishingHomePressure(36,-delta,20),-vanishingHomePressure(36,delta,20));
    assert.ok(Math.abs(vanishingHomePressure(36,delta,2))<=2);
    assert.ok(Math.abs(vanishingHomePressure(36,delta,20))<=delta);
  }
  assert.equal(vanishingHomePressure(36,100,0),0);
});
