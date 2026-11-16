  export function emptyAddressState(explicitEmpty,uri,pending,restoring){
    if(explicitEmpty)return true;
    if(pending||restoring)return false;
    return /^(about:(blank|newtab|home|privatebrowsing))(?:[?#].*)?$/i.test(uri);
  }
