import mysql from 'mysql2/promise';

let pool;
let initialized;
export async function database() {
  if (!process.env.DB_NAME || !process.env.DB_USER) throw new Error('Configure DB_HOST, DB_USER, DB_PASSWORD and DB_NAME in .env to save chats to MySQL.');
  pool ??= mysql.createPool({host:process.env.DB_HOST || '127.0.0.1',port:Number(process.env.DB_PORT || 3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD || '',database:process.env.DB_NAME,charset:'utf8mb4',connectionLimit:5,connectTimeout:5000});
  initialized ??= pool.execute(`CREATE TABLE IF NOT EXISTS local_chat_conversations (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL,
    messages JSON NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  )`).catch(error => { initialized=undefined; throw error; });
  await initialized;
  return pool;
}
export function validateChat(chat) {
  return chat && typeof chat.id==='string' && /^[a-f0-9-]{36}$/i.test(chat.id)
    && typeof chat.title==='string' && chat.title.length<=255
    && typeof chat.model==='string' && chat.model.length<=255
    && Array.isArray(chat.messages) && chat.messages.length<=10000
    && chat.messages.every(m=>m && ['user','assistant'].includes(m.role) && typeof m.content==='string');
}
export async function handleChats(req,res,pathname) {
  const reply=(status,data)=>res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(data));
  try {
    if (req.method==='GET' && pathname==='/api/conversations') {
      const db=await database();
      const [rows]=await db.execute('SELECT id,title,model,messages FROM local_chat_conversations ORDER BY created_at,id');
      reply(200,rows.map(row=>({...row,messages:typeof row.messages==='string'?JSON.parse(row.messages):row.messages})));
    } else if(req.method==='PUT' && pathname==='/api/conversations') {
      let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>2_000_000){reply(413,{error:'Conversation is too large to save.'});return;}}
      let chat;try{chat=JSON.parse(body);}catch{reply(400,{error:'Invalid JSON'});return;}
      if(!validateChat(chat)){reply(400,{error:'Invalid conversation'});return;}
      const db=await database();
      await db.execute('INSERT INTO local_chat_conversations (id,title,model,messages) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE title=?,model=?,messages=?',[chat.id,chat.title,chat.model,JSON.stringify(chat.messages),chat.title,chat.model,JSON.stringify(chat.messages)]);
      reply(200,{saved:true});
    } else if(req.method==='DELETE' && /^\/api\/conversations\/[a-f0-9-]{36}$/i.test(pathname)) {
      const db=await database();await db.execute('DELETE FROM local_chat_conversations WHERE id=?',[pathname.split('/').pop()]);reply(200,{deleted:true});
    } else reply(405,{error:'Method not allowed'});
  } catch(error) {
    console.error('MySQL:',error.code || error.message);
    reply(503,{error:!process.env.DB_NAME || !process.env.DB_USER?'MySQL is not configured. Set the DB values in .env and restart the app.':'Cannot save or load MySQL history. Check the database connection and permissions.'});
  }
}
