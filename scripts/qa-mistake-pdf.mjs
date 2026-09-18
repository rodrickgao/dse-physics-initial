import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.dirname(scriptDirectory);
const outputPath = path.resolve(process.argv[2] || path.join(repositoryRoot, "..", "tmp", "pdfs", "mistake-book-qa.pdf"));
const context = { window: {} };
vm.createContext(context);

for (const fileName of ["site-data.js", "knowledge-network-data.js", "paper2-knowledge-data.js"]) {
  vm.runInContext(await fs.readFile(path.join(repositoryRoot, fileName), "utf8"), context);
}

globalThis.PDFLib = { PDFDocument, StandardFonts, rgb };
await import("../mistake-pdf.js");

const network = {
  ...(context.window.DSE_KNOWLEDGE_NETWORK || {}),
  ...(context.window.DSE_PAPER2_KNOWLEDGE || {}),
};
const bookKeys = globalThis.DSE_MISTAKE_PDF.BOOK_SECTIONS.map((section) => section.key);
const entryOverrides = globalThis.DSE_MISTAKE_PDF.ENTRY_OVERRIDES || {};
const entriesByBook = new Map(bookKeys.map((bookKey) => [bookKey, []]));
let multiImageEntry = null;
const unmappedNetworkQuestions = [];

for (const year of context.window.DSE_SITE_DATA.years.filter((item) => item.language === "eng")) {
  year.papers.slice(0, 3).forEach((paper, paperIndex) => {
    paper.questions.forEach((question, questionIndex) => {
      const paperId = ["paper-1a", "paper-1b", "paper-2"][paperIndex];
      const identity = String(question.id || Number(String(question.label).replace(/\D/g, "")) || questionIndex + 1);
      const key = `${year.year}|${paperId}|${identity}`;
      const itemNetwork = network[key];
      const primary = itemNetwork?.links?.find((link) => link.type === "primary") || itemNetwork?.links?.[0];
      const classification = primary && bookKeys.includes(primary.bookKey) ? primary : entryOverrides[key];
      if (itemNetwork && !classification) {
        unmappedNetworkQuestions.push(key);
        return;
      }
      if (!itemNetwork) return;
      const qaEntry = {
        bookKey: classification.bookKey,
        title: `${year.year} - ${paperIndex === 0 ? "1A" : paperIndex === 1 ? "1B" : "P2"} - Q${identity}`,
        chapterEn: classification.chapterEn,
        images: question.question.map((imagePath) => path.join(repositoryRoot, "assets", year.id, imagePath)),
      };
      if (entriesByBook.get(classification.bookKey).length < 3) entriesByBook.get(classification.bookKey).push(qaEntry);
      if (!multiImageEntry && qaEntry.images.length > 1) multiImageEntry = qaEntry;
    });
  });
}

const entries = bookKeys.flatMap((bookKey) => entriesByBook.get(bookKey));
if (unmappedNetworkQuestions.length) {
  throw new Error(`Found ${unmappedNetworkQuestions.length} networked questions without a printable book: ${unmappedNetworkQuestions.slice(0, 5).join(", ")}`);
}
if ([...entriesByBook.values()].some((bookEntries) => bookEntries.length < 2)) {
  throw new Error(`Expected at least two QA entries for each book, found ${entries.length} total.`);
}
if (multiImageEntry && !entries.includes(multiImageEntry)) {
  const insertAfter = entries.map((entry) => entry.bookKey).lastIndexOf(multiImageEntry.bookKey);
  entries.splice(insertAfter + 1, 0, multiImageEntry);
}
await fs.mkdir(path.dirname(outputPath), { recursive: true });
const bytes = await globalThis.DSE_MISTAKE_PDF.createMistakeBookPdf({
  entries,
  pdfLib: globalThis.PDFLib,
  loadImageBytes: (source) => fs.readFile(source),
});
await fs.writeFile(outputPath, bytes);
console.log(JSON.stringify({ outputPath, entries: entries.length, bytes: bytes.length }));
