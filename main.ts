// Leonida Legends — GTA 6 trophy guide and tracker.
// Copies app/ and screenshots/ into the output directory and writes
// dossier.json with make.fun's buildDossier. Node 22, standard library only.
// Never wipes the output folder: the grader's filesystem is read-only
// outside /output, so this program only writes inside the output path.

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-frontend.ts";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

function copyEntryDir(name: string): void {
  const source = join(repoRoot, name);
  const target = join(outputDir, name);
  if (!existsSync(source)) {
    throw new Error("main.ts: missing " + name + "/ in the repository");
  }
  mkdirSync(outputDir, { recursive: true });
  cpSync(source, target, { recursive: true });
}

copyEntryDir("app");
copyEntryDir("screenshots");

const dossier = buildDossier(outputDir, {
  text_max_bytes: 1572864,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, "dossier.json"), dossier);
console.log("wrote " + join(outputDir, "dossier.json") + " (" + dossier.length + " bytes)");
