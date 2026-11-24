import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const base=read("src/styles/base.css.part"),css=read("src/styles/library.css.part");
test("Library and History share one inherited material, with zero override supported",()=>{
 const prefs=JSON.parse(read("preferences.json"));
 for(const [prop,unit] of [["opacity","%"],["blur","px"]]){
  const key="zen.nocturne.material.library."+prop,token="--nocturne-library-"+prop,pref=prefs.find(x=>x.property===key);
  assert.equal(pref.defaultValue,-1);
  assert.ok(base.includes(token+": var(--nocturne-glass-"+prop+")"));
  for(const o of pref.options.filter(x=>x.value!==-1))assert.ok(base.includes('(-moz-pref("'+key+'", '+o.value+')) { '+token+': '+o.value+unit+'; }'));
 }
 assert.ok(base.includes("var(--nocturne-glass-tint) var(--nocturne-library-opacity)"));
 assert.ok(base.includes("--nocturne-library-opacity: 100%"));
 assert.ok(base.includes("--nocturne-library-blur: 0px"));
 assert.ok(base.includes("--nocturne-library-paint: Canvas"));
});
test("Stationary glass alone blurs; content and shade keep independent motion",()=>{
 const glass=css.split("#nocturne-library-preview .nl-glass{")[1].split("}")[0];
 const panel=css.split("#nocturne-library-preview .nl-panel{")[1].split("}")[0];
 const filter=css.split("#nocturne-library-preview .nl-history-filter{")[1].split("}")[0];
 assert.ok(glass.includes("background:var(--nocturne-library-paint,Canvas)"));
 assert.ok(glass.includes("backdrop-filter:blur(var(--nocturne-library-blur,0px))"));
 assert.ok(!panel.includes("backdrop-filter"));
 assert.ok(!filter.includes("backdrop-filter"));
 assert.ok(filter.includes("background:var(--nocturne-glass-tint,Canvas)"));
 assert.ok(css.includes("min-width:0;min-height:0;border-radius:var(--nocturne-glass-radius,12px)"));
 assert.ok(css.includes(".nl-shade{position:absolute;inset:0;background:#0005;}"));
 const controller=read("src/library/controller.js.part");
 assert.ok(controller.includes("layer.append(shade,glass,panel)"));
 assert.ok(controller.includes("play(shell.glass,[glass,{opacity:1}]"));
});
