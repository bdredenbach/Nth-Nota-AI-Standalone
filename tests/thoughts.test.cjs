'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const T=require('../app/src/main/assets/thoughts.js');
const M=require('../app/src/main/assets/model.js');

test('pin commands preserve recognized words and require a command boundary',()=>{
 assert.deepEqual(T.pinRequest('Keep my first idea. Keep the slower voice. Hold that thought!'),{text:'Keep my first idea. Keep the slower voice.'});
 assert.equal(T.sentences('Keep my first idea. Keep the slower voice.').pop(),'Keep the slower voice.');
 assert.deepEqual(T.pinRequest('Hold that thought.'),{text:''});
 assert.equal(T.pinRequest('What does hold that thought mean?'),null);
});

test('extractive recaps retain a late change of mind and original wording',()=>{
 const lines=['Try the green one.','Three sizes could work.','Keep the shape.','More contrast.','Actually, choose copper instead.'];
 const recap=T.recap(lines);
 assert.equal(recap.length,4);assert.equal(recap.at(-1),lines.at(-1));
 assert.ok(recap.every(x=>lines.includes(x)));
 assert.deepEqual(T.recap(['One idea.','One idea.']),['One idea.']);
});

test('paragraph offsets preserve the surrounding text including a Windows line break',()=>{
 const source='  First line.\r\nOne more.\r\n\r\n  Second paragraph.  ';
 const ranges=T.paragraphs(source);
 assert.equal(ranges.length,2);
 for(const r of ranges)assert.equal(source.slice(r.start,r.end),r.text);
 const last=ranges[1];assert.equal(source.slice(0,last.start)+'New.'+source.slice(last.end),'  First line.\r\nOne more.\r\n\r\n  New.  ');
});

test('voice captures and local summaries stay outside provider history, observations export with their step',()=>{
 assert.deepEqual(M.context([{kind:'recap',question:'My ramble',reply:'Local words',status:'ok'}]),[]);
 assert.equal(M.cardText({type:'Checklist',items:[{text:'Rotate',done:true,notes:['Folder closed.']},{text:'Reopen',done:false}]}),'- [x] Rotate\n  Observation: Folder closed.\n- [ ] Reopen');
});
