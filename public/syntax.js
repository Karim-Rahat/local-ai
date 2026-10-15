import hljs from '/vendor/highlight/core.js';
import powershell from '/vendor/highlight/powershell.js';
import javascript from '/vendor/highlight/javascript.js';
import python from '/vendor/highlight/python.js';
import bash from '/vendor/highlight/bash.js';
import dos from '/vendor/highlight/dos.js';
import json from '/vendor/highlight/json.js';
import xml from '/vendor/highlight/xml.js';
import css from '/vendor/highlight/css.js';
import sql from '/vendor/highlight/sql.js';
for(const [name,grammar] of Object.entries({powershell,javascript,python,bash,dos,json,xml,css,sql}))hljs.registerLanguage(name,grammar);
const aliases={ps:'powershell',ps1:'powershell',pwsh:'powershell',shell:'bash',sh:'bash',zsh:'bash',cmd:'dos',bat:'dos',batch:'dos',js:'javascript',jsx:'javascript',py:'python',html:'xml',svg:'xml'};
export function renderCode(element,source,language){
  let name=aliases[language]||language;
  if(!name&&/^\s*(?:\$\w+\s*=|(?:Invoke|Get|Set|Write|New|ConvertTo|ConvertFrom|Test|Start|Stop)-[A-Z])/m.test(source))name='powershell';
  element.className='hljs';
  if(source.length<100000&&hljs.getLanguage(name)){
    // Only the highlighter's escaped output is interpreted as markup.
    try{element.innerHTML=hljs.highlight(source,{language:name,ignoreIllegals:true}).value;}
    catch{element.textContent=source;}
  }else element.textContent=source;
  return name==='powershell'?'PowerShell':name==='dos'?'CMD':language||'Code';
}
