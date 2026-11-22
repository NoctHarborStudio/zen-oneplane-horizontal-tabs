// One native list subscription per window, independent of any view.
  export function createDownloadsService({loadList,barrier=Promise.resolve(),lease=null,onError=()=>{},onDetach=()=>{},idPrefix="download",describeFile=()=>({}),dragFile=()=>false}){
    let dead=false,source=null,pending=null,detaching=null,ready=false,accepting=false,serial=0,bulkClearing=false;
    const records=new Map(),byId=new Map(),listeners=new Set(),nativeListeners=new Set(),removing=new Set(),removalTasks=new Set();
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
        exists:d.target?.exists!==false,clearable:clearable(d),kind:"download",...describeFile(d)});
    }
    function emit(kind,d){
      if(dead||!accepting)return;
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
    function releaseLease(){if(lease?.release===dispose)lease.release=null;}
    async function detach(){
      accepting=false;
      const list=source;
      if(!list){releaseLease();return true;}
      let released=false;
      // Gecko DownloadList.removeView deletes the exact view from a Set;
      // retrying this identity is safe even if an earlier attempt removed it.
      try{await list.removeView(view);released=true;source=null;releaseLease();}
      catch{report();}
      try{onDetach({released,retained:!released});}catch{}
      return released;
    }
    function start(){
      if(dead)return Promise.reject(Error("Downloads service disposed"));
      if(ready)return Promise.resolve();
      if(pending)return pending;
      pending=(async()=>{
        if(await barrier===false)throw Error("Previous Downloads detach unresolved");
        if(dead)throw Error("Downloads service disposed");
        // One stable per-window lease survives a failed detach and any number
        // of reloads. No second native view may attach until release succeeds.
        while(lease?.release&&lease.release!==dispose){
          if(!await lease.release())throw Error("Previous Downloads detach unresolved");
          if(dead)throw Error("Downloads service disposed");
        }
        if(source&&!await detach())throw Error("Downloads detach unresolved");
        if(dead)throw Error("Downloads service disposed");
        // Retrying our own failed acquisition releases the lease; another
        // generation may have claimed it during that await.
        while(lease?.release&&lease.release!==dispose){
          if(!await lease.release())throw Error("Previous Downloads detach unresolved");
          if(dead)throw Error("Downloads service disposed");
        }
        if(lease)lease.release=dispose;
        try{
          const list=await loadList();
          if(dead)throw Error("Downloads service disposed");
          if(typeof list?.addView!=="function"||typeof list?.removeView!=="function")throw Error("Native Downloads list unavailable");
          source=list;accepting=true;
          await list.addView(view);
          if(dead)throw Error("Downloads service disposed");
          ready=true;
        }catch(error){
          accepting=false;
          // Disposal owns the pending addView rollback when cancellation won.
          if(!dead)await detach();
          records.clear();byId.clear();throw error;
        }
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
        if(!clearable(d)||removing.has(d))return false;
        // One in-flight native removal per Download identity, regardless of
        // whether it was initiated by Dock, Library or a row action.
        removing.add(d);
        let task;
        try{
          // Retain the actual native Promise until it settles, including
          // across dispose and the next Sine service generation's barrier.
          task=Promise.resolve(source.remove(d));
          removalTasks.add(task);
          await task;return true;
        }finally{
          if(task)removalTasks.delete(task);
          removing.delete(d);
        }
      }
      if(!completed(d))return false;
      if(action==="open"&&d.target?.exists!==false&&typeof d.launch==="function"){await d.launch();return true;}
      if(action==="reveal"&&typeof d.showContainingDirectory==="function"){await d.showContainingDirectory();return true;}
      return false;
    }
    function action(id,kind){return actionNative(byId.get(id),kind);}
    function pathKeys(windows=false){return new Set([...records.keys()].filter(d=>completed(d)&&d.target?.exists!==false).map(d=>d.target?.path).filter(Boolean).map(p=>windows?String(p).replace(/\\/g,"/").toLowerCase():String(p)));}
    function withNative(id,fn){const d=byId.get(id);return !!(!dead&&ready&&d&&completed(d)&&typeof fn==="function"&&fn(d));}
    // The Dock receives native Download objects from this exact service view.
    // Library uses an opaque ID and the stricter non-private policy.
    function drag(id,event,node){const d=byId.get(id);return !!(!dead&&ready&&source&&d&&completed(d)&&d.target?.exists!==false&&dragFile(d,event,node,"library"));}
    function dragNative(d,event,node){return !!(!dead&&ready&&source&&records.has(d)&&completed(d)&&d.target?.exists!==false&&dragFile(d,event,node,"dock"));}
    async function clearCompleted(continueIf=()=>true){
      // Library and Dock are projections of one native list, not two bulk
      // removal owners. Reject an overlapping confirmation, never join it.
      if(dead||!ready||!source||bulkClearing)return null;
      bulkClearing=true;
      try{
        const targets=[...records.keys()].filter(clearable);let removed=0,skipped=0,failed=0;
        for(let i=0;i<targets.length;i++){
          // Dock supplies its existing epoch/teardown guard. A stale bulk
          // request never begins another native removal after invalidation.
          if(dead||!ready||!source||!continueIf()){skipped+=targets.length-i;break;}
          try{if(await actionNative(targets[i],"remove"))removed++;else skipped++;}
          catch{failed++;}
        }
        return {requested:targets.length,removed,skipped,failed};
      }finally{bulkClearing=false;}
    }
    function isReady(){return !dead&&ready;}
    function dispose(){
      if(detaching)return detaching;
      dead=true;ready=false;accepting=false;listeners.clear();nativeListeners.clear();records.clear();byId.clear();
      // A generation awaiting only a barrier or loadList owns no native
      // view. Its late continuation checks dead before addView. Do not make
      // a replacement wait for a read that can no longer attach anything.
      if(!source){releaseLease();return Promise.resolve(true);}
      // Native removals already issued must finish before releasing the
      // old view/lease to a replacement Sine generation. A hung native
      // remove intentionally blocks a second owner rather than duplicating
      // the same destructive operation.
      detaching=(async()=>{
        try{await pending;}catch{}
        await Promise.allSettled([...removalTasks]);
        return detach();
      })().finally(()=>{detaching=null;});
      return detaching;
    }
    return {start,subscribeNative,subscribe,getSnapshot,action,actionNative,pathKeys,withNative,drag,dragNative,clearCompleted,isReady,remove:d=>actionNative(d,"remove"),dispose};
  }
