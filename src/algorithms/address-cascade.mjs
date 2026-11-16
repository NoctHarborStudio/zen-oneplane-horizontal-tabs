import { addressMotionSample } from "./address-wave.mjs";
  export function cascadeTiming(name,from,to,duration,anchor,left){
    const opening=name==="opening";
    const crossed=t=>opening?anchor+addressMotionSample(name,from,to,t).width>=left:
      anchor+addressMotionSample(name,from,to,t).width<=left;
    let lo=0,hi=1;
    if(crossed(0))hi=0;
    else if(!crossed(1))lo=1;
    else for(let i=0;i<24;i++){
      const m=(lo+hi)/2;
      if(crossed(m))hi=m;else lo=m;
    }
    const crossing=(lo+hi)/2*duration;
    if(opening){
      const end=Math.min(duration,Math.max(Math.min(90,duration),crossing));
      const start=Math.max(0,end-135);
      return {delay:start,duration:Math.max(1,end-start)};
    }
    return {delay:crossing,duration:160};
  }
  export function cascadeKeyframes(opening,x,y,opacity){
    const scale=(a,b)=>a.toFixed(4)+" "+b.toFixed(4);
    if(!opening&&opacity>=.999&&Math.abs(x-1)<.001&&Math.abs(y-1)<.001)
      return [{scale:"1 1",opacity:1},{scale:"1 1",opacity:1}];
    return opening?[
      {offset:0,scale:scale(x,y),opacity,easing:"cubic-bezier(.2,.5,.4,1)"},
      {offset:.22,scale:scale(x*1.07,y*1.07),opacity,easing:"cubic-bezier(.45,0,.65,1)"},
      {offset:1,scale:"0 0",opacity:0}
    ]:[
      {offset:0,scale:scale(x,y),opacity,easing:"cubic-bezier(.15,.7,.3,1)"},
      {offset:.64,scale:"1.12 1.12",opacity:1,easing:"cubic-bezier(.3,0,.5,1)"},
      {offset:1,scale:"1 1",opacity:1}
    ];
  }
