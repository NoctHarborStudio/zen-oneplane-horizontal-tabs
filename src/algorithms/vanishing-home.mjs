// Elastic Chain 2.0: one gesture-local, measured gap vector. No native
// order or DOM ownership changes until the existing native drop.
export function elasticChainGaps(gaps,source,seam,minimum=3) {
  if(!gaps.length||source<0||source>=gaps.length||seam<0||seam>=gaps.length||
    gaps.some(g=>!Number.isFinite(g)||g<-.5))return null;
  const result=gaps.slice(),extra=Math.max(0,gaps[seam]-minimum);
  result[seam]-=extra;
  // Only gaps between the grabbed slot and the outer edge across Home
  // receive the excess. Both outside edges and the grab stay fixed.
  const first=source<=seam?source:0,last=source<=seam?gaps.length:source;
  for(let j=first;j<last;j++)result[j]+=extra/(last-first);
  return result;
}
export function elasticChainSlots(widths,left,gaps) {
  let x=left;
  return widths.map((w,i)=>{const center=x+w/2;x+=w+(gaps[i]||0);return center;});
}
// Only actual pointer motion may cross a boundary. Re-evaluate the
// adjacent pair in the stable gap vector, not the animated DOM.
export function elasticChainIndex(widths,left,gaps,source,previous,x,direction,buffer=4) {
  const order=widths.map((_,i)=>i).filter(i=>i!==source);
  order.splice(previous,0,source);
  let index=previous;
  if(!direction)return index;
  const dir=Math.sign(direction);
  for(let count=0;count<widths.length;count++){
    const next=index+dir;
    if(next<0||next>=order.length-1)break; // final item is the plus button
    const slots=elasticChainSlots(order.map(i=>widths[i]),left,gaps);
    const threshold=(slots[index]+slots[next])/2+dir*buffer;
    if(dir*(x-threshold)<=0)break;
    [order[index],order[next]]=[order[next],order[index]];
    index=next;
  }
  return index;
}
// Only the immediate neighboring tabs close around the Bunny source.
export function elasticChainPull(slots,widths,index,progress,gap=3) {
  const p=Math.max(0,Math.min(1,progress)),loss=(widths[index]+gap)*.96*p*p*(3-2*p);
  const result=slots.slice();
  if(index>0)result[index-1]+=loss/2;
  if(index+1<slots.length-1)result[index+1]-=loss/2;
  return result;
}
export function vanishingHomeEase(progress) {
  const t=Math.max(0,Math.min(1,progress));
  return t*t*t*(t*(t*6-15)+10);
}
