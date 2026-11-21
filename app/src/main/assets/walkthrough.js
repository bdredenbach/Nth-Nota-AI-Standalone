'use strict';
const Walkthrough=(()=>{
 function start(){
  flush();
  if(!card||card.type!=='Checklist')return;
  if(!card.items.some(item=>item.text.trim()&&!item.done)){notice('Add an unchecked step to start a walkthrough.');return;}
  LiveChat.start(true,'walk');
 }
 function current(s){
  return card&&card.id===s.cardId?card.items.findIndex(item=>!item.done&&item.text.trim()):-1;
 }
 function prompt(s){
  const i=current(s);
  return i<0?'Checklist complete.':'Step '+(i+1)+' of '+card.items.length+'. '+card.items[i].text;
 }
 function handle(s,text){
  const i=current(s);
  if(i<0)return {say:'Checklist complete.',endAfter:true};
  const cmd=Thoughts.command(text);
  if(cmd==='end walkthrough'||cmd==='stop walkthrough'){LiveChat.end();return {};}
  if(s.noteIndex!=null){
   if(cmd==='cancel'){delete s.noteIndex;return {say:prompt(s)};}
   if(['repeat','done','i found a problem'].includes(cmd))return {say:'Describe the problem on step '+(s.noteIndex+1)+', or say cancel.'};
   return record(s,s.noteIndex,text);
  }
  if(/^(?:done|next|mark (?:it |this )?done|complete)$/.test(cmd)){
   card.items[i].done=true;putCard();renderCard();
   return {say:prompt(s),endAfter:current(s)<0};
  }
  if(/^(?:repeat|repeat (?:the |this )?step|say that again)$/.test(cmd))return {say:prompt(s)};
  const specific=text.match(/^step\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:failed|has a problem)\b[.,:\s-]*(.*)$/i);
  const generic=text.match(/^(?:i found a problem|there(?:'s| is) a problem|add (?:a )?note)\b[.,:\s-]*(.*)$/i);
  if(specific||generic){
   const idx=specific?Thoughts.ordinal(specific[1]):i;
   if(idx<0||idx>=card.items.length)return {say:'This checklist has '+card.items.length+' steps. Which step needs a note?'};
   const words=(specific?specific[2]:generic[1]).trim();
   if(words)return record(s,idx,words);
   s.noteIndex=idx;return {say:'What happened on step '+(idx+1)+'?'};
  }
  return {say:'Say done, repeat, or I found a problem.'};
 }
 function record(s,idx,text){
  const item=card.items[idx];(item.notes||(item.notes=[])).push(text);
  delete s.noteIndex;putCard();renderCard();
  return {say:'Note saved on step '+(idx+1)+'. '+prompt(s)};
 }
 return {start,prompt,handle};
})();
