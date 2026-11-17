import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=new URL("../",import.meta.url);
const manifest=JSON.parse(readFileSync(new URL("theme.json",root),"utf8"));
for(const name of Object.keys(manifest.scripts)){
  const path=fileURLToPath(new URL(name,root));
  const result=spawnSync(process.execPath,["--check",path],{stdio:"inherit"});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}
console.log("Verified all "+Object.keys(manifest.scripts).length+" runtime scripts");
