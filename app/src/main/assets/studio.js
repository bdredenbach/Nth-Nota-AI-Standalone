'use strict';
const Studio=(()=>{
 let dictation=null;
 function dictationButton(field){
  return button('studio-dictate','Dictate','mic','data-val="'+field+'"','text-btn');
 }
 function dictate(field){
  const el=$(field);if(!el)return;
  dictation={id:M.id('dictate'),el};N.dictate(dictation.id);
 }
 function dictated(id,words){
  if(!dictation||dictation.id!==id)return false;
  const el=dictation.el;dictation=null;
  if(document.contains(el))el.value=(el.value+' '+words).trim().slice(0,el.maxLength);
  return true;
 }
 function reserved(text){
  return /^(?:hold that thought|let me ramble|leave it here|walk me through it|rehearsal room|rewind one exchange|coach me|call it now|teach nota a phrase|my phrases|i m done|im done|i am done|finish ramble)$/.test(Phrases.key(text))||/^when i say\b/i.test(text);
 }
 function command(text,voice=false){
  const cmd=Thoughts.command(text);
  if(thread.rehearsal){
   if(cmd==='rewind one exchange'||cmd==='rewind one turn'){return {say:Rehearsal.rewind()};}
   return null;
  }
  if(thread.ramble)return null;
  const seed=Phrases.parse(text);
  if(seed){Phrases.form('',seed);return {};}
  if(cmd==='teach nota a phrase'){Phrases.form();return {};}
  if(cmd==='my phrases'){Phrases.menu();return {};}
  if(/^call it now(?:$|[\s:,.!?—-])/i.test(text)){Predictions.form(text.replace(/^call it now[\s:,.!?—-]*/i,''));return {};}
  if(cmd==='rehearsal room'){Rehearsal.setup('','',voice);return {};}
  const role=text.match(/^(.+?[.!?])\s*play (?:the role of )?(.+?)[.!?]*$/i);
  if(role){Rehearsal.setup(role[2],role[1],voice);return {};}
  const routine=Phrases.match(text);
  if(routine){Phrases.run(routine.id,voice);return {};}
  return null;
 }
 function buttons(){return button('practice-setup','Rehearsal room','chat')+button('phrases','My phrases','wave')+button('prediction-new','Call it now','compass');}
 return {dictationButton,dictate,dictated,reserved,command,buttons};
})();
