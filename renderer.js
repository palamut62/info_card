const themes = [
  { id: 'default', name: 'Warm', colors: ['#f5f0e8', '#e86c3a'] },
  { id: 'dark-neon', name: 'Neon', colors: ['#0d0d1a', '#00ff88'] },
  { id: 'ocean', name: 'Ocean', colors: ['#0a2540', '#00d4aa'] },
  { id: 'sunset', name: 'Sunset', colors: ['#1a0a1e', '#ff6b6b'] },
  { id: 'mint', name: 'Mint', colors: ['#e8f5e9', '#43a047'] },
  { id: 'slate', name: 'Slate', colors: ['#1e293b', '#38bdf8'] },
  { id: 'rose', name: 'Rose', colors: ['#fff1f2', '#e11d48'] },
  { id: 'cyberpunk', name: 'Cyber', colors: ['#0a0a0a', '#f0e130'] }
];

let currentTheme = 'default';
let currentCardData = null;
let settings = {};

(async () => {
  settings = await window.api.loadSettings();
  document.getElementById('apiKeyInput').value = settings.apiKey || '';
  if (settings.model) {
    const modelSelect = document.getElementById('modelSelect');
    const exists = [...modelSelect.options].some(o => o.value === settings.model);
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = settings.model;
      opt.textContent = settings.model;
      modelSelect.appendChild(opt);
    }
    modelSelect.value = settings.model;
  }
  if (settings.theme) currentTheme = settings.theme;
  if (settings.font) document.getElementById('fontSelect').value = settings.font;
  if (settings.codeFont) document.getElementById('codeFontSelect').value = settings.codeFont;
  if (settings.size) document.getElementById('sizeSelect').value = settings.size;
  if (settings.webSearch === false) document.getElementById('webSearchToggle').checked = false;

  // Twitter settings
  document.getElementById('xApiKey').value = settings.twitterApiKey || '';
  document.getElementById('xApiSecret').value = settings.twitterApiSecret || '';
  document.getElementById('xAccessToken').value = settings.twitterAccessToken || '';
  document.getElementById('xAccessTokenSecret').value = settings.twitterAccessTokenSecret || '';

  initThemeGrid();
})();

function initThemeGrid() {
  const grid = document.getElementById('themeGrid');
  grid.innerHTML = '';
  themes.forEach(t => {
    const swatch = document.createElement('div');
    swatch.className = `theme-swatch ${t.id === currentTheme ? 'active' : ''}`;
    swatch.style.background = `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})`;
    swatch.dataset.name = t.name;
    swatch.onclick = () => {
      currentTheme = t.id;
      grid.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      if (currentCardData) renderCard(currentCardData);
    };
    grid.appendChild(swatch);
  });
}

// Generate
document.getElementById('generateBtn').addEventListener('click', async () => {
  const topic = document.getElementById('topicInput').value.trim();
  if (!topic) return;

  const btn = document.getElementById('generateBtn');
  const container = document.getElementById('cardContainer');

  btn.disabled = true;
  btn.textContent = 'Generating...';
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><span>AI is generating card content...</span></div>';

  try {
    settings.webSearch = document.getElementById('webSearchToggle').checked;
    const cardData = await window.api.generateCard({ topic, settings });
    currentCardData = cardData;
    renderCard(cardData);
    document.getElementById('exportBtn').disabled = false;
    document.getElementById('shareXBtn').disabled = false;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">&#x274C;</span><p>${err.message}</p></div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Card';
  }
});

function renderCard(data) {
  const container = document.getElementById('cardContainer');
  const font = document.getElementById('fontSelect').value;
  const codeFont = document.getElementById('codeFontSelect').value;
  const size = document.getElementById('sizeSelect').value;

  const stepsHtml = (data.steps || []).map((step, i) => {
    const badgesHtml = (step.badges || []).map(b => `<span class="badge">${escHtml(b)}</span>`).join('');
    const cmdHtml = step.command ? `<div class="step-command"><span class="dollar">$</span> ${escHtml(step.command)}</div>` : '';
    const descHtml = step.description ? `<div class="step-description">${escHtml(step.description)}</div>` : '';
    return `
      <div class="card-step">
        <div class="step-header">
          <div class="step-number">${step.number || i + 1}.</div>
          <div class="step-title">${escHtml(step.title)}</div>
        </div>
        ${cmdHtml}${descHtml}
        ${badgesHtml ? `<div class="step-badges">${badgesHtml}</div>` : ''}
      </div>`;
  }).join('');

  const benefitsHtml = (data.benefits || []).map(b =>
    `<div class="benefit-item"><div class="benefit-check">&#x2713;</div><span>${escHtml(b)}</span></div>`
  ).join('');

  const tagsHtml = (data.tags || []).map(t =>
    `<div class="tag">${escHtml(t)}</div>`
  ).join('');

  container.innerHTML = `
    <div class="info-card theme-${currentTheme} size-${size}" id="cardElement" style="font-family: '${font}', system-ui, sans-serif;">
      <div class="card-header">
        <div>
          <div class="card-highlight">
            <div class="check">&#x2713;</div>
            ${escHtml(data.highlight || '')}
          </div>
          <div class="card-subtitle">${escHtml(data.subtitle || data.title || '')}</div>
        </div>
      </div>
      <div class="card-steps">${stepsHtml}</div>
      ${benefitsHtml ? `<div class="card-benefits">${benefitsHtml}</div>` : ''}
      ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ''}
      ${data.footer ? `<div class="card-footer">${escHtml(data.footer)} ${data.icon || ''}</div>` : ''}
    </div>`;

  container.querySelectorAll('.step-command').forEach(el => {
    el.style.fontFamily = `'${codeFont}', monospace`;
  });

  // Auto-fit card to container
  requestAnimationFrame(() => fitCardToContainer());
}

function fitCardToContainer() {
  const card = document.getElementById('cardElement');
  const container = document.querySelector('.content');
  if (!card || !container) return;

  // Reset scale first to get real size
  card.style.transform = 'none';
  const cardRect = card.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  const padX = 40, padY = 40;
  const availW = containerRect.width - padX;
  const availH = containerRect.height - padY;

  const scaleX = availW / cardRect.width;
  const scaleY = availH / cardRect.height;
  const scale = Math.min(scaleX, scaleY, 1); // never scale up

  card.style.transform = `scale(${scale})`;
  card.style.transformOrigin = 'center center';
}

window.addEventListener('resize', () => {
  if (currentCardData) fitCardToContainer();
});

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Get card HTML and original (unscaled) dimensions for offscreen render
function getCardExportData() {
  const card = document.getElementById('cardElement');
  if (!card) return null;
  // Temporarily remove scale to get real size
  const prevTransform = card.style.transform;
  card.style.transform = 'none';
  const rect = card.getBoundingClientRect();
  const cardHtml = card.outerHTML;
  card.style.transform = prevTransform;
  return { cardHtml, width: Math.round(rect.width), height: Math.round(rect.height) };
}

// Export PNG
document.getElementById('exportBtn').addEventListener('click', async () => {
  const card = document.getElementById('cardElement');
  if (!card) return;

  const btn = document.getElementById('exportBtn');
  btn.disabled = true;
  btn.textContent = '...';

  try {
    const data = getCardExportData();
    const result = await window.api.saveImage(data);
    btn.textContent = result ? 'OK!' : 'PNG';
  } catch (err) {
    console.error('Export error:', err);
    btn.textContent = 'Err';
  }

  setTimeout(() => { btn.disabled = false; btn.textContent = 'PNG'; }, 2000);
});

// Settings
document.getElementById('settingsBtn').addEventListener('click', () => {
  document.getElementById('settingsModal').classList.add('show');
});
document.getElementById('closeSettings').addEventListener('click', () => {
  document.getElementById('settingsModal').classList.remove('show');
});
document.getElementById('settingsModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
});

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  settings.apiKey = document.getElementById('apiKeyInput').value.trim();
  settings.model = document.getElementById('modelSelect').value;
  settings.theme = currentTheme;
  settings.font = document.getElementById('fontSelect').value;
  settings.codeFont = document.getElementById('codeFontSelect').value;
  settings.size = document.getElementById('sizeSelect').value;
  settings.twitterApiKey = document.getElementById('xApiKey').value.trim();
  settings.twitterApiSecret = document.getElementById('xApiSecret').value.trim();
  settings.twitterAccessToken = document.getElementById('xAccessToken').value.trim();
  settings.twitterAccessTokenSecret = document.getElementById('xAccessTokenSecret').value.trim();
  await window.api.saveSettings(settings);
  document.getElementById('settingsModal').classList.remove('show');
});

// Fetch models
document.getElementById('fetchModelsBtn').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKeyInput').value.trim();
  if (!apiKey) return;
  const btn = document.getElementById('fetchModelsBtn');
  btn.textContent = 'Loading...';
  btn.disabled = true;

  const models = await window.api.fetchModels(apiKey);
  const select = document.getElementById('modelSelect');
  const currentVal = select.value;

  if (models.length > 0) {
    select.innerHTML = '';
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name || m.id;
      select.appendChild(opt);
    });
    if ([...select.options].some(o => o.value === currentVal)) select.value = currentVal;
  }

  btn.textContent = `${models.length} models`;
  btn.disabled = false;
  setTimeout(() => { btn.textContent = 'Load Models'; }, 3000);
});

// Titlebar buttons
document.getElementById('btnMinimize').addEventListener('click', () => window.api.windowMinimize());
document.getElementById('btnMaximize').addEventListener('click', () => window.api.windowMaximize());
document.getElementById('btnClose').addEventListener('click', () => window.api.windowClose());

// Share on X
const xSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';

document.getElementById('shareXBtn').addEventListener('click', async () => {
  const card = document.getElementById('cardElement');
  if (!card || !currentCardData) return;

  // Check if twitter keys are configured
  if (!settings.twitterApiKey || !settings.twitterAccessToken) {
    document.getElementById('settingsModal').classList.add('show');
    document.getElementById('xApiKey').focus();
    return;
  }

  const btn = document.getElementById('shareXBtn');
  btn.disabled = true;
  btn.innerHTML = xSvg + ' Posting...';

  try {
    const title = currentCardData.highlight || currentCardData.title || '';
    const subtitle = currentCardData.subtitle || '';
    const tags = (currentCardData.tags || []).map(t => '#' + t.replace(/[^a-zA-Z0-9]/g, '')).join(' ');
    const tweetText = `${title} - ${subtitle}\n\n${tags}`.trim().substring(0, 280);

    let result;
    try {
      // Try with image first
      const exportData = getCardExportData();
      const dataUrl = await window.api.captureCard(exportData);
      result = await window.api.shareToX({ dataUrl, tweetText, settings });
    } catch (mediaErr) {
      // Fallback: text-only tweet (Free tier doesn't support media upload)
      console.warn('Media upload failed, posting text-only:', mediaErr.message);
      btn.innerHTML = xSvg + ' Posting text...';
      result = await window.api.shareToXText({ tweetText, settings });
    }
    btn.innerHTML = xSvg + ' Posted!';
  } catch (err) {
    console.error('X share error:', err);
    btn.innerHTML = xSvg + ' Failed';
    btn.title = err.message;
  }

  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = xSvg + ' Share on X';
    btn.title = '';
  }, 3000);
});

// Re-render on setting changes
['fontSelect', 'codeFontSelect', 'sizeSelect'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => {
    if (currentCardData) renderCard(currentCardData);
  });
});
