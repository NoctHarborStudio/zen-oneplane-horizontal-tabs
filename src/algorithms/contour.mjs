  export function contourPath(width,base,deep,left,right,radius){
    const r=Math.max(0,Math.min(radius,(deep-base)/2));
    const outside=radius+4;
    if(!r || left===null || right===null)
      return "M"+(-outside)+" "+base+"H"+(width+outside);
    const start=Math.min(-outside,left-2*r-outside);
    const end=Math.max(width+outside,right+2*r+outside);
    return "M"+start+" "+base+"H"+(left-2*r)+
      " A"+r+" "+r+" 0 0 1 "+(left-r)+" "+(base+r)+
      " V"+(deep-r)+" A"+r+" "+r+" 0 0 0 "+left+" "+deep+
      " H"+right+" A"+r+" "+r+" 0 0 0 "+(right+r)+" "+(deep-r)+
      " V"+(base+r)+" A"+r+" "+r+" 0 0 1 "+(right+2*r)+" "+base+
      " H"+end;
  }
  export function contourAlpha(distance,settings){
    const t=Math.max(0,Math.min(1,(distance-settings.hold)/(settings.length-settings.hold)));
    return settings.strength/100*Math.pow(Math.max(0,1-t*t*(3-2*t)),settings.curve/100);
  }
  export function contourImage(width,height,base,deep,left,right,settings){
    const edge=contourPath(width,base,deep,left,right,settings.radius);
    const startX=Number(edge.match(/^M(-?[\d.]+)/)[1]);
    const steps=64;
    const positions=Array.from({length:steps+1},(_,i)=>settings.length*i/steps);
    positions.push(settings.hold);
    positions.sort((a,b)=>a-b);
    const stops=positions.map(y=>'<stop offset="'+(y/settings.length).toFixed(6)+
      '" stop-color="black" stop-opacity="'+contourAlpha(y,settings).toFixed(6)+'"/>').join("");
    // Both shapes are opaque/partially opaque INSIDE the group. The
    // group itself gets the requested opacity exactly once. Thus the
    // silhouette is always the maximum alpha, never a sum of two tints.
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'">'+
      '<defs><linearGradient id="fade" gradientUnits="userSpaceOnUse" x1="0" y1="'+base+'" x2="0" y2="'+(base+settings.length)+'">'+stops+'</linearGradient></defs>'+
      '<g opacity="'+(1-settings.transparency/100)+'"><rect x="0" y="'+base+'" width="'+width+'" height="'+settings.length+'" fill="url(#fade)"/>'+
      '<path fill="black" d="'+edge+'V-100H'+startX+'Z"/></g></svg>';
    return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';
  }

  // Geometry policy is independent of SVG rendering and of DOM ownership.
  // "visible" follows the clipped native shelf; "stable" reserves the
  // accepted maximum bookmark hover envelope. Do not merge these policies.
  export function readContourSettings(read){
    const bounded=(name,def,min,max)=>{
      const v=read(name,def);
      return Math.max(min,Math.min(max,Number.isFinite(v)?v:def));
    };
    const length=bounded("length",69,10,160);
    return {transparency:bounded("transparency",4,0,40),strength:bounded("strength",100,0,100),
      length,hold:Math.min(length-1,bounded("hold",30,0,45)),curve:bounded("curve",65,25,300),
      radius:bounded("radius",24,4,24),padding:bounded("padding",0,0,20)};
  }
  export function contourGeometry({wrapper,nav,row,bookmark=null,controls=[],shiftY=0,trim=5,settings,mode="visible",availableGrowth=0}){
    const finiteRect=r=>r&&["left","top","right","bottom","width","height"].every(k=>Number.isFinite(r[k]));
    if(!["visible","stable"].includes(mode)||!finiteRect(wrapper)||!finiteRect(nav)||!finiteRect(row)||
      !(wrapper.width>0&&nav.height>0)||![shiftY,trim,availableGrowth].every(Number.isFinite)||
      !settings||!["transparency","strength","length","hold","curve","radius","padding"].every(k=>Number.isFinite(settings[k]))||
      settings.length<=settings.hold||settings.length<=0)return null;
    const width=Math.max(1,Math.round(wrapper.width));
    const base=Math.max(1,Math.round(Math.max(nav.bottom,row.bottom)-wrapper.top-shiftY-trim));
    let left=null,right=null,deep=base,largest=0;
    if(finiteRect(bookmark)&&(mode==="stable"?bookmark.height>=1:bookmark.height>1)){
      for(const c of controls){
        const r=c.rect;
        if(!finiteRect(r)||r.width<1||r.height<1||r.right<=bookmark.left||r.left>=bookmark.right||
          r.bottom<=bookmark.top||r.top>=bookmark.bottom)continue;
        const stable=mode==="stable";
        const l=stable?r.left-wrapper.left:Math.max(0,r.left-wrapper.left,bookmark.left-wrapper.left);
        const h=stable?r.right-wrapper.left:Math.min(width,r.right-wrapper.left,bookmark.right-wrapper.left);
        if(h<=l)continue;
        const growth=stable?c.growthY??0:0,extra=stable?c.growthX??0:0;
        if(![growth,extra].every(Number.isFinite)||growth<0||extra<0)return null;
        left=left===null?l:Math.min(left,l);right=right===null?h:Math.max(right,h);
        deep=Math.max(deep,r.bottom-wrapper.top-shiftY+growth+settings.padding);
        largest=Math.max(largest,extra);
      }
    }
    if(left!==null){
      if(mode==="stable"){
        const extra=Math.min(largest,Math.max(0,availableGrowth));
        left=Math.max(0,left-extra);right=Math.min(width,right+extra);
      }
      if(right<=left){left=right=null;deep=base;}
      else{left=Math.floor(left-settings.padding);right=Math.ceil(right+settings.padding);deep=Math.ceil(deep);}
      if(deep<=base){left=right=null;deep=base;}
    }
    const height=Math.max(1,Math.ceil(Math.max(deep,base+settings.length)+1));
    const key=[width,height,base,deep,left,right,settings.transparency,settings.strength,settings.length,
      settings.hold,settings.curve,settings.radius,settings.padding].join(":");
    return {width,height,base,deep,left,right,key};
  }
  // A failed generator or inline style write must not publish a new key.
  // Restore both old values and priorities if a partial commit throws.
  export function commitContourMask(surface,geometry,settings,render=contourImage){
    const style=surface.style,fields=["--op-contour-height","--op-contour-mask"];
    const prior=fields.map(k=>[k,style.getPropertyValue(k),style.getPropertyPriority(k)]);
    const {width,height,base,deep,left,right}=geometry;
    const mask=render(width,height,base,deep,left,right,settings);
    if(typeof mask!=="string"||!mask)throw Error("invalid contour mask");
    try{
      style.setProperty(fields[0],height+"px");style.setProperty(fields[1],mask);
      if(style.getPropertyValue(fields[0])!==height+"px"||style.getPropertyValue(fields[1])!==mask)throw Error("contour style rejected");
    }catch(error){
      for(const [k,v,p] of prior)try{if(v)style.setProperty(k,v,p);else style.removeProperty(k);}catch{}
      throw error;
    }
    return geometry.key;
  }
