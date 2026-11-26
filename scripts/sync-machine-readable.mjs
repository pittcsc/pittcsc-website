import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadLeadershipData } from "../src/lib/site/leadership.mjs";
import { buildMachineReadableFiles } from "../src/lib/site/machineReadable.mjs";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const leadership = loadLeadershipData(repoRoot);

for (const [filePath, content] of Object.entries(buildMachineReadableFiles(leadership))) {
  const relativePath = `static${filePath}`;
  writeFileSync(resolve(repoRoot, relativePath), content, "utf8");
  console.log(`Wrote ${relativePath}`);
}
