// One native list subscription per window, independent of any view.
  function createDownloadsService({loadList,barrier=Promise.resolve(),onError=()=>{},idPrefix="download"}){
    let dead=false,source=null,pending=null,detaching=null,ready=false,serial=0;
    const records=new Map(),byId=new Map(),listeners=new Set(),nativeListeners=new Set();
    const report=()=>{try{onError();}catch{}};
    const safe=(fn,...args)=>{try{fn(...args);}catch{report();}};
    const number=n=>Number.isFinite(n)?Math.max(0,n):0;
    const clearable=d=>!!(d.stopped&&!d.hasPartialData&&!d.hasBlockedData);
    const completed=d=>!!(d.succeeded&&!d.error&&!d.canceled&&!d.hasPartialData&&!d.hasBlockedData);
    function normalize(d,id){
      return Object.freeze({id,name:String(d.target?.path||"").split(/[\\/]/).pop()||"Download",
        time:number(Number(d.startTime)),bytes:number(d.currentBytes),total:number(d.totalBytes),speed:number(d.speed),
        known:!!d.hasProgress&&number(d.totalBytes)>0,active:!d.stopped&&!d.succeeded&&!d.error&&!d.canceled,
        success:!!d.succeeded,failed:!!d.error,canceled:!!d.canceled,partial:!!d.hasPartialData,blocked:!!d.hasBlockedData,
        exists:d.target?.exists!==false,clearable:clearable(d)});
    }
    function emit(kind,d){
      if(dead)return;
      let rec=records.get(d);
      if(kind==="onDownloadRemoved"){
        if(!rec)return;
        records.delete(d);byId.delete(rec.id);
      }else{
        if(!rec){rec={id:idPrefix+"-"+(++serial),value:null};records.set(d,rec);byId.set(rec.id,d);}
        rec.value=normalize(d,rec.id);
      }
      if(!ready)return;
      for(const l of [...nativeListeners])if(nativeListeners.has(l))safe(l[kind]||(()=>{}),d);
      for(const fn of [...listeners])if(listeners.has(fn))safe(fn,{type:kind,id:rec.id});
    }
    const view={onDownloadAdded:d=>emit("onDownloadAdded",d),onDownloadChanged:d=>emit("onDownloadChanged",d),onDownloadRemoved:d=>emit("onDownloadRemoved",d)};
    async function detach(){
      const list=source;source=null;
      if(list)try{await list.removeView(view);}catch{report();}
    }
    function start(){
      if(dead)return Promise.reject(Error("Downloads service disposed"));
      if(ready)return Promise.resolve();
      if(pending)return pending;
      pending=(async()=>{
        await barrier;
        if(dead)throw Error("Downloads service disposed");
        source=await loadList();
        if(dead){source=null;throw Error("Downloads service disposed");}
        try{await source.addView(view);}
        catch(error){await detach();records.clear();byId.clear();throw error;}
        if(dead)throw Error("Downloads service disposed");
        ready=true;
      })().finally(()=>{pending=null;});
      return pending;
    }
    function subscribeNative(observer){
      if(dead||!ready)throw Error("Downloads service not ready");
      nativeListeners.add(observer);
      // Initial replay is synchronous, exactly once per subscriber.
      // The Dock's hydration guard suppresses historical notifications.
      for(const d of [...records.keys()])if(nativeListeners.has(observer))safe(observer.onDownloadAdded||(()=>{}),d);
      return ()=>nativeListeners.delete(observer);
    }
    function subscribe(fn){
      if(dead||!ready)throw Error("Downloads service not ready");
      listeners.add(fn);return ()=>listeners.delete(fn);
    }
    function getSnapshot(){
      if(dead||!ready)return Object.freeze([]);
      return Object.freeze([...records.values()].map(r=>r.value));
    }
    async function actionNative(d,action){
      if(dead||!ready||!source||!records.has(d))return false;
      if(action==="remove"){
        if(!clearable(d))return false;
        await source.remove(d);return true;
      }
      if(!completed(d))return false;
      if(action==="open"&&d.target?.exists!==false&&typeof d.launch==="function"){await d.launch();return true;}
      if(action==="reveal"&&typeof d.showContainingDirectory==="function"){await d.showContainingDirectory();return true;}
      return false;
    }
    function action(id,kind){return actionNative(byId.get(id),kind);}
    function dispose(){
      if(detaching)return detaching;
      dead=true;ready=false;listeners.clear();nativeListeners.clear();records.clear();byId.clear();
      // Finish an in-flight native addView before removing it. A replacement
      // instance waits for this barrier, so two views cannot overlap.
      detaching=(async()=>{try{await pending;}catch{}await detach();})();
      return detaching;
    }
    return {start,subscribeNative,subscribe,getSnapshot,action,actionNative,remove:d=>actionNative(d,"remove"),dispose};
  }
// PlacesQuery uses a Map of grouped visits or an array of search results.
  function createHistorySession({createQuery,allowed=()=>true,onChange=()=>{},now=Date.now}){
    if(!allowed())throw Error("History unavailable in this window");
    const native=createQuery();let closed=false,epoch=0;
    if(typeof native?.getHistory!=="function"||typeof native.searchHistory!=="function"||typeof native.close!=="function"){
      native?.close?.();throw Error("PlacesQuery unavailable");
    }
    try{native.observeHistory?.(()=>{if(!closed&&allowed())onChange();});}catch(error){native.close();throw error;}
    async function query({text="",days=120,limit=100,sort="date"}={}){
      if(closed||!allowed())throw Error("History session unavailable");
      const token=++epoch,term=String(text).trim().slice(0,1024);
      const count=Math.min(5000,Math.max(1,Math.trunc(Number(limit)||100)));
      const range=Math.min(36500,Math.max(1,Math.trunc(Number(days)||120)));
      const order=["date","site","lastvisited"].includes(sort)?sort:"date";
      const result=term?await native.searchHistory(term,count):await native.getHistory({daysOld:range,limit:count,sortBy:order});
      if(closed||token!==epoch||!allowed())return null;
      const rows=[],seen=new Set();let rawCount=0;
      const groups=Array.isArray(result)?[[null,result]]:result instanceof Map?[...result]:[];
      for(const [group,items] of groups)for(const v of items){
        rawCount++;
        const time=Number(v?.date);
        if(typeof v?.url!=="string"||!v.url||!Number.isFinite(time)||time<now()-range*86400000)continue;
        const id=String(v.guid??v.url)+"-"+time;
        if(seen.has(id))continue;seen.add(id);
        rows.push(Object.freeze({id,url:v.url,title:String(v.title||v.url),time,
          group:group==null?null:String(group),kind:"history",identity:"native-url-date"}));
      }
      return Object.freeze({rows:Object.freeze(rows),limit:count,hasMore:rawCount>=count});
    }
    function close(){if(closed)return;closed=true;epoch++;native.close();}
    return {query,close};
  }
// Closed tab identity is SessionStore's closedId, never a URL substitute.
  function createClosedTabsService({getClosed,allowed=()=>true,observe=()=>()=>{},now=Date.now}){
    let dead=false;const subscriptions=new Set();
    function query({text="",days=120,limit=100}={}){
      if(dead||!allowed())throw Error("Closed tabs unavailable in this window");
      const term=String(text).trim().toLowerCase().slice(0,1024),range=Math.min(36500,Math.max(1,Math.trunc(Number(days)||120)));
      const count=Math.min(5000,Math.max(1,Math.trunc(Number(limit)||100))),rows=[];
      for(const tab of getClosed()){
        const entry=tab.state?.entries?.[tab.state.index-1],time=Number(tab.closedAt);
        if(!entry?.url||tab.closedId==null||!Number.isFinite(time)||time<now()-range*86400000)continue;
        const title=String(tab.title||entry.title||entry.url);
        if(term&&!((title+" "+entry.url).toLowerCase().includes(term)))continue;
        rows.push(Object.freeze({id:"closed-"+tab.closedId,closedId:tab.closedId,url:entry.url,title,time,kind:"closed"}));
      }
      rows.sort((a,b)=>b.time-a.time);
      return Object.freeze({rows:Object.freeze(rows.slice(0,count)),limit:count,hasMore:rows.length>count});
    }
    function subscribe(fn){
      if(dead||!allowed())throw Error("Closed tabs unavailable in this window");
      const off=observe(()=>{if(!dead&&allowed())fn();});
      let active=true;const release=()=>{if(!active)return;active=false;subscriptions.delete(release);off();};
      subscriptions.add(release);return release;
    }
    function dispose(){if(dead)return;dead=true;for(const off of [...subscriptions])off();}
    return {query,subscribe,dispose};
  }
/* Independent native data owner. No UI, commands, scans or disk cache. */
(()=>{
  const win=window,KEY="__nocturneLibraryServices";
  if(typeof win.addUnloadListener!=="function"||win.document.documentElement.hasAttribute("popup-window"))return;
  const BARRIER="__nocturneDownloadsDisposal";
  const previous=win[KEY],barrier=previous?.dispose?.()||win[BARRIER]||Promise.resolve();
  let dead=false,closing=null,historySessions=new Set();
  const load=(path,key)=>ChromeUtils.importESModule(path)[key];
  const privateWindow=()=>load("resource://gre/modules/PrivateBrowsingUtils.sys.mjs","PrivateBrowsingUtils").isWindowPrivate(win);
  const allowed=()=>!dead&&!win.closed&&!privateWindow();
  const downloads=createDownloadsService({barrier,idPrefix:"download-"+(win.crypto?.randomUUID?.()||String(win.performance.now())),loadList:()=>{
    const D=win.Downloads||load("resource://gre/modules/Downloads.sys.mjs","Downloads");
    return D.getList(privateWindow()?D.PRIVATE:D.PUBLIC);
  },onError:()=>win.console.warn("[Nocturne] Downloads service listener failed")});
  const closedTabs=createClosedTabsService({allowed,getClosed:()=>load("moz-src:///browser/components/sessionstore/SessionStore.sys.mjs","SessionStore").getClosedTabData({sourceWindow:win}),
    observe(fn){const topic="sessionstore-closed-objects-changed",observer={observe:fn};Services.obs.addObserver(observer,topic);return()=>Services.obs.removeObserver(observer,topic);}});
  function openHistory(onChange){
    const session=createHistorySession({allowed,onChange,createQuery:()=>{
      const PlacesQuery=load("resource://gre/modules/PlacesQuery.sys.mjs","PlacesQuery");return new PlacesQuery();
    }});
    let closed=false;
    const handle={query:session.query,close(){if(closed)return;closed=true;historySessions.delete(handle);session.close();}};
    historySessions.add(handle);return handle;
  }
  function dispose(){
    if(closing)return closing;
    dead=true;
    win.removeEventListener("unload",dispose);
    for(const s of [...historySessions])try{s.close();}catch{}
    try{closedTabs.dispose();}catch{}
    closing=downloads.dispose();win[BARRIER]=closing;
    closing.finally(()=>{if(win[BARRIER]===closing)delete win[BARRIER];});
    if(win[KEY]===api){delete win[KEY];win.dispatchEvent(new win.CustomEvent("Nocturne:ServicesGone"));}
    return closing;
  }
  const api={downloads,openHistory,closedTabs,dispose};
  win[KEY]=api;win.addUnloadListener(dispose);win.addEventListener("unload",dispose,{once:true});
  win.dispatchEvent(new win.CustomEvent("Nocturne:ServicesReady"));
})();
