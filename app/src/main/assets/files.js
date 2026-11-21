'use strict';
const ChatFiles = (() => {
 function clear(){
  const old=thread.file;
  delete thread.file;
  if(old && !thread.turns.some(t=>t.file===old))delete thread.documents[old];
 }
 function picked(target,raw){
  if(target!==thread.id||thread.rehearsal){notice('Return to the chat and choose the file again.');return;}
  let doc;try{doc=JSON.parse(raw);}catch(_){return;}
  if(typeof doc.body!=='string'||!doc.body.trim()||typeof doc.name!=='string')return;
  if(thread.image)ChatImages.detach();
  clear();thread.attachment='';
  if(!thread.documents)thread.documents={};
  const id=M.id('file');thread.documents[id]=doc;thread.file=id;
  saveThread();navigate('chat');$('question').focus();
 }
 function composer(doc){
  return '<div class="attached-image attached-file"><button data-action="preview-file">'+icon('note')+'<span>'+M.esc(doc.name)+'<small>'+M.esc(doc.detail)+' · Shares text on send</small></span></button><button class="bare" data-action="detach-file" aria-label="Remove file">'+icon('close')+'</button></div>';
 }
 function preview(index){
  const past=Number.isInteger(index),id=past?thread.turns[index]?.file:thread.file,doc=thread.documents?.[id];
  if(!doc)return;
  modal(doc.name,'<p class="desc">'+M.esc(doc.detail)+' · Only the text below is shared when you send.</p><pre class="file-preview">'+M.esc(doc.body)+'</pre>'+
   (past?button('reuse-file','Ask about this file','chat','data-i="'+index+'"','primary'):''),'file-preview');
 }
 function reuse(index){
  const id=thread.turns[index]?.file;if(!thread.documents?.[id])return;
  if(thread.image)ChatImages.detach();
  clear();thread.file=id;thread.attachment='';saveThread();closeSheet();syncComposer();$('question').focus();
 }
 function branch(original,child,selected){
  const ids=new Set(child.turns.map(t=>t.file).filter(Boolean));
  if(selected){ids.add(selected);child.file=selected;}
  if(ids.size)child.documents=Object.fromEntries([...ids].filter(id=>original.documents?.[id]).map(id=>[id,original.documents[id]]));
 }
 return {clear,picked,composer,preview,reuse,branch};
})();
