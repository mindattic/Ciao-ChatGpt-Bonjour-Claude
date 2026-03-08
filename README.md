# ChatGPT to Claude

Migrate **all** your ChatGPT conversations into Claude with two browser-console scripts — no API keys, no extensions, no external tools.

> **Note:** Conversations are exported as a **flat zip** of `.txt` files — ChatGPT project/folder structure is **not preserved**. The importer places every conversation into a **single Claude Project** of your choosing.

| Step | Script | Where to run | What it does |
|------|--------|--------------|--------------|
| 1 | `ChatGPTConversationExporter.js` | chatgpt.com | Exports every conversation as a `.txt` inside a `.zip`. |
| 2 | `ClaudeConversationImporter.js` | claude.ai | Reads the `.zip`, lets you pick a Claude Project, and imports each conversation as a new Claude chat. |

Both scripts work the same way: open **F12 → Console**, paste the script, hit **Enter**. They reuse the Authorization token and Cookie the browser already holds for the active session — nothing to configure.

---

## Table of Contents

- [Requirements](#requirements)
- [Step 1 — Export from ChatGPT](#step-1--export-from-chatgpt)
  - [Usage](#usage)
  - [How It Works](#how-it-works)
  - [ChatGPT API Endpoints Used](#chatgpt-api-endpoints-used)
  - [Configuration](#configuration)
  - [Conversation Format](#conversation-format)
  - [Duplicate Filename Handling](#duplicate-filename-handling)
  - [Built-in Zip Writer](#built-in-zip-writer)
- [Step 2 — Import into Claude](#step-2--import-into-claude)
  - [Usage](#usage-1)
  - [How It Works](#how-it-works-1)
  - [Claude API Endpoints Used](#claude-api-endpoints-used)
  - [Configuration](#configuration-1)
  - [Built-in Zip Reader](#built-in-zip-reader)
- [Privacy & Security](#privacy--security)
- [UI Overlays](#ui-overlays)
- [Limitations & Known Constraints](#limitations--known-constraints)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Requirements

- A modern browser (Chrome, Edge, Firefox, etc.).
- An active, logged-in session on **chatgpt.com** (Step 1) and **claude.ai** (Step 2).
- No extensions, API keys, or external tools required.

---

## Step 1 — Export from ChatGPT

### Usage

1. Go to **[chatgpt.com](https://chatgpt.com)** and make sure you are **logged in**.
2. Press **F12** (or right-click → *Inspect*) to open **Developer Tools**.
3. Click the **Console** tab.
4. Copy the entire contents of **`ChatGPTConversationExporter.js`**.
5. **Paste** it into the console and press **Enter**.
6. A full-screen progress overlay will appear — keep the tab open until the export finishes.
7. When complete, a `chatgpt_export_YYYY-MM-DD.zip` file will download automatically.

### How It Works

1. **URL Check** — Verifies the script is running on `chatgpt.com`. If the hostname does not match, an alert is shown and the script exits immediately.
2. **Authentication** — Retrieves your session access token by calling `/api/auth/session`. The token is sent as a `Bearer` token in the `Authorization` header for all subsequent requests.
3. **Discovery** — Paginates through `/backend-api/conversations` (100 conversations per page, ordered by `updated`) to build a complete list of every conversation in your account.
4. **Project Scan** — Fetches all ChatGPT Projects via `/backend-api/projects` and, for each project, paginates through `/backend-api/conversations?project_id={id}`. Any conversations not already seen are merged into the main list. This catches conversations hidden behind the sidebar’s “Show more” ellipsis.
5. **Fetch** — For each conversation, fetches the full message tree from `/backend-api/conversation/{id}`.
6. **Extract** — Walks the message tree using a depth-first traversal (iterative stack). Each node’s `message.content.parts` array is joined into plain text. Messages are labelled by role (`You`, `ChatGPT`, `System`, `Tool`).
7. **Package** — Writes each conversation as a `.txt` file inside a zip archive using a built-in pure-JavaScript zip writer (STORE method, no compression). All files are stored flat (no folder nesting).
8. **Download** — Generates the zip blob in-browser and triggers an automatic download.

### ChatGPT API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/session` | GET | Retrieve the current session access token |
| `/backend-api/conversations?offset={n}&limit=100&order=updated` | GET | Paginate through the conversation list |
| `/backend-api/projects?offset={n}&limit=100&order=most_recent` | GET | Discover all ChatGPT Projects |
| `/backend-api/conversations?project_id={id}&offset={n}&limit=100` | GET | Paginate conversations inside a specific project |
| `/backend-api/conversation/{id}` | GET | Fetch the full message tree for a single conversation |

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DELAY_MS` | `1200` | Milliseconds to wait between API calls (rate-limiting / politeness delay). |
| `BASE` | `/backend-api` | Base path for ChatGPT backend API calls. |

### Conversation Format

Each `.txt` file is formatted as:

```
======================================================================
  Conversation Title
======================================================================
  Date: 1/15/2025, 3:42:00 PM

--- You ---
User message text

--- ChatGPT ---
Assistant response text

======================================================================
  End: Conversation Title
======================================================================
```

Roles are mapped as follows:

| API role | Display label |
|----------|---------------|
| `user` | `You` |
| `assistant` | `ChatGPT` |
| `system` | `System` |
| `tool` | `Tool` |
| anything else | raw role string |

### Duplicate Filename Handling

If two conversations have the same title, subsequent files get a numeric suffix:

```
Some Title.txt
Some Title (1).txt
Some Title (2).txt
```

Filenames are sanitized: characters `< > : " / \ | ? *` are replaced with `_`, leading/trailing dots are stripped, and names are truncated to 100 characters.

### Built-in Zip Writer

The exporter includes a minimal, dependency-free zip writer implemented in pure JavaScript. It builds a valid ZIP archive using the STORE method (no compression):

1. Encodes file content as UTF-8 and computes a **CRC-32** checksum for each entry.
2. Writes **Local File Headers** followed by raw file data.
3. Writes a **Central Directory** with one entry per file.
4. Writes an **End of Central Directory** (EOCD) record.
5. Returns the result as a `Blob` for immediate download.

> **Note:** No external libraries are loaded. This avoids Content Security Policy (CSP) issues on chatgpt.com that block third-party CDN scripts.

---

## Step 2 — Import into Claude

### Usage

1. Go to **[claude.ai](https://claude.ai)** and make sure you are **logged in**.
2. Press **F12** (or right-click → *Inspect*) to open **Developer Tools**.
3. Click the **Console** tab.
4. Copy the entire contents of **`ClaudeConversationImporter.js`**.
5. **Paste** it into the console and press **Enter**.
6. An overlay will appear. Click **Minimize & Capture**, then **send any message** in Claude's chat. This lets the script capture your session's auth headers.
7. The overlay reappears with a file picker — select your `chatgpt_export_YYYY-MM-DD.zip` file.
8. If you belong to multiple Claude organizations (e.g., Free + Team), a picker appears — **choose your org**.
9. A project picker appears — **choose the Claude Project** to import into. (Create one in Claude first if you haven't already.)
10. The script imports every conversation as a new chat inside the chosen project.
11. When finished, a summary screen shows conversations imported and errors. Click **Close** to dismiss.

### How It Works

1. **URL Check** — Verifies the script is running on `claude.ai`. If the hostname does not match, an alert is shown and the script exits immediately.
2. **Auth Capture** — The overlay minimizes and the script intercepts `window.fetch` to capture auth headers and the active model name from the next Claude API call the user triggers (e.g., sending a message). These headers are replayed via un-patched native `fetch` (obtained from a hidden iframe) for all subsequent API calls.
3. **File Selection** — Presents a styled file picker (`<input type="file" accept=".zip">`).
4. **Parse** — Reads the zip entirely in-browser using a built-in pure-JavaScript zip reader (no external libraries). All `.txt` files are extracted into a flat list regardless of any folder structure in the zip. See [Built-in Zip Reader](#built-in-zip-reader).
5. **Organization Picker** — Fetches all Claude organizations from `/api/organizations`. If you belong to multiple orgs (e.g., personal Free plan + a Team workspace), a picker lets you choose which one. Single-org accounts skip this step.
6. **Project Picker** — Lists your existing Claude Projects and presents a picker. All conversations will be imported into the chosen project.
7. **Create Conversations** — For each `.txt` file, a new chat conversation is created via `POST /api/organizations/{orgId}/chat_conversations` with the conversation title and `project_uuid`. The conversation content is then sent as the first message via the streaming completion endpoint, and the response is drained so the server commits the conversation.
8. **Summary** — Displays a completion screen with conversations imported and errors.

> **Why does this work?** Claude's frontend wraps `window.fetch` and adds auth headers (session tokens, client identifiers) internally. Our script captures those headers by intercepting a real API call, then uses un-patched native `fetch` (from a hidden iframe) to make its own requests with the same credentials. This bypasses the wrapper entirely while preserving full authentication.

### Claude API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/organizations` | GET | Retrieve the current user's organization UUID |
| `/api/organizations/{orgId}/projects` | GET | List existing projects (for project picker) |
| `/api/organizations/{orgId}/chat_conversations` | POST | Create a new chat conversation (`uuid`, `name`, `project_uuid`) |
| `/api/organizations/{orgId}/chat_conversations/{convId}/completion` | POST | Send a message to a conversation (streaming response) |

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DELAY_MS` | `800` | Milliseconds to wait between API calls (rate-limiting / politeness delay). |

### Built-in Zip Reader

The importer includes a minimal, dependency-free zip reader implemented in pure JavaScript. It works by:

1. Scanning backwards from the end of the `ArrayBuffer` to locate the **End of Central Directory** (EOCD) signature (`0x06054b50`).
2. Reading the **Central Directory** entries to discover each file's name, compression method, compressed size, and local header offset.
3. Parsing each **Local File Header** to calculate the exact data start position.
4. Decompressing each entry: **STORE** (method 0) entries are used as-is; **DEFLATE** (method 8) entries are decompressed using the browser's built-in `DecompressionStream` API.
5. Decoding the resulting bytes as UTF-8 text.

> **Note:** The exporter generates STORE-method (uncompressed) zips for maximum compatibility. The importer also handles DEFLATE-compressed zips produced by other tools. Directories and zero-length entries are skipped.

---

## Privacy & Security

- **No data leaves your browser** — both scripts run entirely within your active browser session. Conversations are read from one service and written to another using the same browser that already has access.
- **No third-party servers** — neither script loads external resources. Both operate entirely using built-in browser APIs.
- **No API keys** — both scripts piggyback on the authentication tokens/cookies your browser already holds for chatgpt.com and claude.ai.
- **Credentials are never stored** — access tokens are used in-memory for the duration of the script and discarded when the page is closed.

---

## UI Overlays

Both scripts render a full-screen overlay with a dark theme (`rgba(0,0,0,0.85)` backdrop) to show real-time progress:

### Exporter Overlay (`ChatGPTConversationExporter.js`)

- **Header** — "ChatGPT Conversation Exporter" with a purple-to-green gradient.
- **Progress bar** — Animated fill from 0% to 100% as conversations are processed.
- **Counter** — `{current} / {total} conversations`.
- **Status line** — Current operation description.
- **Current item** — Monospace display of the conversation title being exported.
- **Log panel** — Scrollable panel showing warnings (yellow) and errors (red).
- **Close button** — Appears after export completes.

### Importer Overlay (`ClaudeConversationImporter.js`)

- **Header** — "Claude Conversation Importer" with a warm brown/copper gradient.
- **File selection view** — A styled button to trigger the file picker.
- **Organization picker** — Buttons for each Claude org (shown only for multi-org accounts).
- **Project picker** — Buttons for each existing Claude Project.
- **Progress view** — Same layout as the exporter (counter, progress bar, status, log).
- **Completion view** — Checkmark icon, summary statistics, and a **Close** button.

---

## Limitations & Known Constraints

| Area | Detail |
|------|--------|
| **Rate limiting** | Both scripts use a fixed delay between API calls (`DELAY_MS`). If you hit rate limits, increase the value. |
| **Project structure** | ChatGPT project/folder organization is **not preserved**. All conversations are exported as flat `.txt` files and imported into a single Claude Project. |
| **Conversation size** | Very large conversations may approach Claude's knowledge document size limits. |
| **Zip compression** | The exporter generates STORE (uncompressed) zips. The importer supports both STORE and DEFLATE. Other compression methods are not supported. |
| **Browser tab** | The export/import tab must remain open and in the foreground for the full duration of the operation. |
| **Session expiry** | Long-running exports (thousands of conversations) may encounter session token expiration. Re-run the script if this happens. |
| **Message types** | Only text content is extracted. Images, file attachments, and DALL-E generations are not included. |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **"…must be run on chatgpt.com / claude.ai"** | You pasted the script on the wrong website. Navigate to the correct domain first. The exporter only runs on `chatgpt.com`; the importer only runs on `claude.ai`. |
| **"No accessToken in session response"** | Your ChatGPT session may have expired. Refresh the page, ensure you are logged in, and try again. |
| **"Not a valid zip file (no EOCD found)"** | The selected file is not a valid zip archive. Make sure you are selecting the `.zip` output from Step 1. |
| **"Failed to fetch orgs"** | Your Claude session may have expired. Refresh claude.ai, log in, and re-run the importer. |
| **HTTP 429 errors** | You are being rate-limited. Increase `DELAY_MS` (e.g., to `2000` or higher) and try again. |
| **Script does nothing** | Check the browser console for errors. Some browsers require you to type `allow pasting` first before pasting scripts into the console. |
| **Missing conversations** | The exporter skips conversations with zero extractable text messages. Check the log panel for "No messages" warnings. |

---

## License

This project is provided as-is for personal use. Use at your own risk.
