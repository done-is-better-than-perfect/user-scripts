// ==UserScript==
// @name         UserScripts Loader (jsDelivr) + RPC Bridge [Tampermonkey]
// @namespace    done-is-better-than-perfect/userScripts
// @version      0.5.0
// @description  Load external script.js (page world) and provide RPC bridge to GM APIs via postMessage. For Chrome Tampermonkey.
// @match        *://*/*
// @noframes
// @run-at       document-end
//
// ---- Storage (cross-site, script-scoped) ----
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        GM.listValues
//
// ---- Style injection (fallback available) ----
// @grant        GM.addStyle
//
// ---- External API (CORS-bypass XHR) ----
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
//
// ---- Clipboard (best-effort; may be unavailable) ----
// @grant        GM.setClipboard
//
// ---- Legacy aliases (Tampermonkey) ----
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addStyle
// @grant        GM_setClipboard
//
// ---- XHR domain whitelist ----
// @connect      *
// ==/UserScript==

(function () {
  'use strict';

  // =========================
  // Config
  // =========================
  // jsDelivr URL template:
  //   https://cdn.jsdelivr.net/gh/<org>/<repo>@<tag-or-branch>/<path>
  //
  // Default: @main (latest on main branch).
  // To pin a specific version, add  #version=v1.1.0  to the page URL hash.
  //   e.g.  https://example.com/page#version=v1.2.0
  var BASE_SRC = 'https://cdn.jsdelivr.net/gh/done-is-better-than-perfect/userScripts';
  var DEFAULT_REF = 'main';

  function resolveVersion() {
    var hash = window.location.hash || '';
    var m = hash.match(/(?:^#|&)version=([^&]+)/);
    return m ? m[1] : DEFAULT_REF;
  }

  var SRC_REF = resolveVersion();
  var SRC = BASE_SRC + '@' + SRC_REF + '/script.js';
  console.info('[UserScripts Loader] Version ref:', SRC_REF, '| URL:', SRC);

  // =========================
  // One-time guard (per page)
  // =========================
  if (window.__USER_SCRIPTS_LOADER_LOADED__) return;
  window.__USER_SCRIPTS_LOADER_LOADED__ = true;

  // =========================
  // RPC Bridge (content world)
  // =========================
  var REQ_FLAG = '__US_RPC__';
  var REP_FLAG = '__US_RPC_REPLY__';
  var DOC_EVENT_REQUEST = 'us-rpc-request';
  var DOC_EVENT_REPLY = 'us-rpc-reply';
  var BRIDGE_VERSION = 'bridge-0.1.0';

  // Token to prevent arbitrary page scripts from calling privileged APIs.
  var TOKEN = (function () {
    try {
      var a = new Uint8Array(16);
      crypto.getRandomValues(a);
      return Array.from(a).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    } catch (e) {
      return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
    }
  })();

  // style registry
  var styleMap = new Map(); // key: styleId or metaId -> { el, metaId, styleId }

  function reply(id, ok, payload) {
    var msg = Object.assign({ [REP_FLAG]: true, id: id, ok: ok }, payload || {});
    window.postMessage(msg, '*');
  }

  function replyViaDocument(id, ok, payload) {
    var msg = Object.assign({ [REP_FLAG]: true, id: id, ok: ok }, payload || {});
    try {
      document.dispatchEvent(new CustomEvent(DOC_EVENT_REPLY, { detail: msg }));
    } catch (e) { }
  }

  function safeJson(x) {
    try {
      return x == null ? x : JSON.parse(JSON.stringify(x));
    } catch (e) {
      // If something is not serializable, return a string fallback
      return String(x);
    }
  }

  function caps() {
    return {
      gm: {
        getValue: !!(typeof GM !== 'undefined' && GM.getValue) || (typeof GM_getValue === 'function'),
        setValue: !!(typeof GM !== 'undefined' && GM.setValue) || (typeof GM_setValue === 'function'),
        listValues: !!(typeof GM !== 'undefined' && GM.listValues) || (typeof GM_listValues === 'function'),
        deleteValue: !!(typeof GM !== 'undefined' && GM.deleteValue) || (typeof GM_deleteValue === 'function'),
        addStyle: !!(typeof GM !== 'undefined' && GM.addStyle) || (typeof GM_addStyle === 'function'),
        xmlHttpRequest: !!(typeof GM !== 'undefined' && GM.xmlHttpRequest) || (typeof GM_xmlhttpRequest === 'function'),
        setClipboard: !!(typeof GM !== 'undefined' && GM.setClipboard) || (typeof GM_setClipboard === 'function')
      }
    };
  }

  function ensureToken(method, token) {
    if (method === 'core.handshake') return true;
    return token && token === TOKEN;
  }

  // ---- GM compat ----
  function gmGetValue(key, def) {
    if (typeof GM !== 'undefined' && GM.getValue) return GM.getValue(key, def);
    if (typeof GM_getValue === 'function') return Promise.resolve(GM_getValue(key, def));
    return Promise.resolve(def);
  }

  function gmSetValue(key, val) {
    if (typeof GM !== 'undefined' && GM.setValue) return GM.setValue(key, val);
    if (typeof GM_setValue === 'function') { GM_setValue(key, val); return Promise.resolve(); }
    return Promise.resolve();
  }

  function gmDeleteValue(key) {
    if (typeof GM !== 'undefined' && GM.deleteValue) return GM.deleteValue(key);
    if (typeof GM_deleteValue === 'function') { GM_deleteValue(key); return Promise.resolve(); }
    return Promise.resolve();
  }

  function gmListValues() {
    if (typeof GM !== 'undefined' && GM.listValues) return GM.listValues();
    if (typeof GM_listValues === 'function') return Promise.resolve(GM_listValues());
    return Promise.resolve([]);
  }

  function gmAddStyle(cssText) {
    if (typeof GM !== 'undefined' && GM.addStyle) {
      GM.addStyle(cssText);
      return Promise.resolve();
    }
    if (typeof GM_addStyle === 'function') {
      GM_addStyle(cssText);
      return Promise.resolve();
    }
    // fallback: plain <style>
    var style = document.createElement('style');
    style.textContent = String(cssText || '');
    (document.head || document.documentElement).appendChild(style);
    return Promise.resolve();
  }

  function gmXhr(opt) {
    // Prefer GM.xmlHttpRequest (Promise)
    if (typeof GM !== 'undefined' && GM.xmlHttpRequest) {
      return GM.xmlHttpRequest(opt);
    }
    // Fallback GM_xmlhttpRequest (callbacks)
    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise(function (resolve, reject) {
        var o = Object.assign({}, opt);
        o.onload = function (res) { resolve(res); };
        o.onerror = function (err) { reject(err); };
        GM_xmlhttpRequest(o);
      });
    }
    return Promise.reject(new Error('GM.xmlHttpRequest not available'));
  }

  async function clipboardSetText(text) {
    if (typeof GM !== 'undefined' && GM.setClipboard) {
      GM.setClipboard(String(text));
      return true;
    }
    if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(String(text));
      return true;
    }
    // fallback
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(String(text));
        return true;
      }
    } catch (e) { }
    return false;
  }

  function parseHeaders(raw) {
    return typeof raw === 'string' ? raw : '';
  }

  function genStyleId() {
    return 'style_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
  }

  async function handle(method, params) {
    // ---- core ----
    if (method === 'core.handshake') {
      return { token: TOKEN, version: BRIDGE_VERSION, capabilities: caps() };
    }

    // ---- storage ----
    if (method === 'storage.get') {
      return await gmGetValue(params[0], params[1]);
    }
    if (method === 'storage.set') {
      await gmSetValue(params[0], params[1]);
      return true;
    }
    if (method === 'storage.delete') {
      await gmDeleteValue(params[0]);
      return true;
    }
    if (method === 'storage.listKeys') {
      return await gmListValues();
    }
    if (method === 'storage.getAllByPrefix') {
      var prefix = String(params[0] || '');
      var keys = await gmListValues();
      var out = {};
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k && k.indexOf(prefix) === 0) {
          out[k] = await gmGetValue(k, null);
        }
      }
      return out;
    }
    if (method === 'storage.setMany') {
      var items = params[0] || [];
      for (var j = 0; j < items.length; j++) {
        await gmSetValue(items[j].key, items[j].value);
      }
      return true;
    }

    // ---- net ----
    if (method === 'net.request') {
      var opt = params[0] || {};
      if (!opt.url) throw new Error('net.request: url is required');

      var res = await gmXhr({
        url: opt.url,
        method: opt.method || 'GET',
        headers: opt.headers || {},
        data: opt.data,
        timeout: opt.timeoutMs,
        responseType: opt.responseType,
        withCredentials: opt.withCredentials
      });

      var outRes = {
        status: res.status,
        statusText: res.statusText,
        finalUrl: res.finalUrl,
        headers: parseHeaders(res.responseHeaders)
      };

      if (opt.responseType === 'json') {
        try {
          outRes.responseJson = JSON.parse(res.responseText);
        } catch (e) {
          outRes.responseText = res.responseText;
        }
      } else {
        outRes.responseText = res.responseText;
      }

      return outRes;
    }

    // ---- style ----
    if (method === 'style.add') {
      var css = String(params[0] || '');
      var meta = params[1] || {};
      var metaId = meta.id ? String(meta.id) : '';
      var replace = !!meta.replace;

      if (metaId) {
        var existing = styleMap.get(metaId);
        if (existing) {
          if (replace) existing.el.textContent = css;
          return { styleId: existing.styleId };
        }
      }

      var styleEl = document.createElement('style');
      styleEl.textContent = css;
      (document.head || document.documentElement).appendChild(styleEl);

      var styleId = genStyleId();
      styleMap.set(styleId, { el: styleEl, metaId: metaId || '', styleId: styleId });
      if (metaId) styleMap.set(metaId, { el: styleEl, metaId: metaId, styleId: styleId });

      return { styleId: styleId };
    }

    if (method === 'style.remove') {
      var id = String(params[0] || '');
      var rec = styleMap.get(id);

      if (rec && rec.el && rec.el.parentNode) rec.el.parentNode.removeChild(rec.el);

      if (rec) {
        styleMap.delete(rec.styleId);
        if (rec.metaId) styleMap.delete(rec.metaId);
      } else {
        styleMap.delete(id);
      }
      return true;
    }

    if (method === 'style.clearByPrefix') {
      var pfx = String(params[0] || '');
      var removed = 0;

      // Only meaningful for metaId usage; iterate keys and remove matches
      Array.from(styleMap.keys()).forEach(function (k) {
        if (!k || k.indexOf(pfx) !== 0) return;

        var r = styleMap.get(k);
        if (r && r.el && r.el.parentNode) {
          r.el.parentNode.removeChild(r.el);
          removed++;
        }
        if (r) {
          styleMap.delete(r.styleId);
          if (r.metaId) styleMap.delete(r.metaId);
        } else {
          styleMap.delete(k);
        }
      });

      return removed;
    }

    // ---- clipboard ----
    if (method === 'clipboard.setText') {
      return await clipboardSetText(params[0]);
    }

    // ---- log ----
    if (method === 'log') {
      var o2 = params[0] || {};
      var lvl = o2.level || 'info';
      var msg2 = o2.message || '';
      var data2 = o2.data;

      if (lvl === 'debug') console.debug('[US]', msg2, data2);
      else if (lvl === 'info') console.info('[US]', msg2, data2);
      else if (lvl === 'warn') console.warn('[US]', msg2, data2);
      else console.error('[US]', msg2, data2);

      return true;
    }

    throw new Error('Unknown method: ' + method);
  }

  function handleRequest(data, replyFn) {
    if (!data || data[REQ_FLAG] !== true) return;
    var id = data.id;
    var token = data.token;
    var method = data.method;
    var params = data.params || [];
    if (!ensureToken(method, token)) {
      replyFn(id, false, { error: 'Unauthorized' });
      return;
    }
    Promise.resolve()
      .then(function () { return handle(method, params); })
      .then(function (result) { replyFn(id, true, { result: safeJson(result) }); })
      .catch(function (e) { replyFn(id, false, { error: String(e && e.message ? e.message : e) }); });
  }

  window.addEventListener('message', function (ev) {
    if (ev.source !== window && ev.source !== window.top) return;
    handleRequest(ev.data, reply);
  });

  document.addEventListener(DOC_EVENT_REQUEST, function (ev) {
    handleRequest(ev.detail, replyViaDocument);
  });

  // =========================
  // External script injection (page world)
  // =========================
  function injectExternalScript() {
    var parent = document.body || document.documentElement;
    if (!parent) return;

    // Prevent duplicate insertion of the external script
    var exists = document.querySelector('script[data-userscripts-loader="1"]');
    if (exists) return;

    var s = document.createElement('script');

    s.src = SRC;
    // script.js uses ESM (export {} at end); must load as module in both Safari and Chrome.
    s.type = 'module';
    s.async = true;
    s.defer = true;
    s.setAttribute('data-userscripts-loader', '1');

    s.onload = function () {
      console.info('[UserScripts Loader] External script loaded:', SRC);
    };

    s.onerror = function (e) {
      console.warn('[UserScripts Loader] failed to load external script:', SRC, e);
    };

    parent.appendChild(s);
  }

  function start() {
    // At document-end, body can still be null on some pages; retry briefly.
    if (document.body || document.documentElement) {
      injectExternalScript();
      return;
    }

    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (document.body || document.documentElement) {
        clearInterval(t);
        injectExternalScript();
      } else if (tries >= 50) {
        clearInterval(t);
      }
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
