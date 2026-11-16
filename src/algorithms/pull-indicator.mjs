  export function pullIndicatorFactor(progress){
    const t=Math.max(0,Math.min(1,(progress-.06)/.56));
    return (1-t)*(1-t);
  }
