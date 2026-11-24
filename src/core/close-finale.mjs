// Experimental chrome-root fade. CSS opacity is not proof of OS-window alpha.
import {createNocturneBrandMark} from "./boot-brand.mjs";
export const CLOSE_COVER_MS=320,CLOSE_LOGO_MS=460,CLOSE_FADE_MS=500;
export function createCloseFinale({win,doc,root,start,onModal}){
  let cover=null,mark=null,active=true,listening=false;
  const effects=[];
  const release=()=>{
    if(!active)return 0;active=false;let failed=0;
    const step=fn=>{try{fn();}catch{failed++;}};
    if(listening)step(()=>win.removeEventListener("DOMWillOpenModalDialog",onModal,true));
    listening=false;
    // Remove the opaque cover before releasing the root's fade in one task.
    step(()=>cover?.remove());
    for(const effect of effects)step(()=>effect.cancel());
    effects.length=0;cover=null;mark=null;return failed;
  };
  try{
    if(!Number.isFinite(start)||start<0||Number(win.getComputedStyle(root).opacity)!==1)return null;
    win.addEventListener("DOMWillOpenModalDialog",onModal,true);listening=true;
    cover=doc.createElementNS("http://www.w3.org/1999/xhtml","div");
    cover.id="nocturne-close-brand";cover.inert=true;cover.setAttribute("aria-hidden","true");
    Object.assign(cover.style,{position:"fixed",inset:"0",zIndex:"2147483647",display:"grid",placeItems:"center",background:"#111219",color:"#e4e5ef",pointerEvents:"none",overflow:"hidden",opacity:"0"});
    cover.style.setProperty("-moz-window-dragging","default","important");
    mark=createNocturneBrandMark(doc);mark.style.opacity="0";cover.append(mark);root.append(cover);
    const epoch=doc.timeline.currentTime;
    const animate=(node,frames,delay,duration,easing)=>{
      const effect=node.animate(frames,{delay,duration,easing,fill:"both"});
      effects.push(effect);effect.finished.catch(()=>{});
      if(Number.isFinite(epoch))effect.startTime=epoch;
    };
    animate(cover,[{opacity:0},{opacity:1}],start,CLOSE_COVER_MS,"ease-in-out");
    const logoAt=start+CLOSE_COVER_MS,fadeAt=logoAt+CLOSE_LOGO_MS,end=fadeAt+CLOSE_FADE_MS;
    animate(mark,[{opacity:0,transform:"translateY(7px) scale(.96)"},{opacity:1,transform:"translateY(0) scale(1)"}],logoAt,CLOSE_LOGO_MS,"cubic-bezier(.2,.75,.25,1)");
    animate(root,[{opacity:1},{opacity:0}],fadeAt,CLOSE_FADE_MS,"ease-in-out");
    return {end,logoAt,fadeAt,release,
      seal(){
        if(!active)return null;
        for(const effect of effects)try{effect.finish();}catch{}
        const read=node=>{try{const a=Number(win.getComputedStyle(node).opacity);return Number.isFinite(a)?a:null;}catch{return null;}};
        return {rootOpacity:read(root),coverOpacity:read(cover),logoOpacity:read(mark)};
      }};
  }catch{release();return null;}
}
