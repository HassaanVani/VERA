import "./environment.mjs";
import { acquireWorker, heartbeat, releaseWorker, list, patchJob, get } from "../lib/store";
import type { Job } from "../lib/contracts";
import { runJob } from "../lib/pipeline";
const owner = `${process.pid}`;
if (!acquireWorker(owner)) { console.error("A VERA worker is already running. Use the existing worker or wait 20 seconds after stopping it."); process.exit(1); }
const beat = setInterval(() => heartbeat(owner), 5000);
let stopping = false, current: AbortController | undefined;
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { stopping = true; current?.abort(); });
console.log("VERA local worker ready.");
try {
  while (!stopping) {
    const job = list<Job>("job").reverse().find(j => j.status === "queued");
    if (!job) { await new Promise(r => setTimeout(r, 500)); continue; }
    current = new AbortController(); const deadline = setTimeout(() => current?.abort(), 8 * 60_000);
    const cancel = setInterval(() => { if (get<Job>("job", job.id)?.status === "cancelled") current?.abort(); }, 300);
    try { patchJob(job.id, { status: "running", stage: "Preparing" }); await runJob(job, undefined, current.signal); }
    catch (e) { if (get<Job>("job", job.id)?.status !== "cancelled") patchJob(job.id, { status: stopping ? "interrupted" : "failed", error: e instanceof Error ? e.message : "Generation failed.", stage: "Needs attention" }); }
    finally { clearInterval(cancel); clearTimeout(deadline); current = undefined; }
  }
} finally { clearInterval(beat); releaseWorker(owner); }
