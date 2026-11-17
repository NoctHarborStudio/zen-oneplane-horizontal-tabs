import test from "node:test";
import assert from "node:assert/strict";
import {libraryClientRect,libraryDuration} from "../src/library/geometry.mjs";
test("Library geometry clips to browser client, not monitor, and declines unusable space",()=>{
 assert.deepEqual(libraryClientRect({left:80,top:90,right:1200,bottom:800},1000,700),{left:80,top:90,width:920,height:610});
 assert.deepEqual(libraryClientRect({left:-20,top:-5,right:360,bottom:640},360,640),{left:0,top:0,width:360,height:640});
 assert.equal(libraryClientRect({left:0,top:0,right:200,bottom:600},360,640),null);
 assert.equal(libraryClientRect(null,360,640),null);
});
test("Library motion honors reduced motion and disabled animations",()=>{
 assert.equal(libraryDuration(true,true,300),0);assert.equal(libraryDuration(false,false,300),0);assert.equal(libraryDuration(false,true,300),300);
});
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Library L3 is opt-in, built independently, and does not intercept native commands",()=>{
 const source=read("src/library/controller.js.part"),plan=JSON.parse(read("scripts/build-plan.json"));
 assert.deepEqual(plan.library.map(x=>x.path),["src/algorithms/library-state.mjs","src/library/geometry.mjs","src/library/controller.js.part"]);
 assert.match(source,/getBoolPref\(PREF,false\)/);
 assert.match(source,/overlay\.request\(OWNER\)/);
 assert.match(source,/state\.motionEpoch===epoch/);
 assert.doesNotMatch(source,/key_gotoHistory|Browser:ShowAllHistory|Tools:Downloads|ZenLibrary\.toggle|Downloads\.getList/);
 const pref=JSON.parse(read("preferences.json")).find(x=>x.property==="zen.nocturne.library.preview");assert.equal(pref.defaultValue,false);
});
