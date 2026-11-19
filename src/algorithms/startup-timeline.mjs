// Pure timing plan for Center Assembly; base offsets are unscaled milliseconds.
// The runtime owns the epoch and lifecycle; this module owns no DOM or timers.
export function startupTimeline(start,scale){
  const duration=Math.round(scale*1050);
  return {
    start,scale,panel:0,panelLength:220,cards:245,cardsLength:650,
    bookmarks:470,home:650,homeLength:330,end:1190,
    finishLength:Math.max(duration+80,1190*scale),
    lateLimit:duration+420
  };
}

export function startupFits(plan,now,deadline,overhead=0){
  return Number.isFinite(now)&&Number.isFinite(deadline)&&Number.isFinite(overhead)&&
    overhead>=0&&now+plan.finishLength+overhead<deadline;
}

// A late target either has enough time to reach its resting frame or is
// left ungated. Never schedule a minimum-length effect past the hard cap.
export function startupLateEffect(plan,start,finishAt,deadline,now,delay,length){
  const wait=Math.max(0,start+delay*plan.scale-now);
  const cap=Math.min(deadline,start+plan.lateLimit);
  const available=cap-now-wait-65;
  if(!Number.isFinite(available)||available<240)return null;
  const time=Math.min(available,Math.max(240,Math.min(length*plan.scale,finishAt-now-wait-60)));
  return {delay:wait,length:time,finishAt:now+wait+time+65};
}
