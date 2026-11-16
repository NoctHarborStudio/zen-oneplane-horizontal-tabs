import { PANEL_CLOSE_GRACE } from "./panel-timing.mjs";
  export function panelDecision(open,direct,native,now,switchUntil,closeSince){
    if(direct)return {open:true,wait:0,closeSince:null};
    if(native){
      if(!open && now<switchUntil)return {open:false,wait:switchUntil-now,closeSince:null};
      return {open:true,wait:0,closeSince:null};
    }
    if(!open)return {open:false,wait:0,closeSince:null};
    const since=closeSince??now;
    const until=Math.max(since+PANEL_CLOSE_GRACE,switchUntil);
    return now<until?{open:true,wait:until-now,closeSince:since}:{open:false,wait:0,closeSince:null};
  }
