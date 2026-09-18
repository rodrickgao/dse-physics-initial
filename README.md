# DSE Physics Past Papers

## Local accounts and developer dashboard — 2026-09-16

Run `npm run dev` with Node.js 24, then open http://127.0.0.1:5173.
Email-code registration, 30-day login sessions, per-student SQLite mistake storage,
and developer statistics are now available locally. No deployment was performed.
See [LOCAL-BACKEND.md](LOCAL-BACKEND.md) for developer access, SMTP setup, backup
and validation. Without SMTP credentials, codes are previewed locally and no email is sent.

Source repository for the DSE Physics past-paper study website.

## Current workspace release — 2026-09-15

All 2012–2025 bilingual editions are included: 1,116 question identities and
2,232 complete question/answer/reasoning records. Knowledge cards use
book.chapter.point numbering (1.1.1 and E1.1.1), matching the bilingual Word
documents. Stable internal IDs preserve saved questions and knowledge links.
The knowledge view lists all 365 cards independently without category labels.

The paper download library now contains 78 original exam PDFs: Chinese 2012–2024,
English 2012–2023 and 2025. The provided source folder has no 2024 English papers.
2025 Chinese originals and all 2026 papers are excluded. Knowledge PDF downloads are disabled.
The five papers extracted from combined source PDFs preserve only verified question
page ranges (2024 Chinese: 6–21, 22–40, 41–57; 2025 English P1: 1–16, 17–36).
The 2024 marking scheme beginning at source page 58 is excluded.

Full worked-paper PDFs have been removed from public downloads and archived under
ignored, HTTP-blocked `.local/retired-worked-papers`. Old download URLs return 404.
Builds copy only catalog-approved files. Re-sync originals with
`scripts/sync-original-papers.py SOURCE_FOLDER`; `sync-study-folder.py` now updates
only knowledge numbering and preserves the original-paper catalog. Source PDF hashes,
extraction ranges and output hashes are recorded in `downloads/catalog.json`.
Run `node scripts/qa-document-sync.mjs` against the local backend to verify bilingual
navigation, missing-language notices, PDF response hashes and all retired URLs.

## Previous framework release — 2026-09-14

The main practice directory and random-question entry prioritize 2015–2025
(871 questions / 1,742 language editions). The 2012–2014 archive remains
accessible, with unfinished work explicitly paused; no draft solutions from
those years are included in this interface-only release.

- Mobile question directory collapses so the question is visible first.
- The three-stage progress strip keeps question, official answer and teaching
  reasoning distinct; moving to another question resets the reveal state.
- The current question is retained across reloads, back navigation and visits
  to the knowledge or mistake views. Question links can be copied from the URL.
- Search prioritizes recent years and reports displayed / total matches.
- Select individual saved questions for either PDF edition. Print order is
  year (newest first), paper, then question number. Practice writing space stays
  adjustable; the existing white / Times New Roman / SimSun / red / blue print
  template is unchanged.
- Chapter counts count each saved question once per chapter, not once per
  associated knowledge point. They are review indicators, not measured grades.

`node scripts/framework-qa.mjs` checks navigation, reload/back state, keyboard
search, sequential answers, mobile controls, selected PDF contents and fetch
recovery. It also checks all 1,742 current-priority editions at two reading
widths, including 1,811 image occurrences. This is a layout / data-structure
audit, not a new physics re-mark of every answer. QA reports and screenshots
are written outside the repo in `../tmp/framework-qa`.

The interface is built with React, Vite and a local shadcn-style component layer. The original question scans and textbook datasets remain static and are packaged into the production build.

## Text study editions and printing

Questions open first, followed by a separate reveal for the official answer and
then the teaching explanation. Switching questions or languages closes answers.
The mistake book has practice and worked-solution print editions. Print preview
supports Save as PDF, white backgrounds, Times New Roman / SimSun, red official
text and blue reasoning. Original scan excerpts retain their original colours.
Practice editions offer 30–120 mm working space and start each new question on
a new page. Disable browser headers/footers in the print dialog.

Content coverage is recorded in `text-papers/coverage.json` and `release.json`. The 2015–2025
editions are imported from the existing verified English and Traditional Chinese
Word documents, preserving their diagrams, sub/superscripts and source hashes.
This is a transfer of previously verified material, not a fresh independent
verification of every solution. Structured official schemes remain authoritative
scan excerpts where Word has no native text. The 2012–2014 editions use only
manually verified bank text; other transcription and detailed reasoning remain
explicitly pending with original scans available. They are not silently replaced
with unchecked OCR or generic explanations.

All 36 questions in 2012 Paper 1A now have separately reviewed English and
Traditional Chinese text and worked solutions, checked against both original
scans and the retained official answer key. Each of the 72 printed question
pages has been visually inspected. The remaining 2012 papers and 2013–2014
solutions are still pending; the release metadata reports those gaps honestly.

The canonical local SQLite bank is the single source of question content and
knowledge links. The 2025 Chinese study edition is a translation of the English
paper and marking reference, not an official Chinese original; this disclosure
also appears in print. The release contains 1,116 question identities and 2,232
bilingual record slots. Exact native-text and explanation completion counts are
generated in `text-papers/release.json`; outstanding entries are explicitly pending.

`npm test` checks print-mode separation, formatting, assets, question identities,
withdrawn questions and MC answer consistency. In the parent workspace, rebuild
with `tools/update_expert_database.py`, then `tools/export_expert_database.py`,
`tools/export_website_database.py` and `tools/build_site_statistics.py`.
Run `tools/validate_expert_database.py` before publication. Original scan inventory
and mapping snapshots are immutable inputs, not generated website files. Browser
QA: `node scripts/browser-study-qa.mjs --pdf` with local Chrome and Vite running;
it writes only QA outputs outside the repository. GitHub builds use committed
static exports and do not require the private source folders.

## Open the website

**[Open the public DSE Physics Study Library](https://rodrickgao.github.io/dse-physics-past-papers/)**

The GitHub Pages website is public and does not require an invite code.

## Publishing flow

Every push to `main` automatically builds and publishes the current website to
GitHub Pages. The existing `部署到GitHub和Cloudflare.cmd` helper can still be
used when the private Cloudflare copy also needs to be updated.

## Security

The GitHub Pages copy contains only static website files. The Cloudflare invite
code and session-signing key remain encrypted Cloudflare secrets and are never
committed to this repository.
