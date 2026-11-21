'use strict';
const Phrases=(()=>{
 const all=()=>Array.isArray(prefs.phrases)?prefs.phrases:[];
 const key=s=>String(s||'').toLowerCase().replace(/[“”"‘’']/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const match=text=>all().find(p=>key(p.trigger)===key(text));
 function parse(text){
  const normal=text.trim().replace(/[“”]/g,'"').replace(/[‘’]/g,"'");
  const m=normal.match(/^when i say\s+(?:"([^"]+)"|'([^']+)'|(.+?))\s*[,;:]?\s+(?=(?:ask|walk|run|start|take|use|open|collect|remind)\b)([\s\S]+)$/i);
  if(!m)return null;
  const desc=m[4].trim(),question=desc.match(/^ask\s+(?:me\s+)?(.+?)(?=[,;]|\s+and\s+(?:walk|run|collect|use)|$)/i);
  const list=desc.match(/(?:walk me through|use|run|start|open)\s+(?:(?:my|the|a)\s+)?(.+?)\s+checklist\b/i);
  const steps=desc.split(/[,;]|\s+(?:and then|then)\s+/i).map(x=>x.trim().replace(/^(?:and |then )+/i,'')).filter(x=>x&&!/^(?:ask |walk me through|(?:use|run|open) .*checklist|collect .*fail|record .*problem)/i.test(x))
   .map(x=>x.replace(/^remind me to\s+/i,'').replace(/[.]$/,''));
  let opening=question?question[1].trim():'';
  if(opening){
   opening=opening.replace(/^(what|which) (.+?) i(?:'m| am) (.+)$/i,'$1 $2 are you $3').replace(/^(what|which) (.+?) i (?:use|used)$/i,'$1 $2 did you use');
   opening=opening.charAt(0).toUpperCase()+opening.slice(1).replace(/[.?]+$/,'')+'?';
  }
  return {steps,trigger:(m[1]||m[2]||m[3]).trim().replace(/[,;:]$/,''),question:opening,list:list?list[1].trim():'',description:desc};
 }
 function menu(){
  const saved=all().map(p=>'<div class="phrase-row">'+button('phrase-run',p.trigger,'wave','data-id="'+p.id+'"','choice framed')+button('phrase-edit','Edit','pen','data-id="'+p.id+'"','text-btn')+'</div>').join('');
  modal('My phrases',saved+button('phrase-new','Teach Nota a phrase','plus','','primary')+button('phrase-describe','Describe a routine','mic'),'phrases');
 }
 let editing='';
 function form(id='',seed={}){
  const p=all().find(row=>row.id===id)||seed;editing=id;
  const lists=Array.from(cards.values()).filter(c=>c.type==='Checklist'&&!c.phraseRun&&c.items.some(x=>x.text.trim()));
  const matches=p.list?lists.filter(c=>key(c.title).includes(key(p.list))):[];
  const suggested=matches.length===1?matches[0]:null;
  modal('Teach Nota a phrase',(p.description?'<blockquote>'+M.esc(p.description)+'</blockquote>':'')+
   '<label class="field-label">When I say<input id="phrase-trigger" maxlength="100" placeholder="Start a Pixel test"></label>'+Studio.dictationButton('phrase-trigger')+
   '<label class="field-label">Opening question (optional)<input id="phrase-question" maxlength="350" placeholder="Which build are you testing?"></label>'+
   '<label class="field-label">Copy steps from a Desk checklist<select id="phrase-template"><option value="">Write my own steps</option>'+lists.map(c=>'<option value="'+c.id+'">'+M.esc(c.title)+'</option>').join('')+'</select></label>'+
   '<label class="field-label">Steps, one per line<textarea rows="4" id="phrase-steps" maxlength="6000" placeholder="Open a folder\nRotate the phone"></textarea></label>'+
   '<p class="desc">Each use creates a fresh checklist. Spoken problems are saved beside their step.</p>'+
   button('phrase-save','Save phrase','check','','primary')+(id?button('phrase-remove','Delete phrase','trash','','text-btn'):''),'phrase-editor');
  $('phrase-trigger').value=p.trigger||'';$('phrase-question').value=p.question||'';
  $('phrase-steps').value=(p.steps||[]).join('\n');
  if(suggested){$('phrase-template').value=suggested.id;fillSteps();}
 }
 function describe(){
  modal('Describe a routine','<label class="field-label">When I say…<textarea id="routine-description" rows="4" maxlength="1800" placeholder="When I say close the shop, remind me to lock the door, then check the lights."></textarea></label>'+Studio.dictationButton('routine-description')+button('phrase-review','Review steps','list','','primary'),'phrase-description');
 }
 function review(){
  const seed=parse($('routine-description').value);
  if(!seed){notice('Start with “When I say” followed by your phrase and what to do.');return;}
  form('',seed);
 }
 function fillSteps(){
  const c=cards.get($('phrase-template').value);
  if(c)$('phrase-steps').value=c.items.map(x=>x.text.trim()).filter(Boolean).join('\n');
 }
 function commit(list){
  const next={...prefs,phrases:list};
  if(!persist('prefs',next))return false;
  prefs.phrases=list;return true;
 }
 function save(){
  const trigger=$('phrase-trigger').value.trim(),question=$('phrase-question').value.trim();
  const steps=$('phrase-steps').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(!key(trigger)||!steps.length){notice('Add a spoken phrase and at least one step.');return;}
  if(steps.length>80){notice('Use up to 80 steps in one phrase.');return;}
  if(Studio.reserved(trigger)){notice('That phrase already controls Nota. Choose a different phrase.');return;}
  const collision=match(trigger);
  if(collision&&collision.id!==editing){notice('A saved phrase already uses those words.');return;}
  const p={id:editing||M.id('phrase'),trigger,question,steps};
  const list=all().filter(row=>row.id!==p.id);
  if(commit([...list,p])){menu();notice('Phrase saved. Say it in Live or type it in Chat.');}
 }
 function remove(){if(commit(all().filter(p=>p.id!==editing)))menu();}
 function run(id,voice=false){
  const p=all().find(row=>row.id===id);if(!p)return;
  const now=Date.now(),c={id:M.id('card'),type:'Checklist',title:p.trigger,items:p.steps.map(text=>({text,done:false})),body:'',sources:[],origin:'',
   phraseRun:{trigger:p.trigger,question:p.question,answer:''},updated:now};
  if(!persist(c.id,c))return;
  cards.set(c.id,c);card=c;typeFilter='All';navigate('card');if(voice)Walkthrough.start();
 }
 function awaiting(c){return !!(c&&c.phraseRun&&c.phraseRun.question&&!c.phraseRun.answer);}
 function answer(text){
  if(!awaiting(card)||!text.trim())return false;
  const next={...card,updated:Date.now(),phraseRun:{...card.phraseRun,answer:text.trim()}};
  if(!persist(next.id,next))return false;
  cards.set(next.id,next);card=next;renderCard();return true;
 }
 function header(c){
  if(!c.phraseRun||!c.phraseRun.question)return '';
  const p=c.phraseRun;
  return '<div class="thought-block"><strong>'+M.esc(p.question)+'</strong>'+(p.answer?'<p>'+M.esc(p.answer)+'</p>':'<label class="field-label"><input id="phrase-answer" maxlength="1500" aria-label="Answer opening question"></label>'+button('phrase-answer','Save answer','check','','text-btn'))+'</div>';
 }
 return {key,match,parse,menu,describe,review,form,fillSteps,save,run,remove,awaiting,answer,header};
})();
if(typeof module!=='undefined')module.exports=Phrases;
