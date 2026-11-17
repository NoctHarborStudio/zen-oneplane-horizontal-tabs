// Nocturne overlay arbitration. Window-local, synchronous handoff.
  export function createOverlayCoordinator({nativeEscape=()=>false,onError=()=>{}}={}){
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
