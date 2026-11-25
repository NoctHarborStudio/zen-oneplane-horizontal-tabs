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

// ML3a: one already-correlated native creation, never a creation service.
// Existing units are authoritative native unit references and verified sides.
// A Split is one unit; its complete membership/role is the caller's witness.
// Capture after native creation settles. No DOM coordinate or global sort.
export function planManualPlusPlacement({existing,after,created,side}={}){
  const rejected=reason=>({status:"rejected",reason});
  if(!["left","right"].includes(side)||!created||!Array.isArray(existing)||!Array.isArray(after)||
     !Array.from(existing).every(x=>x?.unit&&["left","right"].includes(x.side)))return rejected("input");
  const original=existing.map(x=>x.unit),unique=new Set(original);
  if(unique.size!==original.length||unique.has(created)||after.length!==original.length+1||
     new Set(after).size!==after.length||!Array.from(after).every(Boolean)||!after.includes(created))return rejected("identity");
  if(!after.filter(x=>x!==created).every((x,i)=>x===original[i]))return rejected("native-order");
  const same=existing.filter(x=>x.side===side).map(x=>x.unit);
  const expected=side==="left"?[created,...same]:[...same,created];
  const allowed=new Set(expected);
  const actual=after.filter(x=>allowed.has(x));
  // Other-side units do not count as same-side neighbors. An empty side
  // requires no native reorder, even if the new tab is in mid-native order.
  const already=actual.every((x,i)=>x===expected[i]);
  const move=already?null:{native:side==="left"?same[0]:same[same.length-1],before:side==="left"};
  return {status:"planned",side,created,original,expected,move};
}

// Structural proof only: no claim of side metadata commit or native sync.
// Native insertions/removals, changed pre-existing relative order, or a
// wrong outer position must not be reported as a confirmed placement.
export function verifyManualPlusPlacement(plan,after){
  if(plan?.status!=="planned"||!Array.isArray(after)||after.length!==plan.original.length+1||
     new Set(after).size!==after.length||!Array.from(after).every(Boolean)||!after.includes(plan.created))return false;
  if(!after.filter(x=>x!==plan.created).every((x,i)=>x===plan.original[i]))return false;
  const allowed=new Set(plan.expected),actual=after.filter(x=>allowed.has(x));
  return actual.length===plan.expected.length&&actual.every((x,i)=>x===plan.expected[i]);
}
