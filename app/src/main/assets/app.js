'use strict';
const M=NotaModel, N=window.Nota, $=id=>document.getElementById(id);
const records=JSON.parse(N.records()), prefs=records.prefs||{appearance:'system'};
const threads=new Map(),cards=new Map();
Organizer.load(records.organizer);
for(const [key,value] of Object.entries(records)){
 if(key.startsWith('thread-')&&!value.temporary) threads.set(key,value);
 if(key.startsWith('card-')) cards.set(key,value);
}
let thread=threads.get(prefs.last)||M.newThread(), page='chat', card=null, query='', typeFilter='All', job=null, editIndex=-1, lastFocus=null;
let messageTimer, draftTimer, editorTimer, editorSave, attachmentDraft='', sheet='', sheetTurn=-1;
const starters=[
 {icon:'compass',title:'Explore a topic',sub:'Look something up',tone:'sage',ideas:['Why do some leaves turn red in autumn?','Find a recent NASA mission update and cite the source.','Explain e-ink displays in plain English.']},
 {icon:'pen',title:'Shape a draft',sub:'Find the right words',tone:'clay',ideas:['Help me write a thank-you note that sounds like me.','Give me three opening lines for a short mystery.','Help me make a rough paragraph clearer.']},
 {icon:'list',title:'Make a plan',sub:'Work out the steps',tone:'lavender',ideas:['Make a three-item checklist for packing a sketchbook for a trip.','Plan a relaxed Saturday afternoon for a family.','Help me break a weekend project into small steps.']}
];
function persist(key,value) {
 const ok=N.record(key,value===null?'':JSON.stringify(value));
 if(!ok) notice('Device storage is full. Changes may only last until you close the app.');
 return ok;
}
function remember(){persist('prefs',prefs);}
function saveThread(t=thread){
 if(t.temporary)return;
 if(!t.turns.length&&!t.draft.trim()&&!t.attachment&&!t.file&&!t.image&&!t.bookmark&&!t.ramble&&!t.rehearsal && !threads.has(t.id))return;
 threads.set(t.id,t);persist(t.id,t);
 if(t===thread && prefs.last!==t.id){prefs.last=t.id;remember();}
}
for(const t of threads.values()){
 let changed=false;
 for(const v of t.turns){if(v.status==='waiting'){v.status='error';v.error='The app closed before this reply arrived.';changed=true;}}
 if(changed)persist(t.id,t);
}
function flush(){clearTimeout(draftTimer);if(page==='chat')saveThread();if(editorSave){clearTimeout(editorTimer);editorSave();editorSave=null;}}
function notice(text){$('notice').textContent=text;$('notice').hidden=false;clearTimeout(messageTimer);messageTimer=setTimeout(()=>$('notice').hidden=true,3500);}
function safeLabel(s){return M.esc(s);}
function button(action,label,glyph,extra='',cls='choice'){return '<button class="'+cls+'" data-action="'+action+'" '+extra+'>'+ (glyph?icon(glyph):'')+'<span>'+safeLabel(label)+'</span></button>';}
function statDate(stamp){return new Date(stamp).toLocaleDateString(undefined,{month:'short',day:'numeric'});}
function applyTheme(){
 const isDark=prefs.appearance==='dark'||(prefs.appearance!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);
 document.documentElement.classList.toggle('night',isDark);N.theme(isDark);
}
const schemeQuery=matchMedia('(prefers-color-scheme: dark)');
if(schemeQuery.addEventListener)schemeQuery.addEventListener('change',applyTheme);else schemeQuery.addListener(applyTheme);
function modal(title,body,kind){
 stopPreview();
 if(LiveChat.active())LiveChat.end();
 if(sheet==='revision'&&kind!=='revision')Revision.close();
 if(!sheet)lastFocus=document.activeElement;sheet=kind||title;
 $('dialog').dataset.kind=sheet;
 $('organizer-menu').setAttribute('aria-expanded',String(sheet==='drawer'));
 $('dialog').innerHTML='<div class="dialog-head"><h2 id="dialog-title">'+M.esc(title)+'</h2><button aria-label="Close dialog" class="icon-btn" data-action="close">'+icon('close')+'</button></div>'+body;
 $('overlay').hidden=false;$('app').setAttribute('aria-hidden','true');
 $('dialog').querySelector(kind==='attachments'?'[data-action=camera]':'button').focus();
}
function closeSheet(){$('organizer-menu').setAttribute('aria-expanded','false');if(sheet==='revision')Revision.close();stopPreview();sheet='';$('overlay').hidden=true;$('app').removeAttribute('aria-hidden');if(lastFocus && document.contains(lastFocus))lastFocus.focus();lastFocus=null;}
function confirmAction(title,desc,action,label){modal(title,'<p class="desc">'+M.esc(desc)+'</p>'+button(action,label,null,'','primary'));}
let previewToken='';
function voiceRate(){return [75,80,85,90,95,100,105,110].includes(prefs.voiceRate)?prefs.voiceRate:90;}
function applyVoice(){N.setVoice(prefs.voice==='system',voiceRate());}
function stopPreview(){
 if(!previewToken)return;
 previewToken='';N.silence();
}
function previewVoice(){
 if(previewToken){stopPreview();showSettings();return;}
 previewToken=M.id('preview');
 const target=$('voice-preview-label');
 target.textContent='Preparing voice… Tap to stop';
 N.previewVoice(previewToken);
}
let phoneStep=0;
const stepIds=['weather','usage','voice'];
function phoneSetup(step=0){
 phoneStep=Math.max(0,Math.min(2,step));
 const state=JSON.parse(N.phoneStatus());
 let content='';
 const choice=(key,label,glyph='sliders')=>button('phone-config',label,glyph,'data-val="'+key+'"','choice framed');
 if(phoneStep===0){
  content='<h3>Local weather</h3><p class="desc">Ask “What’s the weather where I’m at?” Nota can use your approximate area while open, or a city you choose. Weather lookups send a rounded position to MET Norway. Android looks up typed places.</p>'+
   choice('weather',state.weather?'Weather lookups on · turn off':'Enable weather lookups',state.weather?'check':'globe')+
   choice('follow',state.follow?'Approximate location on · turn off':'Use approximate location',state.follow?'check':'compass')+
   (!state.locationService?choice('locationSettings','Open phone location settings'):'')+
   '<label for="weather-city">Fallback city or ZIP</label><input id="weather-city" class="phone-input" maxlength="90" value="'+M.esc(state.city||'')+'" placeholder="City and state, or ZIP code">'+
   choice('city','Save place','check')+choice('info','Open app info');
 }else if(phoneStep===1){
  content='<h3>Apps and phone settings</h3><p class="desc">Try “Open Audible,” “Open Wi-Fi settings,” or “How much storage do I have left?” Nota finds a shortcut you can tap.</p>'+
   '<h3>Recent apps</h3><p class="desc">Optional Usage Access lets Nota answer “Which apps did I use recently?” App names and usage history stay on this phone.</p>'+
   choice('usage',state.usage?'Usage Access on · manage':'Open Usage Access',state.usage?'check':'history')+
   '<p class="desc">If Android says access is restricted, open App info and check its menu for “Allow restricted settings.” Then return to Usage Access.</p>'+choice('info','Open app info');
 }else{
  content='<h3>Microphone</h3><p class="desc">Give Nota microphone access to use Live voice. Android handles speech recognition.</p>'+
   choice(state.mic?'info':'mic',state.mic?'Microphone allowed · manage':'Allow microphone',state.mic?'check':'mic')+
   '<h3>Cloud questions</h3><p class="desc">When you send an AI question, Nota shares your message and recent AI exchanges with the Nth Nota service. Web searches may share search terms or links. Phone lookups work separately.</p>'+
   choice('cloud',N.cloud()?'Cloud questions on · turn off':'Allow cloud questions',N.cloud()?'check':'globe');
 }
 modal('Phone setup',content+'<div class="phone-nav">'+button(phoneStep?'phone-prev':'phone-finish',phoneStep?'Back':'Skip setup',null,'','pill')+
 button(phoneStep===2?'phone-finish':'phone-next',phoneStep===2?'Finish':'Next',null,'','primary')+'</div>','phone');
}
function phoneActions(t,i){
 const choices=(t.actions||[]).map((a,n)=>button('phone-action',a.label,a.type==='setup'?'sliders':'sendout','data-i="'+i+'" data-n="'+n+'"','choice framed')).join('');
 const canRetry=t.retryable||(t.actions||[]).some(a=>a.type==='setup');
 return choices+(canRetry?button('retry','Retry this question','arrow','data-i="'+i+'"','text-btn'):'');
}
function showSettings(){
 modal('Settings',button('phone-setup','Phone setup','sliders','','choice framed')+'<h3>Cloud questions</h3><p class="desc">When you send, your question and recent replies go to Nth Nota’s service. Search terms and requested links can go to its search and page providers. Attached text goes to the writing service when you send it.</p>'+
 button('cloud',N.cloud()?'Cloud questions on':'Cloud questions off',N.cloud()?'check':'lock','','choice framed')+ChatImages.settings()+
 '<h3>Appearance</h3><div class="chips">'+['system','light','dark'].map(k=>button('theme',k[0].toUpperCase()+k.slice(1),null,'data-val="'+k+'" aria-pressed="'+(prefs.appearance===k)+'"','pill'+(prefs.appearance===k?' selected':''))).join('')+'</div>'+
 '<h3>Speaking voice</h3><div class="chips">'+[['heart','Kokoro · Heart'],['system','Android voice']].map(([key,name])=>{const active=(prefs.voice||'heart')===key;return button('set-voice',name,null,'data-val="'+key+'" aria-pressed="'+active+'"','pill'+(active?' selected':''));}).join('')+'</div>'+
 '<p class="desc">'+(prefs.voice==='system'?'Uses your Android speech engine.':'Heart speaks American English and comes with Nota. It works offline.')+'</p>'+
 '<label class="pace-label" for="voice-pace">Speaking pace <output id="pace-value" for="voice-pace">'+voiceRate()+'%</output></label>'+
 '<input type="range" id="voice-pace" aria-label="Speaking pace" min="75" max="110" step="5" value="'+voiceRate()+'" aria-valuetext="'+voiceRate()+' percent">'+
 '<button class="choice framed" data-action="preview-voice">'+icon('sound')+'<span id="voice-preview-label" aria-live="polite">Preview voice</span></button>'+
 '<h3>On this device</h3><p class="desc">Chats, drafts and Desk cards are stored here. Temporary chats stay in memory. Android handles microphone input through its speech service.</p><p class="version">Nth Nota AI · 0.10.0</p>','settings');
}
function consentDialog(){
 modal('Allow cloud questions?','<p class="desc">Sending a message shares it and recent replies with Nth Nota’s Cloudflare and Groq service. Web questions can share search terms or requested links with research providers. Sending an attached file shares its text and file names. Photos have their own sharing choice.</p><p class="desc">You can turn this off in Settings. Your draft stays here until you press Send.</p>'+button('agree','Allow cloud questions','check','','primary')+button('close','Keep off',null,'','choice centered'),'consent');
}
function sourceRows(list){return list && list.length?'<details class="sources"><summary>'+icon('link')+'Sources · '+list.length+'</summary>'+list.map(s=>button('source',s.title,'sendout','data-url="'+M.esc(s.url)+'"','source-row')).join('')+'</details>':'';}
function emptyHome(){
 return '<div class="welcome"><section class="hero"><div class="hero-copy"><div class="eyebrow"><i></i>'+(thread.temporary?'Temporary chat':'New conversation')+'</div><h1>What’s on<br>your <em>mind?</em></h1></div><img class="orbit" src="orbit.png" alt=""></section><div class="section-line"><h2>Start with an idea</h2><span></span></div><div class="starts">'+starters.map((s,i)=>'<button data-action="starter" data-i="'+i+'"><span class="tile-icon '+s.tone+'">'+icon(s.icon)+'</span><span><strong>'+s.title+'</strong><small>'+s.sub+'</small></span><span class="go">'+icon('right')+'</span></button>').join('')+'</div></div>';
}
function renderChat(scroll=false){
 const main=$('main');
 if(!thread.turns.length){main.innerHTML=thread.rehearsal?'':emptyHome();}
 else{
 main.innerHTML='<div class="chat-body"><div class="context-label">'+icon(thread.temporary?'eye':'chat')+M.esc(thread.temporary?'Temporary chat':thread.title)+'</div>'+thread.turns.map((t,i)=>{
 if(t.retired)return '';
 if(t.kind)return ConversationTools.localTurn(t,i);
 const attr='data-i="'+i+'"';
 let answer;
 if(t.status==='waiting') answer='<div class="working" role="status"><i></i>'+(t.image?'Examining your image…':t.file?'Reading your file…':t.attachment?'Reading your passage…':t.mode==='search'?'Looking for sources…':'Working on your reply…')+'</div>';
 else if(t.status==='error')answer='<div class="problem"><p>'+M.esc(t.error)+'</p>'+button('retry','Retry','arrow',attr,'text-btn')+button('editq','Edit question','pen',attr,'text-btn')+'</div>';
 else answer='<div class="answer-text">'+M.markdown(t.reply)+'</div>'+(t.canAskText?button('ask-image-text','Ask online about this text','pen',attr,'action-chip'):'')+(t.quote?button('practice-line','“'+t.quote+'”','chat','data-i="'+t.line+'"','choice framed'):'')+(t.phone?phoneActions(t,i):'')+sourceRows(t.sources)+(t.unavailable?button('web-fallback','Search in browser','sendout',attr,'text-btn'):'')+'<div class="reply-meta">'+M.esc([t.imageMethod|| (t.phone?(t.weatherData?'Weather · MET Norway':'On this phone'):t.unavailable?'Couldn’t verify':(t.searched?'Web search':t.attachment?'Writing':'AI reply')),t.provider].filter(Boolean).join(' · '))+'</div><div class="reply-actions">'+Shelf.replyAction(t,i)+button('to-desk','To Desk','desk',attr,'action-chip')+button('second-look','Second look','compass',attr,'text-btn second-look')+'<button data-action="copy-reply" '+attr+' class="bare" aria-label="Copy reply">'+icon('copy')+'</button><button data-action="more" '+attr+' class="bare" aria-label="More reply actions">'+icon('more')+'</button></div>';
 return '<article class="turn" id="turn-'+i+'"><div class="question">'+(t.image?ChatImages.turnPhoto(t,i):'')+(t.file?button('turn-file',thread.documents?.[t.file]?.name||'File','clip',attr,'turn-file'):'')+(t.attachment?'<small>'+icon('clip')+' Attached passage</small>':'')+M.esc(t.question)+'</div><div class="byline"><span class="mini-mark">N</span> '+M.esc(t.practice==='role'?thread.rehearsal.role:t.practice==='coach'?'Nota · Coach':'Nth Nota AI')+'</div>'+answer+'</article>';
 }).join('')+'</div>';
 }
 if(!thread.temporary){
  const project=Organizer.badge(thread.id);
  if(project || (thread.turns.length && threads.has(thread.id))){
   const menu=threads.has(thread.id)?'<button class="bare" aria-label="Chat options" data-action="thread-menu" data-id="'+thread.id+'">'+icon('more')+'</button>':'';
   const label=main.querySelector('.context-label');
   if(label){label.insertAdjacentHTML('beforeend',menu);if(project)label.insertAdjacentHTML('beforebegin',project);}
   else main.insertAdjacentHTML('afterbegin','<div class="project-context">'+project+menu+'</div>');
  }
 }
 if(thread.rehearsal)main.insertAdjacentHTML('afterbegin',Rehearsal.panel());
 const footer=ConversationTools.footer();if(footer)main.insertAdjacentHTML('beforeend',footer);
 $('question').value=thread.draft;
 syncComposer();
 if(scroll)requestAnimationFrame(()=>main.scrollTop=main.scrollHeight);
}
function syncComposer(){
 const attach=!!thread.attachment, image=!!thread.image, doc=thread.documents?.[thread.file];
 $('mode').hidden=!!thread.rehearsal||image||!!doc;document.querySelector('[data-action=attach]').hidden=!!thread.rehearsal;
 $('mode').innerHTML=icon(image?'image':attach?'pen':thread.mode==='search'?'globe':'spark')+(image?'Image':attach?'Writing':thread.mode==='search'?'Web search':'Auto')+icon('down');
 $('passage').innerHTML=image?ChatImages.composer():doc?ChatFiles.composer(doc):attach?button('review','Attached text · '+thread.attachment.length.toLocaleString()+' characters','clip','','attachment'):'';
 const stopped=!!job; $('send').innerHTML=icon(stopped?'stop':'arrow');$('send').setAttribute('aria-label',stopped?'Stop reply':'Send message');
 $('send').disabled=!stopped&&!thread.draft.trim()&&!image&&!doc;
 $('question').placeholder=image?'Ask about this photo…':doc?'Ask about this file…':'Ask Nth Nota…';
 const q=$('question');const width=Math.max(22,Math.floor((q.clientWidth || 315)/8));q.rows=Math.min(4,q.value.split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/width)),0));
}
function shell(){
 const chat=page==='chat';$('composer').hidden=!chat;LiveChat.render();
 document.querySelectorAll('nav button').forEach(b=>{const active=b.dataset.action===(page==='card'?'desk':page);b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
}
function navigate(dest){
 Organizer.resetReturn();
 if(LiveChat.active()){if(dest==='chat'&&page==='chat')LiveChat.view(false);else LiveChat.end();}
 flush();if(sheet)closeSheet();page=dest;query='';shell();$('main').scrollTop=0;
 if(dest==='chat')renderChat(true);else if(dest==='card')renderCard();else if(dest==='files')Shelf.render();else if(Organizer.isPage())Organizer.render();else renderLibrary(true);
}
function chooseThread(t){
 if(t!==thread && LiveChat.active())LiveChat.end();
 if(job && thread!==t)stopJob('Stopped when you switched conversations.');
 const previous=thread;flush();thread=t;
 if(previous!==t&&previous.temporary)ChatImages.removeUnused([previous.image,...previous.turns.map(row=>row.image)]);
 if(t.temporary || !threads.has(t.id))delete prefs.last;else prefs.last=t.id;
 remember();navigate('chat');
}
function emptyBoard(isDesk){
 return '<div class="empty-state"><span class="empty-glyph">'+icon(isDesk?'desk':'history')+'</span><h2>'+(isDesk?'A space for your work':'Your conversations live here')+'</h2><p>'+(isDesk?'Save an answer with To Desk, or start a note of your own.':'Send a message or start a draft, then return to it here.')+'</p>'+button(isDesk?'blank-card':'new',isDesk?'Create a card':'Start a chat','plus','','action-chip')+'</div>';
}
function renderLibrary(full){
 const isDesk=page==='desk';
 if(full)$('main').innerHTML='<div class="library"><div class="page-title"><div><div class="eyebrow"><i></i>On this device</div><h1>'+(isDesk?'Your Desk':'Chat history')+'</h1></div><button class="icon-btn solid" aria-label="'+(isDesk?'Create a card':'New chat')+'" data-action="'+(isDesk?'blank-card':'new')+'">'+icon('plus')+'</button></div><label class="search-box">'+icon('search')+'<input id="filter" aria-label="Search '+(isDesk?'Desk':'history')+'" placeholder="Search '+(isDesk?'your Desk':'conversations')+'"></label>'+(isDesk?'<div id="filters" class="chips"></div>':'')+'<div id="entries"></div></div>';
 if(isDesk)$('filters').innerHTML=['All','Note','Draft','Checklist','Prediction'].map(k=>button('filter',k,null,'data-val="'+k+'" aria-pressed="'+(typeFilter===k)+'"','pill'+(typeFilter===k?' selected':''))).join('');
 const all=Array.from((isDesk?cards:threads).values()),q=query.trim().toLocaleLowerCase();
 const rows=all.filter(item=>{
  if(isDesk && typeFilter!=='All'&&item.type!==typeFilter)return false;
  return Organizer.searchable(item,q);
 }).sort(Organizer.pinOrder);
 const entries=$('entries');if(!all.length){entries.innerHTML=emptyBoard(isDesk);return;}
 if(!rows.length){entries.innerHTML='<p class="no-matches">No matches here.</p>';return;}
 entries.innerHTML=rows.map(item=>{
  const subtitle=isDesk?(item.type==='Checklist'?item.items.filter(i=>i.done).length+' of '+item.items.length+' checked':item.type):item.turns.length?item.turns.length+(item.turns.length===1?' exchange':' exchanges'):'Draft';
  return '<div class="entry"><button data-action="'+(isDesk?'open-card':'open-thread')+'" data-id="'+item.id+'"><span class="tile-icon '+(isDesk?tone(item.type):'sage')+'">'+icon(isDesk?typeIcon(item.type):'chat')+'</span><span><strong>'+M.esc(Organizer.label(item))+'</strong><small>'+M.esc([Organizer.hasPin(item.id)?'Pinned':'',subtitle,Organizer.membership(item.id),statDate(item.updated)].filter(Boolean).join(' · '))+'</small></span></button>'+'<button class="bare" aria-label="Options for '+M.esc(Organizer.label(item))+'" data-action="'+(isDesk?'card-menu':'thread-menu')+'" data-id="'+item.id+'">'+icon('more')+'</button></div>';
 }).join('');
}
const typeIcon=type=>type==='Prediction'?'compass':type==='Checklist'?'list':type==='Draft'?'pen':'note';
const tone=type=>type==='Checklist'?'sage':type==='Draft'?'clay':'lavender';
function cardTypes(i){
 sheetTurn=i;modal(i<0?'Create a card':'Save to Desk','<p class="desc">'+(i<0?'Choose what you want to make.':'Keep an editable copy on this device. Source links travel with the answer.')+'</p>'+['Note','Draft','Checklist'].map(k=>button('create-card',k,typeIcon(k),'data-val="'+k+'"')).join('')+(i<0?button('prediction-new','Call it now','compass')+button('phrases','My phrases','wave'):''));
}
function newCard(type,index){
 const t=index<0?null:thread.turns[index],body=t?t.reply:'';
 const c={id:M.id('card'),type,title:t?t.question.slice(0,76):'Untitled '+type.toLowerCase(),body:type==='Checklist'?'':body,items:type==='Checklist'?M.checklist(body):[],sources:t?t.sources:[],origin:t&&!thread.temporary?thread.id:'',updated:Date.now()};
 if(!persist(c.id,c))return;
 cards.set(c.id,c);if(c.origin)Organizer.inherit(c.id,c.origin);card=c;navigate('card');
}
function putCard(){if(!card)return;card.updated=Date.now();persist(card.id,card);}
function renderCard(){
 const c=card,main=$('main');if(!c){navigate('desk');return;}
 main.innerHTML='<div class="library editor">'+(Organizer.badge(c.id)||button('desk','Desk','back','','text-btn'))+'<div class="editor-label"><span class="tile-icon '+tone(c.type)+'">'+icon(typeIcon(c.type))+'</span><span>'+c.type+'</span><span class="spacer"></span><button class="bare" aria-label="Card options" data-action="card-menu" data-id="'+c.id+'">'+icon('more')+'</button></div><textarea id="card-title" rows="1" class="title-input" aria-label="Card title" maxlength="120"></textarea><div id="card-content"></div>'+(c.type==='Checklist'?button('walk-start','Walk me through it','wave','','action-chip'):c.type==='Prediction'?'':button('edit-passage','Change just that','pen','','action-chip'))+(c.undoEdit?button('undo-edit','Undo last edit','back','','text-btn'):'')+button('ask-card','Ask about this card','spark','','action-chip')+sourceRows(c.sources)+(c.origin && threads.has(c.origin)?button(Number.isInteger(c.sourceIndex)?'source-line':'open-thread',Number.isInteger(c.sourceIndex)?'Go to spoken line':'Original conversation','chat','data-id="'+c.origin+'" data-i="'+c.sourceIndex+'"','text-btn'):'')+'</div>';
 $('card-title').value=c.title;fitText($('card-title'));
 if(c.type==='Prediction'){$('card-content').innerHTML=Predictions.view(c);return;}
 if(c.type==='Checklist'){
 $('card-content').innerHTML=Phrases.header(c)+'<div id="checklist">'+c.items.map((x,i)=>'<div class="check-row"><input type="checkbox" aria-label="Mark item '+(i+1)+' complete" data-i="'+i+'" '+(x.done?'checked':'')+'><textarea rows="2" class="check-text" data-i="'+i+'" aria-label="Item '+(i+1)+'"></textarea><button class="bare" data-action="remove-item" aria-label="Remove item '+(i+1)+'" data-i="'+i+'">'+icon('close')+'</button></div>'+(x.notes||[]).map(note=>'<p class="step-note">Observation · '+M.esc(note)+'</p>').join('')).join('')+'</div>'+button('add-item','Add item','plus','','text-btn');
 main.querySelectorAll('.check-text').forEach((el,i)=>{el.value=c.items[i].text;fitText(el);});
 }else{$('card-content').innerHTML='<textarea id="card-body" aria-label="Card text" placeholder="Start writing…" maxlength="160000"></textarea>';$('card-body').value=c.body;}
}
function fitText(el){el.style.height='auto';el.rows=1;el.style.height=(el.scrollHeight+2)+'px';}
window.addEventListener('resize',()=>{if(page==='card')document.querySelectorAll('.check-text,.title-input').forEach(fitText);});
if(document.fonts)document.fonts.ready.then(()=>{if(page==='card')document.querySelectorAll('.check-text,.title-input').forEach(fitText);});
function queueCard(){clearTimeout(editorTimer);const c=card;editorSave=()=>{c.updated=Date.now();persist(c.id,c);};editorTimer=setTimeout(()=>{if(editorSave)editorSave();editorSave=null;},250);}
function stopJob(reason='Reply stopped.'){
 if(!job)return;const stopped=job;job=null;N.stop();stopped.turn.status='error';stopped.turn.error=reason;saveThread(stopped.thread);if(page==='chat')renderChat();
}
function runTurn(t,prior,voice=null){
 if(!voice && LiveChat.active())LiveChat.end();
 const intent=t.image||t.file||t.attachment||t.practice?null:phoneIntent(t.question,prior[prior.length-1]);
 if(t.file&&!thread.documents?.[t.file]){notice('Choose this file again to ask about it.');return false;}
 const payload=t.practice?Rehearsal.prompt(thread.rehearsal,t,prior):M.request(t,prior,thread.documents?.[t.file]);
 if(payload.route==='write'&&payload.prompt.length>16000){notice('Shorten your question or attachment to fit the writing request.');return false;}
 t.status='waiting';delete t.error;job={id:M.id('ask'),turn:t,thread,voice};
 thread.updated=Date.now();saveThread();renderChat(true);
 if(t.image)N.askImage(job.id,JSON.stringify({id:t.image.id,mode:t.imageMode||'auto',question:t.question,session:voice?.id||'',token:voice?.token||'',history:ChatImages.history(t.image,prior)}));
 else if(intent){t.phone=true;if(intent.type==='weather')t.wx={value:intent.value,period:intent.period};N.askPhone(job.id,JSON.stringify(intent),voice?voice.id:'',voice?voice.token:'');}
 else if(voice)N.askLive(job.id,JSON.stringify(payload),voice.id,voice.token);
 else N.ask(job.id,JSON.stringify(payload));
 return true;
}
function send(skipFileLookup=false){
 if(!job&&!thread.image&&!thread.file&&!thread.attachment&&Thoughts.command(thread.draft)==='leave it here'){thread.draft='';ConversationTools.bookmark();return;}
 if(job){stopJob();return;}
 const question=thread.draft.trim()||(thread.image?'What can you tell me about this photo?':thread.file?'Summarize this file.':'');if(!question)return;
 try{if(!skipFileLookup && Shelf.intercept(question))return;}catch(e){Shelf.fail(e);return;}
 if(!thread.image&&!thread.file&&!thread.attachment){const origin=thread,local=Studio.command(question);if(local){origin.draft='';saveThread(origin);if(page==='chat'&&origin===thread){renderChat();}if(local.say)notice(local.say);return;}}
 if(thread.image && ChatImages.needsChoice(thread.imageMode)){ChatImages.choose(send);return;}
 if(!N.cloud()&&(thread.image?thread.imageMode==='text':(thread.rehearsal||thread.file||thread.attachment||!phoneIntent(question,thread.turns[thread.turns.length-1])))){consentDialog();return;}
 if(question.length>2000){notice('Questions can contain up to 2,000 characters.');return;}
 submitQuestion(question,thread.attachment,null);
}
function submitQuestion(question,attachment,voice){
 const t={question,attachment,spoken:!!voice,mode:thread.mode,status:'waiting',sources:[]};
 if(thread.file)t.file=thread.file;
 if(!thread.rehearsal&&!thread.image&&!thread.documents?.[thread.file]?.editTarget&&Shelf.wantsFile(question))t.makeFile=M.id('output');
 if(thread.image){t.image=thread.image;t.imageMode=ChatImages.mode(thread.imageMode);}
 if(attachment&&M.request(t,[]).prompt.length>16000){notice('Shorten your question or attachment to fit the writing request.');return false;}
 if(thread.rehearsal){
  if(attachment||t.file){notice('Start a regular chat to use an attachment.');return false;}
  t.practice=Rehearsal.isCoach(question)?'coach':'role';
  if(t.practice==='coach'&&!thread.turns.some(row=>row.practice==='role'&&!row.retired&&row.status==='ok')){notice('Practice an exchange before requesting coaching.');return false;}
 }
 const prior=thread.turns.slice();
 thread.turns.push(t);
 if(thread.turns.length===1 && thread.title==='New chat')thread.title=question.slice(0,65);
 if(!voice){thread.draft='';thread.attachment='';$('question').blur();}
 return runTurn(t,prior,voice);
}
function fork(i,edit=false){
 const original=thread,t=original.turns[i],child=M.newThread(original.temporary);
 if(original.rehearsal)child.rehearsal={...original.rehearsal};
 child.title=(original.title.replace(/^Branch · /,'')).slice(0,56);
 child.title='Branch · '+child.title;
 child.turns=JSON.parse(JSON.stringify(original.turns.slice(0,i+(edit?0:1))));
 ChatFiles.branch(original,child,t.file);
 if(t.image){child.image=t.image;child.imageMode=t.imageMode||'auto';}
 if(edit){child.draft=t.question;child.attachment=t.attachment||'';child.mode=t.mode;}
 chooseThread(child);saveThread();if(!child.temporary)Organizer.inherit(child.id,original.id);renderChat(true);if(edit)$('question').focus();else notice('New branch opened. Your original chat is intact.');
}
function reviewAttachment(text=thread.attachment){
 attachmentDraft=text;
 modal('Text attachment','<p class="desc">Review up to 14,000 characters. Sending uses the writing service. Your next regular chat message can use the reply as context.</p><textarea id="attachment-editor" aria-label="Selected text" maxlength="14000" rows="7" placeholder="Paste text here…"></textarea>'+button('apply-attachment','Use this text','check','','primary')+button('pick','Choose a text file','clip')+(thread.attachment?button('remove-attachment','Remove attachment','trash'):''),'attachment');
 $('attachment-editor').value=text;
}
function incomingFile(target,text){
 if(target!==thread.id){notice('The original conversation is no longer open.');return;}
 navigate('chat');reviewAttachment(text);
}
function replyMenu(i){
 const doc=thread.documents?.[thread.turns[i]?.file];
 sheetTurn=i;modal('Reply actions',(doc?.savedId&&!doc.editTarget?button('fs-revise-reply','Save as a new version','pen','data-id="'+i+'"'):'')+button('fs-save-reply','Save reply as file','down','data-id="'+i+'"')+button('branch','Branch from here','fork')+button('editq','Edit question in a new branch','pen','data-i="'+i+'"')+button('read','Read aloud','sound')+button('silence','Stop reading','stop')+button('share-reply','Share reply','sendout'));
}
let menuId='';
function itemMenu(id,isCard){
 const it=(isCard?cards:threads).get(id);if(!it)return;menuId=id;
 const organize=Organizer.options(id);
 modal(Organizer.label(it),organize+button('rename','Rename','pen')+button('export','Export Markdown','export')+button('share-item','Share','sendout')+button('confirm-delete','Delete','trash'),'item');
}
function itemFromMenu(){return cards.get(menuId)||threads.get(menuId);}
function itemText(it){return cards.has(it.id)?'# '+it.title+'\n\n'+M.cardText(it)+M.sourceText(it.sources):M.transcript(it);}
function starter(i){
 const s=starters[i];modal(s.title,s.ideas.map((p,n)=>button('prompt',p,'right','data-i="'+i+'" data-n="'+n+'"')).join(''));
}
function replaceDraft(text){
 if(thread.draft && thread.draft!==text){
  pendingDraft=text;confirmAction('Replace your draft?','Your current message will be replaced with the selected prompt.','replace-draft','Replace draft');return;
 }
 setDraft(text);
}
let pendingDraft='';
function setDraft(text){if(sheet)closeSheet();thread.draft=text;saveThread();renderChat();$('question').focus();}
function newMenu(){
 modal('New conversation',(thread.turns.length?button('bookmark','Leave it here','note'):'')+button('start','Regular chat','chat')+button('temporary','Temporary chat','eye')+Studio.buttons()+'<p class="desc">Temporary chats stay out of History. You can still choose to save an individual answer to Desk.</p>');
}
function startThread(temp){if(thread.temporary&&(thread.turns.length||thread.draft||thread.attachment||thread.file||thread.image)){pendingTemp=temp;confirmAction('Leave temporary chat?','Its conversation and draft will be discarded. Cards you saved are on your Desk.','discard-temp','Leave and start chat');}else chooseThread(M.newThread(temp));}
let pendingTemp=false;
document.addEventListener('click',event=>{
 const el=event.target.closest('[data-action]');if(!el)return;
 const action=el.dataset.action,i=Number(el.dataset.i),v=el.dataset.val,id=el.dataset.id;
 if(action.startsWith('fs-')){Shelf.handle(action.slice(3),id,el).catch(Shelf.fail);return;}
 if(action.startsWith('org-')&&Organizer.handle(action,id))return;
 switch(action){
 case 'practice-setup':Rehearsal.setup();break;
 case 'practice-confirm':Rehearsal.enter();break;
 case 'practice-start':Rehearsal.start(v==='voice');break;
 case 'practice-rewind':LiveChat.end();notice(Rehearsal.rewind());break;
 case 'practice-coach':if(job){notice('Finish or stop the current reply first.');break;}if(!N.cloud()){consentDialog();break;}{const draft=thread.draft;submitQuestion('Coach me','',null);thread.draft=draft;saveThread();renderChat(true);}break;
 case 'practice-line':{const line=$('turn-'+i);if(line){line.scrollIntoView({block:'center'});line.classList.add('source-highlight');}break;}
 case 'phrases':Phrases.menu();break;
 case 'phrase-describe':Phrases.describe();break;
 case 'phrase-review':Phrases.review();break;
 case 'phrase-new':Phrases.form();break;
 case 'phrase-edit':Phrases.form(id);break;
 case 'phrase-remove':confirmAction('Delete phrase?','Existing checklist runs stay on your Desk.','phrase-remove-confirm','Delete phrase');break;
 case 'phrase-remove-confirm':Phrases.remove();break;
 case 'phrase-save':Phrases.save();break;
 case 'phrase-run':Phrases.run(id);break;
 case 'phrase-answer':if(!Phrases.answer($('phrase-answer').value))notice('Enter an answer first.');break;
 case 'prediction-new':Predictions.form();break;
 case 'prediction-save':Predictions.save();break;
 case 'prediction-outcome':Predictions.outcome();break;
 case 'prediction-record':Predictions.record();break;
 case 'studio-dictate':Studio.dictate(v);break;
 case 'close':closeSheet();break;
 case 'home':case 'chat':navigate('chat');break;
 case 'desk':case 'history':navigate(action);break;
 case 'new':newMenu();break;
 case 'start':case 'temporary':startThread(action==='temporary');break;
 case 'discard-temp':chooseThread(M.newThread(pendingTemp));break;
 case 'settings':showSettings();N.imageStatus();break;
 case 'phone-setup':phoneSetup();break;
 case 'phone-prev':phoneSetup(phoneStep-1);break;
 case 'phone-next':phoneSetup(phoneStep+1);break;
 case 'phone-finish':closeSheet();break;
 case 'phone-config':{
  const state=JSON.parse(N.phoneStatus());
  if(v==='cloud'){N.consent(!N.cloud());phoneSetup(phoneStep);break;}
  const value=v==='city'?$('weather-city').value:v==='weather'?String(!state.weather):'';
  N.phoneConfigure(v,value);if(v==='city')notice(value.trim()?'Weather place saved.':'Saved place cleared.');break;
 }
 case 'phone-action':{
  const turn=thread.turns[i],a=turn&&turn.phone&&turn.actions&&turn.actions[Number(el.dataset.n)];
  if(a){if(a.type==='setup')phoneSetup(Math.max(0,stepIds.indexOf(a.value)));else if(a.type==='setting'||a.type==='app')N.phoneOpen(a.type,a.value);}
  break;
 }
 case 'set-voice':stopPreview();prefs.voice=v;remember();applyVoice();showSettings();break;
 case 'preview-voice':previewVoice();break;
 case 'cloud':if(N.cloud()){stopJob('Cloud questions were turned off.');N.consent(false);showSettings();}else consentDialog();break;
 case 'agree':N.consent(true);closeSheet();notice('Cloud questions are on. Press Send when ready.');break;
 case 'theme':prefs.appearance=v;remember();applyTheme();showSettings();break;
 case 'starter':starter(i);break;
 case 'prompt':replaceDraft(starters[i].ideas[Number(el.dataset.n)]);break;
 case 'replace-draft':setDraft(pendingDraft);break;
 case 'send':if(LiveChat.active() && job){LiveChat.interrupt();break;} LiveChat.end();send();break;
 case 'web-fallback':N.openSource('https://www.google.com/search?q='+encodeURIComponent(thread.turns[i].question));break;
 case 'source':if(M.safeUrl(el.dataset.url))N.openSource(el.dataset.url);break;
 case 'mode':
  if(thread.image){ChatImages.preview();break;}
  if(thread.attachment){reviewAttachment();break;}
  modal('Answer mode',button('set-mode','Auto','spark','data-val="auto"')+'<p class="option-help">Let the service choose when to look something up.</p>'+button('set-mode','Web search','globe','data-val="search"')+'<p class="option-help">Request a sourced answer from the web.</p>');break;
 case 'set-mode':thread.mode=v;saveThread();closeSheet();syncComposer();break;
 case 'attach':ChatImages.menu();break;
 case 'camera':case 'pick-image':ChatImages.pick(el.dataset.action);break;
 case 'pick-file':try{Shelf.fileMenu();}catch(e){Shelf.fail(e);}break;
 case 'photo-choice':ChatImages.rememberChoice(v);break;
 case 'photo-setting':ChatImages.rememberChoice(v);showSettings();break;
 case 'preview-file':ChatFiles.preview();break;
 case 'turn-file':ChatFiles.preview(i);break;
 case 'reuse-file':ChatFiles.reuse(i);break;
 case 'detach-file':ChatFiles.clear();saveThread();syncComposer();break;
 case 'preview-image':ChatImages.preview();break;
 case 'turn-image':ChatImages.preview(i);break;
 case 'reuse-image':ChatImages.reuse(i,false);break;
 case 'ask-image-text':ChatImages.reuse(i,true);break;
 case 'setup-vision':N.setupVision();break;
 case 'open-shared-image':chooseThread(M.newThread());N.acceptSharedImage(thread.id,false);break;
 case 'detach-image':ChatImages.detach();if(sheet)closeSheet();break;
 case 'review':reviewAttachment();break;
 case 'pick':N.pick(thread.id);break;
 case 'apply-attachment':if($('attachment-editor').value.trim())ChatFiles.clear();if(thread.image&&$('attachment-editor').value.trim())ChatImages.detach();thread.attachment=$('attachment-editor').value.trim();saveThread();closeSheet();syncComposer();$('question').focus();break;
 case 'remove-attachment':thread.attachment='';saveThread();closeSheet();syncComposer();break;
 case 'live-menu':LiveChat.menu();break;
 case 'live-consent':N.consent(true);LiveChat.menu();break;
 case 'live-pin':LiveChat.localCommand('Hold that thought');break;
 case 'pin-line':ConversationTools.pin('',i);break;
 case 'ramble-start':ConversationTools.beginRamble();LiveChat.start(false);break;
 case 'ramble-toggle':LiveChat.localCommand(thread.ramble?"I'm done":"Let me ramble");break;
 case 'ramble-finish':if(LiveChat.active())LiveChat.localCommand("I'm done");else ConversationTools.finishRamble();break;
 case 'focus-idea':replaceDraft('Help me explore this idea: '+thread.turns[i].ideas[Number(el.dataset.n)]);break;
 case 'bookmark':ConversationTools.bookmark();break;
 case 'save-bookmark':ConversationTools.saveBookmark();break;
 case 'clear-bookmark':delete thread.bookmark;saveThread();closeSheet();renderChat(true);break;
 case 'resume-bookmark':replaceDraft([thread.bookmark.note,thread.bookmark.next].filter(Boolean).join('\n\n'));break;
 case 'source-line':if(card)ConversationTools.openSource(card);break;
 case 'walk-start':Walkthrough.start();break;
 case 'walk-repeat':LiveChat.localCommand('repeat');break;
 case 'walk-done':LiveChat.localCommand('done');break;
 case 'walk-note':LiveChat.localCommand('I found a problem');break;
 case 'edit-passage':Revision.open();break;
 case 'dictate-edit':Revision.dictate();break;
 case 'request-edit':Revision.request();break;
 case 'apply-edit':Revision.apply();break;
 case 'refine-edit':Revision.form();break;
 case 'undo-edit':Revision.undo();break;
 case 'live-start':LiveChat.start(v==='dot');break;
 case 'live-switch':LiveChat.view(!LiveChat.expanded());break;
 case 'live-mute':LiveChat.mute();break;
 case 'live-interrupt':LiveChat.interrupt();break;
 case 'live-end':LiveChat.end();break;
 case 'voice':LiveChat.end();N.dictate(thread.id);break;
 case 'retry':
  if(job){notice('Finish or stop the current reply first.');break;}
  if(!N.cloud()&&(thread.turns[i].image?thread.turns[i].imageMode==='text':(thread.turns[i].file||thread.turns[i].attachment||!phoneIntent(thread.turns[i].question,thread.turns[i-1])))){consentDialog();break;}
  if(i<thread.turns.length-1){fork(i,true);send();}else {
   const t=thread.turns[i],retry=()=>{if(t.image)t.imageMode=ChatImages.mode(t.imageMode);runTurn(t,thread.turns.slice(0,i));};
   if(t.image&&ChatImages.needsChoice(t.imageMode))ChatImages.choose(retry);else retry();
  }
  break;
 case 'editq':fork(i,true);break;
 case 'branch':fork(sheetTurn);break;
 case 'copy-reply':N.copy(thread.turns[i].reply);notice('Reply copied.');break;
 case 'to-desk':cardTypes(i);break;
 case 'blank-card':cardTypes(-1);break;
 case 'create-card':newCard(v,sheetTurn);break;
 case 'second-look':
  sheetTurn=i;modal('Second look','<p class="desc">Explore a different angle in a new branch. Review the follow-up before sending.</p>'+
    button('lens','Find the weak spot','compass','data-val="weak"')+button('lens','Argue the other side','fork','data-val="opposite"')+button('lens','Give me one next step','list','data-val="step"'));break;
 case 'lens':{
  const prompts={weak:'Look back at your previous answer. Which assumption is least certain, and how could I check it?',opposite:'Give me the strongest reasonable counterargument to your previous answer. Where do the two views agree?',step:'Turn your previous answer into one small action I could take first. What would count as finishing it?'};
  const index=sheetTurn,original=thread.turns[index];fork(index);
  // An unverified answer is intentionally excluded from model context.
  const prompt=original.unavailable?prompts[v]+'\n\nHere is the unverified reply I want to examine:\n'+original.reply:prompts[v];
  if(prompt.length>2000){ChatFiles.clear();if(thread.image)ChatImages.detach();thread.attachment=original.reply.slice(0,14000);setDraft(prompts[v]);}else setDraft(prompt);break;
 }
 case 'ask-card':{
  flush();const text=M.cardText(card)+M.sourceText(card.sources);
  if(!text.trim()){notice('Add some text to this card first.');break;}
  if(text.length>14000){notice('Select a passage of up to 14,000 characters to ask about.');break;}
  const next=M.newThread();next.draft='Help me improve this '+card.type.toLowerCase()+'.';next.attachment=text;
  chooseThread(next);saveThread();Organizer.inherit(next.id,card.id);renderChat();notice('Card attached. Review your question before sending.');break;
 }
 case 'more':replyMenu(i);break;
 case 'read':N.readAloud(thread.turns[sheetTurn].reply);closeSheet();break;
 case 'silence':N.silence();closeSheet();break;
 case 'share-reply':{const t=thread.turns[sheetTurn];N.share(t.reply+M.sourceText(t.sources));closeSheet();break;}
 case 'filter':typeFilter=v;renderLibrary(false);break;
 case 'open-thread':case 'open-card':Organizer.openItem(id);break;
 case 'thread-menu':case 'card-menu':flush();itemMenu(id,action==='card-menu');break;
 case 'add-item':flush();card.items.push({text:'',done:false});putCard();renderCard();{const ls=document.querySelectorAll('.check-text');ls[ls.length-1].focus();}break;
 case 'remove-item':flush();card.items.splice(i,1);putCard();renderCard();break;
 case 'rename':modal('Rename','<label class="field-label">Title<input id="rename" maxlength="120"></label>'+button('save-name','Save title',null,'','primary'));$('rename').value=Organizer.label(itemFromMenu());$('rename').focus();break;
 case 'save-name':{const it=itemFromMenu();const title=$('rename').value.trim();if(!title){notice('Enter a title.');break;}const renamed={...it,title,updated:Date.now()};if(!persist(it.id,renamed))break;Object.assign(it,renamed);Organizer.finishItem();break;}
 case 'export':case 'share-item':{const it=itemFromMenu(),text=itemText(it);closeSheet();if(action==='share-item')N.share(text);else Shelf.exportItem(it,text).catch(Shelf.fail);break;}
 case 'confirm-delete':confirmAction('Delete this '+(cards.has(menuId)?'card':'chat')+'?','This removes “'+itemFromMenu().title+'” from this device.','delete','Delete');break;
 case 'delete':{
   const isCard=cards.has(menuId),removed=threads.get(menuId);
   if(job?.thread.id===menuId)stopJob();
   if(!persist(menuId,null))break;
   if(!isCard&&menuId===thread.id){thread=M.newThread();delete prefs.last;remember();}
   Organizer.forget(menuId);
   (isCard?cards:threads).delete(menuId);if(isCard && card && card.id===menuId)card=null;
   if(removed)ChatImages.removeUnused([removed.image,...removed.turns.map(row=>row.image)]);
   navigate(page==='project'?'project':isCard?'desk':'history');break;
 }
 }
});
$('question').addEventListener('focus',()=>{if(LiveChat.active())LiveChat.end();});
document.addEventListener('input',e=>{
 const target=e.target;
 if(target.id==='shelf-search'){Shelf.search(target.value);return;}
 if(target.id==='org-search'){Organizer.drawerList();return;}
 if(target.id==='org-find'){Organizer.candidates();return;}
 if(target.id==='voice-pace'){
  stopPreview();$('voice-preview-label').textContent='Preview voice';
  prefs.voiceRate=Number(target.value);
  $('pace-value').textContent=voiceRate()+'%';
  target.setAttribute('aria-valuetext',voiceRate()+' percent');
  remember();applyVoice();return;
 }
 if(target.matches('.check-text,.title-input'))fitText(target);
 if(target.id==='question'){
  thread.draft=target.value;thread.updated=Date.now();clearTimeout(draftTimer);draftTimer=setTimeout(()=>saveThread(),220);syncComposer();
 }else if(target.id==='filter'){query=target.value;renderLibrary(false);}
 else if(target.id==='card-title'){card.title=target.value.trim()||'Untitled '+card.type.toLowerCase();queueCard();}
 else if(target.id==='card-body'){card.body=target.value;delete card.undoEdit;const undo=document.querySelector('[data-action=undo-edit]');if(undo)undo.remove();queueCard();}
 else if(target.classList.contains('check-text')){card.items[Number(target.dataset.i)].text=target.value;queueCard();}
});
document.addEventListener('change',e=>{if(e.target.id==='phrase-template')Phrases.fillSteps();if(e.target.matches('.check-row input[type=checkbox]')){card.items[Number(e.target.dataset.i)].done=e.target.checked;putCard();}});
$('overlay').addEventListener('click',e=>{if(e.target===$('overlay'))closeSheet();});
function back(){
 if(LiveChat.expanded()){LiveChat.view(false);return;}
 if(LiveChat.active()){LiveChat.end();return;}
 if(sheet){closeSheet();return;}
 if(Organizer.back())return;
 if(page==='card'){navigate('desk');return;}
 if(page!=='chat'){navigate('chat');return;}
 flush();N.leave();
}
document.addEventListener('keydown',e=>{
 if(e.key==='Enter'&&e.target.id==='org-name'){e.preventDefault();Organizer.handle('org-save');return;}
 if(e.key==='Escape'){e.preventDefault();back();}
 if(e.target===$('question')&&e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();if(!job)send();}
 if(sheet&&e.key==='Tab'){const focusable=[...$('dialog').querySelectorAll('button,input,textarea')];const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
});
$('question').addEventListener('paste',e=>{
 const text=e.clipboardData?.getData('text/plain');
 if(!thread.rehearsal && text && text.length>2000){
  e.preventDefault();
  if(text.length>14000)notice('Choose a file for longer text.');else reviewAttachment(text);
 }
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
window.notaEvent=(event,...args)=>{
 if(event==='shelfResult'){Shelf.event(...args);return;}
 if(event==='chatFile'){
  if(args[0]==='@files'){Shelf.changed();notice('Added to Files.');}
  else ChatFiles.picked(...args);
  return;
 }
 if(ChatImages.event(event,args))return;
 if(event==='phoneStatus'){if(sheet==='phone')phoneSetup(phoneStep);return;}
 if(event==='previewStopped'){if(previewToken){previewToken='';const el=$('voice-preview-label');if(el)el.textContent='Preview voice';}return;}
 if(event==='preview'){
  if(!previewToken||previewToken!==args[0]||sheet!=='settings')return;
  if(args[1]==='playing'){$('voice-preview-label').textContent='Stop preview';return;}
  previewToken='';$('voice-preview-label').textContent='Preview voice';
  if(args[1]==='failed')notice('Couldn’t play this voice. Try again or select Android voice.');
  return;
 }
 if(event==='live'){LiveChat.onEvent(...args);return;}
 if(event==='back'){back();return;}if(event==='notice'){notice(args[0]);return;}
 if(event==='incoming'){
  chooseThread(M.newThread(true));reviewAttachment(args[0]);return;
 }
 if(event==='file'){incomingFile(args[0],args[1]);return;}
 if(event==='dictated'){if(Studio.dictated(args[0],args[1])||Revision.dictated(args[0],args[1]))return;if(args[0]===thread.id){const text=(thread.draft+' '+args[1]).trim();if(text.length>2000){notice('Dictation would exceed the message limit.');return;}setDraft(text);}return;}
 if((event==='answer'||event==='failure')&&Revision.result(event,args[0],args[1]))return;
 if(!job||job.id!==args[0])return;
 const active=job;job=null;const t=active.turn;
 if(event==='failure'){t.status='error';t.error=args[1];}
 else if(event==='phoneAnswer' && t.phone){
  try{const d=JSON.parse(args[1]);Object.assign(t,{status:'ok',reply:d.text,sources:M.sources(d.sources),actions:d.actions||[],weatherData:!!d.weatherData,retryable:!!d.retryable});}
  catch(_){t.status='error';t.error='Couldn’t read the phone response.';}
 }
 else if(event==='answer'){
   try{const data=JSON.parse(args[1]);if(typeof data.text!=='string'||!data.text.trim())throw Error();
   const reply=t.practice==='coach'?Rehearsal.coaching(t,active.thread.turns.slice(0,active.thread.turns.indexOf(t)),data.text):data.text;
   if(t.image){t.imageMethod=data.imageMethod;t.canAskText=!!data.canAskText;}
   Object.assign(t,{status:'ok',reply,sources:M.sources(data.sources),provider:({groq:'Groq',cloudflare:'Cloudflare'})[data.provider]||'',unavailable:!!data.unavailable,searched:!!data.searched});}
   catch(_){t.status='error';t.error=t.practice==='coach'?'Couldn’t match this feedback to an exact line. Retry coaching.':'Couldn’t read this reply. Try again.';}
 }
 saveThread(active.thread);if(page==='chat'&&active.thread===thread)renderChat(true);
 else if(page==='history')renderLibrary(false);
 if(event==='answer')Shelf.completed(active.thread,t);
 LiveChat.reply(active,t);
};
document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon)+el.innerHTML;});
applyVoice();applyTheme();shell();renderChat(true);
if(!prefs.phoneIntro){prefs.phoneIntro=true;remember();phoneSetup();}
N.mounted();
Shelf.restoreOutputs();
