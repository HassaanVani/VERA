// Authored browser fixture. Never runs against the student's normal workspace.
import "./environment.mjs";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { dataDir, id, put } from "../lib/store";
import {
  generalDemoPacket,
  generalDemoBlueprint,
  generalDemoExam,
} from "../lib/general-demo";
import type { ImageArtifact } from "../lib/contracts";
import { imageVerification } from "../lib/exam-images";
import { checkExam } from "../lib/domain";
if (
  process.env.VERA_TEST_WORKSPACE !== "1" ||
  process.env.MODEL_API_KEY ||
  dataDir() === path.resolve(".vera")
)
  throw Error("Use an isolated credential-disabled test workspace.");
const packet = generalDemoPacket();
packet.fixture = false;
packet.name = "Muse Image browser fixture";
packet.documents[0].name = "Original browser fixture notes";
const blueprint = generalDemoBlueprint(packet),
  now = new Date().toISOString();
blueprint.visuals = "muse-image";
const revision = put("revision", {
  id: id(),
  packetId: packet.id,
  blueprint,
  approved: true,
  createdAt: now,
});
const exam = generalDemoExam(packet, blueprint, revision.id);
exam.fixture = false;
const jobId = id(),
  assetId = id();
const directory = path.join(dataDir(), "generated-images");
await mkdir(directory, { recursive: true });
const file = path.join(directory, `${assetId}.png`);
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600"><rect width="900" height="600" fill="white"/><g fill="#112637" font-family="Arial" text-anchor="middle"><text x="450" y="80" font-size="32">Recall study · given arrangement</text><circle cx="260" cy="280" r="95" fill="#bde3ff"/><circle cx="640" cy="280" r="95" fill="#bde3ff"/><text x="260" y="290" font-size="30">Group A</text><text x="640" y="290" font-size="30">Group B</text><text x="450" y="480" font-size="24">Both groups complete the same recall task.</text></g></svg>';
const bytes = await sharp(Buffer.from(svg)).png().toBuffer();
await writeFile(file, bytes);
put<ImageArtifact>("image", {
  id: assetId,
  jobId,
  exhibitId: "arrangement",
  path: file,
  mime: "image/png",
  sha256: createHash("sha256").update(bytes).digest("hex"),
  fingerprint: "authored-browser-fixture",
  model: "test-only-authored",
  width: 900,
  height: 600,
  createdAt: now,
});
exam.exam.exhibits = [
  {
    id: "arrangement",
    kind: "image",
    title: "Study arrangement",
    content: "Two participant groups complete the same recall task.",
    columns: [],
    rows: [],
    points: [],
    synthetic: true,
    illustration: {
      prompt:
        "PRIVATE_BROWSER_IMAGE_BRIEF: draw only two labeled participant groups.",
      description:
        "Two groups labeled Group A and Group B complete the same recall task.",
    },
  },
];
exam.exam.questions[0].exhibitIds = ["arrangement"];
exam.imageExhibits = [
  {
    exhibitId: "arrangement",
    assetId,
    width: 900,
    height: 600,
    description: exam.exam.exhibits[0].illustration!.description,
    reviewStatus: "consistent",
  },
];
exam.verification = [
  ...exam.verification!,
  ...imageVerification(exam.exam, exam.imageExhibits),
];
exam.issues = checkExam(exam.exam, blueprint, undefined, "", packet);
exam.ready = !exam.issues.some((i) => i.severity === "error");
put("packet", packet);
put("exam", exam);
await mkdir("output/muse-images", { recursive: true });
await writeFile(
  "output/muse-images/fixture.json",
  JSON.stringify({ packetId: packet.id, examId: exam.id, assetId }, null, 2),
);
