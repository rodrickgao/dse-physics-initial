import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
const options = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export async function encodePassword(password, confirmation) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw Object.assign(new Error('密碼須為 8–128 個字元。'), { status: 400 });
  if (password !== confirmation) throw Object.assign(new Error('兩次輸入的密碼不一致。'), { status: 400 });
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, options);
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function checkPassword(password, stored) {
  const valid = typeof password === 'string' && password.length >= 8 && password.length <= 128;
  const [, salt, digest] = (stored || '').split(':');
  const key = await derive(valid ? password : '', salt || '00000000000000000000000000000000', 64, options);
  return Boolean(valid && digest && timingSafeEqual(key, Buffer.from(digest, 'hex')));
}
