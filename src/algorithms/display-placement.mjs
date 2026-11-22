  // All geometry below is in global desktop pixels; no CSS coordinates.
  export function displayContains(rect,x,y){
    return !!rect&&[rect.x,rect.y,rect.width,rect.height,x,y].every(Number.isFinite)&&
      rect.width>0&&rect.height>0&&x>=rect.x&&x<rect.x+rect.width&&y>=rect.y&&y<rect.y+rect.height;
  }
  export function displayCssPoint(x,y,cssToDevice,desktopToDevice){
    if(![x,y,cssToDevice,desktopToDevice].every(Number.isFinite)||cssToDevice<=0||desktopToDevice<=0)return null;
    const scale=cssToDevice/desktopToDevice;
    return {x:Math.round(x*scale),y:Math.round(y*scale)};
  }
  export function displayRectEqual(a,b){
    return !!a&&!!b&&["x","y","width","height"].every(k=>a[k]===b[k]);
  }
  export function displaySnapTarget(full,work,x,y){
    if(!displayContains(full,x,y)||!displayContains(full,work?.x,work?.y)||
       !displayContains(full,work.x+work.width-1,work.y+work.height-1))return null;
    // Classify on the physical display, not the inset work area. A taskbar
    // is part of the hit surface, but never part of the target window.
    const horizontalEdge=Math.max(1,Math.round(full.width*.22)),verticalEdge=Math.max(1,Math.round(full.height*.18));
    const l=x-full.x,r=full.x+full.width-1-x,t=y-full.y,b=full.y+full.height-1-y;
    const h=l<horizontalEdge?"left":r<horizontalEdge?"right":"";
    const v=t<verticalEdge?"top":b<verticalEdge?"bottom":"";
    const {x:wx,y:wy,width:w,height:ht}=work,hw=Math.floor(w/2),hh=Math.floor(ht/2);
    let rect;
    if(h&&v)rect={x:h==="left"?wx:wx+hw,y:v==="top"?wy:wy+hh,width:h==="left"?hw:w-hw,height:v==="top"?hh:ht-hh,mode:h+"-"+v};
    else if(v==="top")rect={...work,mode:"maximize"};
    else if(h)rect={x:h==="left"?wx:wx+hw,y:wy,width:h==="left"?hw:w-hw,height:ht,mode:h};
    else if(v==="bottom")rect={x:wx,y:wy+hh,width:w,height:ht-hh,mode:"bottom"};
    else {
      const width=Math.round(w*.72),height=Math.round(ht*.74);
      rect={x:wx+Math.floor((w-width)/2),y:wy+Math.floor((ht-height)/2),width,height,mode:"center"};
    }
    return {...rect,full:{...full},work:{...work}};
  }
  export function displayNativeRect(rect,desktopToDevice){
    if(!rect||![rect.x,rect.y,rect.width,rect.height,desktopToDevice].every(Number.isFinite)||
       rect.width<=0||rect.height<=0||desktopToDevice<=0)return null;
    return {x:Math.round(rect.x*desktopToDevice),y:Math.round(rect.y*desktopToDevice),
      width:Math.round(rect.width*desktopToDevice),height:Math.round(rect.height*desktopToDevice)};
  }
  // Preview identity must include the current work area: taskbar/dock
  // changes can move the same snap mode within an unchanged monitor.
  // This is a presentation cache key, never an authority for OS placement.
  export function displayPreviewKey(target,label){
    if(!target?.full||!target?.work||typeof target.mode!=="string"||typeof label!=="string")return null;
    const f=target.full,w=target.work;
    const dimensions=[f.x,f.y,f.width,f.height,w.x,w.y,w.width,w.height,
      target.x,target.y,target.width,target.height];
    if(!dimensions.every(Number.isFinite)||f.width<=0||f.height<=0||
       w.width<=0||w.height<=0||target.width<=0||target.height<=0)return null;
    return [label,target.mode,...dimensions].join(":");
  }
  export function displayPreviewFraction(target){
    if(!target||!displayContains(target.full,target.x,target.y)||
       !displayContains(target.full,target.x+target.width-1,target.y+target.height-1))return null;
    const f=target.full;
    return {x:(target.x-f.x)/f.width,y:(target.y-f.y)/f.height,width:target.width/f.width,height:target.height/f.height};
  }
  export function displayReleaseMatches(sample,token,x,y,now){
    return !!sample&&sample.token===token&&[x,y,now,sample.x,sample.y,sample.time].every(Number.isFinite)&&
      now>=sample.time&&now-sample.time<=400&&Math.hypot(x-sample.x,y-sample.y)<=16;
  }
  export function tabReturnZone(x,y,rect,height){
    return !!rect&&[x,y,rect.left,rect.right,rect.top,height].every(Number.isFinite)&&
      x>=rect.left&&x<rect.right&&y>=Math.max(0,rect.top)&&y<Math.max(0,rect.top)+Math.max(0,height);
  }
  // Native creation uses the selected rectangle, not a uniform center seed.
  // For maximize, start at the work area and apply native maximize separately.
  export function displayStartupFeatures(target,openerScale,destinationScale,openerZoom=1){
    const w=target?.work;
    if(!w||!displayContains(w,target.x,target.y)||
       !displayContains(w,target.x+target.width-1,target.y+target.height-1)||
       ![openerScale,destinationScale,openerZoom].every(n=>Number.isFinite(n)&&n>0)||
       !Number.isFinite(target.width)||!Number.isFinite(target.height)||target.width<=0||target.height<=0)return null;
    return {left:Math.round(target.x/openerScale),top:Math.round(target.y/openerScale),
      outerWidth:Math.max(1,Math.round(target.width/(destinationScale*openerZoom))),
      outerHeight:Math.max(1,Math.round(target.height/(destinationScale*openerZoom)))};
  }
  export function displayPlacementMatches(target,actual,maximized=false,tolerance=8){
    if(!target?.full||!actual||![actual.x,actual.y,actual.width,actual.height,tolerance].every(Number.isFinite)||
       actual.width<=0||actual.height<=0||tolerance<0||
       !displayContains(target.full,actual.x+actual.width/2,actual.y+actual.height/2))return false;
    if(target.mode==="maximize")return maximized;
    return !maximized&&["x","y","width","height"].every(k=>Number.isFinite(target[k])&&Math.abs(actual[k]-target[k])<=tolerance);
  }
