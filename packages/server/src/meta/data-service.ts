import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PatchMeta } from "../coaching/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let cachedMeta: PatchMeta | null = null;
let cachedPatch: string | null = null;

export async function getMetaData(patch?: string): Promise<PatchMeta | null> {
  const targetPatch = patch || "current";

  if (cachedMeta && cachedPatch === targetPatch) {
    return cachedMeta;
  }

  try {
    // In dev: data/ relative to server package; in production (Docker): /app/data/
    const base = process.env.NODE_ENV === "production"
      ? join(__dirname, "..", "data")
      : join(__dirname, "..", "..", "data");
    const filePath = join(base, "meta", `${targetPatch}.json`);
    const raw = await readFile(filePath, "utf-8");
    cachedMeta = JSON.parse(raw) as PatchMeta;
    cachedPatch = targetPatch;
    return cachedMeta;
  } catch {
    console.warn(`No meta data found for patch: ${targetPatch}`);
    return null;
  }
}

export function clearMetaCache(): void {
  cachedMeta = null;
  cachedPatch = null;
}
