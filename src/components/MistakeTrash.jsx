import { getUiLanguage } from '../lib/ui-translations';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { questionLabelFromKey } from '../lib/data';
import { useDialogFocus } from '../lib/use-dialog-focus';
import { Button } from './ui/button';

export function MistakeTrash({ onAction, openPaper }) {
  const [rows,setRows]=useState([]), [selected,setSelected]=useState(new Set());
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [loading,setLoading]=useState(true), [confirm,setConfirm]=useState(null);
  const dialogRef = useRef(null);
  const closeDialog = useCallback(() => setConfirm(null), []);
  useDialogFocus(dialogRef, Boolean(confirm), closeDialog, busy);
  async function load() {
    setLoading(true);
    try { const result=await api('mistakes/trash');setRows(result.trash);setSelected(new Set());setError(''); }
    catch(e){setError(e.message);}finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  async function act(action,keys) {
    setBusy(true);setError('');
    try { if(await onAction(action,keys)){setConfirm(null);await load();}else setError('操作失败，请重试。'); }
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <section data-tour="mistake-trash" data-ready={!loading&&!error} data-error={Boolean(error)} className="mistake-trash" aria-label="错题回收站">
    <div className="selection-toolbar"><label><input type="checkbox" disabled={busy||!rows.length} checked={!!rows.length&&selected.size===rows.length} onChange={e=>setSelected(e.target.checked?new Set(rows.map(r=>r.key)):new Set())}/>全选</label><Button variant="outline" disabled={busy||!selected.size} onClick={()=>act('restore',[...selected])}>恢复所选</Button><Button variant="danger" disabled={busy||!selected.size} onClick={()=>setConfirm([...selected])}>彻底删除所选</Button></div>
    {error&&<p role="alert" className="account-error">{error}<Button variant="ghost" onClick={load}>刷新</Button></p>}
    {loading?<p role="status">加载中…</p>:!rows.length?<div className="mistake-empty"><h2>回收站为空</h2></div>:<div className="mistake-list">{rows.map(row=><div className="mistake-row" key={row.key}><input type="checkbox" aria-label={`选择 ${questionLabelFromKey(row.key)}`} disabled={busy} checked={selected.has(row.key)} onChange={()=>setSelected(current=>{const next=new Set(current);next.has(row.key)?next.delete(row.key):next.add(row.key);return next;})}/><div className="mistake-row-copy"><strong>{questionLabelFromKey(row.key)}</strong><small>移入时间：{new Date(row.trashedAt).toLocaleString(getUiLanguage() === 'eng' ? 'en-HK' : 'zh-CN')}</small></div><div className="mistake-row-actions"><Button variant="outline" onClick={()=>openPaper(row.key)}>查看</Button><Button disabled={busy} onClick={()=>act('restore',[row.key])}>恢复</Button><Button variant="danger" disabled={busy} onClick={()=>setConfirm([row.key])}>彻底删除</Button></div></div>)}</div>}
    {confirm&&<div className="trash-confirm-backdrop"><section ref={dialogRef} tabIndex={-1} className="trash-confirm" role="dialog" aria-modal="true" aria-labelledby="trash-confirm-title"><h2 id="trash-confirm-title">彻底删除 {confirm.length} 道错题？</h2><p>删除后无法从回收站恢复。后台仍保留学习记录。</p><div className="selection-toolbar"><Button variant="outline" disabled={busy} onClick={()=>setConfirm(null)}>取消</Button><Button variant="danger" disabled={busy} onClick={()=>act('delete',confirm)}>{busy?'处理中…':'确认删除'}</Button></div></section></div>}
  </section>;
}
