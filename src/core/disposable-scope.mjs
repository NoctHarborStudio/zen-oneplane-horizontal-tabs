// Synchronous acquisition scope. Each release is attempted at most once;
// the original outcome is retained. Native failures are never retried implicitly.
export function createDisposableScope({onError=()=>{}}={}){
  let closed=false,disposing=null;
  const releases=new Set();
  function defer(label,cleanup){
    if(typeof cleanup!=="function")throw new TypeError("Expected cleanup function");
    let active=true,outcome=false;
    const release=()=>{
      if(!active)return outcome;
      active=false;releases.delete(release);
      const run=cleanup;cleanup=null;
      try{run();outcome=true;}
      catch(error){try{onError(label,error);}catch{}}
      // Count nested and late releases during the same disposal, too.
      if(disposing)disposing[outcome?"released":"failed"]++;
      return outcome;
    };
    if(closed)release();else releases.add(release);
    return release;
  }
  function listen(node,type,fn,options){
    if(closed)throw Error("Disposable scope closed");
    const capture=typeof options==="boolean"?options:!!options?.capture;
    let callback=fn;
    const guarded=function(event){
      if(closed||!callback)return;
      if(typeof callback==="function")return callback.call(this,event);
      return callback.handleEvent(event);
    };
    // Keep the exact registered wrapper and invalidate it even if native
    // removal fails. Register cleanup after add so synchronous disposal
    // inside acquisition immediately releases the newly attached wrapper.
    try{node.addEventListener(type,guarded,options);}
    catch(error){
      defer("listener",()=>{callback=null;node.removeEventListener(type,guarded,capture);})();
      throw error;
    }
    return defer("listener",()=>{callback=null;node.removeEventListener(type,guarded,capture);});
  }
  function dispose(){
    if(closed)return {released:0,failed:0};
    closed=true;
    const result={released:0,failed:0};disposing=result;
    try{
      for(const release of [...releases].reverse()){
        if(releases.has(release))release();
      }
    }finally{disposing=null;}
    return result;
  }
  return {defer,listen,dispose,get closed(){return closed;},get size(){return releases.size;}};
}
