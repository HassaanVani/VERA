import "./environment.mjs";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { ingest, deduplicate } from "../lib/ingestion";
import { sha256, assertFrozen } from "../lib/evaluation";
import { benchmarkCourses, type BenchmarkSource } from "../lib/ocw-benchmark";
import type { Packet } from "../lib/contracts";

// Restore published inputs without replacing the public protocol or its hashes.
const target =
  process.argv.find((a) => a.startsWith("--root="))?.slice(7) ||
  ".vera/evaluations/ocw-cross-subject";
process.env.VERA_DATA_DIR = target;
const root = path.resolve(target),
  publicRoot = "fixtures/ocw-cross-subject";
const protocolBytes = await readFile(`${publicRoot}/protocol.json`),
  protocol = JSON.parse(protocolBytes.toString());
const published = JSON.parse(
  await readFile(`${publicRoot}/frozen-sources.json`, "utf8"),
) as {
  protocolSha256: string;
  sources: (BenchmarkSource & {
    course: string;
    phase: string;
    downloadUrl: string;
    sha256: string;
  })[];
  packets: {
    course: string;
    phase: string;
    hash: string;
    pages: { id: string; pages: number[] }[];
  }[];
};
assertFrozen(published.protocolSha256, protocolBytes, "Published protocol");
try {
  await access(path.join(root, "frozen.json"));
  throw new Error(
    "A private freeze already exists here. Use status; do not replace it.",
  );
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
await mkdir(root, { recursive: true });
const frozen: {
  protocol: unknown;
  sources: unknown[];
  packets: { course: string; phase: string; packet: Packet; hash: string }[];
} = { protocol, sources: [], packets: [] };
for (const course of benchmarkCourses)
  for (const phase of ["development", "evaluation"] as const) {
    const documents: Packet["documents"] = [];
    const frozenPacket = published.packets.find(
      (p) => p.course === course.id && p.phase === phase,
    )!;
    for (const source of published.sources.filter(
      (s) => s.course === course.id && s.phase === phase,
    )) {
      const response = await fetch(source.downloadUrl, {
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok)
        throw new Error(`Restore ${source.id}: HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      assertFrozen(source.sha256, bytes, source.id);
      const file = path.join(
        root,
        `${source.id}.${source.html ? "html" : "pdf"}`,
      );
      try {
        await writeFile(file, bytes, { flag: "wx" });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        assertFrozen(source.sha256, await readFile(file), source.id);
      }
      frozen.sources.push({ ...source, file });
      if (source.partition !== "generation") continue;
      const pages = frozenPacket.pages.find((d) => d.id === source.id)!.pages;
      const document = await ingest(
        new File([bytes], `${source.id}.pdf`, { type: "application/pdf" }),
        source.role,
        `${course.id}-${phase}`,
        { pages },
      );
      document.id = source.id;
      if (["psychology", "history"].includes(course.id))
        for (const page of document.pages) page.imagePath = undefined;
      documents.push(document);
    }
    const packet: Packet = {
      id: `${course.id}-${phase}`,
      name: `${course.subject} ${phase} OCW excerpts`,
      createdAt: new Date().toISOString(),
      fixture: false,
      documents: deduplicate(documents),
    };
    const hash = sha256(
      JSON.stringify({
        ...packet,
        createdAt: "frozen",
        documents: packet.documents.map((d) => ({
          ...d,
          filePath: "",
          pages: d.pages.map((p) => ({
            ...p,
            imagePath: p.imagePath ? "available" : undefined,
          })),
        })),
      }),
    );
    if (hash !== frozenPacket.hash)
      throw new Error(
        `Restored packet differs: ${course.id}/${phase}. Do not overwrite the published freeze; inspect dependency/extraction versions.`,
      );
    frozen.packets.push({ course: course.id, phase, packet, hash });
    console.log(
      `Verified ${course.id}/${phase} · ${packet.documents.reduce((n, d) => n + d.pages.length, 0)} selected pages`,
    );
  }
await writeFile(
  path.join(root, "frozen.json"),
  JSON.stringify(frozen, null, 2) + "\n",
  { flag: "wx" },
);
console.log(
  "Restored all eight packets; raw source and normalized packet hashes match. No targets extracted and no model calls.",
);
