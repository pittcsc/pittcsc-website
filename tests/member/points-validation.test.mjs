import assert from "node:assert/strict";
import test from "node:test";

import { isSecurePointURL } from "../../src/lib/points/validation.mjs";

test("point links require a plain HTTPS URL", () => {
  for (const value of [
    "javascript:alert(document.domain)",
    "data:text/html,hello",
    "http://example.org/paper",
    "https://user:password@example.org/paper",
    "https://example.org:444/paper",
    "https://example.org./paper",
    "https://127.0.0.1/paper",
    "https://[::1]/paper",
    "https://example.org/a b",
    "not a URL",
    "",
  ]) {
    assert.equal(isSecurePointURL(value), false, value);
  }

  assert.equal(isSecurePointURL(" https://example.org/paper?draft=1#notes "), true);
  assert.equal(isSecurePointURL("https://github.com/pittcsc/site/pull/1"), true);
});
