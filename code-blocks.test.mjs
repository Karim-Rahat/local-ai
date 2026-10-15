import {test} from 'node:test';
import assert from 'node:assert/strict';
import {splitCodeBlocks} from './public/code-blocks.mjs';
import hljs from './node_modules/@highlightjs/cdn-assets/es/core.min.js';
import powershell from './node_modules/@highlightjs/cdn-assets/es/languages/powershell.min.js';
hljs.registerLanguage('powershell',powershell);
test('PowerShell fences preserve code, newlines, and surrounding prose',()=>{
  const code='$body = @{\r\n  model = "gemma3:1b"\r\n}\r\n';
  const parts=splitCodeBlocks('Example:\r\n```powershell\r\n'+code+'```\r\nDone.');
  assert.deepEqual(parts,[{type:'text',content:'Example:\r\n'},{type:'code',language:'powershell',content:code,complete:true},{type:'text',content:'Done.'}]);
});
test('incomplete code fences render as code while streaming',()=>{
  const parts=splitCodeBlocks('```pwsh\nWrite-Host "Hello');
  assert.deepEqual(parts,[{type:'code',language:'pwsh',content:'Write-Host "Hello',complete:false}]);
});
test('long and tilde fences allow shorter backticks inside code',()=>{
  assert.equal(splitCodeBlocks('````ps1\n```\n````')[0].content,'```\n');
  assert.equal(splitCodeBlocks('~~~cmd\necho hello\n~~~')[0].language,'cmd');
});
test('PowerShell highlighter recognizes tokens and escapes HTML',()=>{
  const output=hljs.highlight('$body = "<img src=x onerror=alert(1)>"\nWrite-Host $body',{language:'powershell'}).value;
  assert.match(output,/hljs-/);assert.match(output,/&lt;img/);assert.ok(!output.includes('<img'));
});
