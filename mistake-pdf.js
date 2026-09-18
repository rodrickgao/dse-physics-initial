(function attachMistakePdf(global) {
  "use strict";

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 38;
  const FOOTER_HEIGHT = 22;
  const CONTENT_BOTTOM = MARGIN + FOOTER_HEIGHT;
  const BOOK_SECTIONS = [
    { key: "compulsory-1", label: "Compulsory Book 1", code: "C1", color: [0.16, 0.36, 0.69] },
    { key: "compulsory-2", label: "Compulsory Book 2", code: "C2", color: [0.12, 0.47, 0.55] },
    { key: "compulsory-3", label: "Compulsory Book 3", code: "C3", color: [0.16, 0.50, 0.34] },
    { key: "compulsory-4", label: "Compulsory Book 4", code: "C4", color: [0.55, 0.40, 0.15] },
    { key: "compulsory-5", label: "Compulsory Book 5", code: "C5", color: [0.60, 0.28, 0.20] },
    { key: "elective-1", label: "Elective Book 1", code: "E1", color: [0.42, 0.27, 0.65] },
    { key: "elective-2", label: "Elective Book 2", code: "E2", color: [0.55, 0.23, 0.48] },
    { key: "elective-3", label: "Elective Book 3", code: "E3", color: [0.65, 0.27, 0.35] },
    { key: "elective-4", label: "Elective Book 4", code: "E4", color: [0.27, 0.42, 0.58] },
  ];
  const ENTRY_OVERRIDES = {
    "2024|paper-1b|9": {
      bookKey: "compulsory-4",
      chapterEn: "Electrostatics",
      chapterZh: "靜電學",
    },
  };

  function fitDimensions(width, height, maxWidth, maxHeight) {
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    return { width: width * scale, height: height * scale };
  }

  function safeAscii(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function createMistakeBookPdf(options) {
    const pdfLib = options.pdfLib || global.PDFLib;
    if (!pdfLib?.PDFDocument || !pdfLib?.StandardFonts || !pdfLib?.rgb) {
      throw new Error("PDF engine is unavailable.");
    }
    if (!Array.isArray(options.entries) || options.entries.length === 0) {
      throw new Error("No mistake-book entries were supplied.");
    }
    if (typeof options.loadImageBytes !== "function") {
      throw new Error("An image loader is required.");
    }

    const { PDFDocument, StandardFonts, rgb } = pdfLib;
    const document = await PDFDocument.create();
    const regularFont = await document.embedFont(StandardFonts.Helvetica);
    const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
    const imageCache = new Map();
    const prepared = [];
    const totalImages = options.entries.reduce((sum, entry) => sum + entry.images.length, 0);
    let loadedImages = 0;

    document.setTitle("DSE Physics Mistake Book");
    document.setSubject("Marked DSE Physics questions arranged by textbook book order");
    document.setAuthor("DSE Physics Study Library");
    document.setCreator("DSE Physics Study Library");
    document.setProducer("DSE Physics Study Library");
    document.setCreationDate(new Date());

    async function embeddedImage(source) {
      if (!imageCache.has(source)) {
        imageCache.set(source, (async () => {
          const bytes = await options.loadImageBytes(source);
          return document.embedJpg(bytes);
        })());
      }
      const image = await imageCache.get(source);
      loadedImages += 1;
      options.onProgress?.({ current: loadedImages, total: totalImages });
      return image;
    }

    for (const entry of options.entries) {
      const images = [];
      for (const source of entry.images) images.push(await embeddedImage(source));
      prepared.push({ ...entry, embeddedImages: images });
    }

    let page = null;
    let cursorY = 0;
    let activeSection = null;
    const usableWidth = PAGE_WIDTH - MARGIN * 2;

    function sectionColor(section, amount = 1) {
      const color = section.color.map((channel) => Math.min(1, channel * amount));
      return rgb(color[0], color[1], color[2]);
    }

    function addPage(section, continued = false) {
      page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      activeSection = section;
      const bannerHeight = continued ? 28 : 46;
      const bannerY = PAGE_HEIGHT - MARGIN - bannerHeight;
      page.drawRectangle({
        x: MARGIN,
        y: bannerY,
        width: usableWidth,
        height: bannerHeight,
        color: continued ? sectionColor(section, 1.35) : sectionColor(section),
      });
      page.drawText(continued ? `${section.code}  ${section.label} - continued` : `${section.code}  ${section.label}`, {
        x: MARGIN + 13,
        y: bannerY + (continued ? 9 : 15),
        size: continued ? 10 : 16,
        font: boldFont,
        color: rgb(1, 1, 1),
      });
      cursorY = bannerY - 14;
      return page;
    }

    function drawQuestionHeading(entry, continued = false) {
      const title = safeAscii(entry.title) || "Marked question";
      const chapter = safeAscii(entry.chapterEn);
      page.drawText(continued ? `${title} - continued` : title, {
        x: MARGIN + 2,
        y: cursorY - 13,
        size: 11.5,
        font: boldFont,
        color: rgb(0.08, 0.12, 0.19),
      });
      if (!continued && chapter) {
        page.drawText(chapter.slice(0, 86), {
          x: MARGIN + 2,
          y: cursorY - 27,
          size: 7.5,
          font: regularFont,
          color: rgb(0.36, 0.41, 0.49),
        });
        cursorY -= 35;
      } else {
        cursorY -= 22;
      }
    }

    for (const section of BOOK_SECTIONS) {
      const sectionEntries = prepared.filter((entry) => entry.bookKey === section.key);
      if (!sectionEntries.length) continue;
      addPage(section, false);

      for (const entry of sectionEntries) {
        let headingDrawn = false;
        for (let imageIndex = 0; imageIndex < entry.embeddedImages.length; imageIndex += 1) {
          const image = entry.embeddedImages[imageIndex];
          const headingHeight = headingDrawn ? 0 : 36;
          const preferredDimensions = fitDimensions(image.width, image.height, usableWidth - 4, Number.MAX_SAFE_INTEGER);
          const requiredHeight = headingHeight + preferredDimensions.height + 16;
          if (cursorY - requiredHeight < CONTENT_BOTTOM) {
            addPage(section, true);
            headingDrawn = false;
          }
          if (!headingDrawn) {
            drawQuestionHeading(entry, imageIndex > 0);
            headingDrawn = true;
          }

          const availableImageHeight = Math.max(1, cursorY - CONTENT_BOTTOM - 8);
          const dimensions = fitDimensions(image.width, image.height, usableWidth - 4, availableImageHeight);
          const imageX = MARGIN + (usableWidth - dimensions.width) / 2;
          const imageY = cursorY - dimensions.height;
          page.drawImage(image, {
            x: imageX,
            y: imageY,
            width: dimensions.width,
            height: dimensions.height,
          });
          cursorY = imageY - 10;
        }

        page.drawLine({
          start: { x: MARGIN + 2, y: cursorY },
          end: { x: PAGE_WIDTH - MARGIN - 2, y: cursorY },
          thickness: 0.6,
          color: rgb(0.84, 0.86, 0.89),
        });
        cursorY -= 14;
      }
    }

    const pages = document.getPages();
    pages.forEach((pdfPage, index) => {
      pdfPage.drawText("DSE Physics Mistake Book", {
        x: MARGIN,
        y: 26,
        size: 7,
        font: regularFont,
        color: rgb(0.43, 0.47, 0.53),
      });
      const pageNumber = `${index + 1} / ${pages.length}`;
      pdfPage.drawText(pageNumber, {
        x: PAGE_WIDTH - MARGIN - regularFont.widthOfTextAtSize(pageNumber, 7),
        y: 26,
        size: 7,
        font: regularFont,
        color: rgb(0.43, 0.47, 0.53),
      });
    });

    return document.save({ useObjectStreams: false });
  }

  global.DSE_MISTAKE_PDF = {
    BOOK_SECTIONS,
    ENTRY_OVERRIDES,
    createMistakeBookPdf,
  };
})(typeof window !== "undefined" ? window : globalThis);
