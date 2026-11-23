// Nocturne preview.36: early trace, independent Sine script order.
try{if(typeof window!=="undefined"){
  const event="startup-prefs.script",data={version:"0.3.0-preview.158"};
  if(window.__nocturneTrace)window.__nocturneTrace(event,data,{sample:1500});
  else{const q=window.__nocturneEarlyTrace??(window.__nocturneEarlyTrace=[]);if(q.length<32)q.push({event,t:window.performance?.now?.()??0,data});}
}}catch{}
/* Zen Refined — startup placeholders. Only these two native prefs are
 * changed, and only while the corresponding Sine option is enabled.
 * Persist ownership across normal exits because the skeleton is created
 * before Sine loads. Restore the exact previous user/default state on off.
 */
const OPTION="zen.refined.startup.disable-placeholders";
const BACKUP="zen.refined.startup.previous-placeholders";
const TARGETS=["browser.startup.blankWindow","browser.startup.preXulSkeletonUI"];
const prefs=Services.prefs;
const KEY="__zenRefinedStartupPlaceholders",PENDING=KEY+"Pending";
const LEGACY_ID="9d788b55-d497-41da-8444-993c603e89e4";
// Sine owns mod installation state. Read it only for diagnostics, never
// change the other mod, and do not hold up browser startup.
async function warnLegacyConflict(getMods,logger){
  try{
    const mods=await getMods();
    if(mods?.[LEGACY_ID]?.enabled===true){
      logger.warn("[Nocturne] Legacy Zen Refined is still enabled. Disable it in Sine and restart Zen; dual ownership is unsupported.");
      return true;
    }
  }catch{} // optional diagnostics must not block startup
  return false;
}
function readBackup(){
  const backup=JSON.parse(prefs.getStringPref(BACKUP,"{}"));
  if(!backup||typeof backup!=="object"||Array.isArray(backup)||
     Object.keys(backup).some(name=>!TARGETS.includes(name)||
       typeof backup[name]?.user!=="boolean"||typeof backup[name]?.value!=="boolean"||
       (backup[name].released!==undefined&&typeof backup[name].released!=="boolean")))
    throw Error("Invalid startup preference backup");
  return backup;
}
function trace(event,data){try{window.__nocturneTrace?.(event,data,{flush:true});}catch{}}
function checkpoint(backup){prefs.setStringPref(BACKUP,JSON.stringify(backup));}
const STARTUP_ERROR_CLASSES=new Set(["Error","TypeError","RangeError","ReferenceError","SyntaxError","URIError","EvalError","AggregateError","DOMException","AbortError","NotAllowedError","InvalidStateError","NotFoundError","NotSupportedError","SecurityError","DataCloneError","NetworkError","TimeoutError","QuotaExceededError","WorkspaceCommandError","NS_ERROR_FAILURE","NS_ERROR_ABORT","NS_ERROR_NOT_AVAILABLE","NS_ERROR_UNEXPECTED","NS_ERROR_NOT_INITIALIZED","NS_ERROR_FILE_NOT_FOUND","NS_ERROR_XPC_BAD_CONVERT_JS"]);
function startupErrorClass(error){try{const name=error?.name;return typeof name==="string"&&STARTUP_ERROR_CLASSES.has(name)?name:"Error";}catch{return "Error";}}

function persist(){try{prefs.savePrefFile(null);}catch(error){console.warn("[Zen Refined] Could not save startup preferences",startupErrorClass(error));}}
function apply(){
    typeof window!=="undefined"&&window.__nocturneTrace?.("startup-prefs.apply",()=>(null),{sample:1800});
  const backup=readBackup();let changed=false;
  for(const name of TARGETS){
    if(disposed)break;
    try{
      if(prefs.prefIsLocked(name)||prefs.getPrefType(name)!==prefs.PREF_BOOL)continue;
      if(prefs.getBoolPref(name)===false)continue;
      if(!Object.hasOwn(backup,name)||backup[name].released===true){
        backup[name]={user:prefs.prefHasUserValue(name),value:prefs.getBoolPref(name)};
        checkpoint(backup);
      }
      if(disposed)break;
      prefs.setBoolPref(name,false);changed=true;
    }catch(error){console.warn("[Zen Refined] Startup preference",name,startupErrorClass(error));}
  }
  if(changed)persist();
}
function restore(){
  trace("startup-prefs.restore",null);
  const backup=readBackup();let restored=0,skipped=0,failed=0,checkpointFailed=false;
  for(const name of TARGETS){
    const old=backup[name];if(!old||old.released===true)continue;
    try{
      if(prefs.prefIsLocked(name)||prefs.getPrefType(name)!==prefs.PREF_BOOL)throw Error("Startup preference unavailable");
      // Only a user value written by the mod can still be ours.
      if(prefs.getBoolPref(name)===false&&prefs.prefHasUserValue(name)){
        if(old.user)prefs.setBoolPref(name,old.value);else prefs.clearUserPref(name);
        restored++;
      }else skipped++;
      old.released=true;
      // Retain progress even when another key or backup deletion fails.
      try{checkpoint(backup);}catch{checkpointFailed=true;}
    }catch(error){failed++;console.warn("[Zen Refined] Startup restore",name,startupErrorClass(error));}
  }
  if(Object.keys(backup).length){
    if(!failed){
      try{prefs.clearUserPref(BACKUP);}
      catch{failed++;try{checkpoint(backup);}catch{checkpointFailed=true;}}
    }else{
      try{checkpoint(backup);}catch{checkpointFailed=true;}
    }
    persist();
  }
  trace("startup-prefs.restore.result",{restored,skipped,failed,checkpointFailed});
}
function sync(){
  if(disposed)return;
  if(mutating){pendingSync=true;return;}
  mutating=true;
  try{
    do{
      pendingSync=false;
      try{if(prefs.getBoolPref(OPTION,true))apply();else restore();}
      catch(error){trace("startup-prefs.sync.error",{name:startupErrorClass(error)});console.warn("[Zen Refined] Startup preference sync",startupErrorClass(error));}
    }while(pendingSync&&!disposed);
  }finally{
    mutating=false;
    finishCleanup();
  }
}
let closing=false,disposed=false,closeTimer=0,observing=false,mutating=false,pendingSync=false,pendingCleanup=null;
// Native preferences are process-wide; browser windows are leases, not
// independent owners. Only one live lease observes the option.
function otherOwner(){
  const windows=Services.wm.getEnumerator("navigator:browser");
  while(windows.hasMoreElements()){
    const other=windows.getNext();
    try{
      if(other===window||other.closed)continue;
      const lease=other[KEY];
      if(lease?.active&&typeof lease.observe==="function")return lease;
    }catch{} // a closing chrome window can become a dead wrapper
  }
  return null;
}
function observe(reconcile=false){
  if(disposed||!cleanup.active)return;
  if(!observing){prefs.addObserver(OPTION,sync);observing=true;}
  if(reconcile)sync();
}
function stopObserving(){
  if(!observing)return;observing=false;
  try{prefs.removeObserver(OPTION,sync);}catch{}
}
function beforeClose(event){
  if(event.target!==window&&event.target!==document)return;
  closing=true;
  if(closeTimer)window.clearTimeout(closeTimer);
  closeTimer=window.setTimeout(()=>{closing=false;closeTimer=0;},1000);
}
function cleanup(modUnload=false){
  if(disposed)return;disposed=true;
  const wasObserving=observing,interrupted=mutating;
  if(window[PENDING]===cleanup)delete window[PENDING];
  const step=fn=>{try{fn();}catch(error){trace("startup-prefs.cleanup.error",{name:startupErrorClass(error)});}};
  step(()=>{if(closeTimer)window.clearTimeout(closeTimer);});
  step(stopObserving);
  step(()=>window.removeEventListener("beforeunload",beforeClose,true));
  step(()=>window.removeEventListener("unload",nativeUnload));
  // A queued replacement has not acquired native ownership.
  if(!cleanup.active)return;
  pendingCleanup={modUnload,wasObserving,interrupted};
  finishCleanup();
}
function finishCleanup(){
  if(mutating||!pendingCleanup)return;
  const {modUnload,wasObserving,interrupted}=pendingCleanup;pendingCleanup=null;
  let successor=null,restoring=false;
  try{
    successor=otherOwner();
    if(!successor&&modUnload&&!closing&&!window.closed&&!Services.startup.shuttingDown){
      // Keep the last lease published while native restore notifies
      // synchronous observers. New windows join rather than race restore.
      restoring=true;mutating=true;
      try{restore();}finally{mutating=false;}
    }
  }catch(error){trace("startup-prefs.cleanup.error",{name:startupErrorClass(error)});console.warn("[Zen Refined] Startup ownership cleanup",startupErrorClass(error));}
  finally{
    cleanup.active=false;
    if(window[KEY]===cleanup)delete window[KEY];
  }
  try{
    // A successor may have joined during final restoration.
    successor=otherOwner();
    if(successor&&(wasObserving||restoring)&&!Services.startup.shuttingDown)
      successor.observe(interrupted||restoring);
    trace("startup-prefs.cleanup",{interrupted,successor:!!successor,modUnload});
  }catch(error){trace("startup-prefs.cleanup.error",{name:startupErrorClass(error)});}
}
function nativeUnload(){cleanup(false);}
cleanup.active=false;cleanup.observe=observe;
if(typeof window.addUnloadListener==="function"&&!document.documentElement.hasAttribute("popup-window")){
  // Register cancellation before asking the old owner to release. A
  // reentrant replacement must not overwrite its still-active lease.
  window[PENDING]?.(false);window[PENDING]=cleanup;
  window.addEventListener("unload",nativeUnload,{once:true});
  window.addUnloadListener(()=>cleanup(true));
  const previous=window[KEY];
  previous?.(false);
  function install(){
    if(disposed||window.closed||window[PENDING]!==cleanup)return;
    if(previous?.active){
      // Only synchronous mutations can hold this lease; resume at the
      // microtask boundary after the old stack unwinds.
      if(window[KEY]===previous){cleanup(false);return;}
    }
    delete window[PENDING];window[KEY]=cleanup;cleanup.active=true;
    window.addEventListener("beforeunload",beforeClose,true);
    if(!otherOwner()){
      observe();sync();
      void warnLegacyConflict(
        ()=>ChromeUtils.importESModule("chrome://userscripts/content/core/utils.sys.mjs").default.getMods(),
        console
      );
    }
  }
  if(previous?.active)void Promise.resolve().then(install);else install();
}
