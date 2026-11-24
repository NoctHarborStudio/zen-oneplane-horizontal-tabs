// Vanishing Home: gesture-local virtual geometry. Native tab order and
// physical lane ownership remain unchanged until the existing native drop.
export function vanishingHomeSlots(widths, center, plusWidth, gap=3) {
  const total=widths.reduce((sum,w)=>sum+w+gap,0)+plusWidth;
  let x=center-total/2;
  const positions=widths.map(w=>{const left=x;x+=w+gap;return left;});
  return {positions,plus:x,total};
}

export function vanishingHomeIndex(midpoints, x, previous, buffer=8) {
  let i=Math.max(0,Math.min(midpoints.length,previous));
  while(i<midpoints.length&&x>midpoints[i]+buffer)i++;
  while(i>0&&x<midpoints[i-1]-buffer)i--;
  return i;
}

// Both chains close around the disappearing source, retaining their
// original widths and gaps. The source anchor is the full destination slot.
export function vanishingHomePull(widths, index, center, plusWidth, progress, gap=3) {
  const full=vanishingHomeSlots(widths,center,plusWidth,gap);
  const p=Math.max(0,Math.min(1,progress)),smooth=p*p*(3-2*p);
  const ratio=1-.96*smooth,loss=(widths[index]+gap)*(1-ratio);
  const positions=full.positions.map((x,i)=>x+(i<index?loss/2:i>index?-loss/2:0));
  return {positions,plus:full.plus-loss/2,ratio,loss,anchor:full.positions[index]+widths[index]/2};
}

// Pointer pressure is symmetric, constrained to the frozen chrome budget,
// and only moves the chain actually touched by the source.
export function vanishingHomePressure(width,delta,room) {
  const max=Math.min(15,Math.max(8,width*.33));
  return Math.sign(delta)*Math.min(Math.abs(delta),Math.max(0,room),max*(1-Math.exp(-Math.abs(delta)/18)));
}

// Common join clock with zero-velocity/zero-acceleration endpoints.
export function vanishingHomeEase(progress) {
  const t=Math.max(0,Math.min(1,progress));
  return t*t*t*(t*(t*6-15)+10);
}
