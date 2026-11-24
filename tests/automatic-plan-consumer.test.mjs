import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {planAdaptiveTabRows,normalizeAutomaticTabRows} from "../src/algorithms/tab-overflow.mjs";
import {restingToolbarBudget} from "../src/algorithms/toolbar-center.mjs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const source=read("src/toolbar/strip-order.js.part");
const body=source.slice(source.indexOf("  // One Layout-owned"),source.indexOf("  function placeStripOrder(")).replace("  function mountLaneNodes(", "  function actualMountLaneNodes(");

function fixture(order,stopAfter=Infinity){
  const mounted=[],attrs=new Set(),row={hasAttribute:key=>key==="data-op-show-island"||attrs.has(key),toggleAttribute(key,on){if(on)attrs.add(key);else attrs.delete(key);}};
  const list={children:[],contains:()=>false,append(...lanes){this.children=lanes;for(const lane of lanes)lane.parentElement=this;}};
  const leftLane={id:"left",parentElement:list},rightLane={id:"right",parentElement:list},bottomLane={id:"bottom",parentElement:list,hidden:true};
  list.children=[leftLane,rightLane,bottomLane];for(const lane of list.children)lane.children=[];
  const api=new Function("normalizeAutomaticTabRows","order","mounted","row","list","leftLane","rightLane","bottomLane","stopAfter",`
    let dead=false,stripOrderSnapshot=order,adaptiveHeightDirty=false,overflowRevealAnimation=null,contourKey=null;
    const document={activeElement:null},entries=new Map(),browser={},root={hasAttribute:()=>true};
    const window={requestAnimationFrame(){throw Error("unexpected reveal")}};
    function mountLaneNodes(lane,nodes){mounted.push([lane.id,nodes]);lane.children=[...nodes];for(const node of nodes)node.parentElement=lane;return true}
    const scheduleGeometry=()=>{},scheduleContour=()=>{};
    ${body}
    return {apply:(plan,boundary)=>applyStripPartition(plan,order,()=>mounted.length<stopAfter,boundary),valid:()=>stripPlacementCurrent(),placement:()=>committedStripPlacement};
  `)(normalizeAutomaticTabRows,order,mounted,row,list,leftLane,rightLane,bottomLane,stopAfter);
  return {...api,mounted,attrs,bottomLane,leftLane,rightLane,list};
}

test("actual Auto lane consumer keeps legacy native nodes, plus CSS flags and lower-row visibility",()=>{
  for(const widths of [[],[36],[36,100,36,36,100,36],Array(100).fill(36)]){
    const order=widths.map((_,i)=>({index:i}));
    const groups=widths.map(w=>w>36);
    for(const available of [0,60,116,260,700,1200]){
      const budget=restingToolbarBudget({widths,groups,windowWidth:1200,right:100,tabWidth:36,dragRoom:16,iconHome:false,returnReserve:0});
      const plan=budget.planAt(available),f=fixture(order);
      assert.equal(f.apply(plan,budget.boundary),true);assert.equal(f.valid(),true);
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
  assert.deepEqual(ok.mounted,[["left",[order[0]]],["right",[order[1]]],["bottom",[]]]);assert.equal(ok.valid(),true);
  const stale=fixture(order,0);assert.equal(stale.apply(plan,1),false);assert.equal(stale.mounted.length,0);
  const interrupted=fixture(order,1);assert.equal(interrupted.apply(plan,1),false);assert.equal(interrupted.mounted.length,1);assert.equal(interrupted.placement(),null);
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

test("published placement detects extra, reordered or reparented lane nodes at equal native count",()=>{
  for(const fault of ["extra","order","parent","lane","row","plus","compact"]){
    const order=[{},{},{}],f=fixture(order);
    const plan={topLeft:[0,1],topRight:[2],lower:[],hasSecondRow:false,mode:"wide",topPlus:true};
    assert.equal(f.apply(plan,2),true);assert.equal(f.valid(),true);
    if(fault==="extra")f.leftLane.children.push({});
    if(fault==="order")f.leftLane.children.reverse();
    if(fault==="parent")order[1].parentElement=f.rightLane;
    if(fault==="lane")f.list.children.reverse();
    if(fault==="row")f.bottomLane.hidden=false;
    if(fault==="plus")f.attrs.add("data-op-bottom-plus");
    if(fault==="compact")f.attrs.add("data-op-adaptive-compact");
    assert.equal(f.valid(),false,fault);
  }
});

function flatFixture(){
  const attrs=new Set(["data-op-overflow-row","data-op-bottom-plus","data-op-adaptive-compact"]);
  const row={hasAttribute:k=>attrs.has(k),removeAttribute:k=>attrs.delete(k)};
  const node=id=>({id,children:[],parentElement:null,isConnected:false,
    remove(){if(this.parentElement){const c=this.parentElement.children;c.splice(c.indexOf(this),1);this.parentElement=null;}},
    insertBefore(child,before){child.remove();const i=before?this.children.indexOf(before):this.children.length;
      this.children.splice(i,0,child);child.parentElement=this;}});
  const list=node("list"),left=node("left"),right=node("right"),bottom=node("bottom");
  for(const lane of [left,right,bottom])list.insertBefore(lane,null);
  const a=node("a"),b=node("b"),c=node("c"),order=[a,b,c];left.insertBefore(a,null);bottom.insertBefore(c,null);
  // b is genuinely detached, but still belongs to the complete snapshot.
  bottom.hidden=false;let valid=true,scheduled=0;
  const api=new Function("row","list","leftLane","rightLane","bottomLane","order","current","scheduleGeometry",`
    let dead=false,stripOrderSnapshot=order,adaptiveHeightDirty=false,contourKey=null;
    const window={};
    ${source.slice(source.indexOf("  // One Layout-owned"),source.indexOf("  function placeStripOrder("))}
    return {apply:()=>applyFlatStripPlacement(order,current),valid:()=>stripPlacementCurrent(),
      invalidate:()=>{committedStripPlacement=null}};
  `)(row,list,left,right,bottom,order,()=>valid,()=>scheduled++);
  return {...api,row,attrs,list,left,right,bottom,order,stop:()=>{valid=false},resume:()=>{valid=true},scheduled:()=>scheduled};
}
test("flat recovery uses the same complete order, including detached units, and restores flags",()=>{
  const f=flatFixture();
  assert.equal(f.apply(),true);assert.equal(f.valid(),true);
  assert.deepEqual(f.list.children.map(n=>n.id),["a","b","c"]);
  assert.ok(f.order.every((n,i)=>f.list.children[i]===n));
  assert.equal(f.bottom.hidden,true);assert.equal(f.attrs.size,0);assert.equal(f.scheduled(),1);
  f.invalidate();assert.equal(f.valid(),false);assert.equal(f.apply(),true);assert.equal(f.valid(),true);
  assert.equal(f.scheduled(),1);
  f.attrs.add("data-op-bottom-plus");assert.equal(f.valid(),false);
  assert.equal(f.apply(),true);assert.equal(f.valid(),true);
});
test("flat reparent interrupted synchronously does not publish and recovers with original nodes",()=>{
  const f=flatFixture(),insert=f.list.insertBefore;
  f.list.insertBefore=function(...args){insert.apply(this,args);f.stop();};
  assert.equal(f.apply(),false);assert.equal(f.valid(),false);
  f.list.insertBefore=insert;f.resume();
  assert.equal(f.apply(),true);assert.equal(f.valid(),true);
  assert.deepEqual(f.list.children.map(n=>n.id),["a","b","c"]);
});
test("mode switch and flat geometry retry cannot use filtered DOM or stale native witness",()=>{
  const hover=read("src/toolbar/hover.js.part"),geometry=read("src/layout/geometry.js.part");
  assert.ok(hover.includes("if(sameStripStructure(syncedTopology,readStripTopology()))placeStripOrder(stripOrderSnapshot);"));
  assert.ok(!hover.includes("placeStripOrder(stripNodes())"));
  assert.ok(geometry.includes("if(!syncing&&!sameStripStructure(syncedTopology,readStripTopology())){schedule();return false;}"));
  assert.ok(geometry.includes("applyFlatStripPlacement(order,stillCurrent)"));
});
