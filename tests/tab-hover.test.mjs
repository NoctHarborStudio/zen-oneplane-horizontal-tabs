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
