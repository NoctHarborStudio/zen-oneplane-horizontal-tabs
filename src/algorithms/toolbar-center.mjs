import {islandBoundary} from "./island-boundary.mjs";
import {planAdaptiveTabRows} from "./tab-overflow.mjs";
  export function toolbarCenterBias(left,right,trailingReserve,centered){
    const bias=right-left+(centered?0:trailingReserve);
    return {left:Math.max(0,Math.round(bias)),right:Math.max(0,Math.round(-bias))};
  }

  // One pass-local collapsed-slot budget; no live DOM or painted widths.
  export function restingToolbarBudget({widths,groups,windowWidth,right,tabWidth,dragRoom,iconHome,returnReserve}){
    const naturalTabsWidth=widths.reduce((n,w)=>n+w+3,0);
    const boundary=islandBoundary(widths,tabWidth+3);
    const availableAt=leftEdge=>Math.max(0,2*Math.min(windowWidth/2-leftEdge,windowWidth/2-right)-4-2*dragRoom);
    const planAt=available=>{
      const title=iconHome?32:Math.max(100,Math.min(180,available-2*(tabWidth+9)));
      return planAdaptiveTabRows(widths,groups,boundary,available,title,tabWidth,3,returnReserve);
    };
    return {naturalTabsWidth,availableAt,planAt};
  }
  // The plus follows the occupied right lane, not the symmetric row's
  // far edge. Keep the existing expansion reserve in Expand mode.
  export function rightPlusOffset(widths, expansion=0){
    return 3+widths.reduce((sum,w)=>sum+Math.max(0,w)+3,0)+Math.max(0,expansion);
  }

  // Compute every CSS length before partition moves or focus callbacks.
  export function toolbarPartitionMetrics({layout,widths,available,windowWidth,tabWidth,openWidth,iconHome}){
    const widthOf=indices=>indices.reduce((n,i)=>n+widths[i]+3,6);
    const hoverReserve=Math.ceil(tabWidth*.20);
    const expandReserve=layout.mode==="wide"?(iconHome?Math.max(0,openWidth-tabWidth):hoverReserve):0;
    const half=Math.max(widthOf(layout.topLeft),widthOf(layout.topRight)+(layout.topPlus?tabWidth+3:0),tabWidth+9)+expandReserve;
    const topWidth=layout.mode==="wide"?Math.min(available,layout.title+6+2*half):Math.max(layout.title+6,available);
    const bottomBudget=Math.max(tabWidth+6,windowWidth-24);
    const lowerNatural=widthOf(layout.lower)+2*(tabWidth+3)+(iconHome?Math.max(0,openWidth-tabWidth):hoverReserve);
    const bottomWidth=Math.min(bottomBudget,Math.max(3*tabWidth+12,lowerNatural));
    return {islandWidth:layout.title,rowWidth:Math.max(layout.title+6,topWidth),
      plusOffset:rightPlusOffset(layout.topRight.map(i=>widths[i]),expandReserve),
      overflowWidth:bottomWidth,bottomOpen:Math.max(tabWidth,Math.min(openWidth,bottomWidth-2*(tabWidth+3)-6))};
  }
