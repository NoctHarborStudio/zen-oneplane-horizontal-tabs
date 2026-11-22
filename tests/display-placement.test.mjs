import {readFileSync} from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {displayContains,displayCssPoint,displayRectEqual,displaySnapTarget,displayNativeRect,displayPreviewFraction,displayPreviewKey,displayReleaseMatches,tabReturnZone,displayStartupFeatures,displayPlacementMatches} from "../src/algorithms/display-placement.mjs";
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
test("preview key follows same-monitor work-area and target changes",()=>{
  const original=displaySnapTarget(left,work,-1,400);
  const first=displayPreviewKey(original,"Tab");
  assert.ok(first);
  assert.equal(displayPreviewKey({...original,full:{...original.full}},"Tab"),first);
  assert.equal(displayPreviewKey({...original,work:{...original.work,width:original.work.width-1}},"Tab")===first,false);
  assert.equal(displayPreviewKey({...original,x:original.x-1},"Tab")===first,false);
  assert.equal(displayPreviewKey({...original,mode:"left"},"Tab")===first,false);
  assert.equal(displayPreviewKey(original,"Workspace")===first,false);
  assert.equal(displayPreviewKey({...original,full:null},"Tab"),null);
  assert.equal(displayPreviewKey({...original,width:NaN},"Tab"),null);
  assert.equal(displayPreviewKey({...original,work:{...original.work,height:0}},"Tab"),null);
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

test("native startup uses selected right-half rectangle rather than the center seed",()=>{
  const target=displaySnapTarget(left,work,-1,400);
  const f=displayStartupFeatures(target,1.5,1.25);
  assert.deepEqual(f,{left:-853,top:-133,outerWidth:1024,outerHeight:1114});
  assert.equal(displayStartupFeatures(target,0,1),null);
});
test("each snap mode has its own startup rectangle, including maximize work area",()=>{
  const d={x:1920,y:-1080,width:1920,height:1080};
  const modes=new Set();
  for(const x of [d.x,d.x+960,d.x+1919])for(const y of [d.y,d.y+540,d.y+1079]){
    const p=displaySnapTarget(d,d,x,y),f=displayStartupFeatures(p,1,2);
    assert.equal(f.left,p.x);assert.equal(f.top,p.y);
    // Integer CSS window features round odd desktop dimensions at 2x DPI.
    assert.ok(Math.abs(f.outerWidth*2-p.width)<=1);
    assert.ok(Math.abs(f.outerHeight*2-p.height)<=1);
    modes.add(JSON.stringify(f));
  }
  assert.equal(modes.size,9);
});
test("startup position uses opener scale and size includes opener zoom",()=>{
  const p=displaySnapTarget(left,work,-1,400);
  assert.deepEqual(displayStartupFeatures(p,2,1.25,1.6),
    {left:-640,top:-100,outerWidth:640,outerHeight:696});
  assert.equal(displayStartupFeatures({...p,x:500},1,1),null);
});
test("same-monitor centered seed is not a successful side, quarter or maximize placement",()=>{
  const center=displaySnapTarget(left,work,-1280,400);
  for(const p of [displaySnapTarget(left,work,-1,400),displaySnapTarget(left,work,-2559,-199),displaySnapTarget(left,work,-1280,-199)]){
    assert.equal(displayPlacementMatches(p,center,false),false);
  }
  const side=displaySnapTarget(left,work,-1,400);
  assert.equal(displayPlacementMatches(side,{...side,x:side.x+2,width:side.width-2}),true);
  assert.equal(displayPlacementMatches(side,{...side,width:side.width+30}),false);
  const max=displaySnapTarget(left,work,-1280,-199);
  assert.equal(displayPlacementMatches(max,max,false),false);
  assert.equal(displayPlacementMatches(max,max,true),true);
  assert.equal(displayPlacementMatches(max,{...max,x:0},true),false);
});

test("runtime preview reflows and reanchors when the work area changes on one monitor",()=>{
  const source=readFileSync(new URL("../src/interactions/display-engine.js.part",import.meta.url),"utf8");
  const a=source.indexOf("  function showPlacementPreview("),b=source.indexOf("  function targetScreen(",a);
  assert.ok(a>=0&&b>a);
  const moves=[],events=[];
  const mount=new Function("displayPreviewKey","displayPreviewFraction","displayRectEqual","moves","events",
    `let placementPreview={state:"open",moveTo(x,y){moves.push({x,y});}},
      placementMap={style:{}},placementArea={style:{}},placementLabel={textContent:""},
      placementKey="",placementMonitor=null,placementSample=null,placementPopupPoint=null;
     let current=null;
     const window={devicePixelRatio:1,performance:{now:()=>100},
       __nocturneTrace:(event,data)=>events.push([event,data])},
       dragLifecycle={current:()=>({token:15})};
     function placementAt(){return current;}
     function clearPlacementPreview(){placementKey="";placementSample=null;}
     function nativeBase(){return {devicePixelsPerDesktopPixel:1};}
     function displayContains(){return true;}
     `+source.slice(a,b)+
    "return {showPlacementPreview,setCurrent:p=>{current=p;},snapshot:()=>({key:placementKey,area:{...placementArea.style},anchor:placementPopupPoint})};");
  const ui=mount(displayPreviewKey,displayPreviewFraction,displayRectEqual,moves,events);
  const full={x:-1920,y:-150,width:1920,height:1080};
  const workA={x:-1920,y:-150,width:1920,height:1040};
  const workB={x:-1790,y:-150,width:1790,height:1040};
  const aTarget=displaySnapTarget(full,workA,-1,390);
  const bTarget=displaySnapTarget(full,workB,-1,390);
  assert.equal(aTarget.mode,"right");assert.equal(bTarget.mode,"right");
  ui.setCurrent(aTarget);ui.showPlacementPreview({screenX:-1,screenY:390},"Tab");
  const first=ui.snapshot();assert.equal(moves.length,1);
  ui.setCurrent(bTarget);ui.showPlacementPreview({screenX:-1,screenY:390},"Tab");
  const second=ui.snapshot();
  assert.notEqual(first.key,second.key);
  assert.notEqual(first.area.left,second.area.left);
  assert.notDeepEqual(moves[0],moves[1]);
  assert.equal(moves.length,2);
  assert.deepEqual(events,[["drag.placement.preview",{reason:"work-area-change",movedAnchor:true}]]);
  // A shorter taskbar-available height changes the map but not its
  // top anchor: repaint the preview without needless popup relocation.
  const workC={...workB,height:workB.height-40};
  const cTarget=displaySnapTarget(full,workC,-1,390);
  ui.setCurrent(cTarget);ui.showPlacementPreview({screenX:-1,screenY:390},"Tab");
  const third=ui.snapshot();
  assert.notEqual(second.key,third.key);
  assert.notEqual(second.area.height,third.area.height);
  assert.equal(moves.length,2);
  assert.deepEqual(events,[
    ["drag.placement.preview",{reason:"work-area-change",movedAnchor:true}],
    ["drag.placement.preview",{reason:"work-area-change",movedAnchor:false}]
  ]);
  ui.showPlacementPreview({screenX:-1,screenY:390},"Tab");
  assert.equal(moves.length,2);
});
