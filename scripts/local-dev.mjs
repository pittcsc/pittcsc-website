import { spawnSync } from "node:child_process";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options,
  });
  if (result.error || result.status !== 0) {
    // Do not include captured stdout: Supabase status contains privileged keys.
    throw new Error(`${command} failed. Check the output above and try again.`);
  }
  return result.stdout;
}

export function localValues(status) {
  for (const key of ["API_URL", "DB_URL", "PUBLISHABLE_KEY"]) {
    if (typeof status[key] !== "string" || !status[key]) {
      throw new Error(`Local Supabase status is missing ${key}.`);
    }
  }
  const api = new URL(status.API_URL);
  const database = new URL(status.DB_URL);
  for (const url of [api, database]) {
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
      throw new Error(
        "Refusing to generate local configuration for a remote service.",
      );
    }
  }
  database.searchParams.set("sslmode", "disable");
  return {
    frontend: {
      GATSBY_API_URL: "http://localhost:8080",
      GATSBY_SUPABASE_URL: status.API_URL,
      GATSBY_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
    },
    backend: {
      DATABASE_URL: database.toString(),
      SUPABASE_AUTH_URL: `${api.origin}/auth/v1`,
    },
  };
}

export function createSigningKeys(destination) {
  if (existsSync(destination)) return false;
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const key = {
    ...privateKey.export({ format: "jwk" }),
    kid: randomUUID(),
    alg: "ES256",
    use: "sig",
    key_ops: ["sign", "verify"],
    ext: true,
  };
  try {
    writeFileSync(destination, JSON.stringify([key]) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
}

export function createEnvFile(example, destination, values) {
  // Existing files, including intentional custom configuration, are left intact.
  if (existsSync(destination)) return false;
  let content = readFileSync(example, "utf8");
  for (const [key, value] of Object.entries(values)) {
    if (/[\r\n]/.test(value)) throw new Error(`Invalid value for ${key}.`);
    content = content.replace(
      new RegExp(`^${key}=.*$`, "m"),
      () => `${key}=${value}`,
    );
  }
  try {
    writeFileSync(destination, content, { flag: "wx", mode: 0o600 });
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
}

function main(mode) {
  if (!["setup", "start"].includes(mode)) {
    throw new Error("Usage: node scripts/local-dev.mjs setup|start");
  }
  const docker = spawnSync("docker", ["info"], { stdio: "ignore" });
  if (docker.error || docker.status !== 0) {
    throw new Error(
      "Docker is unavailable. Install/start Docker Desktop, wait until it is ready, then retry.",
    );
  }
  if (mode === "setup") {
    run("npm", ["ci", "--legacy-peer-deps"]);
    run("go", ["mod", "download"], { cwd: resolve(root, "backend") });
  }
  const supabase = resolve(root, "node_modules/.bin/supabase");
  if (!existsSync(supabase))
    throw new Error("Dependencies are missing. Run `mise run setup` first.");
  createSigningKeys(resolve(root, "supabase/signing_keys.json"));
  // Suppress the successful status table, which includes secrets. Progress/errors
  // still reach stderr; use the JSON status below only in memory.
  run(supabase, ["start"], { stdio: ["ignore", "pipe", "inherit"] });
  // Apply only pending local migrations. Never reset or target a linked project.
  run(supabase, ["migration", "up", "--local"]);
  const status = JSON.parse(
    run(supabase, ["status", "-o", "json"], {
      stdio: ["ignore", "pipe", "inherit"],
      encoding: "utf8",
    }),
  );
  const values = localValues(status);
  for (const [example, destination, config] of [
    [".env.example", ".env.development", values.frontend],
    ["backend/.env.example", "backend/.env", values.backend],
  ]) {
    const created = createEnvFile(
      resolve(root, example),
      resolve(root, destination),
      config,
    );
    console.log(`${created ? "Created" : "Preserved"} ${destination}`);
  }
  console.log(
    "Local Supabase is ready. No existing env files or database data were overwritten.",
  );
  if (mode === "setup")
    console.log(
      "Next: mise run dev — website http://localhost:8000, API http://localhost:8080/health",
    );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main(process.argv[2]);
  } catch (error) {
    console.error(`Setup failed: ${error.message}`);
    process.exitCode = 1;
  }
}
