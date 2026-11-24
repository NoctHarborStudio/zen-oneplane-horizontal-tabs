import test from "node:test";
import assert from "node:assert/strict";
import {CENTER_FLOW_STAGES,CENTER_FLOW_MS,CENTER_FLOW_CLOSE_MS,centerFlowDuration,centerFlowStage,centerFlowTimeline,homeFlowFrames} from "../src/algorithms/home-island-motion.mjs";
test("visible startup plan defaults to 2400ms and closes by normalized reversal",()=>{
 assert.equal(centerFlowDuration(1050),2400);assert.equal(centerFlowDuration(2400),2400);
 const p=centerFlowTimeline(0,1);assert.equal(p.finishLength,2400);assert.equal(p.islandLength,780);
 for(const stage of Object.keys(CENTER_FLOW_STAGES)){
  const a=centerFlowStage(stage),b=centerFlowStage(stage,CENTER_FLOW_CLOSE_MS,true);
  assert.ok(Math.abs(a.delay/CENTER_FLOW_MS+(b.delay+b.duration)/CENTER_FLOW_CLOSE_MS-1)<1e-9);
  assert.ok(Math.abs(a.duration/CENTER_FLOW_MS-b.duration/CENTER_FLOW_CLOSE_MS)<1e-9);
 }
});
test("Home waves are bounded and exact poses reverse",()=>{
 for(const kind of ["search","pin","workspace","body","fade"]){
  assert.deepEqual(homeFlowFrames(kind,.75,true),homeFlowFrames(kind,.75).reverse());
 }
 for(const kind of ["pin","workspace"])for(const rank of [0,.5,1]){
  const a=centerFlowStage(kind,2400,false,rank),b=centerFlowStage(kind,1600,true,rank);
  assert.ok(a.delay+a.duration<=2400&&b.delay+b.duration<=1600);
  assert.ok(Math.abs(a.delay/2400+(b.delay+b.duration)/1600-1)<1e-9);
 }
});
