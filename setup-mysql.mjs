import { spawn } from 'node:child_process';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';

const binary='C:/laragon/bin/mysql/mysql-8.0.30-winx64/bin/mysqld.exe';
const data=resolve('.local/mysql');
try {await access('.env');throw new Error('.env already exists; refusing to overwrite.');}catch(error){if(error.code!=='ENOENT')throw error;}
await access(binary);
await mkdir(data,{recursive:true});
await new Promise((resolve,reject)=>{const child=spawn(binary,['--initialize-insecure',`--datadir=${data}`],{windowsHide:true,stdio:'ignore'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('MySQL initialization failed; inspect .local/mysql/*.err.')));});
const child=spawn(binary,[`--datadir=${data}`,'--port=3307','--bind-address=127.0.0.1','--mysqlx=OFF'],{windowsHide:true,stdio:'ignore',detached:true});
child.on('error',error=>console.error(error.message));child.unref();
let connection;
for(let i=0;i<60;i++){try{connection=await mysql.createConnection({host:'127.0.0.1',port:3307,user:'root',connectTimeout:1000});break;}catch{await new Promise(resolve=>setTimeout(resolve,500));}}
if(!connection)throw new Error('MySQL did not start.');
const password=randomBytes(24).toString('hex'), adminPassword=randomBytes(32).toString('hex');
await writeFile('.local/mysql-admin.json',JSON.stringify({host:'127.0.0.1',port:3307,user:'root',password:adminPassword},null,2),{flag:'wx',mode:0o600});
try{
  await connection.query('CREATE DATABASE local_chat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  await connection.query("CREATE USER 'local_chat'@'127.0.0.1' IDENTIFIED BY ?",[password]);
  await connection.query("GRANT SELECT, INSERT, UPDATE, DELETE, CREATE ON local_chat.* TO 'local_chat'@'127.0.0.1'");
  await connection.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?",[adminPassword]);
  await writeFile('.env',`DB_HOST=127.0.0.1\nDB_PORT=3307\nDB_USER=local_chat\nDB_PASSWORD=${password}\nDB_NAME=local_chat\nMYSQL_BINARY=${binary}\nMYSQL_DATA_DIR=.local/mysql\n`,{flag:'wx',mode:0o600});
  console.log('Created local_chat database and dedicated app account. Credentials saved privately to .env.');
}finally{await connection.end();}
