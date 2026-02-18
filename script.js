/**
 * UserScript - Web Color Customizer
 * Provides comprehensive color customization capabilities for web pages
 */


// ESM化

// =========================
// RPC Client (based on README.md specs)
// =========================
var REQ_FLAG = '__US_RPC__';
var REP_FLAG = '__US_RPC_REPLY__';

function makeId() {
  return 'rpc_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
}

function rpcCall(token, method, params, timeoutMs) {
  timeoutMs = typeof timeoutMs === 'number' ? timeoutMs : 15000;
  var id = makeId();

  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () {
      cleanup();
      reject(new Error('RPC timeout: ' + method));
    }, timeoutMs);

    function onMsg(ev) {
      if (ev.source !== window) return;
      var d = ev.data;
      if (!d || d[REP_FLAG] !== true || d.id !== id) return;
      cleanup();
      if (d.ok) resolve(d.result);
      else reject(new Error(d.error || ('RPC error: ' + method)));
    }

    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener('message', onMsg);
    }

    window.addEventListener('message', onMsg);

    window.postMessage(
      {
        [REQ_FLAG]: true,
        id: id,
        token: token,
        method: method,
        params: params || []
      },
      '*'
    );
  });
}

async function handshake() {
  var id = makeId();
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () {
      cleanup();
      reject(new Error('RPC timeout: core.handshake'));
    }, 8000);

    function onMsg(ev) {
      if (ev.source !== window) return;
      var d = ev.data;
      if (!d || d[REP_FLAG] !== true || d.id !== id) return;
      cleanup();
      if (d.ok) resolve(d.result);
      else reject(new Error(d.error || 'RPC error: core.handshake'));
    }

    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener('message', onMsg);
    }

    window.addEventListener('message', onMsg);

    window.postMessage(
      {
        [REQ_FLAG]: true,
        id: id,
        token: '',
        method: 'core.handshake',
        params: []
      },
      '*'
    );
  });
}

// RPC API wrapper
var RPC = {
  token: null,
  initialized: false,

  async init() {
    if (this.initialized) return;
    var hs = await handshake();
    this.token = hs.token;
    this.initialized = true;
    return hs;
  },

  async call(method, params) {
    if (!this.initialized) await this.init();
    return await rpcCall(this.token, method, params);
  }
};

// =========================
// Preset Themes
// =========================
var PRESET_THEMES = {
  default: {
    id: 'default',
    name: 'デフォルト（リセット）',
    colors: {
      background: '',
      text: '',
      link: '',
      linkVisited: '',
      linkHover: '',
      border: '',
      code: '',
      codeBackground: ''
    }
  },
  dark: {
    id: 'dark',
    name: 'ダークモード',
    colors: {
      background: '#1a1a1a',
      text: '#e0e0e0',
      link: '#4fc3f7',
      linkVisited: '#ba68c8',
      linkHover: '#29b6f6',
      border: '#333333',
      code: '#ffeb3b',
      codeBackground: '#2d2d2d'
    }
  },
  light: {
    id: 'light',
    name: 'ライトモード',
    colors: {
      background: '#ffffff',
      text: '#333333',
      link: '#1976d2',
      linkVisited: '#7b1fa2',
      linkHover: '#1565c0',
      border: '#e0e0e0',
      code: '#d84315',
      codeBackground: '#f5f5f5'
    }
  },
  sepia: {
    id: 'sepia',
    name: 'セピア（目に優しい）',
    colors: {
      background: '#f4f3e0',
      text: '#5d4e37',
      link: '#8b4513',
      linkVisited: '#a0522d',
      linkHover: '#cd853f',
      border: '#ddd8c0',
      code: '#b22222',
      codeBackground: '#faf8e7'
    }
  },
  highContrast: {
    id: 'highContrast',
    name: 'ハイコントラスト',
    colors: {
      background: '#000000',
      text: '#ffffff',
      link: '#00ff00',
      linkVisited: '#ff00ff',
      linkHover: '#00ffff',
      border: '#ffffff',
      code: '#ffff00',
      codeBackground: '#333333'
    }
  }
};

// =========================
// Color Customizer Core
// =========================
var ColorCustomizer = {
  currentDomain: window.location.hostname,
  currentSettings: null,

  // Storage key patterns (per README.md recommendations)
  getStorageKey: function (key) {
    return 'userscripts:features:colorCustomizer:' + key;
  },

  getSiteKey: function (domain) {
    // Clean domain and create storage key
    domain = domain || this.currentDomain;
    return this.getStorageKey('site:' + domain);
  },

  async loadSettings() {
    try {
      var siteKey = this.getSiteKey();
      var settings = await RPC.call('storage.get', [siteKey, null]);

      // If site-specific settings exist, use them; otherwise use default
      if (settings && settings.colors) {
        this.currentSettings = settings;
      } else {
        this.currentSettings = this.createDefaultSettings();
      }

      return this.currentSettings;
    } catch (e) {
      console.warn('[ColorCustomizer] Failed to load settings:', e);
      this.currentSettings = this.createDefaultSettings();
      return this.currentSettings;
    }
  },

  async saveSettings(settings) {
    try {
      settings = settings || this.currentSettings;
      if (!settings) return false;

      var siteKey = this.getSiteKey();
      await RPC.call('storage.set', [siteKey, settings]);
      this.currentSettings = settings;
      return true;
    } catch (e) {
      console.error('[ColorCustomizer] Failed to save settings:', e);
      return false;
    }
  },

  createDefaultSettings: function () {
    return {
      enabled: true,
      theme: 'default',
      colors: Object.assign({}, PRESET_THEMES.default.colors),
      lastModified: Date.now()
    };
  },

  applyTheme: function (themeId) {
    var theme = PRESET_THEMES[themeId];
    if (!theme) {
      console.warn('[ColorCustomizer] Unknown theme:', themeId);
      return false;
    }

    this.currentSettings = this.currentSettings || this.createDefaultSettings();
    this.currentSettings.theme = themeId;
    this.currentSettings.colors = Object.assign({}, theme.colors);
    this.currentSettings.lastModified = Date.now();

    this.applyStyles();
    return true;
  },

  applyColorChange: function (colorType, value) {
    this.currentSettings = this.currentSettings || this.createDefaultSettings();
    this.currentSettings.colors = this.currentSettings.colors || {};
    this.currentSettings.colors[colorType] = value;
    this.currentSettings.theme = 'custom'; // Mark as custom when manually changed
    this.currentSettings.lastModified = Date.now();

    this.applyStyles();
  },

  generateCSS: function (colors) {
    colors = colors || (this.currentSettings && this.currentSettings.colors) || {};
    var css = '/* UserScript Color Customizer */\n';

    // Only add rules for non-empty color values
    if (colors.background) {
      css += '*, *::before, *::after { background-color: ' + colors.background + ' !important; }\n';
      css += 'body, html { background-color: ' + colors.background + ' !important; }\n';
    }

    if (colors.text) {
      css += '*, *::before, *::after { color: ' + colors.text + ' !important; }\n';
    }

    if (colors.link) {
      css += 'a, a:link { color: ' + colors.link + ' !important; }\n';
    }

    if (colors.linkVisited) {
      css += 'a:visited { color: ' + colors.linkVisited + ' !important; }\n';
    }

    if (colors.linkHover) {
      css += 'a:hover, a:focus { color: ' + colors.linkHover + ' !important; }\n';
    }

    if (colors.border) {
      css += '*, *::before, *::after { border-color: ' + colors.border + ' !important; }\n';
    }

    if (colors.code) {
      css += 'code, kbd, samp, pre { color: ' + colors.code + ' !important; }\n';
    }

    if (colors.codeBackground) {
      css += 'code, kbd, samp, pre { background-color: ' + colors.codeBackground + ' !important; }\n';
    }

    return css;
  },

  async applyStyles() {
    try {
      var styleId = this.getStorageKey('runtime');
      var css = '';

      if (this.currentSettings && this.currentSettings.enabled) {
        css = this.generateCSS(this.currentSettings.colors);
      }

      await RPC.call('style.add', [css, { id: styleId, replace: true }]);
    } catch (e) {
      console.error('[ColorCustomizer] Failed to apply styles:', e);
    }
  },

  async reset() {
    this.currentSettings = this.createDefaultSettings();
    await this.saveSettings();
    await this.applyStyles();
  },

  async toggle() {
    this.currentSettings = this.currentSettings || this.createDefaultSettings();
    this.currentSettings.enabled = !this.currentSettings.enabled;
    await this.saveSettings();
    await this.applyStyles();
    return this.currentSettings.enabled;
  }
};

// =========================
// UI Components
// =========================
var UI = {
  modal: null,
  isVisible: false,
  cornerButton: null,
  styleInjected: false,

  injectStyles: function () {
    if (this.styleInjected) return;
    var style = document.createElement('style');
    style.textContent = [
      '/* UserScripts Color Customizer UI */',
      '[data-us-cc] *, [data-us-cc] *::before, [data-us-cc] *::after {',
      '  box-sizing: border-box !important;',
      '  margin: 0 !important;',
      '  padding: 0 !important;',
      '}',

      /* ── Tab trigger ── */
      '#us-cc-tab {',
      '  all: initial !important;',
      '  position: fixed !important;',
      '  right: 0 !important;',
      '  top: 50% !important;',
      '  transform: translateY(-50%) !important;',
      '  z-index: 1000000 !important;',
      '  width: 28px !important;',
      '  height: 64px !important;',
      '  background: rgba(30, 30, 30, 0.75) !important;',
      '  backdrop-filter: blur(8px) !important;',
      '  -webkit-backdrop-filter: blur(8px) !important;',
      '  border-radius: 8px 0 0 8px !important;',
      '  border: 1px solid rgba(255,255,255,0.08) !important;',
      '  border-right: none !important;',
      '  cursor: pointer !important;',
      '  display: flex !important;',
      '  align-items: center !important;',
      '  justify-content: center !important;',
      '  font-size: 14px !important;',
      '  transition: width 0.2s ease, background 0.2s ease !important;',
      '  overflow: hidden !important;',
      '  white-space: nowrap !important;',
      '  font-family: system-ui, -apple-system, "Segoe UI", sans-serif !important;',
      '  color: rgba(255,255,255,0.85) !important;',
      '  line-height: 1 !important;',
      '}',
      '#us-cc-tab:hover {',
      '  width: 40px !important;',
      '  background: rgba(50, 50, 50, 0.88) !important;',
      '}',

      /* ── Backdrop ── */
      '#us-cc-backdrop {',
      '  all: initial !important;',
      '  position: fixed !important;',
      '  inset: 0 !important;',
      '  z-index: 999999 !important;',
      '  background: rgba(0, 0, 0, 0.45) !important;',
      '  backdrop-filter: blur(4px) !important;',
      '  -webkit-backdrop-filter: blur(4px) !important;',
      '  display: none !important;',
      '  align-items: center !important;',
      '  justify-content: center !important;',
      '  opacity: 0 !important;',
      '  transition: opacity 0.25s ease !important;',
      '}',
      '#us-cc-backdrop.us-visible {',
      '  display: flex !important;',
      '  opacity: 1 !important;',
      '}',

      /* ── Panel card ── */
      '#us-cc-panel {',
      '  all: initial !important;',
      '  display: block !important;',
      '  width: 460px !important;',
      '  max-width: 92vw !important;',
      '  max-height: 85vh !important;',
      '  overflow-y: auto !important;',
      '  background: rgba(28, 28, 30, 0.92) !important;',
      '  backdrop-filter: blur(20px) saturate(1.4) !important;',
      '  -webkit-backdrop-filter: blur(20px) saturate(1.4) !important;',
      '  border: 1px solid rgba(255,255,255,0.1) !important;',
      '  border-radius: 16px !important;',
      '  padding: 24px !important;',
      '  color: rgba(255,255,255,0.9) !important;',
      '  font-family: system-ui, -apple-system, "Segoe UI", sans-serif !important;',
      '  font-size: 13px !important;',
      '  line-height: 1.5 !important;',
      '  box-shadow: 0 24px 80px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.06) inset !important;',
      '  transform: translateY(12px) !important;',
      '  transition: transform 0.3s cubic-bezier(.2,.9,.3,1) !important;',
      '}',
      '#us-cc-backdrop.us-visible #us-cc-panel {',
      '  transform: translateY(0) !important;',
      '}',

      /* scrollbar */
      '#us-cc-panel::-webkit-scrollbar { width: 4px !important; }',
      '#us-cc-panel::-webkit-scrollbar-track { background: transparent !important; }',
      '#us-cc-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15) !important; border-radius: 4px !important; }',

      /* ── Header ── */
      '#us-cc-panel .us-header {',
      '  display: flex !important;',
      '  align-items: center !important;',
      '  justify-content: space-between !important;',
      '  margin-bottom: 20px !important;',
      '  padding-bottom: 14px !important;',
      '  border-bottom: 1px solid rgba(255,255,255,0.08) !important;',
      '}',
      '#us-cc-panel .us-header h3 {',
      '  all: initial !important;',
      '  font-family: inherit !important;',
      '  font-size: 16px !important;',
      '  font-weight: 600 !important;',
      '  color: #fff !important;',
      '  letter-spacing: -0.2px !important;',
      '}',
      '#us-cc-panel .us-close {',
      '  all: initial !important;',
      '  cursor: pointer !important;',
      '  color: rgba(255,255,255,0.4) !important;',
      '  font-size: 18px !important;',
      '  width: 28px !important;',
      '  height: 28px !important;',
      '  display: flex !important;',
      '  align-items: center !important;',
      '  justify-content: center !important;',
      '  border-radius: 6px !important;',
      '  transition: background 0.15s, color 0.15s !important;',
      '}',
      '#us-cc-panel .us-close:hover {',
      '  background: rgba(255,255,255,0.08) !important;',
      '  color: rgba(255,255,255,0.7) !important;',
      '}',

      /* ── Section label ── */
      '#us-cc-panel .us-label {',
      '  all: initial !important;',
      '  display: block !important;',
      '  font-family: inherit !important;',
      '  font-size: 11px !important;',
      '  font-weight: 600 !important;',
      '  text-transform: uppercase !important;',
      '  letter-spacing: 0.6px !important;',
      '  color: rgba(255,255,255,0.4) !important;',
      '  margin-bottom: 8px !important;',
      '}',

      /* ── Select ── */
      '#us-cc-panel select {',
      '  all: initial !important;',
      '  display: block !important;',
      '  width: 100% !important;',
      '  padding: 8px 12px !important;',
      '  background: rgba(255,255,255,0.06) !important;',
      '  border: 1px solid rgba(255,255,255,0.1) !important;',
      '  border-radius: 8px !important;',
      '  color: rgba(255,255,255,0.9) !important;',
      '  font-family: inherit !important;',
      '  font-size: 13px !important;',
      '  outline: none !important;',
      '  cursor: pointer !important;',
      '  -webkit-appearance: none !important;',
      '  appearance: none !important;',
      '  transition: border-color 0.15s !important;',
      '}',
      '#us-cc-panel select:focus {',
      '  border-color: rgba(100,160,255,0.5) !important;',
      '}',
      '#us-cc-panel select option {',
      '  background: #2c2c2e !important;',
      '  color: #fff !important;',
      '}',

      /* ── Color grid ── */
      '#us-cc-panel .us-colors {',
      '  display: grid !important;',
      '  grid-template-columns: 1fr 1fr !important;',
      '  gap: 6px !important;',
      '  margin-bottom: 20px !important;',
      '}',
      '#us-cc-panel .us-color-item {',
      '  display: flex !important;',
      '  align-items: center !important;',
      '  gap: 8px !important;',
      '  padding: 8px 10px !important;',
      '  background: rgba(255,255,255,0.04) !important;',
      '  border: 1px solid rgba(255,255,255,0.06) !important;',
      '  border-radius: 8px !important;',
      '  transition: background 0.15s !important;',
      '}',
      '#us-cc-panel .us-color-item:hover {',
      '  background: rgba(255,255,255,0.07) !important;',
      '}',
      '#us-cc-panel .us-color-item label {',
      '  all: initial !important;',
      '  flex: 1 !important;',
      '  font-family: inherit !important;',
      '  font-size: 12px !important;',
      '  color: rgba(255,255,255,0.7) !important;',
      '  white-space: nowrap !important;',
      '}',
      '#us-cc-panel .us-color-item input[type="color"] {',
      '  all: initial !important;',
      '  width: 28px !important;',
      '  height: 28px !important;',
      '  border: 2px solid rgba(255,255,255,0.12) !important;',
      '  border-radius: 6px !important;',
      '  cursor: pointer !important;',
      '  background: transparent !important;',
      '  flex-shrink: 0 !important;',
      '}',
      '#us-cc-panel .us-color-item input[type="text"] {',
      '  all: initial !important;',
      '  width: 58px !important;',
      '  padding: 4px 6px !important;',
      '  font-family: "SF Mono", "Menlo", monospace !important;',
      '  font-size: 11px !important;',
      '  color: rgba(255,255,255,0.7) !important;',
      '  background: rgba(0,0,0,0.2) !important;',
      '  border: 1px solid rgba(255,255,255,0.08) !important;',
      '  border-radius: 5px !important;',
      '  outline: none !important;',
      '  flex-shrink: 0 !important;',
      '}',
      '#us-cc-panel .us-color-item input[type="text"]:focus {',
      '  border-color: rgba(100,160,255,0.4) !important;',
      '}',
      '#us-cc-panel .us-color-item .us-clear-btn {',
      '  all: initial !important;',
      '  width: 20px !important;',
      '  height: 20px !important;',
      '  display: flex !important;',
      '  align-items: center !important;',
      '  justify-content: center !important;',
      '  font-size: 10px !important;',
      '  color: rgba(255,255,255,0.3) !important;',
      '  cursor: pointer !important;',
      '  border-radius: 4px !important;',
      '  flex-shrink: 0 !important;',
      '  transition: background 0.15s, color 0.15s !important;',
      '}',
      '#us-cc-panel .us-color-item .us-clear-btn:hover {',
      '  background: rgba(255,255,255,0.1) !important;',
      '  color: rgba(255,255,255,0.6) !important;',
      '}',

      /* ── Divider ── */
      '#us-cc-panel .us-divider {',
      '  height: 1px !important;',
      '  background: rgba(255,255,255,0.06) !important;',
      '  margin: 16px 0 !important;',
      '}',

      /* ── Footer buttons ── */
      '#us-cc-panel .us-footer {',
      '  display: flex !important;',
      '  align-items: center !important;',
      '  justify-content: space-between !important;',
      '}',
      '#us-cc-panel .us-footer-right {',
      '  display: flex !important;',
      '  gap: 8px !important;',
      '}',
      '#us-cc-panel .us-btn {',
      '  all: initial !important;',
      '  display: inline-flex !important;',
      '  align-items: center !important;',
      '  justify-content: center !important;',
      '  padding: 7px 16px !important;',
      '  font-family: inherit !important;',
      '  font-size: 12px !important;',
      '  font-weight: 500 !important;',
      '  border-radius: 8px !important;',
      '  cursor: pointer !important;',
      '  transition: filter 0.15s, transform 0.1s !important;',
      '  white-space: nowrap !important;',
      '}',
      '#us-cc-panel .us-btn:active {',
      '  transform: scale(0.96) !important;',
      '}',
      '#us-cc-panel .us-btn-danger {',
      '  background: rgba(255, 69, 58, 0.15) !important;',
      '  color: #ff453a !important;',
      '  border: 1px solid rgba(255, 69, 58, 0.2) !important;',
      '}',
      '#us-cc-panel .us-btn-danger:hover { background: rgba(255, 69, 58, 0.25) !important; }',
      '#us-cc-panel .us-btn-toggle {',
      '  background: rgba(255, 159, 10, 0.15) !important;',
      '  color: #ff9f0a !important;',
      '  border: 1px solid rgba(255, 159, 10, 0.2) !important;',
      '}',
      '#us-cc-panel .us-btn-toggle:hover { background: rgba(255, 159, 10, 0.25) !important; }',
      '#us-cc-panel .us-btn-primary {',
      '  background: rgba(48, 209, 88, 0.15) !important;',
      '  color: #30d158 !important;',
      '  border: 1px solid rgba(48, 209, 88, 0.2) !important;',
      '}',
      '#us-cc-panel .us-btn-primary:hover { background: rgba(48, 209, 88, 0.25) !important; }',
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
    this.styleInjected = true;
  },

  createCornerButton: function () {
    if (this.cornerButton) return this.cornerButton;
    this.injectStyles();

    var tab = document.createElement('div');
    tab.id = 'us-cc-tab';
    tab.setAttribute('data-us-cc', 'tab');
    tab.innerHTML = '🎨';
    tab.title = 'Color Customizer';
    tab.addEventListener('click', function () {
      UI.show();
    });
    document.body.appendChild(tab);
    this.cornerButton = tab;
    return tab;
  },

  createModal: function () {
    this.createCornerButton();
    if (this.modal) return this.modal;

    var backdrop = document.createElement('div');
    backdrop.id = 'us-cc-backdrop';
    backdrop.setAttribute('data-us-cc', 'backdrop');

    var panel = document.createElement('div');
    panel.id = 'us-cc-panel';
    panel.setAttribute('data-us-cc', 'panel');
    panel.innerHTML = this.getModalHTML();

    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) UI.hide();
    });

    this.bindEvents(panel);
    this.modal = backdrop;
    return backdrop;
  },

  getModalHTML: function () {
    return [
      '<div class="us-header">',
      '<h3>カラーカスタマイザー</h3>',
      '<button class="us-close" id="color-customizer-close">&times;</button>',
      '</div>',

      '<span class="us-label">テーマ</span>',
      '<select id="color-customizer-theme">',
      Object.keys(PRESET_THEMES).map(function (id) {
        return '<option value="' + id + '">' + PRESET_THEMES[id].name + '</option>';
      }).join(''),
      '</select>',

      '<div class="us-divider"></div>',

      '<span class="us-label">カスタムカラー</span>',
      '<div class="us-colors">',
      this.createColorInput('background', '背景'),
      this.createColorInput('text', 'テキスト'),
      this.createColorInput('link', 'リンク'),
      this.createColorInput('linkVisited', '訪問済み'),
      this.createColorInput('linkHover', 'ホバー'),
      this.createColorInput('border', 'ボーダー'),
      this.createColorInput('code', 'コード文字'),
      this.createColorInput('codeBackground', 'コード背景'),
      '</div>',

      '<div class="us-divider"></div>',

      '<div class="us-footer">',
      '<button class="us-btn us-btn-danger" id="color-customizer-reset">リセット</button>',
      '<div class="us-footer-right">',
      '<button class="us-btn us-btn-toggle" id="color-customizer-toggle">ON</button>',
      '<button class="us-btn us-btn-primary" id="color-customizer-save">保存</button>',
      '</div>',
      '</div>'
    ].join('');
  },

  createColorInput: function (colorType, label) {
    return [
      '<div class="us-color-item">',
      '<label>' + label + '</label>',
      '<input type="color" id="color-customizer-' + colorType + '">',
      '<input type="text" id="color-customizer-' + colorType + '-text" placeholder="#000000">',
      '<button type="button" class="us-clear-btn" data-color-clear="' + colorType + '">✕</button>',
      '</div>'
    ].join('');
  },

  bindEvents: function (container) {
    var self = this;

    // Close button
    container.querySelector('#color-customizer-close').addEventListener('click', function () {
      self.hide();
    });

    // Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && self.isVisible) self.hide();
    });

    // Theme selector
    container.querySelector('#color-customizer-theme').addEventListener('change', function () {
      var themeId = this.value;
      ColorCustomizer.applyTheme(themeId);
      self.updateForm();
    });

    // Color inputs
    var colorTypes = ['background', 'text', 'link', 'linkVisited', 'linkHover', 'border', 'code', 'codeBackground'];
    colorTypes.forEach(function (colorType) {
      var colorInput = container.querySelector('#color-customizer-' + colorType);
      var textInput = container.querySelector('#color-customizer-' + colorType + '-text');

      if (colorInput) {
        colorInput.addEventListener('input', function () {
          textInput.value = this.value;
          self.handleColorChange(colorType, this.value);
        });
      }

      if (textInput) {
        textInput.addEventListener('input', function () {
          if (this.value && /^#[0-9a-fA-F]{6}$/.test(this.value)) {
            colorInput.value = this.value;
          }
          self.handleColorChange(colorType, this.value);
        });
      }
    });

    // Clear buttons (delegated)
    container.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-color-clear]');
      if (!btn) return;
      var ct = btn.getAttribute('data-color-clear');
      var ci = container.querySelector('#color-customizer-' + ct);
      var ti = container.querySelector('#color-customizer-' + ct + '-text');
      if (ci) ci.value = '';
      if (ti) ti.value = '';
      self.handleColorChange(ct, '');
    });

    // Action buttons
    container.querySelector('#color-customizer-reset').addEventListener('click', function () {
      ColorCustomizer.reset().then(function () {
        self.updateForm();
      });
    });

    container.querySelector('#color-customizer-toggle').addEventListener('click', function () {
      ColorCustomizer.toggle().then(function (enabled) {
        this.textContent = enabled ? 'ON' : 'OFF';
      }.bind(this));
    });

    container.querySelector('#color-customizer-save').addEventListener('click', function () {
      ColorCustomizer.saveSettings().then(function (success) {
        var saveBtn = container.querySelector('#color-customizer-save');
        if (success) {
          saveBtn.textContent = '✓ 保存済';
          setTimeout(function () { saveBtn.textContent = '保存'; }, 1500);
        }
      });
    });
  },

  handleColorChange: function (colorType, value) {
    ColorCustomizer.applyColorChange(colorType, value);
  },

  updateForm: function () {
    if (!this.modal || !ColorCustomizer.currentSettings) return;

    var panel = this.modal.querySelector('#us-cc-panel') || this.modal;
    var settings = ColorCustomizer.currentSettings;

    // Update theme selector
    var themeSelect = panel.querySelector('#color-customizer-theme');
    if (themeSelect) {
      themeSelect.value = settings.theme || 'default';
    }

    // Update color inputs
    var colors = settings.colors || {};
    Object.keys(colors).forEach(function (colorType) {
      var colorInput = panel.querySelector('#color-customizer-' + colorType);
      var textInput = panel.querySelector('#color-customizer-' + colorType + '-text');

      var value = colors[colorType] || '';
      if (colorInput) colorInput.value = value;
      if (textInput) textInput.value = value;
    });

    // Update toggle button
    var toggleBtn = panel.querySelector('#color-customizer-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = settings.enabled ? 'ON' : 'OFF';
    }
  },

  async show() {
    if (!this.modal) {
      this.createModal();
    }
    if (this.cornerButton) this.cornerButton.style.display = 'none';
    await ColorCustomizer.loadSettings();
    this.updateForm();

    // Animate in
    this.modal.style.display = 'flex';
    // Force reflow for animation
    void this.modal.offsetWidth;
    this.modal.classList.add('us-visible');
    this.isVisible = true;
  },

  hide: function () {
    if (this.modal) {
      this.modal.classList.remove('us-visible');
      // Wait for animation to finish
      setTimeout(function () {
        if (!UI.isVisible && UI.modal) {
          UI.modal.style.display = 'none';
        }
      }, 260);
    }
    this.isVisible = false;
    if (this.cornerButton) this.cornerButton.style.display = '';
  },

  toggle: function () {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
};

// =========================
// Feature Interface for external access
// =========================
var ColorCustomizerFeature = {
  async init() {
    try {
      await RPC.init();
      await ColorCustomizer.loadSettings();
      await ColorCustomizer.applyStyles();


      // ショートカット起動は廃止。UIは画面隅ボタンで起動。

      console.log('[ColorCustomizer] Initialized successfully for domain:', ColorCustomizer.currentDomain);
      return true;
    } catch (e) {
      console.error('[ColorCustomizer] Failed to initialize:', e);
      return false;
    }
  },

  showUI() {
    return UI.show();
  },

  hideUI() {
    return UI.hide();
  },

  toggleUI() {
    return UI.toggle();
  },

  applyTheme(themeId) {
    return ColorCustomizer.applyTheme(themeId);
  },

  reset() {
    return ColorCustomizer.reset();
  },

  getPresetThemes() {
    return PRESET_THEMES;
  },

  getCurrentSettings() {
    return ColorCustomizer.currentSettings;
  }
};

// =========================
// Global API
// =========================
window.US = window.US || {};
window.US.rpc = RPC;

// Features namespace
window.UserScripts = window.UserScripts || {};
window.UserScripts.features = window.UserScripts.features || {};
window.UserScripts.features.colorCustomizer = ColorCustomizerFeature;

// Global init function
window.UserScripts.init = function () {
  console.log('[UserScripts] Core initialized');
  // Additional global initialization can go here
};


// =========================
// Auto-initialize (page world)
// =========================
(async function () {
  try {
    await ColorCustomizerFeature.init();
    UI.createCornerButton();
    console.log('[UserScripts] Auto-init complete');
  } catch (e) {
    console.error('[UserScripts] Auto-init failed:', e);
  }
})();

// ESM用: exportは空（グローバルwindow.UserScriptsは維持）
export { };
