const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('../app/src/main/assets/model.js');
const images = vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app/src/main/assets/images.js'),'utf8') + ';ChatImages');
test('same-image follow-ups keep only recent completed answers about that picture', () => {
  const turn = (id,i) => ({image:{id},status:'ok',question:'q'+i,reply:'a'+i});
  const turns = [turn('a',1),turn('a',2),turn('b',3),turn('a',4),turn('a',5),{...turn('a',6),canAskText:true},{...turn('a',7),status:'error'}];
  assert.deepEqual(Array.from(images.history({id:'a'},turns),m=>m.content),['q2','a2','q4','a4','q5','a5']);
  assert.deepEqual(model.context(turns),[]);
});
test('vision gateway rejects oversized bodies, missing consent and remote image addresses before inference', async () => {
  const handler = (await import('../cloud/vision.mjs')).default;
  const env = {FREE_ONLY_CONFIRMED:'yes',DB:{},AI:{},LIMITER:{}};
  const url = 'https://example.test/v1/vision';
  const post = (data,headers={}) => handler.fetch(new Request(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(data)}),env);
  assert.equal((await handler.fetch(new Request(url),env)).status,200);
  assert.equal((await post({question:'Read this',image:'https://example.test/external.jpg',consentAccepted:true})).status,400);
  assert.equal((await post({}, {'content-length':'2000000'})).status,413);
  assert.equal((await post({question:'Read this',image:'/9j/',consentAccepted:false})).status,400);
});
