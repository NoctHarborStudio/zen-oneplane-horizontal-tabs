// Closed tab identity is SessionStore's closedId, never a URL substitute.
  export function createClosedTabsService({getClosed,allowed=()=>true,observe=()=>()=>{},now=Date.now}){
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
