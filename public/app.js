import {LocalAI} from '/sdk.mjs';
const $=id=>document.getElementById(id), ai=new LocalAI({baseURL:location.origin});
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
function format(node,text){node.replaceChildren();const pieces=text.split(/(```[\s\S]*?```)/g);for(const piece of pieces){if(piece.startsWith('```')){const pre=document.createElement('pre'),code=document.createElement('code');code.textContent=piece.slice(3,-3).replace(/^[\w+#.-]*\n/,'');pre.append(code);node.append(pre);}else{const parts=piece.split(/(`[^`\n]+`|\*\*[^*]+\*\*)/g);for(const part of parts){if(part.startsWith('`')){const code=document.createElement('code');code.textContent=part.slice(1,-1);node.append(code);}else if(part.startsWith('**')){const strong=document.createElement('strong');strong.textContent=part.slice(2,-2);node.append(strong);}else node.append(document.createTextNode(part));}}}}
function message(item){const node=document.createElement('div');node.className='message '+item.role;if(item.role==='user')node.textContent=item.content;else{const answer=document.createElement('div');answer.className='answer';format(answer,item.content||'Thinking…');const copy=document.createElement('button');copy.className='copy';copy.textContent='Copy response';copy.onclick=async()=>{try{await navigator.clipboard.writeText(item.content);copy.textContent='Copied';setTimeout(()=>copy.textContent='Copy response',1500);}catch{$('notice').textContent='Clipboard is unavailable in this browser.';}};node.append(answer,copy);}$('messages').append(node);return node;}
function render(){$('welcome').hidden=!!current?.messages.length;$('messages').replaceChildren();for(const m of current?.messages||[])message(m);history();}
function newChat(){if(controller)return;current=null;$('notice').textContent='';$('prompt').value='';render();$('prompt').focus();document.body.classList.remove('sidebar-open');}
$('new-chat').onclick=newChat;
$('menu').onclick=()=>{if(innerWidth<=640)document.body.classList.toggle('sidebar-open');else document.body.classList.toggle('collapsed');};
$('close-sidebar').onclick=$('overlay').onclick=()=>document.body.classList.remove('sidebar-open');
$('search').onclick=()=>{const term=prompt('Search your conversations');if(term!==null)history(term);};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();newChat();}});
$('prompt').oninput=()=>{$('prompt').style.height='auto';$('prompt').style.height=Math.min($('prompt').scrollHeight,180)+'px';};
$('prompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!controller)$('composer').requestSubmit();}};
for(const button of document.querySelectorAll('[data-prompt]'))button.onclick=()=>{$('prompt').value=button.dataset.prompt;$('prompt').dispatchEvent(new Event('input'));$('prompt').focus();};
$('composer').onsubmit=async e=>{e.preventDefault();if(loadingHistory)return;if(controller){controller.abort();return;}const text=$('prompt').value.trim();if(!text)return;
  if(!current){current={id:crypto.randomUUID(),title:text.slice(0,48),messages:[],model:$('model').value};chats.push(current);}
  current.model=$('model').value;current.messages.push({role:'user',content:text});save();render();$('prompt').value='';$('prompt').dispatchEvent(new Event('input'));$('notice').textContent='';
  const context=current.messages.map(m=>({role:m.role,content:m.content}));if(prefs.system)context.unshift({role:'system',content:prefs.system});
  const answer={role:'assistant',content:''};current.messages.push(answer);const node=message(answer),content=node.querySelector('.answer');controller=new AbortController();$('send').textContent='■';$('send').setAttribute('aria-label','Stop generating');$('model').disabled=true;
  try{for await(const chunk of ai.stream({model:current.model,messages:context,options:{temperature:Number(prefs.temperature)},signal:controller.signal})){answer.content+=chunk.message?.content||'';const nearBottom=$('scroll').scrollHeight-$('scroll').scrollTop-$('scroll').clientHeight<180;format(content,answer.content||'Thinking…');if(nearBottom)$('scroll').scrollTop=$('scroll').scrollHeight;}}
  catch(error){$('notice').textContent=error.name==='AbortError'?'Response stopped.':error.message;}
  finally{if(!answer.content){current.messages.pop();node.remove();}controller=null;$('send').textContent='↑';$('send').setAttribute('aria-label','Send message');$('model').disabled=false;save();history();$('prompt').focus();}
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
