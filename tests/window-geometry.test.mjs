import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {rightPlusOffset,restingToolbarBudget,toolbarPartitionMetrics} from "../src/algorithms/toolbar-center.mjs";
import {planAdaptiveTabRows} from "../src/algorithms/tab-overflow.mjs";
import {islandBoundary} from "../src/algorithms/island-boundary.mjs";
const source=readFileSync(new URL("../src/layout/geometry.js.part",import.meta.url),"utf8");
const home=readFileSync(new URL("../src/home/shared-home.js.part",import.meta.url),"utf8");
const base=readFileSync(new URL("../src/styles/base.css.part",import.meta.url),"utf8");
const tabs=readFileSync(new URL("../src/styles/tabs.css.part",import.meta.url),"utf8");
const visibility=readFileSync(new URL("../src/layout/visibility.js.part",import.meta.url),"utf8");
const lifecycle=readFileSync(new URL("../src/core/window-lifecycle.js.part",import.meta.url),"utf8");
const calc=rightPlusOffset;
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
 assert.equal(restingToolbarBudget({widths:[],groups:[],windowWidth:1000,right:100,tabWidth:36,dragRoom:16,iconHome:false,returnReserve:0}).availableAt(100),764);
});
test("window resize and native size mode reflow are lifecycle-owned",()=>{
 for(const event of ["resize","sizemodechange"]){
  assert.ok(lifecycle.includes('addEventListener("'+event+'", onWindowGeometryChanged)'));
  assert.ok(lifecycle.includes('removeEventListener("'+event+'", onWindowGeometryChanged)'));
 }
 const code=visibility.slice(visibility.indexOf("function onWindowGeometryChanged("),visibility.indexOf("function onCompactChanged("));
 const calls=[];
 const run=new Function("calls",code+'let dead=false,hoverTab={},addressTransition=null,addressSettling=false,cascadeState="hidden";const row={hasAttribute:()=>false};function checkCenterGeometry(stage){calls.push("geometry:"+stage)}function clearTabHover(){calls.push("hover")}function nativeInlineOpen(){return false}function addressBar(){}function resetTabCascade(){calls.push("cascade")}function movePageActions(){calls.push("actions")}function centerToolbar(){calls.push("center")}function onCompactChanged(){calls.push("layout")}function schedule(){calls.push("sync")}function revealSelectedInStrip(){calls.push("reveal")}const window={requestAnimationFrame(fn){fn()}};onWindowGeometryChanged();')(calls);
 assert.deepEqual(calls,["geometry:window","hover","cascade","actions","center","layout","sync","reveal"]);
});

test("one and two rows share the same card center, padding and final-row reserve",()=>{
 assert.ok(base.includes("--op-hover-reserve:18px;"));
 assert.ok(base.includes("--op-hover-bottom-pad:10px;"));
 assert.ok(base.includes("--op-lane-inline-pad:1px;"));
 assert.ok(base.includes("--op-row-center:calc((var(--op-top-row-height) - var(--op-hover-bottom-pad)) / 2);"));
 assert.equal((tabs.match(/padding:0 var\(--op-lane-inline-pad\) var\(--op-hover-bottom-pad\);/g)||[]).length,2);
 assert.equal((tabs.match(/top:var\(--op-row-center\);/g)||[]).length,2);
 assert.ok(tabs.includes("top:calc(var(--op-top-row-height) + var(--op-row-center))!important;"));
 assert.ok(!tabs.includes("padding-block-end:0!important;"));
 assert.ok(!tabs.includes("top:calc(var(--op-top-row-height)/2)!important;"));
 assert.ok(tabs.includes(".oneplane-island-lane {scrollbar-width:none!important;}"));
 // Both modes have the same first center and trailing clearance.
 const height=34,reserve=18,pad=10,card=height-4,pitch=height+reserve,center=(pitch-pad)/2;
 assert.equal(center,21);
 for(const rows of [1,2])assert.equal(rows*pitch-((rows-1)*pitch+center+card/2),16);
});
test("single contour owner uses a fixed row-independent trim",()=>{
 const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
 for(const s of [read("src/layout/contour-controller.js.part")]){
  assert.ok(s.includes('getPropertyValue("--op-contour-trim")'));
  assert.ok(!s.includes("compactRows?0:5"));
  assert.ok(!s.includes('hasAttribute("data-op-overflow-row")?0:5'));
 }
 assert.ok(base.includes("--op-contour-trim:5px;"));
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

test("resting strip gaps are native window drag regions without disabling tab drop targets",()=>{
 assert.ok(base.includes(":not(#oneplane-center-start,#oneplane-center-end):not(#oneplane-tabs)"));
 assert.match(tabs,/#oneplane-tabs:not\(\[data-op-dragging\],\[data-op-lane-drag\],\[data-op-island-incoming\],\[data-op-cascade\]\) :is\(\.oneplane-tab-list,\.oneplane-island-lane\) \{\s*-moz-window-dragging:drag!important;/);
 assert.match(tabs,/#oneplane-tabs:is\(\[data-op-dragging\],\[data-op-lane-drag\],\[data-op-island-incoming\],\[data-op-cascade\]\) :is\(\.oneplane-tab-list,\.oneplane-island-lane\) \{\s*-moz-window-dragging:no-drag!important;/);
 assert.match(tabs,/#oneplane-tabs :is\(\.oneplane-tab,\.oneplane-split-group,\.oneplane-title-island,\.oneplane-new-tab,\.oneplane-overflow-slider,button,input\) \{\s*-moz-window-dragging:no-drag!important;/);
 assert.ok(tabs.includes("height:6px;min-width:0;"));
 assert.ok(tabs.includes("height:1px;border:0;border-radius:999px;"));
 assert.ok(tabs.includes("height:2px;box-sizing:border-box;"));
 assert.ok(tabs.includes("currentColor 34%,transparent"));
 assert.ok(tabs.includes("height:3px;background:color-mix(in srgb,currentColor 58%"));
});

test("address uses shared actual partition budget and retains native margins",()=>{
 assert.ok(source.includes("reclaimAddressWidth(preferred,baseline,w=>planAt(availableAt(left+w+addressMargins)))"));
 assert.ok(source.includes("const layout=planAt(available);"));
 assert.ok(source.includes("const addressMargins="));
 assert.ok(source.includes("wantsIsland&&!addressHidden?"));
});

test("resting toolbar budget and partition dimensions preserve prior policy across widths and groups",()=>{
 for(const windowWidth of [280,540,899,900,1200,1920])for(const count of [0,1,2,8,100])
 for(const iconHome of [false,true])for(const returnReserve of [0,12]){
  const tabWidth=36,openWidth=180,dragRoom=16,right=96,left=128;
  const groups=Array.from({length:count},(_,i)=>i%7===3),widths=groups.map(group=>group?100:tabWidth);
  const budget=restingToolbarBudget({widths,groups,windowWidth,right,tabWidth,dragRoom,iconHome,returnReserve});
  const available=Math.max(0,2*Math.min(windowWidth/2-left,windowWidth/2-right)-4-2*dragRoom);
  assert.equal(budget.availableAt(left),available);
  assert.equal(budget.naturalTabsWidth,widths.reduce((n,w)=>n+w+3,0));
  const title=iconHome?32:Math.max(100,Math.min(180,available-2*(tabWidth+9)));
  const layout=planAdaptiveTabRows(widths,groups,islandBoundary(widths,tabWidth+3),available,title,tabWidth,3,returnReserve);
  assert.deepEqual(budget.planAt(available),layout);
  const widthOf=indices=>indices.reduce((n,i)=>n+widths[i]+3,6);
  const hoverReserve=Math.ceil(tabWidth*.20),expandReserve=layout.mode==="wide"?(iconHome?Math.max(0,openWidth-tabWidth):hoverReserve):0;
  const half=Math.max(widthOf(layout.topLeft),widthOf(layout.topRight)+(layout.topPlus?tabWidth+3:0),tabWidth+9)+expandReserve;
  const topWidth=layout.mode==="wide"?Math.min(available,layout.title+6+2*half):Math.max(layout.title+6,available);
  const lowerNatural=widthOf(layout.lower)+2*(tabWidth+3)+(iconHome?Math.max(0,openWidth-tabWidth):hoverReserve);
  const bottomWidth=Math.min(Math.max(tabWidth+6,windowWidth-24),Math.max(3*tabWidth+12,lowerNatural));
  const plusOffset=3+layout.topRight.reduce((sum,i)=>sum+Math.max(0,widths[i])+3,0)+Math.max(0,expandReserve);
  assert.deepEqual(toolbarPartitionMetrics({layout,widths,available,windowWidth,tabWidth,openWidth,iconHome}),{
   islandWidth:layout.title,rowWidth:Math.max(layout.title+6,topWidth),plusOffset,overflowWidth:bottomWidth,
   bottomOpen:Math.max(tabWidth,Math.min(openWidth,bottomWidth-2*(tabWidth+3)-6))});
 }
 assert.ok(source.indexOf("const metrics=toolbarPartitionMetrics(")<source.indexOf("applyStripPartition(layout,order,stillCurrent)"));
});
