// AL2a: source-only candidate; not in the runtime build plan.
// One atomic native unit per width, explicit sides, pass-local geometry.
// Existing Layout remains the sole eventual production owner.
export function planResponsiveTabRows(input) {
  const {mode,widths,sides,top,bottom,center,homeWidth,iconWidth=32,plusWidth,gap=3,previousHomeRow=0,enterGain=2,stayGain=1}=input??{};
  const positive=v=>Number.isFinite(v)&&v>0;
  const interval=v=>v&&Number.isFinite(v.start)&&Number.isFinite(v.end)&&v.end>=v.start;
  if(!["automatic","manual"].includes(mode)||!Array.isArray(widths)||!Array.isArray(sides)||
     widths.length!==sides.length||!Array.from(widths).every(positive)||
     !Array.from(sides).every(s=>s==="left"||s==="right")||!interval(top)||!interval(bottom)||
     !Number.isFinite(center)||!positive(homeWidth)||!positive(iconWidth)||iconWidth>homeWidth||
     !positive(plusWidth)||!Number.isFinite(gap)||gap<0||![0,1].includes(previousHomeRow)||
     !Number.isSafeInteger(enterGain)||!Number.isSafeInteger(stayGain)||stayGain<1||enterGain<stayGain)
    throw new TypeError("Invalid responsive tab geometry");
  const L=[],R=[];
  for(let i=0;i<sides.length;i++)(sides[i]==="left"?L:R).push(i);
  L.reverse();
  if(mode==="manual")L.push("plus-left");
  R.push("plus-right");
  const width=s=>typeof s==="number"?widths[s]:plusWidth;
  const prefix=seq=>{const p=[0];for(const s of seq)p.push(p[p.length-1]+width(s)+gap);return p;};
  const lp=prefix(L),rp=prefix(R);
  const extent=(p,a,b)=>a===b?0:p[b]-p[a]-gap;
  const fit=(p,capacity)=>{let i=0;while(i+1<p.length&&extent(p,0,i+1)<=capacity)i++;return i;};
  const halves=(bounds,title)=>({left:Math.max(0,center-title/2-gap-bounds.start),right:Math.max(0,bounds.end-center-title/2-gap)});
  const homeFits=(bounds,title)=>center-title/2>=bounds.start&&center+title/2<=bounds.end;
  const tabs=seq=>seq.reduce((n,s)=>n+Number(typeof s==="number"),0);
  const region=(id,side,row,seq,capacity,scroll,near=true)=>{
    const p=prefix(seq),used=extent(p,0,seq.length),visible=fit(p,capacity),visibleTabs=tabs(seq.slice(0,visible));
    return {id,side,row,slots:side==="left"&&near?seq.slice().reverse():seq.slice(),capacity,used,
      scrollable:scroll&&used>capacity,visibleTabs,visibleControls:visible-visibleTabs};
  };
  const viable=(seq,c)=>!seq.length||c>=Math.min(plusWidth,width(seq[0]));
  const candidate=(homeRow,title,regions)=>({status:"planned",mode,sides:sides.slice(),homeRow,homeWidth:title,center,regions,
    hasSecondRow:homeRow===1||regions.some(r=>r.row===1&&r.slots.length>0),
    visibleTabs:regions.reduce((n,r)=>n+r.visibleTabs,0),visibleControls:regions.reduce((n,r)=>n+r.visibleControls,0)});
  function homeTop(title){
    if(!homeFits(top,title))return null;
    const c=halves(top,title),l=fit(lp,c.left),r=fit(rp,c.right),ll=L.slice(l),rr=R.slice(r);
    const regions=[region("top-left","left",0,L.slice(0,l),c.left,false),region("top-right","right",0,R.slice(0,r),c.right,false)];
    if(mode==="automatic"&&ll.length+rr.length&&tabs(ll)+tabs(rr)===0)return null;
    if(ll.length||rr.length){
      if(mode==="automatic"){
        const merged=[...ll,...rr].filter(Number.isInteger).sort((a,b)=>a-b);
        if(rr.includes("plus-right"))merged.push("plus-right");
        const c=bottom.end-bottom.start;
        if(!viable(merged,c))return null;
        regions.push(region("bottom",null,1,merged,c,true,false));
      }else if(ll.length&&rr.length){
        const a=Math.max(0,center-gap/2-bottom.start),b=Math.max(0,bottom.end-center-gap/2);
        if(!viable(ll,a)||!viable(rr,b))return null;
        regions.push(region("bottom-left","left",1,ll,a,true),region("bottom-right","right",1,rr,b,true));
      }else{
        const seq=ll.length?ll:rr,side=ll.length?"left":"right",c=bottom.end-bottom.start;
        if(!viable(seq,c))return null;
        regions.push(region("bottom",side,1,seq,c,true));
      }
    }
    return candidate(0,title,regions);
  }
  function homeBottom(title){
    if(!homeFits(bottom,title))return null;
    const c=halves(bottom,title),space=top.end-top.start,lf=fit(lp,c.left),rf=fit(rp,c.right);
    const n=L.length,m=R.length,hasL=mode==="manual";
    const upperTabs=(len,plus)=>len-Number(plus&&len>0);
    const lowerTabs=(len,fitCount,total,plus)=>Math.min(len,fitCount)-Number(plus&&len===total&&fitCount>=len&&len>0);
    let j=m,best=null;
    for(let i=0;i<=n;i++){
      const cost=lp[n]-lp[n-i];
      if(i&&cost>space+gap)break;
      while(j>0&&cost+rp[m]-rp[m-j]>space+gap)j--;
      const a=n-i,b=m-j;
      if((a&&c.left<Math.min(plusWidth,width(L[0])))||(b&&c.right<Math.min(plusWidth,width(R[0]))))continue;
      const visible=upperTabs(i,hasL)+upperTabs(j,true)+lowerTabs(a,lf,n,hasL)+lowerTabs(b,rf,m,true);
      const controls=Number(hasL&&(i>0||(a===n&&lf>=n)))+Number(j>0||(b===m&&rf>=m));
      const imbalance=Math.abs(extent(lp,n-i,n)-extent(rp,m-j,m));
      const score=[visible,controls,i+j,-imbalance];
      if(!best||score.some((v,k)=>v>best.score[k]&&score.slice(0,k).every((x,h)=>x===best.score[h])))best={i,j,score};
    }
    if(!best)return null;
    const a=n-best.i,b=m-best.j;
    return candidate(1,title,[
      region("top-left","left",0,L.slice(a),extent(lp,a,n),false),
      region("top-right","right",0,R.slice(b),extent(rp,b,m),false),
      region("bottom-left","left",1,L.slice(0,a),c.left,true),
      region("bottom-right","right",1,R.slice(0,b),c.right,true)
    ]);
  }
  const up=homeTop(homeWidth),down=homeBottom(homeWidth);
  if(up&&!up.hasSecondRow)return {...up,reason:"all-fit"};
  const iconUp=iconWidth<homeWidth?homeTop(iconWidth):null;
  if(iconUp&&!iconUp.hasSecondRow&&(!up||up.visibleTabs===widths.length))return {...iconUp,reason:"single-row-icon"};
  if(up&&down){
    const gain=down.visibleTabs-up.visibleTabs;
    return gain>=(previousHomeRow===1?stayGain:enterGain)?{...down,reason:"visibility-gain"}:{...up,reason:"keep-home-top"};
  }
  if(up)return {...up,reason:"keep-home-top"};
  if(down)return {...down,reason:"top-infeasible"};
  if(iconUp)return {...iconUp,reason:"icon-fallback"};
  const iconDown=iconWidth<homeWidth?homeBottom(iconWidth):null;
  if(iconDown)return {...iconDown,reason:"icon-fallback"};
  return {status:"unavailable",reason:"insufficient-geometry"};
}
