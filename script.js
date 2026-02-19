/**
 * UserScript – Module-based Architecture (Phase 2)
 * 
 * Loads features as ES modules and provides RPC bridge functionality.
 */
(function () {
  if (window.location.hostname === '127.0.0.1') return;

// Clear version hash to avoid jQuery selector errors on target pages
if (window.location.hash && window.location.hash.includes('version=')) {
  var newHash = window.location.hash.replace(/[?&]?version=[^&]+/g, '').replace(/^#&/, '#');
  if (newHash === '#' || newHash === '') {
    history.replaceState(null, null, window.location.pathname + window.location.search);
  } else {
    history.replaceState(null, null, window.location.pathname + window.location.search + newHash);
  }
}

var US_VERSION = '2.0.4';
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
  _debug: true,  // Enable debug for troubleshooting
  _token: null,

  async init() {
    console.log('[RPC] Initializing with handshake...');
    try {
      // First, perform handshake to get the token
      var handshakeResult = await this._handshake();
      this._token = handshakeResult.token;
      console.log('[RPC] Handshake successful, token received');
      return true;
    } catch (e) {
      console.error('[RPC] Handshake failed:', e);
      return false;
    }
  },

  async _handshake() {
    var id = makeId();
    var req = {};
    req[REQ_FLAG] = true;
    req.id = id;
    req.method = 'core.handshake';
    req.params = [];
    req.token = null; // No token needed for handshake

    console.log('[RPC] Handshake request');
    sendRequest(req);
    return await oneRpc(id, req, 5000, 'core.handshake');
  },

  call: async function (method, args, timeoutMs) {
    if (!this._token) {
      throw new Error('RPC not initialized - call init() first');
    }
    
    timeoutMs = timeoutMs || 3000;
    var id = makeId();
    var req = {};
    req[REQ_FLAG] = true;
    req.id = id;
    req.method = method;
    req.params = args || [];
    req.token = this._token;  // Use the actual token from handshake

    console.log('[RPC] Call:', method, 'with params:', req.params);
    sendRequest(req);
    try {
      var result = await oneRpc(id, req, timeoutMs, method);
      console.log('[RPC] Success:', method, 'result:', result);
      return result;
    } catch (e) {
      console.error('[RPC] Failed:', method, 'error:', e.message);
      throw e;
    }
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
  getBaseUrl() {
    // Try to get baseUrl from current script or various patterns
    var scriptSrc = null;
    
    // Method 1: Look for userScripts in src
    var scripts = Array.from(document.querySelectorAll('script[src]'));
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src;
      if (src.includes('userScripts')) {
        scriptSrc = src;
        break;
      }
    }
    
    // Method 2: Check document.currentScript if available
    if (!scriptSrc && document.currentScript && document.currentScript.src) {
      scriptSrc = document.currentScript.src;
    }
    
    if (scriptSrc) {
      var baseUrl = scriptSrc.replace(/\/[^\/]*$/, '/');
      console.log('[ModuleLoader] Detected baseUrl:', baseUrl);
      return baseUrl;
    }
    
    // Fallback: Use latest main branch
    var fallbackUrl = 'https://cdn.jsdelivr.net/gh/done-is-better-than-perfect/userScripts@main/';
    console.warn('[ModuleLoader] Could not detect baseUrl, using fallback:', fallbackUrl);
    return fallbackUrl;
  },

  async loadColorEditor() {
    try {
      var baseUrl = this.getBaseUrl();
      var moduleUrl = baseUrl + 'modules/colorEditor.js';
      
      console.log('[ModuleLoader] Loading colorEditor from:', moduleUrl);
      var module = await import(moduleUrl);
      
      if (!module || !module.default) {
        throw new Error('Module did not export default');
      }
      
      console.log('[ModuleLoader] colorEditor module loaded successfully');
      return module.default;
    } catch (e) {
      console.error('[ModuleLoader] Failed to load colorEditor module:', e);
      console.error('[ModuleLoader] Module URL was:', moduleUrl || 'undefined');
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
      console.log('[FeatureManager] Initializing features...');
      
      // Load colorEditor feature
      var colorEditor = await ModuleLoader.loadColorEditor();
      if (colorEditor) {
        this.features.colorCustomizer = colorEditor;
        
        console.log('[FeatureManager] Initializing colorEditor with RPC...');
        await colorEditor.init(RPC);
        
        console.log('[FeatureManager] Color editor initialized successfully');
      } else {
        console.error('[FeatureManager] Failed to load color editor');
      }
    } catch (e) {
      console.error('[FeatureManager] Initialization failed:', e);
      // Don't throw - let the app continue even if features fail to load
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