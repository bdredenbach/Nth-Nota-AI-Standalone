'use strict';
const Thoughts = (() => {
 function command(text) {
  return text.toLowerCase().replace(/[’‘]/g,"'").replace(/[.,!?]+$/g,'').trim();
 }
 function sentences(text) {
  if (typeof Intl.Segmenter==='function') {
   const segmenter=new Intl.Segmenter('en',{granularity:'sentence'});
   return Array.from(segmenter.segment(text),s=>s.segment.trim()).filter(Boolean);
  }
  return (text.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)|\S+/g)||[]).map(x=>x.trim()).filter(Boolean);
 }
 // Keep the recognizer's original words and punctuation outside the command.
 function pinRequest(text) {
  if(command(text)==='hold that thought')return {text:''};
  const suffix=text.match(/^([\s\S]*?\S)(?:\s+|[,;:—]\s*)hold that thought[.!?]*$/i);
  return suffix?{text:suffix[1].replace(/[,;:—]$/,'').trim()}:null;
 }
 function recap(lines) {
  const candidates=lines.flatMap((line,index)=>sentences(line).map(text=>({text,index})));
  const selected=[],used=new Set();
  function add(row) {
   if(!row||used.has(command(row.text))||selected.length>=4)return;
   used.add(command(row.text));selected.push(row);
  }
  // Include the speaker's latest decision even when an early idea was abandoned.
  add(candidates[candidates.length-1]);
  for(const line of lines.keys())add(candidates.find(row=>row.index===line));
  candidates.forEach(add);
  return selected.sort((a,b)=>candidates.indexOf(a)-candidates.indexOf(b)).map(row=>row.text);
 }
 function paragraphs(text) {
  return Array.from(text.matchAll(/[^\r\n]+(?:\r?\n(?![ \t]*\r?\n)[^\r\n]+)*/g),m=>{
   const value=m[0].trim(),start=m.index+m[0].indexOf(value);
   return {start,end:start+value.length,text:value};
  }).filter(p=>p.text);
 }
 function ordinal(word) {
  const names=['one','two','three','four','five','six','seven','eight','nine','ten'];
  return /^\d+$/.test(word)?Number(word)-1:names.indexOf(word.toLowerCase());
 }
 return {command,sentences,pinRequest,recap,paragraphs,ordinal};
})();
if(typeof module!=='undefined')module.exports=Thoughts;
