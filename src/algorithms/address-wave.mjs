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
