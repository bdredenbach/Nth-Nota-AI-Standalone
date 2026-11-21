'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const phrases=require('../app/src/main/assets/phrases.js');
const practice=require('../app/src/main/assets/rehearsal.js');
const model=require('../app/src/main/assets/model.js');
test('a dictated phrase becomes an editable question and checklist reference',()=>{
 const seed=phrases.parse('When I say “start a Pixel test,” ask which build I’m testing, walk me through my rotation checklist, and collect anything that fails.');
 assert.equal(seed.trigger,'start a Pixel test');assert.equal(seed.question,'Which build are you testing?');assert.equal(seed.list,'rotation');
 assert.equal(phrases.key('Start a Pixel test!'),phrases.key(seed.trigger));
 assert.deepEqual(phrases.parse('When I say close the shop, remind me to lock the door, then check the lights.').steps,['lock the door','check the lights']);
});
test('only the active practice dialogue goes into a role turn',()=>{
 const fake=(question,extras)=>({practice:'role',question,reply:'Reply',status:'ok',...extras});
 const rows=[fake('Retired line',{retired:true}),fake('Private phone lookup',{practice:undefined,phone:true}),fake('Could we swap shifts?'),fake('Coaching text',{practice:'coach'})];
 const p=practice.prompt({role:'manager',scene:'Scheduling'},{practice:'role',question:'I can cover Sunday.'},rows);
 assert.equal(p.route,'write');assert.match(p.prompt,/Could we swap shifts/);assert.doesNotMatch(p.prompt,/Retired line|Private phone lookup|Coaching text/);
 assert.deepEqual(model.context(rows.slice(0,2)),[]);
});
test('coaching validates the spoken line before it can link to a quote',()=>{
 const turn={},role={practice:'role',status:'ok',question:'Could we swap shifts?'};
 const response=JSON.stringify({line:1,quote:'swap shifts',feedback:'You made a concrete request.'});
 assert.equal(practice.coaching(turn,[role],response),'You made a concrete request.');assert.equal(turn.line,0);
 assert.throws(()=>practice.coaching({},[{...role,retired:true}],response));
 assert.throws(()=>practice.coaching({},[role],response.replace('swap shifts','switch jobs')));
});
