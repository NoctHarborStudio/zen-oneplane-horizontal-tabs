import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const root=new URL("../",import.meta.url);
test("Magnetic Bookmarks matches pinned source or explicit Nocturne override",()=>{
  const lock=JSON.parse(readFileSync(new URL("scripts/shared-bookmarks.lock.json",root),"utf8"));
  for(const file of lock.files){
    const data=readFileSync(new URL(file.path,root));
    const hash=createHash("sha1").update("blob "+data.length+"\0").update(data).digest("hex");
    assert.equal(hash,file.localOverride?.gitBlob??file.gitBlob,file.path+" differs from "+(file.localOverride?.commit??lock.commit));
  }
});
