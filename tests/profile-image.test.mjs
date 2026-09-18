import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { validateProfile } from '../server/profile.mjs';
import { AVATARS } from '../src/lib/avatar-catalog.js';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('all 50 preset images exist, are distinct and use compact square WebP', async () => {
  const hashes = new Set();
  for (const avatar of AVATARS) {
    const bytes = await readFile(new URL(`../assets/avatars/${avatar.id}.webp`, import.meta.url));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'webp'); assert.equal(metadata.width, 384); assert.equal(metadata.height, 384);
    assert.ok(bytes.length < 100000, avatar.id);
    hashes.add(createHash('sha256').update(bytes).digest('hex'));
  }
  assert.equal(hashes.size, 50);
});

test('50 unique preset avatars and validated image uploads', async () => {
  assert.equal(AVATARS.length, 50); assert.equal(new Set(AVATARS.map(a => a.id)).size, 50);
  const profile = { nickname: '  牛頓同學  ', grade: '中五', target: '5', avatar: 'newton-wave' };
  const input = await sharp({ create: { width: 600, height: 300, channels: 3, background: '#cc9988' } }).jpeg().toBuffer();
  const result = await validateProfile({ ...profile, image: `data:image/jpeg;base64,${input.toString('base64')}` }, {});
  const metadata = await sharp(result.bytes).metadata();
  assert.equal(metadata.format, 'webp'); assert.equal(metadata.width, 384); assert.equal(metadata.height, 384);
  assert.equal(metadata.exif, undefined); assert.equal(result.nickname, '牛頓同學');
  await assert.rejects(validateProfile({ ...profile, image: 'data:image/png;base64,aGVsbG8=' }, {}), { status: 400 });
  await assert.rejects(validateProfile({ ...profile, image: 'data:image/png;base64,' + 'a'.repeat(2800004) }, {}), { status: 400 });
  await assert.rejects(validateProfile({ ...profile, nickname: 'bad\u0000name' }, {}), { status: 400 });
});
