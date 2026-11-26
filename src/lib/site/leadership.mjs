import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

// data.js feeds the live About page; content/officers.json is stale. data.js uses
// ESM syntax in a CommonJS package, so Node cannot import it and it is evaluated here.
export function loadLeadershipData(repoRoot = process.cwd()) {
  const dataPath = resolve(repoRoot, "src/components/data.js");
  const source = readFileSync(dataPath, "utf8");
  const scriptSource = `${source.replace(/\bexport\s+const\b/g, "const")}\n({ officerList, initiativeLeadList });`;
  const result = vm.runInNewContext(scriptSource, Object.create(null), {
    filename: dataPath,
  });
  return {
    officers: Array.isArray(result?.officerList) ? result.officerList : [],
    initiativeLeads: Array.isArray(result?.initiativeLeadList)
      ? result.initiativeLeadList
      : [],
  };
}
