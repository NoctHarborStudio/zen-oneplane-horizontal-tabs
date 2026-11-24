import test from "node:test";
import assert from "node:assert/strict";
import {planManualTabRows} from "../src/algorithms/manual-tab-rows.mjs";
import {planAdaptiveTabRows,normalizeAutomaticTabRows} from "../src/algorithms/tab-overflow.mjs";

const plan=(widths,sides,leftCapacity,rightCapacity,plusWidth=36,gap=3)=>
  planManualTabRows({widths,sides,leftCapacity,rightCapacity,plusWidth,gap});
const slots=(p,id)=>p.regions.find(r=>r.id===id)?.slots;
const plus=s=>"plus-"+s;

test("approved mirrored two-row examples and independent plus controls",()=>{
  const p=plan(Array(10).fill(36),[...Array(5).fill("left"),...Array(5).fill("right")],75,75);
  // Native left [6,4,3,2,1], right [1,2,3,4,5].
  const labels=[6,4,3,2,1,1,2,3,4,5];
  const label=id=>slots(p,id).map(i=>typeof i==="number"?labels[i]:"+");
  assert.deepEqual(label("top-left"),[2,1]);
  assert.deepEqual(label("bottom-left"),["+",6,4,3]);
  assert.deepEqual(label("top-right"),[1,2]);
  assert.deepEqual(label("bottom-right"),[3,4,5,"+"]);
});

test("interleaving preserves native relative order; one overflowing side uses full lower region",()=>{
  const p=plan([36,36,36,36,36],["left","right","left","left","right"],75,114);
  assert.deepEqual(slots(p,"top-left"),[2,3]);
  assert.deepEqual(slots(p,"top-right"),[1,4,plus("right")]);
  assert.deepEqual(p.regions[2],{id:"bottom",side:"left",slots:[plus("left"),0]});
  assert.equal(p.regions.length,3);
});

test("a large nearest group moves intact with its entire outer suffix",()=>{
  const p=plan([36,100,36],["left","left","right"],75,75);
  assert.deepEqual(slots(p,"top-left"),[]);
  assert.deepEqual(slots(p,"bottom"),[plus("left"),0,1]);
  assert.deepEqual(slots(p,"top-right"),[2,plus("right")]);
});

test("plus-only overflow, empty sides, exact gap thresholds and zero capacity",()=>{
  assert.deepEqual(slots(plan([36],["right"],36,74),"bottom"),[plus("right")]);
  assert.deepEqual(slots(plan([36],["right"],36,75),"top-right"),[0,plus("right")]);
  const empty=plan([],[],36,36);
  assert.deepEqual(empty.regions.map(r=>r.slots),[[plus("left")],[plus("right")]]);
  assert.equal(empty.hasSecondRow,false);
  const zero=plan([],[],0,0);
  assert.deepEqual(zero.regions.map(r=>r.slots),[[],[],[plus("left")],[plus("right")]]);
});

test("manual conserves every unit and control, maintains side/order and fits upper capacities",()=>{
  for(const n of [0,1,2,17,120]){
    const widths=Object.freeze(Array.from({length:n},(_,i)=>i%5===0?100:36));
    const sides=Object.freeze(widths.map((_,i)=>i%3===0?"left":"right"));
    for(let cap=0;cap<=520;cap+=7){
      const p=plan(widths,sides,cap,520-cap);
      const all=p.regions.flatMap(r=>r.slots);
      assert.deepEqual(all.filter(x=>typeof x==="number").sort((a,b)=>a-b),widths.map((_,i)=>i));
      assert.deepEqual(all.filter(x=>typeof x==="string").sort(),[plus("left"),plus("right")]);
      assert.deepEqual(p.sides,sides);
      for(const side of ["left","right"]){
        const rows=p.regions.filter(r=>r.side===side);
        const sequence=rows.flatMap(r=>side==="left"?[...r.slots].reverse():r.slots);
        const expected=widths.map((_,i)=>i).filter(i=>sides[i]===side);
        if(side==="left")expected.reverse();
        assert.deepEqual(sequence,[...expected,plus(side)]);
        const top=rows[0].slots;
        assert.ok(top.reduce((n,x)=>n+(typeof x==="number"?widths[x]:36),0)+Math.max(0,top.length-1)*3<=(side==="left"?cap:520-cap));
      }
      assert.equal(p.hasSecondRow,p.regions.length>2);
      assert.deepEqual(p,plan(widths,sides,cap,520-cap));
    }
  }
});

test("automatic adapter preserves actual legacy allocations and exact lower provenance",()=>{
  const widths=[36,100,36,36,100,36],groups=widths.map(w=>w>36);
  for(let boundary=0;boundary<=widths.length;boundary++)for(let available=0;available<=800;available+=7){
    const legacy=planAdaptiveTabRows(widths,groups,boundary,available,180,36);
    const p=normalizeAutomaticTabRows(legacy,widths.length,boundary);
    assert.deepEqual(slots(p,"top-left"),legacy.topLeft);
    assert.deepEqual(slots(p,"top-right"),[...legacy.topRight,...(legacy.topPlus?[plus("right")]:[])]);
    assert.deepEqual(slots(p,"bottom"),legacy.hasSecondRow?[...legacy.lower,...(legacy.topPlus?[]:[plus("right")])]:undefined);
    assert.deepEqual(p.sides,widths.map((_,i)=>i<boundary?"left":"right"));
    assert.equal(p.hasSecondRow,legacy.hasSecondRow);
  }
});

test("invalid or incomplete snapshots fail closed instead of inventing placement",()=>{
  for(const [widths,sides] of [[[36],[]],[[36],["unknown"]],[[NaN],["left"]],[Array(1),["left"]],[[36],Array(1)]])
    assert.throws(()=>plan(widths,sides,75,75),TypeError);
  assert.throws(()=>plan([],[],-1,75),TypeError);
  assert.throws(()=>plan([],[],75,75,0),TypeError);
  const auto={topLeft:[0],topRight:[1],lower:[],topPlus:true,hasSecondRow:false};
  assert.throws(()=>normalizeAutomaticTabRows(auto,2,0),TypeError);
  assert.throws(()=>normalizeAutomaticTabRows({...auto,lower:[1],hasSecondRow:true},2,1),TypeError);
  assert.throws(()=>normalizeAutomaticTabRows({...auto,topRight:[]},2,1),TypeError);
  assert.throws(()=>normalizeAutomaticTabRows({...auto,topPlus:false},2,1),TypeError);
});
