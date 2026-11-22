'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const quality=require('../app/src/main/assets/answer-quality.js');
const model=require('../app/src/main/assets/model.js');
const question='Create a downloadable Markdown file called trip.md with three items for a train trip.';
const bad='- Train Trip 1\n- Train Trip 2\n- Train Trip 3';
const good='- Save an offline copy of your ticket.\n- Check the departure platform.\n- Keep your luggage tag handy.';
const durations=reply=>Array.from(reply.matchAll(/^- (\d+) min/gm),m=>+m[1]);

test('the actual 45-minute study request includes two breaks within its budget',()=>{
 const reply=quality.studyPlan('Break a 45-minute study session into three blocks, including breaks.');
 assert.deepEqual(durations(reply),[12,5,12,5,11]);
 for(let total=7;total<=120;total++)for(let blocks=2;blocks<=4;blocks++){
  const ds=durations(quality.studyPlan('Split my '+total+' minute study session into '+blocks+' blocks with breaks.'));
  assert.equal(ds.length,blocks*2-1);
  assert.equal(ds.reduce((a,b)=>a+b,0),total);
  assert.ok(ds.every(n=>n>=1));
 }
});
test('fixed breaks, no breaks, impossible budgets and subject-specific requests',()=>{
 assert.deepEqual(durations(quality.studyPlan('Split my 30-minute study session into three blocks with two-minute breaks.')),[9,2,9,2,8]);
 assert.deepEqual(durations(quality.studyPlan('Divide a 20-minute study session into 3 blocks without breaks.')),[7,7,6]);
 assert.match(quality.studyPlan('Split a 10-minute study session into three blocks with 5-minute breaks.'),/Shorten/);
 assert.equal(quality.studyPlan('Plan a 45-minute biology workshop with a quiz.'),'');
});
test('a tailored interval plan rejects wrong arithmetic, break lengths, break counts and false totals',()=>{
 const q='Plan a 50-minute drawing workshop into three blocks with two 5-minute breaks.';
 const budget=quality.timeBudget(q);
 const raw='WORK | 12 | Introductions\nBREAK | 5 | Stretch\nWORK | 15 | Practice\nBREAK | 5 | Walk\nWORK | 13 | Review';
 const topics='- Practice contour drawing from a houseplant.\n- Sketch the shadows using crosshatching.\n- Compare line weights and redraw one detail.';
 assert.deepEqual(durations(quality.workshopOutline(q,budget)),[14,5,13,5,13]);
 assert.equal(quality.workshopOutline(q+' Include a guest critique.',budget),'');
 assert.match(quality.activityInstructions(budget),/three|3/);
 assert.deepEqual(durations(quality.activityReply(topics,budget)),[14,5,13,5,13]);
 assert.equal(quality.activityReply(topics.replace('Sketch the shadows','Spend 15 minutes on shadows'),budget),'');
 const chat=model.request({mode:'auto',question:q},[]);
 assert.equal(chat.route,'chat');
 const formatted=quality.instructions(chat,quality.activityInstructions(budget));
 assert.match(formatted.question,/three blocks with two 5-minute breaks/);
 assert.match(formatted.question,/exactly 3 short Markdown bullets/);
 assert.deepEqual(formatted.messages,[]);
 const atLimit={...chat,question:'x'.repeat(2000)};
 assert.equal(quality.instructions(atLimit,'extra instructions'),atLimit);
 assert.deepEqual(durations(quality.intervalReply(raw,budget)),[12,5,15,5,13]);
 for(const broken of [raw.replace('12','17'),raw.replace('12','13').replace('5 | Stretch','4 | Stretch'),raw.replace('BREAK','WORK'),raw+'\nTotal: 50 minutes'])assert.equal(quality.intervalReply(broken,budget),'');
 assert.equal(quality.timeBudget('Plan a 10-minute talk and a 20-minute workshop.'),null);
 assert.equal(quality.timeBudget('Plan a 45-minute workshop plus a 10-minute break.'),null);
 assert.equal(quality.timeBudget('What is the difference between breaks and study sessions?'),null);
});
test('checklists detect the reported failure, duplicates, placeholders, and wrong item counts',()=>{
 const spec=quality.checklistSpec(question+' Do not use placeholders.');
 for(const draft of [bad,'- Train trip one\n- Train trip two\n- Train trip three','1. TODO\n2. [step]\n3. Placeholder','- A\n- A\n- C','- Pack your bag'])assert.ok(quality.listProblem(draft,spec));
 assert.equal(quality.listProblem(good,spec),'');
 assert.equal(quality.listProblem('# Supplies\n\n- [ ] Pens\n  - Blue or black\n- [ ] Paper\n- [ ] Folders',spec),'');
 assert.equal(quality.checklistSpec('Create a blank checklist template with three items.'),null);
 assert.equal(quality.checklistSpec('Write a Markdown essay about trees.'),null);
});
function flow(){
 const t={question,status:'waiting',makeFile:'output-test'},thread={id:'trip',turns:[t]},calls=[],saves=[];
 const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/app.js'),'utf8');
 const callback=source.slice(source.indexOf('window.notaEvent='),source.lastIndexOf("document.querySelectorAll('[data-icon]"));
 const env={window:{},thread,page:'chat',AnswerQuality:quality,M:model,N:{cloud:()=>true,ask:(id,payload)=>calls.push([id,JSON.parse(payload)])},job:{id:'first',turn:t,thread,payload:{route:'write',prompt:question+'\nSelected file: Rail instructions'},list:quality.checklistSpec(question)},ChatImages:{event:()=>false},Revision:{result:()=>false},saveThread(){},renderChat(){},Shelf:{completed:(_,turn)=>{if(turn.status==='ok')saves.push(turn.reply);}},LiveChat:{reply(){}}};
 vm.runInNewContext(callback,env);
 const answer=(id,text)=>env.window.notaEvent('answer',id,JSON.stringify({text}));
 return {t,env,answer,calls,saves};
}
test('the first invalid draft stays private, the repair retains context and only the valid file is delivered',()=>{
 const f=flow();f.answer('first',bad);
 assert.equal(f.t.status,'waiting');assert.equal(f.t.reply,undefined);assert.deepEqual(f.saves,[]);
 assert.equal(f.calls.length,1);assert.match(f.calls[0][1].prompt,/Selected file: Rail instructions/);
 f.answer('first',bad);assert.equal(f.calls.length,1);
 f.answer(f.calls[0][0],good);assert.equal(f.t.reply,good);assert.deepEqual(f.saves,[good]);
});
test('a failed repair and a canceled repair both leave Files untouched',()=>{
 const f=flow();f.answer('first',bad);f.answer(f.calls[0][0],bad);
 assert.equal(f.t.status,'error');assert.equal(f.t.reply,undefined);assert.equal(f.calls.length,1);assert.deepEqual(f.saves,[]);
 const g=flow();g.answer('first',bad);g.env.job=null;g.answer(g.calls[0][0],good);
 assert.equal(g.t.reply,undefined);assert.deepEqual(g.saves,[]);
});
