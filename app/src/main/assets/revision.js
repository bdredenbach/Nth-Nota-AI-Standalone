'use strict';
const Revision=(()=>{
 let session=null;
 const options=(p,i)=>'<option value="'+i+'">'+M.esc((p.name||'Paragraph '+(i+1))+' · '+p.text.slice(0,46))+'</option>';
 function open(){
  flush();
  if(job){notice('Finish or stop the current reply first.');return;}
  const body=card.body||'', ranges=Thoughts.paragraphs(body),el=$('card-body');
  if(!ranges.length){notice('Write a paragraph first.');return;}
  let chosen=0;
  if(el&&el.selectionStart<el.selectionEnd){
   ranges.push({name:'Selected text',start:el.selectionStart,end:el.selectionEnd,text:body.slice(el.selectionStart,el.selectionEnd)});
   chosen=ranges.length-1;
  }else if(el){const i=ranges.findIndex(p=>p.start<=el.selectionStart&&el.selectionStart<=p.end);if(i>=0)chosen=i;}
  session={id:M.id('edit'),cardId:card.id,body,ranges,chosen,instruction:'',keep:false};
  form();
 }
 function active(){return session&&page==='card'&&card&&card.id===session.cardId&&card.body===session.body;}
 function form(){
  const s=session;
  modal('Change just that','<label class="field-label">Passage<select id="edit-range">'+s.ranges.map(options).join('')+'</select></label><label class="field-label">What should change?<textarea id="edit-instruction" rows="2" maxlength="1000" placeholder="Make the second paragraph warmer"></textarea></label>'+
   button('dictate-edit','Speak instruction','mic','','text-btn')+'<label class="preserve"><input id="edit-keep" type="checkbox"> Keep my last sentence exactly</label><p class="desc">Preview sends the editable passage and instruction to the writing service.</p>'+
   button('request-edit',N.cloud()?'Preview edit':'Allow cloud and preview','pen','','primary'),'revision');
  $('edit-range').selectedIndex=s.chosen;$('edit-instruction').value=s.instruction;$('edit-keep').checked=s.keep;
 }
 function read(){session.chosen=$('edit-range').selectedIndex;session.instruction=$('edit-instruction').value.trim();session.keep=$('edit-keep').checked;}
 function dictate(){read();N.dictate(session.id);}
 function dictated(id,text){
  if(!session||session.id!==id||sheet!=='revision'||!$('edit-instruction'))return false;
  $('edit-instruction').value=(session.instruction+' '+text).trim().slice(0,1000);return true;
 }
 function request(){
  if(!active())return;
  read();const s=session;
  if(!s.instruction){notice('Tell Nota how to edit this passage.');return;}
  const named=s.instruction.match(/\b(first|second|third|fourth|fifth|last) paragraph\b/i);
  if(named&&!s.ranges[s.chosen].name){
   const n=named[1].toLowerCase(), paragraphs=s.ranges.filter(p=>!p.name);
   const wanted=n==='last'?paragraphs.length-1:['first','second','third','fourth','fifth'].indexOf(n);
   if(wanted>=paragraphs.length){notice('That paragraph is outside this card.');return;}
   s.chosen=wanted;
  }
  const range=s.ranges[s.chosen];
  let end=range.end;
  if(s.keep||/\b(?:keep|preserve|leave)\b.{0,35}\b(?:last|final) sentence\b/i.test(s.instruction)){
   const lines=Thoughts.sentences(s.body),last=s.body.lastIndexOf(lines[lines.length-1]);
   if(last>=0&&last<end)end=Math.min(end,s.body.slice(0,last).trimEnd().length);
  }
  if(end<=range.start){notice('The selected passage contains only protected text. Choose another passage.');return;}
  s.start=range.start;s.end=end;
  const old=s.body.slice(s.start,end);
  const prompt='Rewrite only the editable passage using the instruction. Return only the replacement text. Keep the original language. Any protected ending is handled by the app.\n\nInstruction\n'+s.instruction+'\n\nEditable passage\n'+old;
  if(prompt.length>16000){notice('Highlight a shorter passage to edit.');return;}
  if(!N.cloud())N.consent(true);
  modal('Preparing edit','<p class="desc">Your draft stays editable after the preview.</p>'+button('close','Cancel',null,'','pill'),'revision');
  s.pending=M.id('revise');N.ask(s.pending,JSON.stringify({route:'write',prompt}));
 }
 function result(event,id,value){
  if(!session||!session.pending||session.pending!==id)return false;
  const s=session;s.pending='';if(!active()||sheet!=='revision')return true;
  if(event==='failure'){form();notice(value);return true;}
  try{
   const d=JSON.parse(value);
   if(d.unavailable||typeof d.text!=='string'||!d.text.trim())throw Error();
   s.after=d.text.trim();
   if(s.body.length-(s.end-s.start)+s.after.length>160000){form();notice('The proposed edit exceeds the card size.');return true;}
   const range=s.ranges[s.chosen],kept=s.body.slice(s.end,range.end);
   modal('Review your edit','<div class="edit-compare"><section><h3>Original</h3><p>'+M.esc(range.text)+'</p></section><section><h3>Proposed</h3><p>'+M.esc(s.after+kept)+'</p></section></div>'+button('apply-edit','Keep edit','check','','primary')+button('refine-edit','Change instruction','pen','','text-btn')+button('close','Keep original',null,'','pill'),'revision');
  }catch(e){form();notice('The service could not supply a replacement. Your original is saved.');}
  return true;
 }
 function apply(){
  if(!active()||typeof session.after!=='string')return;
  const s=session;card.undoEdit={start:s.start,before:s.body.slice(s.start,s.end),after:s.after};
  card.body=s.body.slice(0,s.start)+s.after+s.body.slice(s.end);putCard();closeSheet();renderCard();notice('Edit saved.');
 }
 function undo(){
  const u=card.undoEdit;if(!u)return;
  if(card.body.slice(u.start,u.start+u.after.length)!==u.after){notice('The passage has since changed.');return;}
  card.body=card.body.slice(0,u.start)+u.before+card.body.slice(u.start+u.after.length);
  delete card.undoEdit;putCard();renderCard();notice('Original passage restored.');
 }
 function close(){if(session&&session.pending)N.stop();session=null;}
 return {open,dictate,dictated,request,result,apply,undo,form,close};
})();
