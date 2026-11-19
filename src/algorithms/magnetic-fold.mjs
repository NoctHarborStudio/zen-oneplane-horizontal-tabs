// Existing Magnetic Fold math; shared by Center Motion and the comparison Lab.
// Preserve the original sampled curve and portal clipping exactly.
export function createMagneticFoldMath(){
  // Magnetic Fold, ported from Motion Lab B. p=0 docked, p=1 resting.
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const smooth=p=>{p=clamp(p);return p*p*(3-2*p);};
  function rawMagnetState(c,p){
    const q=1-p,d=Math.abs(c.x-c.cx),unit=c.unit,lower=c.lower;
    if(lower&&d<12*unit){
      const f=1-smooth(q/.12);
      return {x:(c.cx-c.x)*(1-f),y:(c.cy-c.y)*(1-f),s:Math.max(.02,f),a:f*c.opacity};
    }
    const f=1-smooth((q-(lower?.12:0))/(lower?.88:1));
    const remaining=d*f,threshold=Math.min(d,(lower?26:65)*unit);
    const dock=smooth(remaining/Math.max(.001,threshold));
    const alpha=d<.001?f:smooth(remaining/Math.max(.001,Math.min(d,20*unit)));
    const shrink=d<.001?f:Math.min(1,remaining/Math.max(.001,Math.min(d,(lower?26:48)*unit)));
    return {x:(c.cx-c.x)*(1-f),y:lower?(c.cy-c.y)*(1-dock):0,s:clamp(f*shrink,.02,1),a:alpha*c.opacity};
  }
  // The portal has real dimensions, not just a mathematical center.
  // Fade outside its edge; a transparent Home must never reveal a card
  // traveling behind its title or icon.
  function portalGap(c,f){
    const h=c.hub;
    if(!h)return Infinity;
    const x=c.x+f.x,y=c.y+f.y,w=c.r.width*f.s/2,z=c.r.height*f.s/2;
    return Math.max(h.left-x-w,x-w-h.right,h.top-y-z,y-z-h.bottom);
  }
  function magnetState(c,p){
    const f=rawMagnetState(c,p);
    if(!c.hub)return f;
    const resting=portalGap(c,{x:0,y:0,s:1});
    // A preexisting intersection belongs to native layout, not this effect.
    if(resting<=0)return f;
    const fade=Math.min(resting,24*c.unit);
    return {...f,a:f.a*smooth(portalGap(c,f)/fade)};
  }
  function portalClip(h,rr,width,height){
    // Even-odd hole: final safety net for between-keyframe interpolation
    // and the translucent Home background. Do not clip the overflow lane.
    const extent=Math.ceil(Math.max(width,height,rr.width,rr.height)+32);
    const l=h.left-rr.left,t=h.top-rr.top,r=h.right-rr.left,b=h.bottom-rr.top;
    return 'path(evenodd, "M '+(-extent)+' '+(-extent)+' H '+extent+' V '+extent+' H '+(-extent)+' Z M '+l+' '+t+' H '+r+' V '+b+' H '+l+' Z")';
  }
  function keyframes(c,reverse=false){
    // Sample the shared continuous curve once, not during playback. Linear
    // interpolation between samples preserves the Lab timing and reversal.
    return Array.from({length:41},(_,i)=>{
      const offset=i/40,p=(reverse?40-i:i)/40,f=magnetState(c,p);
      return {offset,transform:"translate("+f.x+"px,"+f.y+"px) scale("+f.s+")",opacity:f.a};
    });
  }
  return {smooth,magnetState,keyframes,portalGap,portalClip};
}
