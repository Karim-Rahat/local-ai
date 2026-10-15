import 'dotenv/config';
import http from 'node:http';
import { handleChats } from './db.mjs';
import { startLocalMySQL } from './mysql-local.mjs';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { connectGemma } from './ollama-startup.mjs';
const port = Number(process.env.PORT || 3000);
await startLocalMySQL();
const upstream = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const gemma = connectGemma(upstream);
const files = {'/':['public/index.html','text/html'], '/app.js':['public/app.js','text/javascript'], '/style.css':['public/style.css','text/css'], '/sdk.mjs':['sdk.mjs','text/javascript']};
http.createServer(async (req,res)=>{
  const url = new URL(req.url,'http://localhost');
  if (![`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host)) {res.writeHead(403).end();return;}
  if (req.headers.origin && ![`http://localhost:${port}`,`http://127.0.0.1:${port}`].includes(req.headers.origin)) {res.writeHead(403).end();return;}
  if (url.pathname==='/api/conversations' || url.pathname.startsWith('/api/conversations/')) {
    await handleChats(req,res,url.pathname);
    return;
  }
  if (url.pathname === '/api/status' && req.method === 'GET') {
    const snapshot = { ...gemma.state };
    if (snapshot.status === 'error') gemma.connect();
    res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}).end(JSON.stringify(snapshot));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    if (!['/api/tags','/api/chat','/api/generate'].includes(url.pathname) || !['GET','POST'].includes(req.method)) {res.writeHead(404).end();return;}
    if (req.headers.origin && ![`http://localhost:${port}`,`http://127.0.0.1:${port}`].includes(req.headers.origin)) {res.writeHead(403).end();return;}
    const controller = new AbortController();
    res.on('close',()=>controller.abort());
    try {
      let body='';
      for await (const chunk of req) {body+=chunk;if(body.length>2_000_000){res.writeHead(413).end();return;}}
      const response=await fetch(upstream+url.pathname,{method:req.method,headers:{'Content-Type':'application/json'},body:req.method==='POST'?body:undefined,signal:controller.signal});
      res.writeHead(response.status,{'Content-Type':response.headers.get('content-type')||'application/json','Cache-Control':'no-store'});
      Readable.fromWeb(response.body).on('error',()=>res.destroy()).pipe(res);
    } catch(error) {if(!res.headersSent)res.writeHead(502,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Cannot connect to Ollama. Start Ollama, then run: ollama pull gemma3:1b'}));}
    return;
  }
  const file=files[url.pathname];
  if(!file){res.writeHead(404).end();return;}
  try{res.writeHead(200,{'Content-Type':file[1]+'; charset=utf-8','X-Content-Type-Options':'nosniff'}).end(await readFile(new URL(file[0],import.meta.url)));}catch{res.writeHead(500).end('Unable to load application');}
}).listen(port,'127.0.0.1',()=>console.log(`Local Chat: http://localhost:${port}`));
