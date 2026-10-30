import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Job } from "./contracts";

export const dataDir = () => path.resolve(/* turbopackIgnore: true */ process.env.VERA_DATA_DIR || ".vera");
let database: DatabaseSync | undefined;
export function db() {
  if (!database) {
    mkdirSync(dataDir(), { recursive: true });
    database = new DatabaseSync(path.join(dataDir(), "vera.sqlite"));
    database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL,id TEXT PRIMARY KEY,json TEXT NOT NULL,updated TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS records_kind ON records(kind);
      CREATE TABLE IF NOT EXISTS usage (id TEXT PRIMARY KEY,job_id TEXT,stage TEXT,model TEXT,bucket TEXT,reserved REAL NOT NULL,cost REAL,status TEXT NOT NULL,input_tokens INTEGER,output_tokens INTEGER,latency_ms INTEGER,error TEXT,created TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS worker_lock (id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT,heartbeat INTEGER);`);
  }
  return database;
}
export function transaction<T>(fn: () => T): T {
  db().exec("BEGIN IMMEDIATE");
  try { const r = fn(); db().exec("COMMIT"); return r; } catch (e) { db().exec("ROLLBACK"); throw e; }
}
export const id = () => randomUUID();
export function put<T extends { id: string }>(kind: string, value: T): T {
  db().prepare("INSERT INTO records VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json,updated=excluded.updated").run(kind, value.id, JSON.stringify(value), new Date().toISOString()); return value;
}
export function get<T>(kind: string, recordId: string): T | undefined {
  const r = db().prepare("SELECT json FROM records WHERE kind=? AND id=?").get(kind, recordId) as { json: string } | undefined;
  return r ? JSON.parse(r.json) as T : undefined;
}
export function list<T>(kind: string): T[] { return (db().prepare("SELECT json FROM records WHERE kind=? ORDER BY updated DESC").all(kind) as { json: string }[]).map(r => JSON.parse(r.json) as T); }
export function patchJob(jobId: string, patch: Partial<Job>): Job {
  return transaction(() => {
    const j = get<Job>("job", jobId); if (!j) throw new Error("Job not found.");
    if (j.status === "cancelled") throw new Error("Generation cancelled.");
    return put("job", { ...j, ...patch, updatedAt: new Date().toISOString() });
  });
}
export function reserveUsage(jobId: string, stage: string, model: string, amount: number) {
  return transaction(() => {
    const bucket = process.env.VERA_BUDGET_BUCKET || "development";
    if (!["development", "demo"].includes(bucket)) throw new Error("Budget bucket must be development or demo. The USD 30 reserve is locked.");
    const cap = bucket === "development" ? 90 : 30;
    const used = db().prepare("SELECT COALESCE(SUM(COALESCE(cost,reserved)),0) AS total FROM usage WHERE bucket=?").get(bucket) as { total: number };
    const total = db().prepare("SELECT COALESCE(SUM(COALESCE(cost,reserved)),0) AS total FROM usage").get() as { total: number };
    if (!Number.isFinite(amount) || amount <= 0 || used.total + amount > cap || total.total + amount > 120) throw new Error("Spending limit reached. The USD 30 reserve remains untouched.");
    const callId = id(); db().prepare("INSERT INTO usage(id,job_id,stage,model,bucket,reserved,status,created) VALUES(?,?,?,?,?,?,?,?)").run(callId, jobId, stage, model, bucket, amount, "reserved", new Date().toISOString()); return callId;
  });
}
export function settleUsage(callId: string, result: { cost?: number; input?: number; output?: number; latency: number; error?: string }) {
  db().prepare("UPDATE usage SET cost=?,status=?,input_tokens=?,output_tokens=?,latency_ms=?,error=? WHERE id=?").run(result.cost ?? null, result.cost === undefined ? "uncertain" : "settled", result.input ?? null, result.output ?? null, result.latency, result.error ?? null, callId);
}
export function usageSummary() {
  const rows = db().prepare("SELECT bucket,COUNT(*) calls,COALESCE(SUM(COALESCE(cost,reserved)),0) spent, SUM(CASE WHEN status!='settled' THEN 1 ELSE 0 END) uncertain FROM usage GROUP BY bucket").all();
  return { buckets: rows, reserve: 30, limit: 120, recent: db().prepare("SELECT * FROM usage ORDER BY created DESC LIMIT 20").all() };
}
export function acquireWorker(owner: string): boolean {
  return transaction(() => {
    const existing = db().prepare("SELECT heartbeat FROM worker_lock WHERE id=1").get() as { heartbeat: number } | undefined;
    if (existing && Date.now() - existing.heartbeat < 20_000) return false;
    db().prepare("INSERT INTO worker_lock VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,heartbeat=excluded.heartbeat").run(owner, Date.now());
    for (const job of list<Job>("job").filter(j => j.status === "running")) put("job", { ...job, status: "interrupted", error: "Worker stopped during generation. Retry starts a new job; uncertain usage remains reserved.", updatedAt: new Date().toISOString() });
    db().prepare("UPDATE usage SET status='uncertain' WHERE status='reserved'").run();
    return true;
  });
}
export function heartbeat(owner: string) { db().prepare("UPDATE worker_lock SET heartbeat=? WHERE id=1 AND owner=?").run(Date.now(), owner); }
export function releaseWorker(owner: string) { db().prepare("DELETE FROM worker_lock WHERE owner=?").run(owner); }
export function workerOnline() { const r = db().prepare("SELECT heartbeat FROM worker_lock WHERE id=1").get() as { heartbeat: number } | undefined; return !!r && Date.now() - r.heartbeat < 20_000; }
