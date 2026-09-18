import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const siteRoot = path.resolve(import.meta.dirname, "..");
const dataSource = fs.readFileSync(path.join(siteRoot, "site-data.js"), "utf8");
const data = JSON.parse(dataSource.slice(dataSource.indexOf("{"), dataSource.lastIndexOf("}") + 1));
const outputRoot = path.resolve(siteRoot, "..", "tmp", "paper2-qa-sheets");
fs.mkdirSync(outputRoot, { recursive: true });

function paper2(edition) {
  return edition.papers.find((paper) => paper.title === "Paper 2" || paper.title === "卷二");
}

function xml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]);
}

const cellWidth = 460;
const cellHeight = 300;
const labelHeight = 34;

for (const year of [...new Set(data.years.map((edition) => Number(edition.year)))]) {
  const editions = data.years
    .filter((edition) => Number(edition.year) === year)
    .sort((a, b) => a.language.localeCompare(b.language));
  const rows = [];
  for (const edition of editions) {
    const questions = paper2(edition).questions;
    for (let section = 1; section <= 4; section += 1) {
      const selected = [1, 4, 8].map((item) => questions.find((question) => question.id === `${section}.${item}`));
      rows.push({ edition, section, selected });
    }
  }

  const composites = [];
  for (const [rowIndex, row] of rows.entries()) {
    for (const [columnIndex, question] of row.selected.entries()) {
      const inputPath = path.join(siteRoot, "assets", row.edition.id, question.question[0]);
      const image = await sharp(inputPath)
        .resize({
          width: cellWidth - 20,
          height: cellHeight - labelHeight - 10,
          fit: "contain",
          background: "white",
        })
        .png()
        .toBuffer();
      const left = columnIndex * cellWidth + 10;
      const top = rowIndex * cellHeight + labelHeight;
      composites.push({ input: image, left, top });
      const label = `${row.edition.id} · ${question.id}`;
      composites.push({
        input: Buffer.from(`<svg width="${cellWidth}" height="${labelHeight}"><rect width="100%" height="100%" fill="#eef2f7"/><text x="12" y="24" font-size="20" font-family="Arial" fill="#111827">${xml(label)}</text></svg>`),
        left: columnIndex * cellWidth,
        top: rowIndex * cellHeight,
      });
    }
  }
  await sharp({
    create: { width: cellWidth * 3, height: cellHeight * rows.length, channels: 3, background: "white" },
  }).composite(composites).jpeg({ quality: 88 }).toFile(path.join(outputRoot, `${year}.jpg`));
}

console.log(`Wrote ${outputRoot}`);
