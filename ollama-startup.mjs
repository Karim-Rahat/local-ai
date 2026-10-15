import { spawn } from 'node:child_process';

export function connectGemma(upstream) {
  const state = { status: 'connecting', model: 'gemma3:1b', error: null };
  const request = async (path, options = {}) => {
    const response = await fetch(upstream + path, { ...options, signal: AbortSignal.timeout(path === '/api/tags' ? 2000 : 120000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Ollama returned ${response.status}`);
    return data;
  };
  let pending;
  const connect = () => {
    if (pending) return pending;
    state.status = 'connecting';
    state.error = null;
    pending = (async () => {
      let models;
      try { models = await request('/api/tags'); }
      catch (error) {
        const host = new URL(upstream);
        if (!['127.0.0.1', 'localhost', '[::1]'].includes(host.hostname) || host.port !== '11434') throw error;
        state.status = 'starting';
        const child = spawn('ollama', ['serve'], { windowsHide: true, stdio: 'ignore', detached: true });
        let launchError;
        child.on('error', error => { launchError = error; });
        child.unref();
        for (let attempt = 0; attempt < 30; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          if (launchError) throw new Error('Ollama could not start. Install Ollama and reopen the app.');
          try { models = await request('/api/tags'); break; } catch {}
        }
        if (!models) throw new Error('Ollama did not start. Open Ollama and retry.');
      }
      if (!models.models?.some(model => model.name === state.model)) throw new Error('Gemma is not installed. Run: ollama pull gemma3:1b');
      state.status = 'loading';
      await request('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: state.model, stream: false, keep_alive: -1 }) });
      state.status = 'ready';
      console.log('Gemma 3 1B connected and ready.');
    })().catch(error => { state.status = 'error'; state.error = error.message; console.error(state.error); }).finally(() => { pending = null; });
    return pending;
  };
  connect();
  return { state, connect };
}
