import "./environment.mjs";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  archiveCourse,
  restoreCourse,
  visibleCourses,
} from "../lib/course-archive";
import { dataDir } from "../lib/store";

const restore = process.argv.indexOf("--restore");
if (restore !== -1) {
  const id = process.argv[restore + 1];
  if (!id) throw new Error("Supply the archived course ID.");
  restoreCourse(id);
  console.log("Restored course", id);
} else {
  const digest = (b: Buffer) => createHash("sha256").update(b).digest("hex");
  const expected = digest(await readFile("fixtures/probe-matrix.png"));
  const candidates = [];
  for (const packet of visibleCourses()) {
    if (
      packet.fixture &&
      [
        "Transformation lab · demonstration",
        "Evidence & decisions · demonstration",
      ].includes(packet.name)
    )
      candidates.push(packet);
    else if (
      !packet.fixture &&
      packet.name === "Image ingestion · browser check" &&
      packet.documents.length === 1 &&
      packet.documents[0].name === "probe-matrix.png"
    ) {
      try {
        if (digest(await readFile(packet.documents[0].filePath)) === expected)
          candidates.push(packet);
      } catch {
        /* An unverifiable file is left visible. */
      }
    }
  }
  console.log(
    JSON.stringify(
      candidates.map((p) => ({ id: p.id, name: p.name })),
      null,
      2,
    ),
  );
  if (process.argv.includes("--apply")) {
    const root = path.join(dataDir(), "archive");
    await mkdir(root, { recursive: true });
    await writeFile(
      path.join(root, `development-${Date.now()}.json`),
      JSON.stringify(candidates, null, 2),
    );
    for (const p of candidates)
      archiveCourse(
        p.id,
        "Known development fixture or byte-matched browser smoke-test upload",
      );
    console.log(
      `Archived ${candidates.length} development courses. Original records, uploads, attempts and spending remain intact.`,
    );
  } else
    console.log(
      "Preview only. Add --apply to archive; use --restore <course-id> to restore.",
    );
}
