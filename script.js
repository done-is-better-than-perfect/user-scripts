/**
 * UserScript – Element-based Color Customizer (Phase 1)
 *
 * Lets users click individual page elements and change their colors.
 * Rules are persisted per-site via GM_* RPC and auto-applied on revisit.
 */
(function () {
  var US_VERSION = '1.7.0-dev.54';
  var __US_panelFeatureFns = {};
  if (typeof document !== 'undefined') document.__US_panelFeatureFnsRef = __US_panelFeatureFns;
  console.log('[UserScripts] IIFE start: __US_panelFeatureFns keys=', Object.keys(__US_panelFeatureFns));
  if (window.location.hostname === '127.0.0.1') return;

  function runMain() {
    var RPC = window.RPC, h = window.h, makeSvg = window.makeSvg, createGearNode = window.createGearNode;
    if (!RPC || !h) {
      console.error('[UserScripts] util.js did not load (RPC/h missing). Aborting runMain.');
      return;
    }

    console.log('%c[UserScripts] script.js loaded – v' + US_VERSION + ' %c' + new Date().toLocaleTimeString(), 'color:#60a5fa;font-weight:bold', 'color:#888');

// =========================

// =========================
// 10. Panel (composer: list + feature screens by index only)
// =========================
var Panel = (function () {
  'use strict';
  return {
  el: null,
  backdrop: null,
  _open: false,
  _screenList: null,
  _features: null,
  _screens: null,

  _create: function () {
    if (this.el) return;
    var self = this;
    var fns = (typeof document !== 'undefined' && document.__US_panelFeatureFnsRef) ? document.__US_panelFeatureFnsRef : __US_panelFeatureFns;
    console.log('[UserScripts] Panel._create: fns keys=', Object.keys(fns), 'colorEditor=', typeof fns.colorEditor, 'dataFiller=', typeof fns.dataFiller);

    var bd = h('div', { id: 'us-cc-backdrop', 'data-us-cc': 'backdrop', onclick: function () { Panel.close(); } });
    document.body.appendChild(bd);
    this.backdrop = bd;

    var features = [];
    var ceCallbacks = { onBack: function () { self._showList(); }, onEditToggleChange: function (checked) { if (checked) Panel.close(); } };
    var dfCallbacks = { onBack: function () { self._showList(); } };
    if (typeof fns.colorEditor === 'function') {
      features.push(fns.colorEditor(h, createGearNode, US_VERSION, ceCallbacks));
    } else if (typeof window.createColorEditorPanelFeature === 'function') {
      features.push(window.createColorEditorPanelFeature(h, createGearNode, US_VERSION, ceCallbacks));
    }
    if (typeof fns.dataFiller === 'function') {
      features.push(fns.dataFiller(h, DataFiller, RPC, dfCallbacks));
    } else if (typeof window.createDataFillerPanelFeature === 'function') {
      features.push(window.createDataFillerPanelFeature(h, DataFiller, RPC, dfCallbacks));
    }

    var listContainer = h('div', { class: 'us-p-feature-list' });
    for (var i = 0; i < features.length; i++) {
      features[i].listRow.dataset.featureIndex = String(i);
      features[i].listRow.addEventListener('click', function (e) {
        if (e.target.closest('.us-switch')) return;
        self._showScreen(parseInt(e.currentTarget.dataset.featureIndex, 10));
      });
      listContainer.appendChild(features[i].listRow);
    }
    if (features.length === 0) {
      var emptyMsg = document.createElement('div');
      emptyMsg.className = 'us-p-empty';
      emptyMsg.style.cssText = 'padding:24px 16px;text-align:center;color:rgba(0,0,0,0.45);font-size:13px;';
      emptyMsg.textContent = '設定項目を読み込めませんでした。ページを再読み込みしてください。';
      listContainer.appendChild(emptyMsg);
    }

    var screenList = h('div', { class: 'us-p-screen us-p-screen-visible', 'data-us-cc': 'screen-list' },
      h('div.us-p-list-header',
        h('span.us-p-list-header-gear', { 'aria-hidden': 'true' }, createGearNode()),
        h('span.us-p-title', '\u8a2d\u5b9a')
      ),
      listContainer
    );

    var panelChildren = [screenList];
    for (var j = 0; j < features.length; j++) panelChildren.push(features[j].screen.el);
    var p = h.apply(null, ['div', { id: 'us-cc-panel', 'data-us-cc': 'panel' }].concat(panelChildren));
    document.body.appendChild(p);
    this.el = p;
    this._screenList = screenList;
    this._features = features;
    this._screens = features.map(function (f) { return f.screen; });

    this._bindEvents();
  },

  _showList: function () {
    if (this._screenList) this._screenList.classList.add('us-p-screen-visible');
    for (var i = 0; i < (this._screens || []).length; i++) {
      if (this._screens[i] && this._screens[i].el) this._screens[i].el.classList.remove('us-p-screen-visible');
    }
  },

  _showScreen: function (index) {
    if (!this._screens || index < 0 || index >= this._screens.length) return;
    if (this._screenList) this._screenList.classList.remove('us-p-screen-visible');
    for (var i = 0; i < this._screens.length; i++) {
      if (this._screens[i] && this._screens[i].el) {
        this._screens[i].el.classList.toggle('us-p-screen-visible', i === index);
      }
    }
    if (this._features[index] && this._features[index].screen && this._features[index].screen.onShow) {
      this._features[index].screen.onShow();
    }
  },

  _bindEvents: function () {
    var self = this;
    var closeTimer = null;
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

  open: async function () {
    if (this.el && this._features && this._features.length === 0) {
      var ref = (typeof document !== 'undefined' && document.__US_panelFeatureFnsRef) ? document.__US_panelFeatureFnsRef : __US_panelFeatureFns;
      var hasFeature = (ref.colorEditor || ref.dataFiller || window.createColorEditorPanelFeature || window.createDataFillerPanelFeature);
      if (hasFeature) {
        if (this.backdrop && this.backdrop.parentNode) this.backdrop.parentNode.removeChild(this.backdrop);
        if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
        this.el = null;
        this.backdrop = null;
        this._screenList = null;
        this._features = null;
        this._screens = null;
      }
    }
    this._create();
    this._showList();
    var i;
    for (i = 0; i < (this._features || []).length; i++) {
      if (this._features[i] && this._features[i].onPanelOpen) this._features[i].onPanelOpen();
    }
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
    this._showList();
  }
  };
})();

// =========================
// 10b. createDataFiller / panel feature
// =========================
var DataFiller = (typeof window.createDataFiller === 'function')
  ? window.createDataFiller(RPC, h, function () { return Panel; })
  : (function () {
      'use strict';
      return {
        getSteps: function () { return []; },
        load: function () { return Promise.resolve([]); },
        save: function () {},
        enableCapture: function () {},
        disableCapture: function () {},
        exportCSVTemplate: function () {},
        addStep: function () {},
        removeStep: function () {},
        moveStep: function () {}
      };
    })();

    window.Panel = Panel;
    window.DataFiller = DataFiller;

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

  }

  var scriptSrc = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) ? document.currentScript.src : '';
  var base = scriptSrc ? scriptSrc.replace(/#.*$/, '').replace(/\?.*$/, '').replace(/\/script\.js$/i, '') : 'https://cdn.jsdelivr.net/gh/done-is-better-than-perfect/userScripts@main';

  function loadByScriptTag() {
    var util = document.createElement('script');
    util.src = base + '/modules/util.js';
    util.onload = function () {
      var ce = document.createElement('script');
      ce.src = base + '/modules/colorEditor.js';
      ce.onload = function () {
        var df = document.createElement('script');
        df.src = base + '/modules/dataFiller.js';
        df.onload = runMain;
        df.onerror = runMain;
        (document.head || document.documentElement).appendChild(df);
      };
      ce.onerror = runMain;
      (document.head || document.documentElement).appendChild(ce);
    };
    util.onerror = runMain;
    (document.head || document.documentElement).appendChild(util);
  }

  var __US_wrapForEval = function (moduleText) {
    return '(function(){var __US_panelFeatureFns=(typeof document!=="undefined"&&document.__US_panelFeatureFnsRef)?document.__US_panelFeatureFnsRef:{};var __US_registerPanelFeature=function(key,fn){__US_panelFeatureFns[key]=fn;};' + moduleText + '})();';
  };
  function loadByFetchEval(nextUrl, thenRun) {
    if (!nextUrl) { thenRun(); return; }
    var name = nextUrl.replace(/^.*\//, '');
    console.log('[UserScripts] loadByFetchEval: fetching', name);
    fetch(nextUrl).then(function (r) { return r.text(); }).then(function (text) {
      var wrap = (name === 'colorEditor.js' || name === 'dataFiller.js');
      if (wrap) {
        text = __US_wrapForEval(text);
        console.log('[UserScripts] loadByFetchEval: wrapped with IIFE(fns) for', name);
      }
      try { eval(text); } catch (e) { console.warn('[UserScripts] eval failed for ' + nextUrl, e); }
      if (wrap) {
        var ref = (typeof document !== 'undefined' && document.__US_panelFeatureFnsRef) ? document.__US_panelFeatureFnsRef : null;
        console.log('[UserScripts] after eval(' + name + '): ref keys=', ref ? Object.keys(ref) : 'no ref', 'closure keys=', Object.keys(__US_panelFeatureFns));
      }
      thenRun();
    }).catch(function (err) {
      console.warn('[UserScripts] fetch failed for ' + nextUrl + ', falling back to script tag', err);
      loadByScriptTag();
    });
  }

  window.__US_registerPanelFeature = function (key, createFn) {
    __US_panelFeatureFns[key] = createFn;
  };
  loadByFetchEval(base + '/modules/util.js', function () {
    loadByFetchEval(base + '/modules/colorEditor.js', function () {
      loadByFetchEval(base + '/modules/dataFiller.js', function () {
        console.log('[UserScripts] before runMain: __US_panelFeatureFns keys=', Object.keys(__US_panelFeatureFns), 'colorEditor=', typeof __US_panelFeatureFns.colorEditor, 'dataFiller=', typeof __US_panelFeatureFns.dataFiller);
        runMain();
      });
    });
  });
})();

// ESM export (keeps module semantics for jsDelivr)
export { };
