// Color Editor Module (Original v1.6.53 Liquid Glass UI)
export default {
  init() {
    console.log('[ColorCustomizer] Module initialized');
    
    // Wait for DOM to be ready
    const initWhenReady = () => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          setTimeout(this.setup.bind(this), 100);
        });
      } else {
        setTimeout(this.setup.bind(this), 100);
      }
    };
    
    initWhenReady();
  },

  setup() {
    console.log('[ColorCustomizer] Setting up UI');
    this.createUI();
    this.initEventListeners();
  },

  createUI() {
    // Inject styles first
    this.injectStyles();
    
    // Create tab
    const tab = this.createElement('div', {
      id: 'us-cc-tab',
      'data-us-cc': 'tab'
    });
    
    const tabIcon = this.createElement('div', { class: 'us-cc-tab-icon' });
    const iconRow = this.createElement('div', { class: 'us-cc-tab-icon-row' });
    const tabText = this.createElement('div', { class: 'us-cc-tab-text' }, 'ツール');
    const tabSwatch = this.createElement('div', { class: 'us-cc-tab-swatch' });
    
    iconRow.appendChild(tabText);
    iconRow.appendChild(tabSwatch);
    tabIcon.appendChild(iconRow);
    tab.appendChild(tabIcon);
    
    // Create backdrop
    const backdrop = this.createElement('div', {
      id: 'us-cc-backdrop',
      'data-us-cc': 'backdrop'
    });
    
    // Create panel
    const panel = this.createElement('div', {
      id: 'us-cc-panel',
      'data-us-cc': 'panel'
    });
    
    // Panel header
    const header = this.createElement('div', { class: 'us-p-header' });
    const title = this.createElement('div', { class: 'us-p-title' });
    const titleEditor = this.createElement('span', { class: 'us-title-editor' }, 'Color ');
    const titleNormal = document.createTextNode('Customizer');
    title.appendChild(titleEditor);
    title.appendChild(titleNormal);
    
    const version = this.createElement('div', { class: 'us-p-version' }, 'v2.0.7');
    
    // iOS-style toggle switch
    const toggle = this.createElement('label', { class: 'us-switch us-p-header-toggle' });
    const toggleInput = this.createElement('input', { type: 'checkbox' });
    const slider = this.createElement('span', { class: 'us-slider' });
    toggle.appendChild(toggleInput);
    toggle.appendChild(slider);
    
    header.appendChild(title);
    header.appendChild(version);
    header.appendChild(toggle);
    
    // Panel content
    const rules = this.createElement('div', { class: 'us-p-rules' });
    const empty = this.createElement('div', { class: 'us-p-empty' }, 'カラールールはまだありません\n要素をクリックしてカスタマイズしましょう');
    rules.appendChild(empty);
    
    // Panel footer
    const footer = this.createElement('div', { class: 'us-p-footer' });
    const footerRow = this.createElement('div', { class: 'us-p-footer-row' });
    
    const clearBtn = this.createElement('button', { class: 'us-btn us-btn-danger' }, '全削除');
    const exportBtn = this.createElement('button', { class: 'us-btn us-btn-secondary' }, 'エクスポート');
    const importBtn = this.createElement('button', { class: 'us-btn us-btn-secondary' }, 'インポート');
    
    footerRow.appendChild(clearBtn);
    footerRow.appendChild(exportBtn);
    footerRow.appendChild(importBtn);
    footer.appendChild(footerRow);
    
    // Assemble panel
    panel.appendChild(header);
    panel.appendChild(rules);
    panel.appendChild(footer);
    
    // Append to body
    document.body.appendChild(tab);
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    
    console.log('[ColorCustomizer] UI elements created and added to DOM');
  },

  createElement(tag, attrs = {}, text = '') {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'class') {
        el.className = value;
      } else {
        el.setAttribute(key, value);
      }
    });
    if (text) el.textContent = text;
    return el;
  },

  initEventListeners() {
    const tab = document.getElementById('us-cc-tab');
    const panel = document.getElementById('us-cc-panel');
    const backdrop = document.getElementById('us-cc-backdrop');
    const toggle = document.querySelector('#us-cc-panel .us-switch input');
    
    if (!tab || !panel || !backdrop || !toggle) {
      console.error('[ColorCustomizer] Required UI elements not found');
      return;
    }
    
    // Tab click to toggle panel
    tab.addEventListener('click', () => {
      const isOpen = panel.classList.contains('us-open');
      if (isOpen) {
        this.closePanel();
      } else {
        this.openPanel();
      }
    });
    
    // Backdrop click to close
    backdrop.addEventListener('click', () => {
      this.closePanel();
    });
    
    // Toggle switch for edit mode
    toggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        this.enableEditMode();
      } else {
        this.disableEditMode();
      }
    });
    
    console.log('[ColorCustomizer] Event listeners initialized');
  },

  openPanel() {
    const panel = document.getElementById('us-cc-panel');
    const backdrop = document.getElementById('us-cc-backdrop');
    const tab = document.getElementById('us-cc-tab');
    
    if (panel && backdrop && tab) {
      panel.classList.add('us-open');
      backdrop.classList.add('us-visible');
      tab.classList.add('us-tab-active');
    }
  },

  closePanel() {
    const panel = document.getElementById('us-cc-panel');
    const backdrop = document.getElementById('us-cc-backdrop');
    const tab = document.getElementById('us-cc-tab');
    
    if (panel && backdrop && tab) {
      panel.classList.remove('us-open');
      backdrop.classList.remove('us-visible');
      tab.classList.remove('us-tab-active');
    }
  },

  enableEditMode() {
    console.log('[ColorCustomizer] Edit mode enabled');
    const tab = document.getElementById('us-cc-tab');
    if (tab) tab.classList.add('us-tab-active');
  },

  disableEditMode() {
    console.log('[ColorCustomizer] Edit mode disabled');
    const tab = document.getElementById('us-cc-tab');
    if (tab) tab.classList.remove('us-tab-active');
  },

  injectStyles() {
    if (document.querySelector('[data-us-cc-styles]')) {
      console.log('[ColorCustomizer] Styles already injected');
      return;
    }
    
    const style = document.createElement('style');
    style.setAttribute('data-us-cc-styles', '1');
    style.textContent = this.getCSS();
    (document.head || document.documentElement).appendChild(style);
    console.log('[ColorCustomizer] Styles injected');
  },

  getCSS() {
    return [
      '/* === UserScripts Color Customizer === */',

      /* ── Reset for our UI ── */
      '[data-us-cc] *, [data-us-cc] *::before, [data-us-cc] *::after {',
      '  box-sizing: border-box !important; margin: 0 !important; padding: 0 !important;',
      '}',

      /* ── Tab (Liquid Glass) ── */
      '#us-cc-tab {',
      '  all: initial !important;',
      '  position: fixed !important; right: 0 !important; top: 50% !important;',
      '  transform: translateY(-50%) !important;',
      '  z-index: 2147483646 !important;',
      '  width: 58px !important; min-height: 88px !important; overflow: visible !important;',
      '  background: rgba(255,255,255,0.12) !important;',
      '  backdrop-filter: blur(24px) saturate(180%) !important; -webkit-backdrop-filter: blur(24px) saturate(180%) !important;',
      '  border-radius: 12px 0 0 12px !important;',
      '  border: 1px solid rgba(255,255,255,0.22) !important; border-right: none !important;',
      '  box-shadow: -4px 0 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.15) !important;',
      '  display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; gap: 1px !important;',
      '  transition: width 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease !important;',
      '}',
      '#us-cc-tab:hover { width: 62px !important; background: rgba(255,255,255,0.16) !important; }',
      '#us-cc-tab .us-cc-tab-icon {',
      '  color: rgba(0,0,0,0.55) !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;',
      '  font-size: 11px !important; font-weight: 600 !important; letter-spacing: 0.02em !important;',
      '  flex: 1 !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; gap: 2px !important;',
      '  min-height: 0 !important; cursor: pointer !important; padding: 1px 0 1px !important; overflow: visible !important;',
      '}',
      '#us-cc-tab .us-cc-tab-icon:hover { color: rgba(0,0,0,0.75) !important; }',
      '#us-cc-tab .us-cc-tab-icon-row {',
      '  display: flex !important; flex-direction: column !important; align-items: stretch !important; gap: 1px !important; transform: translateY(-29px) !important;',
      '  width: fit-content !important; font-size: 11px !important; line-height: 1.2 !important;',
      '}',
      '#us-cc-tab .us-cc-tab-text { writing-mode: horizontal-tb !important; text-orientation: mixed !important; }',
      '#us-cc-tab .us-cc-tab-swatch {',
      '  display: block !important; visibility: visible !important; width: 100% !important; height: 0.5em !important; min-height: 4px !important;',
      '  border-radius: 4px !important; flex-shrink: 0 !important;',
      '  background: linear-gradient(to right, #f44336 0%, #e91e63 12.5%, #9c27b0 25%, #2196f3 37.5%, #00bcd4 50%, #4caf50 62.5%, #ffeb3b 75%, #ff9800 87.5%, #f44336 100%) !important;',
      '  border: none !important; box-sizing: border-box !important;',
      '}',
      '#us-cc-tab.us-tab-active .us-cc-tab-swatch { opacity: 1 !important; }',
      '#us-cc-tab.us-tab-active {',
      '  border-color: rgba(59,130,246,0.4) !important;',
      '  background: rgba(255,255,255,0.18) !important;',
      '  box-shadow: -4px 0 24px rgba(59,130,246,0.12), inset 0 1px 0 rgba(255,255,255,0.2) !important;',
      '}',
      '#us-cc-tab.us-tab-active .us-cc-tab-icon { color: rgba(0,0,0,0.55) !important; }',
      '.us-cc-tab-toggle-wrap {',
      '  flex-shrink: 0 !important; padding: 1px 0 1px !important; min-height: 0 !important; overflow: visible !important;',
      '  display: flex !important; align-items: center !important; justify-content: center !important;',
      '  transform: translateY(47px) scale(0.7) !important; transform-origin: center center !important; }',

      /* ── Edit-mode highlight ── */
      '.us-cc-highlight {',
      '  outline: 2px solid rgba(59,130,246,0.8) !important;',
      '  outline-offset: 1px !important;',
      '  cursor: crosshair !important;',
      '}',

      /* ── Backdrop (Liquid Glass: 軽いオーバーレイ＋ブラー) ── */
      '#us-cc-backdrop {',
      '  all: initial !important; position: fixed !important; inset: 0 !important;',
      '  z-index: 2147483645 !important;',
      '  background: rgba(0,0,0,0.12) !important;',
      '  backdrop-filter: blur(16px) saturate(120%) !important; -webkit-backdrop-filter: blur(16px) saturate(120%) !important;',
      '  display: none !important; opacity: 0 !important;',
      '  transition: opacity 0.25s ease !important;',
      '}',
      '#us-cc-backdrop.us-visible { display: block !important; opacity: 1 !important; }',

      /* ── Panel (Liquid Glass, slides from right) ── */
      '#us-cc-panel {',
      '  all: initial !important; position: fixed !important;',
      '  top: 0 !important; right: 0 !important; bottom: 0 !important;',
      '  width: 320px !important; max-width: 85vw !important;',
      '  z-index: 2147483647 !important;',
      '  background: rgba(255,255,255,0.14) !important;',
      '  backdrop-filter: blur(40px) saturate(160%) !important; -webkit-backdrop-filter: blur(40px) saturate(160%) !important;',
      '  border-left: 1px solid rgba(255,255,255,0.28) !important;',
      '  box-shadow: -8px 0 32px rgba(0,0,0,0.06), inset 1px 0 0 rgba(255,255,255,0.2) !important;',
      '  color: rgba(0,0,0,0.82) !important;',
      '  font-family: system-ui, -apple-system, sans-serif !important;',
      '  font-size: 13px !important; line-height: 1.5 !important;',
      '  display: flex !important; flex-direction: column !important;',
      '  transform: translateX(100%) !important;',
      '  transition: transform 0.28s cubic-bezier(.2,.9,.3,1) !important;',
      '}',
      '#us-cc-panel.us-open { transform: translateX(0) !important; }',

      /* panel header */
      '#us-cc-panel .us-p-header {',
      '  display: flex !important; align-items: center !important; gap: 8px !important;',
      '  padding: 16px 16px 12px !important;',
      '  border-bottom: 1px solid rgba(0,0,0,0.06) !important; flex-shrink: 0 !important;',
      '}',
      '#us-cc-panel .us-p-title {',
      '  all: initial !important; font-family: inherit !important;',
      '  font-size: 15px !important; font-weight: normal !important; color: rgba(0,0,0,0.88) !important;',
      '}',
      '#us-cc-panel .us-p-title .us-title-editor {',
      '  font-weight: 900 !important;',
      '}',
      '#us-cc-panel .us-p-version {',
      '  all: initial !important; font-family: "SF Mono","Menlo",monospace !important;',
      '  font-size: 10px !important; color: rgba(0,0,0,0.4) !important;',
      '}',
      '#us-cc-panel .us-p-header-toggle {',
      '  margin-left: auto !important; flex-shrink: 0 !important;',
      '}',

      /* iOS-style toggle switch */
      '.us-switch {',
      '  all: initial !important; position: relative !important; display: inline-block !important;',
      '  width: 44px !important; height: 24px !important; cursor: pointer !important;',
      '}',
      '.us-switch input { opacity: 0 !important; width: 0 !important; height: 0 !important; position: absolute !important; }',
      '.us-switch .us-slider {',
      '  position: absolute !important; inset: 0 !important;',
      '  background: rgba(0,0,0,0.12) !important; border-radius: 12px !important;',
      '  transition: background 0.2s !important;',
      '}',
      '.us-switch .us-slider::after {',
      '  content: "" !important; position: absolute !important;',
      '  left: 2px !important; top: 2px !important; width: 20px !important; height: 20px !important;',
      '  background: #fff !important; border-radius: 50% !important;',
      '  box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important;',
      '  transition: transform 0.2s !important;',
      '}',
      '.us-switch input:checked + .us-slider { background: #30d158 !important; }',
      '.us-switch input:checked + .us-slider::after { transform: translateX(20px) !important; }',

      /* Rules list */
      '#us-cc-panel .us-p-rules {',
      '  flex: 1 !important; overflow-y: auto !important; padding: 8px 16px !important;',
      '}',
      '#us-cc-panel .us-p-rules::-webkit-scrollbar { width: 3px !important; }',
      '#us-cc-panel .us-p-rules::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12) !important; border-radius: 3px !important; }',
      '#us-cc-panel .us-p-empty {',
      '  all: initial !important; display: block !important; font-family: inherit !important;',
      '  text-align: center !important; color: rgba(0,0,0,0.45) !important;',
      '  font-size: 12px !important; padding: 32px 16px !important;',
      '}',
      '#us-cc-panel .us-rule-item {',
      '  display: flex !important; align-items: center !important; gap: 8px !important;',
      '  padding: 8px 10px !important; margin-bottom: 4px !important;',
      '  background: rgba(255,255,255,0.5) !important; border: 1px solid rgba(255,255,255,0.4) !important;',
      '  border-radius: 8px !important; transition: background 0.15s !important;',
      '}',
      '#us-cc-panel .us-rule-item:hover { background: rgba(255,255,255,0.65) !important; }',
      '#us-cc-panel .us-rule-swatch {',
      '  all: initial !important; width: 18px !important; height: 18px !important;',
      '  border-radius: 4px !important; border: 1px solid rgba(0,0,0,0.1) !important;',
      '  flex-shrink: 0 !important;',
      '}',
      '#us-cc-panel .us-rule-info {',
      '  flex: 1 !important; overflow: hidden !important; min-width: 0 !important;',
      '}',
      '#us-cc-panel .us-rule-selector {',
      '  all: initial !important; display: block !important; font-family: "SF Mono","Menlo",monospace !important;',
      '  font-size: 10px !important; color: rgba(0,0,0,0.5) !important;',
      '  white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;',
      '}',
      '#us-cc-panel .us-rule-prop {',
      '  all: initial !important; display: block !important; font-family: inherit !important;',
      '  font-size: 11px !important; color: rgba(0,0,0,0.7) !important;',
      '}',
      '#us-cc-panel .us-rule-del {',
      '  all: initial !important; cursor: pointer !important; color: rgba(0,0,0,0.35) !important;',
      '  font-size: 14px !important; width: 22px !important; height: 22px !important;',
      '  display: flex !important; align-items: center !important; justify-content: center !important;',
      '  border-radius: 4px !important; flex-shrink: 0 !important;',
      '  transition: background 0.15s, color 0.15s !important;',
      '}',
      '#us-cc-panel .us-rule-del:hover { background: rgba(255,69,58,0.15) !important; color: #ff453a !important; }',

      /* Panel footer */
      '#us-cc-panel .us-p-footer {',
      '  padding: 12px 16px !important; border-top: 1px solid rgba(0,0,0,0.06) !important;',
      '  flex-shrink: 0 !important; display: flex !important; flex-direction: column !important; gap: 8px !important;',
      '}',
      '#us-cc-panel .us-p-footer-row {',
      '  display: flex !important; gap: 6px !important;',
      '}',
      '#us-cc-panel .us-btn {',
      '  all: initial !important; display: inline-flex !important; align-items: center !important; justify-content: center !important;',
      '  padding: 7px 14px !important; font-family: inherit !important; font-size: 12px !important; font-weight: 500 !important;',
      '  border-radius: 8px !important; cursor: pointer !important;',
      '  transition: filter 0.15s, transform 0.1s !important; white-space: nowrap !important;',
      '}',
      '#us-cc-panel .us-btn:active { transform: scale(0.96) !important; }',
      '#us-cc-panel .us-btn-danger {',
      '  background: rgba(255,69,58,0.12) !important; color: #ff453a !important;',
      '  border: 1px solid rgba(255,69,58,0.18) !important;',
      '}',
      '#us-cc-panel .us-btn-danger:hover { background: rgba(255,69,58,0.22) !important; }',
      '#us-cc-panel .us-btn-secondary {',
      '  background: rgba(255,255,255,0.6) !important; color: rgba(0,0,0,0.65) !important;',
      '  border: 1px solid rgba(255,255,255,0.5) !important; flex: 1 !important;',
      '}',
      '#us-cc-panel .us-btn-secondary:hover { background: rgba(255,255,255,0.8) !important; color: rgba(0,0,0,0.85) !important; }'
    ].join('\n');
  }
};