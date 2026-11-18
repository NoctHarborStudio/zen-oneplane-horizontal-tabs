import { createDisposableScope } from "../core/disposable-scope.mjs";
// Closed tab identity is SessionStore's closedId, never a URL substitute.
  export function createClosedTabsService({getClosed,restoreNative,forgetNative,allowed=()=>true,observe=()=>()=>{},now=Date.now,onError=()=>{}}){
    let dead=false;const subscriptions=createDisposableScope({onError});
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
    function restore(id,{background=false}={}){
      if(dead||!allowed()||typeof restoreNative!=="function")return false;
      if(!getClosed().some(tab=>tab.closedId===id))return false;
      return restoreNative(id,!!background)!==false;
    }
    function forget(id){if(dead||!allowed()||typeof forgetNative!=="function"||!getClosed().some(tab=>tab.closedId===id))return false;return forgetNative(id)!==false;}
    function subscribe(fn){
      if(dead||!allowed())throw Error("Closed tabs unavailable in this window");
      let active=true,notify=fn;
      // A consumer exception must not abort native registration before
      // the removal handle is returned.
      const report=error=>{try{onError("closed-tabs-callback",error);}catch{}};
      const off=observe(()=>{if(active&&!dead&&allowed()&&notify)try{notify();}catch(error){report(error);}});
      return subscriptions.defer("closed-tabs-observer",()=>{active=false;notify=null;off();});
    }
    function dispose(){dead=true;return subscriptions.dispose();}
    return {query,subscribe,restore,forget,dispose};
  }
