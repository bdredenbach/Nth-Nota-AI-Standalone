const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../app/src/main/assets/model.js');

test('file follow-ups reuse their preview and only related discussion, within the writing limit', () => {
 const file={name:'notes.zip',body:'x'.repeat(12100)};
 const turn={file:'one',question:'q'.repeat(2000)};
 const prior=['one','two','one'].map(id=>({file:id,status:'ok',question:'earlier',reply:id==='two'?'unrelated':'r'.repeat(1000)}));
 const request=model.request(turn,prior,file);
 assert.equal(request.route,'write');
 assert.ok(request.prompt.includes(file.body));
 assert.ok(request.prompt.includes('earlier') && !request.prompt.includes('unrelated'));
 assert.ok(request.prompt.length<=16000);
 assert.deepEqual(model.context(prior),[]);
});
