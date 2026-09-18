import { Converter } from 'opencc-js/t2cn';
const simplified = Converter({ from: 'hk', to: 'cn' });
const message = value => simplified(value).replaceAll('電郵', '邮箱').replaceAll('电邮', '邮箱').replaceAll('登入', '登录').replaceAll('儲存', '保存').replaceAll('储存', '保存');
export async function api(path, body, method = 'POST') {
  const response = await fetch(`/api/${path}`, { credentials: 'same-origin', ...(body === undefined ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  let data;
  try { data = await response.json(); } catch { throw new Error('本地后端未启动，请使用“启动本地网站”打开。'); }
  if (!response.ok) throw Object.assign(new Error(message(data.error || '操作失败，请重试。')), { status: response.status });
  if (typeof data.message === 'string') data.message = message(data.message);
  return data;
}
