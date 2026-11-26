import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadLeadershipData } from "../src/lib/site/leadership.mjs";
import {
  buildAboutMarkdown,
  buildLlmsFullTxt,
  buildLlmsTxt,
  buildSponsorsMarkdown,
} from "../src/lib/site/machineReadable.mjs";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const leadership = loadLeadershipData(repoRoot);

const outputs = [
  ["static/llms.txt", buildLlmsTxt()],
  ["static/llms-full.txt", buildLlmsFullTxt(leadership)],
  ["static/about.md", buildAboutMarkdown(leadership)],
  ["static/sponsors.md", buildSponsorsMarkdown()],
];

for (const [relativePath, content] of outputs) {
  writeFileSync(resolve(repoRoot, relativePath), content, "utf8");
  console.log(`Wrote ${relativePath}`);
}
