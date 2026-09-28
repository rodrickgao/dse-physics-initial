import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';

export function MistakeStatistics({ open, onClose, chapters, language, onSelect }) {
  const dialog = useRef(null), en = language === 'eng';
  const total = chapters.reduce((sum, row) => sum + row.keys.length, 0);
  useEffect(() => {
    if (open && !dialog.current.open) dialog.current.showModal();
    if (!open && dialog.current.open) dialog.current.close();
  }, [open]);
  return <dialog ref={dialog} className="mistake-statistics" aria-labelledby="mistake-statistics-title" onClose={onClose} onClick={event => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.current.close();
  }}>
    <header><h2 id="mistake-statistics-title">{en ? 'Detailed chapter statistics' : '章节详细统计'}</h2><Button autoFocus variant="ghost" size="icon" aria-label={en ? 'Close statistics' : '关闭统计'} onClick={() => dialog.current.close()}><X/></Button></header>
    <p>{en ? `${total} questions to review · Each question counts in one main chapter.` : `共 ${total} 道待复习错题 · 每题只计入一个主要章节`}</p>
    <div className="statistics-table-wrap"><table><thead><tr>{(en ? ['Chapter', 'Questions', 'Share', 'MC', 'Structured', ''] : ['章节', '题数', '占比', '选择题', '大题', '']).map((name, index) => <th key={index} scope="col">{name}</th>)}</tr></thead><tbody>
      {chapters.map(row => <tr key={row.code}><th scope="row">{row.code !== 'unclassified' && <small>{row.code}</small>}{row.name}</th><td data-label={en ? 'Questions' : '题数'}>{row.keys.length}</td><td data-label={en ? 'Share' : '占比'}>{total ? (row.keys.length / total * 100).toFixed(1) : '0'}%</td><td data-label={en ? 'MC' : '选择题'}>{row.multipleChoice}</td><td data-label={en ? 'Structured' : '大题'}>{row.structured}</td><td><button onClick={() => { dialog.current.close(); onSelect(row); }}>{en ? 'View questions' : '查看错题'}</button></td></tr>)}
    </tbody><tfoot><tr><th scope="row">{en ? 'Total' : '合计'}</th><td data-label={en ? 'Questions' : '题数'}>{total}</td><td data-label={en ? 'Share' : '占比'}>{total ? '100%' : '0%'}</td><td data-label={en ? 'MC' : '选择题'}>{chapters.reduce((n,r)=>n+r.multipleChoice,0)}</td><td data-label={en ? 'Structured' : '大题'}>{chapters.reduce((n,r)=>n+r.structured,0)}</td><td/></tr></tfoot></table></div>
  </dialog>;
}
