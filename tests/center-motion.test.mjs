import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const source=read("src/core/center-motion.js.part");
const foldSource=read("src/algorithms/magnetic-fold.mjs").replace(/^export function /gm,"function ");
const {magnetState,keyframes,portalGap,portalClip}=new Function(foldSource+"return createMagneticFoldMath();")();
const runtimeSource=foldSource+source;
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
 assert.ok(source.includes('holdHandoff()'));
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
 new Function("window","document","Services",prelude)(window,{documentElement:{hasAttribute:()=>false}},{prefs:{}});
 assert.equal(cleaned,1);
});

function bookmarkFixture({width=200}={}){
 const attrs=new Map(),props=new Map(),priorities=new Map(),effects=[];
 const attributes=m=>({hasAttribute:k=>m.has(k),getAttribute:k=>m.get(k)??null,setAttribute:(k,v)=>m.set(k,v),removeAttribute:k=>m.delete(k)});
 const root=attributes(new Map()),node={...attributes(attrs),getBoundingClientRect:()=>({width}),
   style:{getPropertyValue:k=>props.get(k)??"",getPropertyPriority:k=>priorities.get(k)??"",setProperty(k,v,p=""){props.set(k,v);priorities.set(k,p);},removeProperty(k){props.delete(k);priorities.delete(k);}},
   animate(){const a={finished:Promise.resolve(),cancelled:0,played:0,sealed:0,cancel(){this.cancelled++;},play(){this.played++;},finish(){this.sealed++;},pause(){}};effects.push(a);return a;}};
 const document={documentElement:root,getElementById:()=>node};
 const window={__nocturneLayoutStartup:{},CSS:{registerProperty(){}},addUnloadListener(){},addEventListener(){},removeEventListener(){}};
 const mount=()=>{new Function("window","document","Services",runtimeSource)(window,document,{});return window.__nocturneCenterMotion;};
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
   get attributes(){return [...attrs.keys()].map(name=>({name}));},
   classList:{contains:k=>kind==="card"&&k==="oneplane-tab"},matches:k=>kind==="img"&&k===".oneplane-tab-icon img",
   closest:()=>null,hasAttribute:k=>attrs.has(k),getAttribute:k=>attrs.get(k)??null,
   setAttribute(k,v){attrs.set(k,v);if(fault.mark&&kind==="card"&&k==="data-zr-center-card")throw Error("mark");},removeAttribute:k=>attrs.delete(k),
   getBoundingClientRect:()=>r,querySelector(k){return kind==="row"&&k===".oneplane-tab-list"?list:null;},
   querySelectorAll(k){if(kind==="list"&&k===".oneplane-tab,.oneplane-split-group")return this.children;
    if(k==="*")return this.children.flatMap(c=>[c,...c.querySelectorAll("*")]);return [];},
   append(...cs){for(const c of cs){this.children.push(c);c.parentNode=this;}if(kind==="row"&&fault.append)throw Error("append");},
   remove(){if(this.parentNode){const p=this.parentNode;p.children=p.children.filter(x=>x!==this);this.parentNode=null;}},
   attachShadow(){if(fault.shadow)throw Error("shadow");return node("shadow");},
   cloneNode(){const c=node(kind,r);for(const child of this.children)c.append(child.cloneNode());return c;},
   addEventListener(k,fn){listeners.set(k,fn);if(fault.listener&&kind==="img"&&k==="error")throw Error("listener");},
   removeEventListener(k,fn){if(listeners.get(k)===fn)listeners.delete(k);},listeners,
   animate(){if(fault.animate===effects.length+1)throw Error("animate");
    const a={finished:Promise.resolve(),cancelled:0,sealed:0,played:0,cancel(){this.cancelled++;},finish(){this.sealed++;},play(){this.played++;},pause(){if(fault.pause)throw Error("pause");}};
    effects.push(a);fault.onAnimate?.();return a;}
  };nodes.push(n);return n;
 }
 const root=node("root"),row=node("row"),list=node("list"),cards=[node("card",{left:20,top:0,right:50,bottom:30,width:30,height:30}),node("card",{left:60,top:0,right:90,bottom:30,width:30,height:30})];
 row.append(list);list.append(...cards);
 const document={documentElement:root,getElementById:()=>null,createElementNS:(ns,tag)=>node(tag)};
 const window={__nocturneLayoutStartup:{},CSS:{registerProperty(){}},addUnloadListener(){},addEventListener(){},removeEventListener(){},
  getComputedStyle:()=>({opacity:"1",visibility:"visible",display:"block",getPropertyValue:()=>""}),
  requestAnimationFrame(fn){const id=++nextFrame;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);},
  CustomEvent:class{constructor(type){this.type=type;}},dispatchEvent(event){events.push(event.type);fault.onEnd?.();},
  MutationObserver:class{constructor(fn){this.fn=fn;this.active=false;observers.push(this);}observe(){this.active=true;if(fault.observe)throw Error("observe");}disconnect(){this.active=false;}}
 };
 const mount=()=>{new Function("window","document","Services",runtimeSource)(window,document,{});return window.__nocturneCenterMotion;};
 const addIcon=()=>{const wrap=node("icon"),img=node("img");wrap.append(img);cards[0].append(wrap);return img;};
 return {root,row,cards,nodes,effects,observers,events,frames,fault,window,mount,addIcon};
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
