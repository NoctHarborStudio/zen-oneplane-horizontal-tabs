import test from "node:test";
import assert from "node:assert/strict";
import {createCloseFinale} from "../src/core/close-finale.mjs";

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

test("Windows backdrop is removed only behind an opaque cover after two frames and restored exactly",async()=>{
 const f=fixture({windows:true,mica:"true"}),h=f.make();assert.ok(h);
 assert.equal(f.root.getAttribute("windowsmica"),"true");
 await f.coverDone();assert.equal(f.frames.size,1);f.frame();
 assert.equal(f.root.getAttribute("windowsmica"),"true");
 f.frame();assert.equal(f.root.hasAttribute("windowsmica"),false);
 const event=f.events.find(e=>e.event==="disassembly.backdrop.switch");
 assert.deepEqual(event.data,{removed:true,elapsed:1542,rootOpacity:1,coverOpacity:1});
 h.seal();assert.equal(f.root.hasAttribute("windowsmica"),false);
 assert.equal(h.release(),0);assert.equal(f.root.getAttribute("windowsmica"),"true");
 assert.equal(f.frames.size,0);assert.equal(h.release(),0);
});
test("non-Windows, missing attribute, stale or late callbacks do not change the native backdrop",async()=>{
 for(const opts of [{windows:false,mica:"true"},{windows:true}]){
   const f=fixture(opts),h=f.make();await f.coverDone();assert.equal(f.frames.size,0);h.release();
 }
 for(const kind of ["release","seal","late"]){
   const f=fixture({windows:true,mica:"true"}),h=f.make();await f.coverDone();
   const stale=[...f.frames.values()][0];
   if(kind==="release")h.release();else if(kind==="seal")h.seal();else f.doc.timeline.currentTime=42+1970;
   stale();f.frame();
   assert.equal(f.root.getAttribute("windowsmica"),"true");assert.equal(f.frames.size,0);h.release();
 }
});
test("release does not overwrite a native backdrop attribute reinstalled by another owner",async()=>{
 const f=fixture({windows:true,mica:""}),h=f.make();await f.coverDone();f.frame();f.frame();
 assert.equal(f.root.hasAttribute("windowsmica"),false);
 f.root.setAttribute("windowsmica","replacement");h.release();assert.equal(f.root.getAttribute("windowsmica"),"replacement");
});

test("DWM NONE is requested behind the opaque cover, verified at seal and restored on cancel",async()=>{
 let material=3;const writes=[];
 const native={read:()=>({hr:0,value:material}),write:value=>{writes.push(value);material=value;return {hr:0,value};}};
 const f=fixture({windows:true,mica:"true",nativeFactory:()=>native}),h=f.make();
 assert.deepEqual(writes,[]);await f.coverDone();f.frame();assert.deepEqual(writes,[]);
 f.frame();assert.deepEqual(writes,[1]);assert.equal(material,1);
 assert.equal(f.events.find(e=>e.event==="disassembly.dwm.switch").data.confirmed,true);
 h.seal();assert.equal(f.events.find(e=>e.event==="disassembly.dwm.seal").data.value,1);
 assert.equal(h.release(),0);assert.deepEqual(writes,[1,3]);assert.equal(material,3);
 assert.equal(h.release(),0);
});
test("unreadable DWM baseline never writes, retains Gecko fallback",async()=>{
 for(const nativeFactory of [()=>{throw Error("unavailable");},()=>({read:()=>({hr:-1,value:null}),write:()=>assert.fail("unsafe write")})]){
   const f=fixture({windows:true,mica:"true",nativeFactory}),h=f.make();
   await f.coverDone();f.frame();f.frame();assert.equal(f.root.hasAttribute("windowsmica"),false);
   assert.equal(f.events.some(e=>e.event==="disassembly.dwm.switch"),false);
   h.release();assert.equal(f.root.getAttribute("windowsmica"),"true");
 }
});
test("DWM failure and foreign re-add are distinguished",async()=>{
 for(const fail of [true,false]){
   let material=3;const writes=[];
   const native={read:()=>({hr:0,value:material}),write:value=>{writes.push(value);if(fail)return {hr:-1,value:null};material=value;return {hr:0,value};}};
   const f=fixture({windows:true,mica:"true",nativeFactory:()=>native}),h=f.make();
   await f.coverDone();f.frame();f.frame();
   assert.equal(f.events.find(e=>e.event==="disassembly.dwm.switch").data.confirmed,!fail);
   material=4;f.root.setAttribute("windowsmica","foreign");
   h.seal();assert.equal(f.events.find(e=>e.event==="disassembly.dwm.seal").data.value,4);
   h.release();assert.deepEqual(writes,[1]);assert.equal(material,4);assert.equal(f.root.getAttribute("windowsmica"),"foreign");
 }
});
