'use strict';

const ChatMemory=(()=>{
 const model=MemoryModel;
 let projectView='',form=null;
 const att=id=>'data-id="'+M.esc(id)+'"';
 function rows(projectOnly=''){
  if(!projectOnly&&thread.temporary)return [];
  const group=projectOnly||Organizer.projectOf(thread.id);
  const project=Organizer.projectMemories(group).map(m=>({...m,scope:'project'}));
  const chat=projectOnly?[]:(thread.memories||[]).map(m=>({...m,scope:'chat'}));
  return [...chat,...project].sort((a,b)=>b.updated-a.updated);
 }
 const inView=()=>rows(projectView);
 const label=scope=>scope==='chat'?'This chat':'Project';
 function group(){return projectView||Organizer.projectOf(thread.id);}
 function write(scope,items){
  const data=items.map(({scope:unused,...item})=>item);
  if(scope==='project')return Organizer.storeMemories(group(),data);
  if(thread.temporary||projectView)return false;
  const next={...thread,memories:data,updated:Date.now()};
  if(!persist(thread.id,next))return false;
  Object.assign(thread,next);threads.set(thread.id,thread);
  if(prefs.last!==thread.id){prefs.last=thread.id;remember();}
  return true;
 }
 function origin(index){
  if(projectView)return {};
  const t=thread.turns[index];
  if(!t)return {chat:thread.id,file:thread.documents?.[thread.file]?.savedId||thread.image?.shelfId||''};
  const d=thread.documents?.[t.file];
  return {chat:thread.id,index,file:t.savedOutput||d?.savedId||t.image?.shelfId||''};
 }
 function sourceThread(m){
  const t=threads.get(m.origin?.chat);
  return t&&((m.scope==='chat'&&t===thread)||(m.scope==='project'&&Organizer.projectOf(t.id)===group()))?t:null;
 }
 function detail(id){
  const m=inView().find(row=>row.id===id);if(!m){open(projectView);return;}
  const t=sourceThread(m),index=m.origin?.index;
  let source=t?button('mem-source',Number.isInteger(index)?'Open exchange in '+Organizer.label(t):'Open '+Organizer.label(t),'chat',att(id)):'';
  if(t&&m.origin.file)source+=button('fs-detail','Open related file version','clip',att(m.origin.file));
  if(!source)source='<p class="desc">'+(m.origin?.chat?'The source chat is no longer available here.':'Added in project memory.')+'</p>';
  if(m.edited)source='<p class="desc">Edited by you.</p>'+source;
  modal(m.topic,'<p class="desc">'+M.esc(label(m.scope)+(m.scope==='project'?' · '+Organizer.projectName(group()):'')+' · '+statDate(m.updated))+'</p><p class="memory-text">'+M.esc(m.text)+'</p>'+source+
   button('mem-edit','Edit memory','pen',att(id))+button('mem-forget','Forget memory','trash',att(id))+button('mem-back','All memories','back'),'memory-detail');
 }
 function open(project=''){
  projectView=project;form=null;
  if((project&&!Organizer.projectName(project))||(!project&&thread.temporary)){notice('Memory is off in temporary chats.');return;}
  const all=inView(),scopes=project?['project']:group()?['chat','project']:['chat'];
  let body='<p class="desc">Saved on this phone. Relevant memories can accompany cloud questions.</p>';
  for(const scope of scopes){
   const list=all.filter(m=>m.scope===scope);
   body+='<h3>'+M.esc(scope==='chat'?'Only this chat':Organizer.projectName(group())+' · shared')+'</h3>';
   body+=list.map(m=>'<button class="choice framed memory-row" data-action="mem-detail" '+att(m.id)+'>'+icon('note')+'<span><strong>'+M.esc(m.topic)+'</strong><small>'+M.esc(m.text)+'</small></span></button>').join('')||'<p class="desc">No saved memories yet.</p>';
  }
  modal(project?'Project memory':'Memory',body+button('mem-add','Add memory','plus','','primary'),'memory');
 }
 function editor(draft,warning=''){
  form=draft;
  let body=warning?'<p class="desc" role="status">'+M.esc(warning)+'</p>':'';
  const enableScope=!draft.id&&!projectView&&group();
  if(enableScope)body+='<label class="field-label">Remember in<select id="mem-scope"><option value="chat">Only this chat</option><option value="project">'+M.esc(Organizer.projectName(group())+' · shared with project chats')+'</option></select></label>';
  else body+='<p class="desc">'+M.esc(draft.scope==='chat'?'Only this chat':Organizer.projectName(group())+' · shared with project chats')+'</p>';
  body+='<label class="field-label">Topic<input id="mem-topic" maxlength="72" placeholder="e.g. Meeting day"></label><label class="field-label">What should Nota remember?<textarea id="mem-text" rows="4" maxlength="'+model.limit+'"></textarea></label>'+button('mem-save',draft.id?'Save change':'Save memory','check','','primary');
  modal(draft.id?'Edit memory':'Remember this',body,'memory-edit');
  if(enableScope)$('mem-scope').value=draft.scope;
  $('mem-topic').value=draft.topic||'';$('mem-text').value=draft.text||'';
 }
 function save(draft,replaceId=''){
  const {scope}=draft;
  if(scope==='project'&&!group())return {error:'Move this chat into a project to save a shared memory.'};
  const text=draft.text.trim(),topic=(draft.topic.trim()||model.subject(text)).trim();
  if(!text||text.length>model.limit||!topic)return {error:'Enter a short memory of up to '+model.limit+' characters.'};
  const items=inView().filter(m=>m.scope===scope);
  const current=items.find(m=>m.id===(draft.id||replaceId));
  if((draft.id||replaceId)&&!current)return {error:'This memory is no longer available.'};
  const same=items.find(m=>model.normalize(m.text)===model.normalize(text)&&m.id!==current?.id);
  if(same)return current?{error:'That memory is already saved here.'}:{row:same,duplicate:true};
  const conflict=items.find(m=>model.normalize(m.topic)===model.normalize(topic)&&m.id!==current?.id);
  if(conflict)return {conflict};
  const m={id:current?.id||M.id('memory'),topic,text,revision:(current?.revision||0)+1,updated:Date.now(),origin:draft.origin||current?.origin||{},edited:!!current};
  if(!write(scope,[m,...items.filter(row=>row.id!==m.id)]))return {error:'Couldn’t save this memory on your phone.'};
  return {row:{...m,scope}};
 }
 function conflictSheet(draft,m){
  form={...draft,replace:m.id};
  modal('Update this memory?','<p class="desc">'+M.esc(label(m.scope)+' · '+m.topic)+'</p><h3>Saved</h3><p class="memory-text">'+M.esc(m.text)+'</p><h3>Proposed</h3><p class="memory-text">'+M.esc(draft.text)+'</p>'+
   (draft.id?'':button('mem-replace','Replace saved memory','check','','primary'))+button('mem-adjust','Edit proposal','pen')+button('close','Keep saved memory','back'),'memory-conflict');
 }
 function submitted(draft,replaceId=''){
  const result=save(draft,replaceId);
  if(result.conflict){conflictSheet(draft,result.conflict);return;}
  if(result.error){notice(result.error);return;}
  if(draft.command){
   if(sheet)closeSheet();
   finish(draft.command,result.duplicate?'Already saved.':'Saved to '+(draft.scope==='chat'?'this chat.':'project memory.'),[result.row],draft.voice);
  }else{if(page==='chat')renderChat();detail(result.row.id);}
 }
 function refRows(refs,all){
  return (refs||[]).map(r=>all.find(m=>r.id===m.id&&r.revision===m.revision)).filter(Boolean);
 }
 function citations(t){
  if(!t.memoryRefs?.length)return '';
  const list=refRows(t.memoryRefs,rows());
  return '<details class="sources"><summary>'+icon('note')+'Memory context · '+t.memoryRefs.length+'</summary>'+
   list.map(m=>button('mem-cite',label(m.scope)+' · '+m.topic,'note',att(m.id),'source-row')).join('')+
   (list.length<t.memoryRefs.length?'<small>A memory was edited, forgotten or is outside this chat.</small>':'')+'</details>';
 }
 function finish(q,message,list=[],voice=false){
  const t={kind:'memory',question:q,reply:message,status:'ok',sources:[],memoryRefs:list.map(model.ref),spoken:voice};
  thread.turns.push(t);if(!voice)thread.draft='';
  thread.updated=Date.now();if(thread.title==='New chat')thread.title='Memory notes';
  saveThread();renderChat(true);
  return {say:message+(list.length?' '+list.slice(0,3).map(m=>m.text).join(' '):'')+(list.length>3?' The full list is in chat.':'')};
 }
 function localTurn(t,i){
  const list=refRows(t.memoryRefs,rows());
  return '<article class="turn" id="turn-'+i+'"><div class="question">'+M.esc(t.question)+'</div><div class="byline"><span class="mini-mark">N</span> Nota · Memory</div><div class="answer-text"><p>'+M.esc(t.reply)+'</p></div>'+
   list.map(m=>button('mem-cite',label(m.scope)+' · '+m.text,'note',att(m.id),'choice framed memory-row')).join('')+
   (list.length<(t.memoryRefs||[]).length?'<small>A saved entry was updated, forgotten or moved out of scope.</small>':'')+'</article>';
 }
 function command(q,voice=false){
  if(thread.rehearsal||thread.ramble)return null;
  const cmd=model.command(q);
  if(!cmd){
   if(thread.temporary||thread.mode==='search'||thread.image||thread.file||thread.attachment)return null;
   const matches=model.decisionNotes(rows(),q);
   if(!matches.length)return null;
   projectView='';
   return finish(q,matches.length===1?'Here’s the saved decision.':'I found multiple saved notes for that decision.',matches,voice);
  }
  projectView='';
  if(thread.temporary)return finish(q,'Memory is off in temporary chats.',[],voice);
  if(cmd.scope==='project'&&!group())return finish(q,'Move this chat into a project to use project memory.',[],voice);
  const all=rows(),visible=cmd.scope?all.filter(m=>m.scope===cmd.scope):all;
  if(cmd.op==='list'){
   const list=cmd.query?model.rank(visible,cmd.query).map(hit=>hit.row):visible;
   return finish(q,list.length?'Here’s what I remember.':'I don’t have a saved memory for that yet.',list,voice);
  }
  if(cmd.op==='save'){
   let index=thread.turns.length,content=cmd.text;
   if(!content){for(index=thread.turns.length-1;index>=0;index--){const t=thread.turns[index];if(!t.kind&&!t.retired&&t.status==='ok'&&t.reply){content=t.reply;break;}}}
   const source=index===thread.turns.length?{chat:thread.id,index,file:thread.documents?.[thread.file]?.savedId||thread.image?.shelfId||''}:origin(index);
   const draft={scope:cmd.scope,text:content,topic:model.subject(content),origin:source,command:q,voice};
   if(!content||content.length>model.limit){draft.text=content.slice(0,model.limit);editor(draft,'Choose the detail you want to keep.');return {};}
   const result=save(draft);
   if(result.conflict){conflictSheet(draft,result.conflict);return {};}
   if(result.error)return finish(q,result.error,[],voice);
   return finish(q,result.duplicate?'Already saved.':cmd.scope==='project'?'Saved to project memory.':'Saved to this chat.',[result.row],voice);
  }
  const last=thread.turns[thread.turns.length-1];
  const targets=cmd.query?model.rank(visible,cmd.query).map(hit=>hit.row):refRows(last?.memoryRefs,visible);
  if(cmd.implicit&&!targets.length)return null;
  if(targets.length!==1){return finish(q,targets.length?'Choose the memory you want to change.':'Open Memory and choose the entry you want to change.',targets,voice);}
  const m=targets[0];
  if(cmd.op==='edit'&&!cmd.text){editor({...m,command:q,voice});return {};}
  if(cmd.op==='forget'){
   if(cmd.query){
    form={...m,command:q,voice};
    confirmAction('Forget this memory?',label(m.scope)+' · '+m.text,'mem-remove','Forget memory');
    return {};
   }
   if(!write(m.scope,all.filter(row=>row.scope===m.scope&&row.id!==m.id)))return finish(q,'Couldn’t forget this memory. Try again.',[],voice);
   return finish(q,'Forgotten. Earlier chat messages stay in your history.',[],voice);
  }
  const draft={...m,text:cmd.text,origin:{chat:thread.id,index:thread.turns.length},command:q,voice};
  if(cmd.text.length>model.limit){editor({...draft,text:cmd.text.slice(0,model.limit)},'Choose a shorter memory.');return {};}
  const result=save(draft);
  if(result.error||result.conflict)return finish(q,result.error||'Another memory already has that topic.',[],voice);
  return finish(q,'Updated the memory.',[result.row],voice);
 }
 function prepare(payload,t,prior,intent){
  delete t.memoryRefs;
  if(thread.temporary||t.practice||t.image||intent)return;
  const selected=model.relevant(rows(),t.question,prior);
  const refs=model.attach(payload,selected);
  if(refs.length)t.memoryRefs=refs;
 }
 function handle(action,id,i){
  switch(action){
  case 'mem-open':open();break;
  case 'mem-project':open(id);break;
  case 'mem-back':open(projectView);break;
  case 'mem-cite':projectView='';detail(id);break;
  case 'mem-detail':detail(id);break;
  case 'mem-add':editor({scope:projectView?'project':'chat',text:'',topic:'',origin:origin(-1)});break;
  case 'mem-reply':{
   projectView='';const t=thread.turns[i];if(thread.temporary||!t?.reply)return;
   const text=t.reply.slice(0,model.limit);editor({scope:'chat',text,topic:model.subject(text),origin:origin(i)},t.reply.length>model.limit?'Choose the part of the reply you want to keep.':'');break;
  }
  case 'mem-source':{
   const m=inView().find(x=>x.id===id),t=m&&sourceThread(m);if(!t)break;
   const index=m.origin.index;chooseThread(t);
   requestAnimationFrame(()=>{const row=$('turn-'+index);if(row){row.scrollIntoView({block:'center'});row.classList.add('source-highlight');}});break;
  }
  case 'mem-edit':{const m=inView().find(x=>x.id===id);if(m)editor({...m});break;}
  case 'mem-save':if(form)submitted({...form,text:$('mem-text').value,topic:$('mem-topic').value,scope:$('mem-scope')?.value||form.scope});break;
  case 'mem-replace':if(form?.replace)submitted(form,form.replace);break;
  case 'mem-adjust':if(form)editor(form);break;
  case 'mem-forget':{
   const m=inView().find(x=>x.id===id);if(!m)break;
   form=m;confirmAction('Forget this memory?',m.text+'\n\nFuture replies will no longer use this entry. Earlier messages stay in history.','mem-remove','Forget memory');break;
  }
  case 'mem-remove':{
   if(!form||!write(form.scope,inView().filter(m=>m.scope===form.scope&&m.id!==form.id)))break;
   if(form.command){const request=form;form=null;closeSheet();finish(request.command,'Forgotten. Earlier chat messages stay in your history.',[],request.voice);}
   else{open(projectView);if(page==='chat')renderChat();notice('Memory forgotten.');}
   break;
  }
  }
 }
 return {command,handle,localTurn,citations,prepare};
})();
