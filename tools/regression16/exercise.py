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
   while await ev('!!job') and time.monotonic()-start<timeout:await asyncio.sleep(.4)
   if await ev('!!job'):await ev("qaClick('send')")
   data=await ev("""(()=>{const t=thread.turns[thread.turns.length-1];return {sheet,cloud:N.cloud(),completed:t?.question===Q,status:t?.status,local:!!t?.phone,kind:t?.kind,provider:t?.provider,weather:t?.weatherData,refs:t?.memoryRefs?.length||0,sources:t?.sources?.map(s=>s.url),unavailable:t?.unavailable,actions:t?.actions?.map(a=>a.label),file:t?.savedOutput,answer:t?.kind==='memory'?document.querySelector('.turn:last-child')?.innerText:t?.reply||t?.error,dialog:sheet?document.getElementById('dialog').innerText:undefined}})()""".replace('===Q','==='+json.dumps(q)))
   if not data['completed']: data['answer']=data.get('dialog') or 'No new reply'
   row={'group':group,'question':q,'seconds':round(time.monotonic()-start,1),**data}
   with out.open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
   print(group,str(data.get('status')),q,'=>',row['answer'][:180].replace('\n',' '),flush=True)
   if data['sheet']:await click('close')
   return row
  async def fresh():
   if await ev('!!sheet'):await click('close')
   await click('new');await click('start')
   if await ev("!!sheet"):await click('discard-temp')
  async def project(name):
   await click('org-menu');await click('org-projects');await click('org-create')
   await ev("qaSet('org-name',"+json.dumps(name)+")");await click('org-save');await click('org-project-chat')
  async def child():
   await click('org-menu');await click('org-projects');await click('org-project',f'[data-id="{await ev("Organizer.projectOf(thread.id)")}"]');await click('org-project-chat')
  if await ev("sheet==='phone'"):await click('phone-finish')
  if suite.startswith('local'):
   await fresh()
   if await ev('N.cloud()'):await click('settings');await click('cloud');await click('close')
   questions=[
    'What version of Android am I running?', "What's my Android version?",'What phone am I using?','What is my battery level?', 'How much battery do I have left?', "What's my battery percentage?",'Am I charging?', 'Is my phone charging?', 'How much storage do I have left?', 'How much free space is left on my phone?', 'How much storage space do I have left?',
    'Open Wi-Fi settings','Open Bluetooth settings','Open notification settings','Open location settings','Open display settings','Open accessibility settings','Open sound settings','Open battery settings','Open Settings','Open Clock','Open an imaginary app called MoonToaster','What apps did I use recently?','What is the last app I opened?',
    'Can you tell me where I am at currently?','What location did you use for that forecast?', 'What is the weather like where I am at currently?', 'What about tomorrow?','Explain what Bluetooth is without changing settings.']
   for q in questions:await ask('Phone, permissions and controls',q)
   await project('Orchid '+str(int(time.time())))
   owner=await ev('thread.id');group=await ev('Organizer.projectOf(thread.id)')
   for q in ['Remember that my private sketchbook is teal.','Remember that the project mascot is a copper fox for this project.','What do you remember about this chat?','What do you remember about this project?','What do you remember about the mascot?','Update that to The project mascot is a silver owl.','What do you remember about the mascot?']:await ask('Memory, original chat',q)
   await child()
   for q in ['What do you remember about the mascot?','What do you remember about the sketchbook?','What do you remember about this chat?','What do you remember about the mascot?','Forget that','What do you remember about the mascot?','Remember that the launch room is Indigo Hall for this project.']:await ask('Memory, second project chat',q)
   ids={'owner':owner,'child':await ev('thread.id'),'group':group}
   (qa/('ids-'+suite+'.json')).write_text(json.dumps(ids))
   await fresh()
   for q in ['What do you remember about the launch room?','What do you remember about the private sketchbook?','Remember that the mascot is a badger for this project.']:await ask('Memory, outside project',q)
   await click('new');await click('temporary')
   for q in ['Remember that my temporary password hint is blue.','What do you remember?']:await ask('Temporary chat',q)
   await fresh();await click('org-menu');await click('open-thread',f'[data-id="{owner}"]')
   await ask('Memory, reopen original','What do you remember about the sketchbook?')
  elif suite.startswith('restart'):
   ids=json.loads((qa/('ids-'+sys.argv[2]+'.json')).read_text())
   await click('org-menu');await click('open-thread',f'[data-id="{ids["owner"]}"]')
   await ask('After process restart','What do you remember about the sketchbook?')
   await ask('After process restart','What do you remember about the launch room?')
  elif suite.startswith('cloud'):
   ids=json.loads((qa/('ids-'+sys.argv[2]+'.json')).read_text())
   if not await ev('N.cloud()'):await click('settings');await click('cloud');await click('agree')
   async def batch(group,qs):
    await fresh()
    for q in qs:await ask(group,q)
   await batch('Android OS guidance',[
    'How do I take a screenshot on a Pixel?', 'How do I use split screen with two apps on Android 16?', 'How do I make the text bigger without changing the display size?', 'How do I stop one app from sending notifications?', 'How do I see which apps can use my microphone?', 'How do I make a different app my default home launcher?', 'How do I find a file I downloaded yesterday?', 'Walk me through pairing Bluetooth headphones.', 'What should I check if an Android app keeps crashing? Please start with the least disruptive step.', 'How do I switch between gesture navigation and three buttons?', 'Can you turn off my Wi-Fi without me tapping anything?'])
   await batch('Everyday questions',[
    'What is 17 times 23? Give the number first.', 'I need 1.5 cups of rice for four people. How many cups do I need for six?', 'Draft a friendly two-sentence text saying I will be ten minutes late.', 'Give me a three-item grocery list for vegetarian tacos.', 'Explain why leaves change color in two sentences.', 'Translate “The library opens at nine” into Spanish.', 'I have eggs, rice and spinach. Suggest a 15-minute dinner.', 'Make a four-step checklist for packing for an overnight train ride.', 'Think of two names for a bookstore cat.'])
   await batch('Conversation continuity',['My fictional ferry is called Amber Comet. Reply with its name.', 'What did I call the ferry?', 'Use that name in a one-line invitation.'])
   await batch('Sources and files',['Find the official Android help page for taking a screenshot and cite the link.', 'Create a downloadable Markdown file called trip.md with three items for a train trip.'])
   await click('org-menu');await click('open-thread',f'[data-id="{ids["child"]}"]')
   for q in ['Which launch room did we pick?', 'Which color is my private sketchbook?']:await ask('Project memory in model replies',q)
  print('suite complete',suite,flush=True)
asyncio.run(main())
