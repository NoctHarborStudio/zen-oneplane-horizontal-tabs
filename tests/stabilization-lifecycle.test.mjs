import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const downloads=read("downloads-indicator.uc.mjs");
const segment=downloads.slice(downloads.indexOf("  async function install(){"),downloads.indexOf("  function sync(){"));
function downloadFixture(Downloads){
 return new Function("Downloads",`let dead=false,node=null,epoch=0,view=null,list=null,hydrating=false,teardowns=0,events=0;
 const window={Downloads,closed:false};const ChromeUtils={importESModule:()=>({PrivateBrowsingUtils:{isWindowPrivate:()=>false}})};
 const console={warn(){}};const root={setAttribute(){}};const ACTIVE="active";let enabledFlag=true;const enabled=()=>enabledFlag;
 function build(){node={};}function added(){events++;}function changed(){events++;}function removed(){events++;}
 function schedule(){}function teardown(){epoch++;node=null;list=null;view=null;hydrating=false;teardowns++;}
 ${segment}
 return {install,disable(){enabledFlag=false;teardown();},enable(){enabledFlag=true;},status:()=>({node:!!node,epoch,teardowns,hydrating,events})};`)(Downloads);
}
test("old rejected download view cannot tear down replacement or replay events",async()=>{
 let rejectOld,oldView,detached=0;
 const oldList={addView:v=>{oldView=v;return new Promise((r,j)=>rejectOld=j);},removeView:async v=>{assert.equal(v,oldView);detached++;}};
 const newList={addView:async()=>{},removeView:async()=>{}};let calls=0;
 const f=downloadFixture({getList:async()=>++calls===1?oldList:newList,PUBLIC:"public"});
 const old=f.install();await Promise.resolve();await Promise.resolve();
 f.disable();f.enable();await f.install();const before=f.status();
 oldView.onDownloadAdded({});rejectOld(Error("late failure"));await old;
 assert.deepEqual(f.status(),before);assert.equal(detached,1);
});
test("late successful addView is detached even if old teardown already ran",async()=>{
 let resolveOld,oldView,removed=0;
 const oldList={addView:v=>{oldView=v;return new Promise(r=>resolveOld=r);},removeView:async v=>{assert.equal(v,oldView);removed++;}};
 const f=downloadFixture({getList:async()=>oldList,PUBLIC:"public"});
 const old=f.install();await Promise.resolve();await Promise.resolve();f.disable();
 oldView.onDownloadChanged({});resolveOld();await old;
 assert.equal(removed,1);assert.equal(f.status().events,0);assert.equal(f.status().node,false);
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
