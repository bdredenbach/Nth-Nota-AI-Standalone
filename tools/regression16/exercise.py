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
  elif suite.startswith('upgrade-base'):
   await fresh();await project('Upgrade garden')
   await ask('Upgrade seed','Remember that my private flower is a violet.')
   await ask('Upgrade seed','Remember that the exhibition room is Moss Hall for this project.')
   group=await ev('Organizer.projectOf(thread.id)')
   (qa/'upgrade-id.json').write_text(json.dumps({'chat':await ev('thread.id'),'group':group}))
   for q in ["What's my Android version?",'Am I charging?','Open accessibility settings','How much storage space do I have left?','What is the last app I opened?','Can you remember what my private flower is?']:
    await ask('Original build, issue reproduction',q)
  elif suite.startswith('upgrade-new'):
   saved=json.loads((qa/'upgrade-id.json').read_text())
   assert await ev('thread.id')==saved['chat']
   await ask('Upgrade in place','What do you remember about this project?')
   await ask('Upgrade in place','What do you remember about the flower?')
   await child()
   await ask('Upgrade in place','What do you remember about the exhibition room?')
   await ask('Upgrade in place','What do you remember about the flower?')
   for q in ['Can you remember what the exhibition room is?','Do you remember the exhibition room?','Show me all my memories','What do you remember about this chat?']:
    await ask('Natural recall, new chat',q)
  elif suite.startswith('device-actions'):
   import subprocess
   def adb(*args):return subprocess.run(['adb',*args],text=True,capture_output=True,check=True,timeout=30).stdout.strip()
   def capture(label,obj):
    with (qa/'android-actions.jsonl').open('a') as f:f.write(json.dumps({'check':label,**obj})+'\n')
   await fresh()
   for q in ['Open Wi-Fi settings','Open accessibility settings','Open battery settings','Open notification settings','Open Clock']:
    row=await ask('Android action',q)
    if not row.get('actions'):capture(q,{'opened':False,'reason':row['answer']});continue
    await ev("document.querySelector('.turn:last-child [data-action=phone-action]').click()")
    await asyncio.sleep(1.1)
    resumed='\n'.join(l.strip() for l in adb('shell','dumpsys','activity','activities').splitlines() if 'topResumedActivity=' in l or 'mResumedActivity' in l)[:900]
    capture(q,{'opened':'com.nth.notaai/' not in resumed and bool(resumed),'android':resumed})
    adb('shell','input','keyevent','KEYCODE_BACK')
    adb('shell','am','start','-n','com.nth.notaai/.MainActivity')
    await asyncio.sleep(.6)
   adb('shell','appops','set','com.nth.notaai','GET_USAGE_STATS','allow')
   await ask('Usage access enabled','What apps did I use recently?')
   await ask('Usage access enabled','What is the last app I opened?')
   adb('shell','appops','set','com.nth.notaai','GET_USAGE_STATS','default')
   await click('settings');await click('phone-setup')
   await ev("qaSet('weather-city','Rochester, NY')");await click('phone-config','[data-val="city"]');await click('close')
   await ask('Saved place weather','What is the weather where I am?')
   await ask('Saved place weather','What location did you use for that forecast?')
   adb('shell','pm','grant','com.nth.notaai','android.permission.ACCESS_COARSE_LOCATION')
   adb('shell','cmd','location','set-location-enabled','true')
   await click('settings');await click('phone-setup');await click('phone-config','[data-val="follow"]');await click('close')
   adb('emu','geo','fix','-77.61','43.16')
   # Supply a network fix through Android's test provider, since this app requests coarse location.
   adb('shell','appops','set','com.android.shell','android:mock_location','allow')
   adb('shell','cmd','location','providers','add-test-provider','network')
   adb('shell','cmd','location','providers','set-test-provider-enabled','network','true')
   adb('shell','cmd','location','providers','set-test-provider-location','network','--location','43.16,-77.61')
   await asyncio.sleep(1)
   await ask('Approximate phone location','Can you tell me where I am at currently?')
   await ask('Approximate phone location','What is the weather like where I am at currently?')
   await ask('Approximate phone location','What location did you use for that forecast?')
  elif suite=='extras':
   await fresh()
   for q in ['Break a 45-minute study session into three blocks, including breaks.','Compare a PDF and a ZIP file for sending photos.','Write a polite email declining an invitation in under 45 words.','Convert 72 degrees Fahrenheit to Celsius.','Explain fractions to an eight-year-old using pizza.','I said 8 guests earlier. Now there are 12. Remember the new headcount for this conversation.','How many guests did I just say were coming?','What does RAM do in a phone?','Why might Bluetooth headphones keep disconnecting?','I deleted a photo by accident. What should I try first?']:
    await ask('Additional everyday and Android help',q)
  elif suite=='screen-image':
   import subprocess,re
   def adb(*args):return subprocess.run(['adb',*args],text=True,capture_output=True,check=True,timeout=25).stdout.strip()
   await fresh()
   if await ev('N.cloud()'):await click('settings');await click('cloud');await click('close')
   await ask('Screenshot source','What is my battery level?')
   await ev("document.activeElement?.blur()")
   await asyncio.sleep(.5)
   file='/sdcard/Pictures/nota-qa-screen.png'
   adb('shell','screencap','-p',file)
   adb('shell','am','broadcast','-a','android.intent.action.MEDIA_SCANNER_SCAN_FILE','-d','file://'+file)
   for _ in range(16):
    listing=adb('shell','content','query','--uri','content://media/external/images/media','--projection','_id:_display_name')
    line=next((x for x in listing.splitlines() if 'nota-qa-screen.png' in x),'')
    mediaid=re.search(r'_id=(\d+)',line)
    if mediaid:break
    await asyncio.sleep(.4)
   assert mediaid,'No screenshot in MediaStore'
   adb('shell','am','start','-n','com.nth.notaai/.MainActivity','-a','android.intent.action.SEND','-t','image/png','--grant-read-uri-permission','--eu','android.intent.extra.STREAM','content://media/external/images/media/'+mediaid[1])
   for _ in range(50):
    if await ev('!!thread.image'):break
    await asyncio.sleep(.4)
   assert await ev('!!thread.image'),'Android share did not attach the screenshot'
   await ask('Shared screenshot, cloud off','What battery percentage is visible in this screenshot?')
  elif suite.startswith('file-pick'):
   import subprocess,zipfile,xml.etree.ElementTree as ET,re
   def adb(*args,check=True):return subprocess.run(['adb',*args],text=True,capture_output=True,check=check,timeout=30).stdout.strip()
   async def waitfor(js):
    for i in range(100):
     if await ev(js):return
     await asyncio.sleep(.25)
    raise RuntimeError('Timed out on '+js)
   await fresh()
   if not await ev('N.cloud()'):await click('settings');await click('cloud');await click('agree')
   with zipfile.ZipFile(qa/'notaqa-brief.zip','w') as archive:archive.writestr('brief.md','# Orchard rehearsal\nMeet in Harbor Hall. Bring the paper lantern.\n')
   adb('push',str(qa/'notaqa-brief.zip'),'/sdcard/Download/notaqa-brief.zip')
   adb('shell','am','broadcast','-a','android.intent.action.MEDIA_SCANNER_SCAN_FILE','-d','file:///sdcard/Download/notaqa-brief.zip')
   await click('attach');await click('pick-file')
   await asyncio.sleep(.4)
   if await ev("sheet==='file-source'"):await click('fs-device')
   for _ in range(10):
    adb('shell','uiautomator','dump','/sdcard/qa-ui.xml',check=False)
    xml=adb('shell','cat','/sdcard/qa-ui.xml',check=False)
    if not xml.startswith('<?xml'):continue
    nodes=ET.fromstring(xml).findall('.//node')
    def tap(n):
     x,y,u,v=map(int,re.findall(r'\d+',n.get('bounds','')));adb('shell','input','tap',str((x+u)//2),str((y+v)//2))
    target=next((n for n in nodes if n.get('text')=='notaqa-brief.zip'),None)
    if target is not None:tap(target);break
    target=next((n for n in nodes if n.get('text')=='Downloads' and n.get('resource-id','').endswith('title')),None)
    if target is None:target=next((n for n in nodes if 'roots' in n.get('content-desc','').lower() or 'navigation' in n.get('content-desc','').lower()),None)
    if target is not None:tap(target)
    await asyncio.sleep(.7)
   await waitfor("!!thread.file")
   await ask('Android ZIP picker','What item should we bring and where do we meet?')
   row=await ask('Revise ZIP member','Change Harbor Hall to Cedar Hall. Keep the item and formatting unchanged.')
   if not row['completed']:
    await waitfor("!job && thread.turns.at(-1)?.status==='ok' && !!thread.documents[thread.file]?.editTarget")
   await waitfor("!!document.querySelector('[data-action=fs-review]')")
   await ev("document.querySelector('[data-action=fs-review]').click()");await click('fs-commit')
   await waitfor("thread.documents[thread.file]?.name.includes('v2')")
   await fresh();await ask('Version comparison','Compare v1 and v2 of notaqa-brief.zip.')
   await waitfor("!!document.querySelector('#dialog [data-action=fs-use-comparison]')")
   await click('fs-use-comparison');await waitfor("!!thread.file")
   await ask('Compare ZIP across chats','Which room changed, and what item stayed the same?')
  print('suite complete',suite,flush=True)
asyncio.run(main())
