// Nocturne preview.36: early trace, independent Sine script order.
try{if(typeof window!=="undefined"){
  const event="startup-prefs.script",data={version:"0.3.0-preview.39"};
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
const KEY="__zenRefinedStartupPlaceholders";
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
  try{const b=JSON.parse(prefs.getStringPref(BACKUP,"{}"));return b&&typeof b==="object"&&!Array.isArray(b)?b:{};}catch{return {};}
}
function persist(){try{prefs.savePrefFile(null);}catch(error){console.warn("[Zen Refined] Could not save startup preferences",error);}}
function apply(){
    typeof window!=="undefined"&&window.__nocturneTrace?.("startup-prefs.apply",()=>(null),{sample:1800});
  const backup=readBackup();let changed=false;
  for(const name of TARGETS){
    try{
      if(prefs.prefIsLocked(name)||prefs.getPrefType(name)!==prefs.PREF_BOOL)continue;
      if(prefs.getBoolPref(name)===false)continue;
      if(!Object.hasOwn(backup,name)){
        backup[name]={user:prefs.prefHasUserValue(name),value:prefs.getBoolPref(name)};
        prefs.setStringPref(BACKUP,JSON.stringify(backup));
      }
      prefs.setBoolPref(name,false);changed=true;
    }catch(error){console.warn("[Zen Refined] Startup preference",name,error);}
  }
  if(changed)persist();
}
function restore(){
    typeof window!=="undefined"&&window.__nocturneTrace?.("startup-prefs.restore",()=>(null),{sample:1800});
  const backup=readBackup();let changed=false;
  for(const name of TARGETS){
    const old=backup[name];if(!old||typeof old.user!=="boolean"||typeof old.value!=="boolean")continue;
    try{
      if(prefs.prefIsLocked(name))continue;
      // Respect a later explicit change made by another tool or the user.
      if(prefs.getPrefType(name)===prefs.PREF_BOOL&&prefs.getBoolPref(name)===false){
        if(old.user)prefs.setBoolPref(name,old.value);else prefs.clearUserPref(name);
      }
      delete backup[name];changed=true;
    }catch(error){console.warn("[Zen Refined] Startup restore",name,error);}
  }
  if(changed){
    if(Object.keys(backup).length)prefs.setStringPref(BACKUP,JSON.stringify(backup));else prefs.clearUserPref(BACKUP);
    persist();
  }
}
function sync(){if(disposed)return;if(prefs.getBoolPref(OPTION,true))apply();else restore();}
let closing=false,disposed=false,closeTimer=0,observing=false;
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
function observe(){
  if(disposed||observing)return;
  prefs.addObserver(OPTION,sync);observing=true;
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
  if(disposed)return;disposed=true;cleanup.active=false;
  if(closeTimer)window.clearTimeout(closeTimer);
  const wasObserving=observing;stopObserving();
  window.removeEventListener("beforeunload",beforeClose,true);
  window.removeEventListener("unload",nativeUnload);
  if(window[KEY]===cleanup)delete window[KEY];
  try{
    const successor=otherOwner();
    if(successor){
      if(wasObserving&&!Services.startup.shuttingDown)successor.observe();
      return;
    }
    // Normal window exit must preserve the pre-startup settings.
    if(modUnload&&!closing&&!window.closed&&!Services.startup.shuttingDown)restore();
  }catch(error){console.warn("[Nocturne] Startup ownership cleanup",error);}
}
function nativeUnload(){cleanup(false);}
cleanup.active=false;cleanup.observe=observe;
if(typeof window.addUnloadListener==="function"&&!document.documentElement.hasAttribute("popup-window")){
  // A replacement in the same window transfers the existing backup.
  window[KEY]?.(false);window[KEY]=cleanup;cleanup.active=true;
  window.addEventListener("beforeunload",beforeClose,true);
  window.addEventListener("unload",nativeUnload,{once:true});
  window.addUnloadListener(()=>cleanup(true));
  if(!otherOwner()){
    observe();sync();
    void warnLegacyConflict(
      ()=>ChromeUtils.importESModule("chrome://userscripts/content/core/utils.sys.mjs").default.getMods(),
      console
    );
  }
}
