import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const h=readFileSync(new URL("../src/hub/controller.js.part",import.meta.url),"utf8");
const e=readFileSync(new URL("../src/interactions/drag-engine.js.part",import.meta.url),"utf8");
test("Trash uses original card with empty spacer and shared pointer lifecycle, not native drag image",()=>{
 const a=h.indexOf("    function trashMotionEnabled("),b=h.indexOf("    function purgeEligible(",a),s=h.slice(a,b);
 assert.ok(a>=0&&b>a);assert.match(s,/dragLifecycle\.begin\("trash"/);
 assert.match(s,/d\.row\.before\(d\.placeholder\)/);assert.match(s,/panel\.append\(d\.row\)/);
 assert.match(s,/d\.placeholder\.replaceWith\(d\.row\)/);
 assert.doesNotMatch(s,/cloneNode|setDragImage|dataTransfer/);
 assert.match(s,/await restoreTrashTab\(d\.tab,id,approval\)/);
 assert.match(s,/const approval=d\.approval/);
 assert.match(s,/id&&current\(\)\?await restoreTrashTab/);
 assert.match(s,/dragLifecycle\.finish\(d\.token\)/);
 assert.match(e,/\["workspace","trash"\]\.includes\(current\.kind\)/);
 assert.match(e,/\["workspace","trash"\]\.includes\(dragLifecycle\.current\(\)\?\.kind\)/);
});
