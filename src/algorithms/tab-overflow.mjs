  // Pure collapsed-slot allocation for the second-row controller.
  // Each slot represents one tab or one entire Split View group.
  export function planTabOverflow(widths,boundary,leftCapacity,rightCapacity,gap=3){
    if(!Array.isArray(widths)||widths.some(w=>!Number.isFinite(w)||w<=0)||
       !Number.isInteger(boundary)||boundary<0||boundary>widths.length||
       ![leftCapacity,rightCapacity,gap].every(v=>Number.isFinite(v)&&v>=0))
      throw new TypeError("Invalid collapsed slot geometry");
    let leftStart=boundary,leftUsed=0;
    while(leftStart>0){
      const next=widths[leftStart-1]+(leftStart===boundary?0:gap);
      if(leftUsed+next>leftCapacity)break;
      leftStart--;leftUsed+=next;
    }
    let rightEnd=boundary,rightUsed=0;
    while(rightEnd<widths.length){
      const next=widths[rightEnd]+(rightEnd===boundary?0:gap);
      if(rightUsed+next>rightCapacity)break;
      rightUsed+=next;rightEnd++;
    }
    const indices=(a,b)=>Array.from({length:b-a},(_,i)=>a+i);
    const lowerLeft=indices(0,leftStart),lowerRight=indices(rightEnd,widths.length);
    return {topLeft:indices(leftStart,boundary),topRight:indices(boundary,rightEnd),
      lowerLeft,lowerRight,lower:[...lowerLeft,...lowerRight],
      hasSecondRow:lowerLeft.length+lowerRight.length>0,leftUsed,rightUsed};
  }

  // A fixed center has two independently budgeted sides. Compact mode
  // keeps at most two ordinary slots on either side; groups are atomic.
  export function planAdaptiveTabRows(widths,groups,boundary,available,title,tab,gap=3,returnReserve=0){
    const lane=(sideTitle)=>Math.max(0,(available-sideTitle-2*gap)/2-2*gap);
    const wideCap=Math.max(0,lane(title)-returnReserve/2),rightCap=Math.max(0,wideCap-tab-gap);
    const full=planTabOverflow(widths,boundary,wideCap,rightCap,gap);
    if(!full.hasSecondRow&&available>=title+2*gap+2*(tab+gap)+returnReserve){
      return {...full,mode:"wide",title,topPlus:true};
    }
    const minTitle=32;
    const compactTitle=available>=title+2*gap?title:minTitle;
    const compactLane=sideTitle=>Math.max(0,(available-sideTitle-2*gap)/2-2);
    const pick=(cap,start,end,step)=>{
      const picked=[];let used=0;
      for(let i=start;i!==end&&picked.length<2;i+=step){
        if(groups[i])continue;
        const extent=widths[i]+(picked.length?gap:0);
        if(used+extent>cap)continue;
        picked.push(i);used+=extent;
      }
      if(step<0)picked.reverse();
      return {picked,used};
    };
    const slots=sideTitle=>{
      const cap=compactLane(sideTitle);
      return {left:pick(cap,boundary-1,-1,-1),right:pick(cap,boundary,widths.length,1)};
    };
    const titled=slots(compactTitle),icon=slots(minTitle);
    // Keep the full title unless the icon can reveal another actual tab.
    const count=s=>s.left.picked.length+s.right.picked.length;
    const chosenTitle=count(icon)>count(titled)||available<compactTitle+2*gap?minTitle:compactTitle;
    const compactCap=compactLane(chosenTitle);
    const chosen=chosenTitle===minTitle?icon:titled;
    const left=chosen.left.picked,right=chosen.right.picked;
    const kept=new Set([...left,...right]);
    const lower=widths.map((_,i)=>i).filter(i=>!kept.has(i));
    const singleCap=lane(chosenTitle);
    const topPlus=lower.length===0&&chosen.left.used<=singleCap&&
      chosen.right.used+tab+gap<=singleCap&&available>=chosenTitle+2*gap+2*(tab+gap+2*gap);
    return {mode:chosenTitle===minTitle&&compactCap<tab?"ultra":"compact",title:chosenTitle,
      topLeft:left,topRight:right,lower,hasSecondRow:lower.length>0||!topPlus,topPlus};
  }
  export function adaptiveAddressWidth(preferred,windowWidth,leftWithoutAddress,centerReserve,margin=8,forceCompact=false){
    const budget=Math.max(0,Math.floor(windowWidth/2-leftWithoutAddress-centerReserve-margin));
    const desired=forceCompact||budget<preferred?Math.round(preferred*.7):preferred;
    return Math.max(36,Math.min(desired,budget));
  }

  export function visibleLaneDropIndex(slots,left,right,x){
    const visible=slots.map((s,index)=>({index,left:Math.max(left,s.left),right:Math.min(right,s.right)}))
      .filter(s=>s.right>s.left);
    if(!visible.length)return null;
    for(const s of visible)if(x<(s.left+s.right)/2)return {index:s.index,before:true};
    return {index:visible.at(-1).index,before:false};
  }
  export function laneScrollVelocity(x,left,right,edge=32){
    if(!(edge>0))return 0;
    const l=Math.max(0,Math.min(1,(left+edge-x)/edge));
    const r=Math.max(0,Math.min(1,(x-(right-edge))/edge));
    return Math.round((r*r-l*l)*18);
  }

  export function centeredRowCorrection(windowWidth,left,right,rowCenter,rowWidth){
    const min=left+rowWidth/2,max=windowWidth-right-rowWidth/2;
    // If the edges overlap there is no exact safe midpoint; stay as close
    // as possible to the real available center rather than crossing controls.
    const target=min<=max?Math.max(min,Math.min(max,windowWidth/2)):(min+max)/2;
    return Math.round(target-rowCenter);
  }

  export function overflowScrollMetrics(viewport,content,offset){
    const max=Math.max(0,content-viewport),visible=viewport>0&&max>1;
    const position=visible?Math.max(0,Math.min(1,offset/max)):0;
    return {visible,max,position,value:Math.round(position*1000),
      thumb:visible?Math.min(viewport,Math.max(20,viewport*viewport/content)):0};
  }

  // Direct dragging bypasses this short, interruptible ease-out.
  export function overflowScrollEase(start,target,elapsed,duration=145){
    const t=duration>0?Math.max(0,Math.min(1,elapsed/duration)):1;
    return t===1?target:start+(target-start)*(1-(1-t)**3);
  }

  // Spend only the surplus around a centered strip. The compact width
  // is a starting point, not a hard cap. Keep the configured preference
  // as the ceiling and preserve title, native slots, plus and row count.
  export function reclaimAddressWidth(preferred,baseline,planAtWidth,safety=4){
    const low=Math.round(baseline),limit=Math.max(low,Math.floor(preferred));
    if(limit<=low)return low;
    const reference=planAtWidth(low);
    const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
    const preserves=p=>p.mode===reference.mode&&p.title===reference.title&&
      p.topPlus===reference.topPlus&&p.hasSecondRow===reference.hasSecondRow&&
      same(p.topLeft,reference.topLeft)&&same(p.topRight,reference.topRight);
    const fits=w=>preserves(planAtWidth(w))&&preserves(planAtWidth(w+Math.max(0,safety)));
    // A conservative bounded search: extra room is optional. Never
    // return a width unless its actual and padded plans both fit.
    let l=low,h=limit;
    while(l<h){
      const mid=Math.ceil((l+h)/2);
      if(fits(mid))l=mid;else h=mid-1;
    }
    return l;
  }

// Lossless structural adapter: leave Auto allocation, metrics and CSS alone.
// The boundary must come from the exact same pass as the legacy plan.
export function normalizeAutomaticTabRows(plan,count,boundary) {
  if(!Number.isSafeInteger(count)||count<0||!Number.isInteger(boundary)||boundary<0||boundary>count||
     !plan||typeof plan.topPlus!=="boolean"||typeof plan.hasSecondRow!=="boolean"||
     ![plan.topLeft,plan.topRight,plan.lower].every(Array.isArray))
    throw new TypeError("Invalid automatic slot plan");
  const seen=new Set();
  for(const [region,indices] of [["left",plan.topLeft],["right",plan.topRight],[null,plan.lower]]){
    for(const i of indices){
      if(!Number.isInteger(i)||i<0||i>=count||seen.has(i)||
         (region==="left"&&i>=boundary)||(region==="right"&&i<boundary))
        throw new TypeError("Inconsistent automatic slot provenance");
      seen.add(i);
    }
  }
  if(seen.size!==count||plan.hasSecondRow!==(plan.lower.length>0||!plan.topPlus))
    throw new TypeError("Incomplete automatic slot plan");
  const regions=[{id:"top-left",side:"left",slots:plan.topLeft.slice()},
    {id:"top-right",side:"right",slots:[...plan.topRight,...(plan.topPlus?["plus-right"]:[])]}];
  if(plan.hasSecondRow)regions.push({id:"bottom",side:null,slots:[...plan.lower,...(plan.topPlus?[]:["plus-right"])]});
  return {mode:"automatic",sides:Array.from({length:count},(_,i)=>i<boundary?"left":"right"),regions,hasSecondRow:plan.hasSecondRow};
}
