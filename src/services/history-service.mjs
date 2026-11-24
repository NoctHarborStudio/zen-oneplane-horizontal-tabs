// PlacesQuery uses a Map of grouped visits or an array of search results.
  export function createHistorySession({createQuery,allowed=()=>true,onChange=()=>{},now=Date.now}){
    if(!allowed())throw Error("History unavailable in this window");
    const native=createQuery();let closed=false,epoch=0;
    if(typeof native?.getHistory!=="function"||typeof native.searchHistory!=="function"||typeof native.close!=="function"){
      native?.close?.();throw Error("PlacesQuery unavailable");
    }
    try{native.observeHistory?.(()=>{if(!closed&&allowed())onChange();});}catch(error){native.close();throw error;}
    async function query({text="",days=120,limit=100,sort="date",period="all"}={}){
      if(closed||!allowed())throw Error("History session unavailable");
      const token=++epoch,term=String(text).trim().slice(0,1024);
      const count=Math.min(5000,Math.max(1,Math.trunc(Number(limit)||100)));
      let range=Math.min(36500,Math.max(1,Math.trunc(Number(days)||120)));
      const today=new Date(now());today.setHours(0,0,0,0);
      let start=null;
      if(period==="today")start=today;
      else if(period==="week"){start=new Date(today);start.setDate(start.getDate()-((start.getDay()+6)%7));}
      else if(period==="month"){start=new Date(today);start.setDate(1);}
      if(start)range=Math.max(1,Math.ceil((now()-start.getTime())/86400000));
      const order=["date","site","lastvisited","mostvisited"].includes(sort)?sort:"date";
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
      const rows=[],seen=new Set();let rawCount=0;const cutoff=start?start.getTime():now()-range*86400000;
      // PlacesQuery is loaded in a different Gecko global; instanceof Map is realm-specific.
       // Native date/site groups are iterable, while flat native search results are arrays.
       const groups=Array.isArray(result)?[[null,result]]:result&&typeof result[Symbol.iterator]==="function"?result:[];
      for(const [group,items] of groups)for(const v of items){
        if(++rawCount>count)continue;
        const time=Number(v?.date);
        if(typeof v?.url!=="string"||!v.url||!Number.isFinite(time)||time<cutoff)continue;
        const id=String(v.guid??v.url)+"-"+time;
        if(seen.has(id))continue;seen.add(id);
        rows.push(Object.freeze({id,url:v.url,title:String(v.title||v.url),time,
          group:group==null?null:String(group),kind:"history",identity:"native-url-date"}));
      }
      let hasMore=rawCount>count;
      if(hasMore&&term&&order==="date"&&Array.isArray(result)){
        // PlacesQuery's date search is newest-first. If the lookahead
        // already predates the configured range, no later result can
        // be eligible. Retain conservative pagination for other sorts.
        const lookahead=Number(result[count]?.date);
        if(result[count]?.date!=null&&Number.isFinite(lookahead)&&lookahead<cutoff)hasMore=false;
      }
      return Object.freeze({rows:Object.freeze(rows),limit:count,hasMore});
    }
    function close(){if(closed)return;closed=true;epoch++;native.close();}
    return {query,close};
  }
