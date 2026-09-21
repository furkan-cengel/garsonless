import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

// Creates only a disposable local database. Never reads project environment files.
const name = "masabu-menu-translation-test";
const here = dirname(fileURLToPath(import.meta.url));
const migrations = resolve(here, "../../supabase/migrations");
function docker(args, input) {
  const result = spawnSync("docker", args, { encoding: "utf8", input });
  if (result.status !== 0)
    throw new Error(result.stderr || String(result.error));
  return result.stdout;
}
if (spawnSync("docker", ["inspect", name], { stdio: "ignore" }).status === 0) {
  throw new Error(
    `${name} already exists. Inspect and explicitly remove your test container before setup.`,
  );
}
docker([
  "run",
  "-d",
  "--name",
  name,
  "--label",
  "masabu.menu-translation-test=true",
  "--tmpfs",
  "/var/lib/postgresql/data",
  "-p",
  "127.0.0.1:55440:5432",
  "-e",
  "POSTGRES_PASSWORD=translation-test-only",
  "-v",
  `${migrations}:/tmp/migrations:ro`,
  "-v",
  `${resolve(here, "../inventory/test-bootstrap.sql")}:/tmp/bootstrap.sql:ro`,
  "public.ecr.aws/supabase/postgres:17.6.1.127",
]);
for (let i = 0; i < 120; i++) {
  if (
    spawnSync(
      "docker",
      ["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"],
      { stdio: "ignore" },
    ).status === 0
  )
    break;
  if (i === 119)
    throw new Error(
      "Local test database did not start. Inspect docker logs masabu-menu-translation-test.",
    );
  await delay(500);
}
docker([
  "exec",
  name,
  "psql",
  "-U",
  "supabase_admin",
  "-d",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-c",
  "grant all on schema auth,storage to postgres;",
  "-f",
  "/tmp/bootstrap.sql",
]);
for (const file of readdirSync(migrations)
  .filter((n) => n.endsWith(".sql"))
  .sort()) {
  try {
    docker([
      "exec",
      name,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-1",
      "-f",
      `/tmp/migrations/${file}`,
    ]);
  } catch (error) {
    throw new Error(`Migration ${file}: ${error.message}`, { cause: error });
  }
}
console.log("CLEAN_MIGRATIONS_OK: isolated PostgreSQL at 127.0.0.1:55440");
