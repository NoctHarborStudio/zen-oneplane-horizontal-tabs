// PlacesQuery uses a Map of grouped visits or an array of search results.
  export function createHistorySession({createQuery,allowed=()=>true,onChange=()=>{},now=Date.now}){
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
      const fetchLimit=count+1;
      // Gecko PlacesQuery.searchHistory() reads cachedHistoryOptions.
      // getHistory() initializes the native cache for this range, limit and sort.
      const options={daysOld:range,limit:fetchLimit,sortBy:order};
      let result;
      if(term){
        await native.getHistory(options);
        if(closed||token!==epoch||!allowed())return null;
        result=await native.searchHistory(term,fetchLimit);
      }else result=await native.getHistory(options);
      if(closed||token!==epoch||!allowed())return null;
      const rows=[],seen=new Set();let rawCount=0;
      const groups=Array.isArray(result)?[[null,result]]:result instanceof Map?[...result]:[];
      for(const [group,items] of groups)for(const v of items){
        if(++rawCount>count)continue;
        const time=Number(v?.date);
        if(typeof v?.url!=="string"||!v.url||!Number.isFinite(time)||time<now()-range*86400000)continue;
        const id=String(v.guid??v.url)+"-"+time;
        if(seen.has(id))continue;seen.add(id);
        rows.push(Object.freeze({id,url:v.url,title:String(v.title||v.url),time,
          group:group==null?null:String(group),kind:"history",identity:"native-url-date"}));
      }
      return Object.freeze({rows:Object.freeze(rows),limit:count,hasMore:rawCount>count});
    }
    function close(){if(closed)return;closed=true;epoch++;native.close();}
    return {query,close};
  }
