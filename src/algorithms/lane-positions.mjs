  export function lanePositions(widths,boundary,leftEdge,rightEdge,gap){
    const positions=[];
    const leftWidth=widths.slice(0,boundary).reduce((s,w)=>s+w,0)+Math.max(0,boundary-1)*gap;
    let x=leftEdge-leftWidth;
    for(let i=0;i<widths.length;i++){
      if(i===boundary)x=rightEdge;
      positions.push(x);x+=widths[i]+gap;
    }
    return positions;
  }
