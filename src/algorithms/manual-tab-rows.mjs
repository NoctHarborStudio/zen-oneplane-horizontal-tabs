// ML1a: pure candidate, intentionally not in the runtime build plan yet.
// Unit indices reference a single native-order snapshot (a Split is one unit).
// Plus tokens are controls, never native units. Regions describe visual order.
export function planManualTabRows({widths,sides,leftCapacity,rightCapacity,plusWidth,gap=3}) {
  const validWidth=w=>Number.isFinite(w)&&w>0;
  if(!Array.isArray(widths)||!Array.isArray(sides)||widths.length!==sides.length||
     !Array.from(widths).every(validWidth)||!Array.from(sides).every(s=>s==="left"||s==="right")||
     !validWidth(plusWidth)||![leftCapacity,rightCapacity,gap].every(v=>Number.isFinite(v)&&v>=0))
    throw new TypeError("Invalid manual slot geometry or side assignment");
  const left=[],right=[];
  for(let i=0;i<sides.length;i++)(sides[i]==="left"?left:right).push(i);
  left.reverse(); // native order is left-to-right; logical order is center-out
  const allocate=(indices,side,capacity)=>{
    const sequence=[...indices,"plus-"+side];
    let used=0,cut=0;
    for(const slot of sequence){
      const next=used+(cut?gap:0)+(typeof slot==="number"?widths[slot]:plusWidth);
      if(next>capacity)break;
      used=next;cut++;
    }
    const top=sequence.slice(0,cut),bottom=sequence.slice(cut);
    if(side==="left"){top.reverse();bottom.reverse();}
    return {top,bottom};
  };
  const l=allocate(left,"left",leftCapacity),r=allocate(right,"right",rightCapacity);
  const regions=[{id:"top-left",side:"left",slots:l.top},{id:"top-right",side:"right",slots:r.top}];
  if(l.bottom.length&&r.bottom.length){
    regions.push({id:"bottom-left",side:"left",slots:l.bottom},{id:"bottom-right",side:"right",slots:r.bottom});
  }else if(l.bottom.length||r.bottom.length){
    regions.push({id:"bottom",side:l.bottom.length?"left":"right",slots:l.bottom.length?l.bottom:r.bottom});
  }
  return {mode:"manual",sides:sides.slice(),regions,hasSecondRow:regions.length>2};
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
