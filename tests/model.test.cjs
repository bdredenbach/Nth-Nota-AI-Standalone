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

test('creative requests use the writing service with context while research remains in chat',()=>{
 const history=[{question:'Name my ferry.',reply:'Amber Comet',status:'ok'},{phone:true,question:'Where am I?',reply:'Private location',status:'ok'}];
 for(const question of ['Draft a two-sentence text.', 'Think of two names for a bookstore cat.', 'Translate this into Spanish.', 'Make a four-step checklist for packing.']){
  const req=model.request({mode:'auto',question},history);
  assert.equal(req.route,'write');assert.match(req.prompt,/Amber Comet/);assert.doesNotMatch(req.prompt,/Private location/);
 }
 for(const [mode,question] of [['search','Draft a list.'],['auto','Draft a report with official sources.'],['auto','What is a ferry?']])assert.equal(model.request({mode,question},history).route,'chat');
});

test('recent naming questions can use a previous reply without inventing history',()=>{
 const q={mode:'auto',question:'What did I call the ferry?'};
 assert.equal(model.request(q,[]).route,'write');
 const earlier=[{question:'I named it Amber Comet.',reply:'Amber Comet',status:'ok'}];
 const req=model.request(q,earlier);
 assert.equal(req.route,'write');assert.match(req.prompt,/Amber Comet/);assert.match(req.prompt,/neither source contains/);
 assert.equal(model.request({...q,mode:'search'},earlier).route,'chat');
});

test('self-contained recipes and conversions use the existing writing service and keep live-data requests in chat',()=>{
 for(const question of ['I need 1.5 cups of rice for four people. How many cups do I need for six?','I have eggs, rice and spinach. Suggest a 15-minute dinner.','Convert 72 degrees Fahrenheit to Celsius.']){
  assert.equal(model.request({mode:'auto',question},[]).route,'write');
  assert.equal(model.request({mode:'search',question},[]).route,'chat');
 }
 for(const question of ['Convert 200 dollars into euros.', 'How much do two cups of rice cost at current prices?', 'I have eggs. Suggest a meal and verify the latest recalls.'])assert.equal(model.request({mode:'auto',question},[]).route,'chat');
});

test('downloadable lists keep invented details out of the instructions and time budgets include breaks',()=>{
 const file=model.request({question:'Create a Markdown file with three travel items.',makeFile:'x'},[]);
 assert.match(file.prompt,/exactly N top-level items/);assert.match(file.prompt,/Leave unspecified bookings/);
 const timed=model.request({mode:'auto',question:'Break a 45-minute study session into three blocks, including breaks.'},[]);
 assert.equal(timed.route,'chat');assert.match(timed.question,/including breaks/);
});

test('equivalent planning prompts and a new total use conversation routing with the displayed history',()=>{
 const prior=[];
 for(const question of [
  'Split 40 minutes between measuring and packing.',
  'I have 40 minutes. Divide that time between measuring and packing. Give just the two blocks.'
 ]){
  assert.deepEqual(model.request({mode:'auto',question},prior),{route:'chat',mode:'auto',question,messages:[]});
 }
 const plan={question:'Split 40 minutes between measuring and packing.',reply:'Measuring — 16 min\nPacking — 24 min',status:'ok'};
 const next=model.request({mode:'auto',question:'Make that 25 minutes.'},[plan]);
 assert.equal(next.route,'chat');
 assert.deepEqual(next.messages,[{role:'user',content:plan.question},{role:'assistant',content:plan.reply}]);
 for(const question of ['Write a thank-you note.','Polish this sentence.','Please proofread my notes.']){
  assert.equal(model.request({mode:'auto',question},[plan]).route,'write');
 }
 assert.equal(model.request({mode:'auto',question:'Polish is my first language.'},[]).route,'chat');
 const file=model.request({mode:'auto',question:'Change the time to 25 minutes.',file:'plan'},[plan],{body:'original plan',editTarget:{sourceKey:'plan'}});
 assert.equal(file.route,'write');assert.match(file.prompt,/original plan/);
});
