import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { put, get, id, reserveUsage, settleUsage, acquireWorker, releaseWorker } from "../lib/store";
import { demoPacket, demoBlueprint, savedDemo } from "../lib/demo";
import { queue, saveRevision, beginAttempt, updateAttempt } from "../lib/service";
import type { Job, Revision } from "../lib/contracts";
beforeAll(()=>{process.env.VERA_DATA_DIR=mkdtempSync(path.join(tmpdir(),"vera-tests-"));});
function setup(){const p=put("packet",demoPacket()),b=demoBlueprint(p),r=put<Revision>("revision",{id:id(),packetId:p.id,blueprint:b,approved:false,createdAt:new Date().toISOString()});return {p,b,r};}
describe("durable workflow boundaries",()=>{
 it("requires approval and rejects a stale revision after editing",()=>{const {p,b,r}=setup();expect(()=>queue("generate",p.id,r.id)).toThrow(/Approve/);const approved=saveRevision(r.id,b,true);const edited=saveRevision(approved.id,{...b,title:"Edited"},false);expect(edited.approved).toBe(false);expect(()=>queue("generate",p.id,approved.id)).toThrow(/Approve/);});
 it("rejects duplicate active jobs and invalid blueprint sums",()=>{const {p,b,r}=setup();expect(()=>saveRevision(r.id,{...b,totalPoints:999},true)).toThrow();queue("analyze",p.id);expect(()=>queue("analyze",p.id)).toThrow(/active job/);});
 it("resumes attempts and locks responses and scores correctly",()=>{const {p,b,r}=setup();const e=put("exam",savedDemo(p,r.id,b));const a=beginAttempt(e.id);expect(beginAttempt(e.id).id).toBe(a.id);expect(()=>updateAttempt(a.id,{selfScores:{3:4}})).toThrow(/Submit/);updateAttempt(a.id,{responses:{1:"A"}});updateAttempt(a.id,{submit:true});expect(()=>updateAttempt(a.id,{responses:{1:"B"}})).toThrow(/locked/);expect(()=>updateAttempt(a.id,{selfScores:{3:7}})).toThrow(/score/);expect(updateAttempt(a.id,{selfScores:{3:5}}).selfScores[3]).toBe(5);});
 it("does not accept late responses after the timer expires",()=>{const {p,b,r}=setup();const e=put("exam",savedDemo(p,r.id,b));const a=beginAttempt(e.id);put("attempt",{...a,endsAt:Date.now()-100});const late=updateAttempt(a.id,{responses:{1:"A"}});expect(late.responses[1]).toBeUndefined();expect(late.submittedAt).toBeTruthy();});
 it("blocks practice for an unresolved exam",()=>{const {p,b,r}=setup();const e=put("exam",{...savedDemo(p,r.id,b),ready:false});expect(()=>beginAttempt(e.id)).toThrow(/unresolved/);});
 it("reserves spending atomically and protects the reserve",()=>{process.env.VERA_BUDGET_BUCKET="development";const c=reserveUsage("test","stage","model",89);expect(()=>reserveUsage("test","stage","model",2)).toThrow(/limit/);settleUsage(c,{cost:0.01,latency:1});expect(()=>reserveUsage("test","stage","model",1)).not.toThrow();process.env.VERA_BUDGET_BUCKET="reserve";expect(()=>reserveUsage("test","stage","model",1)).toThrow(/locked/);process.env.VERA_BUDGET_BUCKET="development";});
 it("only one worker can own the queue and recovers interrupted jobs",()=>{const {p}=setup(),now=new Date().toISOString();const j=put<Job>("job",{id:id(),kind:"analyze",packetId:p.id,status:"running",stage:"call",createdAt:now,updatedAt:now});expect(acquireWorker("test-owner")).toBe(true);expect(acquireWorker("another")).toBe(false);expect(get<Job>("job",j.id)?.status).toBe("interrupted");releaseWorker("test-owner");});
});
