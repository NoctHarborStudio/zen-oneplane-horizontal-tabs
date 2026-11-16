import { addressMotionSample, addressWaveDepth } from "./address-wave.mjs";
  export function cascadeWaveSchedule(items,phase,geometry,opening){
    const span=phase?.duration??(opening?180:0);
    const step=Math.min(opening?24:32,(opening?Math.max(0,span-85):240)/Math.max(1,items.length-1));
    let previous=-step;
    return items.map((v,i)=>{
      let edge=opening?span:0;
      if(phase){
        const covered=t=>{
          const sample=addressMotionSample(phase.name,phase.from,phase.to,t);
          if(geometry.left+sample.width<v.left)return false;
          if(!v.bookmark)return true;
          const depth=addressWaveDepth(sample.reveal,Math.max(0,Math.min(1,(v.left-geometry.left)/Math.max(1,sample.width))));
          return geometry.top+geometry.header+Math.max(0,geometry.height-geometry.header)*depth>=v.top;
        };
        const crossed=t=>opening?covered(t):!covered(t);
        let lo=0,hi=1;
        if(crossed(0))hi=0;
        else if(!crossed(1))lo=1;
        else for(let j=0;j<16;j++){
          const m=(lo+hi)/2;
          if(crossed(m))hi=m;else lo=m;
        }
        edge=(lo+hi)/2*span;
      }
      let delay,duration;
      if(opening){
        duration=Math.min(85,Math.max(1,span));
        const limit=Math.max(0,span-duration-step*(items.length-1-i));
        delay=Math.min(limit,Math.max(previous+step,edge-duration));
      }else{
        duration=190;
        delay=Math.max(previous+step,edge);
      }
      previous=delay;
      return {delay,duration};
    });
  }
  export function cascadeRevealFrames(v={}){
    const opacity=Math.max(0,Math.min(1,v.opacity??0));
    const x=Math.max(0,Math.min(1,v.x??0)),y=Math.max(0,Math.min(1,v.y??0));
    // The whole painted card remains within its resting slot. All
    // easing control points are monotonic and have no external overshoot.
    if(x>=.999&&y>=.999&&opacity>=.999)
      return [{offset:0,scale:"1 1",opacity:1},{offset:1,scale:"1 1",opacity:1}];
    return [
      {offset:0,scale:x+" "+y,opacity,easing:"cubic-bezier(.18,.7,.25,1)"},
      {offset:.55,scale:"1 1",opacity:1,easing:"cubic-bezier(.3,0,.5,1)"},
      {offset:.78,scale:"0.93 0.93",opacity:1,easing:"cubic-bezier(.2,.7,.3,1)"},
      {offset:1,scale:"1 1",opacity:1}
    ];
  }
  export function cascadeFadeFrames(opacity,opening){
    return [{opacity:Math.max(0,Math.min(1,opacity))},{opacity:opening?0:1}];
  }
