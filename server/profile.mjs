import sharp from 'sharp';
import { AVATAR_IDS, GRADES, TARGETS } from '../src/lib/avatar-catalog.js';

const invalid = message => { throw Object.assign(new Error(message), { status: 400 }); };
export function publicProfile(row) {
  return { id: row.id, email: row.email, role: row.role, hasPassword: Boolean(row.password_hash), nickname: row.nickname || '', grade: row.grade || '', target: row.target || '', targetMajor: row.target_major || '',
    avatar: row.avatar || '', avatarUrl: row.avatar === 'upload' ? `/api/avatar/${row.id}?v=${row.avatar_version || ''}` : AVATAR_IDS.has(row.avatar) ? `/assets/avatars/${row.avatar}.webp` : '',
    profileComplete: row.role === 'admin' || Boolean(row.nickname && GRADES.includes(row.grade) && TARGETS.includes(row.target) && (AVATAR_IDS.has(row.avatar) || row.avatar === 'upload')) };
}
export async function validateProfile(body, current) {
  if (typeof body.nickname !== 'string') invalid('請輸入暱稱。');
  const nickname = body.nickname.trim().normalize('NFC');
  if ([...nickname].length < 1 || [...nickname].length > 24 || /[\p{Cc}\p{Cf}]/u.test(nickname)) invalid('暱稱須為 1–24 個字，不能包含控制字元。');
  if (!GRADES.includes(body.grade)) invalid('請選擇中四、中五或中六。');
  if (!TARGETS.includes(body.target)) invalid('請選擇目標等級 5、5* 或 5**。');
  const rawMajor = body.targetMajor === undefined ? (current.target_major || '') : body.targetMajor;
  if (typeof rawMajor !== 'string') invalid('請輸入目標專業。');
  const targetMajor = rawMajor.trim().normalize('NFC');
  if (targetMajor.length > 100 || /[\p{Cc}\p{Cf}]/u.test(targetMajor)) invalid('目標專業最多 100 個字元，不能包含控制字元。');
  let avatar = body.avatar, bytes = null;
  if (typeof body.image === 'string' && body.image) {
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.image);
    if (!match || match[2].length > 2800000) invalid('請上傳不超過 2 MB 的 PNG、JPG 或 WebP 圖片。');
    try {
      const input = Buffer.from(match[2], 'base64');
      if (input.length > 2 * 1024 * 1024) invalid('圖片不能超過 2 MB。');
      const processor = sharp(input, { limitInputPixels: 16000000, failOn: 'warning' });
      const metadata = await processor.metadata();
      if (!['png', 'jpeg', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) invalid('請選擇靜態 PNG、JPG 或 WebP 圖片。');
      bytes = await processor.rotate().resize(384, 384, { fit: 'cover', position: 'centre' }).webp({ quality: 85 }).toBuffer();
      avatar = 'upload';
    } catch (error) { if (error.status) throw error; invalid('無法讀取這張圖片，請換一張再試。'); }
  } else if (avatar === 'upload') {
    if (current.avatar !== 'upload' || !current.avatar_data) invalid('請先上傳头像。');
    bytes = current.avatar_data;
  } else if (!AVATAR_IDS.has(avatar)) invalid('請選擇一個頭像。');
  return { nickname, targetMajor, grade: body.grade, target: body.target, avatar, bytes };
}
