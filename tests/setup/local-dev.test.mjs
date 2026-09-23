import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createPrivateKey } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createEnvFile, createSigningKeys, localValues } from "../../scripts/local-dev.mjs";

const status = {
  API_URL: "http://127.0.0.1:54321",
  DB_URL: "postgresql://postgres:local-password@127.0.0.1:54322/postgres",
  PUBLISHABLE_KEY: "sb_publishable_test",
  SECRET_KEY: "must-not-copy",
};

test("local config copies only public frontend fields and the backend database URL", () => {
  const values = localValues(status);
  assert.deepEqual(Object.keys(values.frontend).sort(), [
    "GATSBY_API_URL",
    "GATSBY_SUPABASE_PUBLISHABLE_KEY",
    "GATSBY_SUPABASE_URL",
  ]);
  assert.equal(
    values.frontend.GATSBY_SUPABASE_PUBLISHABLE_KEY,
    status.PUBLISHABLE_KEY,
  );
  assert.equal(values.backend.DATABASE_URL, `${status.DB_URL}?sslmode=disable`);
  assert.equal(values.backend.SUPABASE_AUTH_URL, `${status.API_URL}/auth/v1`);
  assert.ok(!JSON.stringify(values).includes(status.SECRET_KEY));
});

test("local signing key is asymmetric, private, and preserved on subsequent setup", () => {
  const dir = mkdtempSync(join(tmpdir(), "csc-key-test-"));
  try {
    const destination = join(dir, "keys.json");
    assert.equal(createSigningKeys(destination), true);
    const original = readFileSync(destination, "utf8");
    const [key] = JSON.parse(original);
    assert.equal(key.alg, "ES256");
    assert.deepEqual(key.key_ops, ["sign", "verify"]);
    assert.equal(createPrivateKey({ key, format: "jwk" }).asymmetricKeyType, "ec");
    assert.equal(statSync(destination).mode & 0o777, 0o600);
    assert.equal(createSigningKeys(destination), false);
    assert.equal(readFileSync(destination, "utf8"), original);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rejects missing publishable keys and remote services", () => {
  assert.throws(
    () => localValues({ ...status, PUBLISHABLE_KEY: undefined }),
    /missing/,
  );
  assert.throws(
    () => localValues({ ...status, API_URL: "https://example.com" }),
    /remote/,
  );
  assert.throws(
    () => localValues({ ...status, DB_URL: "postgresql://example.com/db" }),
    /remote/,
  );
});

test("env creation replaces placeholders, preserves other fields, and never overwrites", () => {
  const dir = mkdtempSync(join(tmpdir(), "csc-env-test-"));
  try {
    const example = join(dir, "example");
    const destination = join(dir, ".env");
    writeFileSync(example, "# comment\nDATABASE_URL=placeholder\nPORT=8080\n");
    assert.equal(
      createEnvFile(example, destination, { DATABASE_URL: "local" }),
      true,
    );
    assert.equal(
      readFileSync(destination, "utf8"),
      "# comment\nDATABASE_URL=local\nPORT=8080\n",
    );
    assert.equal(
      createEnvFile(example, destination, { DATABASE_URL: "replacement" }),
      false,
    );
    assert.ok(readFileSync(destination, "utf8").includes("DATABASE_URL=local"));
    assert.throws(
      () =>
        createEnvFile(example, join(dir, "invalid"), {
          DATABASE_URL: "bad\nvalue",
        }),
      /Invalid/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Node and Go version pins stay aligned", () => {
  const read = (name) =>
    readFileSync(new URL(`../../${name}`, import.meta.url), "utf8");
  const versions = Object.fromEntries(
    read(".tool-versions")
      .trim()
      .split(/\n/)
      .map((line) => line.split(/\s+/)),
  );
  assert.equal(read(".nvmrc").trim(), versions.nodejs);
  assert.equal(
    read("netlify.toml").match(/NODE_VERSION = "([^"]+)"/)[1],
    versions.nodejs,
  );
  assert.equal(read("backend/go.mod").match(/^go (.+)$/m)[1], versions.golang);
});
