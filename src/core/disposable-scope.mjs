// Synchronous acquisition scope. Each release is attempted at most once;
// native failures are reported, never retried implicitly or treated as success.
export function createDisposableScope({onError=()=>{}}={}){
  let closed=false;
  const releases=new Set();
  function defer(label,cleanup){
    if(typeof cleanup!=="function")throw new TypeError("Expected cleanup function");
    let active=true;
    const release=()=>{
      if(!active)return true;
      active=false;releases.delete(release);
      try{cleanup();return true;}
      catch(error){try{onError(label,error);}catch{}return false;}
    };
    if(closed)release();else releases.add(release);
    return release;
  }
  function listen(node,type,fn,options){
    if(closed)throw Error("Disposable scope closed");
    // Keep the exact acquisition target and capture flag.
    const capture=typeof options==="boolean"?options:!!options?.capture;
    node.addEventListener(type,fn,options);
    return defer("listener",()=>node.removeEventListener(type,fn,capture));
  }
  function dispose(){
    if(closed)return {released:0,failed:0};
    closed=true;
    let released=0,failed=0;
    for(const release of [...releases].reverse()){
      if(!releases.has(release))continue;
      if(release())released++;else failed++;
    }
    return {released,failed};
  }
  return {defer,listen,dispose,get closed(){return closed;},get size(){return releases.size;}};
}
