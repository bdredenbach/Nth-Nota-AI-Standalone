'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mem=require('../app/src/main/assets/memory');
const model=require('../app/src/main/assets/model');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=name=>fs.readFileSync(path.join(__dirname,'../app/src/main/assets',name+'.js'),'utf8');
function runtime(){
 const a=model.newThread(),b=model.newThread(),c=model.newThread(),d=model.newThread(true);
 const records={};
 const env={thread:a,threads:new Map([a,b,c].map(t=>[t.id,t])),cards:new Map(),prefs:{},M:model,MemoryModel:mem,
  remember(){},saveThread(){},renderChat(){},persist(k,v){records[k]=structuredClone(v);return true;}};
 vm.createContext(env);
 vm.runInContext(source('organizer')+';this.org=Organizer;',env);
 env.org.load({projects:{p:'Campaign',other:'Work'},placement:{[a.id]:'p',[b.id]:'p',[c.id]:'other'}});
 vm.runInContext(source('chat-memory')+';this.api=ChatMemory;',env);
 function ask(q){
  const t={question:q,mode:'auto'},prior=env.thread.turns;
  const p=model.request(t,prior);env.api.prepare(p,t,prior,null);
  return {raw:JSON.stringify(p),t};
 }
 return {env,records,a,b,c,d,ask};
}
test('saves by explicit scope, reloads project data, resolves current membership, excludes temporary chats',()=>{
 const {env,records,a,b,c,d,ask}=runtime();
 env.api.command('Remember that Balthazar plays a glass viola for this project.');
 env.api.command('Remember that my private instrument is a silver harp');
 assert.match(ask('Compare my instrument and Balthazar').raw,/silver harp/);
 env.org.load(records.organizer);env.thread=b;
 assert.match(ask('What instrument does Balthazar play?').raw,/glass viola/);
 assert.doesNotMatch(ask('What instrument does Balthazar play?').raw,/silver harp/);
 assert.doesNotMatch(ask('Write a recipe for soup').raw,/glass viola/);
 const reply=ask('What instrument does Balthazar play?').t;
 b.turns.push({...reply,reply:'A glass viola',status:'ok'});
 env.org.forget(b.id);
 assert.doesNotMatch(ask('Tell me more').raw,/glass viola/);
 for(const owner of [c,d]){env.thread=owner;assert.doesNotMatch(ask('Which instrument does Balthazar play?').raw,/glass viola|silver harp/);}
 env.api.command('Remember that my badge is yellow');
 assert.equal(d.memories,undefined);
 assert.equal(env.api.command('What do you remember?').say,'Memory is off in temporary chats.');
 env.thread=a;assert.match(ask('Which instrument is private?').raw,/silver harp/);
});
test('correction and forget change subsequent prompts and never replay old memory replies',()=>{
 const {env,b,ask}=runtime();
 env.api.command('Remember this for the project: The meeting is Friday.');
 env.thread=b;
 const {t}=ask('When do we meet?');
 b.turns.push({...t,status:'ok',reply:'Friday.',sources:[]});
 assert.match(env.api.command('Update that to The meeting is Tuesday.').say,/Updated/);
 assert.match(ask('When do we meet?').raw,/Tuesday/);
 assert.doesNotMatch(ask('When do we meet?').raw,/Friday/);
 env.api.command('What do you remember about the meeting?');
 assert.match(env.api.command('Forget that').say,/Forgotten/);
 assert.doesNotMatch(ask('When do we meet?').raw,/Friday|Tuesday/);
});
test('source version references survive explicit changes, duplicated saves are idempotent',()=>{
 const {env,a}=runtime();
 a.turns.push({status:'ok',reply:'The review is Friday.',file:'doc'});
 a.documents={doc:{savedId:'version-2'}};
 env.api.command('Remember this for the project');
 env.api.command('Remember that the review is Friday. for this project');
 const entries=env.org.projectMemories('p');
 assert.equal(entries.length,1);
 assert.equal(entries[0].origin.file,'version-2');assert.equal(entries[0].origin.index,0);
 assert.equal(entries[0].revision,1);
});
test('injection respects both request limits and existing chat pairs, and file histories exclude memory turns',()=>{
 const rows=Array.from({length:3},(_,i)=>({scope:'chat',id:String(i),revision:1,text:'x'.repeat(550),topic:'subject'}));
 const p={route:'chat',messages:Array.from({length:12},(_,i)=>({role:i%2?'assistant':'user',content:'z'.repeat(740)}))};
 assert.ok(mem.attach(p,rows).length);assert.ok(p.messages.length<=12);
 assert.equal(p.messages.length%2,0);assert.ok(p.messages.reduce((n,m)=>n+m.content.length,0)<=9000);
 const writing={route:'write',prompt:'p'.repeat(15950)};
 assert.deepEqual(mem.attach(writing,rows),[]);assert.equal(writing.prompt.length,15950);
 const turns=[{file:'v2',question:'Recall',reply:'Old memory',status:'ok',memoryRefs:[{id:'x',revision:1}]}];
 for(const doc of [{name:'file',body:'New text'},{body:'Revised',editTarget:{sourceKey:'v2'}}]){
  assert.doesNotMatch(model.request({file:'v2',question:'Read'},turns,doc).prompt,/Old memory/);
 }
});

test('a prompt naming project decisions only receives current project notes, including on file requests',()=>{
 const {env,a,ask}=runtime();
 env.api.command('Remember that the meeting is Tuesday for this project');
 env.api.command('Remember that my meeting snacks are private');
 assert.doesNotMatch(ask('Compare the meeting plan to the project decisions').raw,/private/);
 const turn={question:'Compare this Markdown with our project memory',file:'doc'};
 const payload=model.request(turn,[],{name:'plan.md',body:'Review next week'});
 env.api.prepare(payload,turn,a.turns,null);
 assert.match(payload.prompt,/Tuesday/);assert.doesNotMatch(payload.prompt,/private/);
 const imageTurn={question:'What about the meeting?',image:{}};
 const imagePayload={route:'chat',messages:[]};env.api.prepare(imagePayload,imageTurn,[],null);
 assert.deepEqual(imagePayload.messages,[]);
});
