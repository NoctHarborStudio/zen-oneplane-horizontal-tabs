// Own one bounded query session, reject stale results before rendering.
export function createLibraryData({getServices,onResult,onError,schedule,cancel}){
  let section=null,source=null,session=null,off=null,timer=null,epoch=0,sessionEpoch=0,limit=50,text="",dead=false;
  function stop(){
    ++epoch;++sessionEpoch;if(timer!==null){cancel(timer);timer=null;}
    try{off?.();}catch{}off=null;try{if(section==="history")session?.close();}catch{}session=null;source=null;section=null;limit=50;text="";
  }
  const current=(token,owner)=>!dead&&token===epoch&&source===owner&&getServices()===owner;
  async function load(){
    if(dead||!session||!source)return;
    const token=++epoch,owner=source;
    try{const result=await session.query({text,limit});if(current(token,owner)&&result)onResult(result);}
    catch{if(current(token,owner))onError();}
  }
  function queue(){
    ++epoch;if(timer!==null)cancel(timer);
    timer=schedule(()=>{timer=null;void load();},160);
  }
  function start(next,query=""){
    stop();if(dead||!["history","closed"].includes(next))return false;
    section=next;text=query;source=getServices();
    if(!source){onError();return false;}
    try{
      const owner=source,sessionToken=sessionEpoch;
      const changed=()=>{if(!dead&&source===owner&&section===next&&sessionToken===sessionEpoch)queue();};
      if(next==="history")session=owner.openHistory(changed);
      else{session=owner.closedTabs;off=session.subscribe(changed);}
      void load();return true;
    }catch{stop();onError();return false;}
  }
  function immediate(){if(timer!==null)cancel(timer);timer=null;void load();}
  function search(query,now=false){
    if(!session)return;const next=String(query).slice(0,1024);
    if(next!==text){text=next;limit=50;}
    if(now)immediate();else queue();
  }
  function more(){if(!session||limit>=500)return false;limit=Math.min(500,limit+50);immediate();return true;}
  return {start,stop,search,more,retry:immediate,dispose(){stop();dead=true;}};
}
export function libraryWebURL(value){
  try{const u=new URL(value);return ["http:","https:"].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
export function libraryHistoryCommand(event){
  return !!event&&!event.defaultPrevented&&["Browser:ShowAllHistory","key_gotoHistory"].includes(event.target?.id);
}
