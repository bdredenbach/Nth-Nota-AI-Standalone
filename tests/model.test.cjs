'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../app/src/main/assets/model.js');

test('only completed, verifiable exchanges enter cloud context, within the Worker limits', () => {
  const turns = Array.from({length:18}, (_,i) => ({question:'Question '+i,reply:'x'.repeat(1800),status:'ok'}));
  turns.push({question:'unsent',reply:'should not enter the prompt',status:'error'});
  turns.push({question:'unverified',reply:'should not enter the prompt',status:'ok',unavailable:true});
  const messages = model.context(turns);
  assert.equal(messages.length % 2, 0);
  assert.ok(messages.length > 0 && messages.length <= 12);
  assert.ok(messages.reduce((n,m) => n+m.content.length,0) <= 9000);
  assert.equal(messages[messages.length-2].content, 'Question 17');
  assert.ok(messages.every((m,i)=>m.role===(i%2?'assistant':'user') && !m.content.includes('should not enter')));
});

test('a selected passage uses the writing endpoint and stays out of future chat history', () => {
  const turn = {question:'Summarize',attachment:'Original passage',reply:'Short summary',mode:'auto',status:'ok'};
  assert.ok(model.request(turn,[]).prompt.includes('Original passage'));
  assert.equal(model.request(turn,[]).route,'write');
  assert.ok(!JSON.stringify(model.context([turn])).includes('Original passage'));
});

test('a saved checklist keeps child items and existing completion marks', () => {
  assert.deepEqual(model.checklist('1. **Supplies**\n  - Notebook\n  - [x] Pencil'), [
    {text:'Notebook',done:false},{text:'Pencil',done:true}
  ]);
});

test('only unique HTTPS source URLs can be opened and reply markup stays inert', () => {
  const links = model.sources([{url:'https://example.org/page'},{url:'https://example.org/page'},{url:'javascript:alert(1)'},{url:'https://user@example.org/private'}]);
  assert.deepEqual(links,[{url:'https://example.org/page',title:'example.org'}]);
  const html = model.markdown('**Important**\n<img src=x onerror=alert(1)>\n```\n<script>test()</script>\n```');
  assert.ok(html.includes('<strong>Important</strong>'));
  assert.ok(!html.includes('<img') && !html.includes('<script>'));
});

test('spoken replies omit Markdown punctuation while preserving words and code content', () => {
  assert.equal(model.forSpeech('## Packing\n- **Pencil** and `HB`\n[Paper](https://example.org)'), 'Packing\nPencil and HB\nPaper');
});
