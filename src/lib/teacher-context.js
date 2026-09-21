// Resolve the content being read before navigating away to the teacher page.
export function currentTeacherContext(page, root = document) {
  if (page === 'papers') {
    const reference = root.querySelector('[data-study-question]')?.dataset.studyQuestion;
    if (reference) return { kind: 'question', reference };
  }
  if (page === 'textbook') {
    const viewportHeight = root.defaultView?.innerHeight || 800;
    const top = Math.max(0, root.querySelector('.topbar')?.getBoundingClientRect().bottom || 0);
    const readingLine = Math.min(top + 80, viewportHeight * 0.4);
    const nearest = elements => [...elements].map(element => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0 && rect.bottom > top && rect.top < viewportHeight)
      .sort((a, b) => {
        const distance = r => r.top <= readingLine && r.bottom >= readingLine ? 0 : Math.min(Math.abs(r.top - readingLine), Math.abs(r.bottom - readingLine));
        return distance(a.rect) - distance(b.rect);
      })[0]?.element;
    const card = nearest(root.querySelectorAll('[data-study-knowledge-card]'));
    if (card) {
      const section = nearest(card.querySelectorAll('[data-study-knowledge]'));
      return { kind: 'knowledge', reference: section?.dataset.studyKnowledge || card.dataset.studyKnowledgeCard };
    }
  }
  return { kind: 'general', reference: '' };
}
