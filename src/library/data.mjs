import {queryDownloadRows} from "../services/media-service.mjs";
// Own one bounded query session, reject stale results before rendering.
const MEDIA_SCAN_UI_DEADLINE_MS=15000;
const MEDIA_SCAN_SLOW_NOTICE="Local folder scan is still running. Downloaded files remain available.";
export function createLibraryData({getServices,onResult,onError,onNotice=()=>{},onScanWait=()=>{},schedule,cancel}){
  let section=null,source=null,session=null,off=null,timer=null,epoch=0,sessionEpoch=0,limit=50,text="",sort="new",filter="all",dead=false,media=null,mediaWork=null;
  const files=s=>["downloads","documents","pictures"].includes(s);
  function stop(){
    ++epoch;++sessionEpoch;if(timer!==null){cancel(timer);timer=null;}
    if(mediaWork){const old=mediaWork;mediaWork=null;if(old.timer!==null)cancel(old.timer);old.resolve(false);}
    try{off?.();}catch{}off=null;try{if(section==="history")session?.close();}catch{}
    try{media?.close();}catch{}media=null;session=null;source=null;section=null;limit=50;text="";sort="new";filter="all";
  }
  const current=(token,owner)=>!dead&&token===epoch&&source===owner&&getServices()===owner;
  async function load(){
    if(dead||!session||!source)return;
    const token=++epoch,owner=source;
    try{const result=await session.query(files(section)?{text,limit,sort,filter}:{text,limit});if(current(token,owner)&&result)onResult(result);}
    catch{if(current(token,owner))onError();}
  }
  function queue(throttle=false){
    if(throttle&&timer!==null)return;
    ++epoch;if(timer!==null)cancel(timer);
    timer=schedule(()=>{timer=null;void load();},160);
  }
  function immediate(){if(timer!==null)cancel(timer);timer=null;void load();}
  function refresh(){
    const owner=source,token=sessionEpoch,m=media;if(!m)return Promise.resolve(false);
    if(mediaWork){if(mediaWork.expired)onNotice(MEDIA_SCAN_SLOW_NOTICE);return mediaWork.promise;}
    const valid=()=>!dead&&sessionEpoch===token&&source===owner&&media===m&&getServices()===owner;
    let resolve;
    const promise=new Promise(done=>{resolve=done;});
    const work={promise,resolve,timer:null,expired:false};mediaWork=work;
    const release=()=>{
      if(work.timer!==null){cancel(work.timer);work.timer=null;}
      if(mediaWork===work)mediaWork=null;
    };
    // This deadline bounds only the UI wait. The Gecko native scan and the
    // MediaService disposal barrier retain ownership until real settlement.
    work.timer=schedule(()=>{
      work.timer=null;work.expired=true;
      if(valid()){onScanWait("deadline");onNotice(MEDIA_SCAN_SLOW_NOTICE);}
      resolve(false);
    },MEDIA_SCAN_UI_DEADLINE_MS);
    void Promise.resolve().then(()=>valid()?m.refresh():null).then(result=>{
      release();
      if(result===null||!valid()){resolve(false);return;}
      immediate();
      if(work.expired){onScanWait("late-complete");onNotice("",MEDIA_SCAN_SLOW_NOTICE);}
      resolve(true);
    },()=>{
      release();
      if(valid()){
        if(work.expired)onScanWait("late-error");
        onNotice("Local folders could not be scanned. Showing downloaded files.");
      }
      resolve(false);
    });
    return promise;
  }
  function start(next,query=""){
    stop();if(dead||!["history","closed","downloads","documents","pictures"].includes(next))return false;
    section=next;text=query;source=getServices();
    if(!source){onError();return false;}
    const owner=source,sessionToken=sessionEpoch;
    const valid=()=>!dead&&source===owner&&section===next&&sessionToken===sessionEpoch&&getServices()===owner;
    const changed=()=>{if(valid())queue(files(next));};
    if(files(next)){
      if(!owner.downloads){onError();return false;}
      void (async()=>{
        try{
          await owner.downloads.start();if(!valid())return;
          off=owner.downloads.subscribe(changed);
          session={query:args=>queryDownloadRows([...owner.downloads.getSnapshot(),...(media?.rows()||[])],{...args,section:next})};
          if(next!=="downloads")try{media=owner.openMedia?.(next)||null;}catch{onNotice("Local folders unavailable.");}
          immediate();if(media)void refresh();
        }catch{if(valid())onError();}
      })();
      return true;
    }
    try{
      if(next==="history")session=owner.openHistory(changed);
      else{session=owner.closedTabs;off=session.subscribe(changed);}
      void load();return true;
    }catch{stop();onError();return false;}
  }
  function search(query,now=false){
    if(!section)return;const next=String(query).slice(0,1024);
    if(next!==text){text=next;limit=50;}
    if(!session)return;if(now)immediate();else queue();
  }
  function options(nextSort,nextFilter){sort=nextSort;filter=nextFilter;limit=50;immediate();}
  function more(){if(!session||limit>=500)return false;limit=Math.min(500,limit+50);immediate();return true;}
  return {start,stop,search,options,more,refresh,retry:immediate,dispose(){stop();dead=true;}};
}
export function libraryWebURL(value){
  try{const u=new URL(value);return ["http:","https:"].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
export function libraryHistoryCommand(event){
  return !!event&&!event.defaultPrevented&&["Browser:ShowAllHistory","key_gotoHistory"].includes(event.target?.id);
}
export function libraryDownloadsCommand(event){
  return !!event&&!event.defaultPrevented&&["Tools:Downloads","key_openDownloads"].includes(event.target?.id);
}

export function libraryShortcutSection(event,os="WINNT"){
  if(!event||event.defaultPrevented||event.isComposing||event.repeat||event.altKey||event.shiftKey)return null;
  if(os==="Darwin"?(!event.metaKey||event.ctrlKey):(!event.ctrlKey||event.metaKey))return null;
  const key=String(event.key||"").toLowerCase();
  // Native Zen shortcuts can remain bound to a physical key while Gecko's
  // event.key changes with the active keyboard layout (e.g. Cyrillic).
  if(key==="h")return "history";
  if(key==="j")return "downloads";
  return event.code==="KeyH"?"history":event.code==="KeyJ"?"downloads":null;
}
