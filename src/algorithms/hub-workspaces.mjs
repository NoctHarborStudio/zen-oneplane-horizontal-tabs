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
    return {x:left+Math.floor((width-w)/2),y:top+Math.floor((height-ht)/2),width:w,height:ht,mode:"center"};
  }
  export function hubTrashAgeMatches(stamp,age,now){
    if(age==="all")return true;
    const duration={"5m":300000,"1h":3600000,"1d":86400000,"7d":604800000,"30d":2592000000,"1y":31536000000}[age];
    return Number.isFinite(duration)&&Number.isFinite(stamp)&&stamp>0&&Number.isFinite(now)&&now-stamp>=duration;
  }
  export function hubWorkspaceOrder(spaces,free,trash){
    return Array.isArray(spaces)?spaces.filter(s=>s.id!==trash).sort((a,b)=>Number(b.id===free)-Number(a.id===free)):null;
  }
  export function hubTrashTabEligible(tab){
    return !!tab&&!tab.closing&&!tab.group&&!tab.hasAttribute("zen-essential")&&!tab.hasAttribute("zen-empty-tab")&&
      !tab.hasAttribute("split-view")&&!tab.hasAttribute("glance-id")&&!tab.hasAttribute("zen-glance-tab")&&
      !tab.querySelector?.(".tabbrowser-tab[glance-id],.tabbrowser-tab[zen-glance-tab]");
  }
  export function hubTrashRange(count,scroll,height,row=54,overscan=3){
    const n=Math.max(0,Math.floor(count)||0),size=Math.max(1,row||54);
    const first=Math.min(n,Math.max(0,Math.floor(Math.max(0,scroll||0)/size)-overscan));
    const end=Math.min(n,Math.max(first,Math.ceil((Math.max(0,scroll||0)+Math.max(0,height||0))/size)+overscan));
    return {first,end,top:first*size,bottom:(n-end)*size};
  }
  export function hubTrashRelativeAge(stamp,now){
    if(!Number.isFinite(stamp)||stamp<=0)return "Unknown";
    const m=Math.max(0,Math.floor((now-stamp)/60000));
    return m<1?"Just now":m<60?m+" min":m<1440?Math.floor(m/60)+" h":m<525600?Math.floor(m/1440)+" d":Math.floor(m/525600)+" y";
  }
  export function hubTrashAgeOptions(){
    return [["all","All tabs","All tabs"],["5m","5 min+","Older than 5 minutes"],["1h","1 hour+","Older than 1 hour"],["1d","1 day+","Older than 1 day"],["7d","7 days+","Older than 7 days"],["30d","30 days+","Older than 30 days"],["1y","1 year+","Older than 1 year"]];
  }
  export function hubTrashFlightGeometry(rect,release,dest,panel){
    if(!rect||!release||!dest||!panel||![rect.width,rect.height,release.x,release.y,dest.left,dest.top,dest.width,dest.height,panel.left,panel.top,panel.right,panel.bottom].every(Number.isFinite)||rect.width<=0||rect.height<=0)return null;
    if(release.x<panel.left||release.x>panel.right||release.y<panel.top||release.y>panel.bottom)return null;
    const x=Math.max(panel.left,Math.min(panel.right-rect.width,release.x-Math.min(20,rect.width/2)));
    const y=Math.max(panel.top,Math.min(panel.bottom-rect.height,release.y-rect.height/2));
    return {x,y,dx:dest.left+dest.width/2-x-rect.width/2,dy:dest.top+dest.height/2-y-rect.height/2};
  }
