import test from "node:test";
import assert from "node:assert/strict";
import {createLibraryState,reduceLibrary,isCurrentLibraryQuery} from "../src/algorithms/library-state.mjs";
const event=(s,type,props={})=>reduceLibrary(s,{type,...props});
const open=(s,section="history")=>event(s,"OPEN",{section});
const done=s=>event(s,"MOTION_DONE",{epoch:s.motionEpoch});
test("History shortcut starts at history and resets after closing",()=>{
 let s=done(open(createLibraryState(),"pictures"));
 s=event(s,"QUERY",{value:"cat"});
 s=event(s,"TOGGLE",{section:"history"});
 assert.equal(s.section,"history");assert.equal(s.query,"");assert.equal(s.phase,"switching");
 s=done(s);s=event(s,"TOGGLE",{section:"history"});assert.equal(s.phase,"closing");
 s=done(s);assert.equal(s.phase,"closed");assert.equal(open(s).section,"history");
});
test("rapid switching invalidates previous motion and data",()=>{
 let s=open(createLibraryState());const first=s;
 s=open(s,"documents");s=open(s,"downloads");
 assert.equal(event(s,"MOTION_DONE",{epoch:first.motionEpoch}),s);
 assert.equal(isCurrentLibraryQuery(s,first.queryEpoch,"history"),false);
 assert.equal(done(s).phase,"open");
});
test("reopening during close invalidates completion",()=>{
 let s=done(open(createLibraryState()));s=event(s,"CLOSE");const closing=s;
 s=open(s,"pictures");assert.equal(s.phase,"opening");
 assert.equal(event(s,"MOTION_DONE",{epoch:closing.motionEpoch}),s);
 assert.equal(done(s).section,"pictures");
});
test("search changes cancel previous requests without replaying shell motion",()=>{
 let s=done(open(createLibraryState()));const old=s;
 s=event(s,"QUERY",{value:"youtube"});assert.equal(s.motionEpoch,old.motionEpoch);
 assert.equal(isCurrentLibraryQuery(s,old.queryEpoch,"history"),false);
 assert.equal(isCurrentLibraryQuery(s,s.queryEpoch,"history"),true);
 s=event(s,"CLOSE");assert.equal(isCurrentLibraryQuery(s,s.queryEpoch,"history"),false);
});
test("dispose invalidates all pending work and ignores closed input",()=>{
 let s=done(open(createLibraryState()));const old=s;
 s=event(s,"DISPOSE");assert.equal(s.phase,"closed");
 assert.equal(event(s,"MOTION_DONE",{epoch:old.motionEpoch}),s);
 assert.equal(event(s,"QUERY",{value:"x"}),s);
 assert.equal(open(s,"unknown"),s);
});
