import { ArrowRight } from 'lucide-react';
import { BOOK_COLORS } from '../lib/book-colors';
import { useRef } from 'react';
import { useContentMotion } from '../lib/use-content-motion';

export function MistakeStatistics({ books, bookKey, onBookChange, unclassified, language, onSelect }) {
  const en = language === 'eng';
  const book = books.find(row => row.key === bookKey);
  const rows = bookKey === 'all' ? [...books.flatMap(row => row.chapters), unclassified] : bookKey === 'unclassified' ? [unclassified] : book?.chapters || [];
  const chapters = rows.filter(row => row.keys.length > 0).sort((a, b) => b.keys.length - a.keys.length);
  const total = chapters.reduce((sum, row) => sum + row.keys.length, 0);
  const contentRef = useRef(null);
  useContentMotion(contentRef, `${language}:${bookKey}`);
  return <div ref={contentRef} className="mistake-book-statistics" style={{ '--book-tone': BOOK_COLORS[book?.key] || 'var(--border)' }}>
    <label className="statistics-book-selector" htmlFor="statistics-book">{en ? 'Book' : '书册'}<select id="statistics-book" value={bookKey} onChange={event => onBookChange(event.target.value)}><option value="all">{en ? 'All' : '全部'}</option>{books.map(row => <option key={row.key} value={row.key}>{row.name}</option>)}{!!unclassified.keys.length && <option value="unclassified">{unclassified.name}</option>}</select></label>
    <div className="statistics-chapter-heading"><span>{en ? 'Chapter' : '章节'}</span><span>{en ? 'Mistakes' : '错题数'}</span></div>
    {chapters.length ? <ul className="statistics-chapter-list">{chapters.map(row => <li key={row.code} data-chapter={row.code}>
      <button type="button" onClick={() => onSelect(row)}><span><small>{row.code}</small>{row.name}</span><strong>{row.keys.length}</strong><ArrowRight aria-hidden="true"/></button>
    </li>)}</ul> : <p className="statistics-book-empty">{en ? 'No mistakes in this book.' : '本册暂无错题'}</p>}
    {!!chapters.length && <div className="statistics-book-total"><span>{en ? 'Total' : '合计'}</span><strong>{total}</strong></div>}
  </div>;
}
