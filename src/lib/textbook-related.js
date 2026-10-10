// Keep the API's bounded pages while presenting one complete list per card.
export async function loadAllRelatedQuestions({ language, points, signal, fetcher = fetch }) {
  const results = [];
  let offset = 0;
  while (true) {
    signal?.throwIfAborted();
    const query = new URLSearchParams({ language, points, offset, limit: 50 });
    const response = await fetcher(`/api/content/related?${query}`, { cache: 'no-store', signal });
    if (!response.ok) throw new Error('Related questions unavailable');
    const page = await response.json();
    if (!Array.isArray(page.results) || (page.hasMore && !page.results.length)) {
      throw new Error('Invalid related-question page');
    }
    results.push(...page.results);
    if (!page.hasMore) return { results };
    offset += page.results.length;
  }
}
