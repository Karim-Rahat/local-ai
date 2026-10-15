# Local Chat

A ChatGPT-style interface for your local Ollama models, with a reusable JavaScript SDK and MySQL conversation storage. No API keys required. Requires Node.js 20+, Ollama, and MySQL for server-side history.

## Run

Open Ollama, then download the model:

```powershell
ollama pull gemma3:1b
npm.cmd install
npm.cmd start
```

Open http://localhost:3000, or double-click `start.bat`. The app automatically connects to Ollama, starts it if necessary on the default local address, and loads `gemma3:1b` into memory. The composer becomes available when Gemma is ready. You don't need to keep `ollama run` open. Gemma stays loaded while Ollama is running; to free its memory, run `ollama stop gemma3:1b`.

Streaming responses, stop generation, model selection, local conversation history, conversation deletion, search, Markdown export, code blocks, copy response, light/dark themes, custom system instructions, and temperature controls are included. Enter sends; Shift+Enter adds a line. Ctrl+K starts a chat.

Chats are stored in MySQL, with a browser backup if the database is unavailable. Preferences remain in this browser. The application binds to loopback; this is a single-user workspace, and all its conversations share one database history.

## MySQL setup

This workspace is configured with its own MySQL 8 instance on `127.0.0.1:3307`. It starts automatically with the app. Data lives in `.local/mysql`, app credentials in `.env`, and administrator credentials in `.local/mysql-admin.json`; these files are excluded from Git. Keep `.local` to preserve your conversations. The server binary comes from the existing Laragon installation; keep that installation available. To stop this database, use its MySQL admin credentials with `mysqladmin shutdown`.

Install dependencies with `npm.cmd install`. Copy `.env.example` to `.env` and fill in your MySQL host, port, username, password, and database name. Credentials are read only by the Node server; `.env` is excluded from Git.

Create the database on your MySQL server (MySQL 5.7.8+ or 8.x):

```sql
CREATE DATABASE local_chat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Use a MySQL account with SELECT, INSERT, UPDATE, DELETE, and CREATE permissions for this database. The application creates `local_chat_conversations` automatically. Restart the app after changing `.env`. Existing chats in the current browser are imported on startup, and new messages, responses, and deletions are saved to MySQL. Failed saves show a message and retain a browser backup; reopening the app retries imports of chats absent from the server. Database versions take precedence when the same chat exists in both places.

## SDK

### Chat deletion and assignment memory

Use the trash icon next to a conversation or in the top bar to delete one chat. **Settings → Chat history → Delete all** is the only interface control for deleting all conversations, and requires confirmation. Deletion waits for queued saves and removes pinned memory linked to those chats. Deleted IDs are retained without message content to prevent old browser backups from restoring deleted chats.

Open **Memory** in the sidebar to enable history recall and save assignment notes, requirements, or a rubric. Memory is off by default and stored in MySQL. The memory icon in the top bar pins a chat's user messages and enables memory. Relevant user messages from earlier conversations are included as bounded background context in subsequent requests; this does not train or modify the model. The composer shows the sources used for each response. **Forget all memory** removes pinned memories and notes and disables recall while keeping chat history. Deleting all chats keeps separately entered assignment notes. Unpinning a chat removes its pinned copy; history recall can still use the original conversation.

```js
import { LocalAI } from './sdk.mjs';
const ai = new LocalAI({ model: 'gemma3:1b' });
const response = await ai.chat({
  messages: [{ role: 'user', content: 'Hello!' }]
});
console.log(response.message.content);

for await (const chunk of ai.stream({
  messages: [{ role: 'user', content: 'Explain gravity simply.' }]
})) {
  process.stdout.write(chunk.message?.content || '');
}

const result = await ai.generate({ prompt: 'Write a haiku.' });
console.log(result.response);
console.log(await ai.models());
```

In the browser, import `/sdk.mjs` and pass `{ baseURL: location.origin }` to use the local proxy. `chat`, `generate`, and `stream` accept an AbortSignal as `signal` and Ollama generation parameters in `options`.

Set `PORT` to change the app port, or `OLLAMA_HOST` to change the upstream Ollama URL. API reference: https://docs.ollama.com/api

Run `npm test` for SDK protocol tests.
