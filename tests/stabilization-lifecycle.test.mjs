import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createDownloadsService} from "../src/services/downloads-service.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const downloads=read("downloads-indicator.uc.mjs");
const segment=downloads.slice(downloads.indexOf("  async function install(){"),downloads.indexOf("  function sync(){"));
function downloadFixture(source){
 return new Function("source",`let dead=false,node=null,epoch=0,unsubscribeDownloads=null,list=null,hydrating=false,teardowns=0,events=0;
 const window={__nocturneLibraryServices:{downloads:source},closed:false};
 const console={warn(){}};const root={setAttribute(){}};const ACTIVE="active";let enabledFlag=true;const enabled=()=>enabledFlag;
 function build(){node={};}function added(){events++;}function changed(){events++;}function removed(){events++;}
 function schedule(){}function teardown(){epoch++;unsubscribeDownloads?.();unsubscribeDownloads=null;node=null;list=null;hydrating=false;teardowns++;}
 ${segment}
 return {install,replace(source){teardown();window.__nocturneLibraryServices={downloads:source};},disable(){enabledFlag=false;teardown();},enable(){enabledFlag=true;},status:()=>({node:!!node,epoch,teardowns,hydrating,events})};`)(source);
}
function pendingList(){
 let resolve,reject,enter,view,removed=0;
 const entered=new Promise(r=>enter=r);
 const pending=new Promise((r,j)=>{resolve=r;reject=j;});
 const list={addView(v){view=v;enter();return pending;},async removeView(v){assert.equal(v,view);removed++;}};
 return {list,entered,resolve,reject,emit(kind,d){view[kind](d);},removed:()=>removed};
}
test("old rejected download service cannot tear down replacement or replay events",async()=>{
 const oldList=pendingList();
 const source=createDownloadsService({loadList:async()=>oldList.list});
 const f=downloadFixture(source);const old=f.install();await oldList.entered;
 const barrier=source.dispose();
 let newView,addCount=0;
 const next=createDownloadsService({barrier,loadList:async()=>({async addView(v){newView=v;addCount++;},async removeView(){}})});
 f.replace(next);const replacement=f.install();
 oldList.emit("onDownloadAdded",{});assert.equal(addCount,0);
 oldList.reject(Error("late failure"));await old;await replacement;
 assert.equal(oldList.removed(),1);assert.equal(addCount,1);
 const before=f.status();assert.equal(before.node,true);assert.equal(before.events,0);
 oldList.emit("onDownloadAdded",{});assert.deepEqual(f.status(),before);
 newView.onDownloadAdded({});assert.equal(f.status().events,1);await next.dispose();
});
test("late successful addView is detached by the service after Dock teardown",async()=>{
 const oldList=pendingList(),source=createDownloadsService({loadList:async()=>oldList.list});
 const f=downloadFixture(source);const old=f.install();await oldList.entered;f.disable();
 const disposal=source.dispose();oldList.emit("onDownloadChanged",{});oldList.resolve();
 await old;await disposal;
 assert.equal(oldList.removed(),1);assert.equal(f.status().events,0);assert.equal(f.status().node,false);
});
test("Dock disable and re-enable share the same in-flight native subscription",async()=>{
 const native=pendingList(),source=createDownloadsService({loadList:async()=>native.list});
 const f=downloadFixture(source);const old=f.install();await native.entered;
 f.disable();f.enable();const next=f.install();native.emit("onDownloadAdded",{});native.resolve();
 await Promise.all([old,next]);assert.equal(f.status().node,true);assert.equal(f.status().events,1);
 native.emit("onDownloadChanged",{});assert.equal(f.status().events,2);
 f.disable();native.emit("onDownloadChanged",{});assert.equal(f.status().events,2);
 assert.equal(native.removed(),0);await source.dispose();assert.equal(native.removed(),1);
});
test("layout cleanup continues after feature disposal throws",()=>{
 const src=read("src/core/bootstrap.js.part"),cleanup=src.slice(0,src.indexOf("const controller ="));
 const result=new Function(`let disposed=false,applied=true,closing=false,startupObserver=null;
 const root={removeAttribute(){}};const window={dispatchEvent(){},CustomEvent:class{},removeEventListener(){},layout:{}};
 const CONTROLLER="layout",controller=window.layout;function markClosing(){}let restored=false;
 function otherActiveWindow(){return false}function restorePrefs(){restored=true}
 let removeTabStrip=()=>{throw Error("injected feature cleanup failure")};const console={warn(){}};
 const CustomEvent=window.CustomEvent;${cleanup}cleanup();
 return {disposed,applied,restored,controllerStillRegistered:window.layout===controller};`)();
 assert.deepEqual(result,{disposed:true,applied:false,restored:true,controllerStillRegistered:false});
});

test("layout preference restore isolates failed keys and retains complete backup",()=>{
 const src=read("src/core/preferences.js.part");
 const code=src.slice(src.indexOf("function restorePrefs()"),src.indexOf("function markClosing"));
 const backup={a:{value:false,user:true},b:{value:true,user:false},c:{value:false,user:true}};
 const values=new Map([["a",true],["b",false],["c",false]]);
 const cleared=[],traces=[];let fail=true,raw=JSON.stringify(backup);
 const prefs={getStringPref:()=>raw,getBoolPref:k=>values.get(k),setBoolPref(k,v){if(k==="a"&&fail)throw Error("locked");values.set(k,v);},
  clearUserPref(k){cleared.push(k);if(k==="backup")raw="";else values.set(k,true);}};
 const restore=new Function("prefs","window","console","TARGET","KEY",code+"return restorePrefs;")(prefs,{__nocturneTrace:(event,data)=>traces.push({event,data})},{warn(){}},{a:true,b:false,c:true},"backup");
 assert.equal(restore(),false);assert.equal(values.get("b"),true);assert.equal(values.get("c"),false);
 assert.equal(raw,JSON.stringify(backup));assert.deepEqual(cleared,["b"]);
 assert.deepEqual(traces[0].data,{restored:1,skipped:1,failed:1,backupRetained:true});
 fail=false;assert.equal(restore(),true);assert.equal(values.get("a"),false);assert.equal(raw,"");
 assert.deepEqual(cleared,["b","backup"]);
});
