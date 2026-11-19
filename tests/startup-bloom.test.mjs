import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {startupBloomTimeline,startupBloomStagger,startupBloomOrder,startupBloomFrames,startupBloomAssemblyPlan,startupBloomHomeSchedule} from "../src/algorithms/startup-bloom.mjs";
import {startupTimeline,startupFits,startupLateEffect} from "../src/algorithms/startup-timeline.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const near=(a,b)=>Math.abs(a-b)<1e-7;

test("reconstructed Bloom preserves documented stage windows on one nonnegative visible clock",()=>{
 const p=startupBloomTimeline();
 assert.deepEqual([p.panel.start,p.islandShape.start,p.islandLabel.end,p.tabs.start,p.tabs.end,p.bookmarks.start,p.bookmarks.end,p.search.start,p.search.end,p.pins.start,p.pins.end,p.workspaces.start,p.workspaces.end,p.footer.start,p.footer.end,p.end],[0,140,700,390,1000,660,1120,770,1290,990,1560,1280,1750,1540,1850,1920]);
 assert.ok(p.islandShape.end<=p.islandLabel.start);
 assert.ok(p.footer.end<=p.end);
 assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.tabs));
});
test("Bloom stagger stays finite and inside every stage at all supported durations and large counts",()=>{
 for(let duration=400;duration<=1500;duration++){
  const p=startupBloomTimeline(duration/1050);
  for(const k of ["tabs","bookmarks","pins","workspaces"]){
   const stage=p[k];
   assert.deepEqual(startupBloomStagger(0,stage),[]);
   for(const count of [1,5,30,100,1000]){
    const schedule=startupBloomStagger(count,stage);
    assert.equal(schedule.length,count);
    assert.ok(near(schedule[0].delay,stage.start));
    assert.ok(near(schedule.at(-1).delay+schedule.at(-1).duration,stage.end));
    for(let i=0;i<schedule.length;i++){
     const {delay,duration}=schedule[i];
     assert.ok(Number.isFinite(delay)&&Number.isFinite(duration));
     assert.ok(delay>=stage.start-1e-7&&duration>=stage.min-1e-7&&delay+duration<=stage.end+1e-7);
     if(i)assert.ok(delay>=schedule[i-1].delay-1e-7&&delay-schedule[i-1].delay<=stage.step+1e-7);
    }
   }
  }
 }
});
test("large collections compress stagger rather than item duration",()=>{
 const stage=startupBloomTimeline().tabs;
 const few=startupBloomStagger(5,stage),many=startupBloomStagger(1000,stage);
 assert.ok(few[0].duration>many[0].duration);
 assert.ok(near(many[0].duration,stage.min));
 assert.ok(many[1].delay-many[0].delay<few[1].delay-few[0].delay);
});
test("center wave orders visible slots stably and treats split groups as a unit",()=>{
 const slots=[{id:"far",x:300,y:20},{id:"lower",x:520,y:70},{id:"left",x:480,y:20},{id:"group",x:520,y:20},{id:"center",x:500,y:70}];
 const before=slots.slice();
 assert.deepEqual(startupBloomOrder(slots,{x:500,y:20}).map(x=>x.id),["center","left","group","lower","far"]);
 assert.deepEqual(slots,before);
 assert.equal(startupBloomOrder([slots[3]],{x:500,y:20})[0],slots[3]);
});
test("all Bloom card keyframes and interpolated rectangles remain inside disjoint resting slots",()=>{
 for(const opacity of [0,.42,1]){
  const frames=startupBloomFrames("card",opacity);
  assert.equal(frames[0].opacity,0);assert.equal(frames.at(-1).opacity,opacity);
  assert.equal(frames.at(-1).scale,"1");
  // The easing curves have monotone y control points in [0,1];
  // interpolation cannot escape either endpoint's scale.
  for(let i=1;i<frames.length;i++)for(let j=0;j<=100;j++){
   const t=j/100,s=Number(frames[i-1].scale)*(1-t)+Number(frames[i].scale)*t;
   assert.ok(s>=0&&s<=1+1e-12);
   for(const w of [1,20,80,400]){
    const half=w*s/2;
    assert.ok(half<=w/2+1e-10);
   }
  }
 }
 assert.equal(startupBloomFrames("search")[0].scale,"0.86");
 assert.equal(startupBloomFrames("islandShape").at(-1).scale,"1 1");
});
test("Bloom rejects invalid scale, stage, slot and visual input",()=>{
 for(const v of [0,-1,NaN,Infinity,Number.MAX_VALUE])assert.throws(()=>startupBloomTimeline(v),RangeError);
 assert.throws(()=>startupBloomStagger(-1,startupBloomTimeline().tabs),RangeError);
 assert.throws(()=>startupBloomStagger(1,{start:0,end:0,min:1,step:0}),RangeError);
 assert.throws(()=>startupBloomOrder([{x:NaN,y:0}],{x:0,y:0}),RangeError);
 assert.throws(()=>startupBloomFrames("card",2),RangeError);
});
test("generated comparison Lab uses shared Fold, startup timeline and candidate functions without Sine registration",()=>{
 const plan=JSON.parse(read("scripts/build-plan.json")),html=read("docs/nocturne/labs/startup-motion.html");
 const assemble=entries=>entries.map(({path,kind})=>{
  const s=read(path);
  return kind==="esm-inline"?s.replace(/^import [^\n]+\n/gm,"").replace(/^([ \t]*)export (function|const) /gm,"$1$2 "):s;
 }).join("");
 assert.equal(html,assemble(plan.startupMotionLab));
 assert.ok(html.includes("const plan=startupTimeline(0,scale);"));
 assert.ok(html.includes('const plan=startupTimeline(0,scale,"bloom").bloom;'));
 assert.ok(html.includes("startupBloomHomeSchedule(plan,"));
 assert.ok(html.includes("fold.keyframes(card)"));
 assert.ok(html.includes("a.startTime=epoch;"));
 const layout=read("layout.uc.mjs");
 assert.ok(layout.includes(assemble([{path:"src/algorithms/magnetic-fold.mjs",kind:"esm-inline"}])));
 assert.ok(layout.includes(assemble([{path:"src/algorithms/startup-bloom.mjs",kind:"esm-inline"}])));
 assert.ok(read("startup-animation.uc.mjs").includes("const BLOOM_CANDIDATE=false;"));
 assert.ok(read("startup-animation.uc.mjs").includes("options.bloomTimeline=timeline;"));
 assert.ok(!read("theme.json").includes("startup-motion.html"));
 assert.ok(read("startup-animation.uc.mjs").includes(assemble([{path:"src/algorithms/startup-bloom.mjs",kind:"esm-inline"}])));
 assert.ok(read("startup-animation.uc.mjs").includes("let plan=startupTimeline(0,scale);"));
 assert.doesNotThrow(()=>new Function(html.split("<script>")[1].split("</script>")[0]));
});

test("Bloom plan preserves Fold default and admits the entire visible clock with Boot overhead",()=>{
 for(let duration=400;duration<=1500;duration++){
  const scale=duration/1050,p=startupTimeline(0,scale,"bloom"),fold=startupTimeline(0,scale);
  assert.deepEqual(p,startupBloomAssemblyPlan(0,scale));assert.equal(p.mode,"bloom");
  assert.ok(near(p.finishLength,1920*scale));assert.ok(near(p.lateLimit,p.finishLength+420));
  assert.ok(near(p.home*scale,p.bloom.search.start));
  assert.ok(near(p.cards*scale,p.bloom.tabs.start));
  assert.ok(fold.finishLength<p.finishLength);
  for(const overhead of [0,470]){
   assert.equal(startupFits(p,0,p.finishLength+overhead,overhead),false);
   assert.equal(startupFits(p,0,p.finishLength+overhead+1,overhead),true);
  }
  const late=startupLateEffect(p,0,p.finishLength,p.lateLimit,0,p.home,p.homeLength);
  if(late)assert.ok(late.finishAt<=p.lateLimit+1e-7);
 }
 assert.throws(()=>startupTimeline(0,1,"invalid"),RangeError);
 assert.throws(()=>startupBloomAssemblyPlan(NaN,1),RangeError);
});
test("shared native/Lab Home schedule separates labels, pins, workspaces and footer",()=>{
 for(const scale of [400/1050,1,1500/1050]){
  const p=startupBloomTimeline(scale);
  for(const count of [0,1,30,100]){
   const s=startupBloomHomeSchedule(p,count,count);
   assert.equal(s.pins.length,count);assert.equal(s.workspaces.length,count);
   assert.ok(near(s.search.delay,p.search.start));assert.ok(near(s.footer.delay+s.footer.duration,p.footer.end));
   assert.ok(near(s.pinLabel.delay+s.pinLabel.duration,p.pins.end));
   assert.ok(near(s.workspaceLabel.delay+s.workspaceLabel.duration,p.workspaces.end));
   for(const [list,stage] of [[s.pins,p.pins],[s.workspaces,p.workspaces]])for(const x of list)assert.ok(x.delay+x.duration<=stage.end+1e-7);
  }
 }
});

function homeFixture({empty=false,workspaces=true}={}){
 const effects=[],observed=[],fault={},calls={render:0};
 const doc={timeline:{currentTime:0}};
 function node(name,children=[],alpha=1){
  const n={name,children,hidden:false,alpha,
   matches(selector){return selector.split(",").includes(name);},
   getAnimations(){return effects.filter(a=>a.node===n&&!a.cancelled);},
   getBoundingClientRect(){const {scale}=style(n),width=100*scale,height=40*scale;return {left:50-width/2,top:20-height/2,width,height};},
   animate(frames,timing){
    if(fault.animate===effects.length+1)throw Error("animate");
    const a={node:n,frames,timing,currentTime:0,finished:Promise.resolve(),timeline:doc.timeline,playState:"running",pending:false,playbackRate:1,cancelled:0,
      pause(){this.playState="paused";},cancel(){this.cancelled++;this.playState="idle";}};
    effects.push(a);fault.onAnimate?.();return a;
   }};
  return n;
 }
 function style(n){
  const a=n.getAnimations().at(-1);
  if(!a)return {opacity:n.alpha,scale:1,visibility:"visible",display:"block"};
  const fraction=(a.currentTime-a.timing.delay)/a.timing.duration,first=a.frames[0],isCard=a.frames.length===4;
  const scale=first.scale?fraction<=0?Number(first.scale):isCard?1:.96:1;
  const opacity=fraction<=0?0:isCard?n.alpha:first.scale?n.alpha*.8:n.alpha*fraction;
  return {opacity:fault.alpha?n.alpha:opacity,scale:fault.scale?1:scale,visibility:"visible",display:"block"};
 }
 const search=node(".zh-search"),pinLabel=node("h3",[],.68),pins=empty?[node(".zh-empty")]:[node(".zh-pin"),node(".zh-pin")];
 const pinGrid=node(".zh-pins",pins),pinSection=node(".zh-section",[pinLabel,pinGrid]);
 const spaceLabel=node("h3",[],.68),spaceNodes=[node(".zh-space")],spaceGrid=node(".zh-spaces",spaceNodes);
 const pending=node(".zh-workspace-pending");pending.hidden=true;
 const spaceSection=node(".zh-section",[spaceLabel,spaceGrid,pending]),footer=node(".zh-footer");
 const content=node(".zh-content",[search,pinSection,...(workspaces?[spaceSection]:[]),footer]);
 let mark=true;
 const panel={hasAttribute:()=>mark,removeAttribute(){mark=false;}};
 const win={getComputedStyle:n=>{const s=style(n);return {...s,opacity:String(s.opacity),scale:String(s.scale)};},matchMedia:()=>({matches:false})};
 const timeline={...startupTimeline(0,1,"bloom"),paused:true,closed:false,observeEffect:(a,surface,current)=>observed.push({a,surface,current})};
 win.__nocturneStartupTimeline=timeline;
 const home=read("src/home/shared-home.js.part");
 const code=home.slice(home.indexOf("  let startupRun="),home.indexOf("  function stopMotion()"));
 const run=new Function("win","doc","panel","content","calls","startupBloomHomeSchedule","startupBloomFrames",`
 let open=true,dead=false,searchToken=null,editing=false,adding=false;function render(){calls.render++;}
 ${code}
 return {play:playStartupHome,refresh:refreshHomeStructure,finish:finishStartupHome,edit:()=>{editing=true;}};
 `)(win,doc,panel,content,calls,startupBloomHomeSchedule,startupBloomFrames);
 return {effects,observed,fault,calls,win,timeline,run,content,search,pinLabel,pinSection,pinGrid,pins,spaceLabel,spaceNodes,spaceSection,spaceGrid,footer,pending,marked:()=>mark};
}
test("real Home candidate owns individual leaves, opacity and exact shared epoch",()=>{
 const f=homeFixture(),lease=f.run.play(f.timeline);
 assert.ok(lease);assert.equal(f.timeline.homeLease,lease);
 assert.deepEqual(f.effects.map(a=>a.node),[f.search,f.pinLabel,...f.pins,f.spaceLabel,...f.spaceNodes,f.footer]);
 assert.ok(f.effects.every(a=>a.currentTime===0));assert.equal(f.effects[1].frames.at(-1).opacity,.68);
 assert.ok(f.observed.every(o=>o.surface==="home"&&o.current()));
 assert.throws(()=>lease.resumeAt(()=>{}),/home-epoch-stale/);
 f.timeline.paused=false;const started=[];lease.resumeAt(a=>started.push(a));assert.deepEqual(started,f.effects);
 assert.throws(()=>lease.resumeAt(()=>{}),/home-epoch-stale/);
 f.run.refresh();f.run.refresh();assert.equal(f.calls.render,0);
 lease.release();assert.equal(f.calls.render,1);assert.equal(f.marked(),false);
 assert.ok(f.effects.every(a=>a.cancelled===1));assert.ok(f.observed.every(o=>!o.current()));assert.equal(f.timeline.homeLease,undefined);
});
test("empty Pins is an independent fade and no Workspaces means no phantom effect",()=>{
 const f=homeFixture({empty:true,workspaces:false}),lease=f.run.play(f.timeline);
 assert.ok(lease);assert.deepEqual(f.effects.map(a=>a.node),[f.search,f.pinLabel,f.pins[0],f.footer]);
 assert.ok(!f.effects[2].frames[0].scale);lease.release();
});
test("Home candidate rolls back partial acquisition, computed conflict and unknown structure",()=>{
 for(const fault of ["animate","alpha","scale","structure","editing"]){
  const f=homeFixture();
  if(fault==="animate")f.fault.animate=3;else if(fault==="structure")f.pending.hidden=false;else if(fault==="editing")f.run.edit();else f.fault[fault]=true;
  assert.equal(f.run.play(f.timeline),null,fault);assert.equal(f.timeline.homeLease,undefined);
  assert.ok(f.effects.every(a=>a.cancelled===1));assert.equal(f.marked(),false);
 }
});
test("stale Home candidate cannot clear the current gate and late Home never replays Bloom",()=>{
 const f=homeFixture();assert.equal(f.run.play({...f.timeline}),null);assert.equal(f.marked(),true);
 f.timeline.paused=false;assert.equal(f.run.play(f.timeline),null);assert.equal(f.marked(),false);assert.equal(f.effects.length,0);
});
test("Home retires an effect returned after synchronous release and rejects a replaced epoch",()=>{
 const f=homeFixture();f.fault.onAnimate=()=>f.run.finish();
 assert.equal(f.run.play(f.timeline),null);assert.equal(f.effects.length,1);assert.equal(f.effects[0].cancelled,1);
 const g=homeFixture(),h=g.run.play(g.timeline);g.timeline.paused=false;
 assert.throws(()=>h.resumeAt(()=>{g.win.__nocturneStartupTimeline={};}),/home-epoch-stale/);
 h.release();assert.ok(g.effects.every(a=>a.cancelled===1));
});

function assemblyFixture({boot=false,remaining=8000,mode="bloom",failDirect=false,failHome=false,oldEngine=false}={}){
 const source=read("startup-animation.uc.mjs"),code=source.slice(source.indexOf("  function bindStartupEpoch("),source.indexOf("  function schedule(){"));
 const calls=[],effects=[],state={time:0,remaining,resume:null,reason:null};
 function node(name){const attrs=new Map();return {name,attrs,children:[],getAttribute:k=>attrs.get(k)??null,hasAttribute:k=>attrs.has(k),setAttribute:(k,v)=>attrs.set(k,v),querySelector(k){return k===".oneplane-title-island"?island:plus;},querySelectorAll:()=>[card]};}
 const island=node("island"),plus=node("plus"),card=node("card"),row=node("row"),surface=node("panel"),url=node("url"),items=node("items"),homeNode=node("home");
 homeNode.setAttribute("data-zh-startup","true");
 const root=node("root");root.setAttribute("data-zr-center-pending","true");
 const clock={currentTime:40},document={timeline:clock};
 function effect(name){const a={timeline:clock,playState:"paused",get startTime(){return this.time;},set startTime(t){this.time=t;calls.push(["start",name,t]);}};effects.push(a);return a;}
 let window;
 const engine={startupBloomVersion:oldEngine?undefined:1,start(row,opts){calls.push(["center",opts.bloomTimeline?.mode??"fold",opts.delay,opts.duration]);const a=effect("tabs");return {count:1,mode:"magnetic-bloom",startupOutcomeVersion:1,resumeAt(fn){fn(a);},release(){}};},releasePending(){}};
 const home={startupBloomVersion:1,startupOutcomeVersion:1,startupLeaseVersion:1,playStartup(t){calls.push(["home",t.mode??"fold"]);if(failHome)return;const a=effect("home");t.homeLease={startupOutcomeVersion:1,resumeAt(fn){fn(a);},release(){}};}};
 window={innerWidth:1000,__nocturneCenterMotion:engine,__zenSharedHomeV1:home,__nocturneLayoutStartup:{initial:true},__oneplaneLayoutController:{prepareWorkspaceGeometry(){}},__zenMagneticBookmarksShared:{syncAddressState(){}}};
 const run=new Function("window","document","root","nodes","state","calls","effect","startupTimeline","startupFits","createStartupOutcome","codeBoot","mode","failDirect",`
 let dead=false,playing=false,settling=false,bootPreparing=false,boot=codeBoot?{}:null,registered=true,scale=1,duration=1050;
 let pendingEngine=null,playStart=0,finishAt=0,ownedTimeline=null,homeRegistry=null,centerHandle=null,bookmarkHandle=null,lateObserver=null,lateResize=null;
 const plan=startupTimeline(0,1,mode),started=0,deadline=state.remaining,BOOT_EXIT=320,PHASE="phase",READY="ready",MANAGED="managed";
 const seen=new Set(),baseline=new Set(),animations=new Map();
 function now(){return state.time;}function decision(e,d){calls.push([e,d]);}
 function finish(reason){dead=true;state.reason=reason;}function get(id){return nodes[id]||null;}
 function bounds(n){return n?{left:0,width:100}:null;}function floatingBar(){return null;}
 function direct(n){if(failDirect)throw Error("direct");calls.push(["direct",n.name]);animations.set(effect(n.name),{});}
 function bloomStage(n){direct(n);}function bloomIsland(n){direct(n);}function reveal(n){direct(n);}function slide(n){direct(n);}function openFromCenter(n){direct(n);}
 function controls(){calls.push(["controls"]);}function revealBookmarks(){calls.push(["bookmarks"]);}function verifyBloomDirect(){calls.push(["verify"]);}
 function acquireStartupBookmarks(){calls.push(["fold-bookmarks"]);return null;}
 function armFinish(t){calls.push(["timer",t??"watchdog"]);}function scheduleLate(){calls.push(["late"]);}
 function exitBoot(fn){calls.push(["boot-exit"]);state.resume=()=>{try{fn();}catch{finish("setup-failed");}};}
 const MutationObserver=class{observe(){}};const ResizeObserver=undefined;const console={warn(){}};
 ${code}
 launch(true);return ()=>({timeline:ownedTimeline,finishAt,dead});
 `)(window,document,root,{"oneplane-tabs":row,"oneplane-toolbar-surface":surface,"urlbar-container":url,"PlacesToolbarItems":items,"zen-shared-home":homeNode},state,calls,effect,startupTimeline,startupFits,()=>({observe(){},snapshot(){return {pending:1};}}),boot,mode,failDirect);
 return {state,calls,effects,clock,window,run};
}
test("explicit Assembly Bloom passes exact timeline to Center and Home, resumes once after Boot",()=>{
 for(const boot of [false,true]){
  const f=assemblyFixture({boot});const t=f.run().timeline;
  assert.equal(t.mode,"bloom");assert.ok(f.calls.some(x=>x[0]==="center"&&x[1]==="bloom"&&x[2]===245&&x[3]===650));
  assert.ok(f.calls.some(x=>x[0]==="home"&&x[1]==="bloom"));assert.ok(!f.calls.some(x=>x[0]==="fold-bookmarks"));
  assert.ok(f.calls.findIndex(x=>x[0]==="center")<f.calls.findIndex(x=>x[0]==="direct"));
  if(boot){assert.ok(t.paused);assert.ok(f.effects.every(a=>a.startTime===undefined));assert.ok(f.calls.some(x=>x[0]==="timer"&&x[1]==="watchdog"));f.state.time=320;f.clock.currentTime=360;f.state.resume();f.state.resume();}
  assert.equal(t.paused,false);assert.ok(f.effects.every(a=>a.startTime===(boot?360:40)));
  assert.equal(f.calls.filter(x=>x[0]==="start").length,f.effects.length);
  assert.equal(f.run().finishAt,(boot?320:0)+1920);assert.equal(f.state.reason,null);
 }
});
test("explicit Assembly rejects owner mismatch, direct/Home failure and expired Boot resume",()=>{
 for(const options of [{oldEngine:true},{failDirect:true},{failHome:true}]){
  const f=assemblyFixture(options);assert.equal(f.state.reason,"setup-failed");assert.ok(f.effects.every(a=>a.startTime===undefined));
 }
 const f=assemblyFixture({boot:true,remaining:2500});f.state.time=600;f.state.resume();
 assert.equal(f.state.reason,"insufficient-budget");assert.ok(f.effects.every(a=>a.startTime===undefined));
 const g=assemblyFixture({boot:true});g.window.__nocturneCenterMotion={};g.state.resume();
 assert.equal(g.state.reason,"setup-failed");assert.ok(g.effects.every(a=>a.startTime===undefined));
});
test("Bloom direct verification rejects computed alpha, shape and replaced promise before common epoch",()=>{
 const source=read("startup-animation.uc.mjs"),code=source.slice(source.indexOf("  function bloomEffectCurrent("),source.indexOf("  function bloomDirect("));
 const run=new Function("fault",`
 const PROGRESS="--p",document={timeline:{}},ownedTimeline={paused:true},window={__nocturneStartupTimeline:ownedTimeline};
 let dead=false;const promise={},a={timeline:document.timeline,playState:"paused",pending:false,playbackRate:1,finished:promise,currentTime:0},animations=new Map([[a,{}]]);function decision(){}
 const progress=()=>a.currentTime===0?0:.5;
 window.getComputedStyle=()=>({getPropertyValue:()=>String(progress()),opacity:String(fault==="alpha"?1:progress()*.8),scale:fault==="shape"?"1 1":(.45+.55*progress())+" 1"});
 const n={getBoundingClientRect(){const width=100*(.45+.55*progress());return {left:50-width/2,top:0,width,height:30};}};
 ${code}
 prepareBloomDirect(n,a,promise,ownedTimeline,50,100,.8,{left:0,top:0,width:100,height:30});
 if(fault==="promise")a.finished={};if(fault==="owner")window.__nocturneStartupTimeline={};
 verifyBloomDirect(ownedTimeline);return a.currentTime;
 `);
 assert.equal(run("ok"),0);for(const fault of ["alpha","shape","promise","owner"])assert.throws(()=>run(fault),/assembly-bloom-/);
});
test("candidate Island prepares one visible label before the scaled shape, never a second label",()=>{
 const source=read("startup-animation.uc.mjs"),code=source.slice(source.indexOf("  function bloomIsland("),source.indexOf("  function extendFinish("));
 const run=new Function("count",`
 const stages={islandLabel:{start:510,end:700},islandShape:{start:140,end:510}},calls=[];
 const children=Array.from({length:count},(_,i)=>({name:"label"+i,matches:()=>true})),island={name:"shape",children};
 function bounds(){return {};}function bloomStage(n,s,k="fade"){calls.push([n.name,s.start,s.end,k]);}
 ${code}bloomIsland(island,stages);return calls;
 `);
 assert.deepEqual(run(1),[["label0",510,700,"fade"],["shape",140,510,"islandShape"]]);
 assert.throws(()=>run(0),/island-structure/);assert.throws(()=>run(2),/island-structure/);
});
test("Bloom late targets are ungated without replaying a wave and production switch is disabled",()=>{
 const source=read("startup-animation.uc.mjs"),code=source.slice(source.indexOf("  function revealBookmarks("),source.indexOf("  function acquireStartupBookmarks("));
 const run=new Function(`
 const ownedTimeline={mode:"bloom"},seen=new Set(),MANAGED="managed",calls=[];
 const children=[0,1].map(i=>({setAttribute(k,v){calls.push([i,k,v]);}}));function get(){return {children};}
 function bounds(){return {};}function reveal(){throw Error("late replay");}
 ${code}revealBookmarks(0,true);revealBookmarks(0,true);return calls;
 `);
 assert.deepEqual(run(),[[0,"managed","true"],[1,"managed","true"]]);
 assert.ok(source.includes("const BLOOM_CANDIDATE=false;"));
 assert.ok(source.includes("window.__nocturneCenterMotion?.startupBloomVersion!==1"));
 assert.ok(source.includes("window.__zenSharedHomeV1?.startupBloomVersion!==1"));
});

test("candidate selector preserves Fold for disabled switch, mixed versions, late/native startup and short budget",()=>{
 const source=read("startup-animation.uc.mjs"),code=source.slice(source.indexOf("  function selectStartupPlan("),source.indexOf("  function checkReadiness("));
 const run=new Function("startupTimeline","startupFits","opts",`
 const BLOOM_CANDIDATE=opts.enabled??true,scale=1,lateStart=!!opts.late,registered=!opts.noRegistration,deadline=opts.deadline??8000;
 const window={__nocturneLayoutStartup:{initial:!opts.warm},__nocturneCenterMotion:{startupBloomVersion:opts.old?undefined:1},__zenSharedHomeV1:{startupBloomVersion:opts.oldHome?undefined:1}};
 const now=()=>0;function decision(){}
 ${code}
 return selectStartupPlan(!opts.native,opts.overhead??470);
 `);
 assert.equal(run(startupTimeline,startupFits,{}).mode,"bloom");
 for(const opts of [{enabled:false},{old:true},{oldHome:true},{warm:true},{late:true},{native:true},{noRegistration:true},{deadline:2390}])
  assert.deepEqual(run(startupTimeline,startupFits,opts),startupTimeline(0,1));
});
test("Bloom direct preflight batches writes before reads and releases its temporary index",()=>{
 const source=read("startup-animation.uc.mjs"),code=source.slice(source.indexOf("  function bloomEffectCurrent("),source.indexOf("  function bloomDirect("));
 const run=new Function(`
 let dead=false;const PROGRESS="--p",document={timeline:{}},ownedTimeline={paused:true},calls=[],animations=new Map(),window={__nocturneStartupTimeline:ownedTimeline};
 function decision(){}
 function entry(id){
   let currentTime=0;const promise={},a={timeline:document.timeline,playState:"paused",pending:false,playbackRate:1,finished:promise,
    get currentTime(){return currentTime;},set currentTime(t){currentTime=t;calls.push("write"+id);}};
   const n={id,a};animations.set(a,{});prepareBloomDirect(n,a,promise,ownedTimeline,10,100,1,null);
 }
 window.getComputedStyle=n=>{calls.push("read"+n.id);const p=n.a.currentTime?0.5:0;return {getPropertyValue:()=>String(p),opacity:String(p)};};
 ${code}
 entry(0);entry(1);verifyBloomDirect(ownedTimeline);return {calls,index:ownedTimeline.bloomDirect};
 `);
 assert.deepEqual(run(),{calls:Array.from({length:3},()=>["write0","write1","read0","read1"]).flat(),index:null});
});
