import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Inspect only tracked files: local study data and private drafts stay local.
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const privatePath = /^(?:private\/|\.vera\/|output\/|test-results\/|docs\/(?:DEMO[^/]*|JUDGING[^/]*|VALIDATION|UX-RESEARCH|UI-OVERHAUL|MUSE-IMAGE-TRIAL|HUMANITIES-CAPABILITY)\.md$|scripts\/record-demo\.mjs$|assets\/video\/opening\/README\.md$)/i;
const privateFile = /(?:\.(?:sqlite(?:-[\w]+)?|db(?:-[\w]+)?|pem|key|p12|pfx|mp4|mov|webm|wav|mp3|m4a|zip|7z|pdf)$|(?:^|\/)\.env(?!\.example$))/i;
const homePath = /[A-Za-z]:[\\/]+Users[\\/]+[A-Za-z0-9_. -]+[\\/]/;
const secret = /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
const failures = [];
for (const file of files) {
  if (privatePath.test(file) || privateFile.test(file)) {
    failures.push(`${file}: private/runtime file is tracked`);
    continue;
  }
  if (/\.(?:png|jpe?g|ttf|woff2?|ico)$/i.test(file)) continue;
  const text = readFileSync(file, "utf8");
  if (homePath.test(text)) failures.push(`${file}: personal Windows home path`);
  if (secret.test(text)) failures.push(`${file}: possible credential/private key`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Public-file check passed for ${files.length} tracked files. This checks the current tree, not prior Git history.`);
}
