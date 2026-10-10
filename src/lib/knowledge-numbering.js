import { sharedFigureCards } from './shared-figure-cards.js';

// A displayed card has one chapter number. Source IDs remain stable for saved links.
export function numberKnowledgePoints(points) {
  const counts = new Map();
  const ordered = [...points].sort((a, b) => {
    if (!a.textbook_order || !b.textbook_order) return 0;
    const x = a.textbook_order, y = b.textbook_order;
    return x.chapter - y.chapter || x.page - y.page || x.y - y.y || a.sequence - b.sequence;
  });
  const numbers = new Map();
  for (const card of sharedFigureCards(ordered)) {
    const match = /^(E?)(\d)[AB]?(\d{2})$/.exec(card.code);
    if (!match) throw new Error(`Unknown chapter code: ${card.code}`);
    const key = `${card.book}|${card.code}`;
    const ordinal = (counts.get(key) || 0) + 1;
    counts.set(key, ordinal);
    for (const point of card.members || [card]) numbers.set(point.sequence, {
      number: `${match[1]}${match[2]}.${Number(match[3])}.${ordinal}`,
      card_sequence: card.sequence,
    });
  }
  return ordered.map(point => ({ ...point, ...numbers.get(point.sequence) }));
}
