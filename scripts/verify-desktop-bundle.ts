import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { isBuiltin } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = resolve(__dirname, "..", "packages", "desktop", "out", "main", "index.js");

// Provided by Electron at runtime, not present in node_modules.
const PROVIDED = new Set(["electron"]);

async function main(): Promise<void> {
  const src = await readFile(BUNDLE, "utf-8");

  // Collect every require("...") and require('...') call. Bundlers emit both.
  const requirePattern = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;
  const specifiers = new Set<string>();
  for (const match of src.matchAll(requirePattern)) {
    const spec = match[1];
    if (!spec) continue;
    if (spec.startsWith(".") || spec.startsWith("/")) continue; // relative — bundled
    specifiers.add(spec);
  }

  const req = createRequire(BUNDLE);
  const missing: string[] = [];
  for (const spec of specifiers) {
    if (PROVIDED.has(spec)) continue;
    if (isBuiltin(spec)) continue;
    if (spec.startsWith("node:")) continue;
    try {
      req.resolve(spec);
    } catch {
      missing.push(spec);
    }
  }

  if (missing.length > 0) {
    console.error(`Desktop main bundle has ${missing.length} unresolvable require(s):`);
    for (const spec of missing.sort()) console.error(`  - ${spec}`);
    console.error(`\nThese will crash the packaged app on launch since electron-builder excludes node_modules from the asar.`);
    console.error(`Either bundle them by adding to externalizeDepsPlugin's exclude option, or include them in the package.`);
    process.exit(1);
  }

  console.log(`OK — all ${specifiers.size} bare require specifiers resolve.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
