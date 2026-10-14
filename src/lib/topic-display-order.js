const bookOrder = new Intl.Collator('en', { numeric: true });

export function topicsInBookOrder(points) {
  return [...points].sort((a, b) => bookOrder.compare(a.number || '', b.number || '')
    || bookOrder.compare(a.knowledge_id, b.knowledge_id));
}
