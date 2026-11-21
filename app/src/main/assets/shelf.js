'use strict';

const Shelf=(()=>{
 const jobs=new Map();
 let selected='',filter='',editor=null,comparison=null,output=null,migrating=false,preparing=null;
 const att=id=>'data-id="'+M.esc(id)+'"';
 const choice=(action,label,glyph,id='')=>button('fs-'+action,label,glyph,att(id));
 const primary=(action,label)=>button('fs-'+action,label,'check','','primary');
 const qualified=f=>f.name+' · v'+f.num;
 const safeName=s=>String(s||'Nota file').replace(/[\\/<>:"|?*\u0000-\u001f]/g,' ').trim().slice(0,100)||'Nota file';
 function catalog(){
  if(typeof N.savedFiles!=='function')return [];
  const rows=JSON.parse(N.savedFiles());
  if(!Array.isArray(rows))throw Error('Couldn’t open saved files.');
  return rows;
 }
 function work(action,args){
  const token=M.id('file-work');
  return new Promise((resolve,reject)=>{
   jobs.set(token,{resolve,reject});
   try{N.fileWork(token,action,JSON.stringify(args));}catch(err){jobs.delete(token);reject(err);}
  });
 }
 function event(token,status,value){
  const job=jobs.get(token);if(!job)return;
  jobs.delete(token);
  if(status==='ok'){try{job.resolve(JSON.parse(value));}catch(_){job.reject(Error('Couldn’t read the file.'));}}
  else job.reject(Error(value));
 }
 function fail(e){notice(e.message||'Couldn’t open this file.');}
 const details=id=>work('info',{id});
 function doc(f){return {name:qualified(f),body:f.body,detail:f.detail,savedId:f.id};}
 function stage(data){ChatFiles.picked(thread.id,JSON.stringify(data));}
 function legacyDoc(d){return d&&!d.savedId&&!d.editTarget&&!d.comparison&&typeof d.body==='string';}
 async function migrate(){
  if(migrating)return;
  migrating=true;
  try{
   for(const t of threads.values()){
    if(t.temporary)continue;
    for(const image of [t.image,...t.turns.map(turn=>turn.image)]){
     if(!image?.id||image.shelfId)continue;
     try{
      const f=await work('legacyPhoto',{key:image.id,origin:t.id});
      if(threads.get(t.id)===t){image.shelfId=f.id;saveThread(t);}
     }catch(e){if(!/missing|again|such file/i.test(e.message))throw e;}
    }
    for(const [key,d] of Object.entries(t.documents||{})){
     if(!legacyDoc(d))continue;
     const f=await work('legacy',{key,name:safeName(d.name)+'.preview.md',text:d.body,origin:t.id});
     if(threads.get(t.id)===t && t.documents?.[key]===d){d.savedId=f.id;saveThread(t);}
    }
   }
   if(page==='files')listRows();
  }catch(e){fail(e);}finally{migrating=false;}
 }
 function row(f,action='detail',label=f.name){
  const origin=threads.get(f.origin)||cards.get(f.origin);
  return '<div class="entry org-row"><button data-action="fs-'+action+'" '+att(f.id)+'><span class="tile-icon '+(f.kind==='photo'?'lavender':'clay')+'">'+icon(f.kind==='photo'?'image':f.kind==='zip'?'folder':'note')+'</span><span><strong>'+M.esc(label)+'</strong><small>v'+f.num+' · '+M.esc(f.detail)+(origin?' · '+M.esc(Organizer.label(origin)):'')+' · '+statDate(f.created)+'</small></span></button></div>';
 }
 function latest(){
  const groups=new Map();
  for(const f of catalog())if(!groups.has(f.family)||groups.get(f.family).num<f.num)groups.set(f.family,f);
  return [...groups.values()].sort((a,b)=>b.created-a.created);
 }
 function searchDrawer(q){return latest().filter(f=>f.name.toLocaleLowerCase().includes(q)).map(f=>row(f)).join('');}
 function listRows(){
  const el=$('shelf-list');if(!el)return;
  const rows=latest().filter(f=>f.name.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()));
  el.innerHTML=rows.map(f=>row(f)).join('')||(filter?'<p class="desc">No matching files.</p>':'<div class="empty-state"><span class="empty-glyph">'+icon('folder')+'</span><h2>Your files live here</h2><p>Upload a file or save a chat reply. You can use it again in another chat.</p></div>');
 }
 function render(){
  $('main').innerHTML='<div class="library"><div class="page-title"><h1>Files</h1>'+button('fs-upload','Upload','plus','','action-chip')+'</div><label class="search-box">'+icon('search')+'<input type="search" id="shelf-search" placeholder="Find a file" aria-label="Find a file"></label><div id="shelf-list"></div></div>';
  $('shelf-search').value=filter;
  try{listRows();}catch(e){fail(e);}
 }
 function open(){filter='';navigate('files');migrate();}
 function changed(){if(page==='files')listRows();}
 async function detail(id){
  const f=await details(id);selected=id;
  const versions=catalog().filter(x=>x.family===f.family);
  let body='<p class="desc">'+M.esc(f.detail)+' · Version '+f.num+(f.parent?' · Based on v'+(versions.find(v=>v.id===f.parent)?.num||'?'):'')+'</p>'+
   choice('use','Use in this chat',f.kind==='photo'?'image':'chat',id)+choice('new','Use in a new chat','new',id);
  if(f.kind!=='photo')body+=choice('revise','Revise with Nota','pen',id)+choice('compare','Compare files or versions','list',id)+choice('chat-compare','Compare with a saved chat','chat',id);
  body+=choice('download','Download this version','down',id);
  if(versions.length>1)body+='<h3>Versions</h3>'+versions.map(v=>button('fs-detail','v'+v.num+' · '+statDate(v.created),v.id===id?'check':'history',att(v.id))).join('');
  if(threads.has(f.origin))body+=choice('source','Open source chat','chat',f.origin);
  if(cards.has(f.origin))body+=choice('source','Open source card','note',f.origin);
  if(f.kind!=='photo')body+='<details class="file-fold"><summary>Preview text</summary><pre class="file-preview">'+M.esc(f.body)+'</pre></details>';
  body+=choice('remove','Delete saved file','trash',id);
  modal(f.name,body,'saved-file');
 }
 function inChat(fresh,fn){
  const start=()=>{if(fresh||thread.rehearsal)chooseThread(M.newThread());fn();};
  if(fresh||thread.rehearsal)Organizer.confirmSwitch(start);else start();
 }
 async function use(id,fresh){
  const f=await details(id);
  inChat(fresh,()=>{
   if(f.kind==='photo'){
    const owner=thread;
    work('photo',{id,temporary:owner.temporary}).then(image=>{
     if(thread===owner)ChatImages.event('imagePicked',[owner.id,JSON.stringify(image)]);else N.discardImage(image.id);
    }).catch(fail);
   }else stage(doc(f));
  });
 }
 function fileMenu(){
  if(!catalog().length){ChatImages.pick('pick-file');return;}
  modal('Attach a file',choice('device','Browse phone','clip')+choice('open','Saved files','folder'),'file-source');
 }
 function editRequest(question){
  return /^(?:(?:please|can you|could you|would you|please can you)\s+)*(?:edit|revise|rewrite|update|replace|change|rename|append|insert|add|remove|correct|shorten|expand|translate)\b/i.test(question.trim());
 }
 async function pickMember(id,instruction='',auto=false,replyIndex=null){
  const owner=thread,files=await work('members',{id});
  if(thread!==owner)return;
  if(!files.members.length){notice('This archive has no editable text entries.');return;}
  editor={id,owner:thread.id,paths:files.members,instruction,auto,replyIndex};
  if(files.members.length===1){await prepare(0);return;}
  modal('Choose a file to revise',files.members.map((p,i)=>choice('member',p,'note',String(i))).join(''),'file-members');
 }
 async function prepare(index){
  const e=editor;if(!e||thread.id!==e.owner)return;
  const path=e.paths[index],f=await details(e.id),source=await work('read',{id:e.id,path});
  if(thread.id!==e.owner||editor!==e)return;
  if(e.replyIndex!==null){review(e.replyIndex,true,{id:f.id,path});return;}
  const begin=()=>{
   stage({name:(path||f.name)+' · v'+f.num,detail:'Editing a copy',body:source.text,editTarget:{id:f.id,path,sourceKey:thread.documents?.[thread.file]?.savedId===f.id?thread.file:''},savedId:f.id});
   if(e.instruction){setDraft(e.instruction);if(e.auto)send();}
   else notice('Describe the change you want to make.');
  };
  if(thread.rehearsal)inChat(true,begin);else begin();
 }
 function clean(text){
  const whole=String(text).match(/^\s*~~~(?:markdown|md|text)?\s*\n([\s\S]*)\n~~~\s*$/i)||String(text).match(/^\s*\x60\x60\x60(?:markdown|md|text)?[ \t]*\n([\s\S]*)\n\x60\x60\x60\s*$/i);
  return whole?whole[1]:String(text);
 }
 function review(i,asRevision,chosen=null){
  const t=thread.turns[i],source=thread.documents?.[t?.file];
  if(!t?.reply)return;
  if(asRevision&&!chosen&&!source?.editTarget){notice('Choose a saved file to revise.');return;}
  output={owner:thread,t,i,base:asRevision?(chosen||source.editTarget):null};
  const title=asRevision?'Review new version':'Save reply as a file';
  const name=asRevision?'<p class="desc">'+M.esc(source.name)+' · The original version stays in Files.</p>':'<label class="field-label">File name<input id="shelf-name" maxlength="105"></label>';
  modal(title,name+'<label class="field-label">File contents<textarea id="shelf-output" rows="9"></textarea></label>'+primary('commit',asRevision?'Save new version':'Save to Files'),'shelf-review');
  $('shelf-output').value=clean(t.reply);
  if($('shelf-name'))$('shelf-name').value=filename(t.question);
 }
 function filename(q){
  const match=q.match(/[\w.-]+\.md\b/i);
  return match?match[0]:safeName(q.slice(0,65))+'.md';
 }
 async function commit(el){
  const e=output;if(!e||e.owner!==thread)return;
  const value=$('shelf-output').value;
  let name=e.base?'':safeName($('shelf-name').value);
  if(!e.base&&!/\.md$/i.test(name))name+='.md';
  if(e.base&&value.length>12000){notice('This edit exceeds 12,000 characters.');return;}
  el.disabled=true;
  try{
   const args={text:value,origin:e.owner.temporary?'':e.owner.id};
   const f=e.base?await work('revise',{...args,id:e.base.id,path:e.base.path}):await work('save',{...args,name});
   e.t.savedOutput=f.id;if(threads.get(e.owner.id)===e.owner)saveThread(e.owner);
   if(sheet==='shelf-review'&&e.owner===thread&&e===output){
    closeSheet();if(e.base)stage(doc(f));else if(page==='chat')renderChat();
   }
   notice('Saved '+qualified(f)+' to Files.');
  }finally{el.disabled=false;}
 }
 function wantsFile(q){
  return /^(?:(?:please|can you|could you|would you)\s+)*(?:create|make|generate|write|give me|prepare|export|download|save)\b.{0,200}\b(?:downloadable (?:file|copy)|markdown file|markdown document|[\w.-]+\.md)\b/i.test(q);
 }
 function completed(owner,t){
  if(!t.makeFile||owner.temporary||t.status!=='ok'||t.unavailable||t.savedOutput)return;
  work('artifact',{key:t.makeFile,name:filename(t.question),text:clean(t.reply),origin:owner.id}).then(f=>{
   t.savedOutput=f.id;if(threads.has(owner.id))saveThread(owner);
   if(page==='chat'&&thread===owner)renderChat();else changed();
  }).catch(fail);
 }
 function restoreOutputs(){
  for(const owner of threads.values())for(const t of owner.turns){
   if(t.makeFile&&!t.savedOutput&&t.status==='ok'&&!t.retired)completed(owner,t);
  }
 }
 function replyAction(t,i){
  if(t.savedOutput)return button('fs-detail','Open saved file','folder',att(t.savedOutput),'action-chip')+button('fs-download','Download','down',att(t.savedOutput),'text-btn');
  if(thread.documents?.[t.file]?.editTarget)return button('fs-review','Review and save version','pen',att(String(i)),'action-chip');
  if(t.makeFile)return button('fs-save-reply','Save to Files','down',att(String(i)),'action-chip');
  return '';
 }
 async function exportItem(it,text){
  const f=await work('export',{name:safeName(it.title)+'.md',text,origin:it.id});
  N.downloadVersion(f.id);notice('Copy saved to Files.');changed();
 }
 function compareMenu(id){
  selected=id;
  const files=catalog().filter(f=>f.id!==id&&f.kind!=='photo');
  const base=catalog().find(f=>f.id===id);
  files.sort((a,b)=>Number(b.family===base.family)-Number(a.family===base.family)||b.created-a.created);
  modal('Compare '+qualified(base),files.map(f=>row(f,'pair',f.name)).join('')||'<p class="desc">Add another file or save a revision first.</p>','shelf-compare');
 }
 async function pair(left,right){
  let a=await details(left),b=await details(right);
  if(a.family===b.family&&a.num>b.num)[a,b]=[b,a];
  const result=await work('compare',{id:a.id,other:b.id});
  showComparison(qualified(a),qualified(b),result.body);
 }
 function showComparison(a,b,text){
  comparison={comparison:true,name:'A: '+a+' / B: '+b,detail:'Comparison',body:'A: '+a+'\nB: '+b+'\n\n'+text};
  modal('Compare in chat','<p class="desc">'+M.esc(a)+'<br>'+M.esc(b)+'</p>'+choice('use-comparison','Use in this chat','chat')+choice('new-comparison','Use in a new chat','new')+
   '<details class="file-fold"><summary>Preview comparison</summary><pre class="file-preview">'+M.esc(comparison.body)+'</pre></details>','shelf-comparison');
 }
 function chatMenu(id){
  selected=id;
  const saved=[...threads.values()].filter(t=>!t.temporary&&t.turns.some(row=>!row.retired&&!row.phone&&!row.kind&&row.status==='ok')).sort((a,b)=>b.updated-a.updated);
  modal('Choose a chat',saved.map(t=>choice('chat-pair',Organizer.label(t),'chat',t.id)).join('')||'<p class="desc">Save a chat with a completed reply first.</p>');
 }
 async function chatPair(id){
  const t=threads.get(id),f=await details(selected);if(!t)return;
  const messages=t.turns.filter(row=>!row.retired&&!row.phone&&!row.kind&&row.status==='ok').slice(-5)
   .map(row=>'User: '+row.question.slice(0,420)+'\nNota: '+row.reply.slice(0,650)).join('\n\n');
  showComparison(qualified(f),Organizer.label(t),'File preview:\n'+f.body.slice(0,5400)+'\n\nRecent conversation excerpts:\n'+messages);
 }
 function references(q){
  if(!/\.(?:zip|md|markdown|txt|csv|json|log|jpg)\b/i.test(q))return false;
  const lower=q.toLocaleLowerCase(),matches=catalog().filter(f=>lower.includes(f.name.toLocaleLowerCase()));
  if(!matches.length)return false;
  const download=/^(?:(?:please|can i|can you|could you)\s+)*download\b/i.test(q.trim());
  const numbers=[...q.matchAll(/\bv(?:ersion\s*|\s*)(\d+)\b/gi)].map(m=>Number(m[1]));
  const versions=matches.filter(f=>!numbers.length||numbers.includes(f.num));
  if(!versions.length){notice('That version could not be found in Files.');return true;}
  if(versions.length===2&&/\bcompar(?:e|ison)|\bdiff(?:erence)?\b/i.test(q)){pair(versions[0].id,versions[1].id).catch(fail);return true;}
  if(download){modal('Download a version',versions.map(f=>row(f,'download',f.name)).join(''));return true;}
  modal('Use a saved file?',versions.map(f=>row(f,'use',f.name)).join('')+'<p class="desc">Choose a version to attach, then send your question.</p>'+button('fs-without','Send without a file','chat'),'file-reference');
  return true;
 }
 function intercept(q){
  if(thread.rehearsal||thread.image||thread.attachment)return false;
  const active=thread.documents?.[thread.file];
  if(!active)return references(q);
  if(active.savedId&&/^(?:(?:please|can i|can you|could you)\s+)*download (?:it|this(?: file| version)?|the (?:original|file|archive))[?.!]*$/i.test(q.trim())){
   N.downloadVersion(active.savedId);return true;
  }
  if(active.savedId&&!active.editTarget&&editRequest(q)){
   if(preparing===thread.id)return true;
   preparing=thread.id;pickMember(active.savedId,q,true).catch(fail).finally(()=>{preparing=null;});return true;
  }
  if(active.savedId&&!active.comparison&&/\bcompare\b/i.test(q)&&/\bv(?:ersion\s*)?\d+/i.test(q)){
   const meta=catalog().find(f=>f.id===active.savedId);if(!meta)return false;
   const nums=[...q.matchAll(/\bv(?:ersion\s*)?(\d+)/gi)].map(m=>Number(m[1]));
   const pairIds=[...new Set(nums.map(n=>catalog().find(f=>f.family===meta.family&&f.num===n)?.id))];
   if(pairIds.length===1&&pairIds[0]!==meta.id)pairIds.push(meta.id);
   if(pairIds.length===2&&pairIds.every(Boolean)){pair(pairIds[0],pairIds[1]).catch(fail);return true;}
  }
  return false;
 }
 async function handle(action,id,el){
  switch(action){
   case 'open':open();break;
   case 'upload':N.pickChatFile('@files',false);break;
   case 'device':ChatImages.pick('pick-file');break;
   case 'detail':await detail(id);break;
   case 'source':Organizer.openItem(id);break;
   case 'download':N.downloadVersion(id);break;
   case 'use':case 'new':await use(id,action==='new');break;
   case 'revise':await pickMember(id);break;
   case 'member':await prepare(Number(id));break;
   case 'revise-reply':{const i=Number(id),d=thread.documents?.[thread.turns[i]?.file];if(d?.savedId)await pickMember(d.savedId,'',false,i);break;}
   case 'review':review(Number(id),true);break;
   case 'save-reply':review(Number(id),false);break;
   case 'commit':await commit(el);break;
   case 'compare':compareMenu(id);break;
   case 'pair':await pair(selected,id);break;
   case 'chat-compare':chatMenu(id);break;
   case 'chat-pair':await chatPair(id);break;
   case 'use-comparison':case 'new-comparison':{
    const data=comparison;if(data)inChat(action==='new-comparison',()=>{
     stage(data);if(!thread.draft.trim())setDraft('Compare these and explain what changed or where they differ.');
    });break;
   }
   case 'without':closeSheet();send(true);break;
   case 'remove':selected=id;confirmAction('Delete this file and its versions?','Existing chat excerpts and copies downloaded to your phone will remain.','fs-delete','Delete from Files');break;
   case 'delete':await work('delete',{id:selected});closeSheet();open();break;
  }
 }
 function search(text){filter=text;listRows();}
 return {event,doc,render,searchDrawer,changed,fileMenu,search,intercept,wantsFile,completed,restoreOutputs,replyAction,exportItem,handle,fail};
})();
