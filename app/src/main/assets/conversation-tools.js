'use strict';
const ConversationTools = (() => {
 function append(text,kind) {
  const index=thread.turns.length;
  thread.turns.push({question:text,kind,status:'ok',spoken:true,sources:[]});
  if(thread.title==='New chat')thread.title=text.slice(0,65);
  thread.updated=Date.now();saveThread();return index;
 }
 function beginRamble() {
  if(!thread.ramble)thread.ramble={indices:[]};
  saveThread();renderChat(true);
 }
 function capture(text) {
  const index=append(text,'thought');
  thread.ramble.indices.push(index);saveThread();renderChat(true);return index;
 }
 function pin(text,index) {
  if(index<0){notice('Say a thought first, then say “Hold that thought.”');return;}
  const line=thread.turns[index],parts=Thoughts.sentences(text||line.question);
  const quote=parts[parts.length-1];
  if(!quote)return;
  const existing=cards.get(line.pinned);
  if(existing&&existing.quote===quote){notice('This thought is already on your Desk.');return;}
  const c={id:M.id('card'),type:'Note',title:quote.slice(0,76),body:quote,quote,items:[],sources:[],
   origin:thread.temporary?'':thread.id,sourceIndex:index,updated:Date.now()};
  if(!persist(c.id,c))return;
  cards.set(c.id,c);if(c.origin)Organizer.inherit(c.id,c.origin);line.pinned=c.id;saveThread();renderChat();N.pinTick();notice('Thought saved to Desk.');
 }
 function previousSpoken() {
  for(let i=thread.turns.length-1;i>=0;i--)if(thread.turns[i].spoken && thread.turns[i].kind!=='recap')return i;
  return -1;
 }
 function finishRamble() {
  const r=thread.ramble;if(!r)return '';
  const lines=r.indices.map(i=>thread.turns[i]).filter(Boolean).map(t=>t.question);
  delete thread.ramble;
  if(!lines.length){saveThread();renderChat();return 'No thoughts captured yet.';}
  const ideas=Thoughts.recap(lines);
  const reply=ideas.map((s,i)=>(i+1)+'. '+s).join('\n')+'\n\nWhich idea would you like to focus on?';
  thread.turns.push({kind:'recap',question:'My ramble',reply,ideas,status:'ok',sources:[]});
  thread.updated=Date.now();saveThread();renderChat(true);return reply;
 }
 function bookmark(){
  if(!thread.bookmark){
   const prev=thread.turns[thread.turns.length-1];
   const text=prev?(prev.kind==='recap'?prev.ideas[prev.ideas.length-1]:prev.question):thread.draft;
   const answer=prev&&prev.status==='ok'&&!prev.kind&&prev.reply?Thoughts.sentences(M.forSpeech(prev.reply))[0]||'':'';
   const thought=(text||'').trim();
   thread.bookmark={note:[thought,answer].filter(Boolean).join('\n').slice(0,1200),next:thought?'Where would you like to pick up with “'+thought.slice(0,140)+'”?':'What would you like to pick up next time?'};
   thread.updated=Date.now();saveThread();renderChat(true);
  }
  modal('Leave it here','<p class="desc">'+(thread.temporary?'This bookmark lasts for this temporary chat.':'Your bookmark will be here when you reopen this conversation.')+'</p><label class="field-label">Where I left off<textarea id="bookmark-note" rows="3" maxlength="1200"></textarea></label><label class="field-label">Next time<textarea id="bookmark-next" rows="2" maxlength="400"></textarea></label>'+button('save-bookmark','Save bookmark','check','','primary')+button('clear-bookmark','Remove bookmark','trash','','text-btn'),'bookmark');
  $('bookmark-note').value=thread.bookmark.note;$('bookmark-next').value=thread.bookmark.next;
 }
 function saveBookmark() {
  const note=$('bookmark-note').value.trim(),next=$('bookmark-next').value.trim();
  if(!note&&!next){notice('Add a thought or a next step.');return;}
  thread.bookmark={note,next};thread.updated=Date.now();saveThread();closeSheet();renderChat(true);
 }
 function footer(){
  let html='';
  if(thread.ramble)html+='<aside class="thought-block"><strong>Ramble in progress</strong><p>'+thread.ramble.indices.length+' passages captured</p>'+button('ramble-start','Continue speaking','mic','','text-btn')+button('ramble-finish','Finish ramble','check','','text-btn')+'</aside>';
  if(thread.bookmark)html+='<aside class="thought-block"><strong>Where you left off</strong><p>'+M.esc(thread.bookmark.note)+'</p><p>'+M.esc(thread.bookmark.next)+'</p>'+button('resume-bookmark','Pick this up','chat','','action-chip')+button('bookmark','Edit bookmark','pen','','text-btn')+'</aside>';
  return html;
 }
 function localTurn(t,i) {
  if(t.kind==='recap')return '<article class="turn local-turn" id="turn-'+i+'"><small>In your words</small><h3>Your ramble</h3>'+M.markdown(t.reply)+t.ideas.map((_,n)=>button('focus-idea','Explore '+(n+1),'chat','data-i="'+i+'" data-n="'+n+'"','pill')).join(' ')+'</article>';
  return '<article class="turn local-turn" id="turn-'+i+'"><small>'+ (t.pinned?'Pinned thought':'Your words')+'</small><p>'+M.esc(t.question)+'</p>'+button('pin-line','Hold that thought','desk','data-i="'+i+'"','text-btn')+'</article>';
 }
 function openSource(c){
  const original=threads.get(c.origin);
  if(!original)return;
  chooseThread(original);
  requestAnimationFrame(()=>{
   const turn=$('turn-'+c.sourceIndex);
   if(!turn)return;
   const container=turn.querySelector('.question')||turn.querySelector('p');
   let anchor=turn;
   if(container&&c.quote){
    const nodes=Array.from(container.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE);
    for(const n of nodes){
     const i=n.data.lastIndexOf(c.quote);
     if(i<0)continue;
     const range=document.createRange();range.setStart(n,i);range.setEnd(n,i+c.quote.length);
     anchor=document.createElement('mark');range.surroundContents(anchor);break;
    }
   }
   turn.classList.add('source-highlight');anchor.scrollIntoView({block:'center'});
  });
 }
 function handle(text) {
  const cmd=Thoughts.command(text);
  const pinIntent=Thoughts.pinRequest(text);
  if(pinIntent){
   const raw=pinIntent.text;
   const index=raw?(thread.ramble?capture(raw):append(raw,'thought')):previousSpoken();
   pin(raw,index);return {};
  }
  if(cmd==='leave it here'){LiveChat.end();bookmark();return {};}
  if(cmd==='let me ramble'){beginRamble();return {};}
  const opening=text.match(/^let me ramble[,.!:;\s]+(.+)$/i);
  if(opening){beginRamble();capture(opening[1]);return {};}
  if(thread.ramble){
   const ending=text.match(/^([\s\S]*?\S)[,.!;:\s]+(?:I['’]m done|I am done|finish ramble)[.!?]*$/i);
   if(ending){capture(ending[1]);return {say:finishRamble()};}
   if(/^(?:i'm done|i am done|finish ramble|done rambling)$/.test(cmd))return {say:finishRamble()};
   capture(text);return {};
  }
  if(cmd==='walk me through it'){
   LiveChat.end();
   const checklists=Array.from(cards.values()).filter(c=>c.type==='Checklist'&&c.items.some(x=>x.text.trim()&&!x.done));
   const related=checklists.filter(c=>c.origin===thread.id),candidates=related.length?related:checklists;
   if(candidates.length===1){card=candidates[0];navigate('card');Walkthrough.start();}
   else {navigate('desk');typeFilter='Checklist';renderLibrary(false);notice(candidates.length?'Open the checklist you want to walk through.':'Create a checklist with at least one unchecked step.');}
   return {};
  }
  const last=thread.turns[thread.turns.length-1];
  const focus=cmd.match(/^(?:(?:let's )?(?:focus on|explore) )?(?:idea |number |the )?(one|two|three|four|first|second|third|fourth|[1-4])(?: one| idea)?$/);
  if(last && last.kind==='recap' && focus){
   const ord=['first','second','third','fourth'].indexOf(focus[1]);
   const idea=last.ideas[ord>=0?ord:Thoughts.ordinal(focus[1])];
   if(idea){LiveChat.end();replaceDraft('Help me explore this idea: '+idea);return {};}
  }
  return null;
 }
 return {beginRamble,finishRamble,pin,handle,bookmark,saveBookmark,footer,localTurn,openSource};
})();
