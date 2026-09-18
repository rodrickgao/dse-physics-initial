import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const siteRoot = path.resolve(import.meta.dirname, "..");
const assetsRoot = path.join(siteRoot, "assets");
const siteDataPath = path.join(siteRoot, "site-data.js");
const recordsPath = path.resolve(siteRoot, "..", "真题库", "records.json");
const outputPath = path.join(import.meta.dirname, "paper2-crop-manifest.json");
const layoutPaths = process.argv.length > 2
  ? process.argv.slice(2).map((value) => path.resolve(value))
  : [path.join(siteRoot, "..", "tmp", "paper2-layout-eng.json")];

function readSiteData() {
  const source = fs.readFileSync(siteDataPath, "utf8");
  return JSON.parse(source.slice(source.indexOf("{"), source.lastIndexOf("}") + 1));
}

function normalizedPath(value) {
  return path.normalize(value).toLocaleLowerCase();
}

function median(values) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)];
}

function firstWord(line) {
  return line.words?.[0] || null;
}

function labelPrefix(text, sectionNumber) {
  const source = String(text || "").trim();
  if (/^[（(]/.test(source)) return false;
  const first = sectionNumber === 1 ? "[1lI]" : String(sectionNumber);
  return new RegExp(`^${first}\\s*[.．,，、:：]?\\s*[1-8](?:\\D|$)`).test(source);
}

function pageLabelX(layout, sectionNumber) {
  const candidates = [];
  for (const line of layout?.lines || []) {
    const word = firstWord(line);
    if (!word || word.left > layout.width * 0.24 || !labelPrefix(line.text, sectionNumber)) continue;
    candidates.push(word.left);
  }
  if (!candidates.length) return null;

  const frequencies = new Map();
  for (const value of candidates) {
    const bucket = Math.round(value / 5) * 5;
    frequencies.set(bucket, (frequencies.get(bucket) || 0) + 1);
  }
  const mode = [...frequencies].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  const clustered = candidates.filter((value) => Math.abs(value - mode) <= 12);
  return median(clustered.length ? clustered : candidates);
}

function ocrAnchors(layoutPages, sectionNumber) {
  const anchors = [];
  for (const [pageIndex, page] of layoutPages.entries()) {
    for (const line of page.lines || []) {
      const word = firstWord(line);
      if (!word || word.left > page.width * 0.24 || !labelPrefix(line.text, sectionNumber)) continue;
      const normalized = String(line.text)
        .trim()
        .replace(/^[lI]/, sectionNumber === 1 ? "1" : "$&")
        .replace(/[．,，、:：]/g, ".")
        .replace(/\s+/g, "");
      const match = normalized.match(new RegExp(`^${sectionNumber}\\.?([1-8])(?:\\D|$)`));
      anchors.push({ pageIndex, top: word.top, text: line.text, item: match ? Number(match[1]) : null });
    }
  }
  return anchors;
}

function projectionGroups(data, info, labelX) {
  const left = Math.max(0, Math.round(labelX) - 4);
  const top = Math.round(info.height * 0.045);
  const width = Math.min(40, info.width - left);
  const bottom = Math.round(info.height * 0.93);
  const rowInk = [];
  for (let y = top; y < bottom; y += 1) {
    let count = 0;
    for (let x = left; x < left + width; x += 1) {
      if (data[y * info.width + x] < 205) count += 1;
    }
    rowInk.push(count);
  }

  const groups = [];
  let start = null;
  let last = null;
  let total = 0;
  let maximum = 0;
  for (let y = 0; y < rowInk.length; y += 1) {
    if (rowInk[y] < 1) continue;
    if (start === null || y - last > 3) {
      if (start !== null) groups.push({ top: start + top, bottom: last + top, total, maximum });
      start = y;
      total = 0;
      maximum = 0;
    }
    last = y;
    total += rowInk[y];
    maximum = Math.max(maximum, rowInk[y]);
  }
  if (start !== null) groups.push({ top: start + top, bottom: last + top, total, maximum });

  const scale = info.width / 1100;
  return groups.filter((group) => {
    const groupHeight = group.bottom - group.top + 1;
    return group.top < info.height * 0.92
      && groupHeight >= Math.max(7, 9 * scale)
      && groupHeight <= 22 * scale
      && group.total >= 32 * scale
      && group.total <= 190 * scale
      && group.maximum <= 28 * scale;
  });
}

function anchorMatches(groups, anchors) {
  return anchors.filter((anchor) => groups.some((group) => Math.abs(group.top - anchor.top) <= 18)).length;
}

async function projectionCandidates(imagePath, preferredXRatio, anchors) {
  const image = sharp(imagePath);
  const { data, info } = await image
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const preferredX = preferredXRatio ? info.width * preferredXRatio : null;
  const xValues = new Set();
  if (preferredX) {
    for (let offset = -8; offset <= 8; offset += 2) xValues.add(Math.round(preferredX + offset));
  }
  for (let ratio = 0.075; ratio <= 0.165; ratio += 0.003) xValues.add(Math.round(info.width * ratio));

  const attempts = [...xValues].map((labelX) => {
    const groups = projectionGroups(data, info, labelX);
    const matches = anchorMatches(groups, anchors);
    const plausibleCount = groups.length >= 1 && groups.length <= 5;
    const score = matches * 40
      + (plausibleCount ? 15 - Math.abs(groups.length - Math.max(anchors.length, 3)) : -groups.length * 4)
      - (preferredX ? Math.abs(labelX - preferredX) * 0.08 : 0);
    return { labelX, groups, score, matches };
  });
  attempts.sort((a, b) => b.score - a.score || b.matches - a.matches || a.groups.length - b.groups.length);
  return attempts[0];
}

function candidateAssignmentScore(candidate, item, anchors) {
  let score = 6 - Math.abs(candidate.total - 105) / 28;
  const ownAnchors = anchors.filter((anchor) => anchor.item === item);
  if (ownAnchors.length) {
    const distances = ownAnchors
      .filter((anchor) => anchor.pageIndex === candidate.pageIndex)
      .map((anchor) => Math.abs(anchor.top - candidate.top));
    if (!distances.length) return -5000;
    const distance = Math.min(...distances);
    score += distance <= 24 ? 300 - distance : -3000;
  }
  for (const anchor of anchors) {
    if (anchor.item === item || anchor.pageIndex !== candidate.pageIndex) continue;
    if (Math.abs(anchor.top - candidate.top) <= 20) score -= 800;
  }
  if (anchors.some((anchor) => anchor.item === null
    && anchor.pageIndex === candidate.pageIndex
    && Math.abs(anchor.top - candidate.top) <= 20)) score += 40;
  score -= candidate.pageIndex * 0.1;
  return score;
}

function chooseEight(candidates, anchors) {
  const ordered = [...candidates].sort((a, b) => a.pageIndex - b.pageIndex || a.top - b.top);
  let states = Array.from({ length: 9 }, () => null);
  states[0] = { score: 0, selected: [] };
  for (const candidate of ordered) {
    const next = states.map((state) => (state ? { score: state.score, selected: [...state.selected] } : null));
    for (let count = 0; count < 8; count += 1) {
      const state = states[count];
      if (!state) continue;
      const previous = state.selected.at(-1);
      const spacingPenalty = previous?.pageIndex === candidate.pageIndex && candidate.top - previous.top < 70
        ? -10000
        : 0;
      const score = state.score + candidateAssignmentScore(candidate, count + 1, anchors) + spacingPenalty;
      if (!next[count + 1] || score > next[count + 1].score) {
        next[count + 1] = { score, selected: [...state.selected, candidate] };
      }
    }
    states = next;
  }
  return states[8]?.selected || ordered.slice(0, 8);
}

function sourceSections(siteData) {
  const previousManifest = fs.existsSync(outputPath)
    ? JSON.parse(fs.readFileSync(outputPath, "utf8"))
    : null;
  const previousByEdition = new Map((previousManifest?.editions || []).map((edition) => [edition.editionId, edition]));
  return siteData.years.map((edition) => {
    const paper = edition.papers.find((item) => item.title === "Paper 2" || item.title === "卷二");
    const previousEdition = previousByEdition.get(edition.id);
    const sections = paper.questions.length === 4
      ? paper.questions.map((question, index) => ({
        section: index + 1,
        question: question.question,
        answer: question.answer,
      }))
      : previousEdition?.sections.map((section) => ({
        section: section.section,
        question: section.question,
        answer: section.answer,
      }));
    if (!sections?.length) throw new Error(`Missing original Paper 2 source pages for ${edition.id}`);
    return {
      editionId: edition.id,
      year: Number(edition.year),
      language: edition.language,
      sections,
    };
  });
}

function rebalanceSectionPages(editions, layoutByPath) {
  for (const edition of editions) {
    // The 2019 English assets were originally grouped in fixed page windows,
    // which placed each structured question at the start of the next section.
    // Other editions already have section-correct source groups.
    if (edition.editionId !== "2019-eng") continue;
    const pages = edition.sections.flatMap((section) => section.question);
    const starts = [];
    for (let sectionNumber = 1; sectionNumber <= 4; sectionNumber += 1) {
      const start = pages.findIndex((relativePath) => {
        const layout = layoutByPath.get(normalizedPath(path.join(assetsRoot, edition.editionId, relativePath)));
        const first = sectionNumber === 1 ? "[1lI]" : String(sectionNumber);
        const header = new RegExp(`Q\\s*[.．•·]?\\s*${first}[^0-9]{0,12}(?:Multiple|多\\s*項)`, "i");
        const lines = layout?.lines || [];
        if (lines.some((line) => header.test(String(line.text).replace(/\s+/g, " ")))) return true;
        const labelLines = lines.filter((line) => {
          const word = firstWord(line);
          return word && word.left < layout.width * 0.24 && labelPrefix(line.text, sectionNumber);
        });
        return labelLines.length >= 2;
      });
      starts.push(start);
    }
    if (starts.some((value, index) => value < 0 || (index > 0 && value <= starts[index - 1]))) continue;
    edition.sections.forEach((section, index) => {
      const end = index < 3 ? starts[index + 1] : pages.length;
      section.question = pages.slice(starts[index], end);
    });
  }
  return editions;
}

function answerKeysByYear(records) {
  const manual = {
    "2015-3": "ADBCBCCA",
    "2016-2": "CDCBBDAA",
    "2017-3": "BCBDCD*A",
    "2018-3": "ABCDADCB",
    "2019-2": "CDABADBA",
    "2019-4": "CBADACDB",
    "2020-1": "DDCBCBCA",
    "2020-3": "BADCABDA",
  };

  const result = new Map();
  for (const record of records.filter((item) => item.paper_id === "paper-2")) {
    const key = `${record.year}-${record.question_number}`;
    if (manual[key]) {
      result.set(key, manual[key]);
      continue;
    }
    const source = String(record.answer_transcription || "").slice(0, 1200).replace(/\s+/g, " ");
    let choices = "";
    for (let number = 1; number <= 8; number += 1) {
      const match = source.match(new RegExp(`(?:^|[^0-9])${number}\\s*[.):,，．-]?\\s*([ABCD])(?:[^A-Z]|$)`, "i"));
      choices += match ? match[1].toUpperCase() : "?";
    }
    if (!choices.includes("?")) result.set(key, choices);
  }
  return result;
}

// Windows OCR occasionally misses small question labels in low-resolution scans.
// These visually verified anchors cover only the affected sections; all values
// are source-image pixel coordinates at the top of the printed item label.
const manualItemOverrides = {
  "2012-eng-1": [[0, 169], [0, 411], [0, 674], [0, 833], [0, 1103], [1, 242], [1, 845], [1, 1064]],
  "2013-chn-4": [[0, 169], [0, 486], [0, 651], [0, 1022], [1, 101], [1, 304], [1, 759], [1, 996]],
  "2013-eng-4": [[0, 187], [0, 514], [0, 684], [0, 1038], [1, 108], [1, 323], [1, 770], [1, 1017]],
  "2014-chn-1": [[0, 192], [0, 378], [0, 564], [1, 213], [1, 400], [2, 103], [2, 973], [2, 1125]],
  "2014-eng-4": [[0, 232], [0, 668], [0, 889], [1, 117], [1, 385], [1, 600], [1, 934], [1, 1162]],
  "2016-chn-4": [[0, 225], [0, 481], [0, 664], [0, 941], [1, 105], [1, 289], [1, 460], [1, 983]],
  "2016-eng-2": [[0, 220], [0, 526], [0, 810], [1, 242], [1, 418], [1, 594], [1, 775], [1, 1063]],
  "2017-chn-4": [[0, 226], [0, 679], [0, 1013], [1, 121], [1, 631], [2, 117], [2, 526], [2, 891]],
  "2018-chn-1": [[0, 181], [0, 400], [0, 597], [0, 830], [1, 192], [1, 482], [1, 802], [2, 126]],
  "2018-chn-4": [[0, 242], [0, 548], [0, 771], [1, 170], [1, 380], [1, 766], [1, 994], [2, 126]],
  "2019-chn-3": [[0, 253], [0, 596], [0, 768], [0, 987], [1, 126], [1, 535], [1, 762], [1, 921]],
  "2019-chn-4": [[0, 235], [0, 442], [0, 599], [0, 778], [1, 81], [1, 320], [1, 481], [1, 654]],
  "2019-chn-1": [[0, 192], [0, 337], [1, 232], [1, 440], [1, 620], [1, 820], [2, 420], [2, 653]],
  "2021-4": [[0, 234], [0, 487], [0, 769], [1, 161], [1, 462], [1, 785], [2, 141], [2, 438]],
  "2021-chinese-1": [[0, 266], [0, 803], [0, 1148], [1, 253], [1, 599], [1, 904], [2, 213], [2, 498]],
  "2021-chinese-3": [[0, 240], [0, 461], [0, 731], [0, 933], [1, 140], [1, 721], [2, 138], [2, 837]],
  "2023-1": [[0, 240], [0, 517], [0, 808], [1, 292], [1, 586], [2, 127], [2, 819], [2, 1220]],
  "2023-3": [[0, 241], [0, 1001], [1, 123], [1, 511], [1, 1087], [2, 128], [2, 339], [2, 592]],
  "2023-eng-3": [[0, 234], [0, 964], [1, 124], [1, 495], [1, 1065], [2, 123], [2, 354], [2, 577]],
};

function manualItems(editionId, sectionNumber) {
  const anchors = manualItemOverrides[`${editionId}-${sectionNumber}`];
  return anchors?.map(([pageIndex, top], index) => ({
    item: index + 1,
    pageIndex,
    top,
    bottom: top + 15,
    total: 105,
    maximum: 14,
    labelX: null,
    manuallyVerified: true,
  })) || null;
}

async function main() {
  const siteData = readSiteData();
  const layouts = layoutPaths.flatMap((layoutFile) => JSON.parse(fs.readFileSync(layoutFile, "utf8")));
  const layoutByPath = new Map(layouts.map((item) => [normalizedPath(item.path), item]));
  const editions = rebalanceSectionPages(sourceSections(siteData), layoutByPath);
  const englishByYear = new Map(editions.filter((item) => item.language === "eng").map((item) => [item.year, item]));
  const answerKeys = answerKeysByYear(JSON.parse(fs.readFileSync(recordsPath, "utf8")).records);
  const manifest = { version: 1, generatedAt: new Date().toISOString(), editions: [] };
  const issues = [];

  for (const edition of editions) {
    const english = englishByYear.get(edition.year);
    const editionEntry = { ...edition, sections: [] };
    for (const section of edition.sections) {
      const englishSection = english.sections[section.section - 1];
      const englishLayouts = englishSection.question.map((relativePath) => {
        const absolutePath = path.join(assetsRoot, english.editionId, relativePath);
        const layout = layoutByPath.get(normalizedPath(absolutePath));
        if (!layout) throw new Error(`Missing OCR layout: ${absolutePath}`);
        return layout;
      });
      const ownLayouts = section.question.map((relativePath) => (
        layoutByPath.get(normalizedPath(path.join(assetsRoot, edition.editionId, relativePath))) || null
      ));
      const englishPageRatios = englishLayouts.map((layout) => {
        const labelX = pageLabelX(layout, section.section);
        return labelX ? labelX / layout.width : null;
      });
      const ownPageRatios = ownLayouts.map((layout, pageIndex) => {
        const labelX = pageLabelX(layout, section.section);
        if (labelX) return labelX / layout.width;
        return section.question.length === englishSection.question.length ? englishPageRatios[pageIndex] : null;
      });
      const anchors = ownLayouts.flatMap((layout, pageIndex) => (
        layout ? ocrAnchors([layout], section.section).map((anchor) => ({ ...anchor, pageIndex })) : []
      ));
      const detected = [];
      for (const [pageIndex, relativePath] of section.question.entries()) {
        const imagePath = path.join(assetsRoot, edition.editionId, relativePath);
        const pageAnchors = anchors.filter((anchor) => anchor.pageIndex === pageIndex);
        const attempt = await projectionCandidates(imagePath, ownPageRatios[pageIndex], pageAnchors);
        detected.push(...attempt.groups.map((candidate) => ({ ...candidate, pageIndex, labelX: attempt.labelX })));
      }
      for (const anchor of anchors.filter((item) => item.item !== null)) {
        detected.push({
          top: anchor.top,
          bottom: anchor.top + 15,
          total: 105,
          maximum: 14,
          pageIndex: anchor.pageIndex,
          labelX: null,
          synthesizedFromOcr: true,
        });
      }
      detected.sort((a, b) => a.pageIndex - b.pageIndex || a.top - b.top);
      const verifiedItems = manualItems(edition.editionId, section.section);
      const selected = verifiedItems || chooseEight(detected, anchors);
      if (selected.length !== 8) {
        issues.push({ edition: edition.editionId, section: section.section, detected: detected.length, selected });
      }
      const structuredStartPage = selected.length ? selected.at(-1).pageIndex + 1 : null;
      editionEntry.sections.push({
        ...section,
        answerKey: answerKeys.get(`${edition.year}-${section.section}`) || null,
        labelXRatio: ownPageRatios,
        detectedCount: detected.length,
        items: selected.map((candidate, index) => ({ item: index + 1, ...candidate })),
        structuredStartPage,
      });
    }
    manifest.editions.push(editionEntry);
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${outputPath}`);
  console.log(`Sections with fewer than eight detected boundaries: ${issues.length}`);
  for (const issue of issues) console.log(JSON.stringify(issue));
}

await main();
