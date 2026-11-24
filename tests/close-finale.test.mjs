import test from "node:test";
import assert from "node:assert/strict";
import {createCloseFinale} from "../src/core/close-finale.mjs";

function fixture({failAt=null,opacity=1}={}){
 const effects=[],listeners=new Map(),nodes=[];
 function node(tag,ns){
   const n={tag,namespaceURI:ns,children:[],parent:null,style:{setProperty(k,v){this[k]=v;}},attrs:new Map(),
    setAttribute(k,v){this.attrs.set(k,v);},append(...items){for(const c of items){c.parent=this;this.children.push(c);}},
    remove(){if(this.parent){this.parent.children=this.parent.children.filter(c=>c!==this);this.parent=null;}},
    animate(frames,timing){
      if(effects.length===failAt)throw Error("acquisition");
      const a={node:this,frames,timing,cancelled:false,sealed:false,finished:Promise.resolve(),
        cancel(){this.cancelled=true;},finish(){this.sealed=true;}};
      effects.push(a);return a;
    }};
   nodes.push(n);return n;
 }
 const root=node("root"),doc={timeline:{currentTime:42},createElementNS:(ns,tag)=>node(tag,ns)};
 const win={getComputedStyle(n){
   const a=effects.findLast(a=>a.node===n&&!a.cancelled);
   return {opacity:String(a?.sealed?a.frames.at(-1).opacity:n===root?opacity:n.style.opacity??1)};
 },addEventListener(k,fn,capture){listeners.set(k,{fn,capture});},
 removeEventListener(k,fn,capture){assert.equal(listeners.get(k)?.fn,fn);assert.equal(listeners.get(k)?.capture,capture);listeners.delete(k);}};
 const onModal=()=>{};
 return {win,doc,root,effects,listeners,nodes,onModal,make:()=>createCloseFinale({win,doc,root,start:1190,onModal})};
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
