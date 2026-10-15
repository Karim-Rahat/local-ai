import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildMemoryContext} from './memory.mjs';
const chat=(id,title,user,assistant='')=>({id,title,messages:[{role:'user',content:user},{role:'assistant',content:assistant}]});
test('memory disabled means no context or sources',()=>{
  assert.deepEqual(buildMemoryContext({enabled:false,notes:'Private notes',chats:[chat('1','Project','JavaScript')]}),{context:'',sources:[]});
});
test('recalls assignment notes and ranks matching chats over unrelated history',()=>{
  const result=buildMemoryContext({enabled:true,notes:'Use vanilla JavaScript.',query:'Continue my tic-tac-toe JavaScript project',chats:[chat('1','Dinner','Pasta recipe'),chat('2','Tic-tac-toe','My JavaScript game needs a scoreboard')]});
  assert.match(result.context,/Use vanilla JavaScript/);assert.match(result.context,/scoreboard/);assert.ok(!result.context.includes('Pasta'));assert.equal(result.sources[1].id,'2');
});
test('excludes active chat and assistant claims from memory',()=>{
  const result=buildMemoryContext({enabled:true,query:'project',excludeId:'active',chats:[chat('active','Current','EXCLUDED'),chat('past','Project','I need a JavaScript project','Invented personal information')],memories:[{id:'pin',source_chat_id:'active',title:'Current',content:'EXCLUDED'}]});
  assert.ok(!result.context.includes('EXCLUDED'));assert.ok(!result.context.includes('Invented personal information'));assert.match(result.context,/JavaScript project/);
});
test('saved chats are included once and memory has a bounded size',()=>{
  const result=buildMemoryContext({enabled:true,notes:'N'.repeat(6000),query:'project',memories:[{id:'pin',source_chat_id:'past',title:'Pinned',content:'X'.repeat(6000)}],chats:[chat('past','Duplicate','DUPLICATE'),...Array.from({length:50},(_,i)=>chat(String(i),'project','Y'.repeat(6000)))]});
  assert.ok(!result.context.includes('DUPLICATE'));assert.ok(result.context.length<7100);assert.equal(result.sources.filter(s=>s.id==='pin').length,1);
});
test('ambiguous follow-up falls back to the most recent user chat',()=>{
  const result=buildMemoryContext({enabled:true,query:'Can you continue?',chats:[chat('recent','Game','Finish the scoreboard'),chat('old','Recipe','Pasta')]});
  assert.deepEqual(result.sources.map(s=>s.id),['recent']);
});
