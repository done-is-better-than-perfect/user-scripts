/**
 * UserScript – Element-based Color Customizer (Phase 1)
 *
 * Lets users click individual page elements and change their colors.
 * Rules are persisted per-site via GM_* RPC and auto-applied on revisit.
 *
 * ES module: loaded with type="module". Imports util, colorEditor, dataFiller; no eval.
 */
import { RPC, h, makeSvg, createGearNode } from './modules/util.js';
import { ColorEditorFeature, ColorCustomizerFeature, ColorPopover } from './modules/colorEditor.js';
import { DataFillerFeature } from './modules/dataFiller.js';

var US_VERSION = '1.7.0-dev.58';

if (window.location.hostname === '127.0.0.1') {
  throw new Error('[UserScripts] 127.0.0.1 is disabled');
}

function runMain() {
  console.log('%c[UserScripts] script.js loaded – v' + US_VERSION + ' %c' + new Date().toLocaleTimeString(), 'color:#60a5fa;font-weight:bold', 'color:#888');

  var ceCallbacks = { onBack: function () { Panel._showList(); }, onEditToggleChange: function (checked) { if (checked) Panel.close(); } };
  var dfCallbacks = { onBack: function () { Panel._showList(); } };

  var ceFeature = new ColorEditorFeature();
  ceFeature.init({ h: h, createGearNode: createGearNode, version: US_VERSION, callbacks: ceCallbacks });

  var dfFeature = new DataFillerFeature();
  dfFeature.init({ h: h, RPC: RPC, getPanel: function () { return Panel; }, callbacks: dfCallbacks });

  var featureInstances = [ceFeature, dfFeature];
  Panel._create(featureInstances);
}

var Panel = (function () {
  'use strict';
  return {
  el: null,
  backdrop: null,
  _open: false,
  _screenList: null,
  _features: null,
  _screens: null,

  _create: function (featureInstances) {
    if (this.el) return;
    var self = this;
    var features = featureInstances || [];
    this._features = features;

    var bd = h('div', { id: 'us-cc-backdrop', 'data-us-cc': 'backdrop', onclick: function () { Panel.close(); } });
    document.body.appendChild(bd);
    this.backdrop = bd;

    var listContainer = h('div', { class: 'us-p-feature-list' });
    for (var i = 0; i < features.length; i++) {
      var listRow = features[i].getListRow();
      if (!listRow) continue;
      listRow.dataset.featureIndex = String(i);
      listRow.addEventListener('click', function (e) {
        if (e.target.closest('.us-switch')) return;
        self._showScreen(parseInt(e.currentTarget.dataset.featureIndex, 10));
      });
      listContainer.appendChild(listRow);
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
    for (var j = 0; j < features.length; j++) {
      var screen = features[j].getScreen();
      if (screen && screen.el) panelChildren.push(screen.el);
    }
    var p = h.apply(null, ['div', { id: 'us-cc-panel', 'data-us-cc': 'panel' }].concat(panelChildren));
    document.body.appendChild(p);
    this.el = p;
    this._screenList = screenList;
    this._features = features;
    this._screens = features.map(function (f) { return f.getScreen(); });

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
    if (this._features[index] && this._features[index].getScreen && this._features[index].getScreen().onShow) {
      this._features[index].getScreen().onShow();
    }
  },

  _bindEvents: function () {
    var self = this;
    var closeTimer = null;
    this.el.addEventListener('mouseleave', function () {
      closeTimer = setTimeout(function () {
        if (window.ProfileColorPopover && window.ProfileColorPopover.backdrop && window.ProfileColorPopover.backdrop.classList.contains('us-visible')) return;
        if (window.ChipColorPopover && window.ChipColorPopover.backdrop && window.ChipColorPopover.backdrop.classList.contains('us-visible')) return;
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
      if (this.backdrop && this.backdrop.parentNode) this.backdrop.parentNode.removeChild(this.backdrop);
      if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
      this.el = null;
      this.backdrop = null;
      this._screenList = null;
      this._features = null;
      this._screens = null;
    }
    if (!this.el || !this._features || this._features.length === 0) runMain();
    this._showList();
    var i;
    for (i = 0; i < (this._features || []).length; i++) {
      if (this._features[i] && typeof this._features[i].onPanelOpen === 'function') this._features[i].onPanelOpen();
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

window.Panel = Panel;

window.UserScripts = window.UserScripts || {};
window.UserScripts.version = US_VERSION;
window.UserScripts.init = function () { console.log('[UserScripts] Core initialized'); };
window.UserScripts.features = window.UserScripts.features || {};
window.UserScripts.features.colorCustomizer = ColorCustomizerFeature;

window.US = window.US || {};
window.US.rpc = RPC;

(async function () {
  try {
    await ColorCustomizerFeature.init();
    console.log('[UserScripts] Auto-init complete');
  } catch (e) {
    console.error('[UserScripts] Auto-init failed:', e);
  }
  runMain();
})();

export { RPC, h, createGearNode, Panel, US_VERSION };
