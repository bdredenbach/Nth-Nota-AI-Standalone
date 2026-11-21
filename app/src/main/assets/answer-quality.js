'use strict';

const AnswerQuality = (() => {
 const words = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
 const number = '(?:\\d+|' + words.join('|') + ')';
 const value = s => /^\d+$/.test(s) ? Number(s) : words.indexOf(s.toLowerCase());
 const minutes = '(\\d+)[ -](?:minutes?|mins?)';

 // Only answer this self-contained request locally. A named subject, a different
 // break pattern or another constraint deserves a plan tailored to that request.
 const study = new RegExp('^(?:(?:please|can you|could you) )*(?:break|split|divide|organize|plan) (?:a |my |the )?'+minutes+' study session (?:in)?to ('+number+') (?:study |focus )?blocks?[, ]+(?:(including|with|without) (?:(?:('+number+')[ -]minute )?breaks?|no breaks))[.!?]*$','i');
 function studyPlan(q) {
  const m=q.trim().match(study);
  if(!m)return '';
  const total=Number(m[1]), blocks=value(m[2]);
  if(total<1||total>1440||blocks<1||blocks>50)return '';
  const wantsBreaks=m[3].toLowerCase()!=='without'&&!/\bno breaks\b/i.test(q);
  if(wantsBreaks&&blocks===1)return '';
  const breaks=wantsBreaks?blocks-1:0;
  const rest=breaks?(m[4]?value(m[4]):Math.min(5,Math.max(1,Math.floor(total/(blocks*3))))):0;
  const work=total-breaks*rest;
  if(work<blocks)return 'There are only '+total+' minutes available. Shorten the breaks, reduce the number of study blocks, or allow more time.';
  const steps=[];
  for(let i=0;i<blocks;i++){
   const duration=Math.floor(work/blocks)+(i<work%blocks?1:0);
   let activity='Practice from memory and check your answers.';
   if(i===0)activity='Choose a topic and review the parts you find hardest.';
   if(i===blocks-1)activity=blocks===1?'Review the topic and test what you remember.':'Test yourself and note what to revisit.';
   steps.push('- '+duration+' min — '+activity);
   if(i<breaks)steps.push('- '+rest+' min — Break. Stand up or stretch.');
  }
  return steps.join('\n')+'\n\nTotal: '+total+' minutes.';
 }

 // Other timed plans keep the model's activity choices. Parse interval rows and
 // add them here so a model-written total can never mask a budget overrun.
 function timeBudget(q) {
  if(!/\b(?:plan|schedule|break|split|divide|organize|allocate|budget)\b/i.test(q) ||
     !/\b(?:blocks?|sessions?|breaks?|agenda|schedule|workshop|meeting|workout|study plan)\b/i.test(q))return null;
  const m=q.match(/\b(\d+)[ -](?:minutes?|mins?)\b(?![ -]+(?:breaks?|blocks?|intervals?)\b)/i);
  if(!m||+m[1]<1||+m[1]>1440)return null;
  const blocks=q.match(new RegExp('\\b(?:into|across) ('+number+') (?:study |work |focus )?blocks?\\b','i'));
  const rest=q.match(new RegExp('\\b('+number+')[ -]minute breaks?\\b','i'));
  const restCount=q.match(new RegExp('\\b(?:include|including|with|plus) ('+number+') (?:'+number+'[ -]minute )?breaks?\\b','i'));
  const noBreaks=/\b(?:without|no|exclude|excluding) (?:any )?breaks?\b/i.test(q);
  return {total:+m[1],blocks:blocks&&!/\b(?:as one of|counts? as|blocks? (?:total|in all))\b/i.test(q)?value(blocks[1]):0,
   breaks:noBreaks?'none':/\b(include|including|with|plus)\b[^.!?]{0,30}\bbreaks?\b/i.test(q)?'required':'optional',
   breakCount:restCount?value(restCount[1]):null,breakMinutes:rest?value(rest[1]):null};
 }
 function intervalReply(text,budget) {
  const rows=[];
  for(const line of text.trim().split(/\r?\n/)){
   if(!line.trim())continue;
   const m=line.trim().match(/^(?:[-*] )?(work|break)\s*\|\s*(\d+)\s*\|\s*(.+)$/i);
   if(!m||!Number.isSafeInteger(+m[2])||+m[2]<1)return '';
   rows.push({break:m[1].toLowerCase()==='break',min:+m[2],activity:m[3].trim()});
  }
  const rests=rows.filter(r=>r.break),work=rows.length-rests.length;
  if(!work||rows.reduce((n,r)=>n+r.min,0)!==budget.total||budget.blocks&&work!==budget.blocks ||
     budget.breaks==='required'&&!rests.length || budget.breaks==='none'&&rests.length ||
     budget.breakCount!==null&&rests.length!==budget.breakCount ||
     budget.breakMinutes!==null&&rests.some(r=>r.min!==budget.breakMinutes))return '';
  return rows.map(r=>'- '+r.min+' min — '+(r.break?'Break: ':'')+r.activity).join('\n')+'\n\nTotal: '+budget.total+' minutes.';
 }
 const countPattern = new RegExp('\\b('+number+')[ -](?:(?:actionable|practical|concrete|essential|specific|packing|key|simple) )*(?:items?|steps?|tasks?|tips?|bullets?|things?|points?)(?:\\b|-)','i');
 function checklistSpec(q) {
  if(/\b(?:as (?:a )?(?:table|paragraph|json|csv)|in (?:table|paragraph|json|csv) (?:form|format))\b/i.test(q))return null;
  if(/\b(?:template|placeholders?|fill.in.the.blank|blank (?:list|checklist)|empty (?:list|checklist))\b/i.test(q))return null;
  const count=q.match(countPattern);
  if(!count&&!/\b(?:checklist|to-do list|packing list|grocery list|shopping list)\b/i.test(q))return null;
  return {count:count?value(count[1]):null};
 }
 function listProblem(text,spec) {
  if(!text)return 'Write the requested checklist.';
  const body=text.trim().replace(/^```(?:markdown|md)?\s*\n|\n```$/gi,'');
  const entries=body.split(/\r?\n/).map(line=>line.match(/^(\s*)(?:[-*+•]|\d+[.)])\s+(?:\[[ xX]\]\s*)?(.+?)\s*$/)).filter(Boolean);
  const depth=Math.min(...entries.map(m=>m[1].length));
  const rows=entries.filter(m=>m[1].length===depth).map(m=>m[2].replace(/[*_`]/g,'').trim().toLowerCase());
  if(!rows.length||spec.count!==null&&rows.length!==spec.count)return 'Use '+(spec.count===null?'a':('exactly '+spec.count+' entries in a'))+' Markdown list with one top-level bullet per entry.';
  if(rows.some(s=>/^(?:\[.*?\]|(?:todo|tbd|placeholder|lorem ipsum)(?:\s*[:.\-]?\s*\d+)?|(?:item|task|step|thing|entry|point)\s*(?:#?\d+|one|two|three)?)[.!…]*$/.test(s)))return 'Replace every placeholder with a specific, useful entry.';
  const keys=rows.map(s=>s.replace(/[.!?]+$/,'').replace(/\s+/g,' '));
  if(new Set(keys).size!==keys.length)return 'Give each entry a distinct purpose.';
  const labels=keys.map(s=>s.match(/^(.+?)\s+#?(\d+)$/));
  if(labels.length>1&&labels.every(m=>m&&m[1]===labels[0][1])&&labels.every((m,i)=>+m[2]===i+1))return 'Replace numbered copies of the topic with distinct, practical actions or items.';
  return '';
 }
 const intervalFormat='Return only one line per interval, in the exact form WORK | whole minutes | activity or BREAK | whole minutes | activity. Every interval including breaks counts toward the requested total. Keep the requested block count and break lengths.';
 function instructions(payload,hint) {
  if(payload.route!=='write')return payload;
  const prefix=hint+'\n\n';
  // Keep the original file, user request and memory intact at the transport limit.
  return prefix.length+payload.prompt.length<=16000?{...payload,prompt:prefix+payload.prompt}:payload;
 }
 return {studyPlan,timeBudget,intervalReply,checklistSpec,listProblem,intervalFormat,instructions};
})();
if(typeof module!=='undefined')module.exports=AnswerQuality;
