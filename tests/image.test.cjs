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

test('image completions share the daily neuron budget with text and retain unmetered reservations', async () => {
  const handler = (await import('../cloud/vision.mjs')).default;
  const day = new Date().toISOString().slice(0,10);
  const bucket = 'budget:cloudflare:neurons';
  let used = 9000;
  const db = {prepare(query) {
    return {bind(...args) {
      if (query.startsWith('INSERT INTO quota')) {
        const [date,name,reserve,cap] = args;
        assert.equal(date,day);assert.equal(name,bucket);
        return {first() {
          if (used + reserve > cap) return null;
          used += reserve;
          return {used};
        }};
      }
      assert.match(query,/^UPDATE quota SET used=used/);
      const [delta,date,name,held] = args;
      assert.equal(date,day);assert.equal(name,bucket);assert.ok(used>=held);
      return {run() {used += delta;}};
    }};
  }};
  // The input header has a 1 x 1 JPEG frame. Inference itself is mocked.
  const jpeg = Buffer.from([255,216,255,192,0,11,8,0,1,0,1,1,1,17,0,255,217]).toString('base64');
  let usage = {prompt_tokens:392,completion_tokens:36,total_tokens:428}, calls = 0;
  const env = {DB:db,FREE_ONLY_CONFIRMED:'yes',LIMITER:{limit:async()=>({success:true})},AI:{run:async()=>{calls++;return {response:'Blue.',usage}}}};
  const ask = () => handler.fetch(new Request('https://example.test/v1/vision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:jpeg,question:'What color?',consentAccepted:true})}),env);
  assert.equal((await ask()).status,200);assert.equal(used,9005);
  usage = {prompt_tokens:0,completion_tokens:0,total_tokens:0};
  assert.equal((await ask()).status,200);assert.equal(used,9205);
  usage = undefined;
  assert.equal((await ask()).status,200);assert.equal(used,9405);
  used = 9801;
  const limited = await ask();
  assert.equal(limited.status,429);assert.equal(calls,3);assert.equal(used,9801);
  assert.ok(Number(limited.headers.get('Retry-After'))>0);
  assert.equal((await limited.json()).retryAt,Date.parse(day+'T00:00:00Z')+86400000);
});
