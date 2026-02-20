/**
 * UserScript – Element-based Color Customizer (Phase 1)
 *
 * Lets users click individual page elements and change their colors.
 * Rules are persisted per-site via GM_* RPC and auto-applied on revisit.
 */
(function () {
  if (window.location.hostname === '127.0.0.1') return;

var US_VERSION = '1.6.69';
console.log('%c[UserScripts] script.js loaded – v' + US_VERSION + ' %c' + new Date().toLocaleTimeString(), 'color:#60a5fa;font-weight:bold', 'color:#888');

// =========================
// 1. RPC Client (module)
// =========================
var RPC = (function () {
  'use strict';
  var REQ_FLAG = '__US_RPC__';
  var REP_FLAG = '__US_RPC_REPLY__';
  var DOC_EVENT_REQUEST = 'us-rpc-request';
  var DOC_EVENT_REPLY = 'us-rpc-reply';

  function makeId() {
    return 'rpc_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
  }

  function sendRequest(req) {
    window.postMessage(req, '*');
    try {
      document.dispatchEvent(new CustomEvent(DOC_EVENT_REQUEST, { detail: req }));
    } catch (e) { }
  }

  function oneRpc(id, req, timeoutMs, methodLabel) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error('RPC timeout: ' + methodLabel));
      }, timeoutMs);

      function onReply(d) {
        if (!d || d[REP_FLAG] !== true || d.id !== id) return;
        if (done) return;
        done = true;
        cleanup();
        if (d.ok) resolve(d.result);
        else reject(new Error(d.error || ('RPC error: ' + methodLabel)));
      }

      function onMessage(ev) {
        if (ev.source !== window && ev.source !== window.top) return;
        onReply(ev.data);
      }

      function onDocReply(ev) {
        onReply(ev.detail);
      }

      function cleanup() {
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        document.removeEventListener(DOC_EVENT_REPLY, onDocReply);
      }

      window.addEventListener('message', onMessage);
      document.addEventListener(DOC_EVENT_REPLY, onDocReply);
      sendRequest(req);
    });
  }

  function rpcCall(token, method, params, timeoutMs) {
    timeoutMs = typeof timeoutMs === 'number' ? timeoutMs : 15000;
    var id = makeId();
    var req = { [REQ_FLAG]: true, id: id, token: token, method: method, params: params || [] };
    return oneRpc(id, req, timeoutMs, method);
  }

  function handshake() {
    var id = makeId();
    var req = { [REQ_FLAG]: true, id: id, token: '', method: 'core.handshake', params: [] };
    return oneRpc(id, req, 8000, 'core.handshake');
  }

  return {
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
})();

// =========================
// 2. SelectorEngine (module)
// =========================
var SelectorEngine = (function () {
  'use strict';
  return {
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
})();

// =========================
// 3. RulesManager (module)
// =========================
var RulesManager = (function () {
  'use strict';
  var RPC_REF = RPC;
  return {
    _storagePrefix: 'userscripts:features:colorCustomizer:page:',
    _pageKey: window.location.hostname + window.location.pathname,
    _rules: [],
    _key: function () {
      return this._storagePrefix + encodeURIComponent(this._pageKey);
    },
    async load() {
      try {
        console.log('[ColorCustomizer] Loading rules for:', this._pageKey);
        var data = await RPC_REF.call('storage.get', [this._key(), null]);
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
          console.error('[ColorCustomizer] Failed to save imported rules:', e);
          throw new Error('ルールの保存に失敗しました: ' + (e && e.message ? e.message : e));
        }
      }
      return count;
    },
    async save() {
      try {
        console.log('[ColorCustomizer] Saving rules for:', this._pageKey);
        await RPC_REF.call('storage.set', [this._key(), {
          origin: this._pageKey,
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
    async deleteRule(selector, property) {
      var idx = this._rules.findIndex(function (r) { return r.selector === selector && r.property === property; });
      if (idx >= 0) {
        this._rules.splice(idx, 1);
        await this.save();
      }
    },
    async clearRules() {
      this._rules = [];
      await this.save();
    }
  };
})();

// =========================
// 4b. ProfileManager (module)
// =========================
var ProfileManager = (function () {
  'use strict';
  var RPC_REF = RPC;
  return {
    _storageKey: 'userscripts:features:colorCustomizer:profiles',
    _profiles: [],
    async load() {
      try {
        var data = await RPC_REF.call('storage.get', [this._storageKey, null]);
        this._profiles = (data && Array.isArray(data)) ? data : [];
      } catch (e) {
        console.warn('[ColorCustomizer] Failed to load profiles:', e);
        this._profiles = [];
      }
      return this._profiles;
    },
    async save() {
      try {
        await RPC_REF.call('storage.set', [this._storageKey, this._profiles]);
      } catch (e) {
        console.error('[ColorCustomizer] Failed to save profiles:', e);
      }
    },
    getProfiles: function () { return this._profiles.slice(); },
    async importProfiles(profiles) {
      if (!Array.isArray(profiles)) return 0;
      var self = this;
      var count = 0;
      profiles.forEach(function (p) {
        if (!p.name || !Array.isArray(p.colors)) return;
        var existing = p.id ? self._profiles.find(function (x) { return x.id === p.id; }) : null;
        if (existing) {
          existing.name = p.name;
          existing.colors = p.colors;
        } else {
          var duplicate = self._profiles.some(function (x) {
            return x.name === p.name && JSON.stringify(x.colors) === JSON.stringify(p.colors);
          });
          if (duplicate) return;
          var profile = {
            id: p.id || ('prof_' + Math.random().toString(36).slice(2, 10)),
            name: p.name,
            colors: p.colors
          };
          self._profiles.push(profile);
        }
        count++;
      });
      if (count > 0) await self.save();
      console.log('[ColorCustomizer] Imported ' + count + ' profiles');
      return count;
    },
    async addProfile(name, colors) {
      var profile = {
        id: 'prof_' + Math.random().toString(36).slice(2, 10),
        name: name || 'Untitled',
        colors: colors || [{ value: '#3b82f6', name: '' }]
      };
      this._profiles.push(profile);
      await this.save();
      return profile;
    },
    async updateProfile(id, name, colors) {
      var p = this._profiles.find(function (x) { return x.id === id; });
      if (!p) return null;
      p.name = name;
      p.colors = colors;
      await this.save();
      return p;
    },
    async deleteProfile(id) {
      this._profiles = this._profiles.filter(function (x) { return x.id !== id; });
      await this.save();
    }
  };
})();

// =========================
// 5. StyleApplier (module)
// =========================
var StyleApplier = (function () {
  'use strict';
  var SelectorEngineRef = SelectorEngine;
  return {
    _applied: [],
    applyAll: function (rules) {
      var self = this;
      self.clearAll();
      rules.forEach(function (rule) {
        if (rule.mode !== 'inline') return;
        self.applyOne(rule);
      });
    },
    applyOne: function (rule) {
      var el = SelectorEngineRef.find(rule.selector);
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
        } catch (e) { }
      });
      this._applied = [];
    },
    previewOne: function (el, property, value) {
      if (value) {
        el.style.setProperty(property, value, 'important');
      } else {
        el.style.removeProperty(property);
      }
    },
    removeRuleFromPage: function (selector, property) {
      var elements = SelectorEngineRef.findAll(selector);
      elements.forEach(function (el) {
        try {
          el.style.removeProperty(property);
        } catch (e) { }
      });
    }
  };
})();

// =========================
// 6. DOM helpers (module)
// =========================
var DomHelpers = (function () {
  'use strict';
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
  function createGearSvg() {
    // 8-tooth cog (filled), center hole via evenodd — familiar settings icon
    var gearPath = 'M12 1 L14.68 5.54 L19.78 4.22 L18.46 9.32 L23 12 L18.46 14.68 L19.78 19.78 L14.68 18.46 L12 23 L5.32 18.46 L4.22 19.78 L5.54 14.68 L1 12 L5.54 9.32 L4.22 4.22 L5.32 5.54 Z M12 9 a3 3 0 1 0 0 6 a3 3 0 1 0 0-6 z';
    var path = makeSvg('path', { 'fill-rule': 'evenodd', fill: 'currentColor', d: gearPath });
    var svg = makeSvg('svg', { viewBox: '0 0 24 24' }, path);
    svg.setAttribute('aria-hidden', 'true');
    return svg;
  }
  return { h: h, makeSvg: makeSvg, createGearSvg: createGearSvg };
})();
var h = DomHelpers.h;
var makeSvg = DomHelpers.makeSvg;
var createGearSvg = DomHelpers.createGearSvg;

// =========================
// 7. CSS Injection / Styles (module)
// =========================
var Styles = (function () {
  'use strict';
  return {
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
      '  display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; gap: 10px !important;',
      '  transition: width 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease !important;',
      '}',
      '#us-cc-tab:hover { width: 62px !important; background: rgba(255,255,255,0.16) !important; }',
      '#us-cc-tab .us-cc-tab-icon {',
      '  flex-shrink: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important;',
      '  cursor: pointer !important; padding: 6px 0 !important; overflow: visible !important;',
      '}',
      '#us-cc-tab .us-cc-tab-gear {',
      '  display: inline-flex !important; align-items: center !important; justify-content: center !important;',
      '  width: 38px !important; height: 38px !important; color: rgba(0,0,0,0.55) !important;',
      '}',
      '#us-cc-tab .us-cc-tab-gear svg { width: 100% !important; height: 100% !important; }',
      '#us-cc-tab .us-cc-tab-icon:hover .us-cc-tab-gear { color: rgba(0,0,0,0.75) !important; }',
      '#us-cc-tab.us-tab-active .us-cc-tab-gear { color: rgba(0,0,0,0.55) !important; }',
      '#us-cc-tab.us-tab-active {',
      '  border-color: rgba(59,130,246,0.4) !important;',
      '  background: rgba(255,255,255,0.18) !important;',
      '  box-shadow: -4px 0 24px rgba(59,130,246,0.12), inset 0 1px 0 rgba(255,255,255,0.2) !important;',
      '}',
      '#us-cc-tab.us-tab-active .us-cc-tab-icon { color: rgba(0,0,0,0.55) !important; }',
      '.us-cc-tab-toggle-wrap {',
      '  flex-shrink: 0 !important; padding: 4px 0 !important; overflow: visible !important;',
      '  display: flex !important; align-items: center !important; justify-content: center !important;',
      '  transform: scale(0.8) !important; transform-origin: center center !important; }',

      /* ── Edit-mode highlight (未定義: 青 / 定義済み: 緑) ── */
      '.us-cc-highlight {',
      '  outline: 2px solid rgba(59,130,246,0.8) !important;',
      '  outline-offset: 1px !important;',
      '  cursor: crosshair !important;',
      '}',
      '.us-cc-highlight-defined {',
      '  outline: 2px solid rgba(34,197,94,0.85) !important;',
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

      /* Two-level panel: list screen + detail screen (iOS style) */
      '#us-cc-panel .us-p-screen {',
      '  display: none !important; flex-direction: column !important; flex: 1 !important; min-height: 0 !important;',
      '}',
      '#us-cc-panel .us-p-screen.us-p-screen-visible { display: flex !important; }',
      '#us-cc-panel .us-p-list-header {',
      '  display: flex !important; align-items: center !important; gap: 10px !important;',
      '  padding: 14px 16px 12px !important; border-bottom: 1px solid rgba(0,0,0,0.06) !important; flex-shrink: 0 !important;',
      '}',
      '#us-cc-panel .us-p-list-header .us-p-list-header-gear {',
      '  display: inline-flex !important; align-items: center !important; flex-shrink: 0 !important;',
      '  width: 24px !important; height: 24px !important; color: rgba(0,0,0,0.5) !important;',
      '}',
      '#us-cc-panel .us-p-list-header .us-p-list-header-gear svg { width: 100% !important; height: 100% !important; }',
      '#us-cc-panel .us-p-list-header .us-p-title { font-size: 17px !important; font-weight: 600 !important; }',
      '#us-cc-panel .us-p-feature-list { flex: 1 !important; overflow-y: auto !important; padding: 8px 0 !important; }',
      '#us-cc-panel .us-p-feature-row {',
      '  display: flex !important; align-items: center !important; min-height: 44px !important; padding: 0 16px !important;',
      '  background: rgba(255,255,255,0.5) !important; border: none !important; border-bottom: 1px solid rgba(0,0,0,0.06) !important;',
      '  cursor: pointer !important; font-family: inherit !important; font-size: 16px !important; color: rgba(0,0,0,0.88) !important;',
      '  text-align: left !important; width: 100% !important; transition: background 0.15s !important;',
      '}',
      '#us-cc-panel .us-p-feature-row:hover { background: rgba(0,0,0,0.04) !important; }',
      '#us-cc-panel .us-p-feature-row:active { background: rgba(0,0,0,0.08) !important; }',
      '#us-cc-panel .us-p-feature-row .us-p-feature-icon {',
      '  flex-shrink: 0 !important; display: flex !important; flex-direction: column !important; align-items: center !important; gap: 2px !important;',
      '  font-size: 10px !important; font-weight: 600 !important; color: rgba(0,0,0,0.55) !important; margin-right: 12px !important;',
      '}',
      '#us-cc-panel .us-p-feature-row .us-p-feature-icon-swatch {',
      '  display: block !important; width: 24px !important; height: 3px !important; border-radius: 2px !important;',
      '  background: linear-gradient(to right, #f44336 0%, #e91e63 12.5%, #9c27b0 25%, #2196f3 37.5%, #00bcd4 50%, #4caf50 62.5%, #ffeb3b 75%, #ff9800 87.5%, #f44336 100%) !important;',
      '}',
      '#us-cc-panel .us-p-feature-row .us-p-feature-label { flex: 1 !important; min-width: 0 !important; }',
      '#us-cc-panel .us-p-feature-row .us-p-feature-label .us-title-editor { font-weight: 700 !important; }',
      '#us-cc-panel .us-p-feature-row .us-p-feature-right {',
      '  display: flex !important; align-items: center !important; gap: 6px !important; flex-shrink: 0 !important;',
      '}',
      '#us-cc-panel .us-p-feature-row .us-p-feature-chevron {',
      '  color: rgba(0,0,0,0.35) !important; font-size: 14px !important; line-height: 1 !important; display: flex !important; align-items: center !important;',
      '}',
      '#us-cc-panel .us-p-nav-back {',
      '  all: initial !important; display: flex !important; align-items: center !important; gap: 4px !important;',
      '  padding: 8px 0 !important; margin: 0 -4px 0 0 !important; cursor: pointer !important;',
      '  font-family: inherit !important; font-size: 17px !important; color: rgba(59,130,246,0.95) !important;',
      '  background: none !important; border: none !important; flex-shrink: 0 !important;',
      '}',
      '#us-cc-panel .us-p-nav-back:hover { opacity: 0.85 !important; }',
      '#us-cc-panel .us-p-detail-header {',
      '  display: flex !important; flex-direction: column !important; gap: 0 !important; padding: 0 !important; border-bottom: 1px solid rgba(0,0,0,0.06) !important; flex-shrink: 0 !important;',
      '}',
      '#us-cc-panel .us-p-detail-header-row {',
      '  display: flex !important; align-items: center !important; gap: 8px !important; padding: 10px 16px !important; min-height: 0 !important;',
      '}',
      '#us-cc-panel .us-p-detail-header-row:first-child { padding-bottom: 6px !important; }',
      '#us-cc-panel .us-p-detail-header-row:last-child { padding-top: 0 !important; padding-bottom: 12px !important; border-top: 1px solid rgba(0,0,0,0.06) !important; }',
      '#us-cc-panel .us-p-detail-header .us-p-detail-icon {',
      '  flex-shrink: 0 !important; display: flex !important; flex-direction: column !important; align-items: center !important; gap: 2px !important;',
      '  font-size: 10px !important; font-weight: 600 !important; color: rgba(0,0,0,0.55) !important; margin-right: 4px !important;',
      '}',
      '#us-cc-panel .us-p-detail-header .us-p-detail-icon-swatch {',
      '  display: block !important; width: 24px !important; height: 3px !important; border-radius: 2px !important;',
      '  background: linear-gradient(to right, #f44336 0%, #e91e63 12.5%, #9c27b0 25%, #2196f3 37.5%, #00bcd4 50%, #4caf50 62.5%, #ffeb3b 75%, #ff9800 87.5%, #f44336 100%) !important;',
      '}',
      '#us-cc-panel .us-p-detail-header .us-p-title { font-size: 15px !important; flex: 1 !important; min-width: 0 !important; }',
      '#us-cc-panel .us-p-detail-header .us-p-version { margin-right: 4px !important; }',

      /* Rules list tabs */
      '#us-cc-panel .us-p-tabs {',
      '  display: flex !important; gap: 2px !important; padding: 8px 16px 6px !important; flex-shrink: 0 !important;',
      '  border-bottom: 1px solid rgba(0,0,0,0.06) !important;',
      '}',
      '#us-cc-panel .us-p-tab-btn {',
      '  all: initial !important; font-family: inherit !important; font-size: 12px !important;',
      '  padding: 6px 12px !important; border-radius: 6px !important; cursor: pointer !important;',
      '  color: rgba(0,0,0,0.55) !important; background: transparent !important;',
      '  transition: background 0.15s, color 0.15s !important;',
      '}',
      '#us-cc-panel .us-p-tab-btn:hover { color: rgba(0,0,0,0.75) !important; background: rgba(0,0,0,0.04) !important; }',
      '#us-cc-panel .us-p-tab-btn.active {',
      '  color: rgba(59,130,246,0.95) !important; font-weight: 600 !important;',
      '  background: rgba(59,130,246,0.1) !important;',
      '}',
      '/* このページに存在するルールの行: 控えめな枠線強調 */',
      '#us-cc-panel .us-rule-item.us-rule-item-exists {',
      '  border-color: rgba(59,130,246,0.35) !important;',
      '  box-shadow: 0 0 0 1px rgba(59,130,246,0.12) !important;',
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
      '#us-cc-panel .us-btn-secondary:hover { background: rgba(255,255,255,0.8) !important; color: rgba(0,0,0,0.85) !important; }',

      /* ── Color Popover (Liquid Glass) ── */
      '#us-cc-popover {',
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
      '#us-cc-popover.us-visible { display: block !important; }',
      '#us-cc-popover .us-pop-label {',
      '  all: initial !important; display: block !important; font-family: inherit !important;',
      '  font-size: 10px !important; font-weight: 600 !important; text-transform: uppercase !important;',
      '  letter-spacing: 0.5px !important; color: rgba(0,0,0,0.45) !important;',
      '  margin-bottom: 6px !important;',
      '}',
      '#us-cc-popover .us-pop-selector-text {',
      '  all: initial !important; display: block !important;',
      '  font-family: "SF Mono","Menlo",monospace !important; font-size: 10px !important;',
      '  color: rgba(0,0,0,0.5) !important; margin-bottom: 12px !important;',
      '  white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;',
      '}',

      /* ── Property rows: カラーチップ＋テキストのみ ── */
      '#us-cc-popover .us-pop-prop-row {',
      '  display: flex !important; flex-wrap: wrap !important; align-items: flex-start !important; gap: 0 !important;',
      '  margin-bottom: 10px !important; padding: 4px 0 !important;',
      '}',
      '#us-cc-popover .us-pop-prop-label {',
      '  all: initial !important; display: inline-block !important;',
      '  width: 56px !important; flex-shrink: 0 !important; padding-top: 6px !important;',
      '  font-family: inherit !important; font-size: 11px !important;',
      '  color: rgba(0,0,0,0.6) !important;',
      '}',
      '#us-cc-popover .us-pop-prop-row-main {',
      '  display: flex !important; align-items: center !important; gap: 8px !important; flex: 1 !important; min-width: 0 !important;',
      '}',
      '#us-cc-popover .us-pop-prop-row [data-role="preview-swatch"] {',
      '  display: inline-block !important; width: 28px !important; height: 28px !important; flex-shrink: 0 !important; cursor: pointer !important;',
      '  border: 1px solid rgba(0,0,0,0.12) !important; border-radius: 6px !important;',
      '  transition: transform 0.1s, box-shadow 0.15s !important;',
      '}',
      '#us-cc-popover .us-pop-prop-row [data-role="preview-swatch"]:hover {',
      '  transform: scale(1.08) !important; box-shadow: 0 0 8px rgba(0,0,0,0.15) !important;',
      '}',
      '#us-cc-popover .us-pop-prop-row [data-role="flexible"] {',
      '  all: initial !important; flex: 1 !important; min-width: 80px !important; text-align: center !important;',
      '  padding: 4px 6px !important;',
      '  font-family: "SF Mono","Menlo",monospace !important; font-size: 11px !important;',
      '  color: rgba(0,0,0,0.75) !important;',
      '  background: rgba(255,255,255,0.6) !important; border: 1px solid rgba(255,255,255,0.5) !important;',
      '  border-radius: 4px !important; outline: none !important;',
      '}',
      '#us-cc-popover .us-pop-prop-row input[type="text"]:focus { border-color: rgba(59,130,246,0.5) !important; }',

      /* ── Popover actions ── */
      '#us-cc-popover .us-pop-actions {',
      '  display: flex !important; gap: 8px !important; justify-content: flex-end !important;',
      '  margin-top: 10px !important;',
      '}',
      '#us-cc-popover .us-pop-btn {',
      '  all: initial !important; display: inline-flex !important; align-items: center !important; justify-content: center !important;',
      '  padding: 6px 14px !important; font-family: inherit !important; font-size: 11px !important; font-weight: 500 !important;',
      '  border-radius: 6px !important; cursor: pointer !important; transition: filter 0.15s !important;',
      '}',
      '#us-cc-popover .us-pop-btn-cancel {',
      '  background: rgba(255,255,255,0.6) !important; color: rgba(0,0,0,0.65) !important;',
      '  border: 1px solid rgba(255,255,255,0.5) !important;',
      '}',
      '#us-cc-popover .us-pop-btn-apply {',
      '  background: rgba(59,130,246,0.25) !important; color: #2563eb !important;',
      '  border: 1px solid rgba(59,130,246,0.35) !important;',
      '}',
      '#us-cc-popover .us-pop-btn-apply:hover { background: rgba(59,130,246,0.35) !important; }',

      /* ── カラーチップクリックで開くカラースウォッチ（Liquid Glass） ── */
      '#us-cc-chip-popover-backdrop {',
      '  all: initial !important; position: fixed !important; inset: 0 !important;',
      '  z-index: 2147483650 !important; pointer-events: none !important; display: none !important;',
      '}',
      '#us-cc-chip-popover-backdrop.us-visible { display: block !important; pointer-events: auto !important; }',
      '#us-cc-chip-popover {',
      '  all: initial !important; position: fixed !important;',
      '  z-index: 2147483651 !important;',
      '  background: rgba(255,255,255,0.2) !important;',
      '  backdrop-filter: blur(24px) saturate(160%) !important; -webkit-backdrop-filter: blur(24px) saturate(160%) !important;',
      '  border: 1px solid rgba(255,255,255,0.35) !important; border-radius: 10px !important;',
      '  padding: 10px !important; min-width: 180px !important; max-height: 200px !important; overflow: auto !important;',
      '  box-shadow: 0 8px 32px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.3) !important;',
      '  display: none !important;',
      '}',
      '#us-cc-chip-popover.us-visible { display: block !important; }',
      '#us-cc-chip-popover [data-role="picker"] {',
      '  all: initial !important; display: block !important; width: 100% !important; height: 36px !important;',
      '  border: 2px solid rgba(0,0,0,0.1) !important; border-radius: 6px !important;',
      '  cursor: pointer !important; background: transparent !important; margin-bottom: 8px !important;',
      '}',
      '#us-cc-chip-popover .us-chip-palette-section {',
      '  margin-top: 6px !important; margin-bottom: 6px !important;',
      '  border-top: 1px solid rgba(0,0,0,0.06) !important; padding-top: 6px !important;',
      '}',
      '#us-cc-chip-popover .us-chip-palette-section:first-of-type { border-top: none !important; margin-top: 0 !important; padding-top: 0 !important; }',
      '#us-cc-chip-popover .us-chip-palette-name {',
      '  all: initial !important; display: block !important; font-family: inherit !important;',
      '  font-size: 10px !important; color: rgba(0,0,0,0.5) !important; margin-bottom: 4px !important;',
      '}',
      '#us-cc-chip-popover .us-chip-palette-row {',
      '  display: flex !important; flex-wrap: wrap !important; gap: 4px !important;',
      '}',
      '#us-cc-chip-popover .us-chip-swatch {',
      '  all: initial !important; display: inline-block !important;',
      '  width: 22px !important; height: 22px !important;',
      '  border-radius: 4px !important; cursor: pointer !important;',
      '  border: 1px solid rgba(0,0,0,0.1) !important;',
      '  transition: transform 0.1s, box-shadow 0.15s !important;',
      '}',
      '#us-cc-chip-popover .us-chip-swatch:hover {',
      '  transform: scale(1.15) !important; box-shadow: 0 0 8px rgba(0,0,0,0.15) !important;',
      '}',

      /* ── Import result toast (Liquid Glass) ── */
      '#us-cc-import-toast-backdrop {',
      '  all: initial !important; position: fixed !important; inset: 0 !important;',
      '  z-index: 2147483648 !important;',
      '  background: rgba(0,0,0,0.2) !important;',
      '  backdrop-filter: blur(8px) !important; -webkit-backdrop-filter: blur(8px) !important;',
      '  display: none !important; opacity: 0 !important;',
      '  transition: opacity 0.2s ease !important;',
      '}',
      '#us-cc-import-toast-backdrop.us-visible { display: block !important; opacity: 1 !important; }',
      '#us-cc-import-toast-box {',
      '  all: initial !important; position: fixed !important; left: 50% !important; top: 50% !important;',
      '  transform: translate(-50%, -50%) !important; z-index: 2147483649 !important;',
      '  box-sizing: border-box !important;',
      '  background: rgba(255,255,255,0.22) !important;',
      '  backdrop-filter: blur(24px) saturate(160%) !important; -webkit-backdrop-filter: blur(24px) saturate(160%) !important;',
      '  border: 1px solid rgba(255,255,255,0.35) !important; border-radius: 12px !important;',
      '  padding: 20px !important; min-width: 260px !important; max-width: 90vw !important;',
      '  color: rgba(0,0,0,0.82) !important; font-family: system-ui, -apple-system, sans-serif !important;',
      '  font-size: 13px !important; line-height: 1.5 !important;',
      '  box-shadow: 0 12px 40px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3) !important;',
      '}',
      '#us-cc-import-toast-box .us-import-toast-title {',
      '  all: initial !important; display: block !important; font-family: inherit !important;',
      '  font-size: 14px !important; font-weight: 600 !important; color: rgba(0,0,0,0.9) !important;',
      '  margin-bottom: 10px !important;',
      '}',
      '#us-cc-import-toast-box .us-import-toast-body {',
      '  all: initial !important; display: block !important; font-family: inherit !important;',
      '  font-size: 12px !important; color: rgba(0,0,0,0.7) !important;',
      '  margin-bottom: 16px !important; white-space: pre-wrap !important; word-break: break-word !important;',
      '}',
      '#us-cc-import-toast-box.us-error .us-import-toast-title { color: #ff453a !important; }',
      '#us-cc-import-toast-box .us-import-toast-ok {',
      '  all: initial !important; box-sizing: border-box !important;',
      '  display: inline-flex !important; align-items: center !important; justify-content: center !important;',
      '  padding: 8px 20px !important; font-family: inherit !important; font-size: 12px !important; font-weight: 500 !important;',
      '  border-radius: 8px !important; cursor: pointer !important;',
      '  background: rgba(59,130,246,0.25) !important; color: #2563eb !important;',
      '  border: 1px solid rgba(59,130,246,0.35) !important; width: 100% !important;',
      '  transition: background 0.15s !important;',
      '}',
      '#us-cc-import-toast-box .us-import-toast-ok:hover { background: rgba(59,130,246,0.35) !important; }',

      /* ── Profile management (Panel, Liquid Glass) ── */
      '#us-cc-panel .us-p-section-title {',
      '  all: initial !important; display: flex !important; align-items: center !important;',
      '  justify-content: space-between !important; font-family: inherit !important;',
      '  font-size: 11px !important; font-weight: 600 !important;',
      '  text-transform: uppercase !important; letter-spacing: 0.5px !important;',
      '  color: rgba(0,0,0,0.5) !important;',
      '  padding: 10px 16px 6px !important;',
      '}',
      '#us-cc-panel .us-p-section-title button {',
      '  all: initial !important; cursor: pointer !important; font-family: inherit !important;',
      '  font-size: 16px !important; color: rgba(59,130,246,0.8) !important;',
      '  width: 22px !important; height: 22px !important; display: flex !important;',
      '  align-items: center !important; justify-content: center !important;',
      '  border-radius: 4px !important; transition: background 0.15s !important;',
      '}',
      '#us-cc-panel .us-p-section-title button:hover { background: rgba(59,130,246,0.12) !important; }',
      '#us-cc-panel .us-prof-list { padding: 0 12px 8px !important; }',
      '#us-cc-panel .us-prof-item {',
      '  display: flex !important; flex-direction: column !important; align-items: stretch !important; gap: 6px !important;',
      '  padding: 6px 8px !important; margin-bottom: 3px !important;',
      '  background: rgba(255,255,255,0.5) !important; border: 1px solid rgba(255,255,255,0.4) !important;',
      '  border-radius: 6px !important; cursor: default !important;',
      '}',
      '#us-cc-panel .us-prof-item:hover { background: rgba(255,255,255,0.65) !important; }',
      '#us-cc-panel .us-prof-item-head {',
      '  display: flex !important; align-items: center !important; gap: 8px !important; min-width: 0 !important;',
      '}',
      '#us-cc-panel .us-prof-swatches {',
      '  display: flex !important; gap: 2px !important; flex-wrap: wrap !important; min-width: 0 !important;',
      '}',
      '#us-cc-panel .us-prof-sw {',
      '  all: initial !important; width: 14px !important; height: 14px !important;',
      '  border-radius: 3px !important; border: 1px solid rgba(0,0,0,0.08) !important;',
      '}',
      '#us-cc-panel .us-prof-name {',
      '  all: initial !important; font-family: inherit !important;',
      '  font-size: 11px !important; color: rgba(0,0,0,0.72) !important;',
      '  white-space: nowrap !important; min-width: 0 !important; flex: 1 !important;',
      '  overflow: hidden !important; text-overflow: ellipsis !important;',
      '}',
      '#us-cc-panel .us-prof-actions { display: flex !important; gap: 2px !important; flex-shrink: 0 !important; }',
      '#us-cc-panel .us-prof-actions button {',
      '  all: initial !important; cursor: pointer !important; font-size: 11px !important;',
      '  color: rgba(0,0,0,0.4) !important; width: 20px !important; height: 20px !important;',
      '  display: flex !important; align-items: center !important; justify-content: center !important;',
      '  border-radius: 3px !important; transition: background 0.15s, color 0.15s !important;',
      '}',
      '#us-cc-panel .us-prof-actions button:hover { background: rgba(0,0,0,0.06) !important; color: rgba(0,0,0,0.7) !important; }',

      /* Profile editor inline form */
      '#us-cc-panel .us-prof-editor {',
      '  padding: 8px 12px !important;',
      '  border: 1px solid rgba(59,130,246,0.25) !important; border-radius: 8px !important;',
      '  margin: 4px 12px 8px !important; background: rgba(255,255,255,0.5) !important;',
      '}',
      '#us-cc-panel .us-prof-editor input[type="text"] {',
      '  all: initial !important; display: block !important; width: 100% !important;',
      '  padding: 5px 8px !important; margin-bottom: 8px !important;',
      '  font-family: inherit !important; font-size: 12px !important;',
      '  color: rgba(0,0,0,0.82) !important;',
      '  background: rgba(255,255,255,0.7) !important; border: 1px solid rgba(255,255,255,0.5) !important;',
      '  border-radius: 4px !important; outline: none !important;',
      '}',
      '#us-cc-panel .us-prof-editor input[type="text"]:focus { border-color: rgba(59,130,246,0.5) !important; }',
      '#us-cc-panel .us-prof-color-item {',
      '  display: flex !important; align-items: center !important; gap: 4px !important; margin-bottom: 4px !important;',
      '}',
      '#us-cc-panel .us-prof-color-swatch {',
      '  display: inline-block !important; width: 24px !important; height: 24px !important; cursor: pointer !important;',
      '  border: 1px solid rgba(0,0,0,0.1) !important; border-radius: 4px !important; flex-shrink: 0 !important;',
      '}',
      '#us-cc-panel .us-prof-color-swatch:hover { opacity: 0.9 !important; }',
      '#us-cc-panel .us-prof-color-item input[type="text"] {',
      '  all: initial !important; flex: 1 !important; min-width: 0 !important;',
      '  padding: 3px 6px !important;',
      '  font-family: "SF Mono","Menlo",monospace !important; font-size: 10px !important;',
      '  color: rgba(0,0,0,0.75) !important;',
      '  background: rgba(255,255,255,0.7) !important; border: 1px solid rgba(255,255,255,0.5) !important;',
      '  border-radius: 3px !important; outline: none !important;',
      '}',
      '#us-cc-panel .us-prof-color-item button {',
      '  all: initial !important; cursor: pointer !important; color: rgba(0,0,0,0.4) !important;',
      '  font-size: 12px !important; width: 18px !important; height: 18px !important;',
      '  display: flex !important; align-items: center !important; justify-content: center !important;',
      '  border-radius: 3px !important; flex-shrink: 0 !important;',
      '}',
      '#us-cc-panel .us-prof-color-item button:hover { color: #ff453a !important; }',
      '#us-cc-panel .us-prof-editor-actions {',
      '  display: flex !important; gap: 6px !important; margin-top: 8px !important;',
      '  justify-content: flex-end !important;',
      '}',
      '#us-cc-panel .us-prof-editor-actions button {',
      '  all: initial !important; cursor: pointer !important; font-family: inherit !important;',
      '  font-size: 11px !important; padding: 5px 12px !important; border-radius: 4px !important;',
      '}',
      '#us-cc-panel .us-prof-editor-actions .us-prof-btn-cancel {',
      '  background: rgba(255,255,255,0.6) !important; color: rgba(0,0,0,0.65) !important;',
      '  border: 1px solid rgba(255,255,255,0.5) !important;',
      '}',
      '#us-cc-panel .us-prof-editor-actions .us-prof-btn-cancel:hover {',
      '  background: rgba(255,255,255,0.8) !important; color: rgba(0,0,0,0.85) !important;',
      '}',
      '#us-cc-panel .us-prof-editor-actions .us-prof-btn-save {',
      '  background: rgba(59,130,246,0.3) !important; color: #2563eb !important;',
      '  border: 1px solid rgba(59,130,246,0.4) !important; font-weight: 600 !important;',
      '}',
      '#us-cc-panel .us-prof-editor-actions .us-prof-btn-save:hover {',
      '  background: rgba(59,130,246,0.45) !important;',
      '}',
      '#us-cc-panel .us-prof-btn-add-color {',
      '  all: initial !important; cursor: pointer !important; font-family: inherit !important;',
      '  font-size: 11px !important; color: rgba(59,130,246,0.85) !important;',
      '  margin-bottom: 4px !important; display: block !important;',
      '}',
      '#us-cc-panel .us-prof-btn-add-color:hover { color: #2563eb !important; }',

      /* Placeholders */
      '#us-cc-popover input::placeholder, #us-cc-panel .us-prof-editor input::placeholder {',
      '  color: rgba(0,0,0,0.35) !important; opacity: 1 !important;',
      '}',

      /* プロファイル色クリックで開くポップオーバー（Liquid Glass） */
      '#us-cc-prof-popover-backdrop {',
      '  display: none !important; position: fixed !important; inset: 0 !important; z-index: 2147483650 !important;',
      '}',
      '#us-cc-prof-popover-backdrop.us-visible { display: block !important; }',
      '#us-cc-prof-color-popover {',
      '  display: none !important; position: fixed !important; z-index: 2147483651 !important;',
      '  min-width: 220px !important; padding: 10px 12px !important;',
      '  background: rgba(255,255,255,0.22) !important;',
      '  backdrop-filter: blur(24px) saturate(160%) !important; -webkit-backdrop-filter: blur(24px) saturate(160%) !important;',
      '  border: 1px solid rgba(255,255,255,0.35) !important;',
      '  border-radius: 8px !important; box-shadow: 0 4px 20px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.3) !important;',
      '}',
      '#us-cc-prof-color-popover.us-visible { display: block !important; }',
      '#us-cc-prof-color-popover .us-prof-popover-row1 {',
      '  display: flex !important; align-items: center !important; gap: 8px !important; margin-bottom: 10px !important;',
      '}',
      '#us-cc-prof-color-popover [data-role="preview-swatch"] {',
      '  display: inline-block !important; width: 32px !important; height: 32px !important; flex-shrink: 0 !important;',
      '  border: 1px solid rgba(0,0,0,0.12) !important; border-radius: 6px !important;',
      '}',
      '#us-cc-prof-color-popover .us-prof-popover-row1 input { flex: 1 !important; min-width: 0 !important; }',
      '#us-cc-prof-color-popover input[type="text"] {',
      '  all: initial !important; display: block !important; width: 100% !important; box-sizing: border-box !important;',
      '  padding: 6px 8px !important; margin-bottom: 0 !important; text-align: center !important;',
      '  font-family: "SF Mono","Menlo",monospace !important; font-size: 11px !important;',
      '  color: rgba(0,0,0,0.8) !important; background: rgba(255,255,255,0.6) !important;',
      '  border: 1px solid rgba(255,255,255,0.5) !important; border-radius: 4px !important; outline: none !important;',
      '}',
      '#us-cc-prof-color-popover .us-prof-popover-rgbhex {',
      '  display: flex !important; justify-content: center !important; align-items: flex-end !important; gap: 8px !important; flex-wrap: wrap !important;',
      '}',
      '#us-cc-prof-color-popover .us-prof-popover-cell {',
      '  display: flex !important; flex-direction: column !important; align-items: center !important; gap: 2px !important;',
      '}',
      '#us-cc-prof-color-popover .us-prof-popover-cell-label {',
      '  font-size: 10px !important; color: rgba(0,0,0,0.5) !important;',
      '}',
      '#us-cc-prof-color-popover .us-prof-popover-cell input { width: 44px !important; }',
      '#us-cc-prof-color-popover .us-prof-popover-cell [data-role="hex"] { width: 80px !important; }',
    ].join('\n');
    }
  };
})();

// =========================
// 8. EditMode (module)
// =========================
var EditMode = (function () {
  'use strict';
  return {
    active: false,
    _highlighted: null,
    _boundHover: null,
    _boundClick: null,
    _lastMouseX: null,
    _lastMouseY: null,
    _hoverPopoverTimer: null,
    _hidePopoverTimer: null,
    _popoverOpenedByHover: false,
    enable: function () {
      if (this.active) return;
      this.active = true;
      var self = this;
      this._boundHover = function (e) { self._onHover(e); };
      this._boundClick = function (e) { self._onClick(e); };
      document.addEventListener('mouseover', this._boundHover, true);
      document.addEventListener('mouseout', function (e) { self._clearHighlight(); }, true);
      document.addEventListener('click', this._boundClick, true);
      Tab.setActive(true);
      this._persist(true);
    },
    disable: function () {
      if (!this.active) return;
      this.active = false;
      this._clearHighlight();
      document.removeEventListener('mouseover', this._boundHover, true);
      document.removeEventListener('click', this._boundClick, true);
      this._boundHover = null;
      this._boundClick = null;
      Tab.setActive(false);
      this._persist(false);
    },
    _isOurUI: function (el) {
      return !!(el && el.closest && el.closest('[data-us-cc]'));
    },
    _hasRuleForElement: function (el) {
      var selector = SelectorEngine.generate(el);
      if (!selector) return false;
      var rules = RulesManager.getRules();
      return rules.some(function (r) { return r.selector === selector; });
    },
    _onHover: function (e) {
      if (!this.active) return;
      var el = e.target;
      if (this._isOurUI(el)) { this._clearHighlight(); return; }
      if (el === this._highlighted) return;
      var self = this;
      this._clearHighlight();
      var hasRule = this._hasRuleForElement(el);
      if (hasRule) {
        self._lastMouseX = e.clientX;
        self._lastMouseY = e.clientY;
        el.classList.add('us-cc-highlight-defined');
        this._hoverPopoverTimer = setTimeout(function () {
          self._hoverPopoverTimer = null;
          try {
            ColorPopover.show(el, self._lastMouseX, self._lastMouseY);
            self._popoverOpenedByHover = true;
            if (ColorPopover.el) {
              ColorPopover.el.addEventListener('mouseenter', function onPopoverEnter() {
                clearTimeout(self._hidePopoverTimer);
                self._hidePopoverTimer = null;
                if (ColorPopover.el) ColorPopover.el.removeEventListener('mouseenter', onPopoverEnter);
              });
            }
          } catch (err) { console.error('[ColorCustomizer] Popover show failed:', err); }
        }, 250);
      } else {
        el.classList.add('us-cc-highlight');
      }
      this._highlighted = el;
    },
    _onClick: function (e) {
      if (!this.active) return;
      var el = e.target;
      if (this._isOurUI(el)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this._popoverOpenedByHover = false;
      this._clearHighlight();
      console.log('[ColorCustomizer] Element clicked:', el.tagName, el.className);
      try {
        ColorPopover.show(el, e.clientX, e.clientY);
      } catch (err) {
        console.error('[ColorCustomizer] Popover show failed:', err);
      }
    },
    _clearHighlight: function () {
      if (this._hoverPopoverTimer) {
        clearTimeout(this._hoverPopoverTimer);
        this._hoverPopoverTimer = null;
      }
      if (this._highlighted) {
        this._highlighted.classList.remove('us-cc-highlight');
        this._highlighted.classList.remove('us-cc-highlight-defined');
        if (this._popoverOpenedByHover) {
          var self = this;
          this._hidePopoverTimer = setTimeout(function () {
            self._hidePopoverTimer = null;
            ColorPopover.hide();
            self._popoverOpenedByHover = false;
          }, 300);
        }
        this._highlighted = null;
      }
    },
    _persist: async function (active) {
      try {
        await RPC.call('storage.set', ['userscripts:features:colorCustomizer:editMode', active]);
      } catch (e) {
        console.error('[ColorCustomizer] Failed to save EditMode state:', e);
      }
    }
  };
})();

// =========================
// 9. Popovers: ColorPopover, ChipColorPopover, ProfileColorPopover (module)
// =========================
var PopoversModule = (function () {
  'use strict';
  var PROP_LIST = [
    { key: 'background-color', label: '背景' },
    { key: 'color', label: '文字' },
    { key: 'border-color', label: 'ボーダー' }
  ];

  function parseFlexibleColor(str) {
    if (!str || typeof str !== 'string') return null;
    var s = str.trim().replace(/\s+/g, ' ');
    var hexOnly = s.replace(/^#/, '').replace(/[^0-9a-fA-F]/g, '');
    if (hexOnly.length === 6 || hexOnly.length === 3) {
      var hex = hexOnly.length === 3
        ? hexOnly[0] + hexOnly[0] + hexOnly[1] + hexOnly[1] + hexOnly[2] + hexOnly[2]
        : hexOnly;
      hex = hex.slice(0, 6);
      var r = parseInt(hex.slice(0, 2), 16);
      var g = parseInt(hex.slice(2, 4), 16);
      var b = parseInt(hex.slice(4, 6), 16);
      return { hex: '#' + hex.toLowerCase(), r: r, g: g, b: b };
    }
    var inner = s.replace(/^.*?rgb(?:a)?\s*\(?\s*/i, '').replace(/\s*\)?\s*$/, '').replace(/[,/]/g, ' ');
    var parts = inner.split(/\s+/).filter(Boolean);
    var nums = [];
    for (var i = 0; i < parts.length; i++) {
      var n = parseFloat(parts[i]);
      if (!isNaN(n)) nums.push(n);
    }
    if (nums.length < 3) {
      var anyNum = s.replace(/[^\d.\s,]/g, ' ').replace(/,/g, ' ').split(/\s+/).filter(Boolean);
      nums = [];
      for (var j = 0; j < anyNum.length; j++) {
        var v = parseFloat(anyNum[j]);
        if (!isNaN(v)) nums.push(v);
        if (nums.length >= 3) break;
      }
    }
    if (nums.length >= 3) {
      var r = nums[0], g = nums[1], b = nums[2];
      if (r <= 1 && g <= 1 && b <= 1) { r *= 255; g *= 255; b *= 255; }
      r = Math.max(0, Math.min(255, Math.round(r)));
      g = Math.max(0, Math.min(255, Math.round(g)));
      b = Math.max(0, Math.min(255, Math.round(b)));
      var h = '#' + [r, g, b].map(function (x) {
        var t = x.toString(16);
        return t.length === 1 ? '0' + t : t;
      }).join('');
      return { hex: h, r: r, g: g, b: b };
    }
    return null;
  }

  var ColorPopover = {
  el: null,
  _currentTarget: null,
  _lastActiveProp: 'background-color',
  _originalRules: {}, // { prop: { exists: bool, value: string|null } }

  _create: function () {
    if (this.el) return;
    console.log('[ColorCustomizer] Creating popover DOM');

    // Build property rows: カラーチップ＋テキストのみ（RGB/HEX・パレットはチップクリックで別ポップに表示）
    var propsContainer = h('div', { id: 'us-pop-props' });
    PROP_LIST.forEach(function (p) {
      var swatch = h('span', { 'data-role': 'preview-swatch', title: 'クリックで色を選択' });
      swatch.style.setProperty('background', '#000000', 'important');
      var rowMain = h('div.us-pop-prop-row-main', swatch, h('input', { type: 'text', 'data-role': 'flexible', placeholder: '#000000' }));
      propsContainer.appendChild(
        h('div.us-pop-prop-row', { 'data-prop-key': p.key },
          h('span.us-pop-prop-label', p.label),
          rowMain
        )
      );
    });

    var pop = h('div', { id: 'us-cc-popover', 'data-us-cc': 'popover' },
      h('span.us-pop-label', '要素'),
      h('span.us-pop-selector-text', { id: 'us-pop-sel' }),
      h('span.us-pop-label', 'プロパティ'),
      propsContainer,
      h('div.us-pop-actions',
        h('button.us-pop-btn.us-pop-btn-cancel', { id: 'us-pop-cancel' }, '取消')
      )
    );
    document.body.appendChild(pop);
    this.el = pop;
    this._bindEvents();
    console.log('[ColorCustomizer] Popover DOM created and appended');
  },

  _bindEvents: function () {
    var self = this;

    var rows = this.el.querySelectorAll('.us-pop-prop-row');
    for (var i = 0; i < rows.length; i++) {
      (function (row) {
        var flexible = row.querySelector('[data-role="flexible"]');
        var previewSwatch = row.querySelector('[data-role="preview-swatch"]');
        var propKey = row.getAttribute('data-prop-key');

        var updatePreview = function (hexVal) {
          if (previewSwatch && /^#[0-9a-fA-F]{6}$/.test(hexVal)) previewSwatch.style.setProperty('background', hexVal, 'important');
        };
        var applyFromFlexible = function () {
          var parsed = parseFlexibleColor(flexible.value);
          if (parsed && /^#[0-9a-fA-F]{6}$/.test(parsed.hex)) {
            updatePreview(parsed.hex);
            self._lastActiveProp = propKey;
            self._previewOne(row);
          }
        };
        flexible.addEventListener('input', applyFromFlexible);
        flexible.addEventListener('blur', function () {
          applyFromFlexible();
          var parsed = parseFlexibleColor(flexible.value);
          if (parsed && /^#[0-9a-fA-F]{6}$/.test(parsed.hex)) self._saveRule(propKey, parsed.hex);
        });
        flexible.addEventListener('focus', function () { self._lastActiveProp = propKey; });

        // カラーチップクリック → カラースウォッチ（ピッカー＋プロファイル）を表示
        previewSwatch.addEventListener('click', function (e) {
          e.stopPropagation();
          self._lastActiveProp = propKey;
          var currentHex = flexible.value.trim();
          var parsed = parseFlexibleColor(currentHex);
          currentHex = (parsed && /^#[0-9a-fA-F]{6}$/.test(parsed.hex)) ? parsed.hex : self._rgbToHex(getComputedStyle(self._currentTarget).getPropertyValue(propKey));
          ChipColorPopover.show(previewSwatch, currentHex, propKey, function (hex) {
            flexible.value = hex;
            updatePreview(hex);
            self._previewOne(row);
            self._saveRule(propKey, hex);
          });
        });
      })(rows[i]);
    }

    this.el.querySelector('#us-pop-cancel').addEventListener('click', function () { self._cancel(); });
  },

  show: function (el, mouseX, mouseY) {
    this._create();
    this._currentTarget = el;

    var selector = SelectorEngine.generate(el);
    this.el.querySelector('#us-pop-sel').textContent = selector;
    this.el.querySelector('#us-pop-sel').title = selector;

    var currRules = RulesManager.getRules();
    this._originalRules = {};

    // Fill each property row（チップ＋テキストのみ）
    var rows = this.el.querySelectorAll('.us-pop-prop-row');
    for (var i = 0; i < rows.length; i++) {
      var propKey = rows[i].getAttribute('data-prop-key');
      var computed = getComputedStyle(el).getPropertyValue(propKey);
      var hexVal = this._rgbToHex(computed);
      rows[i].querySelector('[data-role="flexible"]').value = hexVal;
      var ps = rows[i].querySelector('[data-role="preview-swatch"]');
      if (ps) ps.style.setProperty('background', hexVal, 'important');

      // Store initial rule state for revert
      var existing = currRules.find(function (r) { return r.selector === selector && r.property === propKey; });
      this._originalRules[propKey] = {
        exists: !!existing,
        value: existing ? existing.value : null,
        mode: existing ? existing.mode : 'inline'
      };
    }

    var popW = 280;
    var popH = 320;
    var gap = 8;
    var cursorOffset = 12;
    var left;
    var top;
    if (mouseX != null && mouseY != null) {
      left = mouseX + cursorOffset;
      top = mouseY + cursorOffset;
      if (left + popW > window.innerWidth - gap) left = mouseX - popW - cursorOffset;
      if (left < gap) left = gap;
      if (top + popH > window.innerHeight - gap) top = window.innerHeight - popH - gap;
      if (top < gap) top = gap;
    } else {
      var rect = el.getBoundingClientRect();
      left = rect.left + (rect.width / 2) - (popW / 2);
      left = Math.max(gap, Math.min(left, window.innerWidth - popW - gap));
      top = rect.bottom + gap;
      if (top + popH > window.innerHeight - gap) top = rect.top - popH - gap;
      if (top < gap) top = gap;
    }

    this.el.style.setProperty('left', left + 'px', 'important');
    this.el.style.setProperty('top', top + 'px', 'important');
    this.el.classList.add('us-visible');
  },

  hide: function () {
    if (this.el) this.el.classList.remove('us-visible');
    this._currentTarget = null;
  },

  _previewOne: function (row) {
    if (!this._currentTarget) return;
    var key = row.getAttribute('data-prop-key');
    var flexible = row.querySelector('[data-role="flexible"]');
    var parsed = flexible && parseFlexibleColor(flexible.value);
    var val = (parsed && /^#[0-9a-fA-F]{6}$/.test(parsed.hex)) ? parsed.hex : '';
    StyleApplier.previewOne(this._currentTarget, key, val);
  },

  async _saveRule(prop, val) {
    if (!this._currentTarget || !val) return;
    var selector = SelectorEngine.generate(this._currentTarget);
    if (selector) {
      await RulesManager.addRule(selector, prop, val, 'inline');
      Panel.refreshRules();
    }
  },

  async _cancel() {
    if (!this._currentTarget) { this.hide(); return; }
    var selector = SelectorEngine.generate(this._currentTarget);
    if (!selector) { this.hide(); return; }

    var self = this;
    var promises = [];
    Object.keys(this._originalRules).forEach(function (prop) {
      var orig = self._originalRules[prop];
      if (orig.exists) {
        // Revert to old rule
        promises.push(RulesManager.addRule(selector, prop, orig.value, orig.mode));
        StyleApplier.previewOne(self._currentTarget, prop, orig.value);
      } else {
        // Delete new rule if created（該当セレクタの全要素からスタイル解除）
        promises.push(RulesManager.deleteRule(selector, prop));
        StyleApplier.removeRuleFromPage(selector, prop);
      }
    });

    await Promise.all(promises);
    Panel.refreshRules();
    this.hide();
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

// DOM要素ポップのカラーチップクリックで開く「カラースウォッチ」（ピッカー＋プロファイル一覧）
var ChipColorPopover = {
  el: null,
  backdrop: null,
  _onChoose: null,

  _create: function () {
    if (this.el) return;
    this.backdrop = h('div', { id: 'us-cc-chip-popover-backdrop', 'data-us-cc': 'chip-color-popover' });
    var picker = h('input', { type: 'color', 'data-role': 'picker', value: '#000000' });
    var paletteContainer = h('div', { id: 'us-chip-pop-palette' });
    this.el = h('div', { id: 'us-cc-chip-popover', 'data-us-cc': 'chip-color-popover' },
      picker,
      paletteContainer
    );
    this.backdrop.appendChild(this.el);
    document.body.appendChild(this.backdrop);

    var self = this;
    picker.addEventListener('input', function () {
      var hex = this.value;
      if (self._onChoose) {
        self._onChoose(hex);
        self.hide();
      }
    });
    picker.addEventListener('change', function () {
      var hex = this.value;
      if (self._onChoose) {
        self._onChoose(hex);
        self.hide();
      }
    });
    paletteContainer.addEventListener('click', function (e) {
      var sw = e.target.closest('.us-chip-swatch');
      if (!sw) return;
      var color = sw.getAttribute('data-color');
      if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return;
      if (self._onChoose) {
        self._onChoose(color);
        self.hide();
      }
    });
    this.backdrop.addEventListener('click', function (e) {
      if (e.target === self.backdrop) self.hide();
    });
  },

  _buildPalette: function () {
    var container = this.el.querySelector('#us-chip-pop-palette');
    while (container.firstChild) container.removeChild(container.firstChild);
    var profiles = ProfileManager.getProfiles();
    if (profiles.length === 0) return;
    profiles.forEach(function (prof) {
      var section = h('div.us-chip-palette-section', h('span.us-chip-palette-name', prof.name));
      var row = h('div.us-chip-palette-row');
      prof.colors.forEach(function (c) {
        var sw = h('span.us-chip-swatch', { 'data-color': c.value, title: c.name || c.value });
        sw.style.setProperty('background', c.value, 'important');
        row.appendChild(sw);
      });
      section.appendChild(row);
      container.appendChild(section);
    });
  },

  show: function (anchor, currentHex, propKey, onChoose) {
    this._create();
    this._onChoose = onChoose;
    currentHex = (currentHex && currentHex.indexOf('#') === 0) ? currentHex : ('#' + (currentHex || '000000').replace(/^#/, ''));
    if (currentHex.length === 4) currentHex = '#' + currentHex[1] + currentHex[1] + currentHex[2] + currentHex[2] + currentHex[3] + currentHex[3];
    this.el.querySelector('[data-role="picker"]').value = currentHex;
    this._buildPalette();

    var rect = anchor.getBoundingClientRect();
    var popW = 200;
    var popH = 180;
    var left = rect.right + 8;
    if (left + popW > window.innerWidth - 8) left = rect.left - popW - 8;
    if (left < 8) left = 8;
    var top = rect.top;
    if (top + popH > window.innerHeight - 8) top = Math.max(8, window.innerHeight - popH - 8);
    if (top < 8) top = 8;
    this.el.style.setProperty('left', left + 'px', 'important');
    this.el.style.setProperty('top', top + 'px', 'important');
    this.backdrop.classList.add('us-visible');
    this.el.classList.add('us-visible');
  },

  hide: function () {
    if (this.backdrop) this.backdrop.classList.remove('us-visible');
    if (this.el) this.el.classList.remove('us-visible');
    this._onChoose = null;
  }
};

  var ProfileColorPopover = {
  el: null,
  backdrop: null,
  _onApply: null,

  _create: function () {
    if (this.el) return;
    this.backdrop = h('div', { id: 'us-cc-prof-popover-backdrop', 'data-us-cc': 'prof-color-popover' });
    var swatch = h('span', { 'data-role': 'preview-swatch' });
    swatch.style.setProperty('background', '#000', 'important');
    var flexible = h('input', { type: 'text', 'data-role': 'flexible', placeholder: 'rgb(255,0,0) / #f00 / fff ...' });
    var rIn = h('input', { type: 'text', 'data-role': 'r', placeholder: 'R' });
    var gIn = h('input', { type: 'text', 'data-role': 'g', placeholder: 'G' });
    var bIn = h('input', { type: 'text', 'data-role': 'b', placeholder: 'B' });
    var hexIn = h('input', { type: 'text', 'data-role': 'hex', placeholder: 'HEX' });
    var row1 = h('div.us-prof-popover-row1', swatch, flexible);
    var rCell = h('div.us-prof-popover-cell', h('span.us-prof-popover-cell-label', 'R'), rIn);
    var gCell = h('div.us-prof-popover-cell', h('span.us-prof-popover-cell-label', 'G'), gIn);
    var bCell = h('div.us-prof-popover-cell', h('span.us-prof-popover-cell-label', 'B'), bIn);
    var hexCell = h('div.us-prof-popover-cell', h('span.us-prof-popover-cell-label', '16進'), hexIn);
    var row2 = h('div.us-prof-popover-rgbhex', rCell, gCell, bCell, hexCell);
    this.el = h('div', { id: 'us-cc-prof-color-popover', 'data-us-cc': 'prof-color-popover' },
      row1,
      row2
    );
    this.backdrop.appendChild(this.el);
    document.body.appendChild(this.backdrop);

    var self = this;
    var updatePreview = function (hexVal) {
      if (/^#[0-9a-fA-F]{6}$/.test(hexVal)) swatch.style.setProperty('background', hexVal, 'important');
    };
    var applyFromFlexible = function () {
      var parsed = parseFlexibleColor(flexible.value);
      if (parsed && /^#[0-9a-fA-F]{6}$/.test(parsed.hex)) {
        rIn.value = String(parsed.r);
        gIn.value = String(parsed.g);
        bIn.value = String(parsed.b);
        hexIn.value = parsed.hex;
        updatePreview(parsed.hex);
      }
    };
    flexible.addEventListener('input', applyFromFlexible);
    flexible.addEventListener('blur', applyFromFlexible);
    var syncFromRgbHex = function () {
      var r = parseInt(rIn.value, 10), g = parseInt(gIn.value, 10), b = parseInt(bIn.value, 10);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));
        var h = '#' + [r, g, b].map(function (x) { var t = x.toString(16); return t.length === 1 ? '0' + t : t; }).join('');
        flexible.value = h;
        hexIn.value = h;
        updatePreview(h);
      } else {
        var he = hexIn.value.trim().replace(/^#/, '');
        if (/^[0-9a-fA-F]{6}$/.test(he) || /^[0-9a-fA-F]{3}$/.test(he)) {
          if (he.length === 3) he = he[0] + he[0] + he[1] + he[1] + he[2] + he[2];
          var h2 = '#' + he.toLowerCase();
          flexible.value = h2;
          rIn.value = String(parseInt(h2.slice(1, 3), 16));
          gIn.value = String(parseInt(h2.slice(3, 5), 16));
          bIn.value = String(parseInt(h2.slice(5, 7), 16));
          updatePreview(h2);
        }
      }
    };
    rIn.addEventListener('input', syncFromRgbHex);
    gIn.addEventListener('input', syncFromRgbHex);
    bIn.addEventListener('input', syncFromRgbHex);
    hexIn.addEventListener('input', syncFromRgbHex);
    hexIn.addEventListener('blur', syncFromRgbHex);
  },

  show: function (anchor, hex, onApply) {
    this._create();
    this._onApply = onApply;
    hex = (hex && hex.indexOf('#') === 0) ? hex : ('#' + (hex || '000000').replace(/^#/, ''));
    if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    this.el.querySelector('[data-role="flexible"]').value = hex;
    this.el.querySelector('[data-role="r"]').value = String(parseInt(hex.slice(1, 3), 16));
    this.el.querySelector('[data-role="g"]').value = String(parseInt(hex.slice(3, 5), 16));
    this.el.querySelector('[data-role="b"]').value = String(parseInt(hex.slice(5, 7), 16));
    this.el.querySelector('[data-role="hex"]').value = hex;
    this.el.querySelector('[data-role="preview-swatch"]').style.setProperty('background', hex, 'important');
    var rect = anchor.getBoundingClientRect();
    var popW = 220;
    var popH = 120;
    var left;
    if (rect.right + popW + 12 <= window.innerWidth) {
      left = rect.right + 6;
    } else if (rect.left - popW - 12 >= 8) {
      left = rect.left - popW - 6;
    } else {
      left = Math.max(8, Math.min(rect.left, window.innerWidth - popW - 8));
    }
    var top = rect.top;
    if (top + popH > window.innerHeight - 8) top = Math.max(8, window.innerHeight - popH - 8);
    if (top < 8) top = 8;
    this.el.style.left = left + 'px';
    this.el.style.top = top + 'px';
    this.backdrop.classList.add('us-visible');
    this.el.classList.add('us-visible');
    var self = this;
    var close = function () {
      self.backdrop.classList.remove('us-visible');
      self.el.classList.remove('us-visible');
      self.backdrop.removeEventListener('click', onBackdropClick);
      var h = self.el.querySelector('[data-role="hex"]').value;
      if (/^#[0-9a-fA-F]{6}$/.test(h) && self._onApply) self._onApply(h);
      self._onApply = null;
    };
    function onBackdropClick(e) {
      if (e.target === self.backdrop) close();
    }
    this.backdrop.addEventListener('click', onBackdropClick);
  },

  hide: function () {
    if (this.backdrop) this.backdrop.classList.remove('us-visible');
    if (this.el) this.el.classList.remove('us-visible');
  }
};

  return { ColorPopover: ColorPopover, ChipColorPopover: ChipColorPopover, ProfileColorPopover: ProfileColorPopover };
})();
var ColorPopover = PopoversModule.ColorPopover;
var ChipColorPopover = PopoversModule.ChipColorPopover;
var ProfileColorPopover = PopoversModule.ProfileColorPopover;

// =========================
// 10. Panel (module)
// =========================
var Panel = (function () {
  'use strict';
  return {
  el: null,
  backdrop: null,
  _open: false,
  _profileEditorEl: null,
  _editingProfileId: null,
  _activeRulesTab: 'exists',
  _screenList: null,
  _screenColorEditor: null,

  _create: function () {
    if (this.el) return;

    var bd = h('div', { id: 'us-cc-backdrop', 'data-us-cc': 'backdrop', onclick: function () { Panel.close(); } });
    document.body.appendChild(bd);
    this.backdrop = bd;

    var switchLabelList = document.createElement('label');
    switchLabelList.className = 'us-switch';
    switchLabelList.setAttribute('data-us-cc', 'switch');
    switchLabelList.appendChild(h('input', { type: 'checkbox', id: 'us-p-feature-colorEditor-toggle' }));
    switchLabelList.appendChild(h('span.us-slider'));

    var featureIcon = h('div.us-p-feature-icon',
      document.createTextNode('あAa'),
      h('div.us-p-feature-icon-swatch')
    );
    var featureLabel = h('span.us-p-feature-label', 'color', h('span.us-title-editor', 'Editor'));
    var featureRight = h('div.us-p-feature-right',
      switchLabelList,
      h('span.us-p-feature-chevron', '\u203A')
    );
    var featureRow = h('div', { class: 'us-p-feature-row', 'data-feature': 'colorEditor' },
      featureIcon,
      featureLabel,
      featureRight
    );

    var screenList = h('div', { class: 'us-p-screen us-p-screen-visible', 'data-us-cc': 'screen-list' },
      h('div.us-p-list-header',
        h('span.us-p-list-header-gear', { 'aria-hidden': 'true' }, createGearSvg()),
        h('span.us-p-title', '設定')
      ),
      h('div.us-p-feature-list', featureRow)
    );

    var switchLabelEdit = document.createElement('label');
    switchLabelEdit.className = 'us-switch';
    switchLabelEdit.setAttribute('data-us-cc', 'switch');
    switchLabelEdit.appendChild(h('input', { type: 'checkbox', id: 'us-p-edit-toggle' }));
    switchLabelEdit.appendChild(h('span.us-slider'));

    var tabExists = h('button.us-p-tab-btn', { id: 'us-p-tab-exists', type: 'button', 'data-tab': 'exists' }, 'このページに存在 (0)');
    var tabOther = h('button.us-p-tab-btn', { id: 'us-p-tab-other', type: 'button', 'data-tab': 'other' }, 'その他 (0)');
    var detailIcon = h('div.us-p-detail-icon',
      document.createTextNode('あAa'),
      h('div.us-p-detail-icon-swatch')
    );
    var screenColorEditor = h('div', { class: 'us-p-screen', 'data-us-cc': 'screen-colorEditor' },
      h('div.us-p-detail-header',
        h('div.us-p-detail-header-row',
          h('button.us-p-nav-back', { type: 'button' }, '\u2039 \u8a2d\u5b9a')
        ),
        h('div.us-p-detail-header-row',
          detailIcon,
          h('span.us-p-title', 'color', h('span.us-title-editor', 'Editor')),
          h('span.us-p-version', 'v' + US_VERSION),
          h('span.us-p-header-toggle', switchLabelEdit)
        )
      ),
      h('div.us-p-tabs', tabExists, tabOther),
      h('div.us-p-rules', { id: 'us-p-rules' }),
      h('div.us-p-section-title', { 'data-us-cc': 'section' },
        h('span', 'カラープロファイル'),
        h('button', { id: 'us-p-prof-add', title: '新規追加' }, '+')
      ),
      h('div.us-prof-list', { id: 'us-p-prof-list' }),
      h('div', { id: 'us-p-prof-editor-slot' }),
      h('div.us-p-footer',
        h('div.us-p-footer-row',
          h('button.us-btn.us-btn-secondary', { id: 'us-p-export' }, 'エクスポート'),
          h('button.us-btn.us-btn-secondary', { id: 'us-p-import' }, 'インポート')
        ),
        h('button.us-btn.us-btn-danger', { id: 'us-p-clear' }, '全ルールクリア')
      )
    );

    var p = h('div', { id: 'us-cc-panel', 'data-us-cc': 'panel' }, screenList, screenColorEditor);
    document.body.appendChild(p);
    this.el = p;
    this._screenList = screenList;
    this._screenColorEditor = screenColorEditor;

    this._ensureImportToast();
    this._bindEvents();
  },

  _showList: function () {
    if (this._screenList) this._screenList.classList.add('us-p-screen-visible');
    if (this._screenColorEditor) this._screenColorEditor.classList.remove('us-p-screen-visible');
  },

  _showColorEditor: function () {
    if (this._screenList) this._screenList.classList.remove('us-p-screen-visible');
    if (this._screenColorEditor) this._screenColorEditor.classList.add('us-p-screen-visible');
    this.refreshRules();
    this.refreshProfiles();
    var editToggle = this._screenColorEditor && this._screenColorEditor.querySelector('#us-p-edit-toggle');
    if (editToggle) editToggle.checked = EditMode.active;
  },

  _ensureImportToast: function () {
    if (this._importToastBackdrop && this._importToastBox) return;
    var toastBackdrop = h('div', { id: 'us-cc-import-toast-backdrop', 'data-us-cc': 'import-toast' });
    var toastTitle = h('div.us-import-toast-title', {}, '');
    var toastBody = h('div.us-import-toast-body', {}, '');
    var toastBox = h('div', { id: 'us-cc-import-toast-box' }, toastTitle, toastBody, h('button.us-import-toast-ok', {}, 'OK'));
    toastBackdrop.appendChild(toastBox);
    document.body.appendChild(toastBackdrop);
    this._importToastBackdrop = toastBackdrop;
    this._importToastBox = toastBox;
    this._importToastTitle = toastTitle;
    this._importToastBody = toastBody;
  },

  _showImportResult: function (success, data) {
    this._ensureImportToast();
    var backdrop = this._importToastBackdrop;
    var box = this._importToastBox;
    var titleEl = this._importToastTitle;
    var bodyEl = this._importToastBody;
    if (!backdrop || !box) return;

    if (success) {
      box.classList.remove('us-error');
      titleEl.textContent = 'インポートが完了しました';
      bodyEl.textContent = 'ルール: ' + (data.rulesCount || 0) + '件\nプロファイル: ' + (data.profilesCount || 0) + '件';
    } else {
      box.classList.add('us-error');
      titleEl.textContent = 'インポートに失敗しました';
      bodyEl.textContent = (data && data.error) ? String(data.error) : '不明なエラー';
    }

    document.body.appendChild(backdrop);
    requestAnimationFrame(function () {
      backdrop.classList.add('us-visible');
    });

    var okBtn = box.querySelector('.us-import-toast-ok');
    function hide() {
      backdrop.classList.remove('us-visible');
      backdrop.removeEventListener('click', onBackdropClick);
      if (okBtn) okBtn.removeEventListener('click', onOkClick);
    }
    function onBackdropClick(e) {
      if (e.target === backdrop) hide();
    }
    function onOkClick() { hide(); }

    backdrop.addEventListener('click', onBackdropClick);
    if (okBtn) okBtn.addEventListener('click', onOkClick);
  },

  _bindEvents: function () {
    var self = this;
    var closeTimer = null;

    if (this._screenList) {
      var row = this._screenList.querySelector('[data-feature="colorEditor"]');
      if (row) {
        row.addEventListener('click', function (e) {
          if (e.target.closest('.us-switch')) return;
          self._showColorEditor();
        });
      }
      var listToggle = this._screenList.querySelector('#us-p-feature-colorEditor-toggle');
      if (listToggle) {
        listToggle.addEventListener('click', function (e) { e.stopPropagation(); });
        listToggle.checked = true;
      }
    }

    if (this._screenColorEditor) {
      var backBtn = this._screenColorEditor.querySelector('.us-p-nav-back');
      if (backBtn) backBtn.addEventListener('click', function () { self._showList(); });
    }

    this.el.addEventListener('mouseleave', function () {
      closeTimer = setTimeout(function () {
        if (ProfileColorPopover.backdrop && ProfileColorPopover.backdrop.classList.contains('us-visible')) return;
        if (ChipColorPopover.backdrop && ChipColorPopover.backdrop.classList.contains('us-visible')) return;
        Panel.close();
      }, 500);
    });
    this.el.addEventListener('mouseenter', function () {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    });

    var editToggleEl = this.el.querySelector('#us-p-edit-toggle');
    if (editToggleEl) editToggleEl.addEventListener('change', function () {
      if (this.checked) {
        EditMode.enable();
        self.close();
      } else {
        EditMode.disable();
      }
    });

    this.el.querySelector('#us-p-tab-exists').addEventListener('click', function () {
      self._activeRulesTab = 'exists';
      self.el.querySelector('#us-p-tab-exists').classList.add('active');
      self.el.querySelector('#us-p-tab-other').classList.remove('active');
      self.refreshRules();
    });
    this.el.querySelector('#us-p-tab-other').addEventListener('click', function () {
      self._activeRulesTab = 'other';
      self.el.querySelector('#us-p-tab-other').classList.add('active');
      self.el.querySelector('#us-p-tab-exists').classList.remove('active');
      self.refreshRules();
    });

    this.el.querySelector('#us-p-clear').addEventListener('click', function () {
      RulesManager.clearRules().then(function () {
        StyleApplier.clearAll();
        self.refreshRules();
      });
    });

    // Export
    this.el.querySelector('#us-p-export').addEventListener('click', function () {
      var data = {
        version: US_VERSION,
        exportedAt: new Date().toISOString(),
        page: window.location.hostname + window.location.pathname,
        rules: RulesManager.getRules(),
        profiles: ProfileManager.getProfiles()
      };
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var ts = new Date().toISOString().replace(/[:.]/g, '-');
      var a = document.createElement('a');
      a.href = url;
      a.download = 'color-customizer-' + window.location.hostname + '-' + ts + '.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    // Import
    this.el.querySelector('#us-p-import').addEventListener('click', function () {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', function () {
        var file = input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var data = JSON.parse(reader.result);
            var promises = [];
            // Import rules
            if (Array.isArray(data.rules)) {
              promises.push(RulesManager.importRules(data.rules));
            }
            // Import profiles
            if (Array.isArray(data.profiles)) {
              promises.push(ProfileManager.importProfiles(data.profiles));
            }
            Promise.all(promises).then(function (results) {
              var rulesCount = results[0] || 0;
              var profilesCount = results[1] || 0;

              StyleApplier.clearAll();
              StyleApplier.applyAll(RulesManager.getRules());
              self.refreshRules();
              self.refreshProfiles();
              console.log('[ColorCustomizer] Import complete');
              self._showImportResult(true, { rulesCount: rulesCount, profilesCount: profilesCount });
            }).catch(function (e) {
              console.error('[ColorCustomizer] Import failed:', e);
              self._showImportResult(false, { error: e && e.message ? e.message : String(e) });
            });
          } catch (e) {
            console.error('[ColorCustomizer] Import failed:', e);
            self._showImportResult(false, { error: e && e.message ? e.message : String(e) });
          }
        };
        reader.readAsText(file);
      });
      input.click();
    });

    // Delegate: delete rule（削除したルールの該当箇所からスタイルを解除）
    this.el.querySelector('#us-p-rules').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-rule-idx]');
      if (!btn) return;
      var idx = parseInt(btn.getAttribute('data-rule-idx'), 10);
      var rules = RulesManager.getRules();
      var rule = idx >= 0 && idx < rules.length ? rules[idx] : null;
      RulesManager.removeRule(idx).then(function () {
        if (rule) StyleApplier.removeRuleFromPage(rule.selector, rule.property);
        StyleApplier.clearAll();
        StyleApplier.applyAll(RulesManager.getRules());
        self.refreshRules();
      });
    });

    // Profile: add new
    this.el.querySelector('#us-p-prof-add').addEventListener('click', function () {
      self._editingProfileId = null;
      self._showProfileEditor('', [{ value: '#3b82f6', name: '' }]);
    });

    // Profile list: delegate edit/delete
    this.el.querySelector('#us-p-prof-list').addEventListener('click', function (e) {
      var editBtn = e.target.closest('[data-prof-edit]');
      var delBtn = e.target.closest('[data-prof-del]');
      if (editBtn) {
        var id = editBtn.getAttribute('data-prof-edit');
        var prof = ProfileManager.getProfiles().find(function (p) { return p.id === id; });
        if (prof) {
          self._editingProfileId = id;
          self._showProfileEditor(prof.name, prof.colors);
        }
      } else if (delBtn) {
        var delId = delBtn.getAttribute('data-prof-del');
        ProfileManager.deleteProfile(delId).then(function () {
          self.refreshProfiles();
        });
      }
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

  _showProfileEditor: function (name, colors) {
    var self = this;
    var slot = this.el.querySelector('#us-p-prof-editor-slot');
    while (slot.firstChild) slot.removeChild(slot.firstChild);

    var nameInput = h('input', { type: 'text', placeholder: 'プロファイル名', value: name });
    var colorsList = h('div', { id: 'us-prof-colors-list' });

    // Build color rows
    colors.forEach(function (c, i) {
      colorsList.appendChild(self._makeColorRow(c.value, c.name, i));
    });

    var addBtn = h('button.us-prof-btn-add-color', '+ 色を追加');
    addBtn.addEventListener('click', function () {
      var idx = colorsList.children.length;
      colorsList.appendChild(self._makeColorRow('#888888', '', idx));
    });

    var cancelBtn = h('button.us-prof-btn-cancel', 'キャンセル');
    var saveBtn = h('button.us-prof-btn-save', '保存');

    cancelBtn.addEventListener('click', function () {
      while (slot.firstChild) slot.removeChild(slot.firstChild);
      self._editingProfileId = null;
    });

    saveBtn.addEventListener('click', function () {
      var n = nameInput.value.trim() || 'Untitled';
      var rows = colorsList.querySelectorAll('.us-prof-color-item');
      var cs = [];
      for (var r = 0; r < rows.length; r++) {
        var cv = rows[r].querySelector('[data-role="prof-color"]').value;
        var cn = rows[r].querySelector('[data-role="prof-name"]').value.trim();
        cs.push({ value: cv, name: cn });
      }
      var promise;
      if (self._editingProfileId) {
        promise = ProfileManager.updateProfile(self._editingProfileId, n, cs);
      } else {
        promise = ProfileManager.addProfile(n, cs);
      }
      promise.then(function () {
        while (slot.firstChild) slot.removeChild(slot.firstChild);
        self._editingProfileId = null;
        self.refreshProfiles();
      });
    });

    var editor = h('div.us-prof-editor', { 'data-us-cc': 'prof-editor' },
      nameInput,
      colorsList,
      addBtn,
      h('div.us-prof-editor-actions', cancelBtn, saveBtn)
    );
    slot.appendChild(editor);
  },

  _makeColorRow: function (value, name) {
    var hex = (value && value.indexOf('#') === 0) ? value : ('#' + (value || '000000').replace(/^#/, ''));
    if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    var hiddenColor = h('input', { type: 'hidden', 'data-role': 'prof-color', value: hex });
    var swatch = h('span.us-prof-color-swatch', { 'data-role': 'prof-swatch', title: 'クリックで色を変更' });
    swatch.style.setProperty('background', hex, 'important');
    var nameInput = h('input', { type: 'text', 'data-role': 'prof-name', value: name || '', placeholder: '色名' });
    var row = h('div.us-prof-color-item', hiddenColor, swatch, nameInput, h('button', { title: '削除' }, '✕'));

    swatch.addEventListener('click', function () {
      var currentHex = row.querySelector('[data-role="prof-color"]').value;
      ProfileColorPopover.show(swatch, currentHex, function (newHex) {
        if (!/^#[0-9a-fA-F]{6}$/.test(newHex)) return;
        row.querySelector('[data-role="prof-color"]').value = newHex;
        swatch.style.setProperty('background', newHex, 'important');
      });
    });
    row.querySelector('button').addEventListener('click', function () {
      row.parentNode.removeChild(row);
    });
    return row;
  },

  open: function () {
    this._create();
    this._showList();

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
    this._activeRulesTab = 'exists';
    this._showList();
  },

  refreshRules: async function () {
    if (!this.el) return;
    var container = this.el.querySelector('#us-p-rules');
    var rules = RulesManager.getRules();
    var self = this;

    var currentPageKey = 'userscripts:features:colorCustomizer:page:' + encodeURIComponent(window.location.hostname + window.location.pathname);
    var hostPrefix = 'userscripts:features:colorCustomizer:page:' + encodeURIComponent(window.location.hostname);
    var otherPagesRules = [];
    try {
      var byPrefix = await RPC.call('storage.getAllByPrefix', [hostPrefix]);
      if (byPrefix && typeof byPrefix === 'object') {
        Object.keys(byPrefix).forEach(function (k) {
          if (k === currentPageKey) return;
          var val = byPrefix[k];
          if (val && Array.isArray(val.rules)) {
            val.rules.forEach(function (r) {
              otherPagesRules.push({ rule: r, idx: -1 });
            });
          }
        });
      }
    } catch (e) { console.warn('[ColorCustomizer] getAllByPrefix failed:', e); }

    while (container.firstChild) container.removeChild(container.firstChild);

    if (rules.length === 0 && otherPagesRules.length === 0) {
      this.el.querySelector('#us-p-tab-exists').textContent = 'このページに存在 (0)';
      this.el.querySelector('#us-p-tab-other').textContent = 'その他 (0)';
      this.el.querySelector('#us-p-tab-exists').classList.add('active');
      this.el.querySelector('#us-p-tab-other').classList.remove('active');
      container.appendChild(h('span.us-p-empty', 'ルールがありません'));
      return;
    }

    var withIndex = rules.map(function (r, i) { return { rule: r, idx: i }; });
    var matching = [];
    var other = [];
    withIndex.forEach(function (w) {
      try {
        var el = SelectorEngine.find(w.rule.selector);
        if (el) matching.push(w); else other.push(w);
      } catch (e) { other.push(w); }
    });
    matching.sort(function (a, b) { return b.idx - a.idx; });
    other.sort(function (a, b) { return b.idx - a.idx; });
    other = other.concat(otherPagesRules);

    this.el.querySelector('#us-p-tab-exists').textContent = 'このページに存在 (' + matching.length + ')';
    this.el.querySelector('#us-p-tab-other').textContent = 'その他 (' + other.length + ')';
    this.el.querySelector('#us-p-tab-exists').classList.toggle('active', self._activeRulesTab === 'exists');
    this.el.querySelector('#us-p-tab-other').classList.toggle('active', self._activeRulesTab === 'other');

    var list = self._activeRulesTab === 'exists' ? matching : other;
    if (list.length === 0) {
      container.appendChild(h('span.us-p-empty', self._activeRulesTab === 'exists' ? 'このページに該当するルールはありません' : 'その他のルールはありません'));
      return;
    }

    list.forEach(function (w) {
      var r = w.rule;
      var shortSel = r.selector.length > 28 ? '…' + r.selector.slice(-26) : r.selector;
      var swatch = h('span.us-rule-swatch');
      swatch.style.setProperty('background', r.value, 'important');
      var canDelete = w.idx >= 0;
      var item = h('div.us-rule-item',
        swatch,
        h('span.us-rule-info',
          h('span.us-rule-selector', { title: r.selector }, shortSel),
          h('span.us-rule-prop', r.property)
        ),
        canDelete ? h('button.us-rule-del', { 'data-rule-idx': String(w.idx), title: '削除' }, '✕') : null
      );
      if (self._activeRulesTab === 'exists') item.classList.add('us-rule-item-exists');
      container.appendChild(item);
    });
  },

  refreshProfiles: function () {
    if (!this.el) return;
    var container = this.el.querySelector('#us-p-prof-list');
    while (container.firstChild) container.removeChild(container.firstChild);
    var profiles = ProfileManager.getProfiles();

    if (profiles.length === 0) return;

    profiles.forEach(function (prof) {
      var swatches = h('span.us-prof-swatches');
      prof.colors.forEach(function (c) {
        var sw = h('span.us-prof-sw', { title: c.name || c.value });
        sw.style.setProperty('background', c.value, 'important');
        swatches.appendChild(sw);
      });

      container.appendChild(
        h('div.us-prof-item',
          h('div.us-prof-item-head',
            h('span.us-prof-name', prof.name),
            h('span.us-prof-actions',
              h('button', { 'data-prof-edit': prof.id, title: '編集' }, '✎'),
              h('button', { 'data-prof-del': prof.id, title: '削除' }, '✕')
            )
          ),
          swatches
        )
      );
    });
  }
  };
})();

// =========================
// 11. Tab (module)
// =========================
var Tab = (function () {
  'use strict';
  return {
  el: null,

  create: function () {
    if (this.el) return;
    Styles.inject();

    var toggleWrap = h('div.us-cc-tab-toggle-wrap', { 'data-us-cc': 'tab-toggle' });
    var switchLabel = document.createElement('label');
    switchLabel.className = 'us-switch';
    var tabEditCheck = h('input', { type: 'checkbox', id: 'us-cc-tab-edit-toggle', title: 'Edit Mode' });
    switchLabel.appendChild(tabEditCheck);
    switchLabel.appendChild(h('span.us-slider'));
    toggleWrap.appendChild(switchLabel);

    var iconWrap = h('div.us-cc-tab-icon', { title: '設定' });
    var gearEl = h('span.us-cc-tab-gear', { 'aria-hidden': 'true' });
    gearEl.appendChild(createGearSvg());
    iconWrap.appendChild(gearEl);

    var tab = h('div', { id: 'us-cc-tab', 'data-us-cc': 'tab' });
    tab.appendChild(toggleWrap);
    tab.appendChild(iconWrap);

    toggleWrap.addEventListener('click', function (e) { e.stopPropagation(); });
    switchLabel.addEventListener('click', function (e) { e.stopPropagation(); });
    tabEditCheck.addEventListener('change', function () {
      if (this.checked) EditMode.enable(); else EditMode.disable();
    });

    iconWrap.addEventListener('click', function () {
        ColorPopover.hide();
        Panel.open();
      });
    var hoverOpenTimer = null;
    var HOVER_OPEN_DELAY_MS = 500;
    tab.addEventListener('mouseenter', function () {
      if (hoverOpenTimer) return;
      hoverOpenTimer = setTimeout(function () {
        hoverOpenTimer = null;
        ColorPopover.hide();
        Panel.open();
      }, HOVER_OPEN_DELAY_MS);
    });
    tab.addEventListener('mouseleave', function () {
      if (hoverOpenTimer) {
        clearTimeout(hoverOpenTimer);
        hoverOpenTimer = null;
      }
    });

    document.body.appendChild(tab);
    this.el = tab;
    this._tabEditCheck = tabEditCheck;
  },

  setActive: function (active) {
    if (!this.el) return;
    if (active) {
      this.el.classList.add('us-tab-active');
    } else {
      this.el.classList.remove('us-tab-active');
    }
    if (this._tabEditCheck) this._tabEditCheck.checked = !!active;
  }
  };
})();

// =========================
// 12. Feature Interface + Global API (module)
// =========================
var ColorCustomizerFeature = (function () {
  'use strict';
  return {
  _initialized: false,

  async init() {
    if (this._initialized) return true;
    try {
      await RPC.init();
      await RulesManager.load();
      await ProfileManager.load();
      function applyRules() {
        StyleApplier.applyAll(RulesManager.getRules());
      }
      applyRules();
      if (document.readyState !== 'complete') {
        window.addEventListener('load', function onLoad() {
          window.removeEventListener('load', onLoad);
          applyRules();
        });
      }
      setTimeout(applyRules, 600);
      setTimeout(applyRules, 2000);
      Tab.create();
      // Restore Edit Mode state
      var editState = await RPC.call('storage.get', ['userscripts:features:colorCustomizer:editMode', false]);
      if (editState) {
        EditMode.enable();
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
    EditMode.enable();
  },

  disable: function () {
    EditMode.disable();
  }
  };
})();

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

})();

// ESM export (keeps module semantics for jsDelivr)
export { };
