import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const entrypoints=[
  ["startup.uc.mjs","startupErrorClass","STARTUP_ERROR_CLASSES"],
  ["bookmarks.uc.mjs","bookmarksErrorClass","BOOKMARKS_ERROR_CLASSES"],
  ["page-progress.uc.mjs","pageErrorClass","PAGE_PROGRESS_ERROR_CLASSES"],
  ["workspace-transition.uc.mjs","workspaceErrorClass","WORKSPACE_ERROR_CLASSES"],
  ["startup-animation.uc.mjs","assemblyErrorClass","ASSEMBLY_ERROR_CLASSES"]
];
test("NC4-089-R7b independent Sine errors expose class only to direct Browser Console",()=>{
  const secret="https://private.example/profile?account=secret";
  for(const [path,fn,set] of entrypoints){
    const src=readFileSync(new URL("../"+path,import.meta.url),"utf8");
    const declaration=src.split("\n").find(line=>line.includes("const "+set+"=new Set("));
    const helper=src.split("\n").find(line=>line.includes("function "+fn+"(error){"));
    assert.ok(declaration&&helper,path+" local helper");
    const classify=new Function(declaration+"\n"+helper+"\nreturn "+fn+";")();
    assert.equal(classify(new TypeError(secret)),"TypeError",path);
    assert.equal(classify({name:"AccountSecretError",message:secret}),"Error",path);
    assert.equal(classify({get name(){throw Error(secret);}}),"Error",path);
    assert.equal(classify({name:"NS_ERROR_FAILURE",get message(){throw Error(secret);}}),"NS_ERROR_FAILURE",path);
    const statements=src.split("\n").flatMap(line=>{
      const found=line.match(/console\.(?:warn|error)\([^;]*\);?/);
      return found&&line.includes("error")?[found[0]]:[];
    });
    assert.ok(statements.length>0,path+" exception sinks");
    const logged=[],console={warn:(...args)=>logged.push(args),error:(...args)=>logged.push(args)};
    for(const statement of statements){
      assert.ok(statement.includes(fn+"(error)"),path+": "+statement);
      new Function("console",fn,"error","name",statement)(console,classify,new TypeError(secret),"browser.startup.blankWindow");
    }
    assert.equal(logged.length,statements.length,path);
    assert.ok(!JSON.stringify(logged).includes(secret),path);
    assert.ok(logged.every(args=>args.includes("TypeError")),path);
  }
});
test("NC4-089-R7b Startup, Workspace and Assembly trace names are bounded",()=>{
  for(const [path,fn] of [
    ["startup.uc.mjs","startupErrorClass"],
    ["workspace-transition.uc.mjs","workspaceErrorClass"],
    ["src/core/startup-animation.js.part","assemblyErrorClass"]
  ]){
    const src=readFileSync(new URL("../"+path,import.meta.url),"utf8");
    assert.ok(!src.includes("name:error?.name"),path);
    assert.ok(!src.includes('error?.name||"Error"'),path);
    assert.ok(src.includes(fn+"(error)"),path);
  }
});
