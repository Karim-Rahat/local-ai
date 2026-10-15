export class LocalAI {
  constructor({baseURL='http://127.0.0.1:11434',model='gemma3:1b',fetch:fetcher=globalThis.fetch}={}) {this.baseURL=baseURL.replace(/\/$/,'');this.model=model;this.fetch=fetcher;}
  async request(path,body,signal){const r=await this.fetch(this.baseURL+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal});if(!r.ok){let data;try{data=await r.json();}catch{}throw new Error(data?.error||`Request failed (${r.status})`);}return r;}
  async models(){return (await (await this.request('/api/tags')).json()).models;}
  async chat({messages,model=this.model,signal,...options}){return (await this.request('/api/chat',{...options,model,messages,stream:false},signal)).json();}
  async generate({prompt,model=this.model,signal,...options}){return (await this.request('/api/generate',{...options,model,prompt,stream:false},signal)).json();}
  async *stream({messages,model=this.model,signal,...options}) {
    const response=await this.request('/api/chat',{...options,model,messages,stream:true},signal);
    const reader=response.body.getReader(), decoder=new TextDecoder();let pending='';
    const parse=line=>{const item=JSON.parse(line);if(item.error)throw new Error(item.error);return item;};
    try {while(true){const {done,value}=await reader.read();pending+=decoder.decode(value,{stream:!done});const lines=pending.split('\n');pending=lines.pop();for(const line of lines)if(line.trim())yield parse(line);if(done){if(pending.trim())yield parse(pending);break;}}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  }
}
