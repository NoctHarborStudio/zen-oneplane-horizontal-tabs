import { addressMotionSample } from "./address-wave.mjs";
  export function cascadeRevealSchedule(items,phase,anchor){
    // Input is right-to-left. Only visible cards count. Keep the
    // whole return bounded even for a crowded strip.
    const span=phase?.duration??0;
    const step=Math.min(32,240/Math.max(1,items.length-1));
    let previous=-step;
    return items.map(v=>{
      let edge=0;
      if(phase){
        const crossed=t=>anchor+addressMotionSample(phase.name,phase.from,phase.to,t).width<=v.left;
        let lo=0,hi=1;
        if(crossed(0))hi=0;
        else if(!crossed(1))lo=1;
        else for(let i=0;i<16;i++){
          const m=(lo+hi)/2;
          if(crossed(m))hi=m;else lo=m;
        }
        edge=(lo+hi)/2*span;
      }
      const delay=Math.max(previous+step,edge);
      previous=delay;
      return {delay,duration:190};
    });
  }
  export function cascadeRevealFrames(v){
    // Each edge grows at most half of its measured gap, minus a
    // safety margin. Independent animations cannot cross each other.
    // No shared quadratic timeline, width writes or moving partitions.
    const grow=Math.max(0,Math.min(1.4,(v.leftGap-.8)/2,(v.rightGap-.8)/2));
    const peakX=Math.min(1.10,1+2*grow/Math.max(1,v.width));
    const scale=(x,y)=>x.toFixed(6)+" "+y.toFixed(6);
    return [
      {offset:0,scale:"0 0",opacity:0,easing:"cubic-bezier(.18,.7,.25,1)"},
      {offset:.68,scale:scale(peakX,1.14),opacity:1,easing:"cubic-bezier(.3,0,.5,1)"},
      {offset:1,scale:"1 1",opacity:1}
    ];
  }
