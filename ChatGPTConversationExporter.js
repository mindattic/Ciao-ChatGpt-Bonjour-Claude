// ============================================================
//  ChatGPT Conversation Exporter — Browser Console Script
// ============================================================
//  1. Go to https://chatgpt.com (make sure you're logged in)
//  2. Press F12 → Console tab
//  3. Paste this entire script and press Enter
//  4. It will export all conversations as .txt files in a .zip
//     organized by project folders
// ============================================================

(async function() {
  'use strict';

  // ─── URL CHECK ─────────────────────────────────────────────
  if (!location.hostname.endsWith('chatgpt.com')) {
    alert('ChatGPT Exporter must be run on chatgpt.com.\nPlease navigate to https://chatgpt.com and try again.');
    return;
  }

  // ─── CONFIG ───────────────────────────────────────────────
  const DELAY_MS = 250;          // ms between API calls (be nice to the server)
  const BASE = '/backend-api';

  // ─── UI OVERLAY ───────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'cgpt-exporter-overlay';
  overlay.innerHTML = `
    <style>
      #cgpt-exporter-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.85); z-index: 999999;
        display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      #cgpt-exporter-box {
        background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 16px;
        padding: 2.5rem; width: 520px; color: #e0e0e0; text-align: center;
      }
      #cgpt-exporter-box h2 {
        margin: 0 0 0.3rem 0; font-size: 1.4rem; font-weight: 600;
        background: linear-gradient(135deg, #6c63ff, #4ade80);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      }
      #cgpt-exporter-box .subtitle { color: #888; font-size: 0.85rem; margin-bottom: 1.5rem; }
      #cgpt-exp-progress-bg {
        width: 100%; height: 8px; background: #0e0e10; border-radius: 4px;
        overflow: hidden; margin: 1rem 0;
      }
      #cgpt-exp-progress-fill {
        height: 100%; width: 0%; border-radius: 4px;
        background: linear-gradient(90deg, #6c63ff, #4ade80);
        transition: width 0.3s ease;
      }
      #cgpt-exp-counter { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.3rem; }
      #cgpt-exp-status { font-size: 0.85rem; color: #a0a0b0; }
      #cgpt-exp-current {
        font-size: 0.8rem; color: #ccc; margin-top: 0.5rem;
        padding: 0.5rem 0.8rem; background: #0e0e10; border-radius: 6px;
        font-family: monospace; white-space: nowrap; overflow: hidden;
        text-overflow: ellipsis; max-width: 100%;
      }
      #cgpt-exp-log {
        max-height: 120px; overflow-y: auto; margin-top: 1rem;
        font-size: 0.75rem; font-family: monospace; padding: 0.6rem;
        background: #0e0e10; border-radius: 6px; text-align: left;
        border: 1px solid #2a2a4a; color: #888;
      }
      .cgpt-exp-warn { color: #fbbf24; }
      .cgpt-exp-err { color: #f87171; }
    </style>
    <div id="cgpt-exporter-box">
      <h2>ChatGPT Conversation Exporter</h2>
      <div class="subtitle">Exporting conversations — please keep this tab open</div>
      <div id="cgpt-exp-counter">Preparing...</div>
      <div id="cgpt-exp-progress-bg"><div id="cgpt-exp-progress-fill"></div></div>
      <div id="cgpt-exp-status">Fetching conversation list...</div>
      <div id="cgpt-exp-current">&nbsp;</div>
      <div id="cgpt-exp-log"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const ui = {
    counter: document.getElementById('cgpt-exp-counter'),
    bar: document.getElementById('cgpt-exp-progress-fill'),
    status: document.getElementById('cgpt-exp-status'),
    current: document.getElementById('cgpt-exp-current'),
    log: document.getElementById('cgpt-exp-log'),
  };

  function updateUI(current, total, project, title) {
    const pct = Math.round((current / total) * 100);
    ui.counter.textContent = `${current} / ${total} conversations`;
    ui.bar.style.width = pct + '%';
    ui.current.textContent = `${project} / ${title}`;
  }

  function logMsg(msg, cls = '') {
    const d = document.createElement('div');
    d.className = cls;
    d.textContent = msg;
    ui.log.appendChild(d);
    ui.log.scrollTop = ui.log.scrollHeight;
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function sanitize(name, maxLen = 100) {
    name = name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim().replace(/^\.+|\.+$/g, '');
    return (name || 'Untitled').slice(0, maxLen);
  }

  // ─── GET ACCESS TOKEN ─────────────────────────────────────
  // ChatGPT stores the access token in the session endpoint
  ui.status.textContent = 'Getting access token...';
  let accessToken;
  try {
    const sessResp = await fetch('/api/auth/session');
    const sessData = await sessResp.json();
    accessToken = sessData.accessToken;
    if (!accessToken) throw new Error('No accessToken in session response');
  } catch (e) {
    ui.status.textContent = 'Failed to get access token: ' + e.message;
    logMsg('Error: ' + e.message, 'cgpt-exp-err');
    return;
  }

  const hdrs = {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json',
  };

  // ─── FETCH ALL CONVERSATIONS ──────────────────────────────
  ui.status.textContent = 'Fetching conversation list...';
  let allConvs = [];
  let offset = 0;
  const limit = 100;

  try {
    while (true) {
      const url = `${BASE}/conversations?offset=${offset}&limit=${limit}&order=updated`;
      const resp = await fetch(url, { headers: hdrs });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${await resp.text().then(t => t.slice(0, 200))}`);
      }
      const data = await resp.json();
      const items = data.items || [];
      if (items.length === 0) break;

      allConvs = allConvs.concat(items);
      ui.status.textContent = `Discovered ${allConvs.length} conversations...`;

      if (allConvs.length >= (data.total || Infinity)) break;
      offset += limit;
      await sleep(DELAY_MS);
    }
  } catch (e) {
    ui.status.textContent = 'Failed to fetch conversations: ' + e.message;
    logMsg('Error: ' + e.message, 'cgpt-exp-err');
    return;
  }

  if (allConvs.length === 0) {
    ui.status.textContent = 'No conversations found.';
    return;
  }

  const total = allConvs.length;
  ui.counter.textContent = `0 / ${total} conversations`;
  ui.status.textContent = `Found ${total} conversations. Starting export...`;

  // ─── NATIVE ZIP WRITER (pure JS, no deps) ─────────────────
  const ZipWriter = (() => {
    // CRC-32 lookup table
    const crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[n] = c;
    }
    function crc32(bytes) {
      let crc = 0xFFFFFFFF;
      for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
      return (crc ^ 0xFFFFFFFF) >>> 0;
    }
    function utf8(str) { return new TextEncoder().encode(str); }
    function u16(v) { return [v & 0xFF, (v >> 8) & 0xFF]; }
    function u32(v) { return [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF]; }

    class Writer {
      constructor() { this._files = []; }
      file(name, content) {
        const data = (typeof content === 'string') ? utf8(content) : new Uint8Array(content);
        this._files.push({ name: utf8(name), data, crc: crc32(data) });
      }
      generate() {
        const parts = [];       // local file headers + data
        const central = [];     // central directory entries
        let offset = 0;
        for (const f of this._files) {
          // Local file header
          const local = new Uint8Array([
            0x50,0x4B,0x03,0x04,  // signature
            0x14,0x00,            // version needed (2.0)
            0x00,0x00,            // flags
            0x00,0x00,            // compression (STORE)
            0x00,0x00,0x00,0x00,  // mod time + date
            ...u32(f.crc),
            ...u32(f.data.length),
            ...u32(f.data.length),
            ...u16(f.name.length),
            0x00,0x00,            // extra length
          ]);
          parts.push(local, f.name, f.data);

          // Central directory entry
          const cd = new Uint8Array([
            0x50,0x4B,0x01,0x02,  // signature
            0x14,0x00,            // version made by
            0x14,0x00,            // version needed
            0x00,0x00,            // flags
            0x00,0x00,            // compression (STORE)
            0x00,0x00,0x00,0x00,  // mod time + date
            ...u32(f.crc),
            ...u32(f.data.length),
            ...u32(f.data.length),
            ...u16(f.name.length),
            0x00,0x00,            // extra length
            0x00,0x00,            // comment length
            0x00,0x00,            // disk number
            0x00,0x00,            // internal attrs
            0x00,0x00,0x00,0x00,  // external attrs
            ...u32(offset),
          ]);
          central.push(cd, f.name);

          offset += local.length + f.name.length + f.data.length;
        }
        const cdOffset = offset;
        const cdSize = central.reduce((s, c) => s + c.length, 0);
        // End of Central Directory
        const eocd = new Uint8Array([
          0x50,0x4B,0x05,0x06,
          0x00,0x00, 0x00,0x00,
          ...u16(this._files.length),
          ...u16(this._files.length),
          ...u32(cdSize),
          ...u32(cdOffset),
          0x00,0x00,
        ]);
        return new Blob([...parts, ...central, eocd], { type: 'application/zip' });
      }
    }
    return Writer;
  })();

  const zip = new ZipWriter();

  // ─── HELPERS ──────────────────────────────────────────────
  function getProject(conv) {
    for (const key of ['project', 'workspace']) {
      const val = conv[key];
      if (val) {
        if (typeof val === 'object') return val.name || val.title || 'No Project';
        if (typeof val === 'string') return val;
      }
    }
    if (conv.gizmo_id) return `Custom GPT (${conv.gizmo_id.slice(0, 12)})`;
    return 'No Project';
  }

  function extractMessages(detail) {
    const mapping = detail.mapping || {};
    const childrenMap = {};
    let rootId = null;
    for (const [nid, node] of Object.entries(mapping)) {
      if (node.parent == null) rootId = nid;
      else {
        if (!childrenMap[node.parent]) childrenMap[node.parent] = [];
        childrenMap[node.parent].push(nid);
      }
    }
    if (!rootId) return [];

    const messages = [];
    const stack = [rootId];
    const visited = new Set();

    while (stack.length > 0) {
      const nid = stack.pop();
      if (visited.has(nid)) continue;
      visited.add(nid);

      const node = mapping[nid] || {};
      const msg = node.message;
      if (msg && msg.content) {
        const role = (msg.author || {}).role || 'unknown';
        const content = msg.content;
        let text = '';
        if (typeof content === 'object' && content.parts) {
          text = content.parts.map(p => {
            if (typeof p === 'string') return p;
            if (typeof p === 'object') return p.text || p.result || '';
            return '';
          }).join('\n');
        } else if (typeof content === 'string') {
          text = content;
        }
        if (text.trim()) {
          const displayRole = { user: 'You', assistant: 'ChatGPT', system: 'System', tool: 'Tool' }[role] || role;
          messages.push({ role: displayRole, text: text.trim() });
        }
      }
      const children = childrenMap[nid] || [];
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
    }
    return messages;
  }

  function formatConversation(title, messages, createTime) {
    const lines = ['='.repeat(70), `  ${title}`, '='.repeat(70)];
    if (createTime) {
      try {
        lines.push(`  Date: ${new Date(createTime * 1000).toLocaleString()}`);
      } catch (e) {}
    }
    lines.push('');
    for (const m of messages) {
      lines.push(`--- ${m.role} ---`, m.text, '');
    }
    lines.push('='.repeat(70), `  End: ${title}`, '='.repeat(70));
    return lines.join('\n');
  }

  // ─── EXPORT EACH CONVERSATION ─────────────────────────────
  let success = 0, errors = 0;
  const projectCounts = {};
  const usedPaths = new Set();

  for (let i = 0; i < allConvs.length; i++) {
    const conv = allConvs[i];
    const cid = conv.id || 'unknown';
    const title = conv.title || 'Untitled';
    const project = sanitize(getProject(conv));
    const safeTitle = sanitize(title);

    projectCounts[project] = (projectCounts[project] || 0) + 1;

    // Build unique file path
    let filePath = `${project}/${safeTitle}.txt`;
    if (usedPaths.has(filePath)) {
      let c = 1;
      while (usedPaths.has(`${project}/${safeTitle} (${c}).txt`)) c++;
      filePath = `${project}/${safeTitle} (${c}).txt`;
    }
    usedPaths.add(filePath);

    updateUI(i + 1, total, project, safeTitle);

    try {
      const resp = await fetch(`${BASE}/conversation/${cid}`, { headers: hdrs });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const detail = await resp.json();
      const msgs = extractMessages(detail);

      if (msgs.length > 0) {
        const txt = formatConversation(title, msgs, conv.create_time);
        zip.file(filePath, txt);
        success++;
      } else {
        logMsg(`No messages: ${title}`, 'cgpt-exp-warn');
      }
    } catch (e) {
      errors++;
      logMsg(`Error: ${title} — ${e.message}`, 'cgpt-exp-err');
    }

    await sleep(DELAY_MS);
  }

  // ─── GENERATE & DOWNLOAD ZIP ──────────────────────────────
  ui.status.textContent = 'Generating zip file...';
  ui.bar.style.width = '100%';

  const blob = zip.generate();

  // Verify the zip is readable before downloading
  ui.status.textContent = 'Verifying zip integrity...';
  try {
    const buf = await blob.arrayBuffer();
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);
    // Find EOCD
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0; i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd === -1) throw new Error('EOCD not found');
    const entries = view.getUint16(eocd + 10, true);
    if (entries !== success) throw new Error(`Expected ${success} entries, found ${entries}`);
    // Spot-check first entry is STORE and readable as text
    const cdOff = view.getUint32(eocd + 16, true);
    if (view.getUint32(cdOff, true) !== 0x02014b50) throw new Error('Bad CD signature');
    const method = view.getUint16(cdOff + 10, true);
    if (method !== 0) throw new Error(`Expected STORE (0), got compression method ${method}`);
    logMsg(`Zip verified: ${entries} files, STORE method`, '');
  } catch (e) {
    logMsg(`Zip verify warning: ${e.message}`, 'cgpt-exp-warn');
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chatgpt_export_${new Date().toISOString().slice(0,10)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // ─── DONE ─────────────────────────────────────────────────
  const projectSummary = Object.entries(projectCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => `  ${count} — ${name}`)
    .join('\n');

  ui.counter.textContent = 'Export Complete!';
  ui.counter.style.background = 'linear-gradient(135deg, #4ade80, #6c63ff)';
  ui.counter.style.webkitBackgroundClip = 'text';
  ui.counter.style.webkitTextFillColor = 'transparent';
  ui.counter.style.fontSize = '1.4rem';
  ui.bar.style.width = '100%';
  ui.status.innerHTML = `
    <strong>${success}</strong> conversations exported
    ${errors > 0 ? `<br><span style="color:#fbbf24">${errors} errors</span>` : ''}
    <br><br><strong>Projects:</strong>
  `;
  ui.current.style.whiteSpace = 'pre';
  ui.current.style.textAlign = 'left';
  ui.current.textContent = projectSummary;

  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = 'margin-top:1.5rem;padding:0.7rem 2rem;background:#6c63ff;color:white;border:none;border-radius:8px;font-size:0.95rem;font-weight:600;cursor:pointer;';
  closeBtn.onclick = () => overlay.remove();
  document.getElementById('cgpt-exporter-box').appendChild(closeBtn);

  console.log(`✅ ChatGPT Export complete: ${success} conversations, ${errors} errors`);
  console.log('Projects:', projectCounts);

})();