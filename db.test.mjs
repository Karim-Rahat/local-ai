import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateChat } from './db.mjs';
test('accepts a conversation with Unicode text',()=>{
  assert.equal(validateChat({id:'12345678-1234-1234-1234-123456789abc',title:'Hello 🌍',model:'gemma3:1b',messages:[{role:'user',content:'Hi'},{role:'assistant',content:'Hello'}]}),true);
});
test('rejects invalid IDs, roles and message content',()=>{
  const chat={id:'12345678-1234-1234-1234-123456789abc',title:'Test',model:'gemma3:1b',messages:[]};
  assert.equal(validateChat({...chat,id:"'; DROP TABLE chats;"}),false);
  assert.equal(validateChat({...chat,messages:[{role:'admin',content:'test'}]}),false);
  assert.equal(validateChat({...chat,messages:[{role:'user',content:{}}]}),false);
});
