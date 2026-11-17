// Pure per-window Library state. Native IO and animations live outside.
export const LIBRARY_SECTIONS=Object.freeze(["downloads","documents","history","pictures","closed"]);
const valid=section=>LIBRARY_SECTIONS.includes(section);
export function createLibraryState(){
  return {phase:"closed",section:"history",query:"",filter:"all",sort:"new",motionEpoch:0,queryEpoch:0};
}
function enter(s,section,phase){
  return {...s,phase,section,query:"",filter:"all",sort:"new",
    motionEpoch:s.motionEpoch+1,queryEpoch:s.queryEpoch+1};
}
export function reduceLibrary(s,event){
  switch(event.type){
    case "OPEN":{
      if(!valid(event.section))return s;
      if(s.phase==="closed"||s.phase==="closing")return enter(s,event.section,"opening");
      if(s.section===event.section)return s;
      return enter(s,event.section,s.phase==="opening"?"opening":"switching");
    }
    case "TOGGLE":{
      if(!valid(event.section))return s;
      if(s.phase!=="closed"&&s.phase!=="closing"&&s.section===event.section)
        return reduceLibrary(s,{type:"CLOSE"});
      return reduceLibrary(s,{type:"OPEN",section:event.section});
    }
    case "CLOSE":
      if(s.phase==="closed"||s.phase==="closing")return s;
      return {...s,phase:"closing",motionEpoch:s.motionEpoch+1,queryEpoch:s.queryEpoch+1};
    case "MOTION_DONE":
      if(event.epoch!==s.motionEpoch)return s;
      if(s.phase==="closing")return {...s,phase:"closed",section:"history",query:"",filter:"all",sort:"new"};
      if(s.phase==="opening"||s.phase==="switching")return {...s,phase:"open"};
      return s;
    case "QUERY":
    case "FILTER":
    case "SORT":{
      if(s.phase==="closed"||s.phase==="closing"||typeof event.value!=="string")return s;
      const key=event.type.toLowerCase();
      return s[key]===event.value?s:{...s,[key]:event.value,queryEpoch:s.queryEpoch+1};
    }
    case "INVALIDATE":
      return s.phase==="closed"||s.phase==="closing"?s:{...s,queryEpoch:s.queryEpoch+1};
    case "DISPOSE":
      return {...createLibraryState(),motionEpoch:s.motionEpoch+1,queryEpoch:s.queryEpoch+1};
    default:return s;
  }
}
export function isCurrentLibraryQuery(s,epoch,section){
  return s.phase!=="closed"&&s.phase!=="closing"&&s.queryEpoch===epoch&&s.section===section;
}
