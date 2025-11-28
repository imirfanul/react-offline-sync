# React Offline Sync

## Overview

**A lightweight, enterprise-grade offline synchronization engine for React.**

Building offline-first apps is hard. `react-offline-sync` handles the complexity of queueing mutations (POST/PUT/DELETE) to IndexedDB when the user is offline, and automatically synchronizing them with the server when the connection is restored. It features exponential backoff, request persistence across sessions, and TypeScript support.


Demo: [@imirfanul/react-offline-sync](https://eloquent-malasada-9af1c1.netlify.app/)

## 🚀 Features

* **Persisted Queue:** Uses `IndexedDB` (via `idb-keyval`) so requests survive browser refreshes and device restarts.
* **Auto-Sync:** Automatically detects network restoration (`window.onLine`) and processes the queue.
* **Smart Retries:** Implements **Exponential Backoff** for server errors (5xx), preventing server overload.
* **No Blocking:** Runs independently of the React render cycle to keep your UI snappy.
* **Type-Safe:** Built with TypeScript, offering full type definitions.
* **Auth Ready:** Supports dynamic token injection for long-running offline periods.

## 📦 Installation

```bash
npm install @imirfanul/react-offline-sync
# or
yarn add @imirfanul/react-offline-sync
# or
pnpm add @imirfanul/react-offline-sync
````

> **Note:** This library requires `react` \>= 16.8.0.

## 🏁 Quick Start

### 1\. Wrap your app

Wrap your root component with the `OfflineSyncProvider`.

```tsx
// App.tsx
import React from 'react';
import { OfflineSyncProvider } from '@imirfanul/react-offline-sync';
import MyComponent from './MyComponent';

const App = () => {
  return (
    <OfflineSyncProvider>
      <MyComponent />
    </OfflineSyncProvider>
  );
};

export default App;
```

### 2\. Trigger mutations

Use the `useOfflineMutation` hook to perform actions. These will execute immediately if online, or be queued if offline.

```tsx
// MyComponent.tsx
import React, { useState } from 'react';
import { useOfflineMutation, useSyncStatus } from '@imirfanul/react-offline-sync';

const MyComponent = () => {
  const [task, setTask] = useState('');
  const { submit } = useOfflineMutation();
  const { isOnline, isSyncing } = useSyncStatus();

  const handleSave = async () => {
    // This resolves immediately with { success: true } if queued successfully
    await submit(
      { title: task }, // Body
      { url: '/api/todos', method: 'POST' } // Options
    );
    setTask('');
    alert(isOnline ? 'Saved!' : 'Saved to offline queue!');
  };

  return (
    <div>
      <div style={{ color: isOnline ? 'green' : 'red' }}>
        Status: {isOnline ? 'Online' : 'Offline'}
      </div>
      
      {isSyncing && <small>Syncing changes...</small>}

      <input value={task} onChange={(e) => setTask(e.target.value)} />
      <button onClick={handleSave}>Add Task</button>
    </div>
  );
};
```

## ⚙️ Advanced Configuration

### Authentication (JWT)

If a user is offline for hours, their Auth Token might expire. You can provide a `prepareHeaders` function that is called **immediately before** every sync request to inject a fresh token.

```tsx
const getFreshToken = async () => {
  // Logic to get token from localStorage or refresh it
  const token = localStorage.getItem('access_token');
  return { 
    'Authorization': `Bearer ${token}`,
    'X-Custom-Header': 'foobar'
  };
};

<OfflineSyncProvider 
  prepareHeaders={getFreshToken}
  onSuccess={(response, payload) => console.log('Synced:', payload.url)}
  onError={(error, payload) => console.error('Failed:', payload.url)}
  debug={true} // Enable console logs
>
  <App />
</OfflineSyncProvider>
```

## 📖 API Reference

### `<OfflineSyncProvider />`

| Prop | Type | Description |
| :--- | :--- | :--- |
| `prepareHeaders` | `() => Promise<Record<string, string>>` | **(Recommended)** Async function to generate headers. Useful for Auth tokens. |
| `onSuccess` | `(res: any, req: RequestPayload) => void` | Callback fired when a queued request successfully syncs. |
| `onError` | `(err: any, req: RequestPayload) => void` | Callback fired when a request fails permanently (e.g., 400 Bad Request). |
| `debug` | `boolean` | Enables verbose logging to the console. |

### `useOfflineMutation()`

Returns an object with:

  * **`submit(body: any, options: MutationOptions): Promise<{ success: boolean, error?: any }>`**
      * `body`: The JSON body of the request.
      * `options.url`: The endpoint URL.
      * `options.method`: 'POST' | 'PUT' | 'PATCH' | 'DELETE' (default: 'POST').
      * `options.onEnqueue`: Optional callback executed immediately after queueing.

### `useSyncStatus()`

Returns an object with:

  * **`isOnline`** (`boolean`): Current network status of the browser.
  * **`isSyncing`** (`boolean`): `true` if the engine is currently processing the queue.

## 🧠 Architecture & Behavior

1.  **Storage:** Requests are stored in `IndexedDB`, allowing storage of large payloads without blocking the main thread (unlike `localStorage`).
2.  **Queue Logic:** FIFO (First-In-First-Out).
3.  **Network Handling:**
      * **Online:** Requests are sent immediately.
      * **Offline:** Requests are queued. When `window.online` fires, the queue flushes automatically.
4.  **Error Handling:**
      * **4xx (Client Error):** The request is discarded immediately (it will never succeed).
      * **5xx (Server Error):** The request is kept in the queue. The engine pauses and retries with **Exponential Backoff** (1s, 2s, 4s... max 30s).

## License

MIT © [Md Irfanul Alam](https://www.google.com/search?q=https://github.com/imirfanul)

