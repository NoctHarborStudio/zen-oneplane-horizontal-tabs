import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../page-progress.uc.mjs",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/styles/refined-features.css.part",import.meta.url),"utf8");
function harness(){
 let time=0,seq=0,enabled=true,listener=null,select=null,prefObserver=null;
 const frames=new Map(),timers=new Map(),F={STATE_IS_NETWORK:1,STATE_START:2,STATE_STOP:4};
 const node=()=>{
  const attrs=new Map(),style=new Map();
  return {attrs,children:[],parentNode:null,style:{setProperty:(k,v)=>style.set(k,v),removeProperty:k=>style.delete(k)},values:style,
   setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),hasAttribute:k=>attrs.has(k),
   getAttribute:k=>attrs.get(k),toggleAttribute(k,v){v?attrs.set(k,""):attrs.delete(k)},
   append(n){n.remove();this.children.push(n);n.parentNode=this},insertBefore(n,b){n.remove();this.children.splice(this.children.indexOf(b),0,n);n.parentNode=this},
   get firstChild(){return this.children[0]},remove(){if(this.parentNode){const a=this.parentNode.children;a.splice(a.indexOf(this),1);this.parentNode=null}}};
 };
 const root=node(),panels={a:node(),b:node()},a={},b={};
 const dock=node(),surface=node(),row=node();
 let wrapperRect={left:0,width:1200,bottom:64},surfaceRect={bottom:96},surfaceOpacity="1";
 dock.getBoundingClientRect=()=>wrapperRect;surface.getBoundingClientRect=()=>surfaceRect;
 row.setAttribute("data-ready","true");
 const tabs=[{linkedPanel:"a",hasAttribute:()=>false},{linkedPanel:"b",hasAttribute:()=>false}];
 const browser={selectedBrowser:a,selectedTab:tabs[0],addTabsProgressListener:l=>listener=l,removeTabsProgressListener:()=>listener=null,
 tabContainer:{addEventListener:(e,l)=>select=l,removeEventListener:()=>select=null}};
 const window={innerWidth:1200,innerHeight:800,getComputedStyle:()=>({display:"block",visibility:"visible",opacity:surfaceOpacity}),requestAnimationFrame(fn){frames.set(++seq,fn);return seq},cancelAnimationFrame(id){frames.delete(id)},gBrowser:browser,gBrowserInit:{delayedStartupFinished:true},performance:{now:()=>time},addUnloadListener(){},addEventListener(){},removeEventListener(){},
 setTimeout(fn,delay){timers.set(++seq,{fn,at:time+delay});return seq},clearTimeout(id){timers.delete(id)}};
 const Services={prefs:{getBoolPref:()=>enabled,addObserver:(p,fn)=>prefObserver=fn,removeObserver(){}},obs:{}};
 const document={documentElement:root,createElementNS:()=>node(),getElementById:id=>panels[id]||({"zen-appcontent-navbar-wrapper":dock,"oneplane-toolbar-surface":surface,"oneplane-tabs":row})[id]};
 new Function("window","document","Services","Ci",source)(window,document,Services,{nsIWebProgressListener:F});
 const advance=ms=>{const end=time+ms;while(true){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;time=next[1].at;timers.delete(next[0]);next[1].fn()}time=end};
 const evt=(flags,status=0,which=browser.selectedBrowser,request=null)=>listener.onStateChange(which,{isTopLevel:true},request,1|flags,status);
 return {root,panels,browser,a,b,advance,evt,frames,frame(){const jobs=[...frames.values()];frames.clear();for(const fn of jobs)fn(time)},setDock(bottom,tail,alpha){wrapperRect={left:0,width:1200,bottom};surfaceRect={bottom:tail};surfaceOpacity=String(alpha)},progress:(n,d,request=null)=>listener.onProgressChange(browser.selectedBrowser,{isTopLevel:true},request,0,0,n,d),
 switchTo(i){browser.selectedBrowser=i?b:a;browser.selectedTab=tabs[i];select()},
 disable(){enabled=false;prefObserver()},enable(){enabled=true;prefObserver()},
 dispose:()=>window.__zenRefinedPageProgress(),get bar(){return root.children.find(n=>n.id==="zr-page-progress")||panels[browser.selectedTab.linkedPanel].children[0]},get timers(){return timers.size}};
}
test("single page loader unfolds, fills from the center, completes and collapses",()=>{
 const h=harness(),phase=()=>h.bar.getAttribute("data-phase"),fill=()=>h.bar.children[0].children[0].values.get("--zr-page-progress");
 assert.equal(h.root.getAttribute("data-zr-page-progress-owner"),"center");
 h.evt(2);h.advance(89);assert.equal(phase(),undefined);
 h.advance(1);assert.equal(phase(),"opening");assert.equal(fill(),"0");
 h.progress(40,100);h.advance(260);assert.equal(phase(),"loading");assert.equal(fill(),"0.4");
 h.progress(20,100);h.advance(120);assert.equal(fill(),"0.4");
 h.evt(4);assert.equal(phase(),"complete");assert.equal(fill(),"1");
 h.advance(280);assert.equal(phase(),"closing");assert.equal(fill(),"1");
 h.advance(340);assert.equal(phase(),undefined);assert.equal(fill(),"0");
 h.dispose();assert.equal(h.root.hasAttribute("data-zr-page-progress-owner"),false);
});
test("quick loads do not flash; visible quick completion waits for unfold",()=>{
 const h=harness();h.evt(2);h.advance(50);h.evt(4);h.advance(1000);
 assert.equal(h.bar.hasAttribute("data-visible"),false);
 h.evt(2);h.advance(100);h.evt(4);assert.equal(h.bar.getAttribute("data-phase"),"opening");
 h.advance(250);assert.equal(h.bar.getAttribute("data-phase"),"complete");
 h.advance(620);assert.equal(h.bar.hasAttribute("data-visible"),false);
});
test("cancel, tab switch, restart and preference release never claim success",()=>{
 const h=harness();h.evt(2);h.advance(350);assert.equal(h.bar.hasAttribute("data-indeterminate"),true);
 h.evt(4,0x80004004);assert.equal(h.bar.getAttribute("data-phase"),"closing");assert.notEqual(h.bar.children[0].children[0].values.get("--zr-page-progress"),"1");
 h.evt(2);h.advance(90);assert.equal(h.bar.getAttribute("data-phase"),"opening");
 h.switchTo(1);assert.equal(h.panels.a.children.length,0);assert.equal(h.bar.hasAttribute("data-visible"),false);
 h.switchTo(0);h.advance(90);assert.equal(h.bar.getAttribute("data-phase"),"opening");
 h.disable();assert.equal(h.root.hasAttribute("data-zr-page-progress-owner"),false);assert.equal(h.panels.a.children.length,0);assert.equal(h.timers,0);
 h.enable();assert.equal(h.root.getAttribute("data-zr-page-progress-owner"),"center");
});
test("native location and symmetrical CSS are scoped to the active owner",()=>{
 assert.ok(css.includes(':root[data-zr-page-progress-owner="center"] #zen-loading-progress-bar'));
 assert.ok(css.includes('var(--zen-loading-progress-bar-width,5rem) + 1rem'));
 assert.ok(css.includes('transform-origin:center center'));
 assert.ok(css.includes('[data-phase="closing"] .zr-page-progress-track'));
 assert.ok(css.includes('transform:scaleX(var(--zr-page-progress,0))'));
 assert.ok(css.includes('prefers-reduced-motion:reduce'));
 assert.ok(source.includes('browser?.selectedTab?.linkedPanel'));
});

test("horizontal indicator follows real dock height and fading contour without being clipped",()=>{
 const h=harness();h.root.setAttribute("oneplane-active","true");h.evt(2);h.advance(90);
 assert.equal(h.bar.parentNode,h.root);
 assert.equal(h.bar.hasAttribute("data-dock-anchor"),true);
 assert.equal(h.bar.values.get("--zr-progress-x"),"600px");
 assert.equal(h.bar.values.get("--zr-progress-y"),"104px");
 h.setDock(90,130,1);h.frame();assert.equal(h.bar.values.get("--zr-progress-y"),"138px");
 h.setDock(35,100,.5);h.frame();assert.equal(h.bar.values.get("--zr-progress-y"),"75.5px");
 h.setDock(2,80,0);h.frame();assert.equal(h.bar.values.get("--zr-progress-y"),"10px");
 h.evt(4);h.advance(260+280+340);assert.equal(h.frames.size,0);
 h.evt(2);h.advance(90);h.root.removeAttribute("oneplane-active");h.frame();
 assert.equal(h.bar.parentNode,h.panels.a);assert.equal(h.bar.hasAttribute("data-dock-anchor"),false);
 assert.equal(h.bar.values.has("--zr-progress-y"),false);
 h.disable();assert.equal(h.frames.size,0);
});
test("dock anchor uses a fixed chrome layer and preserves positive gap",()=>{
 assert.ok(css.includes('top:var(--zr-progress-y,8px)!important'));
 assert.ok(css.includes('z-index:2147482999!important'));
 assert.ok(source.includes('DOCK_GAP=8'));
 const fn=new Function(source.slice(source.indexOf("  function dockAnchor("),source.indexOf("  function activeDock("))+"const DOCK_GAP=8;return dockAnchor")();
 assert.deepEqual(fn({left:20,width:800,bottom:50},{bottom:90},1,1000,700),{x:420,y:98});
 assert.deepEqual(fn({left:20,width:800,bottom:0},{bottom:90},0,1000,700),{x:420,y:8});
});

test("replacement navigation survives the interrupted navigation's closing interval",()=>{
 const h=harness(),phase=()=>h.bar.getAttribute("data-phase");
 h.evt(2);h.advance(480);
 assert.equal(phase(),"loading");
 // Target Zen delivered NS_BINDING_ABORTED before the replacement START.
 h.evt(4,0x804b0002);assert.equal(phase(),"closing");
 h.evt(2);h.advance(480);
 assert.equal(phase(),"loading");
 h.evt(4);assert.equal(phase(),"complete");
 h.advance(620);assert.equal(h.bar.hasAttribute("data-visible"),false);
 h.dispose();
});

test("late STOP of an older network request cannot end a newer navigation",()=>{
 const h=harness(),oldRequest={},newRequest={};
 const phase=()=>h.bar.getAttribute("data-phase");
 const fill=()=>h.bar.children[0].children[0].values.get("--zr-page-progress");
 h.evt(2,0,h.a,oldRequest);h.advance(480);
 h.progress(60,100,oldRequest);h.advance(120);
 assert.equal(fill(),"0.6");
 h.evt(2,0,h.a,newRequest);
 assert.equal(phase(),"loading");
 h.evt(4,0x804b0002,h.a,oldRequest);
 assert.equal(phase(),"loading");
 h.progress(90,100,oldRequest);h.advance(120);
 assert.equal(fill(),"0.6");
 h.progress(70,100,newRequest);h.advance(120);
 assert.equal(fill(),"0.7");
 h.evt(4,0,h.a,newRequest);
 assert.equal(phase(),"complete");
 h.advance(620);assert.equal(h.bar.hasAttribute("data-visible"),false);
 h.dispose();
});
