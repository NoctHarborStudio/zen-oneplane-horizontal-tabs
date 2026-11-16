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

test("Home native search preserves surface on cancel and ignores stale close",()=>{
 const code=extract("  function searchActive(","  function move(");
 const run=new Function("win","panel","content",code+`
 let open=true,searchToken=null,searchBar=null,searchFrame=0,searchMotion=null,searchTimer=0,closed=0;
 function close(){open=false;closed++;finishSearchVisual()}
 return {search,searchActive,onSearchClosed,morphFrames,observeSearch,get closed(){return closed},get token(){return searchToken}};
 `);
 const calls=[],node=()=>({attrs:new Map(),setAttribute(k,v){this.attrs.set(k,v)},removeAttribute(k){this.attrs.delete(k)},hasAttribute(k){return this.attrs.has(k)},getAttribute(k){return this.attrs.get(k)},querySelector(){return {getBoundingClientRect:()=>({left:20,top:40,width:600,height:56})}}});
 const panel=node(),content=node(),bar=node();bar.view={isOpen:false};
 const win={gURLBar:bar,gZenUIManager:{handleNewTab(...args){calls.push(args.slice(0,4));args[4].id=42;bar.setAttribute("zen-newtab","");return true}},console:{warn(){}},matchMedia:()=>({matches:true}),clearTimeout(){}};
 const a=run(win,panel,content);a.search();assert.deepEqual(calls,[[false,false,"tab",true]]);assert.equal(a.closed,0);
 assert.ok(panel.hasAttribute("data-zh-search"));assert.ok(content.hasAttribute("inert"));assert.equal(a.searchActive(),true);
 a.search();assert.equal(calls.length,1);
 a.onSearchClosed({detail:{closeSeq:41,onElementPicked:true}});assert.equal(a.closed,0);
 bar.removeAttribute("zen-newtab");a.onSearchClosed({detail:{closeSeq:42,onElementPicked:false}});assert.equal(a.closed,0);assert.equal(a.token,null);
 assert.equal(panel.hasAttribute("data-zh-search"),false);assert.equal(content.hasAttribute("inert"),false);
 a.search();bar.removeAttribute("zen-newtab");a.onSearchClosed({detail:{closeSeq:42,onElementPicked:true}});assert.equal(a.closed,1);
 const frames=a.morphFrames({left:10,top:100,width:600,height:56},{left:0,top:50,width:800,height:400});
 assert.equal(frames[0]["--zh-morph-x"],"-90px");assert.equal(frames[0]["--zh-morph-y"],"50px");
 assert.equal(frames[0]["--zh-morph-sx"],"0.75");assert.equal(frames[0]["--zh-morph-cut"],"344px");
 assert.equal(frames.at(-1)["--zh-morph-cut"],"0px");
 assert.equal(a.morphFrames({width:0,height:0},{width:800,height:400}),null);
});
test("Startup uses existing readiness handshake and one shared claim",()=>{
 assert.ok(layout.includes('window.addEventListener("OnePlane:StartupState",onHomeStartup)'));
 assert.ok(layout.includes('homeLease?.showOnStartup?.()'));
 assert.ok(core.includes("if(released||win[STARTUP])return false"));
 assert.ok(core.includes("if(open&&!startupHome&&!switching"));
});
test("Home visual selection does not mutate native selected tab",()=>{
 assert.ok(layout.includes("const selected = !homeOpen && nativeSelected;"));
 assert.ok(layout.includes("homeOpen?null:entries.get(browser.selectedTab)?.item"));
 assert.ok(layout.includes('url.toggleAttribute("data-op-home",open)'));
 assert.ok(core.includes("Click Customize Home to add your first pinned site."));
});

test("Home workspace switch uses optional Refined controller once and native fallback",async()=>{
 const code=extract("  function switchHomeWorkspace(","  function render(");
 let calls=0,wrapped=0;
 const win={},manager={changeWorkspaceWithID(id){calls++;return id;}};
 const change=new Function("win",code+"return switchHomeWorkspace;")(win);
 assert.equal(await change(manager,"a"),"a");assert.equal(calls,1);
 win.__zenRefinedWorkspaceTransition={run(fn){wrapped++;return fn();}};
 assert.equal(await change(manager,"b"),"b");assert.equal(wrapped,1);assert.equal(calls,2);
});
test("Home workspace state updates without replacing search and shortcuts",()=>{
 const code=extract("  function refreshWorkspaceSelection(","  function switchHomeWorkspace(");
 function button(id,name){const a=new Map([["data-zh-workspace-id",id],["data-zh-workspace-name",name]]);return {getAttribute:k=>a.get(k),setAttribute:(k,v)=>a.set(k,v),removeAttribute:k=>a.delete(k)}}
 const a=button("a","A"),b=button("b","B");
 a.setAttribute("aria-current","true");
 const manager={activeWorkspace:"b",getWorkspaces:()=>[{uuid:"a",name:"A"},{uuid:"b",name:"B"}]};
 let renders=0;
 const refresh=new Function("win","content","render",code+"let open=true,dead=false;return refreshWorkspaceSelection;")({gZenWorkspaces:manager},{querySelectorAll:()=>[a,b]},()=>renders++);
 refresh();assert.equal(a.getAttribute("aria-current"),undefined);assert.equal(b.getAttribute("aria-current"),"true");assert.equal(renders,0);
 manager.getWorkspaces=()=>[{uuid:"b",name:"Renamed"}];refresh();assert.equal(renders,1);
});
test("OnePlane keeps contour and panel stable during shared motion",()=>{
 assert.ok(layout.includes('window.addEventListener("ZenRefined:WorkspaceTransition",onWorkspaceMotion)'));
 assert.ok(layout.includes('window.removeEventListener("ZenRefined:WorkspaceTransition",onWorkspaceMotion)'));
 assert.ok(layout.includes('toggleAttribute("oneplane-workspace-hold",active)'));
 assert.ok(layout.includes('root.hasAttribute("data-zr-workspace-phase"))return;'));
});

test("Home recommendations prioritize bookmarks, then recent tabs and exclude existing/unsafe URLs",()=>{
 const recommend=new Function("win","safeURL",extract("  function recommendedPins(","  function collectRecommendations(")+"return recommendedPins")({URL},safeURL);
 const bookmarks=[{url:"https://github.com",title:"GitHub"},{url:"https://youtube.com/",title:"YouTube"},{url:"about:config",title:"Internal"},{url:"https://github.com/",title:"Duplicate"}];
 const tabs=[{url:"https://old.example",title:"Old",last:1},{url:"https://new.example",title:"New",last:20},{url:"https://github.com",title:"Tab duplicate",last:99},{url:"https://youtube.com",title:"Pinned",last:100}];
 const result=recommend(bookmarks,tabs,[{url:"https://youtube.com"}]);
 assert.deepEqual(result.map(x=>[x.title,x.source]),[["GitHub","Bookmark"],["New","Open tab"],["Old","Open tab"]]);
 assert.equal(recommend(bookmarks,tabs,[],1).length,1);
});
test("Home pin picker uses native sources and manual title is optional",()=>{
 assert.ok(core.includes('getElementById("PlacesToolbarItems")'));
 assert.ok(core.includes("browser.visibleTabs||browser.tabs"));
 assert.ok(core.includes('const message=addPin(item.url,item.title)'));
 assert.ok(core.includes('name.placeholder="Name (optional)"'));
 assert.ok(core.includes('button("zh-small zh-add-pin","+ Add Pin"'));
 assert.ok(core.includes('if(editing){'));
});

test("Add Pin recommendation pages contain at most three entries and clamp after pinning",()=>{
 const page=new Function(extract("  function pinPageSlice(","  function leavePinPicker(")+"return pinPageSlice")();
 assert.deepEqual(page([1,2,3,4,5,6,7],0),{index:0,pages:3,items:[1,2,3]});
 assert.deepEqual(page([1,2,3,4,5,6,7],1),{index:1,pages:3,items:[4,5,6]});
 assert.deepEqual(page([1,2,3,4,5,6],2),{index:1,pages:2,items:[4,5,6]});
 assert.deepEqual(page([],10),{index:0,pages:1,items:[]});
 assert.equal(page([1,2,3],-1).index,0);
});
test("Add Pin replaces search and pinned grid but retains shared workspaces and footer",()=>{
 const render=extract("  function render()","  function show(");
 assert.ok(render.indexOf("if(adding){")<render.indexOf('button("zh-search"'));
 assert.ok(render.indexOf("}else{")<render.indexOf('button("zh-search"'));
 assert.ok(render.includes("if(adding){leavePinPicker();return;}"));
 assert.ok(render.indexOf("const manager=win.gZenWorkspaces")>render.indexOf("content.append(section);\n    }"));
 assert.ok(core.includes("for(const item of page.items)"));
 assert.ok(core.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
});
