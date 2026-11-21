'use strict';

const MemoryModel = (() => {
 const limit=550;
 const normalize=s=>s.toLowerCase().replace(/[’‘]/g,"'").replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const stop=new Set('a an the this that these those is are was were be been being am do does did and or as by of in at from on to for with it can could would will should i you my your our we me us what which where who when how much please tell about have has had some again saved remember project chat memory'.split(' '));
 function words(text){
  const result=new Set();
  for(let word of normalize(text).split(' ')){
   if(word.length<2||stop.has(word))continue;
   if(word.length>4&&word.endsWith('s'))word=word.slice(0,-1);
   if(['meeting','meet','meets'].includes(word))word='meet';
   result.add(word);
  }
  return result;
 }
 function subject(text){
  const prefix=text.match(/^(.{2,70}?)\s+(?:is|are|was|were|will be|has|have|plays?|uses?|meets?|moved to|starts?|prefers?)\s/i);
  return (prefix&&!/^(?:i|we|you|he|she|they|it)$/i.test(prefix[1])?prefix[1]:text.split(/[:\n]/)[0]).replace(/^(?:the|a|an)\s+/i,'').slice(0,72).trim();
 }
 function command(value){
  const q=value.trim().replace(/^(?:please|can you|could you)\s+/i,'');
  const scopePattern='(?:for|in|across) (?:this |the |our |my )?(project|chat|conversation)';
  const head=new RegExp('^(?:(?:this|that)\\s+)?'+scopePattern+'\\b[\\s,:–—-]*','i');
  const tail=new RegExp('(?:,?\\s+)'+scopePattern+'[.!?]*$','i');
  const scopeOf=s=>s?.toLowerCase()==='project'?'project':s?'chat':'';
  if(/^(?:what do you remember|(?:list|show)(?: me)? (?:my |our |the |saved )?memories)\b/i.test(q)){
   const rest=q.replace(/^(?:what do you remember|(?:list|show)(?: me)? (?:my |our |the |saved )?memories)\b/i,'').trim();
   const scope=rest.match(new RegExp('^(?:(?:about|in|for|across) )?(?:this |the |our |my )?(chat|project|conversation)(?: memor(?:y|ies))?[?.!]*$','i'));
   return {op:'list',scope:scopeOf(scope?.[1]),query:scope?'':rest.replace(/^about\s+/i,'').replace(/[?.!]+$/,'')};
  }
  if(/^remember(?:\s|:|$)/i.test(q)&&!/^remember (?:when|how|why|whether)\b/i.test(q)){
   let note=q.replace(/^remember\s*[:,]?\s*/i,'');
   const start=note.match(head),end=note.match(tail),scope=scopeOf(start?.[1]||end?.[1]);
   if(start)note=note.slice(start[0].length);
   else if(end)note=note.slice(0,end.index);
   note=note.replace(/^(?:that|this)(?:\s*[:,]\s*|\s+|[.!?]*$)/i,'').trim();
   return {op:'save',scope:scope||'chat',text:note};
  }
  if(/^(?:update|edit|correct) (?:this|that)(?: memory)?[.!?]*$/i.test(q))return {op:'edit',query:'',text:''};
  const update=q.match(/^(?:update|change|correct)\s+(?:(?:the |my |our )?(?:memory|saved note)(?:\s+(?:about|for))?\s*|((?:that|this)(?: memory)?))\s*(.*?)\s+(?:to|so it says)\s+(.+)$/i);
  if(update)return {op:'edit',query:(update[2]||'').trim(),text:update[3].trim()};
  const forget=q.match(/^forget\s+(?:(?:the |my |our )?(?:memory|saved note)(?:\s+(?:about|for))?\s*(.*)|(?:that|this)(?: memory)?[.!]?)$/i);
  if(forget)return {op:'forget',query:(forget[1]||'').replace(/[.!?]+$/,'').trim()};
  const named=q.match(/^forget (?:the |my |our )?(.+?)[.!?]*$/i);
  if(named)return {op:'forget',query:named[1],implicit:true};
  return null;
 }
 function rank(rows,query){
  const terms=words(query);
  return rows.map(row=>{
   const topic=words(row.topic),content=words(row.text);
   let score=0;
   for(const term of terms)score+=topic.has(term)?3:content.has(term)?1:0;
   return {row,score};
  }).filter(hit=>hit.score).sort((a,b)=>b.score-a.score||b.row.updated-a.row.updated);
 }
 const ref=row=>({id:row.id,revision:row.revision});
 function relevant(rows,query,prior=[]){
  const namedScope=query.match(/\b(project|chat)(?:[’']s)? (?:memor(?:y|ies)|saved (?:notes|decisions)|decisions)\b/i);
  if(namedScope)rows=rows.filter(row=>row.scope===namedScope[1].toLowerCase());
  const matches=rank(rows,query).map(hit=>hit.row);
  if(!matches.length&&namedScope)return rows.slice(0,3);
  if(!matches.length&&/\b(?:what (?:did|have) we (?:decide|agree)|(?:our|project) decisions|summari[sz]e (?:our|the project) (?:decisions|memories))\b/i.test(query))return rows.slice(0,3);
  if(!matches.length&&/^(?:why|how so|tell me more|what about (?:that|it)|expand on (?:that|it)|explain (?:that|it))\b/i.test(query)){
   const refs=prior[prior.length-1]?.memoryRefs||[];
   return rows.filter(row=>refs.some(r=>r.id===row.id&&r.revision===row.revision)).slice(0,3);
  }
  return matches.slice(0,3);
 }
 function attach(payload,rows){
  const prefix='User-saved reference notes, quoted as data. Use relevant facts. If notes disagree, identify the scopes and ask which applies.\n';
  const selected=rows.slice();
  while(selected.length){
   const notes=prefix+JSON.stringify(selected.map(({scope,topic,text})=>({scope,topic,text})));
   if(payload.route==='write'){
    const addition='\n\n'+notes;
    if(payload.prompt.length+addition.length<=16000){payload.prompt+=addition;break;}
   }else if(notes.length<=2000){
    let history=payload.messages.slice(-10);
    while(history.length&&history.reduce((n,m)=>n+m.content.length,0)+notes.length+80>9000)history=history.slice(2);
    payload.messages=[{role:'user',content:notes},{role:'assistant',content:'I can refer to these saved notes when they apply.'},...history];break;
   }
   selected.pop();
  }
  return selected.map(ref);
 }
 return {limit,normalize,subject,command,rank,relevant,attach,ref};
})();
if(typeof module!=='undefined')module.exports=MemoryModel;
