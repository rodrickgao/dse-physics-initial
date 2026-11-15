import { translate, getUiLanguage } from './ui-translations';
import { simplifyApiMessage as message } from './api-messages';
export async function api(path, body, method = 'POST') {
  let response;
  try { response = await fetch(`/api/${path}`, { credentials: 'same-origin', ...(body === undefined ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }); }
  catch { throw new Error(getUiLanguage()==='eng'?'Connection interrupted. Please try again.':'网络连接中断，请重试。'); }
  let data;
  try { data = await response.json(); } catch { throw Object.assign(new Error(getUiLanguage()==='eng'?'The service is temporarily unavailable. Please try again.':'服务暂时不可用，请稍后重试。'),{status:response.status}); }
  if (!response.ok) {
    let error = message(data.error || '操作失败，请重试。');
    if (getUiLanguage() === 'eng') {
      error = data.errorEn || translate(error);
      if (/[\u3400-\u9fff]/.test(error)) error = ({401:'Please sign in again.',403:'You do not have access to this action.',404:'The requested item was not found.',409:'This item has changed. Refresh and try again.',429:'Too many requests. Please try again later.'})[response.status] || (response.status >= 500 ? 'The service is temporarily unavailable. Please try again.' : 'Please check your input and try again.');
    }
    throw Object.assign(new Error(error), { status: response.status });
  }
  if (typeof data.message === 'string') data.message = getUiLanguage() === "eng" ? (data.messageEn || translate(message(data.message))) : message(data.message);
  return data;
}
