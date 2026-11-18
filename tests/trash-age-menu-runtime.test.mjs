import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const s=readFileSync(new URL("../src/hub/controller.js.part",import.meta.url),"utf8");
const a=s.indexOf("    function setTrashAgeOpen("),b=s.indexOf("    async function executePurge(",a);
assert.ok(a>=0&&b>a);
test("selecting seven days changes actual purge filter without closing Hub",()=>{
 let renders=0,focused=0,valid=true;const native={};
 const option=()=>({attrs:{},setAttribute(k,v){this.attrs[k]=v;}});
 const choices=new Map([["all",{short:"All tabs",option:option()}],["7d",{short:"7 days+",option:option()}]]);
 const ageMenu={hidden:false},ageSelect={disabled:false,setAttribute(){},focus(){focused++;}},ageLabel={};
 const run=runInNewContext('let trashAge="all",purgePlan=null;\n'+s.slice(a,b)+'\n({selectTrashAge,askPurge,current:()=>({trashAge,purgePlan})})',{
   open:true,trashOpen:true,busy:false,ageMenu,ageSelect,ageLabel,ageChoices:choices,
   renderTrash(){renders++;},canManage:()=>true,singleWindow:()=>true,
   window:{},manager:()=>native,trashId:()=>"trash",freeId:()=>"free",status:{textContent:""},
   readWorkspaceOwnership:(w,n,id)=>{assert.equal(n,native);assert.equal(id,"trash");return valid?{tabs:["old","new"]}:null;},
   purgeEligible:()=>true,trashStamp:t=>t==="old"?Date.now()-8*86400000:Date.now(),
   hubTrashAgeMatches:(stamp,age,now)=>age==="all"||now-stamp>=7*86400000
 });
 run.selectTrashAge("7d");assert.equal(ageMenu.hidden,true);assert.equal(ageLabel.textContent,"7 days+");
 assert.equal(choices.get("7d").option.attrs["aria-pressed"],"true");assert.equal(focused,1);
 run.askPurge();assert.equal(run.current().trashAge,"7d");assert.equal(run.current().purgePlan.tabs.length,1);
 assert.equal(run.current().purgePlan.tabs[0],"old");assert.equal(run.current().purgePlan.native,native);
 assert.equal(run.current().purgePlan.source,"trash");assert.equal(run.current().purgePlan.free,"free");assert.equal(renders,2);
 assert.ok(run.current().purgePlan.stamps.has("old"));
 valid=false;run.askPurge();assert.equal(run.current().purgePlan,null);assert.equal(renders,3);
});
