import test from "node:test";
import assert from "node:assert/strict";
import {displayContains,displayCssPoint,displayRectEqual,displaySnapTarget,displayNativeRect,displayPreviewFraction} from "../src/algorithms/display-placement.mjs";
const left={x:-2560,y:-200,width:2560,height:1440},work={x:-2560,y:-200,width:2560,height:1392};
test("CSS points use event window scale, not target monitor scale",()=>{
  assert.deepEqual(displayCssPoint(-1600,400,1.5,1),{x:-2400,y:600});
  assert.deepEqual(displayCssPoint(800,400,2,2),{x:800,y:400});
  assert.equal(displayCssPoint(1,2,0,1),null);
});
test("negative and vertically offset monitors use full edges, work-area targets",()=>{
  assert.deepEqual(displaySnapTarget(left,work,-2559,-199),{x:-2560,y:-200,width:1280,height:696,mode:"left-top",full:left,work});
  assert.equal(displaySnapTarget(left,work,-1280,-199).mode,"maximize");
  assert.equal(displaySnapTarget(left,work,-1,400).mode,"right");
  assert.equal(displaySnapTarget(left,work,-1280,1239).mode,"bottom");
  assert.equal(displaySnapTarget(left,work,1,400),null);
});
test("monitor identity includes size, not just origin",()=>{
  assert.equal(displayRectEqual(left,{...left,width:1920}),false);
  assert.equal(displayRectEqual(left,{...left}),true);
  assert.equal(displayContains(left,0,0),false);
});
test("preview and native rectangle are derived from exactly one target",()=>{
  const target=displaySnapTarget(left,work,-1,400);
  assert.deepEqual(displayPreviewFraction(target),{x:.5,y:0,width:.5,height:1392/1440});
  assert.deepEqual(displayNativeRect(target,1.25),{x:-1600,y:-250,width:1600,height:1740});
});
test("every zone stays in the actual work area for mixed portrait and landscape layouts",()=>{
  for(const full of [left,{x:1920,y:0,width:1080,height:1920},{x:0,y:0,width:1920,height:1080}]){
    const work={x:full.x+32,y:full.y+20,width:full.width-32,height:full.height-60};
    for(const x of [full.x,full.x+full.width/2,full.x+full.width-1])for(const y of [full.y,full.y+full.height/2,full.y+full.height-1]){
      const p=displaySnapTarget(full,work,x,y);assert.ok(p);
      assert.ok(displayContains(work,p.x,p.y));assert.ok(displayContains(work,p.x+p.width-1,p.y+p.height-1));
      assert.ok(displayPreviewFraction(p));
    }
  }
});
test("invalid work-area and disconnected coordinates fail closed",()=>{
  assert.equal(displaySnapTarget(left,{...work,width:99999},-100,200),null);
  assert.equal(displaySnapTarget(left,work,100,200),null);
  assert.equal(displayNativeRect(work,NaN),null);
});
