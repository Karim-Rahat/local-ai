import { spawn } from 'node:child_process';
import mysql from 'mysql2/promise';
import { resolve } from 'node:path';

export async function startLocalMySQL() {
  if (!process.env.MYSQL_BINARY) return;
  const options = {host:process.env.DB_HOST || '127.0.0.1',port:Number(process.env.DB_PORT || 3307),user:process.env.DB_USER,password:process.env.DB_PASSWORD,connectTimeout:1000};
  try {const connection=await mysql.createConnection(options);await connection.end();return;} catch(error) {if(error.code!=='ECONNREFUSED')throw error;}
  const data=resolve(process.env.MYSQL_DATA_DIR || '.local/mysql');
  const child=spawn(process.env.MYSQL_BINARY,[`--datadir=${data}`,`--port=${options.port}`,'--bind-address=127.0.0.1','--mysqlx=OFF'],{windowsHide:true,stdio:'ignore',detached:true});
  let launchError;child.on('error',error=>launchError=error);child.unref();
  for(let attempt=0;attempt<60;attempt++){
    if(launchError)throw launchError;
    await new Promise(resolve=>setTimeout(resolve,500));
    try {const connection=await mysql.createConnection(options);await connection.end();console.log('Local MySQL connected.');return;} catch(error){if(error.code!=='ECONNREFUSED')throw error;}
  }
  throw new Error('Local MySQL did not start. Check .local/mysql/*.err.');
}
