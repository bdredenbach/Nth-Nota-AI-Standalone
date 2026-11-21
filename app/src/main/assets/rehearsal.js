'use strict';
const Rehearsal=(()=>{
 let pending=null;
 function setup(role='',scene='',voice=false){
  modal('Rehearsal room','<label class="field-label">Who should Nota play?<input id="practice-role" maxlength="100" placeholder="My manager"></label>'+
   '<label class="field-label">What do you want to practice?<textarea id="practice-scene" rows="3" maxlength="800" placeholder="Asking to swap my Saturday shift"></textarea></label>'+
   '<p class="desc">The writing service receives the situation and recent lines. Ask for coaching whenever you’re ready.</p>'+
   button('practice-start',(N.cloud()?'':'Allow cloud and ')+(voice?'speak':'start rehearsal'),'chat','data-val="'+(voice?'voice':'text')+'"','primary')+(voice?'':button('practice-start',N.cloud()?'Start speaking':'Allow cloud and speak','mic','data-val="voice"')),'practice-setup');
  $('practice-role').value=role;$('practice-scene').value=scene;
 }
 function start(voice){
  const role=$('practice-role').value.trim(),scene=$('practice-scene').value.trim();
  if(!role||!scene){notice('Add a role and a situation.');return;}
  pending={role,scene,voice};
  if(thread.temporary&&(thread.turns.length||thread.draft.trim()||thread.attachment)){
   confirmAction('Leave temporary chat?','Starting this rehearsal discards the open temporary chat. Desk cards you explicitly saved are kept.','practice-confirm','Start rehearsal');return;
  }
  enter();
 }
 function enter(){
  if(!pending)return;
  const {role,scene,voice}=pending;pending=null;
  if(!N.cloud())N.consent(true);
  const t=M.newThread(thread.temporary);t.rehearsal={role,scene};t.title='Rehearsal · '+role;
  chooseThread(t);saveThread();renderChat();
  if(voice)LiveChat.start(false);
 }
 function rewind(){
  if(job)stopJob('Rewound during this reply.');
  let i=thread.turns.length-1;
  while(i>=0 && (thread.turns[i].retired||thread.turns[i].practice!=='role'))i--;
  if(i<0)return 'There is no exchange to rewind yet.';
  for(const t of thread.turns.slice(i))if(t.practice)t.retired=true;
  thread.updated=Date.now();saveThread();renderChat(true);return 'Rewound one exchange. Try your next line.';
 }
 function isCoach(text){return /^(?:coach me|give me feedback|start coaching|coach this rehearsal)[.!?]*$/i.test(text.trim());}
 function prompt(room,t,prior){
  const entries=[];
  let used=0;
  for(let i=prior.length-1;i>=0;i--){
   const turn=prior[i];
   if(turn.practice!=='role'||turn.retired||turn.status!=='ok')continue;
   const entry={line:i+1,speaker:turn.question,partner:turn.reply.slice(0,1600)};
   const length=JSON.stringify(entry).length;
   if(used+length>9200)break;
   entries.unshift(entry);used+=length;
  }
  const coaching=t.practice==='coach';
  const instruction=coaching?'Coach the speaker only because feedback was requested. Identify one moment in the supplied dialogue. Return only a JSON object with line (number), quote (an exact substring of that speaker line), and feedback (one specific observation and a possible next try).':
   'Play the partner named below. Respond to the speaker’s latest line in character in one or two conversational sentences. Leave room for their answer. Do not narrate or coach.';
  return {route:'write',prompt:instruction+'\n\n'+JSON.stringify({role:room.role,situation:room.scene,dialogue:entries,...(coaching?{}:{latest:t.question})})};
 }
 function coaching(t,prior,raw){
  const cleaned=raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi,'');
  try{
   const d=JSON.parse(cleaned),i=d.line-1,row=prior[i];
   if(!Number.isInteger(i)||!row||row.practice!=='role'||row.retired||row.status!=='ok'||
      typeof d.quote!=='string'||!d.quote.trim()||!row.question.includes(d.quote)||typeof d.feedback!=='string'||!d.feedback.trim())throw Error();
   t.quote=d.quote;t.line=i;return d.feedback.trim();
  }catch(_){throw Error('Nota couldn’t match its feedback to an exact line. Retry coaching.');}
 }
 function panel(){
  const room=thread.rehearsal,turns=thread.turns;
  const earlier=turns.filter(t=>t.retired&&t.practice==='role');
  return '<aside class="thought-block practice-panel"><small>Rehearsal room</small><h3>'+M.esc(room.role)+'</h3><p>'+M.esc(room.scene)+'</p>'+
   button('practice-rewind','Rewind one exchange','back','','text-btn')+button('practice-coach','Coach me','compass','','text-btn')+
   (earlier.length?'<details><summary>Earlier takes · '+earlier.length+'</summary>'+earlier.map(t=>'<p><strong>You</strong> '+M.esc(t.question)+'</p><p><strong>'+M.esc(room.role)+'</strong> '+M.esc(t.reply||'')+'</p>').join('')+'</details>':'')+'</aside>';
 }
 return {setup,start,enter,rewind,isCoach,prompt,coaching,panel};
})();
if(typeof module!=='undefined')module.exports=Rehearsal;
