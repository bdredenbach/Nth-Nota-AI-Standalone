'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const route=require('../app/src/main/assets/phone.js'),model=require('../app/src/main/assets/model.js');
test('the reported wording routes to local weather; a named place and follow-up retain their scope',()=>{
 assert.deepEqual(route("Can you tell me the weather where I'm at?"),{type:'weather',value:'',period:'now'});
 assert.deepEqual(route('What is the weather in Buffalo, NY tomorrow?'),{type:'weather',value:'Buffalo, NY',period:'tomorrow'});
 assert.deepEqual(route('What about tomorrow?',{wx:{value:'Toronto'}}),{type:'weather',value:'Toronto',period:'tomorrow'});
 for(const q of ['How does weather work?','Write a story about opening Audible','What is the weather in Buffalo next week?'])assert.equal(route(q),null);
});
test('phone requests resolve only explicit actions, and private results stay out of the AI context',()=>{
 assert.deepEqual(route('Open Audible'),{type:'app',value:'Audible'});
 assert.deepEqual(route('Open Wi-Fi settings'),{type:'setting',value:'wifi'});
 assert.equal(route('Show my recent apps').type,'recent');
 assert.equal(route('How much battery do I have left?').type,'battery');
 assert.equal(route('How much storage do I have left?').type,'storage');
 assert.deepEqual(model.context([{phone:true,status:'ok',question:'Recent apps',reply:'Private list'}]),[]);
});
