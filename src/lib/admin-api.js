import { Converter } from 'opencc-js/t2cn';
import { api } from './api';

const simplified = Converter({ from: 'hk', to: 'cn' });
export async function adminApi(...args) {
  try { return await api(...args); }
  catch (error) {
    error.message = simplified(error.message).replaceAll('电邮', '邮箱').replaceAll('登入', '登录').replaceAll('储存', '保存');
    throw error;
  }
}
