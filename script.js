/**
 * UserScript – Element-based Color Customizer (Phase 1)
 *
 * Lets users click individual page elements and change their colors.
 * Rules are persisted per-site via GM_* RPC and auto-applied on revisit.
 */

var US_VERSION = '1.3.0';
console.log('%c[UserScripts] script.js loaded – v' + US_VERSION + ' %c' + new Date().toLocaleTimeString(), 'color:#60a5fa;font-weight:bold', 'color:#888');

// =========================
// 1. RPC Client
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
    var timer = setTimeout(function () { cleanup(); reject(new Error('RPC timeout: ' + method)); }, timeoutMs);
    function onMsg(ev) {
      if (ev.source !== window) return;
      var d = ev.data;
      if (!d || d[REP_FLAG] !== true || d.id !== id) return;
      cleanup();
      if (d.ok) resolve(d.result);
      else reject(new Error(d.error || ('RPC error: ' + method)));
    }
    function cleanup() { clearTimeout(timer); window.removeEventListener('message', onMsg); }
    window.addEventListener('message', onMsg);
    window.postMessage({ [REQ_FLAG]: true, id: id, token: token, method: method, params: params || [] }, '*');
  });
}

function handshake() {
  var id = makeId();
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () { cleanup(); reject(new Error('RPC timeout: core.handshake')); }, 8000);
    function onMsg(ev) {
      if (ev.source !== window) return;
      var d = ev.data;
      if (!d || d[REP_FLAG] !== true || d.id !== id) return;
      cleanup();
      if (d.ok) resolve(d.result);
      else reject(new Error(d.error || 'RPC error: core.handshake'));
    }
    function cleanup() { clearTimeout(timer); window.removeEventListener('message', onMsg); }
    window.addEventListener('message', onMsg);
    window.postMessage({ [REQ_FLAG]: true, id: id, token: '', method: 'core.handshake', params: [] }, '*');
  });
}

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
// 2. SelectorEngine
// =========================
var SelectorEngine = {
  /**
   * Build a unique CSS selector path for a given element.
   * Prefers id-based shortcuts; falls back to nth-child chains.
   */
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

  /**
   * Find element(s) matching a selector. Returns first match or null.
   */
  find: function (selector) {
    try { return document.querySelector(selector); } catch (e) { return null; }
  }
};

// =========================
// 3. RulesManager
// =========================
var RulesManager = {
  _storagePrefix: 'userscripts:features:colorCustomizer:site:',
  _hostname: window.location.hostname,
  _rules: [],

  _key: function () {
    return this._storagePrefix + this._hostname;
  },

  async load() {
    try {
      var data = await RPC.call('storage.get', [this._key(), null]);
      if (data && Array.isArray(data.rules)) {
        this._rules = data.rules;
      } else {
        this._rules = [];
      }
    } catch (e) {
      console.warn('[ColorCustomizer] Failed to load rules:', e);
      this._rules = [];
    }
    return this._rules;
  },

  async save() {
    try {
      await RPC.call('storage.set', [this._key(), {
        origin: this._hostname,
        rules: this._rules,
        updatedAt: Date.now()
      }]);
    } catch (e) {
      console.error('[ColorCustomizer] Failed to save rules:', e);
    }
  },

  getRules: function () {
    return this._rules.slice();
  },

  async addRule(selector, property, value, mode) {
    mode = mode || 'inline';
    // Replace existing rule for same selector+property, or add new
    var idx = this._rules.findIndex(function (r) { return r.selector === selector && r.property === property; });
    var rule = { selector: selector, property: property, value: value, mode: mode };
    if (idx >= 0) {
      this._rules[idx] = rule;
    } else {
      this._rules.push(rule);
    }
    await this.save();
    return rule;
  },

  async removeRule(index) {
    if (index >= 0 && index < this._rules.length) {
      this._rules.splice(index, 1);
      await this.save();
    }
  },

  async clearRules() {
    this._rules = [];
    await this.save();
  }
};

// =========================
// 4. StyleApplier
// =========================
var StyleApplier = {
  _applied: [], // { el, property, originalValue }

  /**
   * Apply all rules to the page (inline mode).
   */
  applyAll: function (rules) {
    var self = this;
    self.clearAll();
    rules.forEach(function (rule) {
      if (rule.mode !== 'inline') return; // Phase 1: inline only
      self.applyOne(rule);
    });
  },

  applyOne: function (rule) {
    var el = SelectorEngine.find(rule.selector);
    if (!el) return;
    var original = el.style.getPropertyValue(rule.property);
    this._applied.push({ el: el, property: rule.property, originalValue: original });
    el.style.setProperty(rule.property, rule.value, 'important');
  },

  clearAll: function () {
    this._applied.forEach(function (rec) {
      try {
        if (rec.originalValue) {
          rec.el.style.setProperty(rec.property, rec.originalValue);
        } else {
          rec.el.style.removeProperty(rec.property);
        }
      } catch (e) { /* element may no longer exist */ }
    });
    this._applied = [];
  },

  /**
   * Apply a single inline style immediately (for live preview).
   */
  previewOne: function (el, property, value) {
    el.style.setProperty(property, value, 'important');
  }
};

// =========================
// 5. DOM helpers (Trusted-Types safe)
// =========================

/**
 * Build a DOM element tree without innerHTML.
 * h(tag, attrs?, ...children)
 *   tag      – 'div', 'span.cls', 'button#id.cls1.cls2'
 *   attrs    – plain object  { style: '...', title: '...' } or omitted
 *   children – strings (→ textNode) or other DOM nodes
 */
function h(tag, attrsOrChild) {
  var parts = tag.split(/([.#])/);
  var tagName = parts[0] || 'div';
  var el = document.createElement(tagName);
  var i = 1;
  while (i < parts.length) {
    if (parts[i] === '#') { el.id = parts[i + 1]; i += 2; }
    else if (parts[i] === '.') { el.classList.add(parts[i + 1]); i += 2; }
    else { i++; }
  }
  var childStart = 1;
  if (attrsOrChild && typeof attrsOrChild === 'object' && !(attrsOrChild instanceof Node)) {
    childStart = 2;
    var attrs = attrsOrChild;
    Object.keys(attrs).forEach(function (k) {
      if (k === 'style') el.style.cssText = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    });
  }
  for (var c = childStart; c < arguments.length; c++) {
    var child = arguments[c];
    if (child == null) continue;
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else el.appendChild(child);
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
// 6. CSS Injection (UI styles)
// =========================
var Styles = {
  injected: false,

  inject: function () {
    if (this.injected) return;
    var style = document.createElement('style');
    style.setAttribute('data-us-cc-styles', '1');
    style.textContent = this._css();
    (document.head || document.documentElement).appendChild(style);
    this.injected = true;
  },

  _css: function () {
    return [
      '/* === UserScripts Color Customizer === */',

      /* ── Reset for our UI ── */
      '[data-us-cc] *, [data-us-cc] *::before, [data-us-cc] *::after {',
      '  box-sizing: border-box !important; margin: 0 !important; padding: 0 !important;',
      '}',

      /* ── Tab ── */
      '#us-cc-tab {',
      '  all: initial !important;',
      '  position: fixed !important; right: 0 !important; top: 50% !important;',
      '  transform: translateY(-50%) !important;',
      '  z-index: 2147483646 !important;',
      '  width: 24px !important; height: 56px !important;',
      '  background: rgba(30,30,30,0.78) !important;',
      '  backdrop-filter: blur(8px) !important; -webkit-backdrop-filter: blur(8px) !important;',
      '  border-radius: 6px 0 0 6px !important;',
      '  border: 1px solid rgba(255,255,255,0.08) !important; border-right: none !important;',
      '  cursor: pointer !important;',
      '  display: flex !important; align-items: center !important; justify-content: center !important;',
      '  transition: width 0.15s ease, background 0.15s ease !important;',
      '}',
      '#us-cc-tab:hover { width: 32px !important; background: rgba(50,50,50,0.9) !important; }',
      '#us-cc-tab svg { width: 14px !important; height: 14px !important; }',

      /* ── Edit-mode highlight ── */
      '.us-cc-highlight {',
      '  outline: 2px solid rgba(59,130,246,0.8) !important;',
      '  outline-offset: 1px !important;',
      '  cursor: crosshair !important;',
      '}',

      /* ── Backdrop ── */
      '#us-cc-backdrop {',
      '  all: initial !important; position: fixed !important; inset: 0 !important;',
      '  z-index: 2147483645 !important;',
      '  background: rgba(0,0,0,0.35) !important;',
      '  backdrop-filter: blur(3px) !important; -webkit-backdrop-filter: blur(3px) !important;',
      '  display: none !important; opacity: 0 !important;',
      '  transition: opacity 0.2s ease !important;',
      '}',
      '#us-cc-backdrop.us-visible { display: block !important; opacity: 1 !important; }',

      /* ── Panel (slides from right) ── */
      '#us-cc-panel {',
      '  all: initial !important; position: fixed !important;',
      '  top: 0 !important; right: 0 !important; bottom: 0 !important;',
      '  width: 320px !important; max-width: 85vw !important;',
      '  z-index: 2147483647 !important;',
      '  background: rgba(28,28,30,0.95) !important;',
      '  backdrop-filter: blur(20px) saturate(1.4) !important; -webkit-backdrop-filter: blur(20px) saturate(1.4) !important;',
      '  border-left: 1px solid rgba(255,255,255,0.1) !important;',
      '  color: rgba(255,255,255,0.9) !important;',
      '  font-family: system-ui, -apple-system, sans-serif !important;',
      '  font-size: 13px !important; line-height: 1.5 !important;',
      '  display: flex !important; flex-direction: column !important;',
      '  transform: translateX(100%) !important;',
      '  transition: transform 0.25s cubic-bezier(.2,.9,.3,1) !important;',
      '}',
      '#us-cc-panel.us-open { transform: translateX(0) !important; }',

      /* panel header */
      '#us-cc-panel .us-p-header {',
      '  display: flex !important; align-items: center !important; justify-content: space-between !important;',
      '  padding: 16px 16px 12px !important;',
      '  border-bottom: 1px solid rgba(255,255,255,0.08) !important; flex-shrink: 0 !important;',
      '}',
      '#us-cc-panel .us-p-title {',
      '  all: initial !important; font-family: inherit !important;',
      '  font-size: 15px !important; font-weight: 600 !important; color: #fff !important;',
      '}',
      '#us-cc-panel .us-p-close {',
      '  all: initial !important; cursor: pointer !important; color: rgba(255,255,255,0.4) !important;',
      '  font-size: 18px !important; width: 28px !important; height: 28px !important;',
      '  display: flex !important; align-items: center !important; justify-content: center !important;',
      '  border-radius: 6px !important; transition: background 0.15s, color 0.15s !important;',
      '}',
      '#us-cc-panel .us-p-close:hover { background: rgba(255,255,255,0.08) !important; color: rgba(255,255,255,0.7) !important; }',

      /* Edit Mode toggle row */
      '#us-cc-panel .us-p-toggle-row {',
      '  display: flex !important; align-items: center !important; justify-content: space-between !important;',
      '  padding: 12px 16px !important;',
      '  border-bottom: 1px solid rgba(255,255,255,0.06) !important; flex-shrink: 0 !important;',
      '}',
      '#us-cc-panel .us-p-toggle-label {',
      '  all: initial !important; font-family: inherit !important;',
      '  font-size: 13px !important; color: rgba(255,255,255,0.8) !important;',
      '}',

      /* iOS-style toggle switch */
      '.us-switch {',
      '  all: initial !important; position: relative !important; display: inline-block !important;',
      '  width: 44px !important; height: 24px !important; cursor: pointer !important;',
      '}',
      '.us-switch input { opacity: 0 !important; width: 0 !important; height: 0 !important; position: absolute !important; }',
      '.us-switch .us-slider {',
      '  position: absolute !important; inset: 0 !important;',
      '  background: rgba(255,255,255,0.15) !important; border-radius: 12px !important;',
      '  transition: background 0.2s !important;',
      '}',
      '.us-switch .us-slider::after {',
      '  content: "" !important; position: absolute !important;',
      '  left: 2px !important; top: 2px !important; width: 20px !important; height: 20px !important;',
      '  background: #fff !important; border-radius: 50% !important;',
      '  transition: transform 0.2s !important;',
      '}',
      '.us-switch input:checked + .us-slider { background: #30d158 !important; }',
      '.us-switch input:checked + .us-slider::after { transform: translateX(20px) !important; }',

      /* Rules list */
      '#us-cc-panel .us-p-rules {',
      '  flex: 1 !important; overflow-y: auto !important; padding: 8px 16px !important;',
      '}',
      '#us-cc-panel .us-p-rules::-webkit-scrollbar { width: 3px !important; }',
      '#us-cc-panel .us-p-rules::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12) !important; border-radius: 3px !important; }',
      '#us-cc-panel .us-p-empty {',
      '  all: initial !important; display: block !important; font-family: inherit !important;',
      '  text-align: center !important; color: rgba(255,255,255,0.3) !important;',
      '  font-size: 12px !important; padding: 32px 16px !important;',
      '}',
      '#us-cc-panel .us-rule-item {',
      '  display: flex !important; align-items: center !important; gap: 8px !important;',
      '  padding: 8px 10px !important; margin-bottom: 4px !important;',
      '  background: rgba(255,255,255,0.04) !important; border: 1px solid rgba(255,255,255,0.06) !important;',
      '  border-radius: 8px !important; transition: background 0.15s !important;',
      '}',
      '#us-cc-panel .us-rule-item:hover { background: rgba(255,255,255,0.07) !important; }',
      '#us-cc-panel .us-rule-swatch {',
      '  all: initial !important; width: 18px !important; height: 18px !important;',
      '  border-radius: 4px !important; border: 1px solid rgba(255,255,255,0.15) !important;',
      '  flex-shrink: 0 !important;',
      '}',
      '#us-cc-panel .us-rule-info {',
      '  flex: 1 !important; overflow: hidden !important; min-width: 0 !important;',
      '}',
      '#us-cc-panel .us-rule-selector {',
      '  all: initial !important; display: block !important; font-family: "SF Mono","Menlo",monospace !important;',
      '  font-size: 10px !important; color: rgba(255,255,255,0.5) !important;',
      '  white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;',
      '}',
      '#us-cc-panel .us-rule-prop {',
      '  all: initial !important; display: block !important; font-family: inherit !important;',
      '  font-size: 11px !important; color: rgba(255,255,255,0.7) !important;',
      '}',
      '#us-cc-panel .us-rule-del {',
      '  all: initial !important; cursor: pointer !important; color: rgba(255,255,255,0.25) !important;',
      '  font-size: 14px !important; width: 22px !important; height: 22px !important;',
      '  display: flex !important; align-items: center !important; justify-content: center !important;',
      '  border-radius: 4px !important; flex-shrink: 0 !important;',
      '  transition: background 0.15s, color 0.15s !important;',
      '}',
      '#us-cc-panel .us-rule-del:hover { background: rgba(255,69,58,0.15) !important; color: #ff453a !important; }',

      /* Panel footer */
      '#us-cc-panel .us-p-footer {',
      '  padding: 12px 16px !important; border-top: 1px solid rgba(255,255,255,0.06) !important;',
      '  flex-shrink: 0 !important;',
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

      /* ── Color Popover ── */
      '#us-cc-popover {',
      '  all: initial !important; position: fixed !important;',
      '  z-index: 2147483647 !important;',
      '  background: rgba(38,38,40,0.96) !important;',
      '  backdrop-filter: blur(16px) !important; -webkit-backdrop-filter: blur(16px) !important;',
      '  border: 1px solid rgba(255,255,255,0.1) !important;',
      '  border-radius: 12px !important; padding: 14px !important;',
      '  width: 240px !important;',
      '  color: rgba(255,255,255,0.9) !important;',
      '  font-family: system-ui, -apple-system, sans-serif !important;',
      '  font-size: 12px !important;',
      '  box-shadow: 0 12px 40px rgba(0,0,0,0.5) !important;',
      '  display: none !important;',
      '}',
      '#us-cc-popover.us-visible { display: block !important; }',
      '#us-cc-popover .us-pop-label {',
      '  all: initial !important; display: block !important; font-family: inherit !important;',
      '  font-size: 10px !important; font-weight: 600 !important; text-transform: uppercase !important;',
      '  letter-spacing: 0.5px !important; color: rgba(255,255,255,0.4) !important;',
      '  margin-bottom: 6px !important;',
      '}',
      '#us-cc-popover .us-pop-selector-text {',
      '  all: initial !important; display: block !important;',
      '  font-family: "SF Mono","Menlo",monospace !important; font-size: 10px !important;',
      '  color: rgba(255,255,255,0.45) !important; margin-bottom: 10px !important;',
      '  white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;',
      '}',
      '#us-cc-popover select {',
      '  all: initial !important; display: block !important; width: 100% !important;',
      '  padding: 6px 10px !important;',
      '  background: rgba(255,255,255,0.06) !important; border: 1px solid rgba(255,255,255,0.1) !important;',
      '  border-radius: 6px !important; color: rgba(255,255,255,0.9) !important;',
      '  font-family: inherit !important; font-size: 12px !important;',
      '  outline: none !important; cursor: pointer !important;',
      '  margin-bottom: 10px !important;',
      '}',
      '#us-cc-popover select option { background: #2c2c2e !important; color: #fff !important; }',
      '#us-cc-popover .us-pop-color-row {',
      '  display: flex !important; align-items: center !important; gap: 8px !important; margin-bottom: 12px !important;',
      '}',
      '#us-cc-popover input[type="color"] {',
      '  all: initial !important; width: 36px !important; height: 36px !important;',
      '  border: 2px solid rgba(255,255,255,0.12) !important; border-radius: 8px !important;',
      '  cursor: pointer !important; background: transparent !important; flex-shrink: 0 !important;',
      '}',
      '#us-cc-popover input[type="text"] {',
      '  all: initial !important; flex: 1 !important;',
      '  padding: 6px 8px !important;',
      '  font-family: "SF Mono","Menlo",monospace !important; font-size: 12px !important;',
      '  color: rgba(255,255,255,0.8) !important;',
      '  background: rgba(0,0,0,0.2) !important; border: 1px solid rgba(255,255,255,0.08) !important;',
      '  border-radius: 6px !important; outline: none !important;',
      '}',
      '#us-cc-popover input[type="text"]:focus { border-color: rgba(100,160,255,0.4) !important; }',
      '#us-cc-popover .us-pop-actions {',
      '  display: flex !important; gap: 8px !important; justify-content: flex-end !important;',
      '}',
      '#us-cc-popover .us-pop-btn {',
      '  all: initial !important; display: inline-flex !important; align-items: center !important; justify-content: center !important;',
      '  padding: 6px 14px !important; font-family: inherit !important; font-size: 11px !important; font-weight: 500 !important;',
      '  border-radius: 6px !important; cursor: pointer !important; transition: filter 0.15s !important;',
      '}',
      '#us-cc-popover .us-pop-btn-cancel {',
      '  background: rgba(255,255,255,0.08) !important; color: rgba(255,255,255,0.6) !important;',
      '  border: 1px solid rgba(255,255,255,0.08) !important;',
      '}',
      '#us-cc-popover .us-pop-btn-apply {',
      '  background: rgba(59,130,246,0.2) !important; color: #60a5fa !important;',
      '  border: 1px solid rgba(59,130,246,0.25) !important;',
      '}',
      '#us-cc-popover .us-pop-btn-apply:hover { background: rgba(59,130,246,0.3) !important; }',
    ].join('\n');
  }
};

// =========================
// 7. EditMode
// =========================
var EditMode = {
  active: false,
  _highlighted: null,
  _boundHover: null,
  _boundClick: null,

  enable: function () {
    if (this.active) return;
    this.active = true;
    var self = this;
    this._boundHover = function (e) { self._onHover(e); };
    this._boundClick = function (e) { self._onClick(e); };
    document.addEventListener('mouseover', this._boundHover, true);
    document.addEventListener('mouseout', function (e) { self._clearHighlight(); }, true);
    document.addEventListener('click', this._boundClick, true);
  },

  disable: function () {
    if (!this.active) return;
    this.active = false;
    this._clearHighlight();
    document.removeEventListener('mouseover', this._boundHover, true);
    document.removeEventListener('click', this._boundClick, true);
    this._boundHover = null;
    this._boundClick = null;
  },

  _isOurUI: function (el) {
    // Don't interact with our own UI elements
    return !!(el && el.closest && el.closest('[data-us-cc]'));
  },

  _onHover: function (e) {
    if (!this.active) return;
    var el = e.target;
    if (this._isOurUI(el)) { this._clearHighlight(); return; }
    if (el === this._highlighted) return;
    this._clearHighlight();
    el.classList.add('us-cc-highlight');
    this._highlighted = el;
  },

  _onClick: function (e) {
    if (!this.active) return;
    var el = e.target;
    if (this._isOurUI(el)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    this._clearHighlight();
    console.log('[ColorCustomizer] Element clicked:', el.tagName, el.className);
    try {
      ColorPopover.show(el);
    } catch (err) {
      console.error('[ColorCustomizer] Popover show failed:', err);
    }
  },

  _clearHighlight: function () {
    if (this._highlighted) {
      this._highlighted.classList.remove('us-cc-highlight');
      this._highlighted = null;
    }
  }
};

// =========================
// 8. ColorPopover
// =========================
var ColorPopover = {
  el: null,
  _currentTarget: null,
  _originalValue: null,

  _create: function () {
    if (this.el) return;
    console.log('[ColorCustomizer] Creating popover DOM');
    var pop = h('div', { id: 'us-cc-popover', 'data-us-cc': 'popover' },
      h('span.us-pop-label', '要素'),
      h('span.us-pop-selector-text', { id: 'us-pop-sel' }),
      h('span.us-pop-label', 'プロパティ'),
      h('select', { id: 'us-pop-prop' },
        h('option', { value: 'background-color' }, 'background-color'),
        h('option', { value: 'color' }, 'color'),
        h('option', { value: 'border-color' }, 'border-color')
      ),
      h('span.us-pop-label', 'カラー'),
      h('div.us-pop-color-row',
        h('input', { type: 'color', id: 'us-pop-color', value: '#3b82f6' }),
        h('input', { type: 'text', id: 'us-pop-hex', placeholder: '#000000' })
      ),
      h('div.us-pop-actions',
        h('button.us-pop-btn.us-pop-btn-cancel', { id: 'us-pop-cancel' }, '取消'),
        h('button.us-pop-btn.us-pop-btn-apply', { id: 'us-pop-apply' }, '適用')
      )
    );
    document.body.appendChild(pop);
    this.el = pop;
    this._bindEvents();
    console.log('[ColorCustomizer] Popover DOM created and appended');
  },

  _bindEvents: function () {
    var self = this;
    var colorInput = this.el.querySelector('#us-pop-color');
    var hexInput = this.el.querySelector('#us-pop-hex');
    var propSelect = this.el.querySelector('#us-pop-prop');

    colorInput.addEventListener('input', function () {
      hexInput.value = this.value;
      self._preview();
    });

    hexInput.addEventListener('input', function () {
      if (/^#[0-9a-fA-F]{6}$/.test(this.value)) {
        colorInput.value = this.value;
      }
      self._preview();
    });

    propSelect.addEventListener('change', function () {
      // Read current value from element for this property
      if (self._currentTarget) {
        var current = getComputedStyle(self._currentTarget).getPropertyValue(this.value);
        self._setColorInputs(self._rgbToHex(current));
      }
    });

    this.el.querySelector('#us-pop-cancel').addEventListener('click', function () {
      self.hide();
    });

    this.el.querySelector('#us-pop-apply').addEventListener('click', function () {
      self._apply();
    });
  },

  show: function (el) {
    this._create();
    this._currentTarget = el;

    // Selector
    var selector = SelectorEngine.generate(el);
    this.el.querySelector('#us-pop-sel').textContent = selector;
    this.el.querySelector('#us-pop-sel').title = selector;

    // Read current computed color for default property
    var propSelect = this.el.querySelector('#us-pop-prop');
    var prop = propSelect.value;
    var computed = getComputedStyle(el).getPropertyValue(prop);
    this._setColorInputs(this._rgbToHex(computed));
    this._originalValue = computed;

    // Position near element — use setProperty with !important
    // because #us-cc-popover has 'all: initial !important'
    var rect = el.getBoundingClientRect();
    var popW = 240;
    var popH = 220;
    var left = Math.min(rect.left, window.innerWidth - popW - 16);
    var top = rect.bottom + 8;
    if (top + popH > window.innerHeight) {
      top = Math.max(8, rect.top - popH - 8);
    }
    left = Math.max(8, left);

    this.el.style.setProperty('left', left + 'px', 'important');
    this.el.style.setProperty('top', top + 'px', 'important');
    this.el.classList.add('us-visible');
    console.log('[ColorCustomizer] Popover shown at', left, top);
  },

  hide: function () {
    if (this.el) {
      this.el.classList.remove('us-visible');
    }
    this._currentTarget = null;
  },

  _preview: function () {
    if (!this._currentTarget) return;
    var prop = this.el.querySelector('#us-pop-prop').value;
    var val = this.el.querySelector('#us-pop-hex').value || this.el.querySelector('#us-pop-color').value;
    if (val) StyleApplier.previewOne(this._currentTarget, prop, val);
  },

  async _apply() {
    if (!this._currentTarget) return;
    var prop = this.el.querySelector('#us-pop-prop').value;
    var val = this.el.querySelector('#us-pop-hex').value || this.el.querySelector('#us-pop-color').value;
    var selector = SelectorEngine.generate(this._currentTarget);

    if (val && selector) {
      await RulesManager.addRule(selector, prop, val, 'inline');
      StyleApplier.previewOne(this._currentTarget, prop, val);
      Panel.refreshRules();
    }
    this.hide();
  },

  _setColorInputs: function (hex) {
    hex = hex || '#000000';
    this.el.querySelector('#us-pop-color').value = hex;
    this.el.querySelector('#us-pop-hex').value = hex;
  },

  _rgbToHex: function (rgb) {
    if (!rgb) return '#000000';
    if (rgb.charAt(0) === '#') return rgb;
    var m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!m) return '#000000';
    return '#' + [m[1], m[2], m[3]].map(function (x) {
      return parseInt(x, 10).toString(16).padStart(2, '0');
    }).join('');
  }
};

// =========================
// 9. Panel
// =========================
var Panel = {
  el: null,
  backdrop: null,
  _open: false,

  _create: function () {
    if (this.el) return;

    // Backdrop
    var bd = h('div', { id: 'us-cc-backdrop', 'data-us-cc': 'backdrop', onclick: function () { Panel.close(); } });
    document.body.appendChild(bd);
    this.backdrop = bd;

    // Switch label
    var switchLabel = document.createElement('label');
    switchLabel.className = 'us-switch';
    switchLabel.setAttribute('data-us-cc', 'switch');
    switchLabel.appendChild(h('input', { type: 'checkbox', id: 'us-p-edit-toggle' }));
    switchLabel.appendChild(h('span.us-slider'));

    // Panel
    var p = h('div', { id: 'us-cc-panel', 'data-us-cc': 'panel' },
      h('div.us-p-header',
        h('span.us-p-title', 'Color Customizer'),
        h('button.us-p-close', { id: 'us-p-close' }, '\u00D7')
      ),
      h('div.us-p-toggle-row',
        h('span.us-p-toggle-label', 'Edit Mode'),
        switchLabel
      ),
      h('div.us-p-rules', { id: 'us-p-rules' }),
      h('div.us-p-footer',
        h('button.us-btn.us-btn-danger', { id: 'us-p-clear' }, '全ルールクリア')
      )
    );
    document.body.appendChild(p);
    this.el = p;
    this._bindEvents();
  },

  _bindEvents: function () {
    var self = this;

    this.el.querySelector('#us-p-close').addEventListener('click', function () {
      self.close();
    });

    this.el.querySelector('#us-p-edit-toggle').addEventListener('change', function () {
      if (this.checked) {
        EditMode.enable();
        self.close();
      } else {
        EditMode.disable();
      }
    });

    this.el.querySelector('#us-p-clear').addEventListener('click', function () {
      RulesManager.clearRules().then(function () {
        StyleApplier.clearAll();
        self.refreshRules();
      });
    });

    // Delegate: delete rule
    this.el.querySelector('#us-p-rules').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-rule-idx]');
      if (!btn) return;
      var idx = parseInt(btn.getAttribute('data-rule-idx'), 10);
      RulesManager.removeRule(idx).then(function () {
        StyleApplier.clearAll();
        StyleApplier.applyAll(RulesManager.getRules());
        self.refreshRules();
      });
    });

    // Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (ColorPopover.el && ColorPopover.el.classList.contains('us-visible')) {
          ColorPopover.hide();
        } else if (self._open) {
          self.close();
        }
      }
    });
  },

  open: function () {
    this._create();
    this.refreshRules();
    // Sync toggle state
    this.el.querySelector('#us-p-edit-toggle').checked = EditMode.active;

    this.backdrop.style.display = 'block';
    void this.backdrop.offsetWidth;
    this.backdrop.classList.add('us-visible');
    this.el.classList.add('us-open');
    this._open = true;
  },

  close: function () {
    if (this.el) this.el.classList.remove('us-open');
    if (this.backdrop) this.backdrop.classList.remove('us-visible');
    setTimeout(function () {
      if (Panel.backdrop && !Panel._open) Panel.backdrop.style.display = 'none';
    }, 250);
    this._open = false;
  },

  refreshRules: function () {
    if (!this.el) return;
    var container = this.el.querySelector('#us-p-rules');
    var rules = RulesManager.getRules();

    // Clear previous content
    while (container.firstChild) container.removeChild(container.firstChild);

    if (rules.length === 0) {
      container.appendChild(h('span.us-p-empty', 'ルールがありません'));
      return;
    }

    rules.forEach(function (r, i) {
      var shortSel = r.selector.length > 28 ? '…' + r.selector.slice(-26) : r.selector;
      container.appendChild(
        h('div.us-rule-item',
          h('span.us-rule-swatch', { style: 'background:' + r.value + ' !important' }),
          h('span.us-rule-info',
            h('span.us-rule-selector', { title: r.selector }, shortSel),
            h('span.us-rule-prop', r.property)
          ),
          h('button.us-rule-del', { 'data-rule-idx': String(i), title: '削除' }, '✕')
        )
      );
    });
  }
};

// =========================
// 10. Tab
// =========================
var Tab = {
  el: null,

  create: function () {
    if (this.el) return;
    Styles.inject();

    // Build SVG icon via namespace-aware API
    var svg = makeSvg('svg', { viewBox: '0 0 16 16' },
      makeSvg('rect', { x: '1', y: '1', width: '6', height: '6', rx: '1', fill: '#60a5fa' }),
      makeSvg('rect', { x: '9', y: '1', width: '6', height: '6', rx: '1', fill: '#f97316' }),
      makeSvg('rect', { x: '1', y: '9', width: '6', height: '6', rx: '1', fill: '#a78bfa' }),
      makeSvg('rect', { x: '9', y: '9', width: '6', height: '6', rx: '1', fill: '#34d399' })
    );

    var tab = h('div', { id: 'us-cc-tab', 'data-us-cc': 'tab', title: 'Color Customizer', onclick: function () { Panel.open(); } },
      svg
    );
    document.body.appendChild(tab);
    this.el = tab;
  }
};

// =========================
// 11. Feature Interface + Global API
// =========================
var ColorCustomizerFeature = {
  _initialized: false,

  async init() {
    if (this._initialized) return true;
    try {
      await RPC.init();
      await RulesManager.load();
      StyleApplier.applyAll(RulesManager.getRules());
      Tab.create();
      this._initialized = true;
      console.log('[ColorCustomizer] Initialized – ' + RulesManager.getRules().length + ' rule(s) for ' + window.location.hostname);
      return true;
    } catch (e) {
      console.error('[ColorCustomizer] Init failed:', e);
      return false;
    }
  },

  enable: function () {
    EditMode.enable();
  },

  disable: function () {
    EditMode.disable();
  }
};

// Global API
window.UserScripts = window.UserScripts || {};
window.UserScripts.version = US_VERSION;
window.UserScripts.init = function () { console.log('[UserScripts] Core initialized'); };
window.UserScripts.features = window.UserScripts.features || {};
window.UserScripts.features.colorCustomizer = ColorCustomizerFeature;

// RPC is also exposed for extensibility
window.US = window.US || {};
window.US.rpc = RPC;

// =========================
// Auto-initialize
// =========================
(async function () {
  try {
    await ColorCustomizerFeature.init();
    console.log('[UserScripts] Auto-init complete');
  } catch (e) {
    console.error('[UserScripts] Auto-init failed:', e);
  }
})();

// ESM export (keeps module semantics for jsDelivr)
export { };
