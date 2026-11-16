  export function toolbarCenterBias(left,right,trailingReserve,centered){
    const bias=right-left+(centered?0:trailingReserve);
    return {left:Math.max(0,Math.round(bias)),right:Math.max(0,Math.round(-bias))};
  }
