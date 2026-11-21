'use strict';
// Short, offline answers to common Android how-to questions. Match the whole request
// so that comparisons, troubleshooting symptoms and unrelated follow-ups still go to chat.
const phoneGuides=[
 {key:'screenshot',match:/^(?:how (?:do|can) i (?:take|capture) (?:a )?screenshot(?: on (?:my |a )?(?:pixel(?: phone| \d+)?|android(?: phone)?))?|find the official android help page for taking a screenshot and cite the link)$/i,
  text:'Press Power and Volume Down together, then release. Tap the preview to edit or share it. For a longer page, tap Capture more if it appears.',page:'android/answer/9075928',title:'Google Android Help · Take a screenshot'},
 {key:'split',match:/^(?:how (?:do|can) i (?:use (?:split[- ]screen(?: with two apps)?|two apps (?:at once|side by side))|split (?:my|the) screen)(?: on (?:my |a )?(?:android(?: \d+)?|pixel(?: phone| \d+)?))?)$/i,
  text:'On a Pixel, open the first app. Swipe up from the bottom and hold to see recent apps, or tap Overview with three-button navigation. Tap the app icon above its preview, choose Split screen, then select the second app. Some apps do not support split screen.',page:'pixelphone/answer/7444033',title:'Google Pixel Help · Use two apps at once'},
 {key:'microphone',match:/^(?:how (?:do|can) i (?:see|check) which apps (?:can (?:use|access)|have access to) (?:my|the) microphone)$/i,
  text:'On a Pixel, open Settings and search for Permission manager. Choose Microphone to see which apps have access. Tap an app to review its permission.',page:'pixelphone/answer/6293419',title:'Google Pixel Help · App permissions'},
 {key:'launcher',match:/^how (?:do|can) i (?:make a different app my default (?:home )?launcher|change (?:my|the) default (?:home app|launcher))$/i,
  text:'Open Settings, choose Apps, then Default apps and Home app. Select the installed launcher you want to use.',page:'pixelphone/answer/6271667',title:'Google Pixel Help · Default apps',setting:'home',label:'Home app settings'},
 {key:'downloads',match:/^(?:how (?:do|can) i find (?:a file i downloaded(?: (?:today|yesterday))?|my downloads)|where (?:are my downloads|do i find my downloaded files))$/i,
  text:'Open Files and look under Downloads. Sort by date to find a recent download, or search by filename. Media saved for offline use in a streaming app may appear only inside that app.',page:'pixelphone/answer/2781972',title:'Google Pixel Help · Find files'},
 {key:'pair',match:/^(?:(?:walk me through pairing|how (?:do|can) i (?:pair|connect)) (?:my |a pair of )?(?:bluetooth|wireless) (?:headphones|earbuds)(?: (?:with|to) my phone)?)$/i,
  text:'Put the headphones in pairing mode. Open Bluetooth settings, turn Bluetooth on, and choose Pair new device. Tap the headphones when their name appears and confirm the pairing.',page:'pixelphone/answer/2819579',title:'Google Pixel Help · Pair a Bluetooth device',setting:'bluetooth',label:'Bluetooth settings'},
 {key:'crashing',match:/^(?:what (?:should|can) i (?:check|try|do) if (?:an? |my )(?:android )?app keeps crashing|how (?:can|do) i fix an? (?:android )?app that keeps crashing)(?:[.?] *please start with the least disruptive step)?$/i,
  text:'Start by reopening the app. If it crashes again, restart your phone and try once more. Then check the Play Store for an update to that app. These steps keep its saved data.',page:'pixelphone/answer/9454904',title:'Google Pixel Help · Fix an app that keeps crashing'},
 {key:'navigation',match:/^how (?:do|can) i (?:switch between gesture navigation and (?:three|3)[- ]buttons?|change (?:my |the )?navigation mode)(?: on (?:my |a )?pixel)?$/i,
  text:'On a Pixel, open Settings, then System and Navigation mode. Select Gesture navigation or 3-button navigation.',page:'pixelphone/answer/6073614',title:'Google Pixel Help · Navigation mode'},
 {key:'font',match:/^how (?:do|can) i (?:make (?:the |my )?text (?:bigger|larger)|increase (?:the |my )?font size)(?: without changing (?:the )?display size)?$/i,
  text:'In Settings, search for Font size. Move the Font size slider to the right and check the preview. Leave the Display size slider where it is to keep other screen elements the same size.',page:'accessibility/android/answer/11183305',title:'Google Android Help · Text and display size'},
 {key:'wifi-switch',match:/^(?:turn|switch) (?:off|on) (?:my |the )?wi-?fi(?: without (?:me tapping anything|my help))?$/i,
  text:'I can open Wi-Fi settings for you. Tap the button below, then use the Wi-Fi switch.',setting:'wifi',label:'Wi-Fi settings'}
];
function phoneGuideReply(key){
 const guide=phoneGuides.find(row=>row.key===key);
 if(!guide)return null;
 return {text:guide.text,sources:guide.page?[{url:'https://support.google.com/'+guide.page,title:guide.title}]:[],
  actions:guide.setting?[{type:'setting',value:guide.setting,label:guide.label}]:[]};
}
// Only a direct user request can enter a device route. Attachments and model replies are never inspected.
function phoneIntent(question, previous) {
 const q=String(question).trim().replace(/[’‘]/g,"'").replace(/[?!.]+$/g,'').trim()
  .replace(/^(?:(?:hey|hi)[, ]+(?:nth )?nota[, ]+|(?:nth )?nota[, ]+)/i,'')
  .replace(/^(?:please |(?:can|could|would|will) you (?:please )?)/i,'').replace(/,? please$/i,'').trim();
 const guide=phoneGuides.find(row=>row.match.test(q));
 if(guide)return {type:'guide',value:guide.key};
 const placeQuestion=q.replace(/^(?:tell me|show me|give me|do you know|check|find)\s+/i,'')
  .replace(/\b(?:currently|right now|at the moment)\b/gi,'').replace(/\s+/g,' ').trim();
 if(/^(?:where (?:am i|i am|i'm)(?: at| located)?|(?:what|which) (?:city|town|area|state) (?:am i in|i am in|i'm in)|(?:(?:what(?:'s| is)|where(?:'s| is)) )?my (?:current |approximate )?(?:location|position))$/i.test(placeQuestion))return {type:'location'};
 const forecastQuestion=placeQuestion.replace(/\b(?:(?:that|this|the last|the|my|your) )?(?:weather forecast|weather report|forecast|weather)\b/gi,'forecast');
 if(/^(?:what|which) (?:location|area|city|town|place|zip(?: code)?) (?:did you use (?:to get|for) forecast|was used for forecast|did forecast use|(?:was|is) forecast (?:for|based on))$/i.test(forecastQuestion)||
    /^(?:where (?:was|is) forecast for|where did you get forecast for|what(?:'s| is) the location (?:of|for) forecast)$/i.test(forecastQuestion))return {type:'forecastArea'};
 if(previous?.weatherData&&/^(?:(?:what|which) (?:location|area|city|place|zip(?: code)?) (?:did you use|was that(?: for)?)|where was that(?: for)?)$/i.test(placeQuestion))return {type:'forecastArea'};
 if(/^(?:how much (?:battery|charge) (?:do i have|is) left|how much battery (?:do i have|is left)|is (?:my|this) (?:phone|device) charging|am i charging)$/i.test(q))return {type:'battery'};
 if(/^(?:what(?:'s| is) (?:my|this phone(?:'s)?|my phone(?:'s)?) android version|what (?:phone|device) (?:am i using|do i have|is this)|what (?:android version|version of android) (?:am i (?:using|running)|is this|do i have)|show (?:my )?phone info)$/i.test(q))return {type:'device'};
 if(/^(?:how much (?:free )?(?:storage(?: space)?|space) (?:do i have(?: left)?|is (?:free|left|available))(?: on my phone)?|show (?:my )?(?:free |available )?storage)$/i.test(q))return {type:'storage'};
 if(/^(?:(?:tell|show|give) me |check )?(?:(?:what(?:'s| is)|how(?:'s| is)) )?(?:my |the |my phone(?:'s)? |this phone(?:'s)? )?(?:battery(?: level| percentage| percent| status)?)(?: (?:right now|at|on my phone))?$/i.test(q))return {type:'battery'};
 if(/^(?:(?:what(?:'s| is| was)|which (?:is|was)) (?:the |my )?last app i (?:opened|used)|(?:which|what) app did i (?:open|use) last)$/i.test(q))return {type:'recent',latest:true};
 if(/^(?:(?:show(?: me)?|tell me|list) |what (?:were|are) |which )?(?:my |the )?(?:recent(?:ly (?:opened|used))? apps|apps (?:i(?:'ve| have)? (?:recently |last )?(?:opened|used)(?: recently)?|used recently))(?: on (?:my|this) phone)?$/i.test(q) || /^(?:(?:which|what) (?:apps? (?:did|have) i (?:use|open)(?:d)? (?:recently|last)|(?:was )?the last app i (?:opened|used)))$/i.test(q))return {type:'recent'};
 let match=q.match(/^(?:open|launch|start|take me to) (.{1,70})$/i);
 if(match&&!/[;\n]/.test(match[1])&&!/\b(?:and then|and tell|and open|then|https?)\b/i.test(match[1])){
  const name=match[1].replace(/^(?:the |my )/i,'').replace(/ app$/i,'').trim();
  const key=name.toLowerCase().replace(/[- ]/g,'');
  const settings={settings:'phone',phonesettings:'phone',androidsettings:'phone',wifisettings:'wifi',wifi:'wifi',bluetoothsettings:'bluetooth',bluetooth:'bluetooth',accessibilitysettings:'accessibility',storagesettings:'storage',appsettings:'apps',locationsettings:'location',displaysettings:'display',batterysettings:'battery',batterysaversettings:'saver',soundsettings:'sound',notificationsettings:'notifications'};
  return settings[key]?{type:'setting',value:settings[key]}:{type:'app',value:name};
 }
 if(previous&&previous.wx && /^(?:(?:and|how about|what about) )?(tomorrow|today|right now)(?: then)?$/i.test(q))
  return {type:'weather',value:previous.wx.value||'',period:/tomorrow/i.test(q)?'tomorrow':/today/i.test(q)?'today':'now'};
 let w=q.replace(/^(?:(?:tell|show|give) me |check |look up )/i,'').replace(/^(?:what(?:'s| is)|how(?:'s| is)) /i,'')
  .replace(/^(?:today's|tomorrow's) (?=(?:weather|forecast))/i,'').replace(/^(?:the |my |local |current )+/i,'');
 match=w.match(/^(weather(?: forecast)?|forecast|temperature)(?: like)?(?:\s+(.*))?$/i);
 if(/\b(?:yesterday|this week|next week|weekend|next month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tonight|hourly|history|historical|last year)\b/i.test(q))return null;
 if(!match && !/^(?:is it (?:raining|snowing|cold|hot)|will it (?:rain|snow)|do i need (?:a jacket|an umbrella))(?: (?:here|today|tomorrow|right now|outside))*$/i.test(q))return null;
 let tail=match?(match[2]||''):'';
 const period=/\btomorrow\b/i.test(q)?'tomorrow':/\btoday\b/i.test(q)?'today':'now';
 tail=tail.replace(/^like\s*/i,'').replace(/\b(?:right now|today|tomorrow|currently)\b/gi,'').replace(/\s+/g,' ').trim();
 if(tail==='for')tail='';
 if(/^(?:(?:for|in|at|around|near) )?(?:here|me|my (?:current )?(?:location|area)|where i(?:'m| am)(?: at)?|where i live|outside|locally)$/i.test(tail))tail='';
 const place=tail.match(/^(?:in|for|at|near) ([\p{L}\p{M}\d][\p{L}\p{M}\d ,.'-]{0,85})$/iu);
 if(tail&&!place)return null;
 return {type:'weather',value:place?place[1]:'',period};
}
// The native weather answer is the source. Never reconstruct a past forecast from today's settings.
function forecastAreaReply(turn){
 if(!turn)return 'There isn’t a completed local forecast in this chat yet.';
 if(turn.forecastArea)return turn.forecastArea;
 // Builds before 0.12 saved the displayed label, but no separate area record.
 const match=(turn.reply||'').match(/^The forecast for (.+?) is -?\d+°[FC]\b|^(?:Today|Tomorrow) in (.+?), the available hourly forecast/i);
 const label=match&&(match[1]||match[2]);
 if(label==='your current area')return 'That forecast used your phone’s approximate location. The city name wasn’t saved with that forecast.';
 if(label)return 'That forecast was for '+label+'.';
 return 'The location wasn’t saved with that forecast.';
}
if(typeof module!=='undefined'){module.exports=phoneIntent;module.exports.forecastAreaReply=forecastAreaReply;module.exports.phoneGuideReply=phoneGuideReply;}
