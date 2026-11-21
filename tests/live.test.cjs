'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/live.js'), 'utf8');

function conversation() {
  const elements = new Map(), calls = [], timers = new Map();
  let counter = 0;
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      dataset:{}, classList:{toggle(){}}, setAttribute(){}, textContent:'', blur(){}
    });
    return elements.get(id);
  }
  const bridge = {
    cloud:()=>true,
    beginLive:id=>calls.push(['begin',id]),
    listenLive:(id,t)=>calls.push(['listen',id,t]),
    endLive:id=>calls.push(['end',id]),
    interruptLive:id=>calls.push(['interrupt',id]),
    muteLive:id=>calls.push(['mute',id]),
    speakLive:(id,t,text)=>calls.push(['speak',id,t,text])
  };
  const runtime = {
    ChatMemory:{command:()=>null},Thoughts:require('../app/src/main/assets/thoughts.js'),Predictions:{voice:()=>null},Studio:{command:()=>null},ConversationTools:{handle:()=>null},document:{getElementById:element,activeElement:element('focus')}, $:element,
    M:{id:p=>p+(++counter),forSpeech:require('../app/src/main/assets/model.js').forSpeech}, N:bridge, page:'chat', job:null, thread:{id:'thread-test'},
    submitQuestion:(text,attachment,voice)=>{calls.push(['ask',text,attachment,voice]);return true;},
    closeSheet(){},stopJob(){},notice(){},requestAnimationFrame:cb=>cb(),
    setTimeout:(cb,delay)=>{const id=++counter;timers.set(id,{cb,delay});return id;},
    clearTimeout:id=>timers.delete(id)
  };
  vm.createContext(runtime);
  vm.runInContext(source+'\nthis.api=LiveChat;',runtime);
  const api = runtime.api;
  function tick() {
    for(const [id,t] of Array.from(timers)) if(t.delay<1000){timers.delete(id);t.cb();}
  }
  api.start(false);
  const id=calls[0][1];
  const event=(type,t='',v='')=>api.onEvent(id,type,t,v);
  event('ready');tick();
  const listening=()=>calls.filter(x=>x[0]==='listen').at(-1)[2];
  return {api,id,event,tick,listening,calls,runtime,element};
}

test('switching voice views keeps one session, and stale microphone finals cannot send twice',()=>{
  const s=conversation(), token=s.listening();
  s.api.view(true);
  s.event('partial',token,'partial words');
  assert.equal(s.element('live-caption').textContent,'partial words');
  s.api.view(false);
  s.event('final',token,'Final question');
  s.event('final',token,'Duplicate result');
  assert.equal(s.calls.filter(c=>c[0]==='begin').length,1);
  assert.equal(s.calls.filter(c=>c[0]==='ask').length,1);
  assert.equal(s.calls.find(c=>c[0]==='ask')[2],'');
});

test('mute holds the microphone through the end of playback; ending drops late events',()=>{
  const s=conversation();
  s.event('final',s.listening(),'Hello');
  s.api.reply({voice:{id:s.id},thread:s.runtime.thread},{status:'ok',reply:'Hello there.'});
  const playback=s.calls.find(c=>c[0]==='speak')[2];
  s.event('speaking',playback);
  s.api.mute();
  s.event('spoken',playback);
  s.tick();
  assert.equal(s.calls.filter(c=>c[0]==='listen').length,1);
  s.api.mute();s.tick();
  assert.equal(s.calls.filter(c=>c[0]==='listen').length,2);
  const last=s.listening();
  s.api.end();
  s.event('final',last,'Late transcript');
  assert.equal(s.calls.filter(c=>c[0]==='ask').length,1);
});

test('interrupt during playback starts exactly one new turn and ignores old completion',()=>{
  const s=conversation();
  s.event('final',s.listening(),'Tell me more');
  s.api.reply({voice:{id:s.id},thread:s.runtime.thread},{status:'ok',reply:'Here is more.'});
  const playback=s.calls.find(c=>c[0]==='speak')[2];
  s.api.interrupt();s.tick();
  s.event('spoken',playback);s.tick();
  assert.equal(s.calls.filter(c=>c[0]==='interrupt').length,1);
  assert.equal(s.calls.filter(c=>c[0]==='listen').length,2);
});
