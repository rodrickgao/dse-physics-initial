# Local textbook exercise import

The exercise library uses the 46 English and 46 Chinese Word chapters in the user's `dse物理真题全解` folder. Each language contains 979 question records. Original chapter/question numbers and bilingual answer differences are preserved. Books 3A and 3B appear together as compulsory Book 3, giving nine books overall.

Run from the website root with Python (lxml, Pillow and reportlab installed):

```powershell
python scripts/import-textbook-exercises.py --source 'C:/Users/rodri/Desktop/dse物理真题全解'
python scripts/review-textbook-exercise-links.py
python scripts/index-textbook-exercises.py
node --test tests/textbook-exercises.test.mjs tests/study-state.test.mjs
npm run build
```

The importer preserves question text, source answers, tables, figures, superscripts/subscripts and Word equations. Legacy Symbol glyphs are translated to Unicode and WMF/EMF images to PNG. Source hashes and source block positions are recorded in each question; `textbook-exercise-sources.json` records chapter totals.

The browser hierarchy is book → chapter review exercises → question. Entering a chapter opens its first question. The desktop workspace has the current chapter’s question-number navigation on the left and the reader on the right; on mobile the directory is collapsible. Question buttons and previous/next navigation follow original numeric question order. Knowledge-topic groupings remain internal index metadata and are not a navigation level. Each exercise has one primary topic and may link to additional knowledge points from the same book. Explicit corrections live in `review-textbook-exercise-links.py`; remaining links use chapter-local textual matching. The audit JSON identifies which method supplied each association, so further subject review can focus on automatic matches. This does not change past-paper links or question frequency statistics.

Generated browser data and media live under `assets/textbook-exercises`. This directory must accompany any future explicitly authorized release. Source Word documents, local browser sessions and audit scripts are not required by the student website.

Local browser QA: `node scripts/qa-textbook-exercises.mjs`, using the existing isolated preview at port 5178 and an authenticated test session in `../tmp/exercise-qa-session.json`. No production publication is performed by these steps.


Exercise progress uses the existing account API and stable `tb-...` keys: individual mastery, reversible whole-chapter mastery, mistakes and recycle-bin history. Mixed mistakes and both print modes share a comparator: choice questions first, then structured questions; within each kind, earliest linked textbook chapter followed by ascending collection timestamp. The API supplies the chapter code so this order also works without premium knowledge links. Restoring from trash retains the original collection timestamp.

`node --test tests/exercise-progress.test.mjs` checks account isolation, persistence, bulk updates, sorting and textbook export. `node scripts/qa-exercise-progress.mjs` expects an isolated preview at port 5182 backed by `.local-exercise-qa`; it modifies only that local test database. The regular user preview remains at port 5178.
