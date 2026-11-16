  export function hubPanelWidth(left,right,viewport){
    const room=Math.max(1,viewport-left-8);
    return Math.max(1,Math.min(Math.round(room),Math.max(180,Math.round(right-left))));
  }
  export function hubWorkspaceBrowserEligible(tab,active){
    if(!tab||!active||tab.closing||tab.hasAttribute("zen-empty-tab"))return false;
    if(tab.hasAttribute("zen-essential"))return !tab.hidden&&!tab.collapsed;
    return tab.getAttribute("zen-workspace-id")===active;
  }
  export function hubWorkspaceSnapshot(manager) {
    try {
      if (!manager || manager.workspaceEnabled === false ||
          typeof manager.getWorkspaces !== "function" || typeof manager.changeWorkspaceWithID !== "function") return null;
      const native = manager.getWorkspaces();
      if (!Array.isArray(native)) return null;
      const seen = new Set(), spaces = [];
      for (const space of native) {
        if (typeof space?.uuid !== "string" || !space.uuid || seen.has(space.uuid)) continue;
        seen.add(space.uuid);
        spaces.push({id:space.uuid,name:typeof space.name==="string" && space.name.trim()?space.name:"Unnamed space",
          icon:typeof space.icon==="string" && space.icon.length<=24 && !space.icon.includes(".svg")?space.icon:"",
          active:space.uuid===manager.activeWorkspace});
      }
      return spaces;
    } catch { return null; }
  }
