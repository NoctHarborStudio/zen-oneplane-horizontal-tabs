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

import { cascadeTiming, cascadeKeyframes } from "../src/algorithms/address-cascade.mjs";
test("Bunny Cascade follows the address edge in both directions",()=>{
  const closed={width:180,reveal:0},open={width:900,reveal:1},anchor=100;
  let previousEnd=0,previousDelay=Infinity;
  for(const left of [280,300,400,500,650,800,1000,1100]){
    const hide=cascadeTiming("opening",closed,open,420,anchor,left);
    const show=cascadeTiming("closing-wave",open,closed,380,anchor,left);
    const end=hide.delay+hide.duration;
    assert.ok(end>=previousEnd&&end<=420&&hide.duration>0);
    assert.ok(show.delay<=previousDelay&&show.delay>=0&&show.delay<=380);
    assert.equal(show.duration,160);
    previousEnd=end;previousDelay=show.delay;
  }
  for(const opening of [true,false]){
    const frames=cascadeKeyframes(opening,.43,.52,.61);
    assert.equal(frames[0].scale,"0.4300 0.5200");
    assert.equal(frames[0].opacity,.61);
    assert.equal(frames.at(-1).scale,opening?"0 0":"1 1");
    assert.equal(frames.at(-1).opacity,opening?0:1);
  }
  assert.equal(cascadeKeyframes(false,0,0,0)[1].scale,"1.12 1.12");
  for(const duration of [80,100,420]){
    const result=cascadeTiming("opening",closed,open,duration,anchor,600);
    assert.ok(result.delay+result.duration<=duration);
  }
});

import { cascadeSchedule, cascadeSample, cascadeFit, cascadePlan } from "../src/algorithms/address-cascade.mjs";
test("geometry-aware Bunny keeps positive gaps at every shared interpolation knot",()=>{
  const widths=[36,36,16,44,44,180,36,36];
  let left=300;
  const slots=widths.map(width=>{const v={width,left,right:left+width,x:1,y:1,opacity:1,tx:0,ty:0};left+=width+3;return v;});
  slots[2].min=slots[2].left-2;slots[4].max=slots[4].right+2;
  for(const opening of [true,false]){
    const cards=slots.map(v=>({...v,x:opening?1:0,y:opening?1:0,opacity:opening?1:0}));
    const ordered=opening?cards:cards.slice().reverse();
    const timing=cascadeSchedule(opening,ordered,{name:opening?"opening":"closing-wave",from:{width:opening?180:900,reveal:opening?0:1},to:{width:opening?900:180,reveal:opening?1:0},duration:opening?420:380},100);
    for(let i=1;i<timing.length;i++)assert.ok(timing[i].delay>timing[i-1].delay);
    const plan=cascadePlan(opening,cards,cards.map(v=>timing[ordered.indexOf(v)]));
    const intervals=(i,k)=>{const v=cards[i],f=plan.frames[i][k],w=Number(f.scale.split(" ")[0])*v.width,dx=parseFloat(f.translate),c=(v.left+v.right)/2+dx;return [c-w/2,c+w/2];};
    for(let k=0;k<plan.frames[0].length;k++){
      for(let i=1;i<cards.length;i++)assert.ok(intervals(i,k)[0]-intervals(i-1,k)[1]>=.999-1e-4);
    }
    if(!opening)for(let i=0;i<cards.length;i++){
      assert.equal(plan.frames[i].at(-1).scale,"1.000000 1.000000");
      assert.equal(plan.frames[i].at(-1).translate,"0.00000px 0.00000px");
    }
  }
});

test("Bunny reversal preserves a hidden card and limits wide-card overshoot",()=>{
  const v={width:180,left:100,right:280,x:0,y:0,opacity:0,tx:-90,ty:-14};
  const h=cascadeSample(true,v,.1);
  assert.equal(h.x,0);assert.equal(h.y,0);assert.equal(h.opacity,0);
  const open=cascadeSample(false,v,.68);
  assert.ok(open.x*180-180<=2.801);
  assert.ok(open.y>1.1);
  const mixed={...v,x:.47,y:.61,opacity:.39,dx:1.3,currentTy:5,finalTy:0};
  for(const direction of [true,false]){
    const initial=cascadeSample(direction,mixed,0);
    assert.equal(initial.x,.47);assert.equal(initial.y,.61);assert.equal(initial.dx,1.3);assert.equal(initial.ty,5);
    assert.equal(cascadeSample(direction,mixed,1).dx,0);
  }
  const dense=Array.from({length:80},(_,i)=>({left:2000-i*39}));
  const timing=cascadeSchedule(false,dense,{name:"closing-wave",from:{width:900,reveal:1},to:{width:180,reveal:0},duration:380},100);
  for(let i=1;i<timing.length;i++)assert.ok(timing[i].delay>timing[i-1].delay);
});
