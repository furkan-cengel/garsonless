import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function atLeast(version, minimum) {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) return false;
  const actual = version.split(".").map(Number);
  for (const [index, value] of minimum.split(".").map(Number).entries()) {
    if (actual[index] !== value) return actual[index] > value;
  }
  return true;
}

export function assertRuntimeVersions(versions) {
  for (const [name, minimum] of Object.entries({
    next: "15.5.25",
    sharp: "0.35.4",
    heif: "1.23.2",
  })) {
    if (!atLeast(versions[name], minimum))
      throw new Error(
        `${name}: ${versions[name] ?? "missing"}; minimum ${minimum}`,
      );
  }
}

export function inspectRuntime(appRoot) {
  const appRequire = createRequire(resolve(appRoot, "package.json"));
  const nextPath = appRequire.resolve("next/package.json");
  const nextRequire = createRequire(nextPath);
  const sharp = nextRequire("sharp");
  const versions = {
    next: nextRequire("./package.json").version,
    sharp: sharp.versions.sharp,
    heif: sharp.versions.heif,
    vips: sharp.versions.vips,
  };
  assertRuntimeVersions(versions);
  return { appRoot, ...versions };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== "--app-root"))
      throw new Error("Usage: --app-root <deployed-app-directory>");
    const roots = args.length
      ? [args[1]]
      : ["dashboard", "menu", "kitchen", "marketing", "platform-admin"].map(
          (app) => `apps/${app}`,
        );
    console.log(JSON.stringify(roots.map(inspectRuntime), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
