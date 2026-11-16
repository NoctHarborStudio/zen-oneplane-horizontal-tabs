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
