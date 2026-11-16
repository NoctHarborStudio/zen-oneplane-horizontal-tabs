import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const core=readFileSync(new URL("../src/home/shared-home.js.part",import.meta.url),"utf8");
const layout=readFileSync(new URL("../layout.uc.mjs",import.meta.url),"utf8");
const extract=(start,end)=>core.slice(core.indexOf(start),core.indexOf(end));
const safeURL=new Function("win",extract("  function safeURL(","  function normalize(")+"return safeURL")({URL});
const normalize=new Function("win","safeURL",extract("  function normalize(","  const style=")+"return normalize")({URL},safeURL);
test("Home validates shortcut URLs",()=>{
 assert.equal(safeURL("github.com"),"https://github.com/");
 for(const invalid of ["","javascript:alert(1)","file:///tmp/a","about:config","https://user:pass@example.com"])assert.equal(safeURL(invalid),null);
});
test("Home normalizes valid unique shortcut IDs",()=>{
 assert.deepEqual(normalize({version:1,items:[{id:"a",type:"shortcut",title:"A",url:"a.com"},{id:"a",type:"shortcut",url:"b.com"},{id:"b",type:"widget",url:"b.com"}]}),[{id:"a",type:"shortcut",title:"A",url:"https://a.com/"}]);
});
test("Home embeds one portable core and releases its host lease",()=>{
 assert.equal(layout.split("function acquireZenHome(").length,2);
 assert.ok(layout.includes("homeLease?.release()"));
 assert.ok(layout.includes("if(!leases.size)destroy()"));
 assert.ok(layout.includes("oneplane-home-hold"));
});

test("Home leases share one instance and only the last release tears down",()=>{
 class Node {
  constructor(){this.children=[];this.attrs=new Map();this.isConnected=true;this.listeners=new Map();}
  append(...nodes){this.children.push(...nodes);for(const n of nodes)n.parent=this}
  contains(n){return this===n||this.children.some(x=>x.contains(n))}
  setAttribute(k,v){this.attrs.set(k,v)} hasAttribute(k){return this.attrs.has(k)} getAttribute(k){return this.attrs.get(k)} removeAttribute(k){this.attrs.delete(k)}
  addEventListener(k,f){this.listeners.set(k,f)} removeEventListener(k,f){if(this.listeners.get(k)===f)this.listeners.delete(k)}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.isConnected=false}
 }
 const root=new Node(),host=new Node(),panels=new Node(),tabs=new Node();root.append(host);host.append(panels);
 const doc={documentElement:root,getElementById:id=>id==="zen-tabbox-wrapper"?host:id==="tabbrowser-tabpanels"?panels:null,createElementNS:()=>new Node()};
 const win=new Node();win.document=doc;win.gBrowser={tabContainer:tabs};win.MutationObserver=class{observe(){} disconnect(){}};win.console={warn(){}};
 const observers=new Set(),services={prefs:{addObserver(k,o){observers.add(o)},removeObserver(k,o){observers.delete(o)}}};
 const acquire=new Function("ChromeUtils",core+"return acquireZenHome;")({importESModule:()=>({PrivateBrowsingUtils:{isWindowPrivate:()=>false}})});
 const a=acquire(win,services),b=acquire(win,services);
 assert.ok(a&&b);assert.equal(host.children.length,2);assert.equal(observers.size,1);
 a.release();assert.ok(win.__zenSharedHomeV1);assert.equal(host.children.length,2);
 b.release();assert.equal(win.__zenSharedHomeV1,undefined);assert.equal(host.children.length,1);assert.equal(observers.size,0);
 win.__zenSharedHomeV1={apiVersion:2};assert.equal(acquire(win,services),null);
});
