/**
 * Shared utilities for UserScripts: RPC client, DOM helpers, gear icon.
 * Exposes: window.RPC, window.h, window.makeSvg, window.createGearNode
 */
(function (global) {
  'use strict';

  // Gear icon: icooon-mono #10194 (https://icooon-mono.com/10194-…), fill=currentColor
  var GEAR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M496 293.984c9.031-.703 16-8.25 16-17.297v-41.375c0-9.063-6.969-16.594-16-17.313l-54.828-4.281c-3.484-.266-6.484-2.453-7.828-5.688l-18.031-43.516c-1.344-3.219-.781-6.906 1.5-9.547l35.75-41.813c5.875-6.891 5.5-17.141-.922-23.547l-29.25-29.25c-6.406-6.406-16.672-6.813-23.547-.922l-41.813 35.75c-2.641 2.266-6.344 2.844-9.547 1.516l-43.531-18.047c-3.219-1.328-5.422-4.375-5.703-7.828l-4.266-54.813C293.281 6.969 285.75 0 276.688 0h-41.375c-9.063 0-16.594 6.969-17.297 16.016l-4.281 54.813c-.266 3.469-2.469 6.5-5.688 7.828l-43.531 18.047c-3.219 1.328-6.906.75-9.563-1.516l-41.797-35.75c-6.875-5.891-17.125-5.484-23.547.922l-29.25 29.25c-6.406 6.406-6.797 16.656-.922 23.547l35.75 41.813c2.25 2.641 2.844 6.328 1.5 9.547l-18.031 43.516c-1.313 3.234-4.359 5.422-7.813 5.688L16 218c-9.031.719-16 8.25-16 17.313v41.359c0 9.063 6.969 16.609 16 17.313l54.844 4.266c3.453.281 6.5 2.484 7.813 5.703l18.031 43.516c1.344 3.219.75 6.922-1.5 9.563l-35.75 41.813c-5.875 6.875-5.484 17.125.922 23.547l29.25 29.25c6.422 6.406 16.672 6.797 23.547.906l41.797-35.75c2.656-2.25 6.344-2.844 9.563-1.5l43.531 18.031c3.219 1.344 5.422 4.359 5.688 7.844l4.281 54.813c.703 9.031 8.234 16.016 17.297 16.016h41.375c9.063 0 16.594-6.984 17.297-16.016l4.266-54.813c.281-3.484 2.484-6.5 5.703-7.844l43.531-18.031c3.203-1.344 6.922-.75 9.547 1.5l41.813 35.75c6.875 5.891 17.141 5.5 23.547-.906l29.25-29.25c6.422-6.422 6.797-16.672.922-23.547l-35.75-41.813c-2.25-2.641-2.844-6.344-1.5-9.563l18.031-43.516c1.344-3.219 4.344-5.422 7.828-5.703L496 293.984zM256 342.516c-23.109 0-44.844-9-61.188-25.328-16.344-16.359-25.344-38.078-25.344-61.203 0-23.109 9-44.844 25.344-61.172 16.344-16.359 38.078-25.344 61.188-25.344 23.125 0 44.844 8.984 61.188 25.344 16.344 16.328 25.344 38.063 25.344 61.172 0 23.125-9 44.844-25.344 61.203C300.844 333.516 279.125 342.516 256 342.516z"/></svg>';

  function createGearNode() {
    var wrap = document.createElement('div');
    wrap.innerHTML = GEAR_SVG;
    var svg = wrap.querySelector('svg');
    if (svg) {
      var node = document.importNode(svg, true);
      node.setAttribute('aria-hidden', 'true');
      return node;
    }
    var span = document.createElement('span');
    span.textContent = '\u2699';
    return span;
  }

  // =========================
  // RPC Client
  // =========================
  var RPC = (function () {
    var REQ_FLAG = '__US_RPC__';
    var REP_FLAG = '__US_RPC_REPLY__';
    var DOC_EVENT_REQUEST = 'us-rpc-request';
    var DOC_EVENT_REPLY = 'us-rpc-reply';

    function makeId() {
      return 'rpc_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
    }

    function sendRequest(req) {
      global.postMessage(req, '*');
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
          if (ev.source !== global && ev.source !== global.top) return;
          onReply(ev.data);
        }

        function onDocReply(ev) {
          onReply(ev.detail);
        }

        function cleanup() {
          clearTimeout(timer);
          global.removeEventListener('message', onMessage);
          document.removeEventListener(DOC_EVENT_REPLY, onDocReply);
        }

        global.addEventListener('message', onMessage);
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
  // DOM helpers
  // =========================
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

  // Expose on global (window) for script.js and other modules
  global.RPC = RPC;
  global.h = h;
  global.makeSvg = makeSvg;
  global.createGearNode = createGearNode;
  global.US_Util = { RPC: RPC, h: h, makeSvg: makeSvg, createGearNode: createGearNode };
})(typeof window !== 'undefined' ? window : this);
