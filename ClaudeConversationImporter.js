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
//  5. It creates matching Projects and uploads conversations
//     as knowledge documents
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
        background: linear-gradient(135deg, #d4a574, #c17f59);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      }
      .imp-subtitle { color: #888; font-size: 0.85rem; margin-bottom: 1.5rem; }
      .imp-btn {
        padding: 0.8rem 2rem; border: none; border-radius: 8px;
        font-size: 0.95rem; font-weight: 600; cursor: pointer;
        background: #d4a574; color: #1a1a2e; transition: all 0.2s;
      }
      .imp-btn:hover { background: #c17f59; transform: translateY(-1px); }
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
        background: linear-gradient(90deg, #d4a574, #4ade80);
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
        max-height: 150px; overflow-y: auto; margin-top: 1rem;
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
      .imp-proj-item span { color: #d4a574; font-weight: 600; }
    </style>
    <div id="claude-imp-box">
      <h2>Claude Conversation Importer</h2>
      <div class="imp-subtitle">Import ChatGPT conversations into Claude Projects</div>

      <!-- File Select -->
      <div id="imp-select">
        <p style="color:#a0a0b0;font-size:0.85rem;margin-bottom:1.2rem;line-height:1.6">
          Select your <code style="background:rgba(212,165,116,0.15);padding:0.15rem 0.4rem;border-radius:4px;color:#d4a574">chatgpt_export.zip</code>
          file.<br>Each folder becomes a Claude Project, and each conversation<br>is uploaded as a knowledge document.
        </p>
        <input type="file" id="imp-file-input" accept=".zip" />
        <button class="imp-btn" onclick="document.getElementById('imp-file-input').click()">Select Zip File</button>
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
        <button class="imp-btn-close" onclick="document.getElementById('claude-importer-overlay').remove()">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const ui = {
    select: document.getElementById('imp-select'),
    progress: document.getElementById('imp-progress'),
    done: document.getElementById('imp-done'),
    counter: document.getElementById('imp-counter'),
    bar: document.getElementById('imp-progress-fill'),
    status: document.getElementById('imp-status'),
    current: document.getElementById('imp-current'),
    log: document.getElementById('imp-log'),
  };

  function logMsg(msg, cls = '') {
    const d = document.createElement('div');
    d.className = cls;
    d.textContent = msg;
    ui.log.appendChild(d);
    ui.log.scrollTop = ui.log.scrollHeight;
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

  // Get organization ID from the page
  async function getOrgId() {
    // Try fetching from the organizations endpoint
    const resp = await fetch('/api/organizations');
    if (!resp.ok) throw new Error(`Failed to fetch orgs: ${resp.status}`);
    const orgs = await resp.json();
    if (orgs.length === 0) throw new Error('No organizations found');
    // Use the first (usually only) org
    return orgs[0].uuid;
  }

  // List existing projects
  async function listProjects(orgId) {
    const resp = await fetch(`/api/organizations/${orgId}/projects`);
    if (!resp.ok) throw new Error(`Failed to list projects: ${resp.status}`);
    return await resp.json();
  }

  // Create a new project
  async function createProject(orgId, name, description = '') {
    const resp = await fetch(`/api/organizations/${orgId}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        description: description || `Imported from ChatGPT — ${name}`,
        is_private: true,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Failed to create project "${name}": ${resp.status} ${text.slice(0, 200)}`);
    }
    return await resp.json();
  }

  // Upload a document to a project
  async function uploadDocument(orgId, projectId, fileName, content) {
    // Claude uses multipart form upload for project docs
    const blob = new Blob([content], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', blob, fileName);

    const resp = await fetch(`/api/organizations/${orgId}/projects/${projectId}/docs`, {
      method: 'POST',
      body: formData,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Upload failed: ${resp.status} ${text.slice(0, 200)}`);
    }
    return await resp.json();
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

    // Step 2: Decompress and group files by project (top-level folder)
    ui.status.textContent = 'Decompressing files...';
    const projectMap = {};  // projectName -> [{fileName, content}]
    for (const zf of zipFiles) {
      let decompressed;
      try {
        decompressed = await decompressEntry(zf);
      } catch (err) {
        logMsg(`Skipping ${zf.name}: ${err.message}`, 'imp-err');
        continue;
      }
      const parts = zf.name.split('/');
      let project, fileName;
      if (parts.length >= 2) {
        project = parts[0];
        fileName = parts.slice(1).join('/');
      } else {
        project = 'No Project';
        fileName = parts[0];
      }
      if (!projectMap[project]) projectMap[project] = [];
      const content = new TextDecoder().decode(decompressed);
      projectMap[project].push({ fileName, content });
    }

    const projectNames = Object.keys(projectMap).sort();
    const totalFiles = zipFiles.length;
    logMsg(`Found ${projectNames.length} projects with ${totalFiles} total conversations`, 'imp-ok');

    // Step 3: Get org ID
    ui.status.textContent = 'Getting organization info...';
    let orgId;
    try {
      orgId = await getOrgId();
      logMsg(`Organization ID: ${orgId.slice(0, 8)}...`, 'imp-ok');
    } catch (err) {
      ui.status.textContent = 'Failed to get org ID: ' + err.message;
      logMsg(err.message, 'imp-err');
      return;
    }

    // Step 4: Get existing projects to avoid duplicates
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

    // Step 5: Create projects and upload files
    let projectsCreated = 0;
    let projectsReused = 0;
    let filesUploaded = 0;
    let fileErrors = 0;
    let fileIndex = 0;
    const projectResults = {};

    for (const projectName of projectNames) {
      const files = projectMap[projectName];
      let projectId;

      // Check if project already exists
      const existingId = existingNames.get(projectName.toLowerCase());
      if (existingId) {
        projectId = existingId;
        projectsReused++;
        logMsg(`Project exists, reusing: ${projectName}`, 'imp-warn');
      } else {
        // Create new project
        try {
          ui.status.textContent = `Creating project: ${projectName}...`;
          const proj = await createProject(orgId, projectName);
          projectId = proj.uuid;
          projectsCreated++;
          logMsg(`Created project: ${projectName}`, 'imp-ok');
          await sleep(DELAY_MS);
        } catch (err) {
          logMsg(`Failed to create project "${projectName}": ${err.message}`, 'imp-err');
          fileErrors += files.length;
          fileIndex += files.length;
          continue;
        }
      }

      projectResults[projectName] = { total: files.length, uploaded: 0 };

      // Upload each conversation file
      for (const f of files) {
        fileIndex++;
        const pct = Math.round((fileIndex / totalFiles) * 100);
        ui.bar.style.width = pct + '%';
        ui.counter.textContent = `${fileIndex} / ${totalFiles} files`;
        ui.current.textContent = `${projectName} / ${f.fileName}`;
        ui.status.textContent = `Uploading to ${projectName}...`;

        try {
          await uploadDocument(orgId, projectId, f.fileName, f.content);
          filesUploaded++;
          projectResults[projectName].uploaded++;
        } catch (err) {
          fileErrors++;
          logMsg(`Error: ${f.fileName} — ${err.message}`, 'imp-err');
        }

        await sleep(DELAY_MS);
      }
    }

    // Step 6: Show results
    ui.progress.style.display = 'none';
    ui.done.style.display = 'block';

    const summary = document.getElementById('imp-summary');
    summary.innerHTML = `
      <strong>${projectsCreated}</strong> projects created
      ${projectsReused > 0 ? `<br><span style="color:#fbbf24">${projectsReused} projects already existed (reused)</span>` : ''}
      <br><strong>${filesUploaded}</strong> conversations uploaded
      ${fileErrors > 0 ? `<br><span style="color:#f87171">${fileErrors} errors</span>` : ''}
    `;

    const projList = document.getElementById('imp-projects-list');
    projList.innerHTML = '<div style="font-weight:600;margin-bottom:0.5rem;color:#e0e0e0">Projects</div>';
    for (const [name, result] of Object.entries(projectResults).sort((a, b) => a[0].localeCompare(b[0]))) {
      projList.innerHTML += `<div class="imp-proj-item"><span>${result.uploaded}</span> / ${result.total} — ${name}</div>`;
    }

    console.log(`✅ Claude Import complete: ${projectsCreated} projects, ${filesUploaded} docs uploaded, ${fileErrors} errors`);
  }

})();