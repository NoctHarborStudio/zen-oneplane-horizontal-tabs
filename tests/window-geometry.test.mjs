import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/layout/geometry.js.part",import.meta.url),"utf8");
const home=readFileSync(new URL("../src/home/shared-home.js.part",import.meta.url),"utf8");
const base=readFileSync(new URL("../src/styles/base.css.part",import.meta.url),"utf8");
const tabs=readFileSync(new URL("../src/styles/tabs.css.part",import.meta.url),"utf8");
const visibility=readFileSync(new URL("../src/layout/visibility.js.part",import.meta.url),"utf8");
const lifecycle=readFileSync(new URL("../src/core/window-lifecycle.js.part",import.meta.url),"utf8");
const calc=new Function(source.slice(source.indexOf("function rightPlusOffset("),source.indexOf("function centerToolbar("))+"return rightPlusOffset")();
test("plus follows actual right slots and preserves expansion room",()=>{
 assert.equal(calc([]),3);assert.equal(calc([36,36]),81);
 assert.equal(calc([36,100]),145);assert.equal(calc([36,36],144),225);
 assert.ok(tabs.includes("left:min(calc(100% - var(--op-tab))"));
});
test("Home backdrop does not subtract the overlapping native drag region",()=>{
 assert.ok(home.includes("#zen-shared-home,#zen-shared-home *{-moz-window-dragging:default!important}"));
 assert.ok(home.includes("#zen-shared-home :is(button,input,textarea,select,summary,a,[draggable=true],.zh-recommendations){-moz-window-dragging:no-drag!important}"));
 assert.ok(!home.includes("#zen-shared-home,#zen-shared-home *{-moz-window-dragging:no-drag!important}"));
 assert.doesNotMatch(home,/-moz-window-dragging:\s*drag\b/);
 assert.ok(!home.includes("moveTo("));
});
test("toolbar drag spaces have nonzero dimensions, controls stay non-draggable",()=>{
 assert.ok(base.includes("--op-window-drag-room: 16px"));
 assert.ok(base.includes("height: var(--op-height);"));
 assert.ok(base.includes("-moz-window-dragging: drag !important"));
 assert.ok(base.includes(":not(#oneplane-center-start,#oneplane-center-end)"));
 assert.ok(source.includes("-4-2*dragRoom"));
});
test("window resize and native size mode reflow are lifecycle-owned",()=>{
 for(const event of ["resize","sizemodechange"]){
  assert.ok(lifecycle.includes('addEventListener("'+event+'", onWindowGeometryChanged)'));
  assert.ok(lifecycle.includes('removeEventListener("'+event+'", onWindowGeometryChanged)'));
 }
 const code=visibility.slice(visibility.indexOf("function onWindowGeometryChanged("),visibility.indexOf("function onCompactChanged("));
 const calls=[];
 const run=new Function("calls",code+'let dead=false,hoverTab={},addressTransition=null,addressSettling=false,cascadeState="hidden";const row={hasAttribute:()=>false};function clearTabHover(){calls.push("hover")}function nativeInlineOpen(){return false}function addressBar(){}function resetTabCascade(){calls.push("cascade")}function movePageActions(){calls.push("actions")}function centerToolbar(){calls.push("center")}function onCompactChanged(){calls.push("layout")}function schedule(){calls.push("sync")}function revealSelectedInStrip(){calls.push("reveal")}const window={requestAnimationFrame(fn){fn()}};onWindowGeometryChanged();')(calls);
 assert.deepEqual(calls,["hover","cascade","actions","center","layout","sync","reveal"]);
});

test("compact lane padding and hidden tracks override the wide lane cascade",()=>{
 assert.ok(tabs.includes("padding-block-end:0!important;"));
 assert.ok(tabs.includes("padding-inline:1px!important;"));
 assert.ok(tabs.includes(".oneplane-island-lane {scrollbar-width:none!important;}"));
});


test("Home Fade is a scoped native drag region with no extra DOM hit layer",()=>{
 const contour=readFileSync(new URL("../src/styles/contour.css.part",import.meta.url),"utf8");
 const surface=readFileSync(new URL("../src/layout/surface.js.part",import.meta.url),"utf8");
 const css=readFileSync(new URL("../chrome.css",import.meta.url),"utf8");
 assert.match(contour,/&:not\(:has\(#zen-shared-home\[data-zh-search\], #zen-shared-home\[data-zh-return\]\)\) #zen-appcontent-navbar-wrapper\[oneplane-home-hold\]\[data-op-panel-open\]:not\(:has\([^\n]+\)\) > #oneplane-toolbar-surface \{\s*-moz-window-dragging: drag !important;/);
 assert.ok(contour.includes("var(--op-contour-height, 0px)"));
 assert.ok(surface.includes('"pointer-events": "none"'));
 assert.ok(base.includes(":not(#oneplane-center-start,#oneplane-center-end)"));
 assert.match(contour,/#PersonalToolbar :is\(toolbarbutton,button,input,menupopup,panel\) \{\s*-moz-window-dragging: no-drag !important;/);
 assert.ok(css.includes(contour));
});
