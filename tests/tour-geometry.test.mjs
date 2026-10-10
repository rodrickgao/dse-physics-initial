import test from 'node:test';
import assert from 'node:assert/strict';
import { spotlightGeometry, roundedSpotlightPath } from '../src/lib/tour-geometry.js';

test('spotlight follows the real rounded button with equal padding', () => {
  const shape = spotlightGeometry({ left:100, top:120, right:144, bottom:164 }, { width:390, height:844 }, { radius:12, pixelRatio:2 });
  assert.deepEqual(shape, { left:95, top:115, right:149, bottom:169, radius:17 });
  const path = roundedSpotlightPath(shape);
  assert.equal((path.match(/ A/g) || []).length, 4);
  assert.ok(path.startsWith('M112 115 H132 A17 17'));
  assert.ok(path.endsWith('A17 17 0 0 1 112 115 Z'));
});

test('all spotlight edges align to physical pixels at desktop and Retina scales', () => {
  for (const pixelRatio of [1, 1.25, 2, 3]) {
    const shape = spotlightGeometry({ left:100.13, top:87.78, right:144.13, bottom:131.78 }, { width:1194, height:724 }, { radius:12, pixelRatio });
    for (const value of Object.values(shape)) assert.ok(Math.abs(value*pixelRatio-Math.round(value*pixelRatio)) < 1e-8);
  }
});

test('partly clipped targets remain within the viewport and keep valid corners', () => {
  const shape = spotlightGeometry({ left:-20, top:690, right:32, bottom:750 }, { width:1180, height:724 }, { radius:50, pixelRatio:3 });
  assert.equal(shape.left,4);assert.equal(shape.bottom,720);
  assert.ok(shape.radius <= Math.min(shape.right-shape.left, shape.bottom-shape.top)/2);
  assert.ok(!roundedSpotlightPath(shape).includes('NaN'));
});

test('fully clipped targets cannot produce negative size or oversized radius', () => {
  const shape = spotlightGeometry({ left:500, top:900, right:544, bottom:944 }, { width:390, height:844 });
  assert.equal(shape.left,shape.right);assert.equal(shape.top,shape.bottom);assert.equal(shape.radius,0);
  assert.ok(!roundedSpotlightPath(shape).includes('A'));
});
