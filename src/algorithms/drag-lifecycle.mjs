  // One owner/token per window, invalidated before callbacks run. A late
  // pointerup, dragend or timeout cannot complete a cancelled/new gesture.
  export function createDragLifecycle(){
    let active=null,sequence=0;
    return {
      current:()=>active,
      begin(kind,handlers={}){
        if(active) return null;
        const token=++sequence;
        active={...handlers,kind,token};return token;
      },
      owns(token,kind){return !!active&&active.token===token&&(!kind||active.kind===kind);},
      finish(token){
        if(!active||active.token!==token)return false;
        active=null;return true;
      },
      cancel(reason,token=active?.token){
        if(!active||active.token!==token)return false;
        const previous=active;active=null;previous.onCancel?.(reason);return true;
      }
    };
  }
  export function dragPointerSignal(event,pointerId){
    if(event.pointerId!==pointerId)return "ignore";
    if(event.type==="pointercancel"||event.type==="lostpointercapture")return "cancel";
    if(event.type==="pointerup")return event.button===0?"drop":"cancel";
    if(event.type==="pointermove"&&!(event.buttons&1))return "cancel";
    return event.type==="pointermove"?"move":"ignore";
  }
  export function dragInterruptionKey(event){
    return event.key==="Escape"||event.key==="PrintScreen"||
      ((event.metaKey||event.osKey)&&event.shiftKey&&String(event.key).toLowerCase()==="s");
  }
  export function dragEndMatches(identity,event,tab){
    return !!identity&&identity.target===event?.target&&identity.tab===tab;
  }
