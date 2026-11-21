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

test('direct location and historical forecast area are distinct device routes',()=>{
 for(const text of ['Can you tell me where I am at currently?','Where am I?','Which city am I in right now?', 'Show me my approximate location']){
  assert.deepEqual(route(text),{type:'location'});
 }
 const weather=route('What is the weather like where I am at currently?');
 assert.deepEqual(weather,{type:'weather',value:'',period:'now'});
 for(const text of ['What location did you use for that forecast?','What city was that weather forecast for?','Where is the forecast for?']){
  assert.deepEqual(route(text),{type:'forecastArea'});
 }
 assert.deepEqual(route('Where was that for?',{weatherData:true}),{type:'forecastArea'});
 for(const text of ['Where am I in this book?', 'Tell a story about where I am.', 'Where is my friend right now?', 'Where was that for?']){
  assert.equal(route(text),null);
 }
});

test('forecast area comes from the selected exchange, including legacy replies',()=>{
 const reply=route.forecastAreaReply;
 assert.match(reply(),/isn’t a completed/);
 assert.equal(reply({forecastArea:'That forecast used a named place.'}),'That forecast used a named place.');
 assert.match(reply({reply:'The forecast for your current area is 44°F with clear skies.'}),/city name wasn’t saved/);
 assert.match(reply({reply:'Tomorrow in Erie, PA (saved place), the available hourly forecast ranges from 40°F to 60°F.'}),/Erie, PA \(saved place\)/);
 assert.match(reply({reply:'The forecast for Toronto is -4°C with snow.'}),/Toronto/);
 assert.match(reply({reply:'An older format without a label.'}),/wasn’t saved/);
});

test('conversational variants select the same Android data and settings',()=>{
 for(const [q,intent] of [
  ["What's my Android version?",{type:'device'}],['Am I charging?',{type:'battery'}],
  ['How much storage space do I have left?',{type:'storage'}],['What is the last app I opened?',{type:'recent',latest:true}],
  ['Open accessibility settings',{type:'setting',value:'accessibility'}],['Open battery saver settings',{type:'setting',value:'saver'}]
 ])assert.deepEqual(route(q),intent);
 assert.equal(route('How do I check which version of Android I am running?'),null);
});
