import { ADDRESS_WAVE_SPREAD } from "./address-spread.mjs";
  export function addressWaveDepth(progress,x){
    const t=Math.max(0,Math.min(1,(progress-ADDRESS_WAVE_SPREAD*x)/(1-ADDRESS_WAVE_SPREAD)));
    return t*t*(3-2*t);
  }
  export function addressWaveClip(width,height,header,progress,radius=8,layoutWidth=width){
    width=Math.max(1,width);height=Math.max(1,height);
    const rightInset=Math.max(0,layoutWidth-width);
    header=Math.min(height,Math.max(1,header));
    const r=Math.min(radius,width/2,header/2);
    const depth=x=>header+(height-header)*addressWaveDepth(progress,x);
    if(progress<=0 || progress>=1 || height-header<.5){
      const bottom=progress>=1?0:Math.max(0,height-header);
      return "inset(0px "+rightInset.toFixed(2)+"px "+bottom.toFixed(2)+"px 0px round var(--op-url-radius))";
    }
    const f=n=>n.toFixed(2);
    const left=depth(0),right=depth(1);
    let path="M"+f(r)+" 0 H"+f(width-r)+" Q"+f(width)+" 0 "+f(width)+" "+f(r)+
      " V"+f(right-r)+" Q"+f(width)+" "+f(right)+" "+f(width-r)+" "+f(depth((width-r)/width));
    for(let i=1;i<=24;i++){
      const x=(width-r)-(width-2*r)*i/24;
      path+=" L"+f(x)+" "+f(depth(x/width));
    }
    path+=" Q0 "+f(left)+" 0 "+f(left-r)+" V"+f(r)+" Q0 0 "+f(r)+" 0 Z";
    return 'path("'+path+'")';
  }
  export function addressWaveDuration(from,to,full,duration){
    const fraction=Math.max(Math.abs(to.reveal-from.reveal),
      Math.abs(to.width-from.width)/Math.max(1,full.expanded-full.compact));
    return Math.max(80,duration*Math.min(1,fraction));
  }
  // Prepare all keyframes once. Both axes share the same smooth timeline.
  // The lower edge is relative to the live border-box height: native
  // suggestions can arrive after opening without restarting the animation.
  export function addressMotionSample(name,from,to,t){
    t=Math.max(0,Math.min(1,t));
    const s=t*t*(3-2*t);
    const horizontal=name==="opening"?s+.35*s*(1-s):s-.35*s*(1-s);
    const alpha=from.selection??1;
    return {width:from.width+(to.width-from.width)*horizontal,
      reveal:from.reveal+(to.reveal-from.reveal)*s,
      selection:name==="opening"?alpha+(1-alpha)*s:alpha*(1-Math.min(1,s/.82))};
  }
  export function addressFluidClip(width,header,progress,radius=8,shape=false){
    const w=Math.max(1,width),r=Math.max(0,Math.min(radius,w/2,header/2));
    const px=n=>Number(n.toFixed(3))+"px";
    const y=(x,dy=0)=>{
      const depth=addressWaveDepth(progress,Math.max(0,Math.min(1,x/w)));
      return "calc("+px(header*(1-depth)+dy)+" + "+Number((100*depth).toFixed(4))+"%)";
    };
    if(shape){
      // Identical command topology at every offset, including both endpoints.
      const pt=(x,dy=0)=>px(x)+" "+y(x,dy);
      const edge=(w-r);
      const commands=["from "+px(r)+" 0px","hline to "+px(edge),
        "curve to "+px(w)+" "+px(r)+" with "+px(w)+" 0px",
        "vline to "+y(w,-r),
        "curve to "+pt(edge)+" with "+px(w)+" "+y(w)];
      for(let i=0;i<4;i++){
        const x0=edge-(edge-r)*i/4,x1=edge-(edge-r)*(i+1)/4;
        commands.push("curve to "+pt(x1)+" with "+pt(x0+(x1-x0)/3)+" / "+pt(x0+2*(x1-x0)/3));
      }
      commands.push("curve to 0px "+y(0,-r)+" with 0px "+y(0),
        "vline to "+px(r),"curve to "+px(r)+" 0px with 0px 0px","close");
      return "shape("+commands.join(", ")+")";
    }
    // Compatible polygon fallback. Fixed topology, rounded-corner samples
    // and relative heights. No per-frame path serialization or layout reads.
    const p=[],point=(x,v)=>p.push(px(x)+" "+v);
    for(let i=0;i<=4;i++){
      const t=i*Math.PI/8;point(r-r*Math.cos(t),px(r-r*Math.sin(t)));
    }
    for(let i=0;i<=4;i++){
      const t=i*Math.PI/8;point(w-r+r*Math.sin(t),px(r-r*Math.cos(t)));
    }
    for(let i=0;i<=4;i++){
      const t=i*Math.PI/8;point(w-r+r*Math.cos(t),y(w,-r+r*Math.sin(t)));
    }
    for(let i=0;i<=8;i++){
      const x=(w-r)-(w-2*r)*i/8;point(x,y(x));
    }
    for(let i=0;i<=4;i++){
      const t=i*Math.PI/8;point(r-r*Math.sin(t),y(0,-r+r*Math.cos(t)));
    }
    return "polygon("+p.join(", ")+")";
  }
  export function addressFluidFrames(name,from,to,layoutWidth,header,radius=8,shape=false){
    // These are interpolation knots, not frames or an FPS limit.
    return Array.from({length:17},(_,i)=>{
      const offset=i/16,v=addressMotionSample(name,from,to,offset);
      return {offset,clipPath:addressFluidClip(v.width,header,v.reveal,radius,shape),
        translate:""+(v.width-layoutWidth).toFixed(3)+"px 0px",
        selection:(v.selection*100).toFixed(3)+"%"};
    });
  }
