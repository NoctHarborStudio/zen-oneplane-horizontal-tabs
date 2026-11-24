// Home Island variant B, approved in the comparison prototype.
export const HOME_ISLAND_DURATION=540;
export const HOME_ISLAND_TRAVEL="--zr-island-travel",HOME_ISLAND_SCALE="--zr-island-scale";
export function registerHomeIslandMotion(css){
  for(const name of [HOME_ISLAND_TRAVEL,HOME_ISLAND_SCALE]){
    try{css.registerProperty({name,syntax:"<number>",inherits:false,initialValue:"1"});}
    catch(e){if(e.name!=="InvalidModificationError")return false;}
  }
  return true;
}
export function homeIslandDistance(bottom){return -Math.max(66,bottom+2);}
export function homeIslandPose(t){
  const clamp=x=>Math.min(1,Math.max(0,x));
  const bezier=(t,x1,y1,x2,y2)=>{
    t=clamp(t);if(t===0||t===1)return t;
    let l=0,r=1;
    const b=(u,a,c)=>3*(1-u)*(1-u)*u*a+3*(1-u)*u*u*c+u*u*u;
    for(let i=0;i<24;i++){const m=(l+r)/2;if(b(m,x1,x2)<t)l=m;else r=m;}
    return b((l+r)/2,y1,y2);
  };
  t=clamp(t);
  const a=clamp(t/.3);
  return {travel:bezier(t,.25,.8,.22,1),scale:.02+.98*bezier((t-.2)/.8,.3,0,.12,1),opacity:a*a*(3-2*a)};
}
export function homeIslandFrames(reverse=false){
  return Array.from({length:81},(_,i)=>({offset:i/80,...homeIslandPose((reverse?80-i:i)/80)}));
}

// Shared horizontal edge choreography. Each side travels as one group;
// the widest measured extent determines the offscreen starting position.
export const EDGE_CONTROL_EASE="cubic-bezier(.45,0,.55,1)";
export const EDGE_CONTROL_SELECTOR="toolbarbutton,button,.titlebar-button,[role=button],#titlebar-min,#titlebar-max,#titlebar-restore,#titlebar-close";
export function edgeControlOffsets(rects,center,width){
  if(!Number.isFinite(center)||!Number.isFinite(width)||width<=0)throw RangeError("edge-control-viewport");
  const sides=rects.map(r=>{
    if(![r.left,r.right].every(Number.isFinite)||r.right<=r.left)throw RangeError("edge-control-rect");
    return (r.left+r.right)/2<center?-1:1;
  });
  const left=Math.max(0,...rects.filter((_,i)=>sides[i]<0).map(r=>r.right))+8;
  const right=Math.max(0,...rects.filter((_,i)=>sides[i]>0).map(r=>width-r.left))+8;
  return sides.map(side=>side<0?-left:right);
}

// Center Flow: visible choreography only; Boot and the branded close
// finale have independent native-readiness/confirmation ownership.
export const CENTER_FLOW_MS=2400;
export const CENTER_FLOW_CLOSE_MS=1600;
export const CENTER_FLOW_STAGES=Object.freeze({
  panel:[48,552],island:[216,996],tabs:[824,1968],edges:[840,1680],
  bookmarks:[1152,2016],search:[936,1656],pinLabel:[1176,1728],
  workspaceLabel:[1560,2064],footer:[1944,2400],body:[936,1968]
});
export function centerFlowDuration(value){
  if([450,600,760,1000,1050,1250,1500].includes(value))
    return Math.round(CENTER_FLOW_MS*value/1050);
  return Number.isFinite(value)?Math.max(900,Math.min(3600,value)):CENTER_FLOW_MS;
}
export function centerFlowStage(name,duration=CENTER_FLOW_MS,reverse=false,rank=0){
  if(!Number.isFinite(duration)||duration<=0)throw RangeError("center-flow-duration");
  rank=Math.max(0,Math.min(1,Number.isFinite(rank)?rank:0));
  const a=name==="pin"?[1224+312*rank,1872+312*rank]:
    name==="workspace"?[1584+132*rank,2160+132*rank]:CENTER_FLOW_STAGES[name];
  if(!a)throw RangeError("center-flow-stage");
  return {delay:(reverse?CENTER_FLOW_MS-a[1]:a[0])*duration/CENTER_FLOW_MS,
    duration:(a[1]-a[0])*duration/CENTER_FLOW_MS};
}
export function centerFlowTimeline(start,scale){
  if(!Number.isFinite(start)||!Number.isFinite(scale)||scale<=0)throw RangeError("center-flow-plan");
  const [panel,island,tabs,edges,bookmarks,search]=["panel","island","tabs","edges","bookmarks","search"].map(n=>centerFlowStage(n));
  return {start,scale,mode:"fold",flow:true,panel:panel.delay,panelLength:panel.duration,
    islandStart:island.delay,islandLength:island.duration,islandShift:0,
    cards:tabs.delay,cardsLength:tabs.duration,edges:edges.delay,edgesLength:edges.duration,
    bookmarks:bookmarks.delay,bookmarksLength:bookmarks.duration,home:search.delay,homeLength:search.duration,
    end:CENTER_FLOW_MS,finishLength:CENTER_FLOW_MS*scale,lateLimit:(CENTER_FLOW_MS+420)*scale};
}
export function homeFlowFrames(kind,opacity=1,reverse=false){
  const a={opacity:0},b={opacity};
  if(kind==="search"){a.transform="scale(.89,.96)";b.transform="scale(1,1)";}
  else if(kind==="pin"){a.transform="translateY(14px) scale(.93)";b.transform="translateY(0px) scale(1)";}
  else if(kind==="workspace"||kind==="body"){a.transform="translateY(9px)";b.transform="translateY(0px)";}
  return reverse?[b,a]:[a,b];
}
export function homeFlowTargets(content,duration,reverse=false){
  if(!content)return [];
  const nodes=[...content.children],search=nodes.shift(),footer=nodes.pop(),pins=nodes.shift(),spaces=nodes.shift();
  const fallback=()=>[{node:content,kind:"body",...centerFlowStage("body",duration,reverse)}];
  if(nodes.length||!search?.matches(".zh-search")||!footer?.matches(".zh-footer")||
    !pins?.matches(".zh-section")||spaces&&!spaces.matches(".zh-section"))return fallback();
  const [pinLabel,pinGrid,...pinExtra]=pins.children;
  const [spaceLabel,spaceGrid,...spaceExtra]=spaces?[...spaces.children]:[];
  if(!pinLabel?.matches("h3")||!pinGrid?.matches(".zh-pins")||pinExtra.length||
     spaces&&(!spaceLabel?.matches("h3")||!spaceGrid?.matches(".zh-spaces")||
       spaceExtra.some(n=>!n.hidden)))return fallback();
  const targets=[];
  const add=(node,kind,stage=kind,rank=0)=>targets.push({node,kind,...centerFlowStage(stage,duration,reverse,rank)});
  const wave=(grid,kind)=>{
    const list=[...grid.children],rect=grid.getBoundingClientRect(),center=rect.left+rect.width/2;
    const scores=list.map(n=>{const r=n.getBoundingClientRect();return Math.abs(r.left+r.width/2-center)+Math.max(0,r.top-rect.top);});
    const max=Math.max(1,...scores);
    list.forEach((node,i)=>add(node,node.matches(".zh-empty")?"fade":kind,kind,scores[i]/max));
  };
  add(search,"search");add(pinLabel,"fade","pinLabel");wave(pinGrid,"pin");
  if(spaces){add(spaceLabel,"fade","workspaceLabel");wave(spaceGrid,"workspace");}
  add(footer,"fade","footer");
  return targets.length<=256?targets:fallback();
}
