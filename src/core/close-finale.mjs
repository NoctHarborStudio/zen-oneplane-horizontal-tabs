// Experimental chrome-root fade. CSS opacity is not proof of OS-window alpha.
import {createNocturneBrandMark} from "./boot-brand.mjs";
export const CLOSE_COVER_MS=320,CLOSE_LOGO_MS=460,CLOSE_FADE_MS=500;
// Windows-only, exact chrome HWND and system DLL. Never log handles or paths.
export function createWindowsBackdrop({win,services,interfaces,loadCtypes}){
  const nativeHandle=()=>{
    if(win.closed)return null;
    const owner=win.docShell.treeOwner;
    let base;
    try{base=owner.QueryInterface(interfaces.nsIBaseWindow);}
    catch{base=owner.QueryInterface(interfaces.nsIInterfaceRequestor).getInterface(interfaces.nsIBaseWindow);}
    const value=base.nativeHandle;
    return typeof value==="string"&&/^0x[0-9a-f]+$/i.test(value)&&!/^0x0+$/i.test(value)?value:null;
  };
  const handle=nativeHandle();
  if(!handle)return null;
  const c=loadCtypes(),hwnd=c.voidptr_t(c.UInt64(handle));
  if(hwnd.isNull())return null;
  const dll=services.dirsvc.get("SysD",interfaces.nsIFile).clone();
  dll.append("dwmapi.dll");
  const call=value=>{
    if(nativeHandle()!==handle)return {hr:null,value:null};
    let lib;
    try{
      lib=c.open(dll.path);
      const reading=value===undefined;
      const fn=lib.declare(reading?"DwmGetWindowAttribute":"DwmSetWindowAttribute",
        c.winapi_abi,c.int32_t,c.voidptr_t,c.uint32_t,c.int32_t.ptr,c.uint32_t);
      const data=c.int32_t(reading?-1:value);
      const hr=fn(hwnd,38,data.address(),c.int32_t.size);
      return {hr,value:hr===0&&data.value>=0&&data.value<=4?data.value:null};
    }finally{lib?.close();}
  };
  return {read:()=>call(),write:value=>{
    if(!Number.isInteger(value)||value<0||value>4)throw new RangeError("backdrop enum");
    return call(value);
  }};
}
export function createCloseFinale({win,doc,root,start,onModal,windows=false,nativeFactory=null}){
  let cover=null,mark=null,active=true,listening=false,sealed=false,backdropFrame=null,backdropBaseline=null;
  const trace=(event,data)=>{try{win.__nocturneTrace?.(event,data,{flush:true});}catch{}};
  const effects=[];
  let native=null,nativeBaseline=null,nativeAttempted=false;
  const probe=()=>{try{return native?.read()??{hr:null,value:null};}catch{return {hr:null,value:null};}};
  const write=value=>{try{return native?.write(value)??{hr:null,value:null};}catch{return {hr:null,value:null};}};
  const release=()=>{
    if(!active)return 0;active=false;let failed=0;
    const step=fn=>{try{fn();}catch{failed++;}};
    if(listening)step(()=>win.removeEventListener("DOMWillOpenModalDialog",onModal,true));
    listening=false;
    const frame=backdropFrame;backdropFrame=null;
    if(frame!==null)step(()=>win.cancelAnimationFrame(frame));
    // Restore only the attribute removed by this lease, never overwrite a
    // replacement value installed by another owner.
    const baseline=backdropBaseline;backdropBaseline=null;
    const ownsAttribute=baseline!==null&&!root.hasAttribute("windowsmica");
    const before=nativeAttempted&&ownsAttribute&&!win.closed?probe():null;
    if(baseline!==null)step(()=>{
      if(!win.closed&&!root.hasAttribute("windowsmica"))root.setAttribute("windowsmica",baseline);
    });
    if(nativeAttempted&&ownsAttribute&&!win.closed){
      const after=probe();
      const canRestore=before?.hr===0&&(before.value===1||before.value===0);
      const result=canRestore&&after.value!==nativeBaseline?write(nativeBaseline):null;
      const final=probe();
      if(canRestore&&final.value!==nativeBaseline)failed++;
      trace("disassembly.dwm.restore",{before:before?.value??null,baseline:nativeBaseline,hr:result?.hr??null,after:final.value,owned:canRestore});
    }
    native=null;nativeBaseline=null;nativeAttempted=false;
    if(baseline!==null)trace("disassembly.backdrop.restore",{present:root.hasAttribute("windowsmica"),failed});
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
      return effect;
    };
    const coverEffect=animate(cover,[{opacity:0},{opacity:1}],start,CLOSE_COVER_MS,"ease-in-out");
    const logoAt=start+CLOSE_COVER_MS,fadeAt=logoAt+CLOSE_LOGO_MS,end=fadeAt+CLOSE_FADE_MS;
    animate(mark,[{opacity:0,transform:"translateY(7px) scale(.96)"},{opacity:1,transform:"translateY(0) scale(1)"}],logoAt,CLOSE_LOGO_MS,"cubic-bezier(.2,.75,.25,1)");
    animate(root,[{opacity:1},{opacity:0}],fadeAt,CLOSE_FADE_MS,"ease-in-out");
    // Firefox 160 ChromeObserver reacts to removal/addition of windowsmica
    // on the chrome root and updates this widget, not other browser windows.
    // Wait for the cover effect, then two rendering opportunities. The logo
    // interval is the budget for switching the native backdrop offscreen.
    // If late, interrupted or unsupported, keep the previous visual path.
    if(windows&&root.hasAttribute("windowsmica")&&Number.isFinite(epoch)){
      const maySwitch=()=>active&&!sealed&&root.hasAttribute("windowsmica")&&
        Number.isFinite(doc.timeline.currentTime)&&doc.timeline.currentTime-epoch<=fadeAt-100&&
        Number(win.getComputedStyle(root).opacity)===1&&Number(win.getComputedStyle(cover).opacity)===1;
      const queue=fn=>{backdropFrame=win.requestAnimationFrame(()=>{backdropFrame=null;fn();});};
      coverEffect.finished.then(()=>{
        try{
          if(!maySwitch())return;
          queue(()=>{
            try{
              if(!maySwitch())return;
              queue(()=>{
                try{
                  if(!maySwitch())return;
                  backdropBaseline=root.getAttribute("windowsmica");
                  if(backdropBaseline===null)return;
                  if(nativeFactory){
                    try{native=nativeFactory();}catch{}
                    const initial=probe();
                    if(initial.hr===0&&Number.isInteger(initial.value)&&initial.value>=0&&initial.value<=4)nativeBaseline=initial.value;
                    trace("disassembly.dwm.baseline",{hr:initial.hr,value:initial.value,available:!!native});
                  }
                  root.removeAttribute("windowsmica");
                  if(nativeBaseline!==null){
                    const auto=probe();
                    nativeAttempted=true;
                    const result=write(1),actual=probe();
                    trace("disassembly.dwm.switch",{baseline:nativeBaseline,afterGecko:auto.value,hr:result.hr,readHr:actual.hr,value:actual.value,confirmed:result.hr===0&&actual.hr===0&&actual.value===1});
                  }
                  trace("disassembly.backdrop.switch",{removed:!root.hasAttribute("windowsmica"),elapsed:doc.timeline.currentTime-epoch,rootOpacity:Number(win.getComputedStyle(root).opacity),coverOpacity:Number(win.getComputedStyle(cover).opacity)});
                }catch{trace("disassembly.backdrop.error",{failed:1});}
              });
            }catch{trace("disassembly.backdrop.error",{failed:1});}
          });
        }catch{trace("disassembly.backdrop.error",{failed:1});}
      },()=>{});
    }
    return {end,logoAt,fadeAt,release,
      seal(){
        if(!active)return null;
        sealed=true;
        const frame=backdropFrame;backdropFrame=null;
        if(frame!==null)try{win.cancelAnimationFrame(frame);}catch{}
        if(nativeAttempted){
          const actual=probe();
          trace("disassembly.dwm.seal",{hr:actual.hr,value:actual.value,attributePresent:root.hasAttribute("windowsmica")});
        }
        for(const effect of effects)try{effect.finish();}catch{}
        const read=node=>{try{const a=Number(win.getComputedStyle(node).opacity);return Number.isFinite(a)?a:null;}catch{return null;}};
        return {rootOpacity:read(root),coverOpacity:read(cover),logoOpacity:read(mark)};
      }};
  }catch{release();return null;}
}
