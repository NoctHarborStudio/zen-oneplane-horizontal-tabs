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
  // keeps at most one ordinary slot on either side; groups are atomic.
  export function planAdaptiveTabRows(widths,groups,boundary,available,title,tab,gap=3){
    const lane=(sideTitle)=>Math.max(0,(available-sideTitle-2*gap)/2-2*gap);
    const wideCap=lane(title),rightCap=Math.max(0,wideCap-tab-gap);
    const full=planTabOverflow(widths,boundary,wideCap,rightCap,gap);
    if(!full.hasSecondRow&&available>=title+2*gap+2*(tab+gap)){
      return {...full,mode:"wide",title,topPlus:true};
    }
    const minTitle=32;
    const compactTitle=available>=title+2*gap?title:minTitle;
    const cap=lane(compactTitle);
    // Prefer a title until it would prevent even one ordinary slot.
    const chosenTitle=cap<tab&&compactTitle>minTitle?minTitle:compactTitle;
    const compactCap=lane(chosenTitle);
    const left=[],right=[];
    if(compactCap>=tab){
      for(let i=boundary-1;i>=0;i--)if(!groups[i]&&widths[i]<=compactCap){left.push(i);break;}
      for(let i=boundary;i<widths.length;i++)if(!groups[i]&&widths[i]<=compactCap){right.push(i);break;}
    }
    const kept=new Set([...left,...right]);
    const lower=widths.map((_,i)=>i).filter(i=>!kept.has(i));
    // The plus has a guaranteed slot on the bottom whenever top space
    // cannot contain it. Even an empty strip can use this minimal shelf.
    const topPlus=lower.length===0&&available>=chosenTitle+2*gap+2*(tab+gap+2*gap);
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
