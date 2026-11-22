import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../src/"+p,import.meta.url),"utf8");
const source=read("native/tab-adapter.js.part");
const body=source.slice(source.indexOf("  function readDraggedTab("),source.indexOf("  function splitGroup("));
function fixture(){
 const TYPE="application/x-oneplane-native-tab",KEY="__oneplaneTabDrag",wins=[],traces=[],target={priv:false};
 target.__nocturneTrace=(name,data,opts)=>traces.push({name,data,opts});
 const make=(priv=false,token=1)=>{
  const win={priv,closed:false,tabs:[]},tab={owner:win};win.tabs=[tab];
  const ctl={tab,token,groupValue:null,source(){return this.tab},sourceToken(){return this.token},group(){return this.groupValue}};
  win[KEY]=ctl;wins.push(win);return {win,tab,ctl};
 };
 const wm={getEnumerator(){const list=[...wins];return {hasMoreElements:()=>!!list.length,getNext:()=>list.shift()}}};
 const tabOwner=t=>t?.owner;
 const validNativeTab=t=>!!t&&!t.invalid&&!t.owner.closed&&t.owner.tabs.includes(t);
 const privateState=w=>w?.priv??null;
 const readDraggedTab=new Function("Services","window","DRAG_TYPE","DRAG_CONTROLLER","tabOwner","validNativeTab","privateState",body+"return readDraggedTab")({wm},target,TYPE,KEY,tabOwner,validNativeTab,privateState);
 const event=(type="dragover",payload=null,opts={})=>({type,isTrusted:opts.trusted??true,dataTransfer:opts.missing?null:{
  types:opts.flavor===false?["text/plain"]:[TYPE],mozGetDataAt(){if(opts.protected)throw Error("opaque");return payload}
 }});
 return {make,wins,target,traces,event,read:readDraggedTab};
}
test("unique protected source resolves; concurrent sources reject independent of order",()=>{
 const f=fixture(),a=f.make();assert.equal(f.read(f.event()),a.tab);
 assert.equal(f.read(f.event("dragover",null,{protected:true})),a.tab);
 f.make();assert.equal(f.read(f.event()),null);
 assert.deepEqual(f.traces.map(x=>x.data),[{reason:"ambiguous"}]);
 f.wins.reverse();assert.equal(f.read(f.event()),null);
});
test("exact trusted DataTransfer payload wins, subject to current native source lease",()=>{
 const f=fixture(),a=f.make(),b=f.make();
 assert.equal(f.read(f.event("drop",b.tab)),b.tab);
 assert.equal(f.read(f.event("dragover",a.tab)),a.tab);
 for(const token of [null,0,-1,Infinity,Number.MAX_SAFE_INTEGER+1]){
   b.ctl.token=token;assert.equal(f.read(f.event("drop",b.tab)),null);
 }
 b.ctl.token=2;b.ctl.tab=null;assert.equal(f.read(f.event("drop",b.tab)),null);
});
test("retired, invalid and failing controllers cannot compete with the valid source",()=>{
 const f=fixture(),old=f.make(false,null),broken=f.make(),live=f.make();
 broken.tab.invalid=true;assert.equal(f.read(f.event()),live.tab);
 broken.ctl.source=()=>{throw Error("retired");};assert.equal(f.read(f.event()),live.tab);
 old.ctl.token=0;assert.equal(f.read(f.event()),live.tab);
 live.ctl.token=0;assert.equal(f.read(f.event()),null);
});
test("synthetic events, wrong flavor, split and private mismatch cannot authorize adoption",()=>{
 const f=fixture(),p=f.make(true),a=f.make();
 assert.equal(f.read(f.event("drop",a.tab,{trusted:false})),null);
 assert.equal(f.read(f.event("drop",a.tab,{flavor:false})),null);
 assert.equal(f.read(f.event("drop",a.tab,{missing:true})),null);
 assert.equal(f.read(f.event("dragleave")),null);
 assert.equal(f.read(f.event("drop",p.tab)),null);
 a.ctl.groupValue={};assert.equal(f.read(f.event("drop",a.tab)),null);
});
test("unresolved dragover clears captured incoming preview without triggering native drop",()=>{
 const strip=read("interactions/strip-drag.js.part"),ctrl=read("interactions/drag-controller.js.part");
 const s=strip.slice(strip.indexOf("  function revealForDrag("),strip.indexOf("  function onToolbarDrop("));
 const c=ctrl.slice(ctrl.indexOf("  function onStripDragOver("),ctrl.indexOf("  // Frozen mirrors"));
 const capture=new Function(s+"const calls=[],retireChangedDragViewport=()=>false,retireBlockedNativeTabDrag=()=>false,readDraggedTab=()=>null,hoverSupported=()=>false;function clearIncomingDrag(reason){calls.push(reason)}revealForDrag({});return calls;")();
 const row=new Function(c+"const calls=[],retireChangedDragViewport=()=>false,dragPhaseInputAllowed=()=>true,readDraggedTab=()=>null;function clearIncomingDrag(reason){calls.push(reason)}onStripDragOver({});return calls;")();
 assert.deepEqual(capture,["source-unresolved"]);assert.deepEqual(row,["source-unresolved"]);
});
