import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {planAdaptiveTabRows,normalizeAutomaticTabRows} from "../src/algorithms/tab-overflow.mjs";
import {restingToolbarBudget} from "../src/algorithms/toolbar-center.mjs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const source=read("src/toolbar/strip-order.js.part");
const body=source.slice(source.indexOf("  function applyStripPartition("),source.indexOf("  function placeStripOrder("));

function fixture(order,stopAfter=Infinity){
  const mounted=[],attrs=new Set(),row={hasAttribute:key=>attrs.has(key),toggleAttribute(key,on){if(on)attrs.add(key);else attrs.delete(key);}};
  const list={contains:()=>false,append(...lanes){for(const lane of lanes)lane.parentElement=this;}};
  const leftLane={id:"left",parentElement:list},rightLane={id:"right",parentElement:list},bottomLane={id:"bottom",parentElement:list,hidden:true};
  const api=new Function("normalizeAutomaticTabRows","order","mounted","row","list","leftLane","rightLane","bottomLane","stopAfter",`
    let dead=false,stripOrderSnapshot=order,adaptiveHeightDirty=false,overflowRevealAnimation=null,contourKey=null;
    const document={activeElement:null},entries=new Map(),browser={},root={hasAttribute:()=>true};
    const window={requestAnimationFrame(){throw Error("unexpected reveal")}};
    const mountLaneNodes=(lane,nodes)=>{mounted.push([lane.id,nodes]);return true};
    const scheduleGeometry=()=>{},scheduleContour=()=>{};
    ${body}
    return {apply:(plan,boundary)=>applyStripPartition(plan,order,()=>mounted.length<stopAfter,boundary)};
  `)(normalizeAutomaticTabRows,order,mounted,row,list,leftLane,rightLane,bottomLane,stopAfter);
  return {...api,mounted,attrs,bottomLane};
}

test("actual Auto lane consumer keeps legacy native nodes, plus CSS flags and lower-row visibility",()=>{
  for(const widths of [[],[36],[36,100,36,36,100,36],Array(100).fill(36)]){
    const order=widths.map((_,i)=>({index:i}));
    const groups=widths.map(w=>w>36);
    for(const available of [0,60,116,260,700,1200]){
      const budget=restingToolbarBudget({widths,groups,windowWidth:1200,right:100,tabWidth:36,dragRoom:16,iconHome:false,returnReserve:0});
      const plan=budget.planAt(available),f=fixture(order);
      assert.equal(f.apply(plan,budget.boundary),true);
      assert.deepEqual(f.mounted,[["left",plan.topLeft.map(i=>order[i])],["right",plan.topRight.map(i=>order[i])],["bottom",plan.lower.map(i=>order[i])]]);
      for(const [,nodes] of f.mounted)for(const node of nodes)assert.equal(node,order[node.index]);
      assert.equal(f.attrs.has("data-op-overflow-row"),plan.hasSecondRow);
      assert.equal(f.attrs.has("data-op-adaptive-compact"),plan.mode!=="wide");
      assert.equal(f.attrs.has("data-op-bottom-plus"),!plan.topPlus);
      assert.equal(f.bottomLane.hidden,!plan.hasSecondRow);
    }
  }
});

test("startup provisional Auto plan shares adapter; stale or malformed plan cannot mount new nodes",()=>{
  const order=[{},{}],plan={topLeft:[0],topRight:[1],lower:[],hasSecondRow:false,mode:"wide",topPlus:true};
  const ok=fixture(order);assert.equal(ok.apply(plan,1),true);
  assert.deepEqual(ok.mounted,[["left",[order[0]]],["right",[order[1]]],["bottom",[]]]);
  const stale=fixture(order,0);assert.equal(stale.apply(plan,1),false);assert.equal(stale.mounted.length,0);
  const interrupted=fixture(order,1);assert.equal(interrupted.apply(plan,1),false);assert.equal(interrupted.mounted.length,1);
  const invalid=fixture(order);assert.throws(()=>invalid.apply(plan,0),TypeError);assert.equal(invalid.mounted.length,0);
});

test("production and provisional callers pass the exact source boundary, not a new DOM calculation",()=>{
  const geometry=read("src/layout/geometry.js.part");
  assert.ok(geometry.includes("{naturalTabsWidth,availableAt,planAt,boundary}=restingToolbarBudget"));
  assert.ok(geometry.includes("applyStripPartition(layout,order,stillCurrent,boundary)"));
  assert.ok(source.includes("},snapshot,undefined,boundary)"));
  assert.ok(body.includes("normalizeAutomaticTabRows(plan,order.length,boundary)"));
  assert.ok(!JSON.stringify(JSON.parse(read("scripts/build-plan.json"))).includes("manual-tab-rows.mjs"));
});
