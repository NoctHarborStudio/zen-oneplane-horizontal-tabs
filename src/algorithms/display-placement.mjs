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
    const edge=Math.max(16,Math.min(72,Math.round(Math.min(full.width,full.height)*.045)));
    const l=x-full.x,r=full.x+full.width-1-x,t=y-full.y,b=full.y+full.height-1-y;
    const h=l<=edge?"left":r<=edge?"right":"";
    const v=t<=edge?"top":b<=edge?"bottom":"";
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
  export function displayPreviewFraction(target){
    if(!target||!displayContains(target.full,target.x,target.y)||
       !displayContains(target.full,target.x+target.width-1,target.y+target.height-1))return null;
    const f=target.full;
    return {x:(target.x-f.x)/f.width,y:(target.y-f.y)/f.height,width:target.width/f.width,height:target.height/f.height};
  }
