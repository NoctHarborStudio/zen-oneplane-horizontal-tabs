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
