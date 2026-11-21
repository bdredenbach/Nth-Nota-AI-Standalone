"""Drive the installed Nota WebView through its actual composer and buttons."""
import asyncio,json,os,pathlib,sys,time,urllib.request,websockets
qa=pathlib.Path(os.environ.get('QA_DIR',str(pathlib.Path(__file__).resolve().parent)))
suite=sys.argv[1]; out=qa/(suite+'.jsonl');timeout=int(os.environ.get('TURN_LIMIT','112'))
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
counter=0
async def main():
 global counter
 for _ in range(90):
  try:
   pages=json.loads(opener.open('http://127.0.0.1:9227/json/list',timeout=5).read())
   target=next(p for p in pages if 'index.html' in p['url']);break
  except Exception:await asyncio.sleep(2)
 else:raise RuntimeError('App WebView did not appear')
 async with websockets.connect(target['webSocketDebuggerUrl'],open_timeout=30,ping_interval=None,max_size=4*1024*1024) as ws:
  async def ev(code):
   global counter
   counter+=1;rid=counter
   await ws.send(json.dumps({'id':rid,'method':'Runtime.evaluate','params':{'expression':code,'awaitPromise':True,'returnByValue':True}}))
   while True:
    msg=json.loads(await asyncio.wait_for(ws.recv(),140))
    if msg.get('id')==rid:break
   d=msg.get('result',{})
   if d.get('exceptionDetails'):raise ValueError(str(d['exceptionDetails'])[:750])
   return d.get('result',{}).get('value')
  for _ in range(80):
   if await ev("typeof window.notaEvent==='function' && typeof thread!=='undefined'"):break
   await asyncio.sleep(1)
  jshelpers="""window.qaClick=(act,data='')=>{const root=sheet?document.getElementById('dialog'):document.getElementById('app');const e=root.querySelector('[data-action="'+act+'"]'+data);if(!e)throw Error('No '+act+' in '+sheet+' / '+page);e.click();};window.qaSet=(id,value)=>{const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));};void 0"""
  await ev(jshelpers)
  async def click(action,sel=''):await ev(f'qaClick({json.dumps(action)},{json.dumps(sel)})')
  async def ask(group,q):
   await ev("qaSet('question',"+json.dumps(q)+");qaClick('send')")
   start=time.monotonic()
   for _ in range(28):
    if await ev("!!job||!!sheet||thread.turns[thread.turns.length-1]?.question==="+json.dumps(q)):break
    await asyncio.sleep(.15)
   while await ev('!!job') and time.monotonic()-start<timeout:await asyncio.sleep(.4)
   if await ev('!!job'):await ev("qaClick('send')")
   data=await ev("""(()=>{const t=thread.turns[thread.turns.length-1];return {sheet,cloud:N.cloud(),completed:t?.question===Q,status:t?.status,local:!!t?.phone,kind:t?.kind,provider:t?.provider,weather:t?.weatherData,refs:t?.memoryRefs?.length||0,sources:t?.sources?.map(s=>s.url),unavailable:t?.unavailable,actions:t?.actions?.map(a=>a.label),file:t?.savedOutput,imageMethod:t?.imageMethod,imageTextFallback:t?.canAskText,answer:t?.kind==='memory'?document.querySelector('.turn:last-child')?.innerText:t?.reply||t?.error,dialog:sheet?document.getElementById('dialog').innerText:undefined}})()""".replace('===Q','==='+json.dumps(q)))
   if not data['completed']: data['answer']=data.get('dialog') or 'No new reply'
   row={'group':group,'question':q,'seconds':round(time.monotonic()-start,1),**data}
   with out.open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
   print(group,str(data.get('status')),q,'=>',(row.get('answer') or '')[:180].replace('\n',' '),flush=True)
   if data['sheet'] and q!='Compare v1 and v2 of notaqa-brief.zip.':await click('close')
   return row
  async def fresh():
   if await ev('!!sheet'):await click('close')
   await click('new');await click('start')
   if await ev("!!sheet"):await click('discard-temp')
  async def wait_for(expr):
   for _ in range(100):
    if await ev(expr):return
    await asyncio.sleep(.15)
   raise AssertionError(expr)
  if await ev("sheet==='phone'"):await click('phone-finish')
  if suite=='reliability':
   import re
   await fresh()
   if await ev('N.cloud()'):await click('settings');await click('cloud');await click('close')
   timed=await ask('On-device study schedule','Break a 45-minute study session into three blocks, including breaks.')
   assert timed['status']=='ok' and not timed['cloud']
   assert [int(x) for x in re.findall(r'^- (\d+) min',timed['answer'],re.M)]==[12,5,12,5,11]
   await click('settings');await click('cloud');await click('agree')
   row=await ask('Generate a saved checklist','Create a downloadable Markdown file called trip.md with three items for a train trip.')
   assert row['status']=='ok' and not row['unavailable'],row
   await wait_for('!!thread.turns.at(-1).savedOutput')
   file=await ev('thread.turns.at(-1).savedOutput')
   assert await ev('JSON.parse(N.savedFiles()).filter(f=>f.name==="trip.md").length')==1
   assert len(re.findall(r'^(?:[-*+] |\d+[.)] )',row['answer'],re.M))==3
   assert not re.search(r'Train Trip [123]|^[-*] (?:Item|Step|TODO) \d+\s*$',row['answer'],re.M|re.I)
   assert re.search(r'ticket|platform|luggage|bag|station|departure|charg|snack|water|board|reservation|identification',row['answer'],re.I)
   (qa/'trip.json').write_text(json.dumps({'file':file,'owner':await ev('thread.id'),'body':row['answer']}))
   await fresh()
   plan=await ask('Tailored workshop with two fixed breaks','Plan a 50-minute drawing workshop into three blocks with two 5-minute breaks.')
   assert plan['status']=='ok' and sum(map(int,re.findall(r'^- (\d+) min',plan['answer'],re.M)))==50,plan
   assert len(re.findall(r'^- 5 min — Break:',plan['answer'],re.M))==2
  elif suite=='reopen':
   trip=json.loads((qa/'trip.json').read_text())
   await fresh()
   assert await ev('thread.id')!=trip['owner']
   await ev("qaSet('question','Use trip.md to tell me what I actually need to do before boarding.');qaClick('send')")
   await wait_for("sheet==='file-reference'")
   await click('fs-use',f'[data-id="{trip["file"]}"]')
   await wait_for('!!thread.file && !sheet')
   attached=await ev('thread.documents[thread.file]')
   assert attached['savedId']==trip['file'] and attached['body'].strip()==trip['body'].strip(),attached
   follow=await ask('Second chat using the persisted checklist','What do I actually need to do before boarding?')
   assert follow['status']=='ok' and not follow['unavailable'] and len(follow['answer'])>35
  print('suite complete',suite,flush=True)
asyncio.run(main())
