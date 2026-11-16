import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const source=readFileSync(new URL("../src/toolbar/hover.js.part",import.meta.url),"utf8");
const state=readFileSync(new URL("../src/toolbar/hover-state.js.part",import.meta.url),"utf8");
const start=source.indexOf("  function releaseIndicatorHover()"),end=source.indexOf("  function trackTabPointer",start);
const a=state.indexOf("  const INDICATOR_RETURN_DELAY"),b=state.indexOf("  let indicatorShown",a);
assert.ok(start>=0&&end>start&&a>=0&&b>a);
function harness(){
  const tasks=new Map();let seq=0,refreshes=0;
  const window={setTimeout(fn,ms){tasks.set(++seq,{fn,ms});return seq;},clearTimeout(id){tasks.delete(id);}};
  const api=runInNewContext("let indicatorHover='A',hoverX=4,indicatorReturnTimer=0;\n"+state.slice(a,b)+source.slice(start,end)+
    "\n({releaseIndicatorHover,indicatorSelectionChanged,select(v){cancelIndicatorReturn();indicatorHover=v;},current(){return indicatorHover;}})",
    {window,dead:false,refreshIndicator(){refreshes++;},refreshIslandTitle(){}});
  return {api,tasks,refreshes:()=>refreshes,fire(){for(const [id,t] of [...tasks]){tasks.delete(id);t.fn();}}};
}
test("hover departure keeps last target for exactly 2000ms without rearming",()=>{
  const h=harness();h.api.releaseIndicatorHover();h.api.releaseIndicatorHover();
  assert.equal(h.api.current(),"A");assert.equal(h.tasks.size,1);
  assert.equal([...h.tasks.values()][0].ms,2000);h.fire();assert.equal(h.api.current(),null);
});
test("hover on another tab cancels old return; explicit selection clears held target",()=>{
  const h=harness();h.api.releaseIndicatorHover();h.api.select("B");
  h.fire();assert.equal(h.api.current(),"B");
  h.api.releaseIndicatorHover();h.api.indicatorSelectionChanged();
  assert.equal(h.api.current(),null);assert.equal(h.tasks.size,0);
});
