import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const head=read("src/toolbar/address-controller-head.js.part");
const controller=read("src/toolbar/address-controller.js.part");
const cascade=read("src/toolbar/address-cascade.js.part");

test("address rejection and watchdog finish only the exact current phase",()=>{
 const code=controller.slice(controller.indexOf("  function watchAddressEffect("),controller.indexOf("  function beginAddressPhase("));
 const run=new Function(`
 let dead=false,addressPhaseTimer=0,addressTransition={duration:420},current=true;
 const old=addressTransition,events=[],timers=[],window={setTimeout(fn,delay){timers.push({fn,delay});return timers.length;}};
 let callbacks;const animation={finished:{then(ok,bad){callbacks={ok,bad};}}};
 function finishAddressPhase(a,reason="finished"){events.push([a===old,reason]);addressTransition=null;}
 ${code}
 watchAddressEffect(old,animation,()=>current,true);armAddressPhase(old);
 const stale=callbacks;addressTransition={duration:380};current=false;armAddressPhase(addressTransition);
 stale.bad();stale.ok();timers[0].fn();
 watchAddressEffect(addressTransition,animation,()=>true,true);callbacks.bad();timers[1].fn();
 return {events,delays:timers.map(t=>t.delay)};
 `);
 assert.deepEqual(run(),{events:[[false,"cancelled"]],delays:[570,530]});
});
test("active address watchdog fires once even if old promise never settles",()=>{
 const code=controller.slice(controller.indexOf("  function armAddressPhase("),controller.indexOf("  function beginAddressPhase("));
 const run=new Function(`
 let dead=false,addressPhaseTimer=0,addressTransition={duration:380},calls=[];
 const phase=addressTransition,timers=[],window={setTimeout(fn,delay){timers.push(fn);return timers.length;}};
 function finishAddressPhase(a,reason){calls.push(reason);addressTransition=null;}
 ${code}
 armAddressPhase(phase);timers[0]();timers[0]();return {calls,addressPhaseTimer};
 `);
 assert.deepEqual(run(),{calls:["watchdog"],addressPhaseTimer:0});
});
test("address cleanup nulls identities before cancellation and isolates throwing resources",()=>{
 const code=head.slice(head.indexOf("  let addressSettling"),head.indexOf("  function addressBar"));
 const run=new Function(`
 let addressDiagnosticsFrame=1,addressAnimation={cancel(){events.push(addressAnimation===null);throw Error("cancel");}},addressIdentityAnimation={cancel(){events.push("identity");}},addressSelectionAnimation={cancel(){events.push("selection");}};
 const events=[],window={cancelAnimationFrame(){throw Error("RAF");},clearTimeout(){throw Error("timer");}};
 ${code}
 addressFallbackFrame=2;addressPhaseTimer=3;addressSettleTimer=4;addressSettleOwner={};addressSettling=true;
 addressClipHome={bar:{style:{removeProperty(k){events.push(k);}}},value:""};
 stopAddressAnimations();cancelAddressSettle();
 return {events,ids:[addressDiagnosticsFrame,addressFallbackFrame,addressPhaseTimer,addressSettleTimer],owner:addressSettleOwner,settling:addressSettling};
 `);
 assert.deepEqual(run(),{events:[true,"identity","selection","clip-path"],ids:[0,0,0,0],owner:null,settling:false});
});
test("replaced URLbar cannot receive old native dismissal",()=>{
 const code=controller.slice(controller.indexOf("  function finishAddressPhase("),controller.indexOf("  function watchAddressEffect("));
 const run=new Function(`
 let dead=false,addressTransition={name:"closing-wave",bar:{}},addressWasOpen=false,clears=0,dismissals=0;
 const replacement={},window={};
 function addressBar(){return replacement;}function clearAddressAnimation(){clears++;addressTransition=null;}
 function nativeInlineOpen(){return true;}function finishDismissUrl(){dismissals++;}
 ${code}
 const old=addressTransition;finishAddressPhase(old,"cancelled");finishAddressPhase(old);
 return {clears,dismissals,addressWasOpen};
 `);
 assert.deepEqual(run(),{clears:1,dismissals:0,addressWasOpen:true});
});
test("same-direction cascade replaces a distinct phase, not a duplicate notification",()=>{
 const code=cascade.slice(cascade.indexOf("  function animateTabCascade("),cascade.indexOf("    // Suspend Magnetic Hover"));
 // Stop after admission; execute the real state/identity predicates.
 const run=new Function(`
 let dead=false,cascadeState="hiding",cascadeGeneration=4,cascadePhase={},cascadePointer=null,panelLastPointer=null,stops=0,accepted=[];
 const row={hasAttribute:()=>false};
 function hoverSupported(){return true;}function cancelCascadeHandoff(){stops++;}function cancelHoverTimer(){}function addressMotionEnabled(){return true;}function resetTabCascade(){}function settleHidden(){}
 ${code.slice(0,code.lastIndexOf("    try{"))}
 accepted.push(generation); }
 const old=cascadePhase;animateTabCascade(true,old);animateTabCascade(true);animateTabCascade(true,{epoch:30});animateTabCascade(true,cascadePhase);
 return {stops,accepted,generation:cascadeGeneration};
 `);
 assert.deepEqual(run(),{stops:1,accepted:[5],generation:5});
});
test("cascade cleanup retires all effects even when one cancel throws",()=>{
 const code=cascade.slice(cascade.indexOf("  function cancelCascadeAnimations("),cascade.indexOf("  function cancelCascadeHandoff("));
 const run=new Function(`
 const log=[],window={},node=()=>({removeAttribute(k){log.push(k);}}),first=node(),second=node();
 const cascadeAnimations=new Map([[first,{cancel(){log.push(cascadeAnimations.size);throw Error("cancel");}}],[second,{cancel(){log.push("second");}}]]);
 const cascadeDecorations=new Set([{node:second,anim:{cancel(){log.push("decoration");}}}]);
 ${code}
 cancelCascadeAnimations();return {log,size:cascadeAnimations.size,decorations:cascadeDecorations.size};
 `);
 assert.deepEqual(run(),{log:[0,"data-op-cascade-member","data-op-cascade-frame","data-op-bookmark-wave-member","second","data-op-cascade-member","data-op-cascade-frame","data-op-bookmark-wave-member","decoration","data-op-bookmark-wave-card"],size:0,decorations:0});
});
test("cascade handoff is bounded and stale callbacks cannot clear successor",()=>{
 const code=cascade.slice(cascade.indexOf("  function cancelCascadeHandoff("),cascade.indexOf("  function collectCascadeSlots("));
 const handoff=code.slice(code.indexOf("  function finishCascadeHandoff("));
 const cancel=code.slice(0,code.indexOf("  function resetTabCascade("));
 const run=new Function(`
 let dead=false,cascadeGeneration=1,cascadeHandoffFrame=0,cascadeTimer=0,resets=0,hover=0;
 const frames=[],timers=[],window={requestAnimationFrame(fn){frames.push(fn);return frames.length;},setTimeout(fn,delay){timers.push({fn,delay});return timers.length;},cancelAnimationFrame(){},clearTimeout(){}};
 function resetTabCascade(){cascadeGeneration++;cancelCascadeHandoff();resets++;}function clearTabHover(){hover++;}
 ${cancel}${handoff}
 finishCascadeHandoff(1);cascadeGeneration++;finishCascadeHandoff(2);
 frames[0]();timers[0].fn();const before=[resets,cascadeHandoffFrame,cascadeTimer];
 timers[1].fn();frames[1]();return {before,resets,hover,delay:timers[1].delay};
 `);
 assert.deepEqual(run(),{before:[0,2,2],resets:1,hover:1,delay:150});
});
test("cascade cancellation and timeout converge once, with a new handoff generation",()=>{
 const code=cascade.slice(cascade.indexOf("  function completeCascade("),cascade.indexOf("  function animateTabCascade("));
 const run=new Function(`
 let dead=false,cascadeGeneration=1,cascadeState="showing",events=[],window={};
 function settleHidden(g){events.push(["hidden",g]);}function finishCascadeHandoff(g){events.push(["handoff",g]);}
 ${code}
 completeCascade(1,false,"cancelled");completeCascade(1,false,"watchdog");
 cascadeState="hiding";completeCascade(2,true,"finished");completeCascade(2,true,"cancelled");
 return {events,generation:cascadeGeneration};
 `);
 assert.deepEqual(run(),{events:[["handoff",2],["hidden",3]],generation:3});
});

test("address cleanup only clears the exact old bar after replacement",()=>{
 const code=head.slice(head.indexOf("  function clearAddressAnimation()"),head.length);
 const run=new Function(`
 const old={},replacement={},log=[],url={removeAttribute(){},toggleAttribute(){}},root={removeAttribute(){}};
 let addressTransition={bar:old},addressSettleOwner=null;
 function stopAddressAnimations(){}function cancelAddressSettle(){}function addressBar(){return replacement;}function nativeInlineOpen(){return true;}
 function clearAddressBarMarks(bar){log.push(bar===old?"old":"replacement");}function reconcileTabCascade(){}
 ${code}clearAddressAnimation();return log;
 `);
 assert.deepEqual(run(),["old"]);
});
test("same-direction replacement preserves sampled scale after prior reversal",()=>{
 const code=cascade.slice(cascade.indexOf("        let frames=opening||bookmark"),cascade.indexOf("        play(v.node,frames,timing"));
 const run=new Function(`
 const opening=true,bookmark=false,previous="hiding",v={opacity:.3,x:.6,y:.7};
 function cascadeFadeFrames(){return [{opacity:.3},{opacity:0}];}function cascadeRevealFrames(){throw Error("unexpected");}
 ${code}return frames;
 `);
 assert.deepEqual(run(),[{opacity:.3,scale:"0.6 0.7"},{opacity:0,scale:"0.6 0.7"}]);
});

test("geometry interruption does not dismiss a replacement URLbar",()=>{
 const visibility=read("src/layout/visibility.js.part");
 const code=visibility.slice(visibility.indexOf("    if(addressTransition){",visibility.indexOf("  function onWindowGeometryChanged()")),visibility.indexOf("    if(cascadeState===",visibility.indexOf("  function onWindowGeometryChanged()")));
 const run=new Function(`
 const old={},replacement={};let addressTransition={name:"closing-wave",bar:old},addressSettling=false,dismissals=0,clears=0,current=replacement;
 function addressBar(){return current;}function clearAddressAnimation(){clears++;addressTransition=null;}function finishDismissUrl(){dismissals++;}
 function resize(){${code}}
 resize();current=old;addressTransition={name:"closing-wave",bar:old};resize();return {dismissals,clears};
 `);
 assert.deepEqual(run(),{dismissals:1,clears:2});
});
