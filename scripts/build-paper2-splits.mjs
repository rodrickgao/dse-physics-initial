import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const siteRoot = path.resolve(import.meta.dirname, "..");
const assetsRoot = path.join(siteRoot, "assets");
const siteDataPath = path.join(siteRoot, "site-data.js");
const manifestPath = path.join(import.meta.dirname, "paper2-crop-manifest.json");

const sectionTitles = {
  eng: [
    "Astronomy and Space Science",
    "Atomic World",
    "Energy and Use of Energy",
    "Medical Physics",
  ],
  chn: [
    "天文學和航天科學",
    "原子世界",
    "能量和能源的使用",
    "醫學物理學",
  ],
};

function readSiteData() {
  const source = fs.readFileSync(siteDataPath, "utf8");
  return JSON.parse(source.slice(source.indexOf("{"), source.lastIndexOf("}") + 1));
}

function slash(value) {
  return value.split(path.sep).join("/");
}

function isPaper2(paper) {
  return paper.title === "Paper 2" || paper.title === "卷二";
}

function cropPath(editionId, sectionNumber, itemNumber) {
  return `p2-split/s${sectionNumber}-q${itemNumber}.jpg`;
}

const sharedStemOverrides = {
  "2014-chn-1.7": { pageIndex: 2, top: 690, bottom: 965, file: "p2-split/s1-q7-q8-stem.jpg" },
  "2014-chn-1.8": { pageIndex: 2, top: 690, bottom: 965, file: "p2-split/s1-q7-q8-stem.jpg" },
  "2014-eng-1.7": { pageIndex: 2, top: 700, bottom: 1000, file: "p2-split/s1-q7-q8-stem.jpg" },
  "2014-eng-1.8": { pageIndex: 2, top: 700, bottom: 1000, file: "p2-split/s1-q7-q8-stem.jpg" },
};
const builtSharedStems = new Set();

async function buildSharedStem(edition, section, item) {
  const stem = sharedStemOverrides[`${edition.id}-${section.section}.${item.item}`];
  if (!stem) return null;
  const sourcePath = path.join(assetsRoot, edition.id, section.question[stem.pageIndex]);
  const metadata = await sharp(sourcePath).metadata();
  const horizontalMargin = Math.round(metadata.width * 0.055);
  const outputPath = path.join(assetsRoot, edition.id, stem.file);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (!builtSharedStems.has(outputPath)) {
    await sharp(sourcePath)
      .extract({
        left: horizontalMargin,
        top: stem.top,
        width: metadata.width - horizontalMargin * 2,
        height: stem.bottom - stem.top,
      })
      .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
      .toFile(outputPath);
    builtSharedStems.add(outputPath);
  }
  return slash(stem.file);
}

async function buildItemCrop(edition, section, item, nextItem) {
  const relativeSource = section.question[item.pageIndex];
  if (!relativeSource) throw new Error(`Missing source page for ${edition.id} S${section.section}.${item.item}`);
  const sourcePath = path.join(assetsRoot, edition.id, relativeSource);
  const metadata = await sharp(sourcePath).metadata();
  const horizontalMargin = Math.round(metadata.width * 0.055);
  const topPadding = Math.max(14, Math.round(metadata.height * 0.011));
  const bottomPadding = Math.max(10, Math.round(metadata.height * 0.007));
  const top = Math.max(0, Math.round(item.top - topPadding));
  const samePageNext = nextItem?.pageIndex === item.pageIndex ? nextItem : null;
  const pageBottom = Math.round(metadata.height * 0.925);
  const bottom = samePageNext
    ? Math.max(top + 40, Math.round(samePageNext.top - bottomPadding))
    : pageBottom;
  const outputRelative = cropPath(edition.id, section.section, item.item);
  const outputPath = path.join(assetsRoot, edition.id, outputRelative);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await sharp(sourcePath)
    .extract({
      left: horizontalMargin,
      top,
      width: metadata.width - horizontalMargin * 2,
      height: Math.min(metadata.height - top, bottom - top),
    })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toFile(outputPath);
  return slash(outputRelative);
}

async function main() {
  const siteData = readSiteData();
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const manifestByEdition = new Map(manifest.editions.map((edition) => [edition.editionId, edition]));
  let cropCount = 0;

  for (const edition of siteData.years) {
    const manifestEdition = manifestByEdition.get(edition.id);
    if (!manifestEdition) throw new Error(`Missing crop manifest edition: ${edition.id}`);
    const paper = edition.papers.find(isPaper2);
    if (!paper) throw new Error(`Missing Paper 2 in ${edition.id}`);
    const questions = [];

    for (const section of manifestEdition.sections) {
      if (section.items.length !== 8 || !/^[ABCD*]{8}$/.test(section.answerKey || "")) {
        throw new Error(`Invalid section manifest: ${edition.id} S${section.section}`);
      }
      for (const [index, item] of section.items.entries()) {
        const imagePath = await buildItemCrop(edition, section, item, section.items[index + 1]);
        const sharedStemPath = await buildSharedStem(edition, section, item);
        const choice = section.answerKey[index];
        questions.push({
          id: `${section.section}.${item.item}`,
          label: `Q${section.section}.${item.item}`,
          section: section.section,
          knowledgeQuestion: section.section,
          kind: "multiple-choice",
          question: sharedStemPath ? [sharedStemPath, imagePath] : [imagePath],
          answer: [],
          answerText: choice === "*" ? "Deleted" : choice,
        });
        cropCount += 1;
      }

      const structuredPages = section.question.slice(section.structuredStartPage).map(slash);
      if (!structuredPages.length || !section.answer.length) {
        throw new Error(`Missing structured question or answer: ${edition.id} S${section.section}`);
      }
      questions.push({
        id: `${section.section}.S`,
        label: edition.language === "eng" ? `Q${section.section} · Structured` : `Q${section.section} · 大題`,
        section: section.section,
        knowledgeQuestion: section.section,
        kind: "structured",
        question: structuredPages,
        answer: section.answer.map(slash),
      });
    }

    paper.description = edition.language === "eng"
      ? "32 multiple-choice questions and 4 structured questions"
      : "32 道選擇題及 4 道大題";
    paper.sections = sectionTitles[edition.language].map((title, index) => ({
      id: index + 1,
      label: edition.language === "eng" ? `Section ${index + 1}` : `第 ${index + 1} 卷`,
      title,
    }));
    paper.questions = questions;
  }

  fs.writeFileSync(siteDataPath, `window.DSE_SITE_DATA = ${JSON.stringify(siteData)};\n`);
  console.log(`Generated ${cropCount} Paper 2 question crops and updated ${siteData.years.length} editions.`);
}

await main();
