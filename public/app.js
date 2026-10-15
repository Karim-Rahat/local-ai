import {LocalAI} from '/sdk.mjs';
import {splitCodeBlocks} from '/code-blocks.mjs';
import {renderCode} from '/syntax.js';
const $=id=>document.getElementById(id), ai=new LocalAI({baseURL:location.origin});
const icons={
  copy:'<rect x="9" y="9" width="11" height="12" rx="2"/><path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  arrow:'<path d="M12 19V5m-6 6 6-6 6 6"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  smile:'<circle cx="12" cy="12" r="9"/><path d="M8 14a4 4 0 0 0 8 0M8 9h.01M16 9h.01"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  compose:'<path d="M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7M16 3l5 5M10 14l-1 4 4-1L22 8a2 2 0 0 0-5-5Z"/>',
  sidebar:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>',
  export:'<path d="M12 15V3m-4 4 4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  settings:'<path d="m9 3-1 3-3 1-2 4 2 2v3l3 2 1 3h6l1-3 3-2v-3l2-2-2-4-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>'
};
function icon(name){return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.copy}</svg>`;}
for(const element of document.querySelectorAll('[data-icon]'))element.innerHTML=icon(element.dataset.icon);
function copyButton(getText,label='Copy response',compact=false){
  const button=document.createElement('button');button.type='button';button.className='copy'+(compact?' code-copy':'');
  const reset=()=>{button.innerHTML=icon('copy')+(compact?'<span>Copy code</span>':'');button.setAttribute('aria-label',label);button.title=label;};
  reset();button.onclick=async()=>{try{await navigator.clipboard.writeText(getText());button.innerHTML=icon('check')+(compact?'<span>Copied!</span>':'');button.setAttribute('aria-label','Copied');$('copy-status').textContent=label==='Copy code'?'Code copied to clipboard':'Message copied to clipboard';setTimeout(reset,1800);}catch{$('notice').textContent='Clipboard access was blocked. Select the text and press Ctrl+C to copy.';}};
  return button;
}
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
let chats=read('local-chats',[]),prefs=read('local-prefs',{theme:'light',system:'',temperature:0.7}),current=null,controller=null;
if(!Array.isArray(chats))chats=[];
function cache(){try{localStorage.setItem('local-chats',JSON.stringify(chats));}catch{$('notice').textContent='Browser storage is full. Export your chat to keep a copy.';}}
let writes=Promise.resolve(),loadingHistory=true;
async function historyRequest(path,options){const response=await fetch(path,options);const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to save conversation');return data;}
function enqueueWrite(task){writes=writes.catch(()=>{}).then(task);writes.catch(error=>{$('notice').textContent=error.message+' A backup remains in this browser.';});return writes;}
function save(){cache();if(!current)return;const snapshot=JSON.stringify(current);enqueueWrite(()=>historyRequest('/api/conversations',{method:'PUT',headers:{'Content-Type':'application/json'},body:snapshot}));}
function deleteSaved(id){enqueueWrite(()=>historyRequest('/api/conversations/'+id,{method:'DELETE'}));}
async function loadHistory(){
  try{
    const stored=await historyRequest('/api/conversations');
    const ids=new Set(stored.map(chat=>chat.id));
    const legacy=chats.filter(chat=>!ids.has(chat.id));
    for(const chat of legacy)await historyRequest('/api/conversations',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(chat)});
    chats=[...stored,...legacy];cache();render();
  }catch(error){$('notice').textContent=error.message+' Existing chats remain in this browser.';}
  finally{loadingHistory=false;}
}
function applyTheme(){document.documentElement.dataset.theme=prefs.theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):prefs.theme;}
applyTheme();matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);
function history(filter=''){$('history').replaceChildren();for(const chat of [...chats].reverse().filter(c=>c.title.toLowerCase().includes(filter.toLowerCase()))){const row=document.createElement('div');row.className='history-row'+(chat.id===current?.id?' active':'');const open=document.createElement('button');open.textContent=chat.title;open.onclick=()=>{if(controller)return;current=chat;render();document.body.classList.remove('sidebar-open');};const del=document.createElement('button');del.className='delete';del.textContent='×';del.setAttribute('aria-label',`Delete ${chat.title}`);del.onclick=()=>{if(controller||loadingHistory)return;if(!confirm('Delete this conversation?'))return;deleteSaved(chat.id);chats=chats.filter(c=>c.id!==chat.id);if(current===chat)current=null;cache();render();};row.append(open,del);$('history').append(row);}}
function format(node,text){
  node.replaceChildren();
  for(const part of splitCodeBlocks(text)){
    if(part.type==='code'){
      const block=document.createElement('div');block.className='code-block';
      const toolbar=document.createElement('div');toolbar.className='code-toolbar';
      const language=document.createElement('span');language.className='code-language';
      const pre=document.createElement('pre'),code=document.createElement('code');
      const name=renderCode(code,part.content,part.language);
      const terminal=name==='PowerShell'||name==='CMD'||['bash','sh','shell','zsh'].includes(part.language);
      block.classList.toggle('terminal-code',terminal);
      const glyph=document.createElement('span');glyph.className='code-glyph';glyph.textContent=terminal?'>_':'</>';
      language.append(glyph,document.createTextNode(name));
      toolbar.append(language,copyButton(()=>part.content,'Copy code',true));pre.append(code);block.append(toolbar,pre);node.append(block);
    }else{
      for(const inline of part.content.split(/(`[^`\n]+`|\*\*[^*]+\*\*)/g)){
        if(inline.startsWith('`')){const code=document.createElement('code');code.textContent=inline.slice(1,-1);node.append(code);}
        else if(inline.startsWith('**')){const strong=document.createElement('strong');strong.textContent=inline.slice(2,-2);node.append(strong);}
        else node.append(document.createTextNode(inline));
      }
    }
  }
}
function message(item){
  const node=document.createElement('div');node.className='message '+item.role;
  const answer=document.createElement('div');answer.className=item.role==='user'?'user-content':'answer';
  if(item.role==='user')answer.textContent=item.content;else format(answer,item.content||'Thinking…');
  const actions=document.createElement('div');actions.className='message-actions';
  actions.append(copyButton(()=>item.content,item.role==='user'?'Copy message':'Copy response'));
  node.append(answer,actions);$('messages').append(node);return node;
}
function render(){$('welcome').hidden=!!current?.messages.length;$('messages').replaceChildren();for(const m of current?.messages||[])message(m);history();}
function newChat(){if(controller)return;current=null;$('notice').textContent='';$('prompt').value='';$('prompt').dispatchEvent(new Event('input'));closeEmoji(false);render();$('prompt').focus();document.body.classList.remove('sidebar-open');}
$('new-chat').onclick=newChat;
$('menu').onclick=()=>{if(innerWidth<=640)document.body.classList.toggle('sidebar-open');else document.body.classList.toggle('collapsed');};
$('close-sidebar').onclick=$('overlay').onclick=()=>document.body.classList.remove('sidebar-open');
$('search').onclick=()=>{const term=prompt('Search your conversations');if(term!==null)history(term);};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();newChat();}});
$('prompt').oninput=()=>{$('prompt').style.height='auto';$('prompt').style.height=Math.min($('prompt').scrollHeight,180)+'px';};
const emojiGroups=[
  ['Faces & feelings',[['😀','grinning happy smile'],['😊','smiling happy blush'],['😂','laugh tears joy'],['🥹','touched emotional tears'],['😍','love heart eyes'],['🥰','love hearts'],['😎','cool sunglasses'],['🤔','thinking question'],['😅','sweat nervous smile'],['😭','cry sad tears'],['😴','sleep tired'],['🤯','mind blown amazed'],['🥳','party celebrate'],['🫡','salute respect'],['🤗','hug'],['🙃','upside down smile']]],
  ['Gestures & hearts',[['👍','thumbs up yes good'],['👎','thumbs down no'],['👋','wave hello goodbye'],['🙌','raised hands hooray'],['👏','clap applause'],['🙏','thanks please pray'],['🤝','handshake agree'],['💪','strong muscle'],['❤️','red heart love'],['💚','green heart'],['💙','blue heart'],['💜','purple heart']]],
  ['Ideas & everyday',[['✨','sparkles magic'],['💡','idea light bulb'],['🔥','fire hot'],['🚀','rocket launch'],['🎉','party celebrate'],['🎯','target goal'],['✅','check done yes'],['❌','cross no'],['⭐','star favorite'],['💻','computer code laptop'],['🐛','bug debug'],['🤖','robot ai'],['📚','books study learn'],['📝','note write'],['☕','coffee break'],['🌱','plant grow nature'],['🌍','world earth'],['🍕','pizza food'],['🎵','music note'],['📌','pin important']]]
];
let emojiSelection={start:0,end:0};
function renderEmoji(query=''){
  $('emoji-list').replaceChildren();let count=0;
  for(const [title,items] of emojiGroups){
    const matches=items.filter(([emoji,words])=>(title+' '+emoji+' '+words).toLowerCase().includes(query.toLowerCase().trim()));
    if(!matches.length)continue;
    const heading=document.createElement('h3');heading.textContent=title;
    const grid=document.createElement('div');grid.className='emoji-grid';
    for(const [emoji,words] of matches){const button=document.createElement('button');button.type='button';button.textContent=emoji;button.title=words;button.setAttribute('aria-label',words);button.onclick=()=>{
      const field=$('prompt');field.setRangeText(emoji,emojiSelection.start,emojiSelection.end,'end');field.dispatchEvent(new Event('input'));closeEmoji(false);field.focus();
    };grid.append(button);count++;}
    $('emoji-list').append(heading,grid);
  }
  if(!count){const empty=document.createElement('p');empty.className='emoji-empty';empty.textContent='No emoji found. Try “happy”, “heart”, or “code”.';$('emoji-list').append(empty);}
}
function closeEmoji(focus=true){$('emoji-picker').hidden=true;$('emoji-toggle').setAttribute('aria-expanded','false');if(focus)$('emoji-toggle').focus();}
$('emoji-toggle').onclick=()=>{
  if(!$('emoji-picker').hidden){closeEmoji();return;}
  emojiSelection={start:$('prompt').selectionStart,end:$('prompt').selectionEnd};$('emoji-search').value='';renderEmoji();$('emoji-picker').hidden=false;$('emoji-toggle').setAttribute('aria-expanded','true');$('emoji-search').focus();
};
$('emoji-close').onclick=()=>closeEmoji();
$('emoji-search').oninput=()=>renderEmoji($('emoji-search').value);
$('emoji-picker').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeEmoji();}});
document.addEventListener('click',event=>{if(!$('emoji-picker').hidden&&!$('emoji-picker').contains(event.target)&&!$('emoji-toggle').contains(event.target))closeEmoji(false);});
function sendIcon(generating){$('send').innerHTML=icon(generating?'stop':'arrow');$('send').title=generating?'Stop generating':'Send message';}
$('prompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!controller)$('composer').requestSubmit();}};
for(const button of document.querySelectorAll('[data-prompt]'))button.onclick=()=>{$('prompt').value=button.dataset.prompt;$('prompt').dispatchEvent(new Event('input'));$('prompt').focus();};
$('composer').onsubmit=async e=>{e.preventDefault();if(loadingHistory)return;if(controller){controller.abort();return;}const text=$('prompt').value.trim();if(!text)return;
  if(!current){current={id:crypto.randomUUID(),title:text.slice(0,48),messages:[],model:$('model').value};chats.push(current);}
  current.model=$('model').value;current.messages.push({role:'user',content:text});save();render();$('prompt').value='';$('prompt').dispatchEvent(new Event('input'));$('notice').textContent='';
  const context=current.messages.map(m=>({role:m.role,content:m.content}));if(prefs.system)context.unshift({role:'system',content:prefs.system});
  const answer={role:'assistant',content:''};current.messages.push(answer);const node=message(answer),content=node.querySelector('.answer');controller=new AbortController();sendIcon(true);$('send').setAttribute('aria-label','Stop generating');$('model').disabled=true;node.classList.add('generating');$('scroll').scrollTop=$('scroll').scrollHeight;
  try{for await(const chunk of ai.stream({model:current.model,messages:context,options:{temperature:Number(prefs.temperature)},signal:controller.signal})){answer.content+=chunk.message?.content||'';const nearBottom=$('scroll').scrollHeight-$('scroll').scrollTop-$('scroll').clientHeight<180;format(content,answer.content||'Thinking…');if(nearBottom)$('scroll').scrollTop=$('scroll').scrollHeight;}}
  catch(error){$('notice').textContent=error.name==='AbortError'?'Response stopped.':error.message;}
  finally{if(!answer.content){current.messages.pop();node.remove();}node.classList.remove('generating');controller=null;sendIcon(false);$('send').setAttribute('aria-label','Send message');$('model').disabled=false;save();history();$('prompt').focus();}
};
$('settings').onclick=()=>{$('theme').value=prefs.theme;$('system').value=prefs.system;$('temperature').value=prefs.temperature;$('temp-label').value=prefs.temperature;$('settings-dialog').showModal();};
$('temperature').oninput=()=>$('temp-label').value=$('temperature').value;
$('settings-dialog').addEventListener('close',()=>{if($('settings-dialog').returnValue!=='save')return;prefs={theme:$('theme').value,system:$('system').value,temperature:Number($('temperature').value)};try{localStorage.setItem('local-prefs',JSON.stringify(prefs));}catch{}applyTheme();});
$('export').onclick=()=>{if(!current?.messages.length){$('notice').textContent='Start a conversation to export it.';return;}const text='# '+current.title+'\n\n'+current.messages.map(m=>'## '+(m.role==='user'?'You':'Local Chat')+'\n\n'+m.content).join('\n\n');const url=URL.createObjectURL(new Blob([text],{type:'text/markdown'}));const a=document.createElement('a');a.href=url;a.download='local-chat.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
let connected=false;
async function connect(){
  try{
    const response=await fetch('/api/status');
    if(!response.ok)throw new Error('Connection check failed');
    const state=await response.json();
    const labels={connecting:'Connecting to Gemma…',starting:'Starting Ollama…',loading:'Loading Gemma 3 1B…',ready:'● Gemma connected · Ready to chat',error:state.error};
    $('connection').textContent=labels[state.status]||'Connecting…';
    if(!controller)$('send').disabled=state.status!=='ready'||loadingHistory;
    if(state.status==='ready'&&!connected){
      const models=await ai.models();
      if(controller)return;
      const selected=connected?$('model').value:'gemma3:1b';
      $('model').replaceChildren();
      for(const model of models){const option=document.createElement('option');option.value=option.textContent=model.name;$('model').append(option);}
      if(models.some(model=>model.name===selected))$('model').value=selected;
      connected=true;
    }
  }catch{$('connection').textContent='Reconnecting to local server…';if(!controller)$('send').disabled=true;}
}
$('send').disabled=true;
render();loadHistory().then(connect);setInterval(connect,2000);
