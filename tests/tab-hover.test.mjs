import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("hover progress is registered once and controls equal-axis zoom and exact reserved width",async()=>{
  const base=await readFile(new URL("../src/styles/base.css.part",import.meta.url),"utf8");
  const css=await readFile(new URL("../src/styles/drag.css.part",import.meta.url),"utf8");
  assert.match(base,/@property --op-hover-progress\s*\{\s*syntax: "<number>";\s*inherits: false;\s*initial-value: 0;/);
  assert.ok(css.includes("scale:var(--op-hover-zoom)"));
  assert.ok(css.includes("--op-hover-base:calc(var(--op-hover-slot) / var(--op-hover-zoom))"));
  assert.ok(css.includes("margin-inline:calc((var(--op-hover-slot) - var(--op-hover-base)) / 2)"));
  assert.ok(css.includes("transition:--op-hover-progress"));
  assert.ok(!css.includes("scale: 1.02 1.20"));
  for(const compact of [32,36,44])for(const expanded of [140,180,240])for(const delta of [.2,.05,0]){
    for(let i=0;i<=100;i++){
      const p=i/100,z=1+p*delta,slot=compact+(expanded-compact)*p,base=slot/z,margin=(slot-base)/2;
      assert.ok(Math.abs(base*z-slot)<1e-9);
      assert.ok(Math.abs(base+2*margin-slot)<1e-9);
      assert.ok(margin>=0);
    }
  }
});

test("Island zoom reserves the exact painted width without descending or revealing titles",async()=>{
 const css=await readFile(new URL("../src/styles/drag.css.part",import.meta.url),"utf8");
 const geometry=await readFile(new URL("../src/layout/geometry.js.part",import.meta.url),"utf8");
 const island=css.slice(css.indexOf("/* Island: grow"),css.indexOf("/* Keep the combined"));
 assert.ok(island.includes("--op-hover-slot:calc(var(--op-tab) * var(--op-hover-zoom))"));
 assert.ok(island.includes("scale:var(--op-hover-zoom);translate:0 0;"));
 assert.ok(island.includes("margin-inline:calc((var(--op-hover-slot) - var(--op-hover-base)) / 2)"));
 assert.ok(geometry.includes("const hoverReserve=Math.ceil(tabWidth*.20)"));
 for(const width of [32,36,44])for(const delta of [.12,.20])for(let i=0;i<=100;i++){
  const zoom=1+delta*i/100,slot=width*zoom,margin=(slot-width)/2;
  assert.ok(Math.abs(width+2*margin-slot)<1e-9);
 }
});

test("workspace title retains its old text through swap then fades to latest target",async()=>{
 const source=await readFile(new URL("../src/toolbar/hover.js.part",import.meta.url),"utf8");
 const visibility=await readFile(new URL("../src/layout/visibility.js.part",import.meta.url),"utf8");
 const a=source.indexOf("let islandTextAnimation"),b=source.indexOf("function refreshIslandTitle(",a);
 const run=new Function("window",`
  let phase="in",dead=false;const root={getAttribute:()=>phase};
  const effects=[],island={title:"Home"},islandTitle={textContent:"Home",animate(frames,options){
    let resolve,reject;const finished=new Promise((a,b)=>{resolve=a;reject=b;});
    const e={frames,options,finished,resolve,cancel:()=>reject(Error("cancelled"))};effects.push(e);return e;}};
  ${source.slice(a,b)}
  return {setIslandTitle,islandTitle,effects,phase:p=>phase=p};
 `)({__nocturneTrace(){}});
 run.setIslandTitle("Home",true);assert.equal(run.effects.length,0);
 run.setIslandTitle("New workspace",true);assert.equal(run.islandTitle.textContent,"Home");
 assert.equal(run.effects[0].options.duration,101);
 run.effects[0].resolve();await Promise.resolve();
 assert.equal(run.islandTitle.textContent,"New workspace");assert.equal(run.effects.length,2);
 run.effects[1].resolve();await Promise.resolve();await Promise.resolve();
 run.setIslandTitle("New workspace",true);assert.equal(run.effects.length,2);
 run.phase("idle");run.setIslandTitle("Hover",true);assert.equal(run.islandTitle.textContent,"Hover");
 assert.ok(source.includes('if(phase==="out"||phase==="swap")return;'));
 assert.ok(visibility.includes('if(phase==="in")refreshIslandTitle();'));
});
