import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {createDragLifecycle} from "../src/algorithms/drag-lifecycle.mjs";
const s=readFileSync(new URL("../src/hub/controller.js.part",import.meta.url),"utf8");
const a=s.indexOf("    function trashMotionEnabled("),b=s.indexOf("    function purgeEligible(",a);
assert.ok(a>=0&&b>a);
function harness({confirmed=true,reduced=true}={}){
 const lifecycle=createDragLifecycle(),frames=new Map(),calls=[],attrs=new Set();let next=0,workspace="trash",capture=false,role="trash";
 const rect={left:10,top:300,right:210,bottom:350,width:200,height:50},panelRect={left:0,top:0,right:240,bottom:500,width:240,height:500};
 const target={isConnected:true,disabled:false,dataset:{workspaceId:"free"},getBoundingClientRect:()=>({left:10,top:50,width:220,height:36}),setAttribute(){},removeAttribute(){},animate(){}};
 const style={removeProperty(k){delete this[k];}};
 const row={isConnected:true,style,getBoundingClientRect:()=>rect,before(){},setAttribute(k){attrs.add(k);},removeAttribute(k){attrs.delete(k);},remove(){this.isConnected=false;}};
 const panel={scrollLeft:0,scrollTop:0,getBoundingClientRect:()=>panelRect,setPointerCapture(){capture=true;},hasPointerCapture:()=>capture,releasePointerCapture(){capture=false;},append(n){assert.equal(n,row);calls.push("lift");},contains:n=>n===target,querySelectorAll:()=>[target]};
 const tab={getAttribute:()=>workspace},native={},browser={selectedTab:null};
 const ctx={window:{gBrowser:browser,matchMedia:()=>({matches:reduced}),requestAnimationFrame(fn){frames.set(++next,fn);return next;},cancelAnimationFrame(id){frames.delete(id);},performance:{now:()=>0}},prefs:{getIntPref:()=>160,getBoolPref:(k,f)=>k==="zen.nocturne.motion.enabled"?!reduced:f},
  dragLifecycle:lifecycle,cancelActiveDrag:r=>lifecycle.cancel(r),panel,document:{elementFromPoint:(x,y)=>y<100?{closest:()=>target}:null},open:true,trashOpen:true,busy:false,projectionBusy:false,destroyed:false,trashAllowed:true,commandBlocked:()=>false,
  singleWindow:()=>true,hubTrashTabEligible:()=>true,browser,freeId:()=>"free",trashId:()=>role,trashTabs:()=>workspace===role?[tab]:[],
  readWorkspaceOwnership:(w,n,id)=>{assert.equal(n,native);return {tabs:workspace===id?[tab]:[]};},
  manager:()=>native,inspectWorkspaceTabMove:(w,n,t,source,id)=>{assert.equal(n,native);assert.equal(t,tab);assert.equal(source,"trash");return workspace===id?(confirmed?"confirmed":"unknown"):"retained";},
  restoreTrashTab:async(t,id,approval)=>{assert.equal(t,tab);assert.equal(approval.native,native);assert.equal(approval.trash,"trash");workspace=id;calls.push("move:"+id);return confirmed?true:undefined;},render(){calls.push("render");},
  make(){return {isConnected:true,setAttribute(){},replaceWith(n){assert.equal(n,row);this.isConnected=false;calls.push("return");},getBoundingClientRect:()=>rect};}
 };
 const api=runInNewContext("let trashDrag=null,trashTarget=null,suppressClickUntil=0;\n"+s.slice(a,b)+"\n({beginTrashDrag,moveTrashDrag,endTrashDrag,finishTrashDrag,current:()=>trashDrag})",ctx);
 const event=(x,y,extra={})=>({isTrusted:true,button:0,buttons:1,pointerId:1,clientX:x,clientY:y,preventDefault(){},stopPropagation(){},...extra});
 const move=(x,y)=>{api.moveTrashDrag(event(x,y));for(const [id,fn] of [...frames]){frames.delete(id);fn();}};
 return {api,row,tab,calls,lifecycle,attrs,event,move,captured:()=>capture,workspace:()=>workspace,setRole:value=>{role=value;workspace=value;}};
}
test("real row lifts once, then restores the native tab once on release",async()=>{
 const h=harness();h.api.beginTrashDrag(h.event(40,320),h.tab,h.row);
 h.move(42,322);assert.equal(h.calls.length,0);
 h.move(100,70);assert.deepEqual(h.calls,["lift"]);assert.equal(h.api.current().row,h.row);
 assert.equal(h.attrs.has("data-op-trash-floating"),true);assert.equal(h.captured(),true);
 await h.api.endTrashDrag(h.event(100,70,{buttons:0}));
 assert.equal(h.workspace(),"free");assert.deepEqual(h.calls,["lift","move:free","return","render"]);
 assert.equal(h.api.current(),null);assert.equal(h.captured(),false);assert.equal(h.attrs.size,0);
 await h.api.endTrashDrag(h.event(100,70,{buttons:0}));assert.equal(h.calls.filter(x=>x==="move:free").length,1);
});
test("pointer cancellation returns original row without native transfer",()=>{
 const h=harness();h.api.beginTrashDrag(h.event(40,320),h.tab,h.row);h.move(100,70);
 h.lifecycle.cancel("focus-lost");assert.equal(h.workspace(),"trash");assert.deepEqual(h.calls,["lift","return","render"]);
 assert.equal(h.api.current(),null);assert.equal(h.captured(),false);assert.equal(h.attrs.size,0);
});

test("unconfirmed physical transfer stops drag instead of playing a false success or return animation",async()=>{
 const h=harness({confirmed:false,reduced:false});h.api.beginTrashDrag(h.event(40,320),h.tab,h.row);h.move(100,70);
 await h.api.endTrashDrag(h.event(100,70,{buttons:0}));
 assert.equal(h.workspace(),"free");assert.deepEqual(h.calls,["lift","move:free","return","render"]);
 assert.equal(h.api.current(),null);assert.equal(h.captured(),false);assert.equal(h.attrs.size,0);
});

test("a changed Trash role during the lifted drag cannot redirect the approved transfer",async()=>{
 const h=harness({reduced:false});h.api.beginTrashDrag(h.event(40,320),h.tab,h.row);h.move(100,70);
 h.setRole("replacement");
 await h.api.endTrashDrag(h.event(100,70,{buttons:0}));
 assert.equal(h.workspace(),"replacement");assert.deepEqual(h.calls,["lift","return","render"]);assert.equal(h.api.current(),null);
});
