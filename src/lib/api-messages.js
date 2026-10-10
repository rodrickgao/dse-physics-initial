import { Converter } from 'opencc-js/t2cn';

const simplified = Converter({ from: 'hk', to: 'cn' });

export function simplifyApiMessage(value) {
  return simplified(value)
    .replaceAll('電郵', '邮箱').replaceAll('电邮', '邮箱')
    .replaceAll('登入', '登录')
    .replaceAll('儲存', '保存').replaceAll('储存', '保存');
}
