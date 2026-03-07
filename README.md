# ChatGPT to Claude

Migrate **all** your ChatGPT conversations into Claude Projects with two browser-console scripts — no API keys, no extensions, no external tools.

| Step | Script | Where to run | What it does |
|------|--------|--------------|--------------|
| 1 | `ChatGPTConversationExporter.js` | chatgpt.com | Exports every conversation as a `.txt` inside a `.zip`, organized by project folder. |
| 2 | `ClaudeConversationImporter.js` | claude.ai | Reads the `.zip`, creates matching Claude Projects, and uploads each conversation as a knowledge document. |

Both scripts work the same way: open **F12 → Console**, paste the script, hit **Enter**. They reuse the Authorization token and Cookie the browser already holds for the active session — nothing to configure.

---

## Table of Contents

- [Requirements](#requirements)
- [Step 1 — Export from ChatGPT](#step-1--export-from-chatgpt)
  - [Usage](#usage)
  - [How It Works](#how-it-works)
  - [ChatGPT API Endpoints Used](#chatgpt-api-endpoints-used)
  - [Configuration](#configuration)
  - [Project / Folder Detection](#project--folder-detection)
  - [Conversation Format](#conversation-format)
  - [Duplicate Filename Handling](#duplicate-filename-handling)
  - [External Dependencies](#external-dependencies)
- [Step 2 — Import into Claude](#step-2--import-into-claude)
  - [Usage](#usage-1)
  - [How It Works](#how-it-works-1)
  - [Claude API Endpoints Used](#claude-api-endpoints-used)
  - [Configuration](#configuration-1)
  - [Built-in Zip Reader](#built-in-zip-reader)
  - [Duplicate Project Handling](#duplicate-project-handling)
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

1. **Authentication** — Retrieves your session access token by calling `/api/auth/session`. The token is sent as a `Bearer` token in the `Authorization` header for all subsequent requests.
2. **Discovery** — Paginates through `/backend-api/conversations` (100 conversations per page, ordered by `updated`) to build a complete list of every conversation in your account.
3. **Fetch** — For each conversation, fetches the full message tree from `/backend-api/conversation/{id}`.
4. **Extract** — Walks the message tree using a depth-first traversal (iterative stack). Each node's `message.content.parts` array is joined into plain text. Messages are labelled by role (`You`, `ChatGPT`, `System`, `Tool`).
5. **Package** — Writes each conversation as a `.txt` file inside a zip archive, organized into folders by project/workspace name.
6. **Download** — Generates the zip blob in-browser and triggers an automatic download.

### ChatGPT API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/session` | GET | Retrieve the current session access token |
| `/backend-api/conversations?offset={n}&limit=100&order=updated` | GET | Paginate through the conversation list |
| `/backend-api/conversation/{id}` | GET | Fetch the full message tree for a single conversation |

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DELAY_MS` | `1200` | Milliseconds to wait between API calls (rate-limiting / politeness delay). |
| `BASE` | `/backend-api` | Base path for ChatGPT backend API calls. |

### Project / Folder Detection

Each conversation is placed into a folder determined by the following priority:

1. `conv.project` — if the conversation has a `project` object, its `.name` or `.title` is used.
2. `conv.workspace` — same logic as above, checked as a fallback.
3. `conv.gizmo_id` — if the conversation was with a Custom GPT, the folder is named `Custom GPT ({first 12 chars of gizmo_id})`.
4. **Fallback** — conversations that match none of the above go into a `No Project` folder.

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

If two conversations in the same project have the same title, subsequent files get a numeric suffix:

```
My Project/Some Title.txt
My Project/Some Title (1).txt
My Project/Some Title (2).txt
```

File and folder names are sanitized: characters `< > : " / \ | ? *` are replaced with `_`, leading/trailing dots are stripped, and names are truncated to 100 characters.

### External Dependencies

- **[JSZip 3.10.1](https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js)** — loaded dynamically from the cdnjs CDN at runtime to create the zip archive. No pre-installation required.

---

## Step 2 — Import into Claude

### Usage

1. Go to **[claude.ai](https://claude.ai)** and make sure you are **logged in**.
2. Press **F12** (or right-click → *Inspect*) to open **Developer Tools**.
3. Click the **Console** tab.
4. Copy the entire contents of **`ClaudeConversationImporter.js`**.
5. **Paste** it into the console and press **Enter**.
6. A file picker dialog will appear — select your `chatgpt_export_YYYY-MM-DD.zip` file from Step 1.
7. The script does the rest automatically. A progress overlay shows live status.
8. When finished, a summary screen shows projects created and documents uploaded. Click **Close** to dismiss.

### How It Works

1. **File Selection** — Presents a styled file picker (`<input type="file" accept=".zip">`). The user selects the export zip.
2. **Parse** — Reads the zip entirely in-browser using a built-in pure-JavaScript zip reader (no external libraries). See [Built-in Zip Reader](#built-in-zip-reader).
3. **Group** — Files are grouped by their top-level folder name. Each folder becomes a Claude Project. Files without a folder go into a `No Project` project.
4. **Organization** — Fetches the current Claude organization ID from `/api/organizations` (uses the first org returned).
5. **Deduplication** — Lists existing Claude Projects and performs a case-insensitive name match. If a project with the same name already exists, it is reused instead of creating a duplicate.
6. **Create Projects** — New projects are created via `POST /api/organizations/{orgId}/projects` with `is_private: true`.
7. **Upload Documents** — Each conversation `.txt` is uploaded as a multipart form (`FormData`) to the project's docs endpoint.
8. **Summary** — Displays a completion screen with counts of projects created, projects reused, documents uploaded, and errors.

> **Why does this work?** The script runs inside an active Claude session. The browser already holds your Claude session cookie and authorization token, so the script can call Claude's internal APIs on your behalf — no extra authentication needed.

### Claude API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/organizations` | GET | Retrieve the current user's organization UUID |
| `/api/organizations/{orgId}/projects` | GET | List existing projects (for duplicate detection) |
| `/api/organizations/{orgId}/projects` | POST | Create a new project (`name`, `description`, `is_private`) |
| `/api/organizations/{orgId}/projects/{projectId}/docs` | POST | Upload a conversation file as a knowledge document (multipart form) |

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DELAY_MS` | `800` | Milliseconds to wait between API calls (rate-limiting / politeness delay). |

### Built-in Zip Reader

The importer includes a minimal, dependency-free zip reader implemented in pure JavaScript. It works by:

1. Scanning backwards from the end of the `ArrayBuffer` to locate the **End of Central Directory** (EOCD) signature (`0x06054b50`).
2. Reading the **Central Directory** entries to discover each file's name, compressed size, and local header offset.
3. Parsing each **Local File Header** to calculate the exact data start position.
4. Extracting raw file bytes and decoding them as UTF-8 text.

> **Note:** This reader handles **STORE**-method (uncompressed) zip entries. The exporter's JSZip library should produce compatible output. Directories and zero-length entries are skipped.

### Duplicate Project Handling

Before creating any projects, the importer fetches the full list of existing Claude Projects and builds a case-insensitive lookup map. If a project with a matching name already exists:

- The existing project's UUID is reused.
- A warning is logged: `Project exists, reusing: {name}`.
- Conversation documents are uploaded into the existing project alongside any prior content.

---

## Privacy & Security

- **No data leaves your browser** — both scripts run entirely within your active browser session. Conversations are read from one service and written to another using the same browser that already has access.
- **No third-party servers** — the only external network request is loading JSZip from the cdnjs CDN (Step 1). The importer has zero external dependencies.
- **No API keys** — both scripts piggyback on the authentication tokens/cookies your browser already holds for chatgpt.com and claude.ai.
- **Credentials are never stored** — access tokens are used in-memory for the duration of the script and discarded when the page is closed.

---

## UI Overlays

Both scripts render a full-screen overlay with a dark theme (`rgba(0,0,0,0.85)` backdrop) to show real-time progress:

### Exporter Overlay (`ChatGPTConversationExporter.js`)

- **Header** — "ChatGPT Exporter" with a purple-to-green gradient.
- **Progress bar** — Animated fill from 0% to 100% as conversations are processed.
- **Counter** — `{current} / {total} conversations`.
- **Status line** — Current operation description.
- **Current item** — Monospace display of `{project} / {title}` being exported.
- **Log panel** — Scrollable panel showing warnings (yellow) and errors (red).
- **Close button** — Appears after export completes.

### Importer Overlay (`ClaudeConversationImporter.js`)

- **Header** — "Claude Importer" with a warm brown/copper gradient.
- **File selection view** — A styled button to trigger the file picker.
- **Progress view** — Same layout as the exporter (counter, progress bar, status, log).
- **Completion view** — Checkmark icon, summary statistics, per-project breakdown, and a **Close** button.

---

## Limitations & Known Constraints

| Area | Detail |
|------|--------|
| **Rate limiting** | Both scripts use a fixed delay between API calls (`DELAY_MS`). If you hit rate limits, increase the value. |
| **Conversation size** | Very large conversations may approach Claude's knowledge document size limits. |
| **Zip compression** | The importer's built-in zip reader expects uncompressed (STORE method) entries. If you modify the exporter's JSZip settings, ensure compression is set to `STORE`. |
| **Browser tab** | The export/import tab must remain open and in the foreground for the full duration of the operation. |
| **Session expiry** | Long-running exports (thousands of conversations) may encounter session token expiration. Re-run the script if this happens. |
| **Custom GPTs** | Conversations with Custom GPTs are grouped by `gizmo_id`, which produces folder names like `Custom GPT (g-abc123...)` rather than the GPT's display name. |
| **Message types** | Only text content is extracted. Images, file attachments, and DALL-E generations are not included. |
| **Content Security Policy** | Some browsers or browser extensions may block the dynamic loading of JSZip from the CDN. Disable restrictive extensions if the exporter fails to load. |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **"No accessToken in session response"** | Your ChatGPT session may have expired. Refresh the page, ensure you are logged in, and try again. |
| **"Not a valid zip file (no EOCD found)"** | The selected file is not a valid zip archive. Make sure you are selecting the `.zip` output from Step 1. |
| **"Failed to fetch orgs"** | Your Claude session may have expired. Refresh claude.ai, log in, and re-run the importer. |
| **HTTP 429 errors** | You are being rate-limited. Increase `DELAY_MS` (e.g., to `2000` or higher) and try again. |
| **Script does nothing** | Check the browser console for errors. Some browsers require you to type `allow pasting` first before pasting scripts into the console. |
| **JSZip fails to load** | A browser extension (ad blocker, CSP enforcer) may be blocking the CDN request. Try disabling extensions or using an incognito window. |
| **Missing conversations** | The exporter skips conversations with zero extractable text messages. Check the log panel for "No messages" warnings. |

---

## License

This project is provided as-is for personal use. Use at your own risk.
