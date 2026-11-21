'use strict';
const ChatImages = (() => {
 let feature = '', cloudReady = false, showing = null;
 const valid = image => image && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(image.id);
 const photo = (image, cls) => valid(image) ? '<img class="'+cls+'" src="/chat-image/'+image.id+'" alt="Attached image">' : '';
 function menu() {
  modal('Add an attachment',button('pick-image','Photo or screenshot','image')+button('review','Text or text file','clip'));
 }
 function pick() {
  closeSheet();
  // Persist an empty draft identity so a system picker can resume after process recreation.
  if (!thread.temporary) {threads.set(thread.id,thread);saveThread();}
  N.pickImage(thread.id,thread.temporary);
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
 function picked(target,raw) {
  let image;try {image=JSON.parse(raw);} catch (_) {return;}
  if (!valid(image)) return;
  if (target!==thread.id || thread.rehearsal) {removeUnused([image]);notice('Return to the chat and select the image again.');return;}
  const previous=thread.image;
  thread.image=image;thread.imageMode='auto';thread.attachment='';saveThread();removeUnused([previous]);
  navigate('chat');syncComposer();preview();N.imageStatus();
 }
 function preview(index) {
  showing=Number.isInteger(index)?index:null;
  const image=showing===null?thread.image:thread.turns[showing]?.image;
  if (!valid(image)) return;
  modal('Image preview',photo(image,'image-preview')+'<div id="image-settings"></div>','image-preview');
  renderOptions();
 }
 function renderOptions(){
  if(sheet!=='image-preview')return;
  const edit=showing===null,mode=thread.imageMode||'auto';
  let body='';
  if(edit){
   body='<p class="desc">'+(mode==='cloud'?'Sending shares this image, your question and recent image replies with Cloudflare.':mode==='text'?'Sending shares recognized text, text positions, your question and recent image replies with the writing service.':mode==='auto'&&N.cloud()?'Nota tries on-device vision first. If it is unavailable, Send shares the recognized text, positions, your question and recent image replies with the writing service. The picture stays on your phone.':'Nota tries on-device vision and can read screenshot labels locally.')+'</p>'+
    button('close','Ask about this image','chat','','primary');
   if(mode!=='local')body+=button('image-mode','Keep this analysis on my device','eye','data-val="local"');
   if(mode!=='text')body+=button('image-mode','Ask using screenshot text','pen','data-val="text"');
   if(cloudReady&&N.cloud()&&mode!=='cloud')body+=button('image-mode','Send full image to Cloudflare','globe','data-val="cloud"');
   if(feature==='downloadable')body+=button('setup-vision','Download on-device vision','down');
   if(feature==='downloading')body+='<p class="desc" role="status">Android is downloading on-device vision.</p>';
   body+=button('pick-image','Replace image','image')+button('detach-image','Remove from composer','close');
  }else body=button('reuse-image','Ask about this image','chat','data-i="'+showing+'"','primary');
  $('image-settings').innerHTML=body;
 }
 function history(image, prior) {
  return prior.filter(t=>t.image?.id===image.id&&t.status==='ok'&&!t.canAskText&&!t.retired&&t.reply)
   .slice(-3).flatMap(t=>[{role:'user',content:t.question.slice(0,1000)},{role:'assistant',content:t.reply.slice(0,1000)}]);
 }
 function composer() {
  return '<div class="attached-image"><button data-action="preview-image" aria-label="Review attached image">'+photo(thread.image,'image-thumb')+'<span>Image attached<small>Used for follow-ups</small></span></button><button class="bare" data-action="detach-image" aria-label="Remove image from composer">'+icon('close')+'</button></div>';
 }
 function turnPhoto(t,i) {return '<button class="turn-image" data-action="turn-image" data-i="'+i+'" aria-label="View attached image">'+photo(t.image,'message-image')+'</button>';}
 function switchMode(mode) {
  if(!['local','text','cloud'].includes(mode))return;
  if (mode!=='local'&&!N.cloud()) {thread.imageMode=mode;saveThread();consentDialog();return;}
  thread.imageMode=mode;saveThread();closeSheet();syncComposer();$('question').focus();
 }
 function reuse(index,textOnly) {
  if(job){notice('Finish or stop the current reply first.');return;}
  const t=thread.turns[index];if(!valid(t?.image))return;
  const previous=thread.image;
  thread.image=t.image;thread.imageMode=textOnly?'text':'auto';thread.attachment='';
  saveThread();removeUnused([previous]);closeSheet();syncComposer();
  if(textOnly){setDraft(t.question);if(N.cloud())send();else consentDialog();}
  else $('question').focus();
 }
 function event(name,args) {
  if(name==='imagePicked'){picked(...args);return true;}
  if(name==='imageStatus'){feature=args[0];renderOptions();return true;}
  if(name==='cloudVisionReady'){cloudReady=true;renderOptions();return true;}
  if(name==='sharedImage'){
   if(thread.rehearsal){
    // Keep the current temporary rehearsal available until the user accepts.
    modal('Open shared image?', '<p class="desc">Open a regular image chat. Leaving a temporary rehearsal discards that rehearsal.</p>'+button('open-shared-image','Open image chat','image','','primary'));return true;
   }
   N.acceptSharedImage(thread.id,thread.temporary);return true;
  }
  return false;
 }
 return {menu,pick,preview,detach,removeUnused,event,history,composer,turnPhoto,switchMode,reuse};
})();
