import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {contourGeometry,readContourSettings,contourImage,commitContourMask} from "../src/algorithms/contour.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
const defaults=readContourSettings((k,d)=>d);
const fixture=(more={})=>({wrapper:rect(100,20,800,45),nav:rect(100,20,800,48),row:rect(300,20,400,52),
 bookmark:rect(120,72,760,42),controls:[{rect:rect(110,76,80,24),growthX:32,growthY:14},{rect:rect(800,76,100,24),growthX:40,growthY:14}],
 shiftY:0,trim:5,settings:defaults,availableGrowth:25,...more});
test("visible and stable contour retain distinct clipped and reserved envelopes",()=>{
 const input=fixture(),v=contourGeometry(input),s=contourGeometry({...input,mode:"stable"});
 assert.deepEqual([v.width,v.base,v.left,v.right,v.deep,v.height],[800,47,20,780,80,117]);
 assert.deepEqual([s.width,s.base,s.left,s.right,s.deep,s.height],[800,47,0,800,94,117]);
 const centered=contourGeometry(fixture({mode:"stable",controls:[{rect:rect(350,80,100,24),growthX:42,growthY:12}]}));
 assert.deepEqual([centered.left,centered.right,centered.deep],[225,375,96]);
});
test("contour geometry handles empty shelf, hidden/outside controls, negative translation and two rows",()=>{
 const empty=contourGeometry(fixture({controls:[{rect:rect(0,0,20,20)}]}));
 assert.deepEqual([empty.left,empty.right,empty.deep],[null,null,47]);
 const shifted=contourGeometry(fixture({shiftY:-20,nav:rect(100,0,800,48),row:rect(300,0,400,52),
 bookmark:rect(120,52,760,42),controls:[{rect:rect(110,56,80,24)},{rect:rect(800,56,100,24)}]}));
 assert.equal(shifted.key,contourGeometry(fixture()).key);
 const two=contourGeometry(fixture({row:rect(300,20,400,104),bookmark:null}));
 assert.equal(two.base,99);assert.equal(two.deep,99);
 assert.equal(contourGeometry(fixture({wrapper:rect(0,0,0,10)})),null);
 assert.equal(contourGeometry(fixture({shiftY:NaN})),null);
});
test("contour preference normalization and key order are deterministic",()=>{
 const s=readContourSettings((k,d)=>({length:10,hold:45,strength:-10,curve:999,padding:99,transparency:NaN}[k]??d));
 assert.deepEqual(s,{transparency:4,strength:0,length:10,hold:9,curve:300,radius:24,padding:20});
 const a=contourGeometry(fixture()),b=contourGeometry(fixture({settings:Object.fromEntries(Object.entries(defaults).reverse())}));
 assert.equal(a.key,b.key);
 assert.ok(!/NaN|Infinity/.test(contourImage(a.width,a.height,a.base,a.deep,a.left,a.right,defaults)));
});
function fakeSurface(){
 const values=new Map([["--op-contour-height",["80px","important"]],["--op-contour-mask",["old","important"]]]);
 let fail="",ignore="",writes=0;
 return {values,get writes(){return writes;},set fail(v){fail=v;},set ignore(v){ignore=v;},style:{
  getPropertyValue:k=>values.get(k)?.[0]??"",getPropertyPriority:k=>values.get(k)?.[1]??"",
  setProperty(k,v,p=""){writes++;if(fail===k){fail="";throw Error("style");}if(ignore===k){ignore="";return;}values.set(k,[v,p]);},
  removeProperty(k){values.delete(k);}
 }};
}
test("mask generation and partial write failure preserve committed values and permit retry",()=>{
 const f=fakeSurface(),g=contourGeometry(fixture()),prior=[...f.values];
 assert.throws(()=>commitContourMask(f,g,defaults,()=>{throw Error("svg");}),/svg/);
 assert.equal(f.writes,0);assert.deepEqual([...f.values],prior);
 f.fail="--op-contour-mask";assert.throws(()=>commitContourMask(f,g,defaults),/style/);
 assert.deepEqual([...f.values],prior);
 f.ignore="--op-contour-mask";assert.throws(()=>commitContourMask(f,g,defaults),/rejected/);
 assert.deepEqual([...f.values],prior);
 assert.equal(commitContourMask(f,g,defaults),g.key);
 assert.equal(f.style.getPropertyValue("--op-contour-height"),g.height+"px");
 assert.ok(f.style.getPropertyValue("--op-contour-mask").startsWith('url("data:image/svg+xml,'));
});
test("stable geometry and SVG remain equivalent to pinned bookmark implementation",()=>{
 // Golden hashes captured from preview.101's independent bookmark SVG renderer before removal.
 const golden=["a5877ce9","744c614c","744c614c","efba668f","86d84edc","86d84edc"];let index=0;
 const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16);};
 for(const opt of [defaults,{...defaults,padding:12,length:20,hold:19,strength:70}]){
  for(const growth of [0,25,100]){
   const input=fixture({settings:opt,mode:"stable",availableGrowth:growth});
   const g=contourGeometry(input);
   // The accepted stable calculation is preserved after provider cutover.
   const extra=Math.min(40,growth);
   const left=Math.floor(Math.max(0,10-extra)-opt.padding);
   const right=Math.ceil(Math.min(800,800+extra)+opt.padding);
   const deep=Math.ceil(100-20+14+opt.padding);
   assert.deepEqual([g.left,g.right,g.deep],[left,right,deep]);
   assert.equal(hash(contourImage(g.width,g.height,g.base,g.deep,g.left,g.right,opt)),golden[index++]);
  }
 }
});
test("Layout uses both pure policies and commits its cache only after style success",()=>{
 const s=read("src/layout/contour-controller.js.part");
 assert.ok(s.includes("contourGeometry({wrapper,nav,row:rr,bookmark,controls,shiftY,trim,settings,mode,"));
 assert.ok(s.includes("contourKey=commitContourMask(surface,geometry,settings)"));
 assert.ok(!s.includes("contourKey=key;"));
});

test("stable envelope outside the wrapper cannot create a reversed shelf",()=>{
 const g=contourGeometry(fixture({mode:"stable",bookmark:rect(0,72,90,42),controls:[{rect:rect(0,76,40,24)}],availableGrowth:0}));
 assert.deepEqual([g.left,g.right,g.deep],[null,null,47]);
});
test("one contour writer; no bookmark SVG, override, contour RAF or fade preference observer",()=>{
 const b=read("bookmarks.uc.mjs"),css=read("src/styles/magnetic-bookmarks.css.part"),c=read("src/layout/contour-controller.js.part");
 for(const forbidden of ["function contourImage(","function contourPath(","--zr-bm-contour-mask","contourFrame","contourPrefix","panelObserver"])assert.ok(!b.includes(forbidden),forbidden);
 assert.ok(!css.includes("data-zr-bm-stable-contour"));
 assert.ok(c.includes('if(envelope?.status==="hold")return;'));
 assert.ok(c.includes('if(bookmarkContourPolicy()!=="off"){contourUntil=0;return;}'));
 assert.ok(read("src/layout/geometry.js.part").includes("syncAddressState?.();\n    measureToolbarGeometry(true);paintContour(true);"));
});
function layoutFixture(){
 const f=fakeSurface(),input=fixture(),attrs=new Set(),frames=[],events=[];
 let envelope={status:"off"},provider=null,reads=0,policy="off";
 const r=(box)=>({getBoundingClientRect(){reads++;return box;},hasAttribute:()=>false,getAttribute:()=>null});
 const row=r(input.row),navbar=r(input.nav),toolbarWrapper=r(input.wrapper),bookmarks=r(input.bookmark);
 bookmarks.querySelectorAll=()=>[];bookmarks.contains=()=>true;
 const items={children:input.controls.map(c=>r(c.rect)),contains:()=>true,hasAttribute:()=>false};
 const root={hasAttribute:k=>attrs.has(k),getAttribute:()=>null};
 const document={getElementById:k=>k==="PlacesToolbarItems"?items:null};
 const window={performance:{now:()=>1000},getComputedStyle:()=>({display:"block",visibility:"visible",opacity:"1",getPropertyValue:()=>"5px"}),
 requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},__nocturneTrace:(event,data)=>events.push([event,typeof data==="function"?data():data])};
 const install=()=>{provider={contourPolicy:()=>policy,readContourEnvelope:()=>envelope};window.__zenMagneticBookmarksShared=provider;};
 const remove=()=>{delete window.__zenMagneticBookmarksShared;provider=null;};
 const c=read("src/layout/contour-controller.js.part");
 const api=new Function("window","document","root","row","navbar","toolbarWrapper","bookmarks","surface","contourGeometry","commitContourMask","defaults",
  'let dead=false,contourPainting=false,contourKey="",contourMode="",contourFrame=0,contourUntil=0,panelSwitchUntil=0;const contourObserved=new Set();function hoverSupported(){return true}function contourSettings(){return defaults}'+c+
  'return {paintContour,stepContour,scheduleContour,onContourTransition,mode:()=>contourMode,key:()=>contourKey,setUntil:n=>contourUntil=n};')
  (window,document,root,row,navbar,toolbarWrapper,bookmarks,f,contourGeometry,commitContourMask,defaults);
 return {f,input,attrs,frames,events,api,install,remove,get reads(){return reads;},set envelope(v){envelope=v;},set policy(v){policy=v;}};
}
test("Layout selects stable, holds without DOM reads, and falls back on provider removal",()=>{
 const x=layoutFixture();x.api.paintContour();assert.equal(x.api.mode(),"visible");
 x.install();x.envelope={status:"ready",bookmark:x.input.bookmark,controls:x.input.controls,availableGrowth:25,current:()=>true};x.policy="ready";
 x.api.paintContour();assert.equal(x.api.mode(),"stable");const key=x.api.key(),writes=x.f.writes,reads=x.reads;
 x.envelope={status:"hold"};x.policy="hold";x.api.setUntil(2000);x.api.stepContour(1000);
 assert.equal(x.api.key(),key);assert.equal(x.f.writes,writes);assert.equal(x.reads,reads);assert.equal(x.frames.length,0);
 x.remove();x.api.paintContour();assert.equal(x.api.mode(),"visible");assert.ok(x.f.writes>writes);
});
test("Layout rejects stale provider snapshots and holds prior cache on failure",()=>{
 const x=layoutFixture();x.api.paintContour();const key=x.api.key(),writes=x.f.writes;
 x.install();x.envelope={status:"ready",bookmark:x.input.bookmark,controls:x.input.controls,availableGrowth:25,current:()=>false};
 x.api.paintContour();assert.equal(x.api.key(),key);assert.equal(x.f.writes,writes);
 x.envelope={status:"ready",bookmark:x.input.bookmark,controls:x.input.controls,availableGrowth:25,current:()=>true};
 x.f.fail="--op-contour-mask";x.api.paintContour();assert.equal(x.api.key(),key);assert.equal(x.api.mode(),"visible");
 x.api.paintContour();assert.equal(x.api.mode(),"stable");
});
test("bookmark provider returns exact resting expansion budget and refuses busy/hidden states",()=>{
 const b=read("bookmarks.uc.mjs"),code=b.slice(b.indexOf("  function contourPolicy("),b.indexOf("  function scheduleContour("));
 const input=fixture(),list={isConnected:true,children:[],hasAttribute:()=>false};
 const mk=(r,magnetic=true)=>({parentElement:magnetic?list:null,matches:()=>magnetic,getAttribute:()=>null,getBoundingClientRect:()=>r});
 list.children=[mk(input.controls[0].rect),mk(input.controls[1].rect)];
 const toolbar={isConnected:true,hidden:false,getBoundingClientRect:()=>input.bookmark,querySelectorAll:()=>[]};
 const root={getAttribute:()=>"true",hasAttribute:()=>false},window={getComputedStyle:()=>({display:"block",visibility:"visible",opacity:"1"})};
 const api=new Function("root","window","toolbar","list",'let dead=false,addressSuspended=false,working=false;const settings={enabled:true,stableBackground:true,scale:1.4};function busy(){return working}function desiredY(){return 1.3}function availableGrowth(){return 25}'+code+'return {readContourEnvelope,setBusy:v=>working=v,setSuspended:v=>addressSuspended=v};')(root,window,toolbar,list);
 const e=api.readContourEnvelope();assert.equal(e.status,"ready");assert.equal(e.controls.length,2);assert.equal(e.availableGrowth,25);
 assert.ok(Math.abs(e.controls[0].growthX-32)<1e-6);assert.ok(Math.abs(e.controls[0].growthY-14.2)<1e-6);
 api.setBusy(true);assert.equal(api.readContourEnvelope(true).status,"hold");api.setBusy(false);
 api.setSuspended(true);assert.equal(api.readContourEnvelope().status,"hold");assert.equal(api.readContourEnvelope(true).status,"ready");
 toolbar.hidden=true;assert.equal(api.readContourEnvelope(true).status,"off");
 assert.equal(api.readContourEnvelope(true,{}).status,"off");
});
