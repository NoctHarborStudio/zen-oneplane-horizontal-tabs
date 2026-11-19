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
 let fail="",writes=0;
 return {values,get writes(){return writes;},set fail(v){fail=v;},style:{
  getPropertyValue:k=>values.get(k)?.[0]??"",getPropertyPriority:k=>values.get(k)?.[1]??"",
  setProperty(k,v,p=""){writes++;if(fail===k){fail="";throw Error("style");}values.set(k,[v,p]);},
  removeProperty(k){values.delete(k);}
 }};
}
test("mask generation and partial write failure preserve committed values and permit retry",()=>{
 const f=fakeSurface(),g=contourGeometry(fixture()),prior=[...f.values];
 assert.throws(()=>commitContourMask(f,g,defaults,()=>{throw Error("svg");}),/svg/);
 assert.equal(f.writes,0);assert.deepEqual([...f.values],prior);
 f.fail="--op-contour-mask";assert.throws(()=>commitContourMask(f,g,defaults),/style/);
 assert.deepEqual([...f.values],prior);
 assert.equal(commitContourMask(f,g,defaults),g.key);
 assert.equal(f.style.getPropertyValue("--op-contour-height"),g.height+"px");
 assert.ok(f.style.getPropertyValue("--op-contour-mask").startsWith('url("data:image/svg+xml,'));
});
test("stable geometry and SVG remain equivalent to pinned bookmark implementation",()=>{
 const source=read("bookmarks.uc.mjs");
 const legacy=source.slice(source.indexOf("  function contourPath("),source.indexOf("  function releaseContour("));
 const render=new Function("clamp",legacy+"return contourImage")((x,a,b)=>Math.max(a,Math.min(b,x)));
 for(const opt of [defaults,{...defaults,padding:12,length:20,hold:19,strength:70}]){
  for(const growth of [0,25,100]){
   const input=fixture({settings:opt,mode:"stable",availableGrowth:growth});
   const g=contourGeometry(input);
   // The current legacy stable calculation is deliberately preserved
   // until the shared-provider cutover; same accepted path and alpha.
   const extra=Math.min(40,growth);
   const left=Math.floor(Math.max(0,10-extra)-opt.padding);
   const right=Math.ceil(Math.min(800,800+extra)+opt.padding);
   const deep=Math.ceil(100-20+14+opt.padding);
   assert.deepEqual([g.left,g.right,g.deep],[left,right,deep]);
   assert.equal(contourImage(g.width,g.height,g.base,g.deep,g.left,g.right,opt),
    render(g.width,g.height,g.base,g.deep,g.left,g.right,opt));
  }
 }
});
test("Layout uses the pure visible policy and commits its cache only after style success",()=>{
 const s=read("src/layout/contour-controller.js.part");
 assert.ok(s.includes("contourGeometry({wrapper,nav,row:rr,bookmark,controls,shiftY,trim,settings})"));
 assert.ok(s.includes("contourKey=commitContourMask(surface,geometry,settings)"));
 assert.ok(!s.includes("contourKey=key;"));
});
