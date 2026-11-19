// Reconstructed Magnetic Bloom candidate, not the lost approved HTML.
// All windows are relative to the first panel stage (reference 940ms).
// Boot is deliberately outside this visible choreography; no production
// timing or native geometry changes are implied by this comparison.
export function startupBloomTimeline(scale=1){
  if(!Number.isFinite(scale)||scale<400/1050||scale>1500/1050)throw RangeError("invalid bloom scale");
  const window=(start,end,min,step)=>Object.freeze({
    start:(start-940)*scale,end:(end-940)*scale,min:min*scale,step:step*scale
  });
  return Object.freeze({
    scale, panel:window(940,1160,220,0),
    islandShape:window(1080,1450,370,0),islandLabel:window(1450,1640,190,0),
    tabs:window(1330,1940,280,42),bookmarks:window(1600,2060,220,28),
    search:window(1710,2230,520,0),pins:window(1930,2500,260,55),
    workspaces:window(2220,2690,240,45),footer:window(2480,2790,310,0),
    end:(2860-940)*scale
  });
}

// A larger collection compresses stagger, never the minimum item duration.
// Input order is already the desired visual order. Every item has one effect.
export function startupBloomStagger(count,stage){
  if(!Number.isSafeInteger(count)||count<0)throw RangeError("invalid bloom count");
  const {start,end,min,step}=stage;
  if(![start,end,min,step].every(Number.isFinite)||start<0||end<=start||min<=0||step<0||min>end-start+1e-7)
    throw RangeError("invalid bloom stage");
  if(!count)return [];
  const span=end-start;
  const spread=Math.max(0,Math.min(span-min,(count-1)*step));
  const duration=span-spread;
  return Array.from({length:count},(_,i)=>({delay:start+(count>1?spread*i/(count-1):0),duration}));
}

// Visible, already-measured slots only; split groups arrive as one slot.
// Distance is from the resting Home center, not the previous moving card.
export function startupBloomOrder(slots,center){
  if(!Number.isFinite(center?.x)||!Number.isFinite(center?.y))throw RangeError("invalid bloom center");
  if(!Array.isArray(slots)||slots.some(slot=>!Number.isFinite(slot?.x)||!Number.isFinite(slot?.y)))
    throw RangeError("invalid bloom slot");
  return slots.map((slot,index)=>({slot,index})).sort((a,b)=>
    Math.abs(a.slot.x-center.x)-Math.abs(b.slot.x-center.x)||
    Math.abs(a.slot.y-center.y)-Math.abs(b.slot.y-center.y)||a.index-b.index
  ).map(x=>x.slot);
}

// Individual scale about the slot center stays in [0,1]. With disjoint
// resting rectangles, every interpolated card rectangle is contained
// in its own slot. No travel through Home, no overshoot outside a slot.
export function startupBloomFrames(kind="card",opacity=1){
  if(!Number.isFinite(opacity)||opacity<0||opacity>1)throw RangeError("invalid resting opacity");
  if(kind==="card")return [
    {offset:0,scale:"0.72",opacity:0,easing:"cubic-bezier(.2,.75,.25,1)"},
    {offset:.58,scale:"1",opacity,easing:"ease-in-out"},
    {offset:.78,scale:"0.96",opacity,easing:"ease-out"},
    {offset:1,scale:"1",opacity}
  ];
  if(kind==="search")return [
    {offset:0,scale:"0.86",opacity:0,easing:"cubic-bezier(.2,.75,.25,1)"},
    {offset:1,scale:"1",opacity}
  ];
  if(kind==="islandShape")return [
    {offset:0,scale:"0.45 1",opacity:0,easing:"cubic-bezier(.2,.75,.25,1)"},
    {offset:1,scale:"1 1",opacity}
  ];
  if(kind==="fade")return [{offset:0,opacity:0},{offset:1,opacity}];
  throw RangeError("unknown bloom surface");
}

/* Shared Home schedule for native slots and the comparison Lab. Labels
 * never multiply their children's alpha; the empty Pins state is a fade. */
export function startupBloomHomeSchedule(plan,pinCount,workspaceCount){
  const stage=w=>({delay:w.start,duration:w.end-w.start});
  return {
    search:stage(plan.search),pinLabel:stage(plan.pins),
    pins:startupBloomStagger(pinCount,plan.pins),
    workspaceLabel:stage(plan.workspaces),
    workspaces:startupBloomStagger(workspaceCount,plan.workspaces),
    footer:stage(plan.footer)
  };
}

// The common Assembly epoch is the first visible panel frame, after any
// Boot exit. Boot remains outside the visible clock and is charged as
// pre-resume overhead against the same inherited absolute watchdog.
export function startupBloomAssemblyPlan(start,scale){
  const bloom=startupBloomTimeline(scale);
  if(!Number.isFinite(start))throw RangeError("invalid bloom epoch");
  const base=w=>w.start/scale,length=w=>(w.end-w.start)/scale;
  return {
    start,scale,mode:"bloom",bloom,panel:base(bloom.panel),panelLength:length(bloom.panel),
    cards:base(bloom.tabs),cardsLength:length(bloom.tabs),bookmarks:base(bloom.bookmarks),
    home:base(bloom.search),homeLength:length(bloom.search),end:bloom.end/scale,
    finishLength:bloom.end,lateLimit:bloom.end+420
  };
}
