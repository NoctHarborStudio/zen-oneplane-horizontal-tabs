// Home Island variant B, approved in the comparison prototype.
export const HOME_ISLAND_DURATION=540;
export const HOME_ISLAND_TRAVEL="--zr-island-travel",HOME_ISLAND_SCALE="--zr-island-scale";
export function registerHomeIslandMotion(css){
  for(const name of [HOME_ISLAND_TRAVEL,HOME_ISLAND_SCALE]){
    try{css.registerProperty({name,syntax:"<number>",inherits:false,initialValue:"1"});}
    catch(e){if(e.name!=="InvalidModificationError")return false;}
  }
  return true;
}
export function homeIslandDistance(bottom){return -Math.max(66,bottom+2);}
export function homeIslandPose(t){
  const clamp=x=>Math.min(1,Math.max(0,x));
  const bezier=(t,x1,y1,x2,y2)=>{
    t=clamp(t);if(t===0||t===1)return t;
    let l=0,r=1;
    const b=(u,a,c)=>3*(1-u)*(1-u)*u*a+3*(1-u)*u*u*c+u*u*u;
    for(let i=0;i<24;i++){const m=(l+r)/2;if(b(m,x1,x2)<t)l=m;else r=m;}
    return b((l+r)/2,y1,y2);
  };
  t=clamp(t);
  const a=clamp(t/.3);
  return {travel:bezier(t,.25,.8,.22,1),scale:.02+.98*bezier((t-.2)/.8,.3,0,.12,1),opacity:a*a*(3-2*a)};
}
export function homeIslandFrames(reverse=false){
  return Array.from({length:81},(_,i)=>({offset:i/80,...homeIslandPose((reverse?80-i:i)/80)}));
}
