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

// Dual-row conveyor candidate shared by all Center Motion owners and the Lab.
export function createCenterFlowPlan(cards) {
  // One resting geometry snapshot; no DOM reads or time-dependent state.
  // Each side is a conveyor: all members share the same horizontal shift.
  const clamp = p => Math.max(0, Math.min(1, p));
  const ease = p => { p = clamp(p); return p*p*p*(p*(6*p-15)+10); };
  const soft = p => { p = clamp(p); return p*p*(3-2*p); };
  const pad = 8, epsilon = .5;
  const slots = cards.map(c => {
    const {x,y,cx,cy,opacity,r,lower,hub} = c;
    const w = r?.width, h = r?.height;
    if (![x,y,cx,cy,opacity,w,h].every(Number.isFinite) || w <= 0 || h <= 0 || opacity < 0 || opacity > 1)
      throw Error("center-flow-geometry");
    return {x,y,cx,cy,opacity,w,h,lower:!!lower,hub,left:x-w/2,right:x+w/2,top:y-h/2,bottom:y+h/2};
  });
  const rows = [slots.filter(c=>!c.lower), slots.filter(c=>c.lower)];
  const two = rows.every(row=>row.length);
  const lowerTop = rows[1].length ? Math.min(...rows[1].map(c=>c.top)) : 0;
  const upperBottom = rows[0].length ? Math.max(...rows[0].map(c=>c.bottom)) : lowerTop;
  if (two && upperBottom > lowerTop + epsilon) throw Error("center-flow-row-overlap");
  const lowerClip = two ? Math.min(lowerTop,(upperBottom+lowerTop)/2) : lowerTop;
  const assigned = new Map();
  for (const row of rows) {
    if (!row.length) continue;
    const sorted = row.slice().sort((a,b)=>a.left-b.left);
    for (let i=1;i<sorted.length;i++)
      if (sorted[i-1].right > sorted[i].left + epsilon) throw Error("center-flow-slot-overlap");
    const cx = row[0].cx;
    if (row.some(c=>Math.abs(c.cx-cx)>epsilon)) throw Error("center-flow-anchor");
    const central = sorted.filter(c=>c.left<cx && c.right>cx);
    if (central.length>1) throw Error("center-flow-center");
    const middle = central[0];
    if (middle) assigned.set(middle,{side:0,boundary:cx,travel:0});
    for (const side of [-1,1]) {
      const group=sorted.filter(c=>c!==middle && (side<0?c.x<cx:c.x>=cx));
      if(!group.length)continue;
      const near=side<0?Math.max(...group.map(c=>c.right)):Math.min(...group.map(c=>c.left));
      const hub=row[0].hub;
      const edge=middle?(side<0?middle.left:middle.right):
        !row[0].lower&&hub&&Number.isFinite(side<0?hub.left:hub.right)?(side<0?hub.left:hub.right):cx;
      // A portal must never clip a real resting slot. Native partial
      // slots are rejected by the existing owner before this plan.
      const boundary=side<0?Math.max(edge,near):Math.min(edge,near);
      const travel=Math.max(...group.map(c=>side*(c.x-boundary)+c.w/2))+pad;
      for (const c of group) assigned.set(c,{side,boundary,travel});
    }
  }
  function sample(index,p) {
    const c=slots[index], g=assigned.get(c);
    if(!c||!g)throw Error("center-flow-slot");
    p=clamp(p);
    // Lower row begins later and overlaps the top row's outward flow.
    const q=two?(c.lower?clamp((p-.18)/.82):clamp(p/.82)):p;
    if(q===1)return {x:0,y:0,a:c.opacity,clip:[-pad,-pad,-pad,-pad]};
    const progress=ease(q);
    const dx=-g.side*g.travel*(1-progress);
    const lead=g.side?g.side*(c.x+dx-g.boundary)+c.w/2:0;
    const descend=g.side?soft(lead/c.w):progress;
    const dy=c.lower?(c.cy-c.y)*(1-descend):0;
    const clip=[-pad,-pad,-pad,-pad]; // top/right/bottom/left
    const bound=(v,size)=>Math.max(-pad,Math.min(size+pad,v));
    if(g.side<0)clip[1]=bound(c.right+dx-g.boundary,c.w);
    if(g.side>0)clip[3]=bound(g.boundary-c.left-dx,c.w);
    if(c.lower)clip[0]=bound(lowerClip-(c.top+dy),c.h);
    const horizontal=g.side?soft(lead/Math.min(c.w,18)):soft(q/.4);
    const vertical=c.lower?soft((c.bottom+dy-lowerClip)/Math.min(c.h,12)):1;
    return {x:dx,y:dy,a:q===0?0:c.opacity*horizontal*vertical,clip};
  }
  function keyframes(index,reverse=false) {
    return Array.from({length:81},(_,i)=>{
      const f=sample(index,(reverse?80-i:i)/80);
      return {offset:i/80,transform:`translate(${f.x}px,${f.y}px) scale(1)`,opacity:f.a,
        clipPath:`inset(${f.clip.map(v=>`${v}px`).join(" ")})`};
    });
  }
  return {sample,keyframes};
}
