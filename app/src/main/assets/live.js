'use strict';
const LiveChat = (() => {
 let session = null;
 let listenTimer, speechTimer, pulseTimer;
 const labels = {
  preparing:'Starting voice', opening:'Opening microphone', listening:'Listening',
  finishing:'Finishing your words', thinking:'Thinking', loading:'Preparing reply',
  speaking:'Nota is speaking', paused:'Microphone paused'
 };
 function panel() { return document.getElementById('live-panel'); }
 function render() {
  const p=panel();
  p.hidden=!session;
  const expanded=!!(session && session.expanded);
  document.getElementById('app').classList.toggle('in-live-view',expanded);
  const entry=document.getElementById('live-entry');
  entry.hidden=page!=='chat'||!!session;
  if(!session)return;
  const s=session, walk=s.mode==='walk';
  $('live-tools').hidden=walk||!!thread.rehearsal;$('walk-tools').hidden=!walk;$('voice-switch').hidden=walk;
  $('voice-label').textContent=walk?'Checklist walkthrough':thread.rehearsal?'Rehearsal room':thread.ramble?'Ramble':'Live voice';
  $('ramble-toggle').textContent=thread.ramble?'Finish ramble':'Let me ramble';
  p.dataset.state=s.state;
  p.classList.toggle('expanded',expanded);
  const status=labels[s.state]+(s.muted && s.state!=='paused'?' · mic muted':'');
  const statusEl=document.getElementById('live-state');
  if(statusEl.textContent!==status)statusEl.textContent=status;
  document.getElementById('live-caption').textContent=s.caption||(walk?Walkthrough.prompt(s):thread.ramble?'Take your time. Say “I’m done” when you’re ready.':'');
  const mute=document.getElementById('live-mute');
  mute.textContent=s.muted?'Resume mic':'Mute mic';
  mute.setAttribute('aria-pressed',String(s.muted));
  mute.disabled=s.state==='preparing';
  document.getElementById('live-interrupt').disabled=!['thinking','loading','speaking'].includes(s.state);
  document.getElementById('live-switch-label').textContent=expanded?'Show chat':'Live View';
 }
 function menu() {
  if(job){notice('Finish or stop the current reply before starting live voice.');return;}
  const description=thread.image ? 'Spoken questions use the attached photo.' : thread.file?'Spoken questions use the attached file’s text and file names.':N.cloud()?'During live voice, AI questions are sent to Nth Nota as text. Phone commands are handled locally.':'Cloud questions are off. You can ask about your phone, open a shortcut or use weather if enabled.';
  modal('Live voice','<p class="desc">Android handles microphone audio and may use its online speech service. '+description+'</p>'+
   button('live-start','Voice in Chat','chat','data-val="chat"')+
   button('live-start','Live View','wave','data-val="dot"')+button('ramble-start','Let me ramble','mic')+
   (thread.turns.length?button('bookmark','Leave it here','note'):'')+'<p class="desc">Say “Hold that thought” after a sentence to pin your words to Desk.</p>','live-menu');
 }
 function start(expanded,mode='chat') {
  if(job||session||page!==(mode==='walk'?'card':'chat'))return;
  if(mode==='chat' && thread.image && ChatImages.needsChoice(thread.imageMode)){ChatImages.choose(()=>start(expanded,mode));return;}
  closeSheet();
  document.activeElement.blur();
  session={id:M.id('live'),thread:thread.id,mode,cardId:mode==='walk'?card.id:'',expanded,muted:false,token:'',state:'preparing',caption:'',silences:0};
  panel().dataset.level='0';
  render();
  N.beginLive(session.id);
 }
 function end(reason='',tellNative=true) {
  if(!session)return;
  const id=session.id;
  session=null;
  clearTimeout(listenTimer);clearTimeout(speechTimer);clearTimeout(pulseTimer);
  if(tellNative)N.endLive(id);
  if(job && job.voice && job.voice.id===id)stopJob('Live voice ended before this reply finished.');
  render();
  if(reason)notice(reason);
 }
 function view(expanded) {
  if(!session)return;
  if(session.mode==='walk'){if(!expanded)end();return;}
  session.expanded=expanded;
  render();
  if(!expanded)requestAnimationFrame(()=>{$('main').scrollTop=$('main').scrollHeight;});
 }
 function pauseMic(message) {
  if(!session)return;
  clearTimeout(listenTimer);
  clearTimeout(speechTimer);
  session.token='';
  session.muted=true;
  session.state='paused';
  session.caption=message||'';
  panel().dataset.level='0';
  N.muteLive(session.id);
  render();
 }
 function listen(delay=0) {
  const s=session;
  if(!s)return;
  clearTimeout(listenTimer);
  clearTimeout(speechTimer);
  if(s.muted){pauseMic('');return;}
  s.state='opening';
  s.caption='';
  s.token=M.id('listen');
  const token=s.token;
  panel().dataset.level='0';
  render();
  listenTimer=setTimeout(()=>{
   if(session===s && s.token===token && !s.muted)N.listenLive(s.id,token);
  },delay);
 }
 function mute() {
  const s=session;
  if(!s || s.state==='preparing')return;
  s.muted=!s.muted;
  if(s.muted && ['opening','listening','finishing','paused'].includes(s.state)){
   pauseMic('');return;
  }
  if(!s.muted && s.state==='paused'){s.silences=0;listen();return;}
  render();
 }
 function interrupt() {
  const s=session;
  if(!s || !['thinking','loading','speaking'].includes(s.state))return;
  clearTimeout(speechTimer);
  s.token='';
  N.interruptLive(s.id);
  if(job && job.voice && job.voice.id===s.id)stopJob('You interrupted this reply.');
  s.silences=0;
  listen(240);
 }
 function reply(active,t) {
  const s=session;
  if(!s || !active.voice || active.voice.id!==s.id || active.thread.id!==s.thread)return;
  if(t.status!=='ok'){pauseMic(t.error||'Couldn’t get a reply.');return;}
  speak(s,t.reply);
 }
 function speak(s,text) {
  s.token=M.id('speech');
  s.state='loading';
  s.caption=text;
  const token=s.token;
  render();
  N.speakLive(s.id,token,M.forSpeech(text));
  speechTimer=setTimeout(()=>{
   if(session===s && s.token===token && s.state==='loading'){
    N.interruptLive(s.id);
    pauseMic('Voice playback took too long to start. Your reply is in Chat.');
   }
  },90000);
 }
 function localCommand(text,fromMic=false){
  const s=session;if(!s)return false;
  if(!fromMic && s.state==='preparing')return false;
  const hold=Thoughts.command(text)==='hold that thought';
  if(!fromMic && s.mode==='chat' && hold && (s.state==='finishing'||(s.state==='listening'&&s.caption))){
   s.pinNext=true;notice('The next finished sentence will be pinned.');return true;
  }
  if(hold && s.unsent){text=s.unsent+' Hold that thought';}
  if(fromMic||hold)s.unsent='';
  if(fromMic && s.pinNext){s.pinNext=false;if(!Thoughts.pinRequest(text))text+=' Hold that thought';}
  const result=s.mode==='walk'?Walkthrough.handle(s,text):(fromMic&&!thread.ramble?ChatMemory.command(text,true):null)||(fromMic?Predictions.voice(s,text):null)||Studio.command(text,true)||(thread.rehearsal?null:ConversationTools.handle(text));
  if(!result)return false;
  if(session!==s)return true;
  if(!fromMic&&hold&&['thinking','loading','speaking'].includes(s.state))return true;
  if(!fromMic){
   if(job && job.voice && job.voice.id===s.id)stopJob('Stopped for a voice command.');
   N.interruptLive(s.id);
  }
  clearTimeout(speechTimer);s.token='';s.silences=0;
  if(result.say){s.endAfter=!!result.endAfter;speak(s,result.say);}
  else listen(280);
  return true;
 }
 function onEvent(id,type,token,value) {
  const s=session;
  if(!s || s.id!==id)return;
  if(type==='ended'){end(value,false);return;}
  if(type==='ready'){if(s.state==='preparing'){if(s.mode==='walk')speak(s,Walkthrough.prompt(s));else if(thread.bookmark&&!thread.ramble)speak(s,[thread.bookmark.note,thread.bookmark.next].filter(Boolean).join(' '));else listen();}return;}
  if(!token || token!==s.token)return;
  switch(type) {
   case 'level':panel().dataset.level=String(Math.min(4,Math.max(0,Number(value)||0)));return;
   case 'beat':
    panel().dataset.level='3';clearTimeout(pulseTimer);
    pulseTimer=setTimeout(()=>{if(session===s && s.token===token)panel().dataset.level='1';},130);return;
   case 'listening':s.state='listening';break;
   case 'partial':s.caption=value;break;
   case 'finishing':s.state='finishing';break;
   case 'idle':if(thread.ramble&&s.mode==='chat'&&/timed out/i.test(value)){listen(600);return;}pauseMic(value);return;
   case 'speechError':pauseMic(value);return;
   case 'quiet':
    if(s.mode==='chat'&&thread.ramble){listen(600);return;}
    if(++s.silences>=2){pauseMic('No speech heard. Resume when you’re ready.');return;}
    listen(380);return;
   case 'final':{
    const text=value.trim();
    if(s.muted || s.thread!==thread.id || !text)return;
    if(localCommand(text,true))return;
    if(job){pauseMic('Another reply is in progress.');return;}
    if(text.length>2000){pauseMic('That turn was too long to send. Try a shorter question.');return;}
    if(!N.cloud()&&!localStudy(text,thread)&&(thread.image?thread.imageMode==='text':(thread.rehearsal||thread.file||!phoneIntent(text,thread.turns[thread.turns.length-1])))){s.unsent=text;pauseMic('Cloud questions are off. Enable them in Settings for general AI questions, or resume to ask about your phone.');return;}
    s.token='';
    s.silences=0;
    s.state='thinking';
    s.caption=text;
    s.unsent='';
    if(!submitQuestion(text,'',{id:s.id,token})){pauseMic('Couldn’t send that voice turn.');return;}
    break;
   }
   case 'speaking':
    clearTimeout(speechTimer);s.state='speaking';break;
   case 'spoken':if(s.endAfter){end('Checklist complete.');return;}listen(320);return;
   default:return;
  }
  render();
 }
 return {active:()=>!!session,expanded:()=>!!(session&&session.expanded),end,menu,start,mute,interrupt,view,render,reply,onEvent,localCommand};
})();
