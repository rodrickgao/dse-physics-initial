import fs from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(scriptDir, "..");
const workspaceDir = path.resolve(siteDir, "..");
const dataPath = path.join(siteDir, "textbook-data.js");
const formulaSourcePath = path.join(
  workspaceDir,
  "skill-staging",
  "dse-physics-core-expert",
  "references",
  "knowledge-en.json",
);

const source = await fs.readFile(dataPath, "utf8");
const context = { window: {} };
vm.runInNewContext(source, context, { filename: dataPath });

const payload = context.window.DSE_TEXTBOOK_DATA;
const formulaSource = JSON.parse(await fs.readFile(formulaSourcePath, "utf8"));
const formulasBySequence = new Map(
  formulaSource
    .filter((point) => point.formula)
    .map((point) => [point.sequence, {
      formula: point.formula,
      formula_notes: point.formula_notes || "",
    }]),
);

if (payload.languages.eng.length !== 365 || payload.languages.chn.length !== 365) {
  throw new Error("Expected 365 knowledge points in each language.");
}
if (formulasBySequence.size !== 205) {
  throw new Error(`Expected 205 normalized formula records, found ${formulasBySequence.size}.`);
}

payload.languages.eng = payload.languages.eng.map((point) => ({
  ...point,
  ...(formulasBySequence.get(point.sequence) || {}),
}));
payload.version = "2026-08-13-formula-layout";

await fs.writeFile(dataPath, `window.DSE_TEXTBOOK_DATA = ${JSON.stringify(payload)};\n`, "utf8");
console.log(`Enriched ${formulasBySequence.size} English formula cards; retained ${payload.languages.chn.length} Chinese cards.`);
