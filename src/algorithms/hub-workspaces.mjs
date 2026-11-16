  export function hubPanelWidth(left,right,viewport){
    const room=Math.max(1,viewport-left-8);
    return Math.max(1,Math.min(Math.round(room),Math.max(180,Math.round(right-left))));
  }
  export function hubWorkspaceBrowserEligible(tab,active){
    if(!tab||!active||tab.closing||tab.hasAttribute("zen-empty-tab"))return false;
    if(tab.hasAttribute("zen-essential"))return !tab.hidden&&!tab.collapsed;
    return tab.getAttribute("zen-workspace-id")===active;
  }
  export function hubWorkspaceSnapshot(manager) {
    try {
      if (!manager || manager.workspaceEnabled === false ||
          typeof manager.getWorkspaces !== "function" || typeof manager.changeWorkspaceWithID !== "function") return null;
      const native = manager.getWorkspaces();
      if (!Array.isArray(native)) return null;
      const seen = new Set(), spaces = [];
      for (const space of native) {
        if (typeof space?.uuid !== "string" || !space.uuid || seen.has(space.uuid)) continue;
        seen.add(space.uuid);
        spaces.push({id:space.uuid,name:typeof space.name==="string" && space.name.trim()?space.name:"Unnamed space",
          icon:typeof space.icon==="string" && space.icon.length<=24 && !space.icon.includes(".svg")?space.icon:"",
          active:space.uuid===manager.activeWorkspace});
      }
      return spaces;
    } catch { return null; }
  }
  export function hubOtherDisplay(source,dest,x,y){
    return !!source&&!!dest&&(source.x!==dest.x||source.y!==dest.y)&&x>=dest.x&&x<dest.x+dest.width&&y>=dest.y&&y<dest.y+dest.height;
  }
  export function hubSnapRect(display,x,y){
    if(!display||![display.x,display.y,display.width,display.height,x,y].every(Number.isFinite)||display.width<=0||display.height<=0)return null;
    const {x:left,y:top,width,height}=display;
    const edge=Math.max(24,Math.min(100,Math.round(Math.min(width,height)*.085)));
    const right=left+width,bottom=top+height,hw=Math.floor(width/2),hh=Math.floor(height/2);
    const h=x-left<=edge?"left":right-x<=edge?"right":"",v=y-top<=edge?"top":bottom-y<=edge?"bottom":"";
    if(h&&v)return {x:h==="left"?left:left+hw,y:v==="top"?top:top+hh,width:h==="left"?hw:width-hw,height:v==="top"?hh:height-hh,mode:h+"-"+v};
    if(v==="top")return {x:left,y:top,width,height,mode:"maximize"};
    if(h)return {x:h==="left"?left:left+hw,y:top,width:h==="left"?hw:width-hw,height,mode:h};
    if(v==="bottom")return {x:left,y:top+hh,width,height:height-hh,mode:"bottom"};
    const w=Math.round(width*.72),ht=Math.round(height*.74);
    return {x:Math.max(left,Math.min(right-w,Math.round(x-w/2))),y:Math.max(top,Math.min(bottom-ht,Math.round(y-ht/2))),width:w,height:ht,mode:"center"};
  }
