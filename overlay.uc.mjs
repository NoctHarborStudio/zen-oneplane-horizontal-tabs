// Nocturne overlay arbitration. Window-local, synchronous handoff.
  function createOverlayCoordinator({nativeEscape=()=>false,onError=()=>{}}={}){
    const owners=new Map();let dead=false,requesting=false;
    const safe=(fn,fallback)=>{try{return fn();}catch(error){onError(error);return fallback;}};
    const active=entry=>safe(()=>!!entry.spec.isActive(),true);
    const ordered=()=>[...owners.values()].filter(active).sort((a,b)=>b.priority-a.priority);
    const current=()=>dead?null:ordered()[0]?.id??null;
    function register(id,spec){
      if(dead||!id||typeof spec?.isActive!=="function")return ()=>{};
      const entry={id,spec,priority:Number(spec.priority)||0};
      owners.set(id,entry);
      return ()=>{if(owners.get(id)===entry)owners.delete(id);};
    }
    function request(id,{passive=false}={}){
      if(dead||requesting||!owners.has(id))return false;
      const target=owners.get(id);
      const conflicts=ordered().filter(e=>e!==target);
      if(!conflicts.length)return true;
      if(passive)return false;
      // Validate every participant before changing any surface.
      if(conflicts.some(e=>typeof e.spec.yield!=="function"||!safe(()=>e.spec.canYield?.()!==false,false)))return false;
      requesting=true;
      try{
        for(const entry of conflicts){
          if(owners.get(entry.id)!==entry)continue;
          if(!safe(()=>entry.spec.yield({to:id})!==false,false)||active(entry))return false;
        }
        return !dead&&owners.get(id)===target&&!ordered().some(e=>e!==target);
      }finally{requesting=false;}
    }
    function allowsEscape(id,event){
      if(dead)return true;
      if(safe(()=>nativeEscape(event),true))return false;
      const owner=current();
      return owner===null||owner===id;
    }
    function dispatchEscape(event){
      if(dead||event.defaultPrevented||event.key!=="Escape"||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return false;
      if(safe(()=>nativeEscape(event),true))return false;
      const entry=ordered()[0];
      if(!entry||typeof entry.spec.onEscape!=="function")return false;
      const handled=safe(()=>entry.spec.onEscape(event)!==false,false);
      if(handled){event.preventDefault();event.stopImmediatePropagation();}
      return handled;
    }
    return {register,request,current,allowsEscape,dispatchEscape,dispose(){dead=true;owners.clear();}};
  }
/* Independent Sine entrypoint: do not depend on layout script order. */
(()=>{
  const win=window,doc=win.document,KEY="__nocturneOverlay";
  if(typeof win.addUnloadListener!=="function"||doc.documentElement.hasAttribute("popup-window"))return;
  win[KEY]?.dispose?.();
  function nativeEscape(event){
    // XUL popups belong to Gecko, not the overlay. Inspect only on Escape.
    if(event?.composedPath?.().some(n=>n?.localName==="menupopup"||n?.localName==="panel"))return true;
    for(const popup of doc.querySelectorAll("menupopup,panel")){
      if(popup.state==="open"||popup.state==="showing")return true;
    }
    return !!win.gURLBar?.hasAttribute?.("has-popup-open");
  }
  const core=createOverlayCoordinator({nativeEscape,onError:()=>win.console.warn("[Nocturne] overlay handoff failed")});
  let dead=false;
  const key=e=>core.dispatchEscape(e);
  function dispose(){
    if(dead)return;dead=true;
    win.removeEventListener("keydown",key,true);win.removeEventListener("unload",dispose);
    core.dispose();if(win[KEY]===api)delete win[KEY];
  }
  const api={...core,dispose};
  win[KEY]=api;win.addEventListener("keydown",key,true);win.addEventListener("unload",dispose,{once:true});win.addUnloadListener(dispose);
  // Late mounting and hot reload both rebind existing controllers.
  win.dispatchEvent(new win.CustomEvent("Nocturne:OverlayReady"));
})();
