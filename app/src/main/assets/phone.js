'use strict';
// Only a direct user request can enter a device route. Attachments and model replies are never inspected.
function phoneIntent(question, previous) {
 const q=String(question).trim().replace(/[’‘]/g,"'").replace(/[?!.]+$/g,'').trim()
  .replace(/^(?:(?:hey|hi)[, ]+(?:nth )?nota[, ]+|(?:nth )?nota[, ]+)/i,'')
  .replace(/^(?:please |(?:can|could|would|will) you (?:please )?)/i,'').replace(/,? please$/i,'').trim();
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
if(typeof module!=='undefined'){module.exports=phoneIntent;module.exports.forecastAreaReply=forecastAreaReply;}
