/**
 * UserScript – Module-based Architecture (Phase 2)
 * 
 * Loads features as ES modules and provides RPC bridge functionality.
 */
(function () {
  if (window.location.hostname === '127.0.0.1') return;

var US_VERSION = '2.0.0';
console.log('%c[UserScripts] script.js loaded – v' + US_VERSION + ' %c' + new Date().toLocaleTimeString(), 'color:#60a5fa;font-weight:bold', 'color:#888');

// =========================
// 1. RPC Client
// =========================
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

    function onMessage(evt) {
      try { onReply(evt.data); } catch (e) { }
    }

    function onDocEvent(evt) {
      try { onReply(evt.detail); } catch (e) { }
    }

    function cleanup() {
      window.removeEventListener('message', onMessage);
      document.removeEventListener(DOC_EVENT_REPLY, onDocEvent);
      clearTimeout(timer);
    }

    window.addEventListener('message', onMessage);
    document.addEventListener(DOC_EVENT_REPLY, onDocEvent);
  });
}

var RPC = {
  _debug: false,

  init: async function () {
    this._debug && console.log('[RPC] Init complete');
    return true;
  },

  call: async function (method, args, timeoutMs) {
    timeoutMs = timeoutMs || 3000;
    var id = makeId();
    var req = {};
    req[REQ_FLAG] = true;
    req.id = id;
    req.method = method;
    req.args = args || [];

    this._debug && console.log('[RPC] Call', method, req);
    sendRequest(req);
    var result = await oneRpc(id, req, timeoutMs, method);
    this._debug && console.log('[RPC] Result', method, result);
    return result;
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
  },

  /**
   * Find all elements matching a selector. Returns array (empty on error).
   */
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
// 3. Module Loader
// =========================
var ModuleLoader = {
  async loadColorEditor() {
    try {
      // Create script element for ES module
      var baseUrl = document.querySelector('script[src*="/userScripts/"]')?.src.replace(/\/[^\/]*$/, '/');
      if (!baseUrl) {
        // Fallback for development
        baseUrl = 'https://cdn.jsdelivr.net/gh/done-is-better-than-perfect/userScripts@main/';
      }
      
      var moduleUrl = baseUrl + 'modules/colorEditor.js';
      var module = await import(moduleUrl);
      return module.default;
    } catch (e) {
      console.error('[ModuleLoader] Failed to load colorEditor module:', e);
      return null;
    }
  }
};

// =========================
// 4. Feature Manager
// =========================
var FeatureManager = {
  features: {},
  
  async init() {
    try {
      // Load colorEditor feature
      var colorEditor = await ModuleLoader.loadColorEditor();
      if (colorEditor) {
        this.features.colorCustomizer = colorEditor;
        await colorEditor.init(RPC);
        console.log('[FeatureManager] Color editor loaded successfully');
      } else {
        console.error('[FeatureManager] Failed to load color editor');
      }
    } catch (e) {
      console.error('[FeatureManager] Initialization failed:', e);
    }
  },
  
  getFeature(name) {
    return this.features[name] || null;
  }
};

// Global API
window.UserScripts = window.UserScripts || {};
window.UserScripts.version = US_VERSION;
window.UserScripts.init = function () { console.log('[UserScripts] Core initialized'); };
window.UserScripts.features = window.UserScripts.features || {};

// RPC is also exposed for extensibility
window.US = window.US || {};
window.US.rpc = RPC;

// =========================
// Auto-initialize
// =========================
(async function () {
  try {
    await RPC.init();
    await FeatureManager.init();
    
    // Expose features to global API
    window.UserScripts.features = FeatureManager.features;
    
    console.log('[UserScripts] Auto-init complete');
  } catch (e) {
    console.error('[UserScripts] Auto-init failed:', e);
  }
})();

})();

// ESM export (keeps module semantics for jsDelivr)
export { };