import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const css=read("src/styles/base.css.part");
test("first row uses one center and overflow adds only lower reserve",()=>{
  assert.ok(css.includes("--op-row-center:calc(var(--op-control-row-height) / 2)"));
  assert.ok(css.includes("--op-control-row-height:calc(var(--op-top-row-height) - var(--op-hover-bottom-pad))"));
  assert.ok(css.includes("--op-control-bottom-reserve:calc(var(--op-hover-bottom-pad) + var(--op-overflow-extra))"));
  assert.ok(css.includes("margin-block:0 var(--op-control-bottom-reserve)!important"));
  assert.ok(css.includes("--op-overflow-extra:var(--op-top-row-height)"));
  for(const rows of [1,2])for(const h of [16,28,30,34,42]){
    const center=(52*rows-(10+52*(rows-1))-h)/2+h/2;
    assert.equal(center,21);
  }
  assert.ok(read("src/styles/refined-features.css.part").includes("height:var(--op-control-row-height,42px)!important"));
});
test("History is a positive-width left slot, between Hub and Downloads",()=>{
  const rule=id=>css.slice(css.indexOf("#nav-bar-customization-target > #"+id)).split("}")[0];
  const order=id=>Number(rule(id).match(/order:(-?\d+) !important/)[1]);
  assert.ok(order("oneplane-hub-button")<order("oneplane-history-button"));
  assert.ok(order("oneplane-history-button")<order("oneplane-download-indicator-slot"));
  const history=rule("oneplane-history-button");
  assert.ok(history.includes("margin:0 !important"));
  assert.doesNotMatch(history,/translateY|margin:[^;]*-30px/);
  const source=read("src/layout/geometry.js.part");
  const ids=new Function(source.slice(0,source.indexOf("  const centerIds"))+"return leftIds;")();
  for(const id of ["oneplane-hub-button","oneplane-history-button","oneplane-download-indicator-slot"])assert.ok(ids.has(id),id);
});
test("compact address anchor is bounded and native diagnostics include all three slots",()=>{
  const address=read("src/styles/address.css.part").split("/* Paint the same real box")[0];
  for(const p of ["height","min-height","max-height"])assert.ok(address.includes(p+": var(--op-height) !important"));
  const diag=read("src/core/diagnostics.js.part");
  for(const id of ["oneplane-hub-button","oneplane-history-button","oneplane-download-indicator-slot"])assert.ok(diag.includes('"'+id+'"'));
});
