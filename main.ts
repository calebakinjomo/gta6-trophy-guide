// Leonida Trophy Guide — entrypoint for the make.fun gta6-trophy-guide-01 bounty.
//
// Copies app/ and screenshots/ from this repository into the output directory
// and writes /output/dossier.json with buildDossier from vendor/makefun-frontend.ts.
// Node 22 standard library only. It never deletes or wipes the output folder
// (the grader's filesystem is read-only outside /output), it writes only inside
// the output path, and running it twice writes identical bytes.

import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-frontend.ts";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

// The gate's own caps: dossier at most 1.5 MiB, app at most 993 entries / 48 MiB,
// screenshots at most 4 files of 256 KiB each, every app path at most 1000 bytes.
const DOSSIER_CAPS = {
  text_max_bytes: 1000000,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function copyTreeIntoOutput(name: string): void {
  const source = join(repoRoot, name);
  const target = join(outputDir, name);
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true, force: true });
}

function main(): void {
  mkdirSync(outputDir, { recursive: true });
  copyTreeIntoOutput("app");
  copyTreeIntoOutput("screenshots");
  const dossier = buildDossier(repoRoot, DOSSIER_CAPS);
  writeFileSync(join(outputDir, "dossier.json"), dossier);
}

main();
