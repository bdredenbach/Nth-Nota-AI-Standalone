// Run with Node 22.13+, JDK 17+, and a sibling Nth-Nota-AI-Backend checkout.
// Set NOTA_ANDROID_CLASSPATH to a JVM org.json jar plus the SDK android.jar
// (in that order, separated by the platform path delimiter), or an android-all jar.
// npm install --prefix tests/integration
// node --test tests/integration/planning.test.cjs
// Set NOTA_BACKEND_DIR to use a different backend checkout.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const vm = require('node:vm');
const os = require('node:os');
const {execFileSync,spawn} = require('node:child_process');
const {createInterface} = require('node:readline');

const backend = process.env.NOTA_BACKEND_DIR || path.resolve(__dirname, '../../../Nth-Nota-AI-Backend');
const assets = path.resolve(__dirname, '../../app/src/main/assets');
const origin = 'https://appassets.androidplatform.net';
const firstQuestions = [
  'Split 40 minutes between measuring and packing.',
  'I have 40 minutes. Divide that time between measuring and packing. Give just the two blocks.'
];
const correction = 'Make that 25 minutes.';
const workshop = 'Plan a 50-minute drawing workshop into three blocks with two 5-minute breaks.';

function quotaStore() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(fs.readFileSync(path.join(backend, 'migrations/0001_quota.sql'), 'utf8'));
  return {
    close: () => sql.close(),
    prepare(query) {
      const stmt = sql.prepare(query);
      return { bind(...values) {
        const args = /\?\d/.test(query) ? [Object.fromEntries(values.map((v, i) => [i + 1, v]))] : values;
        return {
          first: () => stmt.get(...args) || null,
          all: () => ({results: stmt.all(...args)}),
          run: () => stmt.run(...args)
        };
      }};
    }
  };
}

function simulatedModel(messages) {
  const prompt = messages.at(-1).content;
  if (prompt.includes('Polish this sentence')) return 'The parcel is ready.';
  if (prompt.includes(workshop)) return '- Sketch the plant outline.\n- Shade the curled leaves.\n- Compare the two drawings.';
  const revised = prompt === correction;
  assert.ok(revised || firstQuestions.includes(prompt), 'unexpected inference request: ' + prompt);
  assert.match(messages[0].content, new RegExp('All minutes must sum to ' + (revised ? 25 : 40)));
  if (revised) assert.equal(messages.at(-2).content, 'Measuring — 16 min\nPacking — 24 min');
  return JSON.stringify({blocks: [
    {activity:'Measuring', minutes:revised ? 10 : 16},
    {activity:'Packing', minutes:revised ? 15 : 24}
  ]});
}

test('composer, Worker HTTP routing, history, and displayed planning replies', async t => {
  const source = fs.readFileSync(path.join(backend, 'worker.js'));
  const {default:worker} = await import('data:text/javascript;base64,' + source.toString('base64'));
  const {parseHTML} = await import('linkedom/worker');
  const db = quotaStore();
  t.after(() => db.close());
  const env = {DB:db, FREE_ONLY_CONFIRMED:'yes', IP_HASH_SALT:'offline-test',
    AI:{run:async (_, {messages}) => ({response:simulatedModel(messages)})}};
  const classes = fs.mkdtempSync(path.join(os.tmpdir(),'nota-gateway-'));
  t.after(() => fs.rmSync(classes,{recursive:true,force:true}));
  assert.ok(process.env.NOTA_ANDROID_CLASSPATH,'Set NOTA_ANDROID_CLASSPATH to Android and org.json classes');
  const classpath = [classes,process.env.NOTA_ANDROID_CLASSPATH].join(path.delimiter);
  execFileSync('java',['-m','jdk.compiler/com.sun.tools.javac.Main','-cp',classpath,'-d',classes,
    path.resolve(assets,'../java/com/nth/notaai/Gateway.java'),path.join(__dirname,'GatewayLoopback.java')]);
  const external = [];
  const originalFetch = global.fetch;
  global.fetch = async url => { external.push(String(url)); throw Error('Unexpected network call'); };
  t.after(() => { global.fetch = originalFetch; });

  for (const initial of firstQuestions) {
    const html = fs.readFileSync(path.join(assets,'index.html'),'utf8');
    const {document,Event} = parseHTML(html);
    const exchange = [];
    let pending, consent = false;
    const askWorker = async encoded => {
      const jvm = spawn('java',['-cp',classpath,'com.nth.notaai.GatewayLoopback'],{stdio:['pipe','pipe','inherit']});
      const lines = createInterface({input:jvm.stdout})[Symbol.asyncIterator]();
      try {
        jvm.stdin.write(encoded+'\n');
        const wire = JSON.parse((await lines.next()).value);
        const endpoint = new URL(wire.url).pathname;
        assert.equal(new URL(wire.url).host,'nth-nota-free-ai.bdredenbach.workers.dev');
        assert.equal(wire.method,'POST');
        assert.equal(wire.origin,origin);
        const body = JSON.parse(wire.body);
        assert.equal(body.consentAccepted,true);
        const response = await worker.fetch(new Request(wire.url,{
          method:wire.method,headers:{Origin:wire.origin,'Content-Type':wire.type},body:wire.body
        }),env);
        const answer = await response.json();
        exchange.push({endpoint,body,answer});
        assert.equal(response.status,200,JSON.stringify(answer));
        jvm.stdin.end(response.status+'\n'+JSON.stringify(answer)+'\n');
        return JSON.parse((await lines.next()).value);
      } finally {
        jvm.kill();
      }
    };
    const bridge = {
      records:() => JSON.stringify({prefs:{phoneIntro:true}}), record:() => true,
      theme(){}, setVoice(){}, mounted(){}, savedFiles:() => '[]',
      cloud:() => consent, consent:value => { consent = value; },
      ask(id, encoded) {
        pending = askWorker(encoded).then(reply => ui.notaEvent('answer',id,JSON.stringify(reply)));
      }
    };
    const ui = vm.createContext({document, URL, Nota:bridge,
      matchMedia:() => ({matches:false,addEventListener(){}}), addEventListener(){},
      setTimeout(){}, clearTimeout(){}, requestAnimationFrame(){}});
    ui.window = ui;
    for (const script of document.querySelectorAll('script[src]')) {
      const name = script.getAttribute('src');
      vm.runInContext(fs.readFileSync(path.join(assets,name),'utf8'), ui, {filename:name});
    }
    const click = selector => document.querySelector(selector).dispatchEvent(new Event('click',{bubbles:true}));
    const send = question => {
      const field = document.querySelector('#question');
      field.value = question;
      field.dispatchEvent(new Event('input',{bubbles:true}));
      click('#send');
    };
    const rendered = async index => {
      await pending;
      const row = document.querySelector('#turn-' + index);
      assert.ok(row, 'missing rendered turn ' + index);
      assert.equal(row.querySelector('.problem'),null);
      assert.match(row.querySelector('.reply-meta').textContent,/Cloudflare/);
      return row.querySelector('.answer-text').innerText.trim();
    };
    send(initial);
    click('[data-action="agree"]');
    assert.equal(exchange.length, 0, 'consent alone must not send a request');
    click('#send');
    assert.equal(await rendered(0), 'Measuring — 16 min\nPacking — 24 min');
    send(correction);
    assert.equal(await rendered(1), 'Measuring — 10 min\nPacking — 15 min');
    assert.deepEqual(exchange.map(x => x.endpoint), ['/v1/chat','/v1/chat']);
    assert.deepEqual(exchange[0].body.messages, []);
    assert.deepEqual(exchange[1].body.messages, [
      {role:'user',content:initial}, {role:'assistant',content:exchange[0].answer.text}
    ]);
    assert.ok(exchange.every(x => x.answer.searched === false && x.answer.provider === 'cloudflare'));
    send('Polish this sentence: The parcel, it is ready.');
    assert.equal(await rendered(2), 'The parcel is ready.');
    assert.equal(exchange[2].endpoint, '/v1/write');
    send(workshop);
    const intervals = [...(await rendered(3)).matchAll(/(\d+) min —/g)].map(m => Number(m[1]));
    assert.deepEqual(intervals, [14,5,13,5,13]);
    assert.equal(exchange[3].endpoint, '/v1/chat');
    assert.equal(exchange.length,4);
  }
  assert.deepEqual(external, []);
});
