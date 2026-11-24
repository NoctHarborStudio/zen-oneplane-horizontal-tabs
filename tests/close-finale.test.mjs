import test from "node:test";
import assert from "node:assert/strict";
import {createCloseFinale,createLayeredWindowLease,closeWindowAlpha} from "../src/core/close-finale.mjs";

function fixture({failAt=null,opacity=1,windows=false,mica=null,nativeFactory=null}={}){
 const effects=[],listeners=new Map(),nodes=[],frames=new Map(),events=[];
 let frameId=0;
 function node(tag,ns){
   const n={tag,namespaceURI:ns,children:[],parent:null,style:{setProperty(k,v){this[k]=v;}},attrs:new Map(),
    setAttribute(k,v){this.attrs.set(k,v);},hasAttribute(k){return this.attrs.has(k);},getAttribute(k){return this.attrs.get(k)??null;},removeAttribute(k){this.attrs.delete(k);},append(...items){for(const c of items){c.parent=this;this.children.push(c);}},
    remove(){if(this.parent){this.parent.children=this.parent.children.filter(c=>c!==this);this.parent=null;}},
    animate(frames,timing){
      if(effects.length===failAt)throw Error("acquisition");
      let resolve;const finished=new Promise(r=>{resolve=r;});
      const a={node:this,frames,timing,cancelled:false,sealed:false,finished,
        cancel(){this.cancelled=true;},finish(){this.sealed=true;resolve();}};
      effects.push(a);return a;
    }};
   nodes.push(n);return n;
 }
 const root=node("root"),doc={timeline:{currentTime:42},createElementNS:(ns,tag)=>node(tag,ns)};
 if(mica!==null)root.setAttribute("windowsmica",mica);
 const win={requestAnimationFrame(fn){const id=++frameId;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);},__nocturneTrace(event,data){events.push({event,data});},getComputedStyle(n){
   const a=effects.findLast(a=>a.node===n&&!a.cancelled);
   return {opacity:String(a?.sealed?a.frames.at(-1).opacity:n===root?opacity:n.style.opacity??1)};
 },addEventListener(k,fn,capture){listeners.set(k,{fn,capture});},
 removeEventListener(k,fn,capture){assert.equal(listeners.get(k)?.fn,fn);assert.equal(listeners.get(k)?.capture,capture);listeners.delete(k);}};
 const onModal=()=>{};
 return {win,doc,root,effects,listeners,nodes,onModal,frames,events,make:()=>createCloseFinale({win,doc,root,start:1190,onModal,windows,nativeFactory}),
   async coverDone(){doc.timeline.currentTime=42+1510;effects[0].finish();await Promise.resolve();},
   frame(ms=16){doc.timeline.currentTime+=ms;const pending=[...frames];frames.clear();for(const [,fn] of pending)fn();}};
}

test("finale uses the same brand and fades the root only after the logo finishes",()=>{
 const f=fixture(),h=f.make();assert.ok(h);
 assert.deepEqual([h.logoAt,h.fadeAt,h.end],[1510,1970,2470]);
 assert.equal(f.root.children.length,1);
 assert.equal(f.root.children[0].children[0].children[1].textContent,"NOCTURNE");
 assert.equal(f.root.children[0].inert,true);
 assert.deepEqual(f.effects.map(a=>[a.timing.delay,a.timing.duration,a.startTime]),[[1190,320,42],[1510,460,42],[1970,500,42]]);
 assert.equal(f.effects[2].node,f.root);assert.deepEqual(f.effects[2].frames,[{opacity:1},{opacity:0}]);
 assert.deepEqual(h.seal(),{rootOpacity:0,coverOpacity:1,logoOpacity:1});
 assert.equal(h.release(),0);assert.equal(h.release(),0);
 assert.equal(f.root.children.length,0);assert.equal(f.listeners.size,0);
 assert.ok(f.effects.every(a=>a.cancelled));assert.equal(f.win.getComputedStyle(f.root).opacity,"1");
});

test("each failed effect acquisition unwinds the brand and restores root visibility",()=>{
 for(const failAt of [0,1,2]){
   const f=fixture({failAt});assert.equal(f.make(),null);
   assert.equal(f.root.children.length,0);assert.equal(f.listeners.size,0);
   assert.ok(f.effects.every(a=>a.cancelled));assert.equal(f.win.getComputedStyle(f.root).opacity,"1");
 }
 const f=fixture({opacity:.5});assert.equal(f.make(),null);assert.equal(f.effects.length,0);assert.equal(f.listeners.size,0);
});

test("native whole-window alpha is exclusive with CSS fade and leaves Mica unchanged",async()=>{
 const values=[],retired=[];
 const lease={acquire:()=>true,set:a=>{values.push(a);return true;},read:()=>values.at(-1)??255,release:()=>{retired.push(false);return 0;},commit:()=>{retired.push(true);}};
 const f=fixture({windows:true,mica:"true",nativeFactory:()=>lease}),h=f.make();
 await f.coverDone();f.frame();f.frame();assert.equal(f.effects[2].cancelled,true);
 assert.equal(f.root.getAttribute("windowsmica"),"true");
 assert.equal(values.length,0);
 f.doc.timeline.currentTime=42+1970;f.effects[1].finish();await Promise.resolve();
 f.frame(250);assert.equal(values[0],128);
 assert.equal(h.seal().rootOpacity,1);assert.equal(values.at(-1),0);
 assert.equal(h.release(),0);assert.deepEqual(retired,[false]);assert.equal(f.frames.size,0);
});
test("native acquisition refusal preserves scheduled CSS fade; late or non-Windows does not acquire",async()=>{
 for(const mode of ["refuse","late","other","cancel"]){
  let calls=0,releases=0;
  const f=fixture({windows:mode!=="other",nativeFactory:()=>({acquire:()=>{calls++;return false;},read:()=>null,release:()=>{releases++;return 0;}})}),h=f.make();
  await f.coverDone();
  if(mode==="late")f.doc.timeline.currentTime=42+1970;
  if(mode==="cancel")h.release();
  f.frame();f.frame();
  assert.equal(calls,mode==="refuse"?1:0);assert.equal(releases,calls);
  if(mode!=="cancel")assert.equal(h.seal().rootOpacity,0);
  h.release();
 }
});
test("native frame failure restores lease and resumes CSS at original epoch",async()=>{
 let released=0;
 const lease={acquire:()=>true,set:()=>false,read:()=>255,release:()=>{released++;return 0;}};
 const f=fixture({windows:true,nativeFactory:()=>lease}),h=f.make();
 await f.coverDone();f.frame();f.frame();f.doc.timeline.currentTime=42+1970;
 f.effects[1].finish();await Promise.resolve();f.frame(100);
 assert.equal(released,1);assert.equal(f.effects.at(-1).startTime,42);
 assert.equal(h.seal().rootOpacity,0);h.release();
});
test("native seal commits no restoration on confirmed close",async()=>{
 let committed=0,released=0;
 const f=fixture({windows:true,nativeFactory:()=>({acquire:()=>true,set:()=>true,read:()=>0,release:()=>{released++;},commit:()=>{committed++;}})}),h=f.make();
 await f.coverDone();f.frame();f.frame();h.seal();h.commit();h.release();
 assert.equal(committed,1);assert.equal(released,0);
});
function nativeFixture(style=0x100,classStyle=8){
 let a=255,closed=0;const writes=[];
 const api={valid:()=>true,style:()=>style,classStyle:()=>classStyle,setStyle:v=>{style=v;writes.push(v);},alpha:v=>{a=v;return true;},readAlpha:()=>a,close:()=>{closed++;}};
 return {api,writes,state:()=>({style,a,closed}),lease:createLayeredWindowLease(api)};
}
test("layered lease rejects incompatible styles and preserves unrelated bits on cancellation",()=>{
 for(const [style,cls] of [[0x80000,8],[0x200000,8],[0x100,0x20],[0x100,0x40]]){
   const f=nativeFixture(style,cls);assert.equal(f.lease.acquire(),false);f.lease.release();assert.deepEqual(f.writes,[]);assert.equal(f.state().closed,1);
 }
 const f=nativeFixture();assert.equal(f.lease.acquire(),true);assert.equal(f.lease.set(50),true);
 f.api.setStyle(f.state().style|0x80);assert.equal(f.lease.release(),0);assert.deepEqual(f.state(),{style:0x180,a:255,closed:1});f.lease.release();
 assert.equal(f.state().closed,1);
});
test("lease rolls back partial acquisition and deferred reentrant release",()=>{
 const f=nativeFixture();f.api.alpha=()=>false;assert.equal(f.lease.acquire(),false);f.lease.release();assert.equal(f.state().style,0x100);assert.equal(f.state().closed,1);
 const g=nativeFixture(),set=g.api.setStyle;g.api.setStyle=v=>{set(v);if(v&0x80000)g.lease.release();};
 assert.equal(g.lease.acquire(),false);assert.equal(g.state().style,0x100);assert.equal(g.state().closed,1);
});
test("whole-window fade is bounded and uses the same ease-in-out curve",()=>{
 assert.equal(closeWindowAlpha(-1),255);assert.equal(closeWindowAlpha(0.5),128);assert.equal(closeWindowAlpha(2),0);
 for(let i=1;i<=100;i++)assert.ok(closeWindowAlpha(i/100)<=closeWindowAlpha((i-1)/100));
});
