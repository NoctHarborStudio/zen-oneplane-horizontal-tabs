import test from "node:test";
import assert from "node:assert/strict";
import { islandBoundary } from "../src/algorithms/island-boundary.mjs";
import { lanePositions } from "../src/algorithms/lane-positions.mjs";
import { addressWaveDepth, addressWaveClip, addressWaveDuration } from "../src/algorithms/address-wave.mjs";
import { contourAlpha, contourPath, contourImage } from "../src/algorithms/contour.mjs";
import { panelDecision } from "../src/algorithms/panel-decision.mjs";
import { pullIndicatorFactor } from "../src/algorithms/pull-indicator.mjs";

const settings={transparency:4,strength:100,length:69,hold:30,curve:65,radius:24,padding:0};

test("panel latch: tab switches, direct hover, native pulses and delayed close",()=>{
  const cases=[
    [true,false,false,0,180,null,true,180],
    [true,false,true,20,180,0,true,0],
    [true,false,false,30,180,null,true,150],
    [true,false,false,181,180,30,false,0],
    [false,false,true,30,180,null,false,150],
    [false,false,false,100,180,null,false,0],
    [false,true,false,30,180,null,true,0],
    [false,false,true,181,180,null,true,0],
    [true,false,false,0,0,null,true,100],
    [true,false,false,101,0,0,false,0]
  ];
  for(const [open,direct,native,now,until,since,want,wait] of cases){
    const state=panelDecision(open,direct,native,now,until,since);
    assert.equal(state.open,want); assert.equal(state.wait,wait);
  }
});

test("Liquid Wave: monotonic progress and left-to-right direction",()=>{
  for(const w of [1,180,900,1800]){
    let previous=0;
    for(const p of [0,.01,.25,.5,.75,.99,1]){
      const left=addressWaveDepth(p,0),right=addressWaveDepth(p,1);
      assert.ok(left>=previous&&left>=right);
      assert.ok(!/NaN|Infinity/.test(addressWaveClip(w,260,30,p)));
      previous=left;
    }
    assert.equal(addressWaveDepth(0,0),0);
    assert.equal(addressWaveDepth(1,1),1);
  }
  assert.equal(addressWaveDuration({width:180,reveal:0},{width:900,reveal:1},{compact:180,expanded:900},420),420);
  assert.equal(addressWaveDuration({width:900,reveal:1},{width:180,reveal:0},{compact:180,expanded:900},380),380);
});

test("Unified Contour: one alpha group, no edge feather, monotonic falloff",()=>{
  for(const opts of [settings,{...settings,strength:0},{...settings,length:20,hold:19,curve:300,transparency:40}]){
    let previous=1;
    for(let i=0;i<=64;i++){
      const alpha=contourAlpha(opts.length*i/64,opts);
      assert.ok(alpha<=previous&&alpha>=0);
      previous=alpha;
    }
    assert.equal(previous,0);
    for(const [deep,left,right] of [[78,760,1160],[47,null,null],[78,0,1920]]){
      const mask=contourImage(1920,Math.max(deep,47+opts.length)+1,47,deep,left,right,opts);
      const svg=decodeURIComponent(mask.slice('url("data:image/svg+xml,'.length,-2));
      assert.ok(svg.includes('<g opacity="'+(1-opts.transparency/100)+'">'));
      assert.ok(svg.includes('y1="47"'));
      assert.ok(!/NaN|Infinity|stroke-width/.test(svg));
    }
  }
  assert.equal(contourPath(900,47,47,null,null,24),"M-28 47H928");
});

test("island boundary and lane positions",()=>{
  assert.equal(islandBoundary([],39),0);
  assert.equal(islandBoundary([36],39),1);
  assert.equal(islandBoundary([36,36,36,36],39),2);
  assert.deepEqual(lanePositions([36,36,36],2,100,200,3),[25,64,200]);
});

test("drag indicator falls to zero at detach threshold",()=>{
  assert.equal(pullIndicatorFactor(0),1);
  assert.equal(pullIndicatorFactor(.06),1);
  assert.ok(Math.abs(pullIndicatorFactor(.34)-.25)<1e-10);
  assert.ok(pullIndicatorFactor(.62)<1e-10);
  assert.equal(pullIndicatorFactor(1),0);
});

import { emptyAddressState } from "../src/algorithms/address-empty.mjs";
test("lazy restored address never collapses on provisional blank",()=>{
  for(const [explicit,uri,pending,restoring,want] of [
    [false,"about:blank",true,false,false],[false,"about:blank",false,true,false],
    [false,"",false,true,false],[false,"https://example.com",false,true,false],
    [true,"about:blank",true,true,true],[false,"about:blank",false,false,true],
    [false,"about:newtab",false,false,true],[false,"https://example.com",false,false,false]
  ])assert.equal(emptyAddressState(explicit,uri,pending,restoring),want);
});


test("fixed-width opening wave clips the unused right side",()=>{
  assert.equal(addressWaveClip(180,260,30,0,8,900),"inset(0px 720.00px 230.00px 0px round var(--op-url-radius))");
  assert.equal(addressWaveClip(900,260,30,1,8,900),"inset(0px 0.00px 0.00px 0px round var(--op-url-radius))");
  for(const p of [.01,.2,.5,.8,.99])assert.ok(addressWaveClip(180+720*p,260,30,p,8,900).startsWith('path("'));
});

import { toolbarCenterBias } from "../src/algorithms/toolbar-center.mjs";
test("address appearing after startup is compensated without changing strip center",()=>{
  const right=180, reserve=183;
  for(const left of [90,270,450]){
    const b=toolbarCenterBias(left,right,reserve,false);
    assert.equal(left-right+b.left-b.right,reserve);
    const island=toolbarCenterBias(left,right,reserve,true);
    assert.equal(left-right+island.left-island.right,0);
  }
});

import { addressMotionSample, addressFluidClip, addressFluidFrames } from "../src/algorithms/address-wave.mjs";
test("fluid native animation uses synchronized monotonic endpoints and invariant clip topology",()=>{
  const closed={width:180,reveal:0,selection:0},open={width:900,reveal:1,selection:1};
  for(const shape of [false,true]){
    const frames=addressFluidFrames("opening",closed,open,900,30,8,shape);
    const close=addressFluidFrames("closing-wave",open,closed,900,30,8,shape);
    assert.equal(frames.length,17);
    assert.equal(frames[0].offset,0);
    assert.equal(frames.at(-1).offset,1);
    assert.equal(frames[0].clipPath,close.at(-1).clipPath);
    assert.equal(frames.at(-1).clipPath,close[0].clipPath);
    assert.equal(frames[0].translate,"-720.000px 0px");
    assert.equal(frames.at(-1).translate,"0.000px 0px");
    assert.ok(frames.every(k=>!(/NaN|Infinity/.test(k.clipPath))&&k.clipPath.startsWith(shape?"shape(":"polygon(")));
    assert.ok(frames.every(k=>k.clipPath.split(",").length===frames[0].clipPath.split(",").length));
  }
  let last=closed;
  for(let i=0;i<=100;i++){
    const v=addressMotionSample("opening",closed,open,i/100);
    assert.ok(v.width>=last.width&&v.reveal>=last.reveal);
    last=v;
  }
  assert.deepEqual(last,open);
  const interrupted=addressMotionSample("opening",closed,open,.37);
  assert.deepEqual(addressMotionSample("closing-wave",interrupted,closed,0),interrupted);
  assert.equal(addressMotionSample("closing-wave",open,closed,1).selection,0);
});

import { cascadeWaveSchedule, cascadeRevealFrames, cascadeFadeFrames } from "../src/algorithms/address-cascade.mjs";
test("bounded Bunny never exceeds its resting slot in either axis",()=>{
  for(const count of [1,8,32,80,200]){
    const slots=Array.from({length:count},(_,i)=>({left:300+i*39,top:0}));
    const geometry={left:100,top:0,header:30,height:240};
    for(const opening of [true,false]){
      const phase={name:opening?"opening":"closing-wave",from:{width:opening?180:900,reveal:opening?0:1},to:{width:opening?900:180,reveal:opening?1:0},duration:opening?420:380};
      const timing=cascadeWaveSchedule(opening?slots:slots.slice().reverse(),phase,geometry,opening);
      for(let i=1;i<timing.length;i++)assert.ok(timing[i].delay>=timing[i-1].delay);
      if(opening)assert.ok(timing.every(t=>t.delay+t.duration<=420.001));
      else assert.ok(timing.at(-1).delay<=620.001);
    }
    const frames=slots.map(()=>cascadeRevealFrames());
    assert.equal(frames.flat().length,4*count);
    for(const fs of frames){
      assert.ok(fs.every(f=>f.scale.split(" ").every(v=>Number(v)>=0&&Number(v)<=1)));
      assert.equal(fs[2].scale,"0.93 0.93");
      assert.equal(fs.at(-1).scale,"1 1");
    }
  }
  assert.equal(cascadeRevealFrames({x:.4,y:.7,opacity:.5})[0].scale,"0.4 0.7");
  assert.equal(cascadeFadeFrames(.4,true)[0].opacity,.4);
  assert.equal(cascadeFadeFrames(.4,true)[1].opacity,0);
});
test("Wave Fade uses address depth for bookmark row and clears both rows by the end",()=>{
  const g={left:100,top:0,header:30,height:240};
  const phase={name:"opening",from:{width:180,reveal:0},to:{width:900,reveal:1},duration:420};
  const top={left:420,top:0},bm={left:420,top:70,bookmark:true};
  const a=cascadeWaveSchedule([top],phase,g,true)[0];
  const b=cascadeWaveSchedule([bm],phase,g,true)[0];
  assert.ok(b.delay>=a.delay);
  const far=cascadeWaveSchedule([{left:2000,top:400,bookmark:true}],phase,g,true)[0];
  assert.ok(far.delay+far.duration<=420);
  const reverse={name:"closing-wave",from:phase.to,to:phase.from,duration:380};
  assert.ok(cascadeWaveSchedule([bm],reverse,g,false)[0].delay<=cascadeWaveSchedule([top],reverse,g,false)[0].delay);
});
