// ==UserScript==
// @name         UserScripts Loader (GitHub raw) + Bridge
// @namespace    done-is-better-than-perfect/user-scripts
// @version      0.3.0
// @description  Load external script.js and provide GM bridge via postMessage.
// @match        *://*/*
// @run-at       document-end
// @inject-into  content
//
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        GM.listValues
// @grant        GM.addStyle
// @grant        GM.xmlHttpRequest
//
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
//
// @connect      *
// ==/UserScript==

(function () {
  'use strict';

  var SRC = 'https://raw.githubusercontent.com/done-is-better-than-perfect/user-scripts/refs/heads/main/script.js';

  if (window.__USER_SCRIPTS_LOADER_LOADED__) return;
  window.__USER_SCRIPTS_LOADER_LOADED__ = true;

  // ---- Bridge (page -> content) ----
  // page側は window.postMessage で { __US_RPC__: true, id, method, params } を投げる
  // content側は GM_* を実行して結果を window.postMessage で返す
  var RPC_FLAG = '__US_RPC__';
  var RPC_REPLY_FLAG = '__US_RPC_REPLY__';

  function safeClone(obj) {
    // postMessageで送れるように（関数/循環参照を避ける）
    return obj == null ? obj : JSON.parse(JSON.stringify(obj));
  }

  function gmGetValueCompat(key, def) {
    if (typeof GM !== 'undefined' && GM.getValue) return GM.getValue(key, def);
    if (typeof GM_getValue === 'function') return Promise.resolve(GM_getValue(key, def));
    return Promise.resolve(def);
  }

  function gmSetValueCompat(key, val) {
    if (typeof GM !== 'undefined' && GM.setValue) return GM.setValue(key, val);
    if (typeof GM_setValue === 'function') { GM_setValue(key, val); return Promise.resolve(); }
    return Promise.resolve();
  }

  function gmDeleteValueCompat(key) {
    if (typeof GM !== 'undefined' && GM.deleteValue) return GM.deleteValue(key);
    if (typeof GM_deleteValue === 'function') { GM_deleteValue(key); return Promise.resolve(); }
    return Promise.resolve();
  }

  function gmListValuesCompat() {
    if (typeof GM !== 'undefined' && GM.listValues) return GM.listValues();
    if (typeof GM_listValues === 'function') return Promise.resolve(GM_listValues());
    return Promise.resolve([]);
  }

  function gmAddStyleCompat(cssText) {
    if (typeof GM !== 'undefined' && GM.addStyle) return Promise.resolve(GM.addStyle(cssText));
    if (typeof GM_addStyle === 'function') return Promise.resolve(GM_addStyle(cssText));
    // fallback: content側でstyle注入（ページには反映されることが多いが確実ではない）
    var style = document.createElement('style');
    style.textContent = String(cssText || '');
    (document.head || document.documentElement).appendChild(style);
    return Promise.resolve();
  }

  function gmXmlHttpRequestCompat(details) {
    // GM.xmlHttpRequest（Promise）とGM_xmlhttpRequest（callback）の両対応
    if (typeof GM !== 'undefined' && GM.xmlHttpRequest) {
      return GM.xmlHttpRequest(details);
    }
    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise(function (resolve, reject) {
        var d = Object.assign({}, details);
        d.onload = function (res) { resolve(res); };
        d.onerror = function (err) { reject(err); };
        GM_xmlhttpRequest(d);
      });
    }
    return Promise.reject(new Error('GM.xmlHttpRequest is not available'));
  }

  async function handleRpc(msg) {
    var id = msg.id;
    var method = msg.method;
    var params = msg.params || [];

    try {
      var result;

      if (method === 'GM.getValue') {
        result = await gmGetValueCompat(params[0], params[1]);
      } else if (method === 'GM.setValue') {
        await gmSetValueCompat(params[0], params[1]);
        result = true;
      } else if (method === 'GM.deleteValue') {
        await gmDeleteValueCompat(params[0]);
        result = true;
      } else if (method === 'GM.listValues') {
        result = await gmListValuesCompat();
      } else if (method === 'GM.addStyle') {
        await gmAddStyleCompat(params[0]);
        result = true;
      } else if (method === 'GM.xmlHttpRequest') {
        // detailsはオブジェクト想定
        result = await gmXmlHttpRequestCompat(params[0]);
        // resは巨大になりがちなので必要最小限に絞る（必要なら増やす）
        result = {
          status: result.status,
          statusText: result.statusText,
          responseHeaders: result.responseHeaders,
          responseText: result.responseText,
          finalUrl: result.finalUrl
        };
      } else {
        throw new Error('Unknown method: ' + method);
      }

      window.postMessage({ [RPC_REPLY_FLAG]: true, id: id, ok: true, result: safeClone(result) }, '*');
    } catch (e) {
      window.postMessage({ [RPC_REPLY_FLAG]: true, id: id, ok: false, error: String(e && e.message ? e.message : e) }, '*');
    }
  }

  window.addEventListener('message', function (ev) {
    // 同一ページからのmessageのみ受ける
    if (ev.source !== window) return;
    var data = ev.data;
    if (!data || data[RPC_FLAG] !== true) return;
    handleRpc(data);
  });

  // ---- Inject external script.js into page world ----
  function inject() {
    var parent = document.body || document.documentElement;
    if (!parent) return;

    var exists = document.querySelector('script[data-userscripts-loader="1"][src="' + SRC + '"]');
    if (exists) return;

    var s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.defer = true;
    s.setAttribute('data-userscripts-loader', '1');

    s.onload = function () {
      try {
        if (window.UserScripts && typeof window.UserScripts.init === 'function') {
          window.UserScripts.init();
        }
        if (
          window.UserScripts &&
          window.UserScripts.features &&
          window.UserScripts.features.colorCustomizer &&
          typeof window.UserScripts.features.colorCustomizer.init === 'function'
        ) {
          window.UserScripts.features.colorCustomizer.init();
        }
      } catch (e) {
        console.warn('[UserScripts Loader] init error:', e);
      }
    };

    s.onerror = function (e) {
      console.warn('[UserScripts Loader] failed to load:', SRC, e);
    };

    parent.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  } else {
    inject();
  }
})();

