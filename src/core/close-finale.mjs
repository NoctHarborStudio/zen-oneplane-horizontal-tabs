// Experimental whole-window alpha; CSS fade remains the unsupported/error path.
import {createNocturneBrandMark} from "./boot-brand.mjs";
export const CLOSE_COVER_MS=320,CLOSE_LOGO_MS=460,CLOSE_FADE_MS=500;
const LAYERED=0x80000,NO_REDIRECTION=0x200000,CLASS_DC=0x60;
export function closeWindowAlpha(t){
  t=Math.max(0,Math.min(1,t));
  if(t===0)return 255;if(t===1)return 0;
  const b=(u,a,c)=>3*(1-u)*(1-u)*u*a+3*(1-u)*u*u*c+u*u*u;
  let l=0,r=1;
  for(let i=0;i<18;i++){const m=(l+r)/2;if(b(m,.42,.58)<t)l=m;else r=m;}
  return Math.round(255*(1-b((l+r)/2,0,1)));
}
// An exact-window, single-use lease. No changes to the backdrop, class style,
// focus, geometry, hit-testing style or global prefs. Never log HWND/paths.
export function createLayeredWindowLease(api){
  let owns=false,closed=false,busy=0,retire=null,lastAlpha=null,failed=0;
  const releaseNow=commit=>{
    if(closed)return failed;closed=true;
    if(!commit&&owns){
      try{
        if(api.valid()){
          const style=api.style();
          if(style&LAYERED){
            // Keep unrelated extended style bits; this lease never adopts
            // a window that was layered before acquisition.
            try{api.alpha(255);}catch{}
            api.setStyle(style&~LAYERED);
            if(api.style()&LAYERED)failed++;
          }
        }
      }catch{failed++;}
    }
    try{api.close();}catch{failed++;}
    return failed;
  };
  const retireLease=commit=>{
    if(busy){retire=retire===false?false:commit;return 0;}
    return releaseNow(commit);
  };
  const use=fn=>{
    if(closed||retire!==null)return false;
    busy++;
    try{return fn();}catch{return false;}
    finally{if(--busy===0&&retire!==null)releaseNow(retire);}
  };
  return {
    acquire:()=>use(()=>{
      if(!api.valid())return false;
      const style=api.style(),classStyle=api.classStyle();
      if(!Number.isInteger(style)||!Number.isInteger(classStyle)||
         (style&(LAYERED|NO_REDIRECTION))||(classStyle&CLASS_DC))return false;
      // Claim before calling User32, which may dispatch messages synchronously.
      owns=true;api.setStyle(style|LAYERED);
      if(retire!==null||!api.valid()||!(api.style()&LAYERED))return false;
      if(!api.alpha(255))return false;
      lastAlpha=255;return api.readAlpha()===255;
    }),
    set:alpha=>use(()=>{
      if(!owns||!Number.isInteger(alpha)||alpha<0||alpha>255||
         !api.valid()||!(api.style()&LAYERED))return false;
      if(alpha===lastAlpha)return true;
      if(!api.alpha(alpha))return false;
      lastAlpha=alpha;return true;
    }),
    read:()=>{try{return !closed&&api.valid()?api.readAlpha():null;}catch{return null;}},
    release:()=>retireLease(false),commit:()=>retireLease(true)
  };
}
export function createWindowsWindowAlpha({win,services,interfaces,loadCtypes}){
  const nativeHandle=()=>{
    if(win.closed)return null;
    const owner=win.docShell.treeOwner;
    let base;
    try{base=owner.QueryInterface(interfaces.nsIBaseWindow);}
    catch{base=owner.QueryInterface(interfaces.nsIInterfaceRequestor).getInterface(interfaces.nsIBaseWindow);}
    const value=base.nativeHandle;
    return typeof value==="string"&&/^0x[0-9a-f]+$/i.test(value)&&!/^0x0+$/i.test(value)?value:null;
  };
  const handle=nativeHandle();if(!handle)return null;
  const c=loadCtypes(),hwnd=c.voidptr_t(c.UInt64(handle));
  if(hwnd.isNull())return null;
  const file=services.dirsvc.get("SysD",interfaces.nsIFile).clone();file.append("user32.dll");
  const lib=c.open(file.path);
  try{
    const declare=(name,ret,...args)=>lib.declare(name,c.winapi_abi,ret,c.voidptr_t,...args);
    const get=declare("GetWindowLongW",c.int32_t,c.int32_t);
    const set=declare("SetWindowLongW",c.int32_t,c.int32_t,c.int32_t);
    const cls=declare("GetClassLongW",c.uint32_t,c.int32_t);
    const alpha=declare("SetLayeredWindowAttributes",c.int32_t,c.uint32_t,c.uint8_t,c.uint32_t);
    const read=declare("GetLayeredWindowAttributes",c.int32_t,c.uint32_t.ptr,c.uint8_t.ptr,c.uint32_t.ptr);
    return createLayeredWindowLease({
      valid:()=>nativeHandle()===handle,
      style:()=>{const v=get(hwnd,-20);return v===0?null:v;},
      classStyle:()=>{const v=cls(hwnd,-26);return v===0?null:v;},
      setStyle:value=>set(hwnd,-20,value),
      alpha:value=>!!alpha(hwnd,0,value,2),
      readAlpha:()=>{
        const a=c.uint8_t(),flags=c.uint32_t(),key=c.uint32_t();
        return read(hwnd,key.address(),a.address(),flags.address())&&flags.value===2?a.value:null;
      },
      close:()=>lib.close()
    });
  }catch(e){lib.close();throw e;}
}
export function createCloseFinale({win,doc,root,start,onModal,windows=false,nativeFactory=null}){
  let cover=null,mark=null,active=true,listening=false,sealed=false,frame=null,native=null;
  let rootFade=null,epoch=null,fadeAt=0,end=0,frames=0,lastAlpha=255;
  const trace=(event,data)=>{try{win.__nocturneTrace?.(event,data,{flush:true});}catch{}};
  const effects=[];
  const animate=(node,keyframes,delay,duration,easing)=>{
    const effect=node.animate(keyframes,{delay,duration,easing,fill:"both"});
    effects.push(effect);effect.finished.catch(()=>{});
    if(Number.isFinite(epoch))effect.startTime=epoch;
    return effect;
  };
  const cssFade=()=>animate(root,[{opacity:1},{opacity:0}],fadeAt,CLOSE_FADE_MS,"ease-in-out");
  const stopFrame=()=>{const id=frame;frame=null;if(id!==null)try{win.cancelAnimationFrame(id);}catch{}};
  const dropNative=commit=>{
    const lease=native;native=null;if(!lease)return 0;
    let failed=0;try{failed=(commit?lease.commit():lease.release())||0;}catch{failed=1;}
    trace("disassembly.alpha.release",{committed:commit,failed});return failed;
  };
  const fallback=()=>{
    dropNative(false);
    if(active&&!rootFade){try{rootFade=cssFade();}catch{}}
    trace("disassembly.alpha.fallback",{frames,lastAlpha});
  };
  const release=()=>{
    if(!active)return 0;active=false;let failed=0;
    const step=fn=>{try{fn();}catch{failed++;}};
    stopFrame();
    if(listening)step(()=>win.removeEventListener("DOMWillOpenModalDialog",onModal,true));
    listening=false;
    // Restore native alpha before removing the opaque cover in the same task.
    failed+=dropNative(!!win.closed);
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
    epoch=doc.timeline.currentTime;
    const coverEffect=animate(cover,[{opacity:0},{opacity:1}],start,CLOSE_COVER_MS,"ease-in-out");
    const logoAt=start+CLOSE_COVER_MS;fadeAt=logoAt+CLOSE_LOGO_MS;end=fadeAt+CLOSE_FADE_MS;
    const logoEffect=animate(mark,[{opacity:0,transform:"translateY(7px) scale(.96)"},{opacity:1,transform:"translateY(0) scale(1)"}],logoAt,CLOSE_LOGO_MS,"cubic-bezier(.2,.75,.25,1)");
    rootFade=cssFade();
    const elapsed=()=>doc.timeline.currentTime-epoch;
    const queue=fn=>{frame=win.requestAnimationFrame(()=>{frame=null;if(active&&!sealed)fn();});};
    const allowed=()=>active&&!sealed&&!win.closed&&Number.isFinite(doc.timeline.currentTime);
    const tick=()=>{
      if(!allowed()||!native)return;
      const value=closeWindowAlpha((elapsed()-fadeAt)/CLOSE_FADE_MS);
      const lease=native;
      if(!lease.set(value)){if(active&&native===lease)fallback();return;}
      if(!active||sealed||native!==lease)return;
      frames++;lastAlpha=value;
      if(value!==0&&elapsed()<end){try{queue(tick);}catch{fallback();}}
      else trace("disassembly.alpha.end",{frames,alpha:value,read:lease.read()});
    };
    if(windows&&nativeFactory&&Number.isFinite(epoch)){
      const prepare=()=>{
        if(!allowed()||elapsed()>fadeAt-100||Number(win.getComputedStyle(root).opacity)!==1||
           Number(win.getComputedStyle(cover).opacity)!==1)return;
        let lease;
        try{lease=nativeFactory();}catch{}
        if(!allowed()){try{lease?.release();}catch{}return;}
        native=lease||null;
        let acquired=false;try{acquired=!!lease?.acquire();}catch{}
        if(!active||sealed||native!==lease){try{lease?.release();}catch{}return;}
        trace("disassembly.alpha.acquire",{acquired,available:!!lease,read:lease?.read()??null});
        if(!acquired){dropNative(false);return;}
        try{rootFade.cancel();effects.splice(effects.indexOf(rootFade),1);rootFade=null;}catch{fallback();return;}
        // No animation frame loop until the logo interval ends.
        logoEffect.finished.then(()=>{if(allowed()&&native===lease){try{queue(tick);}catch{fallback();}}},()=>{});
      };
      coverEffect.finished.then(()=>{
        if(!allowed())return;
        try{queue(()=>{try{queue(prepare);}catch{}});}catch{}
      },()=>{});
    }
    return {end,logoAt,fadeAt,release,
      commit(){stopFrame();dropNative(true);},
      seal(){
        if(!active)return null;
        sealed=true;stopFrame();
        if(native){
          const lease=native;
          let ok=false;try{ok=lease.set(0)&&lease.read()===0;}catch{}
          if(!active)return null;
          trace("disassembly.alpha.seal",{confirmed:ok,frames,alpha:ok?0:lastAlpha});
          if(!ok&&native===lease)fallback();
        }
        for(const effect of effects)try{effect.finish();}catch{}
        // A cancelled root fade must not be finished again on native path.
        const read=node=>{try{const a=Number(win.getComputedStyle(node).opacity);return Number.isFinite(a)?a:null;}catch{return null;}};
        return {rootOpacity:read(root),coverOpacity:read(cover),logoOpacity:read(mark)};
      }};
  }catch{release();return null;}
}
