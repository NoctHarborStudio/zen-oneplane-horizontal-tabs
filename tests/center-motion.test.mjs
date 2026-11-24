import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const source=read("src/core/center-motion.js.part");
const foldSource=read("src/algorithms/magnetic-fold.mjs").replace(/^export function /gm,"function ");
const {magnetState,keyframes,portalGap,portalClip}=new Function(foldSource+"return createMagneticFoldMath();")();
const bloomSource=read("src/algorithms/startup-bloom.mjs").replace(/^export function /gm,"function ");
const errorClassSource=read("src/core/error-class.mjs").replace(/^export function /gm,"function ");
const runtimeSource=errorClassSource+foldSource+bloomSource+source;
const card=(x,y,lower=false)=>({x,y,cx:500,cy:26,unit:1,opacity:1,lower});
test("Magnetic Fold reaches the real two-dimensional hub and reverses exactly",()=>{
 for(const c of [card(200,26),card(770,26),card(340,61,true),card(500,61,true)]){
  const f=keyframes(c),r=keyframes(c,true);
  assert.equal(f[0].opacity,0);assert.equal(f.at(-1).opacity,1);
  const start=magnetState(c,0),end=magnetState(c,1);
  assert.equal(c.x+start.x,500);assert.equal(c.y+start.y,26);
  assert.ok(end.x===0);assert.ok(end.y===0);assert.equal(end.s,1);
  for(let i=0;i<f.length;i++){assert.equal(f[i].transform,r.at(-1-i).transform);assert.equal(f[i].opacity,r.at(-1-i).opacity);}
  for(let i=1;i<=100;i++){
   const prev=magnetState(c,(i-1)/100),next=magnetState(c,i/100);
   assert.ok(Math.abs(next.x)<=Math.abs(prev.x)+1e-8);
   assert.ok(next.s>=prev.s-1e-8);assert.ok(next.a>=prev.a-1e-8);
  }
 }
});
test("neighbor spacing and width shrink together; near cards disappear first",()=>{
 const near=card(450,26),far=card(390,26);
 for(let i=0;i<=100;i++){
  const p=i/100,n=magnetState(near,p),f=magnetState(far,p);
  assert.ok(n.a<=f.a+1e-8);
  assert.ok((near.x+n.x)-(far.x+f.x)+1e-8>=20*(n.s+f.s)/2||p<.06);
 }
});
test("proxies isolate chrome mirrors from scroll clips and native selectors",()=>{
 assert.ok(source.includes('host.attachShadow({mode:"closed"})'));
 assert.ok(source.includes('host.inert=true'));
 assert.ok(source.includes('cloneNode(true)'));
 assert.ok(source.includes('host.remove()'));
 assert.ok(source.includes('holdHandoff(sample)'));
 assert.ok(read("chrome.css").includes("data-zr-center-handoff"));
});
test("all three lifecycle controllers use the same window engine",()=>{
 for(const p of ["startup-animation.uc.mjs","closing-animation.uc.mjs","workspace-transition.uc.mjs"])assert.ok(read(p).includes("__nocturneCenterMotion"));
 assert.ok(read("layout.uc.mjs").includes(source));
 assert.ok(!read("workspace-transition.uc.mjs").includes("function cardOffsets("));
 assert.ok(!read("startup-animation.uc.mjs").includes("function collectTabs("));
});
test("ordinary tab selection is immediate and does not inspect content",()=>{
 assert.ok(source.includes('tc.addEventListener("TabSelect",onSelect)'));
 assert.ok(source.includes('selection.native'));assert.ok(!source.includes("deck.animate("));
 for(const forbidden of ["contentDocument","contentWindow","drawSnapshot","setTimeout(onSelect"])assert.ok(!source.includes(forbidden));
});

test("shared workspace card alpha is not multiplied by a second row fade",()=>{
 const css=read("chrome.css");
 assert.ok(css.includes('data-zr-center-motion="workspace"'));
 assert.ok(css.includes('opacity:1!important;\n  --zr-workspace-ui-progress:var(--zr-workspace-progress);'));
 assert.ok(css.includes(':not([data-zr-workspace-phase="swap"])'));
 assert.ok(read("src/layout/visibility.js.part").includes('if(phase==="out"||phase==="swap"){islandTextAnimation?.cancel();clearTabHover()'));
});

test("Home portal fades cards before crossing actual panel edges, including the lower row",()=>{
 const hub={left:410,right:590,top:11,bottom:41};
 for(const [x,y,lower,w] of [[200,26,false,36],[770,26,false,110],[390,26,false,36],[610,26,false,36],[340,76,true,90],[500,76,true,36],[590,76,true,36]]){
  const c={...card(x,y,lower),hub,r:{width:w,height:30}};
  const frames=keyframes(c),reverse=keyframes(c,true);
  assert.equal(frames[0].opacity,0);
  assert.equal(frames.at(-1).opacity,1);
  let wasVisible=false;
  for(let i=0;i<=1000;i++){
   const f=magnetState(c,i/1000),gap=portalGap(c,f);
   if(gap<=0)assert.equal(f.a,0,"inside Home");
   if(f.a>0)wasVisible=true;
   if(wasVisible)assert.ok(f.a>0,"no re-entry after emergence");
  }
  for(let i=0;i<frames.length;i++)assert.equal(frames[i].opacity,reverse.at(-1-i).opacity);
 }
 const clip=portalClip(hub,{left:100,top:0,width:800,height:100},1600,900);
 assert.ok(clip.startsWith('path(evenodd,'));
 assert.ok(clip.includes('M 310 11 H 490 V 41 H 310 Z'));
});
test("fallback without a visible Home preserves the original fold",()=>{
 const c=card(200,26);
 assert.deepEqual(magnetState({...c,hub:null},.4),magnetState(c,.4));
});

test("split handle and members use measured local boxes rather than shadow grid defaults",()=>{
 const i=source.indexOf("function freezeBox("),j=source.indexOf("function proxy(",i);
 const freeze=new Function(source.slice(i,j)+"return freezeBox")();
 const n={style:{}};
 freeze(n,{left:124,top:81,width:16,height:26},{left:120,top:77});
 assert.equal(n.style.left,"4px");assert.equal(n.style.top,"4px");
 assert.equal(n.style.width,"16px");assert.equal(n.style.height,"26px");
 assert.equal(n.style.position,"absolute");assert.equal(n.style.transform,"none");
 assert.ok(source.includes('freezeBox(copy,dot.getBoundingClientRect(),hr)'));
 assert.ok(source.includes('center.group.geometry'));
});
test("icon updates remain live in the proxy without layout or private URL logging",()=>{
 assert.ok(source.includes('attributeFilter:["src","hidden"]'));
 assert.ok(source.includes("img.complete&&img.naturalWidth>0"));
 assert.ok(source.includes('fallback.style.visibility=ready?"hidden":"visible"'));
 assert.ok(source.includes('for(const off of cleanups)step(off)'));
 const sync=read("src/toolbar/tab-sync.js.part");
 const active=sync.slice(sync.indexOf('if(root.hasAttribute("data-zr-center-motion"))'),sync.indexOf("const homeOpen="));
 assert.ok(active.includes("refreshEntryIcon(tab,entry)"));assert.ok(!active.includes("centerToolbar()"));
});

test("startup uses decoded chrome icons and lazy session cache without navigation",()=>{
 const tab=read("src/toolbar/tab-view.js.part");
 const a=tab.indexOf("function faviconPage("),b=tab.indexOf("function favicon(",a);
 const getPage=new Function("faviconSessionStore",tab.slice(a,b)+"return faviconPage;")({getLazyTabValue:()=>"https://example.org"});
 assert.equal(getPage({ownerDocument:{defaultView:{}},linkedBrowser:{currentURI:{spec:"about:blank"}}}),"https://example.org");
 assert.ok(source.includes("ctx.drawImage(src,"));
 assert.ok(source.includes("img.decode?.()"));
 assert.ok(source.includes("bitmapSource===current"));
 assert.ok(!source.includes("toDataURL("));
 assert.ok(!source.includes("getImageData("));
 assert.ok(read("startup-animation.uc.mjs").includes("engine?.warmIcons?.(row)"));
});

test("paint readiness detects the zero-opacity ancestor that hid decoded startup favicons",()=>{
 const i=source.indexOf("function iconPaintState("),j=source.indexOf("function releasePending(",i);
 const paint=new Function("win",source.slice(i,j)+"return iconPaintState")({getComputedStyle:n=>n.css});
 const node=(parent,opacity=1,display="block",visibility="visible",width=16)=>({parentElement:parent,css:{opacity:String(opacity),display,visibility},getBoundingClientRect:()=>({width,height:16})});
 const outer=node(null,0),card=node(outer),button=node(card,0),icon=node(button,.42),bitmap=node(icon);
 assert.equal(paint(bitmap,outer).visible,false);
 assert.equal(paint(bitmap,outer).alpha,0);
 button.css.opacity="1";
 assert.deepEqual(paint(bitmap,outer),{visible:true,alpha:.42,geometry:true});
 icon.css.visibility="hidden";assert.equal(paint(bitmap,outer).visible,false);
 icon.css.visibility="visible";assert.equal(paint(node(icon,1,"block","visible",0),outer).geometry,false);
 assert.ok(source.includes('center.icon.paint'));
});

test("disposed Center Motion cannot mutate the replacement generation's markers",()=>{
 const attrs=new Map(),root={hasAttribute:k=>attrs.has(k),getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
 const document={documentElement:root,getElementById(){throw Error("stale bookmarks");}};
 let unload,boot=0,diag=0;const window={__nocturneLayoutStartup:{},__nocturneEarlyBoot:{cleanup(){boot++;}},__nocturneDiagnostics:{requestDispose(){diag++;}},CSS:{registerProperty(){}},addUnloadListener(fn){unload=fn;},addEventListener(){},removeEventListener(){}};
 const run=new Function("window","document","Services",runtimeSource);
 run(window,document,{});const old=window.__nocturneCenterMotion;unload();assert.equal(boot,1);assert.equal(diag,1);
 run(window,document,{});const next=window.__nocturneCenterMotion;
 for(const k of ["data-zr-center-pending","data-zr-center-handoff","data-zr-center-motion"])attrs.set(k,"replacement");
 assert.equal(old.start(null,{owner:"startup"}),null);assert.equal(old.bookmarks(),null);old.releasePending();old.dispose();
 assert.equal(window.__nocturneCenterMotion,next);
 assert.deepEqual([...attrs.values()],["replacement","replacement","replacement"]);next.dispose();
});
test("boot prelude cleans the old Layout before replacement fragments mount",()=>{
 const prelude=readFileSync(new URL("../src/core/boot-prelude.js.part",import.meta.url),"utf8");
 let cleaned=0;const window={__nocturneLayoutStartup:{},__oneplaneLayoutController:{cleanup(){cleaned++;}},addUnloadListener(){}};
 const attrs=new Map(),root={hasAttribute:k=>attrs.has(k),setAttribute:(k,v)=>attrs.set(k,v)};
 new Function("window","document","Services",prelude)(window,{documentElement:root},{prefs:{}});
 assert.equal(cleaned,1);
 assert.equal(attrs.has("data-nocturne-early-css-done"),false);
});

function bookmarkFixture({width=200}={}){
 const attrs=new Map(),props=new Map(),priorities=new Map(),effects=[];
 const attributes=m=>({hasAttribute:k=>m.has(k),getAttribute:k=>m.get(k)??null,setAttribute:(k,v)=>m.set(k,v),removeAttribute:k=>m.delete(k)});
 const root=attributes(new Map()),node={...attributes(attrs),getBoundingClientRect:()=>({width}),
   style:{getPropertyValue:k=>props.get(k)??"",getPropertyPriority:k=>priorities.get(k)??"",setProperty(k,v,p=""){props.set(k,v);priorities.set(k,p);},removeProperty(k){props.delete(k);priorities.delete(k);}},
   animate(){const a={finished:Promise.resolve(),cancelled:0,played:0,sealed:0,cancel(){this.cancelled++;},play(){this.played++;},finish(){this.sealed++;},pause(){}};effects.push(a);return a;}};
 const document={documentElement:root,getElementById:()=>node};
 const window={__nocturneLayoutStartup:{},CSS:{registerProperty(){}},addUnloadListener(){},addEventListener(){},removeEventListener(){}};
 const mount=()=>{new Function("window","document","Services",runtimeSource)(window,document,{prefs:{getBoolPref:(k,f)=>f,getIntPref:(k,f)=>f}});return window.__nocturneCenterMotion;};
 return {root,node,window,document,mount,effects};
}
const foldProp="--zr-fold-bookmark-progress",foldMark="data-zr-fold-bookmarks";
test("bookmark fold replacement restores exact baseline in either release order",()=>{
 for(const reverse of [false,true]){
  const f=bookmarkFixture(),engine=f.mount();f.node.style.setProperty(foldProp,".8","important");f.node.setAttribute(foldMark,"original");
  const old=engine.bookmarks({direction:"out"}),next=engine.bookmarks({direction:"in"});
  assert.equal(f.effects[0].cancelled,1);
  if(reverse)next.release();old.release();
  if(!reverse){assert.equal(f.node.getAttribute(foldMark),"true");assert.equal(f.node.style.getPropertyValue(foldProp),"0");next.release();}
  old.resume();old.seal();assert.equal(f.effects[0].played,0);assert.equal(f.effects[0].sealed,0);
  assert.equal(f.node.getAttribute(foldMark),"original");assert.equal(f.node.style.getPropertyValue(foldProp),".8");assert.equal(f.node.style.getPropertyPriority(foldProp),"important");
  assert.equal(f.effects[1].cancelled,1);
 }
});
test("bookmark fold disposal and hot reload cancel the acquired old handle",()=>{
 const f=bookmarkFixture(),old=f.mount(),a=old.bookmarks({owner:"startup"}),next=f.mount(),b=next.bookmarks({owner:"startup"});
 assert.equal(f.effects[0].cancelled,1);a.release();a.seal();assert.equal(f.node.getAttribute(foldMark),"true");
 b.release();assert.equal(f.node.getAttribute(foldMark),null);assert.equal(f.node.style.getPropertyValue(foldProp),"");
 const c=next.bookmarks();next.dispose();assert.equal(f.effects[2].cancelled,1);c.release();assert.equal(f.effects[2].cancelled,1);
});
test("only exact close handles may outlive disposal; replacement reclaims them",()=>{
 const f=bookmarkFixture(),old=f.mount();f.root.setAttribute("data-zr-closing","true");
 const a=old.bookmarks({owner:"close",retainOnDispose:()=>true});old.dispose();assert.equal(f.effects[0].cancelled,0);a.seal();assert.equal(f.effects[0].sealed,1);
 const next=f.mount();assert.equal(f.effects[0].cancelled,1);const b=next.bookmarks({owner:"startup"});a.release();assert.equal(f.node.getAttribute(foldMark),"true");
 next.dispose();assert.equal(f.effects[1].cancelled,1);assert.equal(f.node.getAttribute(foldMark),null);b.release();
});
test("delegated close release retires the disposed engine without replacement",()=>{
 const f=bookmarkFixture(),engine=f.mount();f.root.setAttribute("data-zr-closing","true");const a=engine.bookmarks({owner:"close",retainOnDispose:()=>true});
 engine.dispose();a.release();assert.equal(f.window.__nocturneCenterMotion,undefined);assert.equal(f.node.getAttribute(foldMark),null);
});
test("bookmark pause failure rolls back WAAPI, inline properties and marker",()=>{
 const f=bookmarkFixture(),engine=f.mount(),animate=f.node.animate.bind(f.node);f.node.animate=()=>{const a=animate();a.pause=()=>{throw Error("pause");};return a;};
 assert.equal(engine.bookmarks({paused:true}),null);assert.equal(f.effects[0].cancelled,1);assert.equal(f.node.getAttribute(foldMark),null);assert.equal(f.node.style.getPropertyValue(foldProp),"");
});
test("bookmark admission rejects reentry and cleans deferred disposal",()=>{
 const f=bookmarkFixture(),engine=f.mount(),animate=f.node.animate.bind(f.node);let nested;
 f.node.animate=()=>{nested=engine.bookmarks();engine.dispose();return animate();};
 assert.equal(engine.bookmarks(),null);assert.equal(nested,null);assert.equal(f.effects[0].cancelled,1);assert.equal(f.node.getAttribute(foldMark),null);assert.equal(f.window.__nocturneCenterMotion,undefined);
});
test("missing or zero-width surfaces do not acquire effects",()=>{
 const f=bookmarkFixture({width:0}),engine=f.mount();
 assert.equal(engine.bookmarks(),null);assert.equal(engine.start(null,{owner:"startup"}),null);assert.equal(f.effects.length,0);
});

function proxyFixture(){
 const effects=[],nodes=[],observers=[],events=[],frames=new Map(),fault={},rect={left:0,top:0,right:200,bottom:40,width:200,height:40};
 let nextFrame=0;
 function node(kind="div",r=rect){
  const attrs=new Map(),listeners=new Map();
  const n={kind,style:{setProperty(){}},children:[],parentNode:null,hidden:false,complete:false,naturalWidth:0,
   get parentElement(){return this.parentNode;},get isConnected(){return this===row||!!this.parentNode;},
   contains(n){return this===n||this.children.some(c=>c.contains(n));},
   get attributes(){return [...attrs.keys()].map(name=>({name}));},
   classList:{contains:k=>kind==="card"&&k==="oneplane-tab"},matches:k=>kind==="img"&&k===".oneplane-tab-icon img",
   closest:()=>null,hasAttribute:k=>attrs.has(k),getAttribute:k=>attrs.get(k)??null,
   setAttribute(k,v){attrs.set(k,v);if(fault.mark&&kind==="card"&&k==="data-zr-center-card")throw Error("mark");},removeAttribute:k=>attrs.delete(k),
   getBoundingClientRect(){
    if(this.hasAttribute("data-zr-magnetic-layer")){
      const rr=row.getBoundingClientRect(),x=rr.left+(fault.hostX||0),y=rr.top+(fault.hostY||0);
      return {left:x,top:y,right:x+rr.width,bottom:y+rr.height,width:rr.width,height:rr.height};
    }
    if(this.parentNode?.kind==="shadow"){
      const o=this.parentNode.host.getBoundingClientRect(),x=o.left+parseFloat(this.style.left)+(fault.proxyX||0),y=o.top+parseFloat(this.style.top);
      const w=parseFloat(this.style.width),h=parseFloat(this.style.height);
      return {left:x,top:y,right:x+w,bottom:y+h,width:w,height:h};
    }
    const s=bloomValues(this).scale,dx=(1-s)*r.width/2,dy=(1-s)*r.height/2;
    const shift=kind==="card"&&this.parentNode===list?fault.cardShift||0:0;
    return {left:r.left+dx+shift,right:r.right-dx+shift,top:r.top+dy,bottom:r.bottom-dy,width:r.width*s,height:r.height*s};
   },getAnimations(){return effects.filter(a=>a.node===this&&!a.cancelled);},querySelector(k){return kind==="row"&&k===".oneplane-tab-list"?list:null;},
   querySelectorAll(k){if(kind==="list"&&k===".oneplane-tab,.oneplane-split-group")return this.children;
    if(k==="*")return this.children.flatMap(c=>[c,...c.querySelectorAll("*")]);return [];},
   append(...cs){for(const c of cs){this.children.push(c);c.parentNode=this;}if(kind==="row"&&fault.append)throw Error("append");},
   remove(){if(this.parentNode){const p=this.parentNode;p.children=p.children.filter(x=>x!==this);this.parentNode=null;}},
   attachShadow(){if(fault.shadow)throw Error("shadow");const shadow=node("shadow");shadow.host=this;return shadow;},
   cloneNode(){const c=node(kind,r);for(const child of this.children)c.append(child.cloneNode());return c;},
   addEventListener(k,fn){listeners.set(k,fn);if(fault.listener&&kind==="img"&&k==="error")throw Error("listener");},
   removeEventListener(k,fn){if(listeners.get(k)===fn)listeners.delete(k);},listeners,
   animate(keyframes,timing){if(fault.animate===effects.length+1||fault.bloomAnimate&&kind==="card"&&effects.some(a=>a.node.kind==="card"))throw Error("animate");
    const a={node:this,keyframes,timing,currentTime:0,finished:Promise.resolve(),timeline:fault.foreignTimeline?{}:document.timeline,playbackRate:1,playState:"running",pending:false,cancelled:0,sealed:0,played:0,cancel(){this.cancelled++;this.playState="idle";},finish(){this.sealed++;this.playState="finished";},play(){this.played++;this.playState="running";},pause(){if(fault.pause)throw Error("pause");if(!fault.unpaused)this.playState="paused";}};
    if(fault.seekPromise&&kind==="card"){let value=0;Object.defineProperty(a,"currentTime",{get:()=>value,set(v){value=v;if(v>0)a.finished=Promise.resolve();}});}
    effects.push(a);fault.onAnimate?.();return a;}
  };nodes.push(n);return n;
 }
 const root=node("root"),row=node("row"),list=node("list"),cards=[node("card",{left:20,top:0,right:50,bottom:30,width:30,height:30}),node("card",{left:60,top:0,right:90,bottom:30,width:30,height:30})];
 row.append(list);list.append(...cards);
 function bloomValues(n){
  const a=effects.findLast(a=>a.node===n&&!a.cancelled&&a.keyframes?.[0]?.scale);
  if(!a)return {scale:1,opacity:1};
  const p=(a.currentTime-a.timing.delay)/a.timing.duration;
  const scale=fault.bloomScale?1:p<=0?.72:p<.65?1:.96;
  return {scale,opacity:p<=0?0:1};
 }
 const document={timeline:{currentTime:0},documentElement:root,getElementById:id=>id==="oneplane-tabs"?row:null,createElementNS:(ns,tag)=>node(tag)};
 const window={__nocturneLayoutStartup:{},CSS:{registerProperty(){}},addUnloadListener(){},addEventListener(){},removeEventListener(){},
  matchMedia:()=>({matches:!!fault.reduced}),
  getComputedStyle:n=>({opacity:String(bloomValues(n).opacity),scale:String(bloomValues(n).scale),transform:n===row?fault.rowTransform||"none":"none",visibility:"visible",display:"block",getPropertyValue:()=>""}),
  requestAnimationFrame(fn){const id=++nextFrame;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);},
  CustomEvent:class{constructor(type){this.type=type;}},dispatchEvent(event){events.push(event.type);fault.onEnd?.();},
  MutationObserver:class{constructor(fn){this.fn=fn;this.active=false;observers.push(this);}observe(){this.active=true;if(fault.observe)throw Error("observe");}disconnect(){this.active=false;}}
 };
 const mount=()=>{new Function("window","document","Services",runtimeSource)(window,document,{prefs:{getBoolPref:(k,f)=>k==="zen.nocturne.motion.enabled"?!fault.reduced:f,getIntPref:(k,f)=>f}});return window.__nocturneCenterMotion;};
 const addIcon=()=>{const wrap=node("icon"),img=node("img");wrap.append(img);cards[0].append(wrap);return img;};
 return {root,row,list,cards,nodes,effects,observers,events,frames,fault,window,mount,addIcon};
}
const ownerMark="data-zr-center-motion",cardMark="data-zr-center-card";
function assertProxyClean(f){
 assert.equal(f.root.hasAttribute(ownerMark),false);assert.equal(f.root.hasAttribute("data-zr-fold-measuring"),false);
 assert.ok(f.cards.every(c=>!c.hasAttribute(cardMark)));
 assert.equal(f.row.children.length,1);assert.ok(f.effects.every(a=>a.cancelled===1));
 assert.ok(f.observers.every(o=>!o.active));assert.ok(f.nodes.every(n=>n.listeners.size===0));
}
test("tab proxy failure restores every acquired resource at each setup stage",()=>{
 for(const key of ["shadow","append","mark","observe","listener","pause","animate"]){
  const f=proxyFixture(),engine=f.mount();f.addIcon();f.root.setAttribute("data-zr-workspace-phase","swap");
  f.fault[key]=key==="animate"?2:true;
  assert.equal(engine.start(f.row,{owner:"workspace",paused:true}),null,key);assertProxyClean(f);
 }
});
test("proxy supersession rejects synchronous CenterMotionEnd reentry and stale handles",()=>{
 const f=proxyFixture(),engine=f.mount(),a=engine.start(f.row,{owner:"startup"});let nested;
 f.fault.onEnd=()=>{nested=engine.start(f.row,{owner:"close"});};
 const b=engine.start(f.row,{owner:"workspace"});assert.ok(b);assert.equal(nested,null);
 a.resume();a.seal();a.release();assert.equal(f.effects[0].played,0);assert.equal(f.effects[0].sealed,0);
 assert.equal(f.root.getAttribute(ownerMark),"workspace");assert.equal(f.row.children.length,2);b.release();assertProxyClean(f);
});
test("dispose during proxy acquisition rolls back before returning; cross-surface reentry rejected",()=>{
 const f=proxyFixture(),engine=f.mount();let nested;
 f.fault.onAnimate=()=>{nested=engine.bookmarks();engine.dispose();};
 assert.equal(engine.start(f.row,{owner:"startup"}),null);assert.equal(nested,null);
 assertProxyClean(f);assert.equal(f.window.__nocturneCenterMotion,undefined);
});
test("dispose from CenterMotionEnd aborts the superseding acquisition",()=>{
 const f=proxyFixture(),engine=f.mount();engine.start(f.row,{owner:"startup"});
 f.fault.onEnd=()=>engine.dispose();
 assert.equal(engine.start(f.row,{owner:"workspace"}),null);assertProxyClean(f);
 assert.equal(f.window.__nocturneCenterMotion,undefined);
});
test("close proxy retention is exact and replacement cancels the old handles",()=>{
 const f=proxyFixture(),engine=f.mount();f.root.setAttribute("data-zr-closing","true");
 const a=engine.start(f.row,{owner:"close",direction:"out",retainOnDispose:()=>true});engine.dispose();assert.equal(f.effects[0].cancelled,0);
 const next=f.mount();assertProxyClean(f);const b=next.start(f.row,{owner:"startup"});a.release();a.seal();
 assert.equal(f.root.getAttribute(ownerMark),"startup");b.release();assertProxyClean(f);
});
test("stale handoff callback cannot clear a successor handoff",()=>{
 const f=proxyFixture(),engine=f.mount(),a=engine.start(f.row,{owner:"startup"});a.release();
 const old=[...f.frames.values()][0];const b=engine.start(f.row,{owner:"workspace"});b.release();
 old();assert.equal(f.root.getAttribute("data-zr-center-handoff"),"true");
 const [key,fn]=[...f.frames][0];f.frames.delete(key);fn();
 const [key2,fn2]=[...f.frames][0];f.frames.delete(key2);fn2();
 assert.equal(f.root.hasAttribute("data-zr-center-handoff"),false);assertProxyClean(f);
});
test("proxy release restores exact prior card and root markers",()=>{
 const f=proxyFixture(),engine=f.mount();f.cards[0].setAttribute(cardMark,"prior");f.root.setAttribute(ownerMark,"prior");
 const a=engine.start(f.row,{owner:"workspace"});a.release();
 assert.equal(f.cards[0].getAttribute(cardMark),"prior");assert.equal(f.root.getAttribute(ownerMark),"prior");assert.equal(f.row.children.length,1);
});
test("queued favicon callback after release cannot update detached copies",()=>{
 const f=proxyFixture(),engine=f.mount(),img=f.addIcon();const a=engine.start(f.row,{owner:"startup"});
 const callback=f.observers[0].fn;a.release();img.getAttribute=()=>{throw Error("stale callback");};callback();assertProxyClean(f);
});

test("closing phase alone cannot retain effects during mod disable",()=>{
 const f=proxyFixture(),engine=f.mount();f.root.setAttribute("data-zr-closing","true");
 engine.start(f.row,{owner:"close",direction:"out",retainOnDispose:()=>false});engine.dispose();assertProxyClean(f);
 assert.equal(f.window.__nocturneCenterMotion,undefined);
 const b=bookmarkFixture(),other=b.mount();b.root.setAttribute("data-zr-closing","true");
 other.bookmarks({owner:"close",retainOnDispose:()=>false});other.dispose();assert.equal(b.effects[0].cancelled,1);assert.equal(b.node.hasAttribute(foldMark),false);
});
test("delegated tab release after cancelled native close restores sources",()=>{
 const f=proxyFixture(),engine=f.mount();let committing=true;
 f.root.setAttribute("data-zr-closing","true");const a=engine.start(f.row,{owner:"close",direction:"out",retainOnDispose:()=>committing});
 engine.dispose();assert.equal(f.effects[0].cancelled,0);committing=false;a.release();assertProxyClean(f);
 assert.equal(f.window.__nocturneCenterMotion,undefined);
});
test("close consumer uses actual native commit predicate for both handles",()=>{
 const code=read("closing-animation.uc.mjs");
 assert.equal((code.match(/retainOnDispose:\(\)=>controller\.committing/g)||[]).length,2);
});

test("startup proxy epoch uses exact owned effects, rejects stale handle and does not call play",()=>{
 const f=proxyFixture(),engine=f.mount(),handle=engine.start(f.row,{owner:"startup",paused:true});
 const starts=[];handle.resumeAt(a=>starts.push(a));
 assert.deepEqual(starts,f.effects);assert.ok(f.effects.every(a=>a.played===0));
 handle.release();let stale=false;try{handle.resumeAt(()=>{throw Error("unexpected start");});}catch(e){stale=e.message==="center-epoch-stale";}
 assert.equal(stale,true);assertProxyClean(f);
});
test("startup bookmark epoch is exact and setter errors reach Assembly",()=>{
 const f=bookmarkFixture(),engine=f.mount(),handle=engine.bookmarks({owner:"startup",paused:true});
 let failed=false;try{handle.resumeAt(()=>{throw Error("setter");});}catch(e){failed=e.message==="setter";}
 assert.equal(failed,true);assert.equal(f.effects[0].played,0);
 handle.release();let stale=false;try{handle.resumeAt(()=>{});}catch(e){stale=e.message==="bookmark-epoch-stale";}
 assert.equal(stale,true);
});

test("only startup tab and bookmark effects join the exact outcome ledger",()=>{
 const f=proxyFixture(),engine=f.mount(),observed=[];
 const observeEffect=(effect,surface,current)=>observed.push({effect,surface,current});
 const a=engine.start(f.row,{owner:"startup",paused:true,observeEffect});
 assert.equal(a.startupOutcomeVersion,1);
 assert.equal(observed.length,f.effects.length);
 assert.ok(observed.every((o,i)=>o.effect===f.effects[i]&&o.surface==="tabs"&&o.current()));
 a.release();assert.ok(observed.every(o=>!o.current()));
 const n=observed.length,b=engine.start(f.row,{owner:"workspace",observeEffect});
 assert.equal(observed.length,n);b.release();
 const bm=bookmarkFixture(),other=bm.mount(),h=other.bookmarks({owner:"startup",paused:true,observeEffect});
 assert.equal(observed.length,n+1);assert.equal(observed[n].surface,"bookmarks");assert.equal(observed[n].current(),true);
 h.release();assert.equal(observed[n].current(),false);
 const close=other.bookmarks({owner:"close",observeEffect});
 assert.equal(observed.length,n+1);close.release();
});

const bloomMode="data-zr-center-mode",bloomCard="data-zr-center-bloom-card";
function bloomRequest(f,finishLength=1920){
 const observed=[],t={scale:1,finishLength,lateLimit:finishLength+280,paused:true,closed:false,observeEffect:(effect,surface,current)=>observed.push({effect,surface,current})};
 f.window.__nocturneStartupTimeline=t;f.root.setAttribute("data-zr-startup-phase","waiting");
 return {t,observed,options:{owner:"startup",direction:"in",paused:true,duration:650,delay:245,bloomTimeline:t,observeEffect:t.observeEffect}};
}
test("isolated Bloom uses real slots and exact Assembly ownership, with no proxies or independent scheduler",()=>{
 const f=proxyFixture(),engine=f.mount(),r=bloomRequest(f),h=engine.start(f.row,r.options);
 assert.ok(h);assert.equal(h.mode,"magnetic-bloom");assert.equal(h.count,2);
 assert.equal(f.root.getAttribute(ownerMark),"startup");assert.equal(f.root.getAttribute(bloomMode),"bloom");
 assert.ok(f.cards.every(n=>n.hasAttribute(bloomCard)&&!n.hasAttribute(cardMark)));
 assert.equal(f.row.children.length,1);assert.equal(f.effects.length,2);
 assert.ok(f.effects.every(a=>f.cards.includes(a.node)&&a.currentTime===0&&a.timing.delay+a.timing.duration<=1000));
 assert.equal(f.frames.size,0);assert.equal(f.observers.length,0);
 assert.equal(r.observed.length,2);assert.ok(r.observed.every(x=>x.current()));
 assert.throws(()=>h.resume(),/requires-epoch/);
 const started=[];r.t.paused=false;h.resumeAt(a=>started.push(a));assert.deepEqual(started,f.effects);
 h.release();assertProxyClean(f);assert.equal(f.root.hasAttribute(bloomMode),false);assert.ok(f.cards.every(n=>!n.hasAttribute(bloomCard)));
 assert.ok(r.observed.every(x=>!x.current()));
});
test("Bloom computed conflict and partial effect failure retire real effects before Fold fallback",()=>{
 for(const fault of ["bloomScale","bloomAnimate"]){
  const f=proxyFixture(),engine=f.mount(),r=bloomRequest(f);f.fault[fault]=true;
  const h=engine.start(f.row,r.options);assert.ok(h,fault);assert.equal(h.mode,"magnetic-fold");
  assert.equal(f.root.hasAttribute(bloomMode),false);assert.ok(f.cards.every(n=>!n.hasAttribute(bloomCard)));
  const real=f.effects.filter(a=>f.cards.includes(a.node));assert.equal(real.length,fault==="bloomScale"?2:1);
  assert.ok(real.every(a=>a.cancelled===1));assert.ok(r.observed.filter(o=>real.includes(o.effect)).every(o=>!o.current()));
  h.release();assertProxyClean(f);
 }
});
test("Bloom rejects short shared timing budget and uses only the admitted Fold fallback",()=>{
 const f=proxyFixture(),engine=f.mount(),r=bloomRequest(f,1190),h=engine.start(f.row,r.options);
 assert.equal(h.mode,"magnetic-fold");assert.ok(f.effects.every(a=>!f.cards.includes(a.node)));
 h.release();assertProxyClean(f);
 const g=proxyFixture(),e=g.mount(),q=bloomRequest(g,500);assert.equal(e.start(g.row,q.options),null);assert.equal(g.effects.length,0);
});
test("Bloom rejects stale, non-startup, reduced-motion and unpaused requests",()=>{
 for(const fault of ["stale","close","reduced","unpaused","foreign-observer"]){
  const f=proxyFixture(),engine=f.mount(),r=bloomRequest(f);
  if(fault==="stale")f.window.__nocturneStartupTimeline={};
  if(fault==="close")r.options.owner="close";
  if(fault==="reduced")f.fault.reduced=true;
  if(fault==="unpaused")r.t.paused=false;
  if(fault==="foreign-observer")r.options.observeEffect=()=>{};
  assert.equal(engine.start(f.row,r.options),null,fault);assert.equal(f.effects.length,0);
 }
});
test("Bloom disposal and timeline replacement during acquisition do not start a fallback",()=>{
 for(const fault of ["dispose","replace"]){
  const f=proxyFixture(),engine=f.mount(),r=bloomRequest(f);
  f.fault.onAnimate=()=>{if(fault==="dispose")engine.dispose();else f.window.__nocturneStartupTimeline={};};
  assert.equal(engine.start(f.row,r.options),null);assertProxyClean(f);
  assert.equal(f.effects.length,1);assert.equal(f.root.hasAttribute(bloomMode),false);assert.ok(f.cards.every(n=>!n.hasAttribute(bloomCard)));
 }
});
test("Bloom exact resume rejects replacement Assembly and supersession restores real slots",()=>{
 const f=proxyFixture(),engine=f.mount(),r=bloomRequest(f),h=engine.start(f.row,r.options);
 f.window.__nocturneStartupTimeline={};assert.throws(()=>h.resumeAt(()=>{}),/center-epoch-stale/);
 const next=engine.start(f.row,{owner:"workspace"});assert.equal(next.mode,"magnetic-fold");
 assert.ok(f.cards.every(n=>!n.hasAttribute(bloomCard)));h.release();assert.equal(f.root.getAttribute(ownerMark),"workspace");
 next.release();assertProxyClean(f);
});
test("Bloom mode gates only exact card scale and leaves normal Fold startup as the default",()=>{
 const css=read("chrome.css");
 assert.ok(css.includes(':where(:not([data-zr-center-motion="startup"][data-zr-center-mode="bloom"])) #oneplane-tabs'));
 assert.ok(css.includes('.oneplane-tab:where(:not(:root[data-zr-center-motion="startup"][data-zr-center-mode="bloom"] [data-zr-center-bloom-card]))'));
 assert.ok(css.includes('[data-zr-center-motion="startup"][data-zr-center-mode="bloom"]'));
 assert.ok(read("startup-animation.uc.mjs").includes("const BLOOM_CANDIDATE=false;"));
 assert.ok(read("startup-animation.uc.mjs").includes("options.bloomTimeline=timeline;"));
});

test("Bloom rejects inconsistent completion cap and nonfinite plan without acquiring anything",()=>{
 for(const cap of [1470,NaN,Infinity]){
  const f=proxyFixture(),engine=f.mount(),r=bloomRequest(f);r.t.lateLimit=cap;
  assert.equal(engine.start(f.row,r.options),null);assert.equal(f.effects.length,0);
 }
});
test("Bloom requires actual paused document effects and unchanged finished promise during sampling",()=>{
 for(const fault of ["foreignTimeline","unpaused","seekPromise"]){
  const f=proxyFixture(),engine=f.mount(),r=bloomRequest(f);f.fault[fault]=true;
  const h=engine.start(f.row,r.options);assert.ok(h,fault);assert.equal(h.mode,"magnetic-fold");
  assert.ok(f.effects.filter(a=>f.cards.includes(a.node)).every(a=>a.cancelled===1));
  h.release();assertProxyClean(f);
 }
});
test("Bloom competing existing animation fails open instead of cloning moving geometry",()=>{
 const f=proxyFixture(),engine=f.mount(),r=bloomRequest(f);
 const external=f.cards[0].animate([{opacity:0},{opacity:1}],{duration:100});
 assert.equal(engine.start(f.row,r.options),null);assert.equal(f.effects.length,1);
 assert.equal(external.cancelled,0);assert.equal(f.root.hasAttribute(bloomMode),false);
 assert.ok(f.cards.every(n=>!n.hasAttribute(bloomCard)));
});
test("explicit Fold fallback rechecks Assembly after synchronous supersession and during setup",()=>{
 const f=proxyFixture(),engine=f.mount(),r=bloomRequest(f,1190);engine.start(f.row,{owner:"workspace"});
 f.fault.onEnd=()=>{f.window.__nocturneStartupTimeline={};};
 assert.equal(engine.start(f.row,r.options),null);assertProxyClean(f);
 const g=proxyFixture(),e=g.mount(),q=bloomRequest(g,1190);
 g.fault.onAnimate=()=>{g.window.__nocturneStartupTimeline={};};
 assert.equal(e.start(g.row,q.options),null);assertProxyClean(g);
});
test("explicit Bloom and fallback exact resume is once-only and rejects stale final start callback",()=>{
 for(const length of [1920,1190]){
  const f=proxyFixture(),engine=f.mount(),r=bloomRequest(f,length),h=engine.start(f.row,r.options);
  assert.throws(()=>h.resumeAt(()=>{}),/center-epoch-stale/);
  r.t.paused=false;h.resumeAt(()=>{});assert.throws(()=>h.resumeAt(()=>{}),/center-epoch-stale/);h.release();assertProxyClean(f);
  const g=proxyFixture(),e=g.mount(),q=bloomRequest(g,length),a=e.start(g.row,q.options);
  q.t.paused=false;let count=0;assert.throws(()=>a.resumeAt(()=>{if(++count===a.count)g.window.__nocturneStartupTimeline={};}),/center-epoch-stale/);
  a.release();assertProxyClean(g);
 }
});

test("Center topology capture rejection never allocates proxy effects",()=>{
 const f=proxyFixture();f.window.__oneplaneLayoutController={captureCenterTopology:()=>null};
 const engine=f.mount();assert.equal(engine.start(f.row,{owner:"startup"}),null);
 assert.equal(f.effects.length,0);assertProxyClean(f);
});
test("Center exact topology invalidation releases once and never interrupts explicit close",()=>{
 for(const owner of ["startup","workspace","close"]){
  const f=proxyFixture();let valid=true,invalidations=0;
  f.window.__oneplaneLayoutController={captureCenterTopology:r=>r===f.row?()=>valid:null};
  const engine=f.mount(),h=engine.start(f.row,{owner,onTopologyInvalidated:()=>{invalidations++;h.release();}});
  assert.ok(h);assert.equal(engine.invalidateTopology(f.row),false);
  valid=false;assert.equal(h.validateTopology(),false);
  assert.equal(engine.invalidateTopology(f.row),owner!=="close");
  assert.equal(invalidations,owner==="close"?0:1);
  assert.equal(engine.invalidateTopology(f.row),false);
  h.release();assertProxyClean(f);
 }
});
test("Center rejects native topology changes during acquisition and before paused epoch",()=>{
 const f=proxyFixture();let valid=true;
 f.window.__oneplaneLayoutController={captureCenterTopology:()=>()=>valid};
 const engine=f.mount();f.fault.onAnimate=()=>{valid=false;};
 assert.equal(engine.start(f.row,{owner:"startup",paused:true}),null);assertProxyClean(f);
 const g=proxyFixture();valid=true;g.window.__oneplaneLayoutController={captureCenterTopology:()=>()=>valid};
 const e=g.mount(),h=e.start(g.row,{owner:"startup",paused:true});valid=false;
 assert.throws(()=>h.resumeAt(()=>{}),/center-epoch-stale/);h.release();assertProxyClean(g);
});
function topologyFixture(){
 const code=read("src/toolbar/tab-sync.js.part").split("  function sync() {")[0];
 const run=new Function(`
 const tab=(group=null)=>({group,pinned:false,hidden:false,closing:false,hasAttribute:()=>false});
 const a=tab(),b=tab(),browser={visibleTabs:[a,b],selectedTab:a};
 const row={isConnected:true,hasAttribute:()=>false};
 const list={nodes:[],contains:n=>list.nodes.includes(n),querySelectorAll:()=>list.nodes};
 const node=()=>({parentElement:list,closest:()=>null});
 const na=node(),nb=node();list.nodes=[na,nb];
 const entries=new Map([[a,{item:na}],[b,{item:nb}]]),splitEntries=new Map();
 let dead=false,centering=false,frame=0,scheduled=0,synced=0;const window={};
 let committedStripPlacement={},placementValid=true;
 const stripPlacementCurrent=(p=committedStripPlacement)=>placementValid&&p===committedStripPlacement;
 const splitGroup=t=>t.group,isSplit=t=>!!t.group;
 function schedule(){scheduled++;}function sync(){synced++;}
 ${code}
 syncedTopology=readStripTopology();
 return {a,b,browser,row,list,na,nb,entries,splitEntries,capture:()=>captureCenterTopology(row),end:onCenterMotionEnd,counts:()=>[scheduled,synced],tab,invalidate:()=>{placementValid=false},replacePlacement:()=>{committedStripPlacement={}},frozenSync:()=>{syncing=true}};
 `);
 return run();
}
test("projection topology lease detects equal-count reorder, replacement, split, pin, selection and mirror reparent",()=>{
 for(const fault of ["order","replace","split","pin","selection","mirror","parent","disconnect","placement","new-placement"]){
  const f=topologyFixture(),valid=f.capture();assert.ok(valid);assert.ok(valid());
  if(fault==="order")f.browser.visibleTabs.reverse();
  if(fault==="replace")f.browser.visibleTabs[1]=f.tab();
  if(fault==="split")f.b.group={};
  if(fault==="pin")f.b.pinned=true;
  if(fault==="selection")f.browser.selectedTab=f.b;
  if(fault==="mirror")f.list.nodes.reverse();
  if(fault==="parent")f.nb.parentElement={};
  if(fault==="disconnect")f.row.isConnected=false;
  if(fault==="placement")f.invalidate();
  if(fault==="new-placement")f.replacePlacement();
  assert.equal(valid(),false,fault);
 }
});
test("projection rejects unsynced native signatures and reconciles changed topology synchronously on handoff",()=>{
 const invalid=topologyFixture();invalid.invalidate();assert.equal(invalid.capture(),null);
 const frozen=topologyFixture(),lease=frozen.capture();frozen.frozenSync();assert.equal(lease(),true);assert.equal(frozen.capture(),null);
 const f=topologyFixture();f.end();assert.deepEqual(f.counts(),[1,0]);
 f.browser.visibleTabs.reverse();assert.equal(f.capture(),null);
 f.end();assert.deepEqual(f.counts(),[1,1]);
 const g=topologyFixture();g.end({detail:{owner:"startup",reconcile:true}});assert.deepEqual(g.counts(),[0,1]);
 g.end({detail:{owner:"close",reconcile:true}});assert.deepEqual(g.counts(),[1,1]);
});

function geometryFixture(mode="fold"){
 const code=read("src/layout/geometry.js.part").split("  function captureCenterGeometry")[1].split("  function checkCenterGeometry")[0];
 const run=new Function(`
 const window={innerWidth:1200,innerHeight:800,devicePixelRatio:1};
 let dead=false;
 const node=(x=0,w=100)=>({isConnected:true,parentElement:null,offsetParent:null,offsetLeft:x,offsetTop:0,
   offsetWidth:w,offsetHeight:30,clientWidth:w,clientHeight:30,scrollLeft:0,scrollTop:0,scrollWidth:w,scrollHeight:30,
   dx:0,scale:1,getBoundingClientRect(){return {left:this.offsetLeft+this.dx,top:this.offsetTop,width:this.offsetWidth*this.scale,height:30};}});
 const row=node(0,500),list=node(),leftLane=node(),rightLane=node(),bottomLane=node(),island=node(),plus=node(),a=node(10,30),b=node(50,30);
 const flags=new Set();row.hasAttribute=k=>flags.has(k);island.hasAttribute=k=>k==="data-zr-startup-island-entry"&&!!island.entry;
 window.getComputedStyle=n=>({getPropertyValue:k=>k==="--zr-island-travel"?String(n.progress):k==="--zr-island-scale"?String(Math.max(.02,n.progress*n.progress)):k==="--zr-startup-island-y"?String(n.entryY)+"px":""});
 for(const n of [list,leftLane,rightLane,bottomLane,island,plus,a,b]){n.parentElement=row;n.offsetParent=row;}
 bottomLane.isConnected=false;list.querySelectorAll=()=>[a,b];
 function captureCenterGeometry${code}
 return {row,list,leftLane,rightLane,bottomLane,island,plus,a,b,window,flags,capture:mode=>captureCenterGeometry(row,mode)};
 `);
 const f=run();return {...f,valid:f.capture(mode)};
}
test("resting geometry detects viewport, DPI, lane scroll, slot sizes, fractional positions and reparenting",()=>{
 for(const fault of ["viewport","dpi","scroll","overflow","slot","fraction","parent","row"]){
  const f=geometryFixture();assert.ok(f.valid);assert.ok(f.valid());
  if(fault==="viewport")f.window.innerWidth--;
  if(fault==="dpi")f.window.devicePixelRatio=1.25;
  if(fault==="scroll")f.leftLane.scrollLeft=2;
  if(fault==="overflow")f.bottomLane.isConnected=true;
  if(fault==="slot")f.a.offsetWidth++;
  if(fault==="fraction")f.b.dx=.75;
  if(fault==="parent")f.b.offsetParent=f.list;
  if(fault==="row")f.row.offsetWidth--;
  assert.equal(f.valid(),false,fault);
 }
});
test("geometry lease excludes intentional Bloom scale and Fold plus translate, but not changed slots",()=>{
 const b=geometryFixture("bloom");b.a.scale=.72;b.island.scale=.45;
 assert.ok(b.valid());b.a.offsetLeft++;assert.equal(b.valid(),false);
 const f=geometryFixture();f.plus.dx=-26;assert.ok(f.valid());
 f.a.dx=.2;assert.ok(f.valid());f.a.dx=1;assert.equal(f.valid(),false);
});
test("geometry invalidation retires Startup and Workspace once and leaves explicit close native",()=>{
 for(const owner of ["startup","workspace","close"]){
  const f=proxyFixture();let valid=true,invalidations=0,checks=0;
  f.window.__oneplaneLayoutController={captureCenterTopology:()=>()=>true,captureCenterGeometry:()=>()=>{checks++;return valid;}};
  const engine=f.mount(),h=engine.start(f.row,{owner,onTopologyInvalidated:()=>{invalidations++;h.release();}});
  assert.ok(h);const before=checks;assert.equal(engine.invalidateTopology(f.row),false);assert.equal(checks,before);
  valid=false;assert.equal(engine.invalidateGeometry(f.row,"scroll"),owner!=="close");
  assert.equal(invalidations,owner==="close"?0:1);assert.equal(engine.invalidateGeometry(f.row,"window"),false);
  h.release();assertProxyClean(f);
 }
});
test("geometry rejection at capture, during setup and before paused epoch fails open",()=>{
 const f=proxyFixture();f.window.__oneplaneLayoutController={captureCenterGeometry:()=>null};
 assert.equal(f.mount().start(f.row,{owner:"startup"}),null);assert.equal(f.effects.length,0);assertProxyClean(f);
 const g=proxyFixture();let valid=true;g.window.__oneplaneLayoutController={captureCenterGeometry:()=>()=>valid};
 g.fault.onAnimate=()=>{valid=false;};assert.equal(g.mount().start(g.row,{owner:"startup"}),null);assertProxyClean(g);
 const k=proxyFixture();valid=true;k.window.__oneplaneLayoutController={captureCenterGeometry:()=>()=>valid};
 const h=k.mount().start(k.row,{owner:"startup",paused:true});assert.ok(h);valid=false;
 assert.throws(()=>h.resumeAt(()=>{}),/center-epoch-stale/);h.release();assertProxyClean(k);
});
test("existing Layout geometry events use the exact lease and remove the same listener",()=>{
 const g=read("src/layout/geometry.js.part"),l=read("src/core/window-lifecycle.js.part");
 assert.ok(g.includes('invalidateGeometry?.(row,stage)'));assert.ok(g.includes('checkCenterGeometry("scroll")'));
 assert.ok(l.includes('checkCenterGeometry("resize-observer")'));
 assert.ok(l.includes('lane.addEventListener("scroll",onLaneScroll'));assert.ok(l.includes('lane.removeEventListener("scroll",onLaneScroll'));
 assert.ok(read("src/layout/visibility.js.part").includes('checkCenterGeometry("window")'));
});

test("Fold mounts proxies against the real host origin, including fractional translation",()=>{
 const f=proxyFixture();f.fault.hostX=3.25;f.fault.hostY=2.5;f.fault.rowTransform="matrix(1, 0, 0, 1, 3, 4)";
 const h=f.mount().start(f.row,{owner:"startup",paused:true});assert.ok(h);
 assert.equal(f.effects[0].node.style.left,"16.75px");assert.equal(f.effects[0].node.style.top,"-2.5px");
 h.release();assertProxyClean(f);
});
test("Fold refuses transformed frames and actual mounted coordinate mismatch without leaking",()=>{
 for(const fault of ["scale","rotate","perspective","mount"]){
  const f=proxyFixture();
  if(fault==="scale")f.fault.rowTransform="matrix(2, 0, 0, 2, 0, 0)";
  if(fault==="rotate")f.fault.rowTransform="matrix(0, 1, -1, 0, 0)";
  if(fault==="perspective")f.fault.rowTransform="matrix3d(1,0,0,.1,0,1,0,0,0,0,1,0,0,0,0,1)";
  if(fault==="mount")f.fault.proxyX=.75;
  assert.equal(f.mount().start(f.row,{owner:"workspace"}),null,fault);
  assert.equal(f.effects.length,0);assertProxyClean(f);
 }
});
test("Fold does not turn partially scrolled cards into full unscrolled clones",()=>{
 const f=proxyFixture();Object.assign(f.list,{clientLeft:25,clientTop:0,clientWidth:100,clientHeight:40});
 assert.equal(f.mount().start(f.row,{owner:"close",direction:"out"}),null);assert.equal(f.effects.length,0);assertProxyClean(f);
 const g=proxyFixture();Object.assign(g.list,{clientLeft:0,clientTop:0,clientWidth:55,clientHeight:40});
 const h=g.mount().start(g.row,{owner:"startup"});assert.ok(h);assert.equal(h.count,1);h.release();assertProxyClean(g);
});
test("Fold checks terminal incoming pose and invalidates a changed coordinate frame at boundary",()=>{
 const f=proxyFixture(),h=f.mount().start(f.row,{owner:"startup"});assert.ok(h);
 h.seal();assert.ok(h.validateTopology());f.fault.proxyX=1;assert.equal(h.validateTopology(),false);h.release();assertProxyClean(f);
 const g=proxyFixture(),b=g.mount().start(g.row,{owner:"workspace"});assert.ok(b);g.fault.rowTransform="matrix(2,0,0,2,0,0)";
 assert.equal(b.validateTopology(),false);b.release();assertProxyClean(g);
});

test("Center invalidation notifies once under diagnostic and owner callback reentry",()=>{
 const f=proxyFixture();let valid=true,calls=0,nested=[],successor="unset";
 f.window.__oneplaneLayoutController={captureCenterTopology:()=>()=>valid};
 const engine=f.mount();
 f.window.__nocturneTrace=(event)=>{if(event==="center.topology.invalidate"){
  nested.push(engine.invalidateTopology(f.row));successor=engine.start(f.row,{owner:"workspace"});
 }};
 const h=engine.start(f.row,{owner:"startup",onTopologyInvalidated:()=>{calls++;nested.push(engine.invalidateTopology(f.row));}});
 assert.ok(h);valid=false;assert.equal(engine.invalidateTopology(f.row),true);
 assert.equal(calls,1);assert.deepEqual(nested,[false,false]);assert.equal(successor,null);assertProxyClean(f);
});
test("Center release locks engine before geometry diagnostics and defers disposal",()=>{
 const f=proxyFixture();let valid=true,nested="unset";
 f.window.__oneplaneLayoutController={captureCenterGeometry:()=>()=>valid};
 const engine=f.mount(),h=engine.start(f.row,{owner:"startup"});assert.ok(h);
 f.window.__nocturneTrace=event=>{if(event==="center.geometry.invalidate"){nested=engine.start(f.row,{owner:"workspace"});engine.dispose();}};
 valid=false;h.release();assert.equal(nested,null);assert.equal(f.window.__nocturneCenterMotion,undefined);assertProxyClean(f);
});
test("finished Fold handoff samples actual resting layout after phase cleanup in existing frames",()=>{
 for(const changed of [false,true]){
  const f=proxyFixture(),logs=[];f.window.__nocturneTrace=(event,data)=>{if(event==="center.fold.handoff")logs.push(data());};
  const h=f.mount().start(f.row,{owner:"startup"});assert.ok(h);h.seal();h.release();
  assert.equal(logs.length,0);assert.equal(f.frames.size,1);
  if(changed)f.fault.cardShift=2;
  for(let i=0;i<2;i++){const [key,fn]=[...f.frames][0];f.frames.delete(key);fn();}
  assert.equal(logs.length,1);assert.equal(logs[0].status,changed?"geometry-changed":"local-stable");
  assert.equal(logs[0].maxError,changed?2:0);assert.equal(f.frames.size,0);assertProxyClean(f);
 }
});
test("post-release diagnostic never samples a superseded or still phased handoff",()=>{
 const f=proxyFixture(),logs=[];f.window.__nocturneTrace=(event,data)=>{if(event==="center.fold.handoff")logs.push(data());};
 const engine=f.mount(),h=engine.start(f.row,{owner:"startup"});h.seal();h.release();
 const stale=[...f.frames.values()][0];const next=engine.start(f.row,{owner:"workspace"});next.seal();next.release();
 stale();assert.equal(logs.length,0);f.root.setAttribute("data-zr-workspace-phase","in");
 for(let i=0;i<2;i++){const [key,fn]=[...f.frames][0];f.frames.delete(key);fn();}
 assert.equal(logs.length,1);assert.equal(logs[0].status,"not-comparable");assertProxyClean(f);
});
test("resting lease detects layout mode flags and existing slot observer validates geometry",()=>{
 const f=geometryFixture();assert.ok(f.valid());f.flags.add("data-op-overflow-row");assert.equal(f.valid(),false);
 assert.ok(read("src/toolbar/tab-state.js.part").includes('checkCenterGeometry("slots")'));
 assert.ok(read("src/layout/visibility.js.part").includes('checkCenterGeometry("mode")'));
});
test("diagnostic reentry during second handoff frame cannot remove successor marks",()=>{
 const f=proxyFixture(),engine=f.mount();let b;
 f.window.__nocturneTrace=(event,data)=>{if(event==="center.fold.handoff"){data();b=engine.start(f.row,{owner:"workspace"});}};
 const a=engine.start(f.row,{owner:"startup"});a.seal();a.release();
 for(let i=0;i<2;i++){const [key,fn]=[...f.frames][0];f.frames.delete(key);fn();}
 assert.ok(b);assert.equal(f.root.getAttribute(ownerMark),"workspace");assert.equal(f.row.children.length,2);b.release();assertProxyClean(f);
});


test("Fold geometry lease accepts only the exact owned Island entrance and preserves all other slots",()=>{
 const f=geometryFixture(),n=f.island;
 n.entry=true;n.entryY=-42;n.progress=0;
 n.getBoundingClientRect=function(){const s=Math.max(.02,this.progress*this.progress);return {left:this.offsetLeft+this.offsetWidth*(1-s)/2+this.dx,top:this.offsetTop+this.offsetHeight*(1-s)/2+this.entryY*(1-this.progress),width:this.offsetWidth*s,height:this.offsetHeight*s};};
 for(const p of [0,.15625,.5,.84375,1]){n.progress=p;assert.ok(f.valid(),String(p));}
 n.progress=.5;n.dx=1;assert.equal(f.valid(),false);n.dx=0;assert.ok(f.valid());
 f.a.dx=1;assert.equal(f.valid(),false);f.a.dx=0;
 n.entry=false;assert.equal(f.valid(),false);n.progress=1;assert.ok(f.valid());
});

test("flow bookmark ownership releases every native child and the list on failure",()=>{
 const f=bookmarkFixture(),children=[];
 for(const [left,width] of [[20,50],[75,40],[120,55]]){
  const attrs=new Map(),node={hidden:false,collapsed:false,getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),
   getBoundingClientRect(){const k=this.frame(),x=parseFloat(k?.translate??k?.["--zr-flow-bookmark-x"]??"0"),s=Number(k?.scale??k?.["--zr-flow-bookmark-scale"]??1);
    return {left:left+x+width*(1-s)/2,right:left+x+width*(1+s)/2,top:30-10*s,bottom:30+10*s,width:width*s,height:20*s};},
   frame(){if(!this.effect||this.effect.cancelled)return null;const {duration,delay}=this.effect.timing;const k=Math.round(Math.max(0,Math.min(1,((this.effect.currentTime||0)-delay)/duration))*80);return this.effect.keys[k];},
   animate(keys,timing){const a=f.node.animate();a.keys=keys;a.timing=timing;this.effect=a;return a;}};
  children.push(node);
 }
 f.node.children=children;f.node.getBoundingClientRect=()=>({left:0,right:200,width:200});
 f.window.getComputedStyle=n=>{const k=n.frame?.();return {display:"flex",visibility:"visible",opacity:k?.opacity??k?.["--zr-flow-bookmark-alpha"]??"1",
  clipPath:k?.clipPath??(k?`inset(-8px ${k["--zr-flow-bookmark-right"]} -8px ${k["--zr-flow-bookmark-left"]})`:"none")};};
 const engine=f.mount(),handle=engine.bookmarks({owner:"startup",flow:true,paused:true});
 assert.ok(handle);assert.equal(f.effects.length,3);assert.equal(handle.validatePrepared(),true);
 assert.ok(children.every(n=>n.getAttribute("data-zr-flow-bookmark")==="direct"));
 assert.ok(f.effects.every(a=>a.keys.every(k=>"translate" in k&&"scale" in k&&"opacity" in k&&"clipPath" in k)));
 f.document.timeline={currentTime:400};for(const a of f.effects){a.startTime=140;a.currentTime=260;}
 const playback=engine.bookmarkPlaybackSample();assert.equal(playback.fraction,.5);assert.equal(playback.bad,0);assert.equal(playback.clockError,0);
 for(const a of f.effects)a.currentTime=0;
 const before=f.window.getComputedStyle;f.window.getComputedStyle=n=>({...before(n),clipPath:"none"});
 assert.equal(handle.validatePrepared(),false);f.window.getComputedStyle=before;
 f.node.children=[...children].reverse();assert.equal(handle.validatePrepared(),false);f.node.children=children;
 handle.release();assert.ok(f.effects.every(a=>a.cancelled===1));
 assert.ok(children.every(n=>n.getAttribute("data-zr-flow-bookmark")===null));
 assert.equal(f.node.getAttribute(foldMark),null);
 const closing=engine.bookmarks({owner:"close",direction:"out",flow:true,paused:true});
 assert.ok(closing);assert.ok(children.every(n=>n.getAttribute("data-zr-flow-bookmark")==="true"));
 assert.ok(f.effects.slice(-3).every(a=>a.keys.every(k=>"--zr-flow-bookmark-scale" in k)));
 closing.release();
 children[1].animate=()=>{throw Error("bookmark effect");};
 assert.equal(engine.bookmarks({owner:"startup",flow:true}),null);
 assert.equal(f.effects.at(-1).cancelled,1);
 assert.ok(children.every(n=>n.getAttribute("data-zr-flow-bookmark")===null));
 assert.equal(f.node.getAttribute(foldMark),null);
});
