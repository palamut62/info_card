const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
  } catch {
    return {
      apiKey: '', model: 'google/gemma-3-27b-it:free', theme: 'default', font: 'Inter',
      twitterApiKey: '', twitterApiSecret: '', twitterAccessToken: '', twitterAccessTokenSecret: ''
    };
  }
}

function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1050,
    height: 700,
    minWidth: 800,
    minHeight: 550,
    frame: false,
    transparent: false,
    backgroundColor: '#07111f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Info Card Generator',
    icon: getAppIcon()
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function buildTrayIcon() {
  const size = 32;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const cx = x - size / 2, cy = y - size / 2;
      const dist = Math.sqrt(cx * cx + cy * cy);
      const radius = size / 2 - 1;

      if (dist <= radius) {
        // Blue gradient background
        const t = y / size;
        buf[idx]     = Math.round(40 + t * 20);   // R
        buf[idx + 1] = Math.round(80 + t * 30);   // G
        buf[idx + 2] = 255;                         // B
        buf[idx + 3] = 255;                         // A

        // Draw "i" - dot
        if (x >= 14 && x <= 17 && y >= 7 && y <= 10) {
          buf[idx] = 255; buf[idx + 1] = 255; buf[idx + 2] = 255;
        }
        // Draw "i" - vertical bar
        if (x >= 13 && x <= 18 && y >= 13 && y <= 24) {
          buf[idx] = 255; buf[idx + 1] = 255; buf[idx + 2] = 255;
        }

        // Anti-alias edge
        if (dist > radius - 1.5) {
          const alpha = Math.max(0, Math.min(1, radius - dist + 1));
          buf[idx + 3] = Math.round(alpha * 255);
        }
      } else {
        buf[idx + 3] = 0;
      }
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

let appIcon;

function getAppIcon() {
  if (!appIcon) appIcon = buildTrayIcon();
  return appIcon;
}

function createTray() {
  tray = new Tray(getAppIcon());
  tray.setToolTip('Info Card Generator');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => { mainWindow.show(); mainWindow.focus(); }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { app.isQuitting = true; app.quit(); }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {});

// Window control IPC
const { ipcMain: ipc } = require('electron');
ipc.on('window-minimize', () => mainWindow?.minimize());
ipc.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipc.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// IPC handlers
ipcMain.handle('load-settings', () => loadSettings());
ipcMain.handle('save-settings', (_, settings) => { saveSettings(settings); return true; });

ipcMain.handle('generate-card', async (_, { topic, settings }) => {
  const apiKey = settings.apiKey;
  if (!apiKey) throw new Error('API key required. Enter your OpenRouter API key in Settings.');

  const prompt = `You are an info card content generator. You have access to web search results about the topic below. Use the LATEST and most up-to-date information from the web to generate an accurate, current info card.

Topic: ${topic}

IMPORTANT: Use the web search results to find the latest version numbers, commands, pricing, features, and technical details. Do NOT use outdated information.

Return ONLY valid JSON (no markdown, no code blocks) with this structure:
{
  "title": "Main title with a key highlight (e.g. price, feature)",
  "highlight": "The key highlight text (e.g. '$0/month', 'Open Source', 'Free')",
  "subtitle": "Short subtitle after title",
  "steps": [
    {
      "number": 1,
      "title": "Step title",
      "command": "command or code if applicable, or null",
      "description": "Optional description text",
      "badges": ["Badge1", "Badge2"]
    }
  ],
  "benefits": ["Benefit 1", "Benefit 2", "Benefit 3"],
  "tags": ["Tag1", "Tag2", "Tag3"],
  "footer": "Footer text",
  "icon": "emoji for the topic"
}

Make it informative and accurate. Use real commands, URLs, and technical details based on the latest web data.`;

  const body = {
    model: settings.model || 'google/gemma-3-27b-it:free',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  };

  if (settings.webSearch !== false) {
    body.plugins = [{ id: 'web' }];
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://info-card-generator.app',
      'X-Title': 'Info Card Generator'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API Error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('API returned empty response');

  let jsonStr = content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  return JSON.parse(jsonStr);
});

// Render card in a hidden window at full size and capture it
async function renderCardOffscreen(cardHtml, width, height) {
  // Read CSS file inline
  const cssContent = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf-8');

  const offscreen = new BrowserWindow({
    width: width + 40,
    height: height + 40,
    show: false,
    webPreferences: { offscreen: true }
  });

  // Write a temp HTML file so fonts load properly
  const tmpHtml = path.join(app.getPath('temp'), 'info-card-render.html');
  const htmlContent = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;500&family=Poppins:wght@400;600;700;800;900&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
<style>
${cssContent}
body { margin: 0; padding: 0; background: transparent; }
.info-card { transform: none !important; display: inline-block; }
</style>
</head><body>${cardHtml}</body></html>`;

  fs.writeFileSync(tmpHtml, htmlContent, 'utf-8');
  await offscreen.loadFile(tmpHtml);

  // Wait for fonts
  await new Promise(r => setTimeout(r, 2000));

  // Get actual rendered card size
  const bounds = await offscreen.webContents.executeJavaScript(`
    (() => {
      const el = document.querySelector('.info-card');
      if (!el) return JSON.stringify({ x: 0, y: 0, width: ${width}, height: ${height} });
      const r = el.getBoundingClientRect();
      return JSON.stringify({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) });
    })()
  `);
  const rect = JSON.parse(bounds);

  // Resize window to exact card size for clean capture
  offscreen.setSize(rect.width + rect.x * 2, rect.height + rect.y * 2);
  await new Promise(r => setTimeout(r, 300));

  const image = await offscreen.webContents.capturePage({
    x: rect.x, y: rect.y, width: rect.width, height: rect.height
  });

  offscreen.destroy();
  try { fs.unlinkSync(tmpHtml); } catch {}
  return image.toPNG();
}

ipcMain.handle('save-image', async (_, { cardHtml, width, height }) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'info-card.png',
    filters: [{ name: 'PNG', extensions: ['png'] }]
  });
  if (!filePath) return null;

  const pngBuf = await renderCardOffscreen(cardHtml, width, height);
  fs.writeFileSync(filePath, pngBuf);
  return filePath;
});

// =========================================================
// Twitter / X Share
// =========================================================

ipcMain.handle('share-to-x', async (_, { dataUrl, tweetText, settings }) => {
  const { twitterApiKey, twitterApiSecret, twitterAccessToken, twitterAccessTokenSecret } = settings;
  if (!twitterApiKey || !twitterApiSecret || !twitterAccessToken || !twitterAccessTokenSecret) {
    throw new Error('Twitter/X API keys required. Configure them in Settings.');
  }

  const OAuth = require('oauth-1.0a');
  const crypto = require('crypto');

  const oauth = OAuth({
    consumer: { key: twitterApiKey, secret: twitterApiSecret },
    signature_method: 'HMAC-SHA1',
    hash_function(baseString, key) {
      return crypto.createHmac('sha1', key).update(baseString).digest('base64');
    }
  });

  const token = { key: twitterAccessToken, secret: twitterAccessTokenSecret };

  // Helper for OAuth requests
  async function oauthFetch(url, method, body, isFormData = false) {
    const requestData = { url, method };
    const authHeader = oauth.toHeader(oauth.authorize(requestData, token));
    const headers = { ...authHeader };
    if (!isFormData) headers['Content-Type'] = 'application/json';
    const opts = { method, headers };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);
    return fetch(url, opts);
  }

  // Step 1: Upload media via v1.1 media upload (chunked for images)
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
  const mediaBuffer = Buffer.from(base64Data, 'base64');

  // INIT
  const initForm = new URLSearchParams();
  initForm.append('command', 'INIT');
  initForm.append('total_bytes', mediaBuffer.length.toString());
  initForm.append('media_type', 'image/png');
  initForm.append('media_category', 'tweet_image');

  const initReq = { url: 'https://upload.twitter.com/1.1/media/upload.json', method: 'POST' };
  const initAuth = oauth.toHeader(oauth.authorize(initReq, token));
  const initResp = await fetch(initReq.url, {
    method: 'POST',
    headers: { ...initAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: initForm.toString()
  });

  if (!initResp.ok) {
    const errText = await initResp.text();
    throw new Error(`Twitter media INIT failed: ${initResp.status} - ${errText}`);
  }

  const initData = await initResp.json();
  const mediaId = initData.media_id_string;

  // APPEND (send in chunks of 5MB)
  const CHUNK_SIZE = 5 * 1024 * 1024;
  for (let i = 0; i * CHUNK_SIZE < mediaBuffer.length; i++) {
    const chunk = mediaBuffer.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const appendForm = new URLSearchParams();
    appendForm.append('command', 'APPEND');
    appendForm.append('media_id', mediaId);
    appendForm.append('segment_index', i.toString());
    appendForm.append('media_data', chunk.toString('base64'));

    const appendReq = { url: 'https://upload.twitter.com/1.1/media/upload.json', method: 'POST' };
    const appendAuth = oauth.toHeader(oauth.authorize(appendReq, token));
    const appendResp = await fetch(appendReq.url, {
      method: 'POST',
      headers: { ...appendAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: appendForm.toString()
    });

    if (!appendResp.ok) {
      const errText = await appendResp.text();
      throw new Error(`Twitter media APPEND failed: ${appendResp.status} - ${errText}`);
    }
  }

  // FINALIZE
  const finalForm = new URLSearchParams();
  finalForm.append('command', 'FINALIZE');
  finalForm.append('media_id', mediaId);

  const finalReq = { url: 'https://upload.twitter.com/1.1/media/upload.json', method: 'POST' };
  const finalAuth = oauth.toHeader(oauth.authorize(finalReq, token));
  const finalResp = await fetch(finalReq.url, {
    method: 'POST',
    headers: { ...finalAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: finalForm.toString()
  });

  if (!finalResp.ok) {
    const errText = await finalResp.text();
    throw new Error(`Twitter media FINALIZE failed: ${finalResp.status} - ${errText}`);
  }

  // Step 2: Post tweet with media via v2
  const tweetBody = { text: tweetText, media: { media_ids: [mediaId] } };
  const tweetReq = { url: 'https://api.twitter.com/2/tweets', method: 'POST' };
  const tweetAuth = oauth.toHeader(oauth.authorize(tweetReq, token));
  const tweetResp = await fetch(tweetReq.url, {
    method: 'POST',
    headers: { ...tweetAuth, 'Content-Type': 'application/json' },
    body: JSON.stringify(tweetBody)
  });

  if (!tweetResp.ok) {
    const errText = await tweetResp.text();
    throw new Error(`Twitter tweet failed: ${tweetResp.status} - ${errText}`);
  }

  const tweetData = await tweetResp.json();
  return { id: tweetData.data?.id, url: `https://x.com/i/status/${tweetData.data?.id}` };
});

// Text-only tweet (fallback for Free tier without media upload)
ipcMain.handle('share-to-x-text', async (_, { tweetText, settings }) => {
  const { twitterApiKey, twitterApiSecret, twitterAccessToken, twitterAccessTokenSecret } = settings;
  if (!twitterApiKey || !twitterApiSecret || !twitterAccessToken || !twitterAccessTokenSecret) {
    throw new Error('Twitter/X API keys required. Configure them in Settings.');
  }

  const OAuth = require('oauth-1.0a');
  const crypto = require('crypto');

  const oauth = OAuth({
    consumer: { key: twitterApiKey, secret: twitterApiSecret },
    signature_method: 'HMAC-SHA1',
    hash_function(baseString, key) {
      return crypto.createHmac('sha1', key).update(baseString).digest('base64');
    }
  });

  const token = { key: twitterAccessToken, secret: twitterAccessTokenSecret };

  const tweetBody = { text: tweetText };
  const tweetReq = { url: 'https://api.twitter.com/2/tweets', method: 'POST' };
  const tweetAuth = oauth.toHeader(oauth.authorize(tweetReq, token));
  const tweetResp = await fetch(tweetReq.url, {
    method: 'POST',
    headers: { ...tweetAuth, 'Content-Type': 'application/json' },
    body: JSON.stringify(tweetBody)
  });

  if (!tweetResp.ok) {
    const errText = await tweetResp.text();
    throw new Error(`Twitter tweet failed: ${tweetResp.status} - ${errText}`);
  }

  const tweetData = await tweetResp.json();
  return { id: tweetData.data?.id, url: `https://x.com/i/status/${tweetData.data?.id}` };
});

ipcMain.handle('capture-card', async (_, { cardHtml, width, height }) => {
  const pngBuf = await renderCardOffscreen(cardHtml, width, height);
  return 'data:image/png;base64,' + pngBuf.toString('base64');
});

ipcMain.handle('fetch-models', async (_, apiKey) => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const data = await response.json();
    return data.data?.map(m => ({ id: m.id, name: m.name })) || [];
  } catch {
    return [];
  }
});
