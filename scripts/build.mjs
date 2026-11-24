import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const plan = JSON.parse(await readFile(resolve(root, "scripts/build-plan.json"), "utf8"));
if (plan.schema !== 1) throw new Error("Unsupported build-plan schema");
const check = process.argv.includes("--check");
if (process.argv.slice(2).some(arg => arg !== "--check")) throw new Error("Usage: node scripts/build.mjs [--check]");

async function assemble(entries) {
  const seen = new Set();
  const parts = [];
  for (const {path, kind} of entries) {
    if (!path.startsWith("src/") || path.includes("..") || seen.has(path)) throw new Error("Invalid/duplicate source: " + path);
    seen.add(path);
    let source = await readFile(resolve(root, path), "utf8");
    if (!source.endsWith("\n")) throw new Error("Source must end with LF: " + path);
    if (kind === "esm-inline") {
      // Only named imports between our pure modules and named exports
      // of function/const declarations are supported by this first-stage
      // compiler. Preserve existing order and closure semantics exactly.
      source = source.replace(/^import [^\n]+\n/gm, "").replace(/^([ \t]*)export (function|const) /gm, "$1$2 ");
      if (/^\s*(import|export)\s/m.test(source)) throw new Error("Unsupported ESM declaration in " + path);
    } else if (kind !== "section") throw new Error("Unknown source kind: " + kind);
    parts.push(source);
  }
  return parts.join("");
}

for (const [output, entries] of [["layout.uc.mjs", plan.javascript], ["chrome.css", plan.stylesheet], ["overlay.uc.mjs", plan.overlay], ["library-services.uc.mjs", plan.libraryServices], ["library.uc.mjs", plan.library], ["startup-animation.uc.mjs", plan.startupAnimation], ["closing-animation.uc.mjs", plan.closingAnimation], ["docs/nocturne/labs/startup-motion.html", plan.startupMotionLab]]) {
  const data = await assemble(entries);
  const path = resolve(root, output);
  if (check) {
    if (await readFile(path, "utf8") !== data) throw new Error(output + " is stale; run npm run build");
  } else {
    await writeFile(path, data);
  }
  console.log((check ? "Verified " : "Built ") + output);
}
