/**
 * UserScript Color Editor Module (Full Implementation)
 * 
 * Complete Element-based Color Customizer functionality restored from v1.6.53
 * with original UI, features, and behavior - only tab name changed to "ツール"
 */

// =========================
// Global helpers from RPC (will be injected)
// =========================
let RPC; // Will be passed in during initialization

// =========================
// Utilities
// =========================
function h(tag, attrs) {
  var parts = tag.split(/([.#][^.#]+)/);
  var tagName = parts[0] || 'div';
  var el = document.createElement(tagName);
  parts.slice(1).forEach(function(part) {
    if (part.startsWith('.')) el.classList.add(part.slice(1));
    else if (part.startsWith('#')) el.id = part.slice(1);
  });
  if (attrs) Object.keys(attrs).forEach(function (key) { el.setAttribute(key, attrs[key]); });
  for (var i = 2; i < arguments.length; i++) {
    if (arguments[i]) el.appendChild(arguments[i]);
  }
  return el;
}

function makeSvg(tag, attrs) {
  var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
  for (var i = 2; i < arguments.length; i++) el.appendChild(arguments[i]);
  return el;
}

// =========================
// CSS Injection (Original UI Styles)
// =========================
var Styles = {
  injected: false,

  inject: function () {
    if (this.injected) return;
    
    // Remove any existing styles first
    var existing = document.querySelectorAll('style[data-us-cc-styles]');
    for (var i = 0; i < existing.length; i++) {
      existing[i].parentNode.removeChild(existing[i]);
    }
    
    var style = document.createElement('style');
    style.setAttribute('data-us-cc-styles', '1');
    style.setAttribute('data-priority', 'high');
    style.textContent = this._css();
    
    // Insert at the end for maximum priority
    if (document.head) {
      document.head.appendChild(style);
    } else {
      document.documentElement.appendChild(style);
    }
    
    this.injected = true;
    console.log('[ColorCustomizer] Liquid Glass CSS injected with high priority');
  },

  _css: function () {
    return [
      '/* === UserScripts Color Customizer v2.0.5 === */',

      /* ── Force reset for our UI ── */
      'html [data-us-cc], html [data-us-cc] *, html [data-us-cc] *::before, html [data-us-cc] *::after {',
      '  all: unset !important; box-sizing: border-box !important;',
      '}',
      'html [data-us-cc] {',
      '  display: block !important;',
      '}',

      /* ── Tab (Liquid Glass - Enhanced Specificity) ── */
      'html body #us-cc-tab {',,
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
      'html body #us-cc-tab:hover { width: 62px !important; background: rgba(255,255,255,0.16) !important; }',
      'html body #us-cc-tab .us-cc-tab-icon {',',
      '  color: rgba(0,0,0,0.55) !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;',
      '  font-size: 11px !important; font-weight: 600 !important; letter-spacing: 0.02em !important;',
      '  flex: 1 !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; gap: 2px !important;',
      '  min-height: 0 !important; cursor: pointer !important; padding: 1px 0 1px !important; overflow: visible !important;',
      '}',
      'html body #us-cc-tab .us-cc-tab-icon:hover { color: rgba(0,0,0,0.75) !important; }',
      'html body #us-cc-tab .us-cc-tab-icon-row {',',
      '  display: flex !important; flex-direction: column !important; align-items: stretch !important; gap: 1px !important; transform: translateY(-29px) !important;',
      '  width: fit-content !important; font-size: 11px !important; line-height: 1.2 !important;',
      '}',
      'html body #us-cc-tab .us-cc-tab-text { writing-mode: horizontal-tb !important; text-orientation: mixed !important; }',
      'html body #us-cc-tab .us-cc-tab-swatch {',',
      '  display: block !important; visibility: visible !important; width: 100% !important; height: 0.5em !important; min-height: 4px !important;',
      '  border-radius: 4px !important; flex-shrink: 0 !important;',
      '  background: linear-gradient(to right, #f44336 0%, #e91e63 12.5%, #9c27b0 25%, #2196f3 37.5%, #00bcd4 50%, #4caf50 62.5%, #ffeb3b 75%, #ff9800 87.5%, #f44336 100%) !important;',
      '  border: none !important; box-sizing: border-box !important;',
      '}',
      'html body #us-cc-tab.us-tab-active .us-cc-tab-swatch { opacity: 1 !important; }',
      'html body #us-cc-tab.us-tab-active {',',
      '  border-color: rgba(59,130,246,0.4) !important;',
      '  background: rgba(255,255,255,0.18) !important;',
      '  box-shadow: -4px 0 24px rgba(59,130,246,0.12), inset 0 1px 0 rgba(255,255,255,0.2) !important;',
      '}',
      'html body #us-cc-tab.us-tab-active .us-cc-tab-icon { color: rgba(0,0,0,0.55) !important; }',
      'html body .us-cc-tab-toggle-wrap {',,
      '  flex-shrink: 0 !important; padding: 1px 0 1px !important; min-height: 0 !important; overflow: visible !important;',
      '  display: flex !important; align-items: center !important; justify-content: center !important;',
      '  transform: translateY(47px) scale(0.7) !important; transform-origin: center center !important; }',

      /* ── Edit-mode highlight ── */
      'html body .us-cc-highlight {',',
      '  outline: 2px solid rgba(59,130,246,0.8) !important;',
      '  outline-offset: 1px !important;',
      '  cursor: crosshair !important;',
      '}',

      /* ── Backdrop (Liquid Glass: 軽いオーバーレイ＋ブラー - Enhanced Specificity) ── */
      'html body #us-cc-backdrop {',,
      '  all: initial !important; position: fixed !important; inset: 0 !important;',
      '  z-index: 2147483645 !important;',
      '  background: rgba(0,0,0,0.12) !important;',
      '  backdrop-filter: blur(16px) saturate(120%) !important; -webkit-backdrop-filter: blur(16px) saturate(120%) !important;',
      '  display: none !important; opacity: 0 !important;',
      '  transition: opacity 0.25s ease !important;',
      '}',
      'html body #us-cc-backdrop.us-visible { display: block !important; opacity: 1 !important; }',

      /* ── Panel (Liquid Glass, slides from right - Enhanced Specificity) ── */
      'html body #us-cc-panel {',,
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
      'html body #us-cc-panel.us-open { transform: translateX(0) !important; }',

      /* panel header */
      'html body #us-cc-panel .us-p-header {',',
      '  display: flex !important; align-items: center !important; gap: 8px !important;',
      '  padding: 16px 16px 12px !important;',
      '  border-bottom: 1px solid rgba(0,0,0,0.06) !important; flex-shrink: 0 !important;',
      '}',
      'html body #us-cc-panel .us-p-title {',',
      '  all: initial !important; font-family: inherit !important;',
      '  font-size: 15px !important; font-weight: normal !important; color: rgba(0,0,0,0.88) !important;',
      '}',
      'html body #us-cc-panel .us-p-title .us-title-editor {',,
      '  font-weight: 900 !important;',
      '}',
      'html body #us-cc-panel .us-p-version {',',
      '  all: initial !important; font-family: "SF Mono","Menlo",monospace !important;',
      '  font-size: 10px !important; color: rgba(0,0,0,0.4) !important;',
      '}',
      'html body #us-cc-panel .us-p-header-toggle {',,
      '  margin-left: auto !important; flex-shrink: 0 !important;',
      '}',

      /* iOS-style toggle switch */
      'html body .us-switch {',',
      '  all: initial !important; position: relative !important; display: inline-block !important;',
      '  width: 44px !important; height: 24px !important; cursor: pointer !important;',
      '}',
      'html body .us-switch input { opacity: 0 !important; width: 0 !important; height: 0 !important; position: absolute !important; }',
      'html body .us-switch .us-slider {',',
      '  position: absolute !important; inset: 0 !important;',
      '  background: rgba(0,0,0,0.12) !important; border-radius: 12px !important;',
      '  transition: background 0.2s !important;',
      '}',
      'html body .us-switch .us-slider::after {',',
      '  content: "" !important; position: absolute !important;',
      '  left: 2px !important; top: 2px !important; width: 20px !important; height: 20px !important;',
      '  background: #fff !important; border-radius: 50% !important;',
      '  box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important;',
      '  transition: transform 0.2s !important;',
      '}',
      'html body .us-switch input:checked + .us-slider { background: #30d158 !important; }',
      'html body .us-switch input:checked + .us-slider::after { transform: translateX(20px) !important; }',

      /* Rules list */
      'html body #us-cc-panel .us-p-rules {',',
      '  flex: 1 !important; overflow-y: auto !important; padding: 8px 16px !important;',
      '}',
      'html body #us-cc-panel .us-p-rules::-webkit-scrollbar { width: 3px !important; }',
      'html body #us-cc-panel .us-p-rules::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12) !important; border-radius: 3px !important; }',
      'html body #us-cc-panel .us-p-empty {',',
      '  all: initial !important; display: block !important; font-family: inherit !important;',
      '  text-align: center !important; color: rgba(0,0,0,0.45) !important;',
      '  font-size: 12px !important; padding: 32px 16px !important;',
      '}',
      'html body #us-cc-panel .us-rule-item {',',
      '  display: flex !important; align-items: center !important; gap: 8px !important;',
      '  padding: 8px 10px !important; margin-bottom: 4px !important;',
      '  background: rgba(255,255,255,0.5) !important; border: 1px solid rgba(255,255,255,0.4) !important;',
      '  border-radius: 8px !important; transition: background 0.15s !important;',
      '}',
      'html body #us-cc-panel .us-rule-item:hover { background: rgba(255,255,255,0.65) !important; }',
      'html body #us-cc-panel .us-rule-swatch {',',
      '  all: initial !important; width: 18px !important; height: 18px !important;',
      '  border-radius: 4px !important; border: 1px solid rgba(0,0,0,0.1) !important;',
      '  flex-shrink: 0 !important;',
      '}',
      'html body #us-cc-panel .us-rule-info {',',
      '  flex: 1 !important; overflow: hidden !important; min-width: 0 !important;',
      '}',
      'html body #us-cc-panel .us-rule-selector {',',
      '  all: initial !important; display: block !important; font-family: "SF Mono","Menlo",monospace !important;',
      '  font-size: 10px !important; color: rgba(0,0,0,0.5) !important;',
      '  white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;',
      '}',
      'html body #us-cc-panel .us-rule-prop {',',
      '  all: initial !important; display: block !important; font-family: inherit !important;',
      '  font-size: 11px !important; color: rgba(0,0,0,0.7) !important;',
      '}',
      'html body #us-cc-panel .us-rule-del {',',
      '  all: initial !important; cursor: pointer !important; color: rgba(0,0,0,0.35) !important;',
      '  font-size: 14px !important; width: 22px !important; height: 22px !important;',
      '  display: flex !important; align-items: center !important; justify-content: center !important;',
      '  border-radius: 4px !important; flex-shrink: 0 !important;',
      '  transition: background 0.15s, color 0.15s !important;',
      '}',
      'html body #us-cc-panel .us-rule-del:hover { background: rgba(255,69,58,0.15) !important; color: #ff453a !important; }',

      /* Panel footer */
      'html body #us-cc-panel .us-p-footer {',',
      '  padding: 12px 16px !important; border-top: 1px solid rgba(0,0,0,0.06) !important;',
      '  flex-shrink: 0 !important; display: flex !important; flex-direction: column !important; gap: 8px !important;',
      '}',
      'html body #us-cc-panel .us-p-footer-row {',',
      '  display: flex !important; gap: 6px !important;',
      '}',
      'html body #us-cc-panel .us-btn {',',
      '  all: initial !important; display: inline-flex !important; align-items: center !important; justify-content: center !important;',
      '  padding: 7px 14px !important; font-family: inherit !important; font-size: 12px !important; font-weight: 500 !important;',
      '  border-radius: 8px !important; cursor: pointer !important;',
      '  transition: filter 0.15s, transform 0.1s !important; white-space: nowrap !important;',
      '}',
      'html body #us-cc-panel .us-btn:active { transform: scale(0.96) !important; }',
      'html body #us-cc-panel .us-btn-danger {',',
      '  background: rgba(255,69,58,0.12) !important; color: #ff453a !important;',
      '  border: 1px solid rgba(255,69,58,0.18) !important;',
      '}',
      'html body #us-cc-panel .us-btn-danger:hover { background: rgba(255,69,58,0.22) !important; }',
      'html body #us-cc-panel .us-btn-secondary {',',
      '  background: rgba(255,255,255,0.6) !important; color: rgba(0,0,0,0.65) !important;',
      '  border: 1px solid rgba(255,255,255,0.5) !important; flex: 1 !important;',
      '}',
      'html body #us-cc-panel .us-btn-secondary:hover { background: rgba(255,255,255,0.8) !important; color: rgba(0,0,0,0.85) !important; }',

      /* ── Color Popover (Liquid Glass - Enhanced Specificity) ── */
      'html body #us-cc-popover {',,
      '  all: initial !important; position: fixed !important;',
      '  z-index: 2147483647 !important;',
      '  background: rgba(255,255,255,0.2) !important;',
      '  backdrop-filter: blur(24px) saturate(160%) !important; -webkit-backdrop-filter: blur(24px) saturate(160%) !important;',
      '  border: 1px solid rgba(255,255,255,0.35) !important;',
      '  border-radius: 12px !important; padding: 14px !important;',
      '  width: 280px !important;',
      '  overflow: visible !important;',
      '  color: rgba(0,0,0,0.82) !important;',
      '  font-family: system-ui, -apple-system, sans-serif !important;',
      '  font-size: 12px !important;',
      '  box-shadow: 0 12px 40px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3) !important;',
      '  display: none !important;',
      '}',
      'html body #us-cc-popover.us-visible { display: block !important; }',
      'html body #us-cc-popover .us-pop-label {',',
      '  all: initial !important; display: block !important; font-family: inherit !important;',
      '  font-size: 10px !important; font-weight: 600 !important; text-transform: uppercase !important;',
      '  letter-spacing: 0.5px !important; color: rgba(0,0,0,0.45) !important;',
      '  margin-bottom: 6px !important;',
      '}',
      'html body #us-cc-popover .us-pop-selector-text {',',
      '  all: initial !important; display: block !important; font-family: "SF Mono","Menlo",monospace !important;',
      '  font-size: 10px !important; color: rgba(0,0,0,0.55) !important; background: rgba(255,255,255,0.4) !important;',
      '  padding: 3px 6px !important; border-radius: 4px !important; margin-bottom: 8px !important;',
      '  max-width: 100% !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important;',
      '}',
      'html body #us-cc-popover .us-pop-colors {',',
      '  display: flex !important; flex-direction: column !important; gap: 8px !important;',
      '}',
      'html body #us-cc-popover .us-pop-color-row {',',
      '  display: flex !important; align-items: center !important; gap: 8px !important;',
      '}',
      'html body #us-cc-popover .us-pop-color-btn {',',
      '  all: initial !important; display: flex !important; align-items: center !important; gap: 6px !important;',
      '  padding: 8px 10px !important; min-width: 0 !important; flex: 1 !important;',
      '  border-radius: 8px !important; font-family: inherit !important; font-size: 11px !important; font-weight: 500 !important;',
      '  cursor: pointer !important; transition: all 0.15s !important;',
      '  background: rgba(255,255,255,0.4) !important; border: 1px solid rgba(255,255,255,0.3) !important; color: rgba(0,0,0,0.7) !important;',
      '}',
      'html body #us-cc-popover .us-pop-color-btn:hover { background: rgba(255,255,255,0.6) !important; color: rgba(0,0,0,0.9) !important; transform: scale(1.02) !important; }',
      'html body #us-cc-popover .us-pop-color-btn:active { transform: scale(0.98) !important; }',
      'html body #us-cc-popover .us-color-swatch {',',
      '  width: 14px !important; height: 14px !important; border-radius: 3px !important;',
      '  border: 1px solid rgba(0,0,0,0.1) !important; flex-shrink: 0 !important;',
      '}',

      /* ── Themes (dark) ── */
      '@media (prefers-color-scheme: dark) {',
      '  html body #us-cc-tab { background: rgba(0,0,0,0.3) !important; border-color: rgba(255,255,255,0.15) !important; }',
      '  html body #us-cc-tab:hover { background: rgba(0,0,0,0.4) !important; }',
      '  html body #us-cc-tab .us-cc-tab-icon { color: rgba(255,255,255,0.65) !important; }',
      '  html body #us-cc-tab .us-cc-tab-icon:hover { color: rgba(255,255,255,0.9) !important; }',
      '  html body #us-cc-panel { background: rgba(18,18,18,0.85) !important; border-color: rgba(255,255,255,0.12) !important; color: rgba(255,255,255,0.85) !important; }',
      '  html body #us-cc-panel .us-p-title { color: rgba(255,255,255,0.9) !important; }',
      '  html body #us-cc-panel .us-p-version { color: rgba(255,255,255,0.4) !important; }',
      '  html body #us-cc-panel .us-p-header { border-color: rgba(255,255,255,0.08) !important; }',
      '  html body #us-cc-panel .us-rule-item { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.06) !important; }',
      '  html body #us-cc-panel .us-rule-item:hover { background: rgba(255,255,255,0.12) !important; }',
      '  html body #us-cc-panel .us-rule-selector { color: rgba(255,255,255,0.5) !important; }',
      '  html body #us-cc-panel .us-rule-prop { color: rgba(255,255,255,0.75) !important; }',
      '  html body #us-cc-panel .us-rule-del { color: rgba(255,255,255,0.35) !important; }',
      '  html body #us-cc-panel .us-p-empty { color: rgba(255,255,255,0.4) !important; }',
      '  html body #us-cc-panel .us-btn-secondary { background: rgba(255,255,255,0.12) !important; color: rgba(255,255,255,0.7) !important; border-color: rgba(255,255,255,0.1) !important; }',
      '  html body #us-cc-panel .us-btn-secondary:hover { background: rgba(255,255,255,0.18) !important; color: rgba(255,255,255,0.9) !important; }',
      '  html body #us-cc-popover { background: rgba(28,28,28,0.9) !important; border-color: rgba(255,255,255,0.2) !important; color: rgba(255,255,255,0.85) !important; }',
      '  html body #us-cc-popover .us-pop-label { color: rgba(255,255,255,0.5) !important; }',
      '  html body #us-cc-popover .us-pop-selector-text { background: rgba(255,255,255,0.08) !important; color: rgba(255,255,255,0.6) !important; }',
      '  html body #us-cc-popover .us-pop-color-btn { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.1) !important; color: rgba(255,255,255,0.7) !important; }',
      '  html body #us-cc-popover .us-pop-color-btn:hover { background: rgba(255,255,255,0.15) !important; color: rgba(255,255,255,0.9) !important; }',
      '}',

    ].join('\n');
  }
};

// =========================
// Selector Engine
// =========================
var SelectorEngine = {
  generate: function (el) {
    if (!(el instanceof HTMLElement)) return '';
    var parts = [];
    var current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      if (current.id) {
        parts.unshift('#' + CSS.escape(current.id));
        break;
      }
      var tag = current.tagName.toLowerCase();
      var parent = current.parentElement;
      if (parent) {
        var siblings = Array.from(parent.children).filter(function (c) { return c.tagName === current.tagName; });
        if (siblings.length > 1) {
          var idx = siblings.indexOf(current) + 1;
          tag += ':nth-of-type(' + idx + ')';
        }
      }
      parts.unshift(tag);
      current = parent;
    }
    if (parts.length === 0) return el.tagName.toLowerCase();
    return parts.join(' > ');
  },

  find: function (selector) {
    try { return document.querySelector(selector); } catch (e) { return null; }
  },

  findAll: function (selector) {
    try {
      var list = document.querySelectorAll(selector);
      return Array.prototype.slice.call(list);
    } catch (e) {
      return [];
    }
  }
};

// =========================
// Rules Manager  
// =========================
var RulesManager = {
  _storagePrefix: 'userscripts:features:colorCustomizer:page:',
  _pageKey: window.location.hostname + window.location.pathname,
  _rules: [],

  _key: function () {
    return this._storagePrefix + encodeURIComponent(this._pageKey);
  },

  async load() {
    try {
      console.log('[ColorCustomizer] Loading rules for:', this._pageKey);
      var data = await RPC.call('storage.get', [this._key(), null]);
      if (data && Array.isArray(data.rules)) {
        this._rules = data.rules;
        console.log('[ColorCustomizer] Loaded', this._rules.length, 'rules');
      } else {
        this._rules = [];
      }
    } catch (e) {
      console.warn('[ColorCustomizer] Failed to load rules:', e);
      this._rules = [];
    }
    return this._rules;
  },

  async importRules(rules) {
    if (!Array.isArray(rules)) return;
    var self = this;
    var count = 0;
    rules.forEach(function (r) {
      if (!r.selector || !r.property || !r.value) return;
      var idx = self._rules.findIndex(function (x) { return x.selector === r.selector && x.property === r.property; });
      if (idx >= 0) {
        self._rules[idx] = r;
      } else {
        self._rules.push(r);
      }
      count++;
    });
    if (count > 0) {
      try {
        await self.save();
        console.log('[ColorCustomizer] Imported ' + count + ' rules and saved');
      } catch (e) {
        console.warn('[ColorCustomizer] Failed to import rules:', e);
      }
    }
    return count;
  },

  async save() {
    var obj = { rules: this._rules };
    return RPC.call('storage.set', [this._key(), obj]);
  },

  getRules: function () {
    return this._rules.slice();
  },

  addRule: function (selector, property, value) {
    var idx = this._rules.findIndex(function (r) { return r.selector === selector && r.property === property; });
    var rule = { selector: selector, property: property, value: value };
    if (idx >= 0) {
      this._rules[idx] = rule;
    } else {
      this._rules.push(rule);
    }
    this.save();
    StyleApplier.applyAll();
  },

  removeRule: function (selector, property) {
    var oldLen = this._rules.length;
    this._rules = this._rules.filter(function (r) { return !(r.selector === selector && r.property === property); });
    if (this._rules.length !== oldLen) {
      this.save();
      StyleApplier.applyAll();
    }
  },

  clearAll: function () {
    this._rules = [];
    this.save();
    StyleApplier.applyAll();  
  },

  exportData: function () {
    return { rules: this.getRules() };
  },

  countRules: function () {
    return this._rules.length;
  }
};

// =========================
// Profile Manager
// =========================
var ProfileManager = {
  _profiles: [],

  async load() {
    try {
      var defaultProfiles = this._getDefaultProfiles();

      var key = 'userscripts:features:colorCustomizer:profiles';
      var data = await RPC.call('storage.get', [key, '[]']);
      var stored = JSON.parse(data || '[]');

      // Merge default + stored
      var merged = [].concat(defaultProfiles);
      stored.forEach(function (p) {
        if (!merged.find(function (x) { return x.id === p.id; })) {
          merged.push(p);
        }
      });
      this._profiles = merged;
    } catch (e) {
      console.warn('[ProfileManager] Failed to load profiles:', e);
      this._profiles = this._getDefaultProfiles();
    }
  },

  getProfiles: function () {
    return this._profiles.slice();
  },

  async applyProfile(profileId) {
    var profile = this._profiles.find(function (p) { return p.id === profileId; });
    if (!profile || !profile.rules) {
      console.warn('[ProfileManager] Profile not found:', profileId);
      return 0;
    }

    console.log('[ProfileManager] Applying profile:', profile.name);
    return RulesManager.importRules(profile.rules);
  },

  _getDefaultProfiles: function () {
    return [
      {
        id: 'high-contrast',
        name: 'ハイコントラスト',
        desc: '背景を黒、テキストを白にして視認性を向上',
        rules: [
          { selector: 'body', property: 'background-color', value: '#000000' },
          { selector: 'body', property: 'color', value: '#ffffff' },
          { selector: '*', property: 'background-color', value: 'transparent' },
          { selector: 'a', property: 'color', value: '#00ddff' }
        ]
      },
      {
        id: 'dark-mode',
        name: 'ダークモード',
        desc: '落ち着いた暗いトーンでページを表示',
        rules: [
          { selector: 'body', property: 'background-color', value: '#1a1a1a' },
          { selector: 'body', property: 'color', value: '#e0e0e0' },
          { selector: 'div, section, article, main', property: 'background-color', value: '#2d2d2d' },
          { selector: 'a', property: 'color', value: '#4a9eff' }
        ]
      },
      {
        id: 'sepia',
        name: 'セピアトーン',
        desc: '目に優しいセピア調の色合いに変換',
        rules: [
          { selector: 'body', property: 'background-color', value: '#f7f3e9' },
          { selector: 'body', property: 'color', value: '#5c4b37' },
          { selector: 'a', property: 'color', value: '#8b4513' }
        ]
      }
    ];
  }
};

// =========================
// Style Applier
// =========================
var StyleApplier = {
  _style: null,

  applyAll: function () {
    this._removeExisting();
    var rules = RulesManager.getRules();
    if (!rules || rules.length === 0) return;

    var css = rules.map(function (rule) {
      return rule.selector + ' { ' + rule.property + ': ' + rule.value + ' !important; }';
    }).join('\n');

    this._style = document.createElement('style');
    this._style.setAttribute('data-us-cc-rules', '1');
    this._style.textContent = css;
    (document.head || document.documentElement).appendChild(this._style);
  },

  _removeExisting: function () {
    if (this._style && this._style.parentNode) {
      this._style.parentNode.removeChild(this._style);
      this._style = null;
    }
    // Also remove any orphaned styles
    var existingStyles = document.querySelectorAll('style[data-us-cc-rules="1"]');
    for (var i = 0; i < existingStyles.length; i++) {
      existingStyles[i].parentNode.removeChild(existingStyles[i]);
    }
  }
};

// =========================
// Tab (Original Implementation)
// ========================= 
var Tab = {
  _el: null,
  _toggle: null,

  create: function () {
    if (this._el) return;

    // Tab toggle
    var toggleWrap = h('div.us-cc-tab-toggle-wrap', { 'data-us-cc': 'tab-toggle' });
    var toggle = h('label.us-switch');
    var checkbox = h('input', { type: 'checkbox' });
    var slider = h('span.us-slider');
    toggle.appendChild(checkbox);
    toggle.appendChild(slider);
    toggleWrap.appendChild(toggle);

    // Tab icon with color swatch
    var iconWrap = h('div.us-cc-tab-icon', { 'data-us-cc': 'tab-icon' });
    var iconRow = h('div.us-cc-tab-icon-row');
    
    var textSpan = h('span.us-cc-tab-text');
    textSpan.appendChild(document.createTextNode('ツール'));
    
    var swatchDiv = h('div.us-cc-tab-swatch', { 'aria-hidden': 'true' });
    
    iconRow.appendChild(textSpan);
    iconRow.appendChild(swatchDiv);
    iconWrap.appendChild(iconRow);

    // Combine both into tab
    var tab = h('div', { id: 'us-cc-tab', 'data-us-cc': 'tab' });
    tab.appendChild(toggleWrap);
    tab.appendChild(iconWrap);

    // Event handlers
    checkbox.addEventListener('change', function () {
      if (this.checked) {
        HighlightMode.enable();
        Tab.setActive(true);
      } else {
        HighlightMode.disable();
        Tab.setActive(false);
      }
    });

    iconWrap.addEventListener('click', function () {
      DomPopover.hide();
      Panel.open();
    });

    document.body.appendChild(tab);
    this._el = tab;
    this._toggle = checkbox;
  },

  setActive: function (active) {
    if (this._el) {
      if (active) {
        this._el.classList.add('us-tab-active');
      } else {
        this._el.classList.remove('us-tab-active');
      }
    }
    if (this._toggle) {
      this._toggle.checked = !!active;
    }
  }
};

// =========================
// Highlight Mode
// =========================
var HighlightMode = {
  _enabled: false,
  _currentHighlight: null,

  isEnabled: function () {
    return this._enabled;
  },

  async enable() {
    this._enabled = true;
    document.body.classList.add('us-highlight-mode');
    await this._saveState();
    this._bindEvents();
    console.log('[HighlightMode] Enabled');
  },

  async disable() {
    this._enabled = false;
    document.body.classList.remove('us-highlight-mode');
    this._clearHighlight();
    await this._saveState();
    this._unbindEvents();
    console.log('[HighlightMode] Disabled');
  },

  async _saveState() {
    if (!RPC) return;
    await RPC.call('storage.set', ['userscripts:features:colorCustomizer:highlightMode', this._enabled]);
  },

  _bindEvents: function () {
    document.addEventListener('mouseover', this._onMouseOver, true);
    document.addEventListener('mouseout', this._onMouseOut, true);
    document.addEventListener('click', this._onClick, true);
  },

  _unbindEvents: function () {
    document.removeEventListener('mouseover', this._onMouseOver, true);
    document.removeEventListener('mouseout', this._onMouseOut, true);
    document.removeEventListener('click', this._onClick, true);
  },

  _onMouseOver: function (e) {
    if (!HighlightMode._enabled) return;
    if (HighlightMode._isTabUI(e.target)) return;
    HighlightMode._setHighlight(e.target);
  },

  _onMouseOut: function (e) {
    if (!HighlightMode._enabled) return;
    if (HighlightMode._isTabUI(e.target)) return;
    HighlightMode._clearHighlight();
  },

  _onClick: function (e) {
    if (!HighlightMode._enabled) return;
    if (HighlightMode._isTabUI(e.target)) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    HighlightMode._clearHighlight();
    DomPopover.showFor(e.target);
  },

  _isTabUI: function (el) {
    if (!el) return true;
    return !!el.closest('[data-us-cc], #us-cc-panel, #us-cc-popover, #us-cc-backdrop');
  },

  _setHighlight: function (el) {
    this._clearHighlight();
    if (el && el.classList) {
      el.classList.add('us-cc-highlight');
      this._currentHighlight = el;
    }
  },

  _clearHighlight: function () {
    if (this._currentHighlight && this._currentHighlight.classList) {
      this._currentHighlight.classList.remove('us-cc-highlight');
      this._currentHighlight = null;
    }
  }
};

// =========================
// DOM Popover
// =========================
var DomPopover = {
  _el: null,
  _target: null,

  showFor: function (target) {
    this.hide();
    this._target = target;
    this._create();
  },

  hide: function () {
    if (this._el) {
      this._el.parentNode.removeChild(this._el);
      this._el = null;
    }
    this._target = null;
  },

  _create: function () {
    var target = this._target;
    var selector = SelectorEngine.generate(target);
    
    var popover = h('div', { id: 'us-cc-popover', 'data-us-cc': 'popover' });
    
    var label = h('div.us-pop-label');
    label.appendChild(document.createTextNode('要素セレクタ'));
    
    var selectorText = h('div.us-pop-selector-text');
    selectorText.appendChild(document.createTextNode(selector));
    
    var colors = h('div.us-pop-colors');
    
    // Background color row
    var bgRow = h('div.us-pop-color-row');
    var bgBtn = this._createColorButton('背景色', 'background-color');
    var textBtn = this._createColorButton('文字色', 'color');
    bgRow.appendChild(bgBtn);
    bgRow.appendChild(textBtn);
    
    colors.appendChild(bgRow);
    
    popover.appendChild(label);
    popover.appendChild(selectorText);
    popover.appendChild(colors);
    
    this._positionPopover(popover);
    popover.classList.add('us-visible');
    
    document.body.appendChild(popover);
    this._el = popover;
  },

  _createColorButton: function (label, property) {
    var btn = h('div.us-pop-color-btn');
    
    var swatch = h('div.us-color-swatch', { style: 'background: currentColor;' });
    var text = document.createTextNode(label);
    
    btn.appendChild(swatch);
    btn.appendChild(text);
    
    var self = this;
    btn.addEventListener('click', function () {
      self._openColorPicker(property);
    });
    
    return btn;
  },

  _openColorPicker: function (property) {
    var self = this;
    var input = document.createElement('input');
    input.type = 'color';
    input.style.position = 'absolute';
    input.style.left = '-9999px';
    
    input.addEventListener('change', function () {
      var selector = SelectorEngine.generate(self._target);
      RulesManager.addRule(selector, property, this.value);
      self.hide();
      document.body.removeChild(input);
    });

    input.addEventListener('cancel', function () {
      self.hide();
      document.body.removeChild(input);
    });
    
    document.body.appendChild(input);
    input.click();
  },

  _positionPopover: function (popover) {
    var rect = this._target.getBoundingClientRect();
    var vpWidth = window.innerWidth;
    var vpHeight = window.innerHeight;
    
    var left = rect.left + (rect.width / 2) - 140; // Center on target
    var top = rect.bottom + 12;
    
    // Keep in viewport
    if (left < 12) left = 12;
    if (left + 280 > vpWidth - 12) left = vpWidth - 292;
    if (top + 120 > vpHeight - 12) top = rect.top - 120 - 12;
    
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';
  }
};

// =========================
// Panel
// =========================
var Panel = {
  _el: null,
  _backdrop: null,

  open: function () {
    if (this._el) return;
    this._createBackdrop();
    this._createElement();
  },

  close: function () {
    if (this._el) {
      this._el.classList.remove('us-open');
      setTimeout(() => {
        if (this._el && this._el.parentNode) {
          this._el.parentNode.removeChild(this._el);
        }
        if (this._backdrop && this._backdrop.parentNode) {
          this._backdrop.parentNode.removeChild(this._backdrop);
        }
        this._el = null;
        this._backdrop = null;
      }, 300);
    }
  },

  _createBackdrop: function () {
    this._backdrop = h('div', { id: 'us-cc-backdrop', 'data-us-cc': 'backdrop' });
    this._backdrop.addEventListener('click', () => this.close());
    document.body.appendChild(this._backdrop);
    
    // Force reflow, then add visible class
    this._backdrop.offsetHeight;
    this._backdrop.classList.add('us-visible');
  },

  _createElement: function () {
    var rules = RulesManager.getRules();
    var profiles = ProfileManager.getProfiles();
    
    // Panel container
    var panel = h('div', { id: 'us-cc-panel', 'data-us-cc': 'panel' });
    
    // Header
    var header = h('div.us-p-header');
    var title = h('div.us-p-title');
    title.innerHTML = '<span class="us-title-editor">ツール</span> v2.0.5';
    
    var headerToggle = h('div.us-p-header-toggle');
    var toggle = h('label.us-switch');
    var toggleInput = h('input', { type: 'checkbox' });
    var toggleSlider = h('span.us-slider');
    
    toggleInput.checked = HighlightMode.isEnabled();
    toggleInput.addEventListener('change', function () {
      if (this.checked) {
        HighlightMode.enable();
        Tab.setActive(true);
      } else {
        HighlightMode.disable();
        Tab.setActive(false);
      }
    });
    
    toggle.appendChild(toggleInput);
    toggle.appendChild(toggleSlider);
    headerToggle.appendChild(toggle);
    
    header.appendChild(title);
    header.appendChild(headerToggle);
    
    // Rules list
    var rulesContainer = h('div.us-p-rules');
    if (rules.length === 0) {
      var empty = h('div.us-p-empty');
      empty.appendChild(document.createTextNode('ルールがありません。要素をクリックして色を設定してください。'));
      rulesContainer.appendChild(empty);
    } else {
      rules.forEach(rule => {
        var item = this._createRuleItem(rule);
        rulesContainer.appendChild(item);
      });
    }
    
    // Footer with profiles and buttons
    var footer = h('div.us-p-footer');
    
    if (profiles.length > 0) {
      var profileRow = h('div.us-p-footer-row');
      profiles.forEach(profile => {
        var btn = h('div.us-btn.us-btn-secondary');
        btn.appendChild(document.createTextNode(profile.name));
        btn.addEventListener('click', async () => {
          await ProfileManager.applyProfile(profile.id);
          this.close();
          setTimeout(() => this.open(), 100);
        });
        profileRow.appendChild(btn);
      });
      footer.appendChild(profileRow);
    }
    
    var actionRow = h('div.us-p-footer-row');
    
    var clearBtn = h('div.us-btn.us-btn-danger');
    clearBtn.appendChild(document.createTextNode('すべて削除'));
    clearBtn.addEventListener('click', () => {
      if (confirm('すべてのルールを削除しますか？')) {
        RulesManager.clearAll();
        this.close();
      }
    });
    
    actionRow.appendChild(clearBtn);
    footer.appendChild(actionRow);
    
    panel.appendChild(header);
    panel.appendChild(rulesContainer);
    panel.appendChild(footer);
    
    document.body.appendChild(panel);
    
    // Trigger animation
    requestAnimationFrame(() => {
      panel.classList.add('us-open');
    });
    
    this._el = panel;
  },

  _createRuleItem: function (rule) {
    var item = h('div.us-rule-item');
    
    var swatch = h('div.us-rule-swatch');
    swatch.style.backgroundColor = rule.value;
    
    var info = h('div.us-rule-info');
    var selector = h('div.us-rule-selector');
    selector.appendChild(document.createTextNode(rule.selector));
    var prop = h('div.us-rule-prop');
    prop.appendChild(document.createTextNode(rule.property + ': ' + rule.value));
    info.appendChild(selector);
    info.appendChild(prop);
    
    var deleteBtn = h('div.us-rule-del');
    deleteBtn.appendChild(document.createTextNode('✕'));
    deleteBtn.addEventListener('click', () => {
      RulesManager.removeRule(rule.selector, rule.property);
      this.close();
      setTimeout(() => this.open(), 100);
    });
    
    item.appendChild(swatch);
    item.appendChild(info);
    item.appendChild(deleteBtn);
    
    return item;
  }
};

// =========================
// Feature Interface + Global API
// =========================
var ColorCustomizerFeature = {
  _initialized: false,

  async init(rpcInstance) {
    if (this._initialized) return true;
    
    // Inject RPC dependency
    RPC = rpcInstance;
    
    try {
      // Inject original CSS styles
      Styles.inject();
      
      await RulesManager.load();
      await ProfileManager.load();
      StyleApplier.applyAll();
      Tab.create();
      
      // Restore highlight mode state
      try {
        var highlightState = await RPC.call('storage.get', ['userscripts:features:colorCustomizer:highlightMode', false]);
        if (highlightState) {
          HighlightMode.enable();
          Tab.setActive(true);
        }
      } catch (e) {
        console.warn('[ColorCustomizer] Failed to restore highlight state:', e.message);
      }
      
      this._initialized = true;
      console.log('[ColorCustomizer] Initialized – ' + RulesManager.getRules().length + ' rule(s), ' + ProfileManager.getProfiles().length + ' profile(s) for ' + window.location.hostname + window.location.pathname);
      return true;
    } catch (e) {
      console.error('[ColorCustomizer] Init failed:', e);
      return false;
    }
  },

  enable: function () {
    HighlightMode.enable();
    Tab.setActive(true);
  },

  disable: function () {
    HighlightMode.disable();
    Tab.setActive(false);  
  }
};

// Export the feature
export default ColorCustomizerFeature;