import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("the pinned Node runtime can parse JSON in Netlify's Gatsby API wrapper", () => {
  // Run in a child process: an incompatible Node version crashes this wrapper with
  // an uncaught stream error, even if the body parser's promise is caught.
  const script = `
    const pluginRequire = require("node:module").createRequire(
      require.resolve("@netlify/plugin-gatsby/package.json")
    );
    const { createRequestObject } = pluginRequire("./lib/templates/api/utils.js");
    const parseBody = pluginRequire("co-body");
    const event = {
      path: "/api/meet/create",
      httpMethod: "POST",
      multiValueHeaders: {
        "content-type": ["application/json"],
        "content-length": ["2"],
      },
      body: "{}",
      isBase64Encoded: false,
    };
    const request = createRequestObject({ event, context: {} });
    parseBody(request).then((body) => console.log(JSON.stringify(body)));
  `;

  const result = spawnSync(process.execPath, ["-e", script], {
    cwd: new URL("../..", import.meta.url),
    encoding: "utf8",
    timeout: 5000,
  });

  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.equal(result.stdout.trim(), "{}");
});
