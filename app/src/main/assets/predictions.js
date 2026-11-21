'use strict';
const Predictions=(()=>{
 const date=ms=>new Date(ms).toLocaleString();
 const verdicts=['Held up','Partly held up','Didn’t hold up','Inconclusive'];
 function form(text=''){
  modal('Call it now','<label class="field-label">What do you predict?<textarea id="prediction-text" rows="3" maxlength="2400" placeholder="I think the folder will stay open after rotation."></textarea></label>'+
   Studio.dictationButton('prediction-text')+'<label class="field-label">What result would change your mind?<textarea id="prediction-test" rows="2" maxlength="1800"></textarea></label>'+
   Studio.dictationButton('prediction-test')+'<p class="desc">Save your original words and the time on this device. Return to the card to record what happened.</p>'+button('prediction-save','Save prediction','check','','primary'),'prediction');
  $('prediction-text').value=text;
 }
 function save(){
  const text=$('prediction-text').value.trim(),test=$('prediction-test').value.trim();
  if(!text||!test){notice('Add your prediction and the result that would change your mind.');return;}
  const saved=create(text,test);
  if(saved){card=saved;typeFilter='All';navigate('card');}
 }
 function create(text,test){
  const now=Date.now(),c={id:M.id('card'),type:'Prediction',title:text.slice(0,76),prediction:{text,test,at:now,outcomes:[]},items:[],sources:[],origin:'',updated:now};
  if(!persist(c.id,c))return false;
  cards.set(c.id,c);return c;
 }
 function voice(s,text){
  if(thread.rehearsal||thread.ramble||s.mode!=='chat')return null;
  const cmd=Thoughts.command(text);
  if(s.predicting){
   if(cmd==='cancel'||cmd==='cancel prediction'){delete s.predicting;return {say:'Prediction canceled.'};}
   if(!s.predicting.text){s.predicting.text=text;return {say:'What result would change your mind?'};}
   if(!create(s.predicting.text,text))return {say:'Could not save your prediction. Try again.'};
   delete s.predicting;return {say:'Your prediction is on your Desk. Open it later to record what happened.'};
  }
  if(!/^call it now(?:$|[\s:,.!?—-])/i.test(text))return null;
  s.predicting={text:text.replace(/^call it now[\s:,.!?—-]*/i,'').trim()};
  return {say:s.predicting.text?'What result would change your mind?':'What do you predict?'};
 }
 function view(c){
  const p=c.prediction;
  const observed=p.outcomes.map(o=>'<section><small>'+M.esc(date(o.at))+'</small><h3>'+M.esc(o.verdict)+'</h3><p>'+M.esc(o.text)+'</p></section>').join('');
  return '<div class="edit-compare prediction-compare"><section><small>Prediction · '+M.esc(date(p.at))+'</small><p>'+M.esc(p.text)+'</p><strong>What would change my mind</strong><p>'+M.esc(p.test)+'</p></section><section><h3>What actually happened?</h3>'+ (observed||'<p>Outcome pending</p>')+'</section></div>'+button('prediction-outcome',observed?'Add another observation':'Record outcome','pen','','action-chip');
 }
 function outcome(){
  modal('What actually happened?','<label class="field-label">Observation<textarea id="actual-text" rows="3" maxlength="2400"></textarea></label>'+Studio.dictationButton('actual-text')+
   '<label class="field-label">How did the prediction hold up?<select id="actual-verdict">'+verdicts.map(v=>'<option>'+M.esc(v)+'</option>').join('')+'</select></label>'+button('prediction-record','Save observation','check','','primary'),'outcome');
  $('actual-verdict').value='Inconclusive';
 }
 function record(){
  const text=$('actual-text').value.trim(),verdict=$('actual-verdict').value;
  if(!text||!verdicts.includes(verdict)){notice('Describe the outcome first.');return;}
  const next={...card,updated:Date.now(),prediction:{...card.prediction,outcomes:[...card.prediction.outcomes,{text,verdict,at:Date.now()}]}};
  if(!persist(next.id,next))return;
  cards.set(next.id,next);card=next;closeSheet();renderCard();
 }
 function exportText(c){const p=c.prediction;return 'Prediction · '+date(p.at)+'\n'+p.text+'\n\nWhat would change my mind\n'+p.test+'\n\nWhat actually happened?\n'+(p.outcomes.map(o=>date(o.at)+' · '+o.verdict+'\n'+o.text).join('\n\n')||'Outcome pending');}
 return {form,save,voice,view,outcome,record,exportText};
})();
