'use strict';
const ChatImages = (() => {
 let feature = '', afterChoice = null;
 const valid = image => image && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(image.id);
 const photo = (image, cls) => valid(image) ? '<img class="'+cls+'" src="/chat-image/'+image.id+'" alt="Attached photo">' : '';
 function menu() {
  modal('Add attachment',button('camera','Camera','camera')+button('pick-image','Photos','image')+button('pick-file','Files','clip'),'attachments');
 }
 function pick(action) {
  closeSheet();
  if (!thread.temporary) {threads.set(thread.id,thread);saveThread();}
  if(action==='camera') N.takePhoto(thread.id,thread.temporary);
  else if(action==='pick-file') N.pickChatFile(thread.id,thread.temporary);
  else N.pickImage(thread.id,thread.temporary);
 }
 function removeUnused(images) {
  const retained=new Set();
  for (const owner of [...threads.values(),thread]) {
   if (valid(owner.image)) retained.add(owner.image.id);
   for (const t of owner.turns) if (valid(t.image)) retained.add(t.image.id);
  }
  for (const image of images) if (valid(image) && !retained.has(image.id)) N.discardImage(image.id);
 }
 function detach() {
  const previous=thread.image;
  delete thread.image;delete thread.imageMode;saveThread();removeUnused([previous]);syncComposer();
 }
 function stage(image, selection) {
  const previous=thread.image;
  ChatFiles.clear();thread.attachment='';thread.image=image;thread.imageMode=selection;
  saveThread();removeUnused([previous]);navigate('chat');$('question').focus();
 }
 function picked(target,raw) {
  let image;try {image=JSON.parse(raw);} catch (_) {return;}
  if (!valid(image)) return;
  if (target!==thread.id || thread.rehearsal) {removeUnused([image]);notice('Return to the chat and select the photo again.');return;}
  stage(image,'preferred');
 }
 function preview(index) {
  const past=Number.isInteger(index),image=past?thread.turns[index]?.image:thread.image;
  if (!valid(image)) return;
  modal('Photo',photo(image,'image-preview')+(image.shelfId?button('fs-detail','Open in Files','folder','data-id="'+M.esc(image.shelfId)+'"'):'')+(past?button('reuse-image','Ask about this photo','chat','data-i="'+index+'"','primary'):''),'image-preview');
 }
 function mode(selection) {
  if(selection==='text')return 'text';
  if(!N.cloud() || selection==='local')return 'local';
  return prefs.photoSharing==='online'?'cloud':'local';
 }
 function needsChoice(selection) {
  return N.cloud() && !['local','text'].includes(selection) && !['local','online'].includes(prefs.photoSharing);
 }
 function choose(continuation) {
  afterChoice=continuation;
  modal('Analyze photos online?', '<p class="desc">When you send, Nota can share the photo and your question for an answer. We’ll remember your choice.</p>'+
   button('photo-choice','Use online analysis','globe','data-val="online"','primary')+
   button('photo-choice','Keep photos on this phone','lock','data-val="local"'),'photo-choice');
 }
 function rememberChoice(value) {
  if(!['local','online'].includes(value))return;
  const next=sheet==='photo-choice'?afterChoice:null;
  afterChoice=null;prefs.photoSharing=value;
  if(thread.image){thread.imageMode='preferred';saveThread();}
  remember();closeSheet();syncComposer();
  if(next)next();
 }
 function settings() {
  return '<h3>Photo analysis</h3><p class="desc">Choose where Nota looks at photos you send. Online analysis uses cloud questions.</p><div class="chips">'+
   [['local','On this phone'],['online','Online']].map(([v,label])=>button('photo-setting',label,null,'data-val="'+v+'" aria-pressed="'+(prefs.photoSharing===v)+'"','pill'+(prefs.photoSharing===v?' selected':''))).join('')+'</div>'+
   '<div id="local-vision-option">'+downloadOption()+'</div>';
 }
 function downloadOption(){
  if(feature==='downloadable')return button('setup-vision','Download on-device photo analysis','down','','text-btn');
  return feature==='downloading'?'<small>Downloading on-device photo analysis…</small>':'';
 }
 function history(image, prior) {
  return prior.filter(t=>t.image?.id===image.id&&t.status==='ok'&&!t.canAskText&&!t.retired&&t.reply)
   .slice(-3).flatMap(t=>[{role:'user',content:t.question.slice(0,1000)},{role:'assistant',content:t.reply.slice(0,1000)}]);
 }
 function composer() {
  const hint=needsChoice(thread.imageMode)?'Ready to send':mode(thread.imageMode)==='local'?'Stays on this phone':mode(thread.imageMode)==='text'?'Shares text only':'Shared when you send';
  return '<div class="attached-image"><button data-action="preview-image" aria-label="View attached photo">'+photo(thread.image,'image-thumb')+'<span>Photo<small>'+hint+'</small></span></button><button class="bare" data-action="detach-image" aria-label="Remove photo">'+icon('close')+'</button></div>';
 }
 function turnPhoto(t,i) {return '<button class="turn-image" data-action="turn-image" data-i="'+i+'" aria-label="View attached photo">'+photo(t.image,'message-image')+'</button>';}
 function reuse(index,textOnly) {
  if(job){notice('Finish or stop the current reply first.');return;}
  const t=thread.turns[index];if(!valid(t?.image))return;
  stage(t.image,textOnly?'text':'preferred');
  if(textOnly){setDraft(t.question);if(N.cloud())send();else consentDialog();}
 }
 function event(name,args) {
  if(name==='imagePicked'){picked(...args);return true;}
  if(name==='imageStatus'){feature=args[0];if(sheet==='settings'&&$('local-vision-option'))$('local-vision-option').innerHTML=downloadOption();return true;}
  if(name==='sharedImage'){
   if(thread.rehearsal){
    modal('Open shared photo?', '<p class="desc">Open the photo in a regular chat. Leaving a temporary rehearsal discards that rehearsal.</p>'+button('open-shared-image','Open photo','image','','primary'));return true;
   }
   N.acceptSharedImage(thread.id,thread.temporary);return true;
  }
  return false;
 }
 return {menu,pick,preview,detach,removeUnused,event,history,composer,turnPhoto,reuse,mode,needsChoice,choose,rememberChoice,settings};
})();
