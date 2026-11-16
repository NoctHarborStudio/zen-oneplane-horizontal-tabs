  export function islandBoundary(widths, plusWidth, gap=3) {
    if (widths.length < 2) return widths.length;
    const total=widths.reduce((sum,w)=>sum+w+gap,0);
    let left=0,best=1,score=Infinity;
    for(let i=1;i<widths.length;i++){
      left+=widths[i-1]+gap;
      const diff=Math.abs(left-(total-left+plusWidth));
      if(diff<score){score=diff;best=i;}
    }
    return best;
  }
