import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const record = (year, key, language = 'eng') => JSON.parse(fs.readFileSync(`text-papers/${year}-${language}.json`, 'utf8'))[`${year}|${key}`];

test('reviewed diagram labels and physical directions agree with the source', () => {
  assert.match(record(2018, 'paper-1a|23').reasoning, /13\/5 = 2\.6/);
  assert.match(record(2019, 'paper-1a|13').reasoning, /Y starts lower/);
  assert.match(record(2019, 'paper-1a|16').reasoning, /six nodal lines/);
  assert.match(record(2021, 'paper-1b|7').reasoning, /force.*right/);
  assert.match(record(2021, 'paper-1a|18').question, /PQ and OS/);
  assert.match(record(2022, 'paper-2|1.4').reasoning, /radial velocity is zero/);
});

test('reviewed formulas preserve complete factors, exponents and source conditions', () => {
  assert.match(record(2017, 'paper-2|4.S').reasoning, /exp\[−\(μ<sub>1<\/sub>x<sub>1<\/sub>/);
  assert.match(record(2023, 'paper-2|2.6').reasoning, /2m<sub>e<\/sub>λ<sup>2<\/sup>/);
  assert.match(record(2024, 'paper-1b|2').reasoning, /2N<sub>A<\/sub>E<sub>k<\/sub>/);
  assert.match(record(2024, 'paper-2|1.S').reasoning, /GM<sub>E<\/sub>M<sub>M<\/sub>/);
  assert.match(record(2013, 'paper-2|2.4', 'chn').question, /第一受激態/);
  assert.doesNotMatch(record(2013, 'paper-2|2.4', 'chn').reasoning, /中文原卷只寫/);
  assert.match(record(2013, 'paper-1b|8', 'chn').reasoning, /\(d\).*放大鏡/);
  assert.match(record(2013, 'paper-2|3.6').reasoning, /ventilation or infiltration.*excluded/);
});

test('corrected numerical steps retain their source values', () => {
  assert.ok(Math.abs(60.5 * Math.log2(3500 / 200) - 249.82) < 0.01);
  assert.equal((12 + 14) / 2 / 5, 2.6);
  assert.ok(Math.abs(10 * Math.cos(Math.PI / 4) / Math.cos(Math.PI / 6) - 8.16) < 0.01);
  assert.equal(Math.floor((24 - 20) * 8900 / 222), 160);
  assert.ok(Math.abs((16749 - 16726 - 9) * 1e-31 * 9e16 / 1.6e-13 - 0.7875) < 1e-12);
});
