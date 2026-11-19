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
export function startupLateEffect(plan,start,finishAt,deadline,now,delay,length,elapsed=now-start){
  if(!Number.isFinite(elapsed))return null;
  const wait=Math.max(0,delay*plan.scale-elapsed);
  const cap=Math.min(deadline,start+plan.lateLimit);
  const available=cap-now-wait-65;
  if(!Number.isFinite(available)||available<240)return null;
  const time=Math.min(available,Math.max(240,Math.min(length*plan.scale,finishAt-now-wait-60)));
  return {delay:wait,length:time,finishAt:now+wait+time+65};
}

// One Assembly-owned outcome ledger. Consumers supply exact ownership
// predicates; intentional retirement is not a successful WAAPI finish.
export function createStartupOutcome(onCancel,onProgress=()=>{}){
  const records=new Map();
  let closed=false;
  const current=record=>{try{return record.isCurrent();}catch{return false;}};
  function observe(effect,surface,isCurrent){
    if(closed||records.has(effect))return;
    const record={effect,surface,isCurrent,state:"pending"};
    records.set(effect,record);
    const done=cancelled=>{
      if(closed||records.get(effect)!==record||record.state!=="pending")return;
      if(!current(record))record.state="retired";
      else{
        record.state=cancelled?"cancelled":"finished";
        if(cancelled){onCancel(surface);return;}
      }
      onProgress();
    };
    // Attach before any pause/seek/startTime mutation. Never convert an
    // unexpected rejection into a normal successful transaction.
    effect.finished.then(()=>done(false),()=>done(true));
  }
  function snapshot(){
    const counts={pending:0,finished:0,cancelled:0,retired:0};
    for(const record of records.values()){
      let state=record.state;
      if(state==="pending"){
        if(!current(record))state="retired";
        else try{
          const playState=record.effect.playState;
          if(playState==="finished")state="finished";
          else if(playState==="idle")state="cancelled";
        }catch{}
      }
      counts[state]++;
    }
    return counts;
  }
  function close(){closed=true;records.clear();}
  return {observe,snapshot,close};
}

export function startupBoundaryOutcome(counts,legacy=0){
  if(counts?.cancelled)return "effect-cancelled";
  if(counts?.pending)return "boundary-incomplete";
  if(legacy)return "completed-unverified";
  if(counts?.retired)return "completed-with-retired";
  return "completed";
}
