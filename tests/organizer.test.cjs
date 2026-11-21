const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('../app/src/main/assets/model');
const source = fs.readFileSync(path.join(__dirname,'../app/src/main/assets/organizer.js'),'utf8');

function setup() {
 const thread={id:'thread-old',title:'New chat',draft:'Campaign notes\nNext line',turns:[]};
 const card={id:'card-old',title:'Supplies',type:'Checklist',items:[{text:'Silver lute',done:false}]};
 const env={threads:new Map([[thread.id,thread]]),cards:new Map([[card.id,card]]),M:model,saved:null};
 env.persist=(key,data)=>{assert.equal(key,'organizer');env.saved=data;return true;};
 const organizer=vm.runInNewContext(source+';Organizer',env);
 return {env,organizer,thread,card};
}

test('existing drafts and checklist content are searchable before any organization data exists',()=>{
 const {organizer,thread,card}=setup();
 organizer.load(undefined);
 assert.equal(organizer.membership(thread.id),'');
 assert.equal(organizer.label(thread),'Campaign notes');
 assert.ok(organizer.searchable(card,'silver lute'));
 thread.turns=[{question:'Question',reply:'retired draft',retired:true}];
 assert.equal(organizer.searchable(thread,'retired draft'),false);
});

test('project membership is independent of original items and survives loading saved metadata',()=>{
 const {env,organizer,thread,card}=setup();
 organizer.load({projects:{one:'Campaign'},placement:{[thread.id]:'one'},pins:{[thread.id]:true}});
 organizer.inherit(card.id,thread.id);
 assert.equal(organizer.membership(card.id),'Campaign');
 assert.equal(card.project,undefined);
 const next=setup().organizer;next.load(env.saved);
 assert.equal(next.membership(card.id),'Campaign');
 assert.ok(next.hasPin(thread.id));
 env.persist=()=>false;
 organizer.forget(thread.id);
 assert.equal(organizer.membership(thread.id),'Campaign');
 env.persist=()=>true;
 organizer.forget(thread.id);
 assert.equal(organizer.membership(thread.id),'');
 assert.equal(organizer.hasPin(thread.id),false);
 assert.equal(organizer.membership(card.id),'Campaign');
});
