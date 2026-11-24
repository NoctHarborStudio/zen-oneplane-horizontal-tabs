import {watchWorkspaceCommand,workspaceCommandState,workspaceCommandMessage,workspaceCommandPresentationBlocked} from "../src/core/workspace-commands.mjs";
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
 const acquire=new Function("ChromeUtils","watchWorkspaceCommand","workspaceCommandState","workspaceCommandMessage","workspaceCommandPresentationBlocked",core+"return acquireZenHome;")({importESModule:()=>({PrivateBrowsingUtils:{isWindowPrivate:()=>false}})},watchWorkspaceCommand,workspaceCommandState,workspaceCommandMessage,workspaceCommandPresentationBlocked);
 const a=acquire(win,services),b=acquire(win,services);
 assert.ok(a&&b);assert.equal(host.children.length,2);assert.equal(observers.size,1);
 a.release();assert.ok(win.__zenSharedHomeV1);assert.equal(host.children.length,2);
 b.release();assert.equal(win.__zenSharedHomeV1,undefined);assert.equal(host.children.length,1);assert.equal(observers.size,0);
 win.__zenSharedHomeV1={apiVersion:2};assert.equal(acquire(win,services),null);
});

test("Workspace command notices preserve Home geometry without hiding native pending state",()=>{
 assert.ok(core.includes('const spaces=html("section","zh-section zh-workspace-section")'));
 assert.ok(core.includes('#zen-shared-home .zh-workspace-section{position:relative}'));
 assert.match(core,/#zen-shared-home \.zh-workspace-section > \.zh-workspace-pending\{position:absolute;inset-inline:0;top:100%;/);
 assert.ok(core.includes('overflow:hidden;white-space:nowrap;text-overflow:ellipsis'));
 assert.ok(core.includes('pending.setAttribute("aria-live","polite")'));
 const code=extract("  function updateWorkspacePending(","  const leases=");
 const status={textContent:"",title:"",hidden:true},buttons=[{disabled:false}];
 const content={querySelector:selector=>selector===".zh-workspace-pending"?status:null,querySelectorAll:()=>buttons};
 const update=new Function("content","workspaceCommandMessage","workspaceCommandPresentationBlocked","switching",
   code+"return updateWorkspacePending;")(content,workspaceCommandMessage,workspaceCommandPresentationBlocked,false);
 update({blocked:false,phase:"idle"});
 assert.deepEqual({text:status.textContent,title:status.title,hidden:status.hidden,disabled:buttons[0].disabled},
   {text:"",title:"",hidden:true,disabled:false});
 update({blocked:true,phase:"pending",remaining:3000,reserved:false});
 assert.equal(status.textContent,"Workspace command in progress…");
 assert.equal(status.title,status.textContent);
 assert.equal(status.hidden,false);assert.equal(buttons[0].disabled,true);
 update({blocked:true,phase:"unknown"});
 assert.match(status.textContent,/restart Zen/);
 assert.equal(status.title,status.textContent);
 update({blocked:false,phase:"idle"});
 assert.equal(status.hidden,true);assert.equal(status.title,"");assert.equal(buttons[0].disabled,false);
});

test("Home native search preserves surface on cancel and ignores stale close",()=>{
 const code=extract("  function searchActive(","  function move(");
 const run=new Function("win","panel","content",code+`
 let open=true,searchToken=null,searchBar=null,searchFrame=0,searchMotion=null,searchTimer=0,closed=0;
 let searchGeometry=null,searchLastHeight=0,searchCurrentHeight=0,searchClosing=false,searchReturn=null,searchReturnFrame=0;
 let searchInput=null,searchOriginalPlaceholder=null,searchSessionLabel=null;
 let searchSnapshot=null,searchSnapshotTimer=0,searchSnapshotObserver=null,searchSnapshotDirty=true,searchSnapshotView=null;
 let searchReturnParts=[],searchLastRect=null;const doc={getElementById:()=>null};
 function close(){open=false;closed++;finishSearchVisual()}
 function leaveHome(){close()}
 function ensurePrimaryHome(){}
 return {search,searchActive,onSearchClosed,homeSearchGeometry,revealValue,observeSearch,get closed(){return closed},get token(){return searchToken}};
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
 const geometry=a.homeSearchGeometry({left:10,top:100,width:600,height:56},1000,800);
 assert.deepEqual(geometry,{left:12,top:100,width:600,header:56,room:684});
 assert.equal(a.homeSearchGeometry({left:20,top:500,width:600,height:56},1000,800).top,500);
 assert.equal(a.homeSearchGeometry({left:20,top:100,width:600,height:56},350,800).width,326);
 assert.equal(a.revealValue(56,400,0),56);
 assert.equal(a.revealValue(56,400,1),400);
 assert.ok(a.revealValue(400,56,.5)>56&&a.revealValue(400,56,.5)<400);
});
test("Startup uses existing readiness handshake and one shared claim",()=>{
 assert.ok(layout.includes('window.addEventListener("OnePlane:StartupState",onHomeStartup)'));
 assert.ok(layout.includes('lease.showOnStartup?.()'));
 assert.ok(layout.includes('homeLease===lease&&window.__nocturneLayoutStartup===startup'));
 assert.ok(core.includes("if(released||win[STARTUP])return false"));
 assert.ok(core.includes("(!startupHome||homeOnPlaceholder)"));
});
test("Home visual selection does not mutate native selected tab",()=>{
 assert.ok(layout.includes("const selected = !homeOpen && nativeSelected;"));
 assert.ok(layout.includes("homeOpen?null:entries.get(browser.selectedTab)?.item"));
 assert.ok(layout.includes('url.toggleAttribute("data-op-home",open)'));
 assert.ok(core.includes("Click Customize Home to add your first pinned site."));
});

test("Home workspace switch delegates to shared native boundary with current view guard",async()=>{
 const code=extract("  function switchHomeWorkspace(","  function render(");
 const manager={},win={gZenWorkspaces:manager};let calls=0,current;
 const request=(w,m,id,kind,guard)=>{assert.equal(w,win);assert.equal(m,manager);assert.equal(kind,"home");calls++;current=guard;return id;};
 const change=new Function("win","requestWorkspaceSwitch",code+"let dead=false;return switchHomeWorkspace;")(win,request);
 assert.equal(await change(manager,"a"),"a");assert.equal(calls,1);assert.equal(current(),true);
 win.gZenWorkspaces={};assert.equal(current(),false);
});
test("Home workspace state updates without replacing search and shortcuts",()=>{
 const code=extract("  function refreshWorkspaceSelection(","  function switchHomeWorkspace(");
 function button(id,name){const a=new Map([["data-zh-workspace-id",id],["data-zh-workspace-name",name]]);return {getAttribute:k=>a.get(k),setAttribute:(k,v)=>a.set(k,v),removeAttribute:k=>a.delete(k)}}
 const a=button("a","A"),b=button("b","B");
 a.setAttribute("aria-current","true");
 const manager={activeWorkspace:"b",getWorkspaces:()=>[{uuid:"a",name:"A"},{uuid:"b",name:"B"}]};
 let renders=0;
 const refresh=new Function("win","content","refreshHomeStructure",code+"let open=true,dead=false;return refreshWorkspaceSelection;")({gZenWorkspaces:manager},{querySelectorAll:()=>[a,b]},()=>renders++);
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

test("Add Pin uses two visible rows with native scrolling and no pagination",()=>{
 assert.ok(core.includes('height:calc(2 * var(--zh-row) + var(--zh-row-gap) + 4px)'));
 assert.ok(core.includes("overflow-y:auto"));
 assert.ok(core.includes("scrollbar-gutter:stable"));
 assert.ok(core.includes("for(const [index,item] of suggestions.entries())"));
 assert.ok(!core.includes("pinPageSlice"));
 assert.ok(!core.includes("zh-pagination"));
});
test("Add Pin scroll is clamped and restored after preference changes",()=>{
 const restore=new Function(extract("  function restorePinScroll(","  function addForm(")+"return restorePinScroll")();
 const grid={scrollHeight:400,clientHeight:140,scrollTop:0};
 assert.equal(restore(grid,120),120);assert.equal(grid.scrollTop,120);
 assert.equal(restore(grid,500),260);assert.equal(restore(grid,-10),0);
 grid.scrollHeight=80;assert.equal(restore(grid,100),0);
 assert.equal(restore(null,50),0);
});
test("Add Pin replaces search and pinned grid but retains shared workspaces and footer",()=>{
 const render=extract("  function render()","  function show(");
 assert.ok(render.indexOf("if(adding){")<render.indexOf('button("zh-search"'));
 assert.ok(render.indexOf("}else{")<render.indexOf('button("zh-search"'));
 assert.ok(render.includes("if(adding){leavePinPicker();return;}"));
 assert.ok(render.indexOf("const manager=win.gZenWorkspaces")>render.indexOf("content.append(section);\n    }"));
 assert.ok(render.includes("if(adding&&oldGrid)pinScrollTop=oldGrid.scrollTop"));
 assert.ok(render.includes("restorePinScroll(grid,pinScrollTop)"));
 assert.ok(core.includes("grid-template-columns:repeat(3,minmax(0,1fr))"));
});
test("Home picker animation runs only on mode changes and honors reduced motion",()=>{
 assert.ok(core.includes('const animateMode=nextMode!==pinViewMode'));
 assert.ok(core.includes('animation:zh-picker-enter 200ms'));
 assert.ok(core.includes('animation:none!important'));
 assert.ok(core.includes('.zh-suggestion:active{scale:.97}'));
});

test("Home is primary: repeated clicks, Escape, background opens and real navigation",()=>{
 class Node{
  constructor(){this.children=[];this.attrs=new Map();this.isConnected=true;this.listeners=new Map();}
  append(...nodes){this.children.push(...nodes);for(const n of nodes)n.parent=this}
  replaceChildren(...nodes){this.children=[];this.append(...nodes)}
  contains(n){return this===n||this.children.some(x=>x.contains(n))}
  setAttribute(k,v){this.attrs.set(k,v)} hasAttribute(k){return this.attrs.has(k)} getAttribute(k){return this.attrs.get(k)} removeAttribute(k){this.attrs.delete(k)}
  toggleAttribute(k,v){v?this.attrs.set(k,""):this.attrs.delete(k)}
  addEventListener(k,f){this.listeners.set(k,f)} removeEventListener(k,f){if(this.listeners.get(k)===f)this.listeners.delete(k)}
  querySelector(){return null} focus(){}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.isConnected=false}
  fire(k,e={}){this.listeners.get(k)?.(e)}
 }
 const root=new Node(),host=new Node(),panels=new Node(),tabs=new Node();root.append(host);host.append(panels);
 const doc={documentElement:root,getElementById:id=>id==="zen-tabbox-wrapper"?host:id==="tabbrowser-tabpanels"?panels:null,createElementNS:()=>new Node()};
 const win=new Node();win.document=doc;win.console={warn(...args){throw Error(args.join(" "))}};win.matchMedia=()=>({matches:true});win.MutationObserver=class{observe(){} disconnect(){}};
 const blank=new Node(),page=new Node(),pending=new Node(),fresh=new Node();
 const initialGlobal={isInitialDocument:true,documentURI:{spec:"about:blank"}};
 fresh.linkedBrowser={currentURI:{spec:"about:blank"},browsingContext:{currentWindowGlobal:initialGlobal}};
 const bar=new Node();bar.view={isOpen:false,close(){this.isOpen=false}};bar.blur=()=>{};win.gURLBar=bar;
 blank.setAttribute("zen-empty-tab","");blank.linkedBrowser={currentURI:{spec:"about:blank"}};
 page.linkedBrowser={currentURI:{spec:"https://example.org/"}};
 pending.setAttribute("pending","");pending.linkedBrowser={currentURI:{spec:"about:blank"}};
 let progress;win.gBrowser={tabContainer:tabs,selectedTab:blank,get selectedBrowser(){return this.selectedTab.linkedBrowser;},addTabsProgressListener(p){progress=p},removeTabsProgressListener(){}};
 const services={prefs:{getStringPref:(k,v)=>v,addObserver(){},removeObserver(){}}};
 const acquire=new Function("ChromeUtils","watchWorkspaceCommand","workspaceCommandState","workspaceCommandMessage","workspaceCommandPresentationBlocked",core+"return acquireZenHome;")({importESModule:()=>({PrivateBrowsingUtils:{isWindowPrivate:()=>false}})},watchWorkspaceCommand,workspaceCommandState,workspaceCommandMessage,workspaceCommandPresentationBlocked);
 const lease=acquire(win,services),states=[];lease.subscribe(v=>states.push(v));
 assert.equal(lease.open,true);assert.equal(panels.hasAttribute("data-zr-home-covered"),true);
 const content=host.children[1].children[0],initial=content.children;
 lease.show();lease.toggle();lease.toggle();lease.close();
 assert.equal(lease.open,true);assert.equal(content.children,initial);assert.deepEqual(states,[true]);
 win.fire("keydown",{key:"Escape",preventDefault(){},stopPropagation(){}});
 assert.equal(lease.open,true);
 tabs.fire("TabOpen",{target:page});assert.equal(lease.open,true);
 win.gBrowser.selectedTab=page;tabs.fire("TabSelect",{target:page});assert.equal(lease.open,false);
 assert.equal(panels.hasAttribute("data-zr-home-covered"),false);
 lease.show();lease.show();assert.equal(lease.open,true);
 win.gBrowser.selectedTab=pending;tabs.fire("TabSelect",{target:pending});assert.equal(lease.open,false);
 // TabOpen/TabSelect sees the initial blank before a real navigation.
 tabs.fire("TabOpen",{target:fresh});win.gBrowser.selectedTab=fresh;tabs.fire("TabSelect",{target:fresh});
 assert.equal(lease.open,false);
 progress.onLocationChange(fresh.linkedBrowser,{isTopLevel:true},{spec:"about:blank"});
 assert.equal(lease.open,false);
 win.fire("ZenURLBarClosed",{detail:{onElementPicked:true,onSwitch:true,closeSeq:3}});
 assert.equal(lease.open,false);
 fresh.linkedBrowser.currentURI={spec:"https://example.com/"};
 fresh.linkedBrowser.browsingContext.currentWindowGlobal={isInitialDocument:false,documentURI:{spec:"https://example.com/"}};
 progress.onLocationChange(fresh.linkedBrowser,{isTopLevel:true},fresh.linkedBrowser.currentURI);
 progress.onStateChange(fresh.linkedBrowser,{isTopLevel:true},null,0x40010);
 assert.equal(lease.open,false);
 // A genuine native empty tab remains Home.
 win.gBrowser.selectedTab=blank;tabs.fire("TabSelect",{target:blank});assert.equal(lease.open,true);
 blank.removeAttribute("zen-empty-tab");blank.linkedBrowser.currentURI={spec:"https://example.net/"};
 progress.onLocationChange(blank.linkedBrowser,{isTopLevel:true},blank.linkedBrowser.currentURI);
 assert.equal(lease.open,false);
 blank.linkedBrowser.currentURI={spec:"about:blank"};
 blank.linkedBrowser.browsingContext={currentWindowGlobal:{isInitialDocument:false,documentURI:{spec:"about:blank"}}};
 blank.setAttribute("busy","");
 progress.onLocationChange(blank.linkedBrowser,{isTopLevel:true},blank.linkedBrowser.currentURI);
 assert.equal(lease.open,false);
 blank.removeAttribute("busy");progress.onStateChange(blank.linkedBrowser,{isTopLevel:true},null,0x40010);
 assert.equal(lease.open,true);
 // Native search result selection must not resurrect a closed Home,
 // even if the current committed tab is a real blank placeholder.
 win.gBrowser.selectedTab=page;tabs.fire("TabSelect",{target:page});assert.equal(lease.open,false);
 bar.view.isOpen=true;win.gBrowser.selectedTab=blank;tabs.fire("TabSelect",{target:blank});assert.equal(lease.open,false);
 bar.view.isOpen=false;win.fire("ZenURLBarClosed",{detail:{onElementPicked:true,closeSeq:4}});assert.equal(lease.open,false);
 win.fire("ZenURLBarClosed",{detail:{onSwitch:true,closeSeq:5}});assert.equal(lease.open,false);
 win.fire("ZenURLBarClosed",{detail:{onSwitch:false,onElementPicked:false,closeSeq:6}});assert.equal(lease.open,true);
 lease.release();assert.equal(panels.hasAttribute("data-zr-home-covered"),false);
});
test("Home button invokes idempotent show instead of toggle",()=>{
 assert.ok(layout.includes("homeLease?.show();"));assert.ok(!layout.includes("homeLease?.toggle();"));
 assert.ok(core.includes("toggle:()=>!released&&show()"));
});

test("Home icons request larger cached sizes and use local Steam vector",()=>{
 const icons=new Function("win",extract("  const steamVector=","  const style=")+"return homeIconURL;")({URL,devicePixelRatio:2});
 assert.equal(icons("https://example.com/path#part",30),"page-icon:https://example.com/path#size=96");
 assert.equal(icons("https://example.com/",23),"page-icon:https://example.com/#size=48");
 assert.ok(icons("https://steamcommunity.com/",30).startsWith("data:image/svg+xml,"));
 assert.ok(icons("https://store.steampowered.com/",30).startsWith("data:image/svg+xml,"));
 assert.ok(icons("https://notsteampowered.com/",30).startsWith("page-icon:"));
 assert.ok(icons("https://mail.google.com/mail/u/0/#inbox",30).startsWith("data:image/svg+xml,"));
 assert.ok(icons("https://gmail.com/",23).startsWith("data:image/svg+xml,"));
 assert.ok(icons("https://notgmail.com/",30).startsWith("page-icon:"));
});
test("Home search uses single scoped glass frame and actual height reveal",()=>{
 assert.ok(core.includes('[data-zh-search-ready] .zh-search{visibility:hidden}'));
 assert.ok(core.includes('background:var(--zh-glass)!important;border:1px solid var(--zh-stroke)!important'));
 assert.ok(core.includes('height:var(--zh-reveal-height,var(--zh-search-header,56px))!important'));
 assert.ok(core.includes('clip-path:none!important;transform:none!important;translate:none!important;scale:1!important'));
 assert.ok(!core.includes("--zh-morph-cut"));
 assert.ok(core.includes('searchBar.style?.removeProperty("--zh-search-"+key)'));
});

test("Home search waits for a real result height and animates both directions",()=>{
 const code=extract("  function revealValue(","  function search(){");
 const queue=new Map(),attrs=new Map(),styles=new Map();
 let seq=0,height=56;
 const bar={style:{setProperty:(k,v)=>styles.set(k,v),removeProperty:k=>styles.delete(k)},
  setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),getAttribute:k=>attrs.get(k),hasAttribute:k=>attrs.has(k),
  getBoundingClientRect:()=>({height:attrs.has("data-zr-home-search-motion")?Number.parseFloat(styles.get("--zh-reveal-height"))||56:height})};
 bar.setAttribute("open","");bar.setAttribute("zen-floating-urlbar","true");bar.setAttribute("data-zr-home-search-motion","prepare");
 const win={requestAnimationFrame(fn){queue.set(++seq,fn);return seq;},cancelAnimationFrame(id){queue.delete(id);},matchMedia:()=>({matches:false})};
 const run=new Function("win","bar",code+`
 let open=true,searchToken={},searchBar=bar,searchFrame=0,searchClosing=false,searchLastHeight=56,searchCurrentHeight=56,searchGeometry={header:56,room:600};
 const panel={hasAttribute:k=>attrsMock.has(k),setAttribute:(k,v)=>attrsMock.set(k,v)};const attrsMock=new Map();
 function nativeSearchOpen(){return true}
 function finishSearchMotion(){bar.removeAttribute("data-zr-home-search-motion")}
 function scheduleSearchSnapshot(){}
 return {start:()=>startSearchMorph(searchToken,searchGeometry),close:()=>{searchClosing=true;animateSearchHeight(searchToken,400,56,368,true,()=>{})},get current(){return searchCurrentHeight}};
 `);
 const a=run(win,bar);
 const frame=now=>{const jobs=[...queue.values()];queue.clear();for(const fn of jobs)fn(now)};
 a.start();frame(0);frame(16);assert.equal(a.current,56);
 height=400;frame(32);assert.equal(a.current,56);
 frame(48);frame(150);assert.ok(a.current>56&&a.current<400);
 frame(400);assert.ok(a.current>56&&a.current<400);frame(496);assert.equal(a.current,400);
 a.close();frame(512);frame(600);assert.ok(a.current>56&&a.current<400);
 frame(880);assert.equal(a.current,56);
});
test("Home search closing preserves native ownership and has blur fallback",()=>{
 assert.ok(core.includes("bar._zenHandleUrlbarClose(false,false)"));
 assert.ok(core.includes("driveLiveSearch(token,state,true,reason)"));
 assert.ok(core.includes("function settleNativeSearch(reason)"));
 assert.ok(core.includes('panel.removeAttribute("data-zh-return")'));
 assert.ok(core.includes("if(detail.onElementPicked||detail.onSwitch)leaveHome();"));
 assert.ok(core.includes('else settleNativeSearch("native-event")'));
});
test("Home icon error fallback retains original cache URI before generic",()=>{
 const make=new Function("win",extract("  const steamVector=","  const style=")+"return setHomeIcon;")({URL,devicePixelRatio:1});
 const listeners=new Map(),img={src:"",addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:k=>listeners.delete(k)};
 const uri="https://example.com/#account";make(img,uri,30);
 assert.equal(img.src,"page-icon:https://example.com/#size=96");
 listeners.get("error")();assert.equal(img.src,"page-icon:"+uri);
 listeners.get("error")();assert.equal(img.src,"page-icon:https://example.com/");
 listeners.get("error")();assert.ok(img.src.startsWith("data:image/svg+xml,"));
 listeners.get("error")();assert.equal(listeners.has("error"),false);
});


test("Home background is neutral in Gecko and native toolbar gaps retain window drag",()=>{
 const toolbar=readFileSync(new URL("../src/styles/base.css.part",import.meta.url),"utf8");
 assert.ok(core.includes("#zen-shared-home,#zen-shared-home *{-moz-window-dragging:default!important}"));
 assert.ok(core.includes("#zen-shared-home :is(button,input,textarea,select,summary,a,[draggable=true],.zh-recommendations){-moz-window-dragging:no-drag!important}"));
 assert.ok(!core.includes("#zen-shared-home,#zen-shared-home *{-moz-window-dragging:no-drag!important}"));
 assert.doesNotMatch(core,/-moz-window-dragging:\s*drag\b/);
 assert.match(toolbar,/#oneplane-center-start, #oneplane-center-end\s*\{[^}]*-moz-window-dragging:\s*drag\s*!important/);
 assert.ok(layout.includes(core),"generated bundle must contain the updated Home source");
});

test("Home search handoff shares header tokens, exact anchor and no New tab label",()=>{
 assert.ok(core.includes("--zh-search-glass:"));
 assert.ok(core.includes("font:var(--zh-search-font)"));
 assert.ok(core.includes('data-zr-home-search-motion="prepare"][zen-floating-urlbar="true"]{opacity:0!important}'));
 assert.ok(core.includes('[data-zh-search-ready] .zh-search{visibility:hidden}'));
 assert.ok(core.includes('panel.removeAttribute("data-zh-search-ready")'));
 assert.ok(!core.includes('html("span","","New tab")'));
 assert.ok(!core.includes("shell.style.opacity="));
 assert.ok(core.includes("round?224:448"));
 assert.ok(core.includes("from>header+8?368:144"));
 assert.ok(core.includes("eased=t*t*(3-2*t)"));
});

test("Home cards reveal continuously as the search edge clears each row",()=>{
 const state=new Function(extract("  function returnCardState(","  function prepareReturnParts(")+"return returnCardState")();
 assert.deepEqual(state(300,100,450,0,250),{alpha:0,clip:100,shift:6});
 const partial=state(300,100,370,.35,250);
 assert.ok(partial.alpha>0&&partial.alpha<1);
 assert.ok(partial.clip>0&&partial.clip<100);
 assert.ok(partial.shift>0&&partial.shift<6);
 // The second Pinned row and workspaces appear before the first row.
 assert.ok(state(420,100,450,.35,250).alpha>state(300,100,450,.35,250).alpha);
 assert.ok(state(550,48,450,.2,250).alpha>0);
 assert.deepEqual(state(300,100,250,1,250),{alpha:1,clip:0,shift:0});
 // The endpoint remains continuous even if the source is unusually low.
 const near=state(260,100,265,.99,264);
 assert.ok(near.alpha>.99&&near.clip<=1);
 assert.deepEqual(state(260,100,264,1,264),{alpha:1,clip:0,shift:0});
});
test("Home has no frozen renderer or prewarm work",()=>{
 for(const old of ["freezeSearchResults","snapshotProperties","searchSnapshot","zen-home-search-return","searchReturnFrame","ResizeObserver","captureSearchSnapshot","scheduleSearchSnapshot"])assert.ok(!core.includes(old),old);
 assert.ok(core.includes('opacity:calc(var(--zh-return-alpha,0) * var(--zh-return-base,1))'));
 assert.ok(core.includes('paintReturnParts(searchReturnParts,g.top+height,state.progress,g.top+header)'));
 assert.ok(core.includes('if(part.last===key)continue'));
 assert.ok(core.includes('else settleNativeSearch("native-event")'));
 assert.ok(!core.includes('listen(win,"focusout"'));
});



test("Home footer return uses resting opacity rather than search-hidden opacity",()=>{
 assert.ok(core.includes('node.classList.contains("zh-footer")?1:'));
});

test("Home retains the verified native timeline rail geometry",()=>{
 assert.ok(core.includes('#urlbar[data-zr-home-search][zen-floating-urlbar="true"] #urlbar-results[data-zr-smart-grid][data-zr-timeline] > .urlbarView-row[data-zr-rail]::after'));
 assert.ok(core.includes("animation:none!important;background-position:center bottom,center!important;opacity:.43!important"));
});
test("Home live readiness excludes native teardown",()=>{
 const ready=new Function(extract("  function liveSearchReady(","  function searchLog(")+"return liveSearchReady")();
 const attrs=new Map([["zen-newtab",""],["zen-floating-urlbar","true"]]);
 const bar={view:{isOpen:true},hasAttribute:k=>attrs.has(k),getAttribute:k=>attrs.get(k)};
 assert.equal(ready(bar),true);
 attrs.delete("zen-newtab");assert.equal(ready(bar),false);
 attrs.set("zen-newtab","");bar.view.isOpen=false;assert.equal(ready(bar),false);
});

test("Home startup groups are gated, decoded, staggered and cleaned up",()=>{
 assert.ok(core.includes(':root[data-zr-startup-phase="waiting"] #zen-shared-home[data-zh-startup]'));
 assert.ok(core.includes('if(src&&startupIconSources.get(img)!==src)'));
 assert.ok(core.includes('Math.min(i*65,195)'));
 assert.ok(core.includes('if(startupRun===run)finishStartupHome(run)'));
 assert.ok(core.includes('if(!startup&&!staged)content.querySelector'));
});
test("Home search commit gate survives native floating attribute teardown",()=>{
 const code=extract("  function driveLiveSearch(","  function reverseLiveSearch(");
 assert.ok(code.indexOf('bar.setAttribute("data-zh-closing","")')<code.indexOf("if(!finishNativeCancel())"));
 assert.ok(core.includes('#urlbar[data-zr-home-search][data-zh-closing]{opacity:0!important;visibility:hidden!important'));
 assert.ok(core.includes('if(!nativeSearchOpen(searchBar))settleNativeSearch("native-observer");'));
 assert.ok(core.includes('win.__nocturneTrace?.("home.search."+event'));
});

test("Home startup animation is held until the boot controller resumes it",()=>{
 assert.ok(core.includes('elapsed=timeline.paused?0:'));
 assert.ok(core.includes('if(timeline.paused){a.pause();a.currentTime=0;}'));
 assert.ok(core.includes('resumeStartup:resumeStartupHome'));
});

test("Home baseline records bounded frame gaps and one summary per phase",()=>{
 const code=extract("  function searchProbeNow(","  function paintSearchHeight(");
 let clock=10,enabled=true;const traces=[];
 const win={performance:{now:()=>clock},__nocturneTrace:(event,data)=>traces.push({event,data})};
 const prefs={getBoolPref:()=>enabled};
 const api=new Function("win","prefs",code+`let searchProbeSequence=0;return {startSearchProbe,beginSearchCloseProbe,searchProbeFrame,finishSearchProbe};`)(win,prefs);
 const token={};api.startSearchProbe(token);assert.equal(token.homeProbe.id,1);
 for(const now of [10,15,25,45,85])api.searchProbeFrame(token,"open",now);
 clock=100;api.finishSearchProbe(token,"open","complete");api.finishSearchProbe(token,"open","interrupted");
 assert.equal(traces.length,1);const d=traces[0].data;
 assert.equal(traces[0].event,"home.search.open-baseline");
 assert.deepEqual([d.frames,d.gapCount,d.p50,d.p95,d.p99,d.max],[5,4,10,40,40,40]);
 assert.equal("snapshotCalls" in d,false);assert.equal("resizeReads" in d,false);
 api.beginSearchCloseProbe(token);api.beginSearchCloseProbe(token);
 for(let i=0;i<520;i++)api.searchProbeFrame(token,"close",100+i*4);
 clock=2300;api.finishSearchProbe(token,"close","complete");
 assert.equal(traces.length,2);assert.equal(traces[1].data.gapCount,512);assert.equal(traces[1].data.gapDropped,7);
 assert.equal("snapshotCalls" in traces[1].data,false);
 enabled=false;const off={};api.startSearchProbe(off);assert.equal(off.homeProbe,undefined);
 enabled=true;api.startSearchProbe(off);enabled=false;api.finishSearchProbe(off,"open","interrupted");assert.equal(traces.length,2);
});

test("Home background cancellation classifies pointer presses at the window boundary",()=>{
 const code=extract("  function isHomeSearchBackgroundPress(","  function dismissHomeSearch(");
 const rect=(left,top,right,bottom)=>({left,top,right,bottom});
 const shield={},doc={getElementById:()=>shield};
 const panel={getBoundingClientRect:()=>rect(0,0,1000,800)},child={},content={hasAttribute:k=>k==="inert",contains:n=>n===child},host={},panels={},row={},toolbar={};
 let popup=false,popover=true;
 const bar={hasAttribute:k=>k==="has-popup-open"&&popup,matches:s=>s===":popover-open"&&popover,contains:n=>n===bar||n===row,getBoundingClientRect:()=>rect(200,150,800,450)};
 const calls=[];
 const api=new Function("win","doc","panel","content","host","panels","bar","calls",code+`
 let open=true,searchToken={},searchClosing=false,searchReturn=null,searchBar=bar;
 function cancelHomeSearch(reason){calls.push(reason);return true;}
 return {classify:event=>isHomeSearchBackgroundPress(event,panel,content,bar,host,panels),dispatch:onSearchPointerDown,setClosing:value=>searchClosing=value};
 `)({},doc,panel,content,host,panels,bar,calls);
 const press=(target,x=100,y=500,extra={})=>({target,clientX:x,clientY:y,button:0,isPrimary:true,defaultPrevented:false,preventDefault(){calls.push("prevent");},stopImmediatePropagation(){calls.push("stop");},...extra});
 for(const target of [panel,content,child,host,panels,bar])assert.equal(api.classify(press(target)),true);
 for(const event of [press(row),press(toolbar),press(bar,400,300),press(panel,400,300),press(panel,-1,500),press(panel,100,900),press(panel,100,500,{button:2}),press(panel,100,500,{isPrimary:false}),press(panel,100,500,{defaultPrevented:true})])assert.equal(api.classify(event),false);
 popup=true;assert.equal(api.classify(press(panel)),false);popup=false;
 popover=false;assert.equal(api.classify(press(bar)),false);popover=true;
 content.hasAttribute=()=>false;assert.equal(api.classify(press(panel)),false);content.hasAttribute=k=>k==="inert";
 api.dispatch(press(panel));assert.deepEqual(calls.splice(0),["home-background","prevent","stop"]);
 api.dispatch(press(bar));assert.deepEqual(calls.splice(0),["home-background","prevent","stop"]);
 api.dispatch(press(row,400,300));assert.deepEqual(calls.splice(0),[]);
 api.dispatch(press(toolbar));assert.deepEqual(calls.splice(0),[]);
 api.dispatch(press(shield));assert.deepEqual(calls.splice(0),[]);
 api.setClosing(true);api.dispatch(press(panel));assert.deepEqual(calls,[]);
 assert.ok(core.includes('listen(win,"pointerdown",onSearchPointerDown,true)'));
 assert.ok(!core.includes('listen(panel,"pointerdown"'));
});

test("Address dismiss shield delegates Home search before ordinary address close",()=>{
 const source=readFileSync(new URL("../src/toolbar/address-shield.js.part",import.meta.url),"utf8");
 const code=source.slice(source.indexOf("  function dismissUrl()"),source.indexOf("  function finishDismissUrl()"));
 const calls=[];let homeHandled=true,inlineHandled=false;
 const invoke=new Function("homeLease","releaseShield","holdToolbarAfterDismiss","startAddressClose","finishDismissUrl","window",code+"return dismissUrl;")(
  {dismissSearch:()=>{calls.push("home");return homeHandled;}},()=>calls.push("release"),()=>calls.push("hold"),()=>{calls.push("inline");return inlineHandled;},()=>calls.push("native"),{});
 invoke();assert.deepEqual(calls.splice(0),["release","home","hold"]);
 homeHandled=false;inlineHandled=true;invoke();assert.deepEqual(calls.splice(0),["release","home","inline"]);
 inlineHandled=false;invoke();assert.deepEqual(calls.splice(0),["release","home","inline","native"]);
 const homeCode=extract("  function dismissHomeSearch(","  function finishNativeCancel(");
 const api=new Function("calls",homeCode+`
 let open=true,searchToken={},searchReturn=null,searchClosing=false,popup=false;
 const searchBar={hasAttribute:k=>k==="has-popup-open"&&popup};
 function cancelHomeSearch(reason){calls.push(reason);return true;}
 return {dismissHomeSearch,set:(o,t,r,c,p)=>{open=o;searchToken=t;searchReturn=r;searchClosing=c;popup=p;}};
 `)(calls);
 assert.equal(api.dismissHomeSearch(),true);assert.deepEqual(calls.splice(0),["home-background"]);
 api.set(true,{},null,false,true);assert.equal(api.dismissHomeSearch(),false);
 api.set(true,{},null,true,false);assert.equal(api.dismissHomeSearch(),true);
 api.set(false,{},null,false,false);assert.equal(api.dismissHomeSearch(),false);
 api.set(true,null,null,false,false);assert.equal(api.dismissHomeSearch(),false);
 assert.deepEqual(calls,[]);
 assert.ok(core.includes("dismissSearch:()=>!released&&dismissHomeSearch()"));
});

test("Home native rail width is quantized to physical pixels",()=>{
 const width=new Function(extract("  function searchRuleWidth(","  function applySearchGeometry(")+"return searchRuleWidth")();
 for(const dpr of [1,1.25,1.5,1.75,2,2.5,3])assert.ok(Math.abs(width(dpr)*dpr-Math.floor(dpr))<1e-9);
 assert.equal(width(0),1);assert.equal(width(undefined),1);
 assert.ok(core.includes('background-size:6px 6px,var(--zh-search-rule,1px)'));
 assert.ok(core.includes('background-size:var(--zh-search-rule,1px) calc(100% - 16px)'));
});

test("Home preserves its existing live default glyph until visual acceptance",()=>{
 assert.ok(core.includes('.urlbarView-favicon[data-zr-home-default="true"]'));
 assert.ok(core.includes("background-color:currentColor!important"));
});

test("Home controlled close keeps native session until last frame and reverses from current geometry",()=>{
 const code=extract("  function ownsLiveSearch(","  function settleNativeSearch(");
 const jobs=[],writes=[],native=()=>writes.push("native");
 const token={nativeClose:native,liveReturn:null},attrs=new Map();
 let height=400,alpha=1;
 const bar={_zenHandleUrlbarClose:native,getBoundingClientRect:()=>({height}),querySelector:()=>({querySelectorAll:()=>[1,2]}),setAttribute:(k,v)=>attrs.set(k,v)};
 const api=new Function("win","token","bar","jobs","writes","attrs","setHeight","setAlpha",code+`
 let searchToken=token,searchBar=bar,searchGeometry={header:56,room:600,top:40},searchLastHeight=400,searchClosing=false,searchReturnParts=[];
 const panel={setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
 const content={querySelectorAll:()=>[],querySelector:()=>({focus:()=>writes.push("focus")})};
 function liveSearchReady(){return true} function finishSearchProbe(){} function beginSearchCloseProbe(){}
 function prepareReturnParts(){return []} function paintReturnParts(){} function finishSearchMotion(){} function searchProbeNow(){return 0}
 function searchLog(){} function naturalSearchHeight(){return 400} function revealValue(a,b,p){return a+(b-a)*p}
 function finishNativeCancel(){bar._zenHandleUrlbarClose();return true}
 function finishSearchVisual(){searchToken=null;writes.push("cleanup")}
 function animateSearchHeight(t,from,to,duration,closing,done,live){
  jobs.length=0;jobs.push({from,to,duration,closing,step(p){if(!live.valid()){live.invalid();return}const h=revealValue(from,to,p);setHeight(h);setAlpha(live.alpha(h,p));live.paint(h,p);if(p===1)done()}})
 }
 const open=true;return {cancelHomeSearch,reverseLiveSearch,ownsLiveSearch}
 ` )({gURLBar:bar,matchMedia:()=>({matches:false}),getComputedStyle:()=>({opacity:String(alpha)}),console:{warn(){}}},token,bar,jobs,writes,attrs,h=>height=h,a=>alpha=a);
 assert.equal(api.cancelHomeSearch(),true);assert.deepEqual(writes,[]);
 assert.equal(jobs[0].duration,368);jobs[0].step(.5);assert.equal(height,228);
 assert.equal(api.reverseLiveSearch(),true);assert.equal(jobs[0].from,228);assert.equal(jobs[0].to,400);jobs[0].step(1);
 assert.equal(height,400);assert.equal(token.liveReturn,null);assert.ok(!writes.includes("native"));
 assert.equal(api.cancelHomeSearch(),true);jobs[0].step(1);assert.equal(writes.filter(x=>x==="native").length,1);assert.equal(token.liveReturn.phase,"commit");
 bar._zenHandleUrlbarClose=()=>{};assert.equal(api.ownsLiveSearch(token,bar),false);
});

test("Home external close restores only the original surface without forcing focus or closing a replacement session",()=>{
 const code=extract("  function settleNativeSearch(","  function move(");
 const calls=[],owner=()=>{},bar={_zenHandleUrlbarClose:owner};
 let nativeOpen=true;
 const api=new Function("win","bar","owner","calls","isOpen",code+`
 let open=true,searchClosing=false,searchToken=null,searchBar=bar,nativeCancelTab=null;
 function searchLog(event,data){calls.push([event,data.reason])}
 function settleLiveSearch(focus=false){calls.push(["settle",focus]);searchToken=null;searchBar=null;}
 function leaveHome(){calls.push(["leave"]);searchToken=null;}
 function nativeSearchOpen(){return isOpen()}
 function ownsLiveSearch(token,b){return b._zenHandleUrlbarClose===token.nativeClose&&isOpen()}
 return {reset(state=null){searchBar=bar;searchToken={id:7,nativeClose:owner,liveReturn:state};searchClosing=!!state;},observeSearch,onSearchClosed};
 `)({gURLBar:bar},bar,owner,calls,()=>nativeOpen);
 api.reset();api.onSearchClosed({detail:{closeSeq:6}});assert.deepEqual(calls,[]);
 api.onSearchClosed({detail:{closeSeq:7}});assert.deepEqual(calls.splice(0),[["native-settle","native-event"],["settle",false]]);
 api.reset();nativeOpen=false;api.observeSearch();assert.deepEqual(calls.splice(0),[["native-settle","native-observer"],["settle",false]]);
 nativeOpen=true;api.reset();bar._zenHandleUrlbarClose=()=>{};api.observeSearch();assert.deepEqual(calls.splice(0),[["native-settle","owner-changed"],["settle",false]]);
 bar._zenHandleUrlbarClose=owner;api.reset({phase:"commit"});api.onSearchClosed({detail:{closeSeq:7}});assert.deepEqual(calls.splice(0),[["settle",true]]);
 api.reset();api.onSearchClosed({detail:{closeSeq:7,onElementPicked:true}});assert.deepEqual(calls.splice(0),[["leave"]]);
 api.reset({phase:"fold"});bar._zenHandleUrlbarClose=()=>{};api.observeSearch();assert.deepEqual(calls.splice(0),[["native-settle","live-invalid"],["settle",false]]);
});
