import test from "node:test";
import assert from "node:assert/strict";
import {displayContains,displayCssPoint,displayRectEqual,displaySnapTarget,displayNativeRect,displayPreviewFraction,displayReleaseMatches,tabReturnZone,displayStartupFeatures} from "../src/algorithms/display-placement.mjs";
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

test("wide independent edge zones, center and corners",()=>{
  assert.equal(displaySnapTarget(left,work,-480,400).mode,"right");
  assert.equal(displaySnapTarget(left,work,-2200,400).mode,"left");
  assert.equal(displaySnapTarget(left,work,-480,-100).mode,"right-top");
  assert.equal(displaySnapTarget(left,work,-1280,-100).mode,"maximize");
  assert.equal(displaySnapTarget(left,work,-1280,400).mode,"center");
});
test("cached release only matches current nearby fresh gesture",()=>{
  const s={token:7,x:-800,y:400,time:100};
  assert.equal(displayReleaseMatches(s,7,-805,405,180),true);
  assert.equal(displayReleaseMatches(s,8,-805,405,180),false);
  assert.equal(displayReleaseMatches(s,7,-900,405,180),false);
  assert.equal(displayReleaseMatches(s,7,-805,405,501),false);
});
test("return zone reserves expanded toolbar while compact strip animates",()=>{
  const r={left:0,right:1920,top:0};
  assert.equal(tabReturnZone(800,24,r,70),true);
  assert.equal(tabReturnZone(800,71,r,70),false);
  assert.equal(tabReturnZone(-1,24,r,70),false);
});

test("native startup seed uses opener position scale and destination size scale",()=>{
  const target=displaySnapTarget(left,work,-1,400);
  const f=displayStartupFeatures(target,1.5,1.25);
  assert.deepEqual(f,{left:-1365,top:29,outerWidth:1229,outerHeight:724});
  const x=Math.round(f.left*1.5),y=Math.round(f.top*1.5);
  assert.ok(displayContains(work,x,y));
  assert.ok(displayContains(work,x+Math.round(f.outerWidth*1.25)-1,y+Math.round(f.outerHeight*1.25)-1));
  assert.equal(displayStartupFeatures(target,0,1),null);
});
test("startup seed is stable across snap modes and handles positive and vertical monitors",()=>{
  const d={x:1920,y:-1080,width:1920,height:1080};
  const a=displaySnapTarget(d,d,2500,-1079),b=displaySnapTarget(d,d,3839,-500);
  assert.deepEqual(displayStartupFeatures(a,1,2),displayStartupFeatures(b,1,2));
  const f=displayStartupFeatures(a,1,2);
  assert.ok(f.left>=d.x&&f.top>=d.y);
  assert.ok(f.left+f.outerWidth*2<=d.x+d.width&&f.top+f.outerHeight*2<=d.y+d.height);
});
