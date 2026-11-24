import test from "node:test";
import assert from "node:assert/strict";
import {edgeControlOffsets,EDGE_CONTROL_EASE} from "../src/algorithms/home-island-motion.mjs";
test("all measured side controls share one offscreen offset",()=>{
 const rects=[{left:0,right:32},{left:34,right:64},{left:100,right:140},{left:800,right:840},{left:940,right:980}];
 const shifts=edgeControlOffsets(rects,500,1000);
 assert.deepEqual(shifts,[-148,-148,-148,208,208]);
 rects.forEach((r,i)=>assert.ok(r.right+shifts[i]<=-8||r.left+shifts[i]>=1008));
 assert.deepEqual(edgeControlOffsets([],500,1000),[]);
});
test("edge grouping keeps native gaps and rejects invalid geometry",()=>{
 const r=[{left:60,right:90},{left:100,right:130}];
 assert.deepEqual(edgeControlOffsets(r,300,600),[-138,-138]);
 assert.throws(()=>edgeControlOffsets([{left:0,right:NaN}],300,600),RangeError);
 assert.throws(()=>edgeControlOffsets([],300,0),RangeError);
 assert.equal(EDGE_CONTROL_EASE,"cubic-bezier(.45,0,.55,1)");
});
