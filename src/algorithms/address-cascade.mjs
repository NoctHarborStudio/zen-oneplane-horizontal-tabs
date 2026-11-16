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
  export function cascadeSchedule(opening,items,phase,anchor){
    const count=items.length;
    if(!count)return [];
    const span=phase?.duration??(opening?420:380);
    // Stagger actual cards only; outlines and underline are followers.
    // Bound total latency for large strips, not a fixed per-tab timer.
    const step=Math.min(opening?28:36,(opening?Math.max(0,span-100):480)/Math.max(1,count-1));
    let previous=-step;
    return items.map((v,i)=>{
      const edge=phase?cascadeTiming(phase.name,phase.from,phase.to,span,anchor,v.left):null;
      let delay=Math.max(previous+step,edge?.delay??i*step);
      if(opening)delay=Math.min(delay,Math.max(0,span-100-step*(count-i-1)));
      else delay=Math.min(delay,span+480-step*(count-i-1));
      previous=delay;
      return {delay,duration:opening?Math.min(145,Math.max(1,span-delay)):190};
    });
  }
  export function cascadeSample(opening,v,t){
    const clamp=x=>Math.max(0,Math.min(1,x));
    const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
    t=clamp(t);
    const fromX=v.x,fromY=v.y,fromOpacity=v.opacity;
    const dx=v.dx??0;
    const ty=v.currentTy??v.ty;
    const finalTy=v.finalTy??v.ty;
    const openingX=Math.min(Math.max(peakLimit(v.width),fromX),fromX*1.045);
    const openingY=Math.min(Math.max(1.23,fromY),fromY*1.045);
    const motion=(x,y,opacity)=>({x,y,opacity,dx:dx*(1-smooth(t)),ty:ty+(finalTy-ty)*smooth(t)});
    function peakLimit(width){return Math.min(1.10,1+2.8/Math.max(1,width));}
    // Long cards retain a vertical spring, not a 20px horizontal bulge.
    const peakX=peakLimit(v.width);
    if(opening){
      if(t<.20){
        const k=smooth(t/.20);
        return motion(fromX+(openingX-fromX)*k,fromY+(openingY-fromY)*k,fromOpacity);
      }
      const k=smooth((t-.20)/.80);
      return motion(openingX*(1-k),openingY*(1-k),fromOpacity*(1-k*k));
    }
    if(t<.68){
      const k=smooth(t/.68);
      return motion(fromX+(peakX-fromX)*k,fromY+(1.14-fromY)*k,fromOpacity+(1-fromOpacity)*smooth(t/.45));
    }
    const k=smooth((t-.68)/.32);
    return motion(peakX+(1-peakX)*k,1.14+(1-1.14)*k,1);
  }
  export function cascadeFit(slots,values){
    // A moving partition of adjacent slots allocates spare room to the
    // growing card. Shared boundaries enforce separation; intersect with
    // each card's group/viewport bounds to protect split and island edges.
    // All returned edges are linear between the common WAAPI knots.
    const n=slots.length,boundaries=[];
    for(let i=0;i<n-1;i++){
      const a=slots[i],b=slots[i+1];
      const mid=(a.right+b.left)/2;
      const excessA=(values[i].x-1)*a.width;
      const excessB=(values[i+1].x-1)*b.width;
      const shift=Math.max(-3,Math.min(3,(excessA-excessB)/4));
      // A clipped lane may have a virtual slot extending under the
      // island; its native overflow clip owns that separation.
      boundaries.push(a.right>b.left&&a.region!==b.region?null:mid+shift);
    }
    return slots.map((v,i)=>{
      const left=Math.max(v.min??-Infinity,i&&boundaries[i-1]!==null?boundaries[i-1]+.5:v.left-2);
      const right=Math.min(v.max??Infinity,i<n-1&&boundaries[i]!==null?boundaries[i]-.5:v.right+2);
      const center=(v.left+v.right)/2;
      const width=Math.max(0,Math.min(v.width*values[i].x,right-left));
      const desired=center+(values[i].dx??0);
      const x=right>=left?Math.min(right-width/2,Math.max(left+width/2,desired)):center;
      return {...values[i],x:width/Math.max(1,v.width),dx:x-center};
    });
  }
  export function cascadePlan(opening,slots,schedule){
    const total=Math.max(1,...schedule.map(t=>t.delay+t.duration));
    // Common knot times include each local impulse and its extrema;
    // interpolate linearly so non-overlap holds between knots as well.
    const times=new Set([0,total]);
    for(const {delay,duration} of schedule)
      for(const t of [0,.1,.2,.35,.45,.55,.68,.82,1])times.add(delay+duration*t);
    const frames=slots.map(()=>[]);
    for(const ms of [...times].sort((a,b)=>a-b)){
      const values=slots.map((v,i)=>{
        const t=schedule[i];
        return cascadeSample(opening,v,(ms-t.delay)/t.duration);
      });
      const fitted=cascadeFit(slots,values);
      for(let i=0;i<slots.length;i++){
        const v=fitted[i];
        frames[i].push({offset:ms/total,scale:v.x.toFixed(6)+" "+v.y.toFixed(6),
          translate:(slots[i].tx+v.dx).toFixed(5)+"px "+v.ty.toFixed(5)+"px",
          opacity:v.opacity});
      }
    }
    return {total,frames};
  }
