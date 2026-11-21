'use strict';

const Organizer = (() => {
 let state={projects:{}, placement:{}, pins:{}, memories:{}};
 let currentProject='', formProject='', formItem='', drawerQuery='', fromDrawer=false;
 let returnRoute=null, pendingOpen=null;
 const attr=id=>'data-id="'+M.esc(id)+'"';
 const item=id=>threads.get(id)||cards.get(id);
 const recent=(a,b)=>b.updated-a.updated||a.title.localeCompare(b.title);
 const sorted=()=>Object.entries(state.projects).sort((a,b)=>a[1].localeCompare(b[1]));
 const section=label=>'<h3 class="org-section">'+M.esc(label)+'</h3>';
 const isPage=()=>['projects','project','pinned'].includes(page);
 function load(data){if(data)state={projects:data.projects||{},placement:data.placement||{},pins:data.pins||{},memories:data.memories||{}};}
 function change(update){
  const next={projects:{...state.projects},placement:{...state.placement},pins:{...state.pins},memories:{...state.memories}};
  update(next);
  if(!persist('organizer',next))return false;
  state=next;return true;
 }
 function projectOf(id){const key=state.placement[id];return state.projects[key]?key:'';}
 function all(){return [...threads.values(),...cards.values()].filter(x=>!x.temporary).sort(recent);}
 function hasPin(id){return !!state.pins[id];}
 function pinOrder(a,b){return Number(hasPin(b.id))-Number(hasPin(a.id))||recent(a,b);}
 function inherit(id,source){const project=projectOf(source);if(project)change(next=>{next.placement[id]=project;});}
 function forget(id){if(state.placement[id]||hasPin(id))change(next=>{delete next.placement[id];delete next.pins[id];});}
 function membership(id){return state.projects[projectOf(id)]||'';}
 function match(it,q){
  const hit=(value,index=-1)=>{
   if(!value)return null;
   const start=value.toLocaleLowerCase().indexOf(q);
   if(start<0)return null;
   const left=Math.max(0,start-30),right=Math.min(value.length,start+q.length+50);
   return {index,excerpt:(left?'…':'')+value.slice(left,right)+(right<value.length?'…':'')};
  };
  if(!q||hit(it.title))return {index:-1,excerpt:''};
  if(cards.has(it.id))return hit(M.cardText(it));
  const draft=hit(it.draft)||hit(it.bookmark?.note)||hit(it.bookmark?.next)||hit(it.documents?.[it.file]?.name);
  if(draft)return draft;
  for(const [index,t] of it.turns.entries()){
   if(t.retired)continue;
   const found=hit(t.question,index)||hit(t.reply,index)||hit(it.documents?.[t.file]?.name,index);
   if(found)return found;
  }
  return null;
 }
 function searchable(it,q){return !!match(it,q);}
 function label(it){
  if(it.title==='New chat'&&!it.turns?.length&&it.draft?.trim())return it.draft.trim().split(/\r?\n/)[0].slice(0,76);
  return it.title;
 }
 function row(it,options=true,picker=false,excerpt=''){
  const isCard=cards.has(it.id),type=isCard?it.type:'Chat';
  const action=picker?'org-add-item':isCard?'open-card':'open-thread';
  const date=statDate(it.updated);
  const detail=[type,membership(it.id),date].filter(Boolean).join(' · ');
  return '<div class="entry org-row"><button data-action="'+action+'" '+attr(it.id)+'><span class="tile-icon '+(isCard?tone(type):'sage')+'">'+icon(isCard?typeIcon(type):'chat')+'</span><span><strong>'+M.esc(label(it))+'</strong><small>'+M.esc(detail)+'</small>'+(excerpt?'<small class="org-excerpt">'+M.esc(excerpt)+'</small>':'')+'</span>'+(hasPin(it.id)?'<span class="pin-indicator" aria-label="Pinned">'+icon('pin')+'</span>':'')+'</button>'+
   (options?'<button class="bare" aria-label="Options for '+M.esc(label(it))+'" data-action="'+(isCard?'card-menu':'thread-menu')+'" '+attr(it.id)+'>'+icon('more')+'</button>':'')+'</div>';
 }
 function projectRow(id,name){
  const members=Object.keys(state.placement).filter(key=>state.placement[key]===id&&item(key));
  return '<div class="entry org-row project-row"><button data-action="org-project" '+attr(id)+'><span class="tile-icon clay">'+icon('folder')+'</span><span><strong>'+M.esc(name)+'</strong><small>'+members.length+' '+(members.length===1?'item':'items')+'</small></span></button></div>';
 }
 function searchBox(id,label,placeholder=label){
  return '<label class="search-box">'+icon('search')+'<input type="search" id="'+id+'" autocomplete="off" aria-label="'+label+'" placeholder="'+placeholder+'"></label>';
 }
 function drawer(query=''){
  flush();drawerQuery=query;
  modal('Nth Nota AI',searchBox('org-search','Search chats, cards and projects','Search everything')+'<div id="drawer-list" class="drawer-scroll"></div><div class="drawer-foot">'+button('org-new-chat','New chat','new','','primary')+'</div>','drawer');
  $('org-search').value=query;drawerList();
 }
 function drawerList(){
  const field=$('org-search');drawerQuery=field.value;
  const q=drawerQuery.trim().toLocaleLowerCase(),items=all();
  let html='';
  if(q){
   const projects=sorted().filter(([,name])=>name.toLocaleLowerCase().includes(q));
   const found=items.map(it=>({it,hit:match(it,q)})).filter(result=>result.hit).sort((a,b)=>pinOrder(a.it,b.it));
   if(projects.length)html+=section('Projects')+projects.map(([id,name])=>projectRow(id,name)).join('');
   if(found.length)html+=section('Chats and cards')+found.map(({it,hit})=>row(it,true,false,hit.excerpt)).join('');
   const files=Shelf.searchDrawer(q);if(files)html+=section('Files')+files;
   if(!html)html='<p class="desc">No results for “'+M.esc(drawerQuery.trim())+'”.</p>';
  }else{
   const links=sorted().slice(0,3).map(([id,name])=>button('org-project',name,'folder',attr(id),'drawer-project')).join('');
   html='<div class="drawer-links">'+button('org-projects','Projects','folder')+(links?'<div class="drawer-projects">'+links+'</div>':'')+button('fs-open','Files','clip')+(page==='chat'&&!thread.temporary?button('mem-open','Memory','note'):'')+button('desk','Desk','desk')+button('history','All chats','history')+'</div>';
   const pinned=items.filter(it=>hasPin(it.id));
   if(pinned.length){
    html+=section('Pinned')+pinned.slice(0,4).map(it=>row(it)).join('');
    if(pinned.length>4)html+=button('org-pinned','See all pinned','right','','text-btn');
   }
   const recentChats=items.filter(it=>threads.has(it.id)&&!hasPin(it.id)).slice(0,8);
   if(recentChats.length)html+=section('Recent chats')+recentChats.map(it=>row(it)).join('');
  }
  $('drawer-list').innerHTML=html;
 }
 function title(text,action,label,glyph){
  return '<div class="page-title"><h1>'+M.esc(text)+'</h1>'+(action?'<button class="icon-btn solid" aria-label="'+label+'" data-action="'+action+'">'+icon(glyph)+'</button>':'')+'</div>';
 }
 function render(){
  let html='';
  if(page==='pinned'){
   html=title('Pinned')+all().filter(it=>hasPin(it.id)).map(it=>row(it)).join('');
   if(!all().some(it=>hasPin(it.id)))html+='<p class="desc">Pin a chat or Desk card from its options.</p>';
  }else if(page==='projects'){
   html=title('Projects','org-create','Create project','plus');
   const projects=sorted();
   html+=projects.length?projects.map(([id,name])=>projectRow(id,name)).join(''):'<div class="empty-state"><span class="empty-glyph">'+icon('folder')+'</span><h2>Your first project</h2><p>Keep related chats and Desk cards together.</p>'+button('org-create','Create project','plus','','action-chip')+'</div>';
  }else{
   const name=state.projects[currentProject];
   if(!name){navigate('projects');return;}
   const members=all().filter(it=>projectOf(it.id)===currentProject).sort(pinOrder);
   html=button('org-projects','Projects','back','','text-btn')+title(name,'org-options','Project options','more')+
    '<div class="project-actions">'+button('org-project-chat','New chat','new','','action-chip')+button('org-add','Add existing','plus','','action-chip')+button('mem-project','Project memory','note',attr(currentProject),'action-chip')+'</div>';
   if(!members.length)html+='<p class="desc">Start a chat here or add a saved chat or Desk card.</p>';
   else{
    const chats=members.filter(it=>threads.has(it.id)),desk=members.filter(it=>cards.has(it.id));
    if(chats.length)html+=section('Chats')+chats.map(it=>row(it)).join('');
    if(desk.length)html+=section('Desk cards')+desk.map(it=>row(it)).join('');
   }
  }
  $('main').innerHTML='<div class="library organizer-page">'+html+'</div>';
 }
 function refresh(){
  if(isPage())render();
  else if(page==='chat')renderChat();
  else if(page==='card')renderCard();
  else renderLibrary(false);
 }
 function openProject(id){
  if(!state.projects[id])return;
  currentProject=id;navigate('project');
 }
 function badge(id){
  const p=projectOf(id);
  return p?button('org-project',state.projects[p],'folder',attr(p),'text-btn project-badge'):'';
 }
 function finishItem(){
  closeSheet();refresh();
  if(fromDrawer)drawer(drawerQuery);
  fromDrawer=false;
 }
 function options(id){
  fromDrawer=sheet==='drawer';
  return button('org-pin',hasPin(id)?'Unpin':'Pin to menu','pin',attr(id))+button('org-move','Move to project','folder',attr(id));
 }
 function moveMenu(id){
  if(!item(id))return;
  const current=projectOf(id);
  let html=sorted().map(([key,name])=>button('org-place',name,key===current?'check':'folder',attr(key))).join('');
  html+=button('org-create-for','Create project','plus',attr(id));
  if(current)html+=button('org-unfile','Remove from project','back',attr(id));
  formItem=id;modal('Move to project',html,'org-move');
 }
 function form(id='',target=''){
  formProject=id;formItem=target;
  modal(id?'Rename project':'Create project','<label class="field-label">Project name<input id="org-name" maxlength="80" autocomplete="off" placeholder="e.g. D&D campaign"></label>'+button('org-save',id?'Save name':'Create project','check','','primary'),'org-form');
  $('org-name').value=state.projects[id]||'';$('org-name').focus();
 }
 function saveForm(){
  const name=$('org-name').value.trim();
  if(!name){notice('Enter a project name.');return;}
  if(sorted().some(([key,value])=>key!==formProject&&value.toLocaleLowerCase()===name.toLocaleLowerCase())){notice('A project already has that name.');return;}
  const id=formProject||M.id('project'),target=formItem;
  if(!change(next=>{next.projects[id]=name;if(target&&item(target))next.placement[target]=id;}))return;
  if(target){finishItem();notice('Moved to '+name+'.');}else openProject(id);
 }
 function addMenu(){
  modal('Add to '+state.projects[currentProject],searchBox('org-find','Find a chat or Desk card')+'<div id="org-candidates"></div>','org-add');
  candidates();
 }
 function candidates(){
  const q=$('org-find').value.trim().toLocaleLowerCase();
  const found=all().filter(it=>projectOf(it.id)!==currentProject&&searchable(it,q));
  $('org-candidates').innerHTML=found.length?found.map(it=>row(it,false,true)).join(''):'<p class="desc">No matching chats or cards to add.</p>';
 }
 function place(id,destination){
  if(!item(id)||(destination&&!state.projects[destination]))return false;
  return change(next=>{if(destination)next.placement[id]=destination;else delete next.placement[id];});
 }
 function confirmSwitch(fn){
  if(thread.temporary&&(thread.turns.length||thread.draft||thread.file||thread.image||thread.attachment||thread.bookmark||thread.ramble||thread.rehearsal)){
   pendingOpen=fn;confirmAction('Leave temporary chat?','Your temporary conversation and draft will be discarded.','org-leave','Leave temporary chat');
  }else fn();
 }
 function openItem(id){
  const it=item(id);if(!it)return;
  const route=sheet==='drawer'?{id,search:drawerQuery}:page==='project'?{id,project:currentProject}:null;
  const search=sheet==='drawer'?drawerQuery:(page==='history'?query:'');
  const jump=search.trim()?match(it,search.trim().toLocaleLowerCase())?.index:-1;
  const open=()=>{
   if(threads.has(id)){
    chooseThread(it);
    if(jump>=0)requestAnimationFrame(()=>{
     const turn=$('turn-'+jump);
     if(page==='chat'&&thread===it&&turn){turn.scrollIntoView({block:'center'});turn.classList.add('source-highlight');}
    });
   }
   else{card=it;navigate('card');}
   returnRoute=route;
  };
  if(threads.has(id)&&it!==thread)confirmSwitch(open);else open();
 }
 function start(project){
  confirmSwitch(()=>{
   const t=M.newThread();
   chooseThread(t);
   if(project){
    // A deliberately created project chat is visible in its folder even before typing.
    if(!persist(t.id,t))return;
    threads.set(t.id,t);saveThread();
    if(place(t.id,project)){returnRoute={id:t.id,project};renderChat();}
   }
   $('question').focus();
  });
 }
 function resetReturn(){returnRoute=null;}
 function back(){
  if(page==='project'){navigate('projects');return true;}
  const id=page==='chat'?thread.id:page==='card'?card?.id:'';
  if(!returnRoute||returnRoute.id!==id)return false;
  const route=returnRoute;resetReturn();
  if(route.search!==undefined){drawer(route.search);return true;}
  if(state.projects[route.project]){openProject(route.project);return true;}
  return false;
 }
 function handle(action,id){
  switch(action){
  case 'org-menu':drawer();break;
  case 'org-projects':navigate('projects');break;
  case 'org-pinned':navigate('pinned');break;
  case 'org-project':openProject(id);break;
  case 'org-new-chat':start('');break;
  case 'org-project-chat':start(currentProject);break;
  case 'org-leave':{const open=pendingOpen;pendingOpen=null;if(open)open();break;}
  case 'org-create':form();break;
  case 'org-create-for':form('',id);break;
  case 'org-save':saveForm();break;
  case 'org-options':modal(state.projects[currentProject],button('org-rename','Rename project','pen')+button('org-confirm-remove','Remove project','trash'));break;
  case 'org-rename':form(currentProject);break;
  case 'org-confirm-remove':confirmAction('Remove this project?','This deletes the project’s shared memories. Its chats and cards stay in All chats and Desk.','org-remove','Remove project');break;
  case 'org-remove':
   if(change(next=>{delete next.projects[currentProject];delete next.memories[currentProject];for(const [key,group] of Object.entries(next.placement))if(group===currentProject)delete next.placement[key];}))navigate('projects');
   break;
  case 'org-add':addMenu();break;
  case 'org-add-item':
   if(projectOf(id))confirmAction('Move to '+state.projects[currentProject]+'?','This item is currently in '+membership(id)+'.','org-confirm-add','Move item');
   formItem=id;
   if(!projectOf(id)&&place(id,currentProject)){closeSheet();render();}
   break;
  case 'org-confirm-add':if(place(formItem,currentProject)){closeSheet();render();}break;
  case 'org-pin':
   if(item(id)&&change(next=>{if(next.pins[id])delete next.pins[id];else next.pins[id]=true;}))finishItem();
   break;
  case 'org-move':moveMenu(id);break;
  case 'org-place':case 'org-unfile':if(place(formItem,action==='org-place'?id:''))finishItem();break;
  default:return false;
  }
  return true;
 }
 function projectMemories(id){return state.projects[id]?(state.memories[id]||[]):[];}
 function storeMemories(id,rows){return !!state.projects[id]&&change(next=>{next.memories[id]=rows;});}
 return {projectOf,projectName:id=>state.projects[id],projectMemories,storeMemories,load,label,hasPin,pinOrder,searchable,inherit,forget,membership,badge,drawerList,candidates,handle,openItem,confirmSwitch,options,finishItem,isPage,render,resetReturn,back};
})();
