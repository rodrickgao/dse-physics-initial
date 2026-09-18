import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createKnowledgeGrouper, knowledgeBodyKey} from '../src/lib/knowledge-groups.js';

const context = {window: {}};
vm.runInNewContext(fs.readFileSync('textbook-data.js', 'utf8'), context);
const languages = JSON.parse(JSON.stringify(context.window.DSE_TEXTBOOK_DATA.languages));
const group = createKnowledgeGrouper(languages);
const reviewedPairs = [[18,80],[55,56],[69,70],[77,86],[78,87],[85,88],[104,106],[162,166],[164,167],[173,174],[212,213],[250,263],[284,288],[287,289],[324,330]];

test('both languages render each of the 15 identical bodies once without losing identities', () => {
  for (const points of Object.values(languages)) {
    const cards = group(points);
    assert.equal(cards.length, 350);
    assert.equal(new Set(cards.map(knowledgeBodyKey)).size, cards.length);
    assert.deepEqual(cards.filter(card => card.members.length > 1).map(card => card.members.map(p => p.sequence)), reviewedPairs);
    assert.deepEqual(cards.flatMap(card => card.members.map(p => p.sequence)).sort((a,b) => a-b), points.map(p => p.sequence));
    for (const card of cards) {
      assert.equal(new Set(card.figures.map(f => f.src)).size, card.figures.length);
      for (const member of card.members) {
        assert.equal(knowledgeBodyKey(member), knowledgeBodyKey(card));
        assert.deepEqual(member, points.find(point => point.sequence === member.sequence));
      }
    }
  }
});

test('book and chapter filters never import points outside the selected scope', () => {
  for (const points of Object.values(languages)) for (const field of ['book_key', 'code']) {
    for (const value of new Set(points.map(point => point[field]))) {
      const selected = points.filter(point => point[field] === value);
      const cards = group(selected);
      assert.equal(new Set(cards.map(knowledgeBodyKey)).size, cards.length);
      assert.equal(cards.flatMap(card => card.members).length, selected.length);
      assert.ok(cards.every(card => card.members.every(member => member[field] === value)));
    }
  }
});

test('formula case, assumptions, and differences in either language prevent a false merge', () => {
  const points = [
    {sequence: 1, formula_latex: ['F=ma'], formula_notes: 'Constant mass'},
    {sequence: 2, formula_latex: ['f=ma'], formula_notes: 'Constant mass'},
    {sequence: 3, formula_latex: ['F=ma'], formula_notes: 'Variable mass'},
    {sequence: 4, formula_latex: ['F=ma'], formula_notes: 'Constant mass'},
  ];
  const translated = points.map(point => ({...point}));
  translated[3].formula_notes = 'Different translated condition';
  assert.equal(createKnowledgeGrouper({eng: points, chn: translated})(points).length, 4);
});
