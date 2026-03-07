// ============================================================
//  Claude Conversation Importer — Browser Console Script
// ============================================================
//  Imports ChatGPT conversations (from the exporter zip) into
//  Claude as Projects with knowledge documents.
//
//  1. Go to https://claude.ai (make sure you're logged in)
//  2. Press F12 → Console tab
//  3. Paste this entire script and press Enter
//  4. Select your chatgpt_export zip file
//  5. It creates Claude Projects matching each export folder
//     and imports conversations as new Claude chats.
//     If project slots are limited, small folders are merged.
// ============================================================

(async function () {
  'use strict';

  // ─── URL CHECK ─────────────────────────────────────────────
  if (!location.hostname.endsWith('claude.ai')) {
    alert('Claude Importer must be run on claude.ai.\nPlease navigate to https://claude.ai and try again.');
    return;
  }

  const DELAY_MS = 250;

  // ─── UI OVERLAY ───────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'claude-importer-overlay';
  overlay.innerHTML = `
    <style>
      #claude-importer-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.85); z-index: 999999;
        display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      #claude-imp-box {
        background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 16px;
        padding: 2.5rem; width: 560px; color: #e0e0e0; text-align: center;
      }
      #claude-imp-box h2 {
        margin: 0 0 0.3rem 0; font-size: 1.4rem; font-weight: 600;
        background: linear-gradient(135deg, #6c63ff, #4ade80);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      }
      .imp-subtitle { color: #888; font-size: 0.85rem; margin-bottom: 1.5rem; }
      .imp-btn {
        padding: 0.8rem 2rem; border: none; border-radius: 8px;
        font-size: 0.95rem; font-weight: 600; cursor: pointer;
        background: #6c63ff; color: white; transition: all 0.2s;
      }
      .imp-btn:hover { background: #4f46e5; transform: translateY(-1px); }
      .imp-btn-close {
        margin-top: 1.5rem; padding: 0.7rem 2rem; background: #6c63ff;
        color: white; border: none; border-radius: 8px; font-size: 0.95rem;
        font-weight: 600; cursor: pointer;
      }
      #imp-file-input { display: none; }
      #imp-progress { display: none; }
      #imp-done { display: none; }
      #imp-progress-bg {
        width: 100%; height: 8px; background: #0e0e10; border-radius: 4px;
        overflow: hidden; margin: 1rem 0;
      }
      #imp-progress-fill {
        height: 100%; width: 0%; border-radius: 4px;
        background: linear-gradient(90deg, #6c63ff, #4ade80);
        transition: width 0.3s ease;
      }
      #imp-counter { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.3rem; }
      #imp-status { font-size: 0.85rem; color: #a0a0b0; }
      #imp-current {
        font-size: 0.8rem; color: #ccc; margin-top: 0.5rem;
        padding: 0.5rem 0.8rem; background: #0e0e10; border-radius: 6px;
        font-family: monospace; white-space: nowrap; overflow: hidden;
        text-overflow: ellipsis; max-width: 100%;
      }
      #imp-log {
        max-height: 40vh; overflow-y: auto; margin-top: 1rem;
        font-size: 0.75rem; font-family: monospace; padding: 0.6rem;
        background: #0e0e10; border-radius: 6px; text-align: left;
        border: 1px solid #2a2a4a; color: #888;
      }
      .imp-warn { color: #fbbf24; }
      .imp-err { color: #f87171; }
      .imp-ok { color: #4ade80; }
      #imp-summary {
        margin-top: 1rem; font-size: 0.9rem; color: #a0a0b0; line-height: 1.8;
      }
      #imp-summary strong { color: #e0e0e0; }
      #imp-projects-list {
        margin-top: 1rem; text-align: left; padding: 1rem;
        background: #0e0e10; border-radius: 8px; font-size: 0.85rem;
      }
      .imp-proj-item { padding: 0.3rem 0; color: #a0a0b0; }
      .imp-proj-item span { color: #6c63ff; font-weight: 600; }
    </style>
    <div id="claude-imp-box">
      <h2>Claude Conversation Importer</h2>
      <div class="imp-subtitle">Import ChatGPT conversations into Claude Projects</div>

      <!-- Auth Capture -->
      <div id="imp-auth">
        <p style="color:#a0a0b0;font-size:0.85rem;margin-bottom:1.2rem;line-height:1.6">
          Click the button below to minimize this overlay, then
          say <strong style="color:#6c63ff">&ldquo;Hello&rdquo;</strong> to Claude
          so that your credentials can be captured.
        </p>
        <button class="imp-btn" id="imp-auth-btn">Minimize &amp; Capture</button>
        <div id="imp-auth-status" style="margin-top:1rem;font-size:0.8rem;color:#a0a0b0;">Waiting for an API call...</div>
      </div>

      <!-- File Select -->
      <div id="imp-select" style="display:none">
        <p style="color:#a0a0b0;font-size:0.85rem;margin-bottom:1.2rem;line-height:1.6">
          Select your <code style="background:rgba(108,99,255,0.15);padding:0.15rem 0.4rem;border-radius:4px;color:#6c63ff">chatgpt_export.zip</code>
          file.<br>Each folder becomes a Claude Project with its conversations<br>imported as new Claude chats.
        </p>
        <input type="file" id="imp-file-input" accept=".zip" />
        <button class="imp-btn" id="imp-select-btn">Select Zip File</button>
      </div>

      <!-- Picker (reused for org + project selection) -->
      <div id="imp-pick" style="display:none">
        <div id="imp-pick-list" style="text-align:left;max-height:40vh;overflow-y:auto;"></div>
      </div>

      <!-- Progress -->
      <div id="imp-progress">
        <div id="imp-counter">Preparing...</div>
        <div id="imp-progress-bg"><div id="imp-progress-fill"></div></div>
        <div id="imp-status">Reading zip file...</div>
        <div id="imp-current">&nbsp;</div>
        <div id="imp-log"></div>
      </div>

      <!-- Done -->
      <div id="imp-done">
        <div style="font-size:3rem;margin-bottom:1rem">&#10003;</div>
        <div style="font-size:1.3rem;font-weight:600;color:#4ade80">Import Complete!</div>
        <div id="imp-summary"></div>
        <div id="imp-projects-list"></div>
        <button class="imp-btn-close" id="imp-close-btn">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Wire up button handlers (no inline onclick — CSP blocks them on claude.ai)
  document.getElementById('imp-select-btn').addEventListener('click', () => {
    document.getElementById('imp-file-input').click();
  });
  document.getElementById('imp-close-btn').addEventListener('click', () => {
    document.getElementById('claude-importer-overlay').remove();
  });

  const ui = {
    auth: document.getElementById('imp-auth'),
    authStatus: document.getElementById('imp-auth-status'),
    select: document.getElementById('imp-select'),
    pick: document.getElementById('imp-pick'),
    pickList: document.getElementById('imp-pick-list'),
    progress: document.getElementById('imp-progress'),
    done: document.getElementById('imp-done'),
    counter: document.getElementById('imp-counter'),
    bar: document.getElementById('imp-progress-fill'),
    status: document.getElementById('imp-status'),
    current: document.getElementById('imp-current'),
    log: document.getElementById('imp-log'),
  };

  // ─── AUTH HEADER CAPTURE ──────────────────────────────────
  // Claude's fetch wrapper adds auth headers internally.
  // We intercept a real API call (user sends a message) to capture them,
  // then replay those exact headers via un-patched native fetch.
  let _capturedHeaders = {};
  let _capturedModel = '';

  // Get un-patched native fetch via hidden iframe (bypasses Claude's wrapper)
  const _iframe = document.createElement('iframe');
  _iframe.style.display = 'none';
  document.body.appendChild(_iframe);
  const _nativeFetch = _iframe.contentWindow.fetch.bind(_iframe.contentWindow);

  function startHeaderCapture() {
    return new Promise((resolve) => {
      const wrappedFetch = window.fetch;
      window.fetch = function (input, init = {}) {
        const url = typeof input === 'string' ? input
          : input instanceof Request ? input.url : '';

        if (url.includes('/api/') && !url.includes('sentry') && !url.includes('intercom')) {
          const headers = {};
          // Read from init.headers
          const h = init.headers;
          if (h) {
            if (h instanceof Headers) {
              h.forEach((v, k) => { headers[k] = v; });
            } else if (typeof h === 'object') {
              for (const [k, v] of Object.entries(h)) headers[k] = String(v);
            }
          }
          // Read from Request object
          if (input instanceof Request) {
            input.headers.forEach((v, k) => { if (!headers[k]) headers[k] = v; });
          }

          // Try to capture the model from the request body
          if (init.body && typeof init.body === 'string') {
            try {
              const bodyData = JSON.parse(init.body);
              if (bodyData.model && !_capturedModel) _capturedModel = bodyData.model;
            } catch (_) {}
          }

          if (Object.keys(headers).length > 0) {
            _capturedHeaders = headers;
            window.fetch = wrappedFetch; // restore
            resolve(headers);
          }
        }
        return wrappedFetch.apply(this, arguments);
      };
    });
  }

  // "Minimize & Capture" button — hide overlay, start intercepting
  document.getElementById('imp-auth-btn').addEventListener('click', () => {
    overlay.style.display = 'none';
    ui.authStatus.textContent = 'Listening for API calls...';

    startHeaderCapture().then((headers) => {
      const keys = Object.keys(headers);
      console.log(`✅ Captured ${keys.length} headers:`, keys);
      console.log('Header values:', JSON.stringify(headers, null, 2));
      if (_capturedModel) console.log(`✅ Captured model: ${_capturedModel}`);

      // Show overlay again with file select
      overlay.style.display = 'flex';
      ui.auth.style.display = 'none';
      ui.select.style.display = 'block';
    });
  });

  function logMsg(msg, cls = '') {
    const d = document.createElement('div');
    d.className = cls;
    d.textContent = msg;
    ui.log.appendChild(d);
    ui.log.scrollTop = ui.log.scrollHeight;
    // Mirror to browser console so messages survive overlay hide/remove
    if (cls.includes('err')) console.error('[Importer]', msg);
    else if (cls.includes('warn')) console.warn('[Importer]', msg);
    else console.log('[Importer]', msg);
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ─── MINIMAL ZIP READER (pure JS, no deps) ───────────────
  function readZip(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const files = [];

    // Find End of Central Directory (scan backwards)
    let eocdOffset = -1;
    for (let i = bytes.length - 22; i >= 0; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) throw new Error('Not a valid zip file (no EOCD found)');

    const cdOffset = view.getUint32(eocdOffset + 16, true);
    const cdEntries = view.getUint16(eocdOffset + 10, true);

    let pos = cdOffset;
    for (let i = 0; i < cdEntries; i++) {
      if (view.getUint32(pos, true) !== 0x02014b50) break;

      const compressionMethod = view.getUint16(pos + 10, true);
      const nameLen = view.getUint16(pos + 28, true);
      const extraLen = view.getUint16(pos + 30, true);
      const commentLen = view.getUint16(pos + 32, true);
      const localOffset = view.getUint32(pos + 42, true);
      const compSize = view.getUint32(pos + 20, true);

      const nameBytes = bytes.slice(pos + 46, pos + 46 + nameLen);
      const name = new TextDecoder().decode(nameBytes);

      // Read local file header to find actual data start
      const localNameLen = view.getUint16(localOffset + 26, true);
      const localExtraLen = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;

      // Skip directories
      if (!name.endsWith('/') && compSize > 0) {
        const data = bytes.slice(dataStart, dataStart + compSize);
        files.push({ name, data, compressionMethod });
      }

      pos += 46 + nameLen + extraLen + commentLen;
    }

    return files;
  }

  // Decompress a zip entry: STORE (0) returns raw data, DEFLATE (8) uses DecompressionStream
  async function decompressEntry(entry) {
    if (entry.compressionMethod === 0) return entry.data;
    if (entry.compressionMethod === 8) {
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(entry.data);
      writer.close();
      const reader = ds.readable.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
      const result = new Uint8Array(totalLen);
      let off = 0;
      for (const chunk of chunks) { result.set(chunk, off); off += chunk.length; }
      return result;
    }
    throw new Error(`Unsupported compression method ${entry.compressionMethod} for ${entry.name}`);
  }

  // ─── CLAUDE API HELPERS ───────────────────────────────────
  // All API calls use native (un-patched) fetch + captured headers.

  function buildHeaders(contentType) {
    const h = {};
    // Copy captured headers, excluding Content-Type (we set our own)
    for (const [k, v] of Object.entries(_capturedHeaders)) {
      if (k.toLowerCase() !== 'content-type') h[k] = v;
    }
    if (contentType) h['Content-Type'] = contentType;
    return h;
  }

  async function apiGet(url) {
    const resp = await _nativeFetch(url, { credentials: 'include', headers: buildHeaders() });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`GET ${resp.status}: ${text.slice(0, 300)}`);
    }
    return resp.json();
  }

  async function apiPost(url, body) {
    const resp = await _nativeFetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: buildHeaders('application/json'),
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`POST ${resp.status}: ${text.slice(0, 300)}`);
    }
    return resp.json();
  }

  // Fetch all organizations
  async function getOrgs() {
    const orgs = await apiGet('/api/organizations');
    if (orgs.length === 0) throw new Error('No organizations found');
    return orgs;
  }

  // List existing projects
  async function listProjects(orgId) {
    return apiGet(`/api/organizations/${orgId}/projects`);
  }

  // Create a new project
  async function createProject(orgId, name, description) {
    return apiPost(`/api/organizations/${orgId}/projects`, {
      name: name,
      description: description || `Imported from ChatGPT — ${name}`,
      is_private: true,
    });
  }

  // Create a new chat conversation inside a project
  async function createConversation(orgId, name, projectId) {
    const uuid = crypto.randomUUID();
    const body = { uuid, name };
    if (projectId) body.project_uuid = projectId;
    await apiPost(`/api/organizations/${orgId}/chat_conversations`, body);
    return uuid;
  }

  // Send a message to a conversation and consume the streaming response.
  // The stream MUST be fully drained so the server commits the conversation state.
  async function sendMessage(orgId, convId, message) {
    const body = {
      prompt: message,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    if (_capturedModel) body.model = _capturedModel;
    const resp = await _nativeFetch(
      `/api/organizations/${orgId}/chat_conversations/${convId}/completion`,
      {
        method: 'POST',
        credentials: 'include',
        headers: buildHeaders('application/json'),
        body: JSON.stringify(body),
      }
    );
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Completion ${resp.status}: ${text.slice(0, 300)}`);
    }
    // Drain the streaming response so the server saves the conversation
    const reader = resp.body.getReader();
    try {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    } finally {
      reader.releaseLock();
    }
  }

  // Generic picker — shows a list of items as buttons and returns the chosen one
  function showPicker(label, items, displayKey) {
    return new Promise((resolve) => {
      ui.pickList.innerHTML = '';
      const heading = document.createElement('div');
      heading.style.cssText = 'font-weight:600;margin-bottom:0.5rem;color:#e0e0e0;font-size:0.85rem;';
      heading.textContent = label;
      ui.pickList.appendChild(heading);
      for (const item of items) {
        const btn = document.createElement('button');
        btn.className = 'imp-btn';
        btn.style.cssText = 'display:block;width:100%;margin:0.4rem 0;text-align:left;padding:0.6rem 1rem;font-size:0.85rem;';
        btn.textContent = typeof displayKey === 'function' ? displayKey(item) : item[displayKey];
        btn.addEventListener('click', () => resolve(item));
        ui.pickList.appendChild(btn);
      }
    });
  }

  // ─── FILE INPUT HANDLER ───────────────────────────────────
  document.getElementById('imp-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    ui.select.style.display = 'none';
    ui.progress.style.display = 'block';

    try {
      await runImport(file);
    } catch (err) {
      ui.status.textContent = 'Fatal error: ' + err.message;
      logMsg('Fatal: ' + err.message, 'imp-err');
      console.error(err);
    }
  });

  // ─── MAIN IMPORT LOGIC ───────────────────────────────────
  async function runImport(file) {
    // Log captured headers for diagnostics
    const hdrKeys = Object.keys(_capturedHeaders);
    logMsg(`Captured ${hdrKeys.length} auth headers: ${hdrKeys.join(', ')}`, hdrKeys.length > 0 ? 'imp-ok' : 'imp-err');

    // Step 1: Read and parse the zip
    ui.status.textContent = 'Reading zip file...';
    const buffer = await file.arrayBuffer();
    let zipFiles;
    try {
      zipFiles = readZip(buffer);
    } catch (err) {
      ui.status.textContent = 'Failed to read zip: ' + err.message;
      logMsg(err.message, 'imp-err');
      return;
    }

    logMsg(`Found ${zipFiles.length} files in zip`, 'imp-ok');

    // Step 2: Decompress and group files by their original folder
    ui.status.textContent = 'Decompressing files...';
    const folderMap = {};  // folderName -> [{fileName, content}]
    for (const zf of zipFiles) {
      let decompressed;
      try {
        decompressed = await decompressEntry(zf);
      } catch (err) {
        logMsg(`Skipping ${zf.name}: ${err.message}`, 'imp-err');
        continue;
      }
      const parts = zf.name.split('/');
      let folder, fileName;
      if (parts.length >= 2) {
        folder = parts[0];
        fileName = parts.slice(1).join('/');
      } else {
        folder = 'No Project';
        fileName = parts[0];
      }
      if (!folderMap[folder]) folderMap[folder] = [];
      const content = new TextDecoder().decode(decompressed);
      folderMap[folder].push({ fileName, content });
    }

    const folderNames = Object.keys(folderMap).sort();
    const totalFiles = Object.values(folderMap).reduce((s, f) => s + f.length, 0);
    for (const name of folderNames) {
      logMsg(`  ${name}: ${folderMap[name].length} files`, 'imp-ok');
    }
    logMsg(`${folderNames.length} folders, ${totalFiles} total conversations`, 'imp-ok');

    // Step 3: Pick organization (show picker if multiple)
    ui.status.textContent = 'Getting organization info...';
    let orgs;
    try {
      orgs = await getOrgs();
    } catch (err) {
      ui.status.textContent = 'Failed to get orgs: ' + err.message;
      logMsg(err.message, 'imp-err');
      return;
    }

    let chosenOrg;
    if (orgs.length === 1) {
      chosenOrg = orgs[0];
    } else {
      logMsg(`Found ${orgs.length} organizations`, 'imp-ok');
      ui.progress.style.display = 'none';
      ui.pick.style.display = 'block';
      chosenOrg = await showPicker(
        'Choose your organization:',
        orgs,
        (o) => `${o.name}${o.billing_type ? ` (${o.billing_type})` : ''}`
      );
      ui.pick.style.display = 'none';
      ui.progress.style.display = 'block';
    }
    const orgId = chosenOrg.uuid;
    logMsg(`Organization: ${chosenOrg.name} (${orgId.slice(0, 8)}...)`, 'imp-ok');

    // Step 4: Check existing projects to know available slots
    ui.status.textContent = 'Checking existing projects...';
    let existingProjects = [];
    try {
      existingProjects = await listProjects(orgId);
    } catch (err) {
      logMsg('Warning: Could not list existing projects: ' + err.message, 'imp-warn');
    }
    const existingNames = new Map();
    for (const p of existingProjects) {
      existingNames.set(p.name.toLowerCase(), p.uuid);
    }
    const MAX_PROJECTS = 10;
    const usedSlots = existingProjects.length;
    const availableSlots = Math.max(0, MAX_PROJECTS - usedSlots);
    logMsg(`${usedSlots} existing projects, ${availableSlots} slots available (max ${MAX_PROJECTS})`, availableSlots > 0 ? 'imp-ok' : 'imp-warn');

    // Step 5: Build project assignments — map each folder to a project name
    // Reuse existing projects by name match; create new ones for the rest.
    // If more folders than available slots, merge the smallest into "ChatGPT Import (Misc)".
    const assignments = {};  // projectName -> [{fileName, content}]
    const foldersNeedingNewProject = [];

    for (const folder of folderNames) {
      const existingId = existingNames.get(folder.toLowerCase());
      if (existingId) {
        // Reuse existing project
        assignments[folder] = { files: folderMap[folder], id: existingId, reused: true };
        logMsg(`Will reuse existing project: ${folder}`, 'imp-warn');
      } else {
        foldersNeedingNewProject.push(folder);
      }
    }

    // Sort folders needing new projects by file count (largest first)
    foldersNeedingNewProject.sort((a, b) => folderMap[b].length - folderMap[a].length);

    if (foldersNeedingNewProject.length <= availableSlots) {
      // Enough slots — one project per folder
      for (const folder of foldersNeedingNewProject) {
        assignments[folder] = { files: folderMap[folder], id: null, reused: false };
      }
    } else {
      // Not enough slots — keep the largest folders as their own projects,
      // merge the rest into a single "ChatGPT Import (Misc)" project
      const keepCount = Math.max(0, availableSlots - 1); // reserve 1 slot for Misc
      const keepFolders = foldersNeedingNewProject.slice(0, keepCount);
      const mergeFolders = foldersNeedingNewProject.slice(keepCount);

      for (const folder of keepFolders) {
        assignments[folder] = { files: folderMap[folder], id: null, reused: false };
      }

      // Merge remaining folders — prefix filenames with folder name
      const miscFiles = [];
      for (const folder of mergeFolders) {
        for (const f of folderMap[folder]) {
          miscFiles.push({ fileName: `[${folder}] ${f.fileName}`, content: f.content });
        }
      }
      if (miscFiles.length > 0) {
        const miscName = 'Miscellaneous';
        const existingMiscId = existingNames.get(miscName.toLowerCase());
        assignments[miscName] = { files: miscFiles, id: existingMiscId || null, reused: !!existingMiscId };
        logMsg(`Merging ${mergeFolders.length} folders into "${miscName}" (${miscFiles.length} files)`, 'imp-warn');
      }
    }

    const projectNames = Object.keys(assignments);
    logMsg(`Plan: ${projectNames.length} projects (${projectNames.filter(n => !assignments[n].reused).length} new, ${projectNames.filter(n => assignments[n].reused).length} reused)`, 'imp-ok');

    // Step 6: Create projects and upload files
    let projectsCreated = 0;
    let projectsReused = 0;
    let filesUploaded = 0;
    let fileErrors = 0;
    let fileIndex = 0;
    const projectResults = {};

    for (const projectName of projectNames) {
      const assignment = assignments[projectName];
      let projectId = assignment.id;

      if (assignment.reused) {
        projectsReused++;
      } else {
        // Create the project
        try {
          ui.status.textContent = `Creating project: ${projectName}...`;
          const proj = await createProject(orgId, projectName);
          projectId = proj.uuid;
          projectsCreated++;
          logMsg(`Created project: ${projectName}`, 'imp-ok');
          await sleep(DELAY_MS);
        } catch (err) {
          logMsg(`Failed to create project "${projectName}": ${err.message}`, 'imp-err');
          fileErrors += assignment.files.length;
          fileIndex += assignment.files.length;
          continue;
        }
      }

      projectResults[projectName] = { total: assignment.files.length, uploaded: 0 };

      // Create a conversation for each file
      for (const f of assignment.files) {
        fileIndex++;
        const pct = Math.round((fileIndex / totalFiles) * 100);
        ui.bar.style.width = pct + '%';
        ui.counter.textContent = `${fileIndex} / ${totalFiles} conversations`;
        ui.current.textContent = `${projectName} / ${f.fileName}`;
        ui.status.textContent = `Creating conversation in ${projectName}...`;

        try {
          const title = f.fileName.replace(/\.txt$/i, '');
          const convId = await createConversation(orgId, title, projectId);
          await sendMessage(orgId, convId, f.content);
          filesUploaded++;
          projectResults[projectName].uploaded++;
        } catch (err) {
          fileErrors++;
          logMsg(`Error: ${f.fileName} — ${err.message}`, 'imp-err');
        }

        await sleep(DELAY_MS);
      }
    }

    // Step 7: Show results
    ui.progress.style.display = 'none';
    ui.done.style.display = 'block';

    const summary = document.getElementById('imp-summary');
    summary.innerHTML = `
      <strong>${projectsCreated}</strong> projects created
      ${projectsReused > 0 ? `<br><span style="color:#fbbf24">${projectsReused} projects reused</span>` : ''}
      <br><strong>${filesUploaded}</strong> conversations uploaded
      ${fileErrors > 0 ? `<br><span style="color:#f87171">${fileErrors} errors</span>` : ''}
    `;

    const projList = document.getElementById('imp-projects-list');
    projList.style.display = '';
    projList.innerHTML = '<div style="font-weight:600;margin-bottom:0.5rem;color:#e0e0e0">Projects</div>';
    for (const [name, result] of Object.entries(projectResults).sort((a, b) => a[0].localeCompare(b[0]))) {
      projList.innerHTML += `<div class="imp-proj-item"><span>${result.uploaded}</span> / ${result.total} — ${name}</div>`;
    }

    console.log(`✅ Claude Import complete: ${projectsCreated} projects created, ${projectsReused} reused, ${filesUploaded} conversations created, ${fileErrors} errors`);
  }

})();