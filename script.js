/**
 * UserScript – Element-based Color Customizer (Phase 1)
 *
 * Lets users click individual page elements and change their colors.
 * Rules are persisted per-site via GM_* RPC and auto-applied on revisit.
 */
(function () {
  if (window.location.hostname === '127.0.0.1') return;

  function runMain() {
    var RPC = window.RPC, h = window.h, makeSvg = window.makeSvg, createGearNode = window.createGearNode;
    if (!RPC || !h) {
      console.error('[UserScripts] util.js did not load (RPC/h missing). Aborting runMain.');
      return;
    }

var US_VERSION = '1.7.0-dev.41';
console.log('%c[UserScripts] script.js loaded – v' + US_VERSION + ' %c' + new Date().toLocaleTimeString(), 'color:#60a5fa;font-weight:bold', 'color:#888');

// =========================

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
  _activeDataFillerTab: 'page',
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

    var switchLabelDataFiller = document.createElement('label');
    switchLabelDataFiller.className = 'us-switch';
    switchLabelDataFiller.setAttribute('data-us-cc', 'switch');
    switchLabelDataFiller.appendChild(h('input', { type: 'checkbox', id: 'us-p-feature-dataFiller-toggle' }));
    switchLabelDataFiller.appendChild(h('span.us-slider'));
    var dataFillerIcon = h('div.us-p-feature-icon', document.createTextNode('CSV'));
    var dataFillerLabel = h('span.us-p-feature-label', 'data', h('span.us-title-editor', 'Filler'));
    var dataFillerRight = h('div.us-p-feature-right',
      switchLabelDataFiller,
      h('span.us-p-feature-chevron', '\u203A')
    );
    var dataFillerRow = h('div', { class: 'us-p-feature-row', 'data-feature': 'dataFiller' },
      dataFillerIcon,
      dataFillerLabel,
      dataFillerRight
    );

    var screenList = h('div', { class: 'us-p-screen us-p-screen-visible', 'data-us-cc': 'screen-list' },
      h('div.us-p-list-header',
        h('span.us-p-list-header-gear', { 'aria-hidden': 'true' }, createGearNode()),
        h('span.us-p-title', '設定')
      ),
      h('div.us-p-feature-list', featureRow, dataFillerRow)
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

    var dfMainToggleLabel = document.createElement('label');
    dfMainToggleLabel.className = 'us-switch';
    dfMainToggleLabel.setAttribute('data-us-cc', 'switch');
    dfMainToggleLabel.appendChild(h('input', { type: 'checkbox', id: 'us-p-df-main-toggle' }));
    dfMainToggleLabel.appendChild(h('span.us-slider'));
    var dfDetailIcon = h('div.us-p-detail-icon', document.createTextNode('CSV'));
    var dfTabPage = h('button.us-p-tab-btn.active', { id: 'us-p-df-tab-page', type: 'button', 'data-df-tab': 'page' }, 'このページ (0)');
    var dfTabOther = h('button.us-p-tab-btn', { id: 'us-p-df-tab-other', type: 'button', 'data-df-tab': 'other' }, 'その他 (0)');
    var screenDataFiller = h('div', { class: 'us-p-screen', 'data-us-cc': 'screen-dataFiller' },
      h('div.us-p-detail-header',
        h('div.us-p-detail-header-row',
          h('button.us-p-nav-back', { type: 'button', 'data-df-back': '1' }, '\u2039 \u8a2d\u5b9a')
        ),
        h('div.us-p-detail-header-row',
          dfDetailIcon,
          h('span.us-p-title', 'data', h('span.us-title-editor', 'Filler')),
          h('span.us-p-header-toggle', dfMainToggleLabel)
        )
      ),
      h('div.us-p-tabs', dfTabPage, dfTabOther),
      h('div.us-p-section-title', { 'data-us-cc': 'section' },
        h('span', 'フォーム要素（クリックで追加）'),
        h('button', { id: 'us-p-df-template-dl', title: 'CSVテンプレートをダウンロード', class: 'us-p-df-template-btn' }, '\u2B07')
      ),
      h('div.us-p-df-steps-wrap',
        h('div.us-p-df-steps', { id: 'us-p-df-steps' }),
        h('span.us-p-empty', { id: 'us-p-df-empty' }, 'dataFillerをONにしてフォーム要素をクリックすると追加されます')
      )
    );

    var p = h('div', { id: 'us-cc-panel', 'data-us-cc': 'panel' }, screenList, screenColorEditor, screenDataFiller);
    document.body.appendChild(p);
    this.el = p;
    this._screenList = screenList;
    this._screenColorEditor = screenColorEditor;
    this._screenDataFiller = screenDataFiller;

    this._ensureImportToast();
    this._bindEvents();
  },

  _showList: function () {
    if (this._screenList) this._screenList.classList.add('us-p-screen-visible');
    if (this._screenColorEditor) this._screenColorEditor.classList.remove('us-p-screen-visible');
    if (this._screenDataFiller) this._screenDataFiller.classList.remove('us-p-screen-visible');
    this.syncColorEditorToggle();
  },

  _showColorEditor: function () {
    if (this._screenList) this._screenList.classList.remove('us-p-screen-visible');
    if (this._screenColorEditor) this._screenColorEditor.classList.add('us-p-screen-visible');
    if (this._screenDataFiller) this._screenDataFiller.classList.remove('us-p-screen-visible');
    this.refreshRules();
    this.refreshProfiles();
    var editToggle = this._screenColorEditor && this._screenColorEditor.querySelector('#us-p-edit-toggle');
    if (editToggle) editToggle.checked = EditMode.active;
  },

  _showDataFiller: function () {
    if (this._screenList) this._screenList.classList.remove('us-p-screen-visible');
    if (this._screenColorEditor) this._screenColorEditor.classList.remove('us-p-screen-visible');
    if (this._screenDataFiller) this._screenDataFiller.classList.add('us-p-screen-visible');
    this._activeDataFillerTab = 'page';
    DataFiller.load().then(function () { Panel.refreshDataFillerSteps(); });
    var listDfToggle = this._screenList && this._screenList.querySelector('#us-p-feature-dataFiller-toggle');
    var mainToggle = this._screenDataFiller && this._screenDataFiller.querySelector('#us-p-df-main-toggle');
    if (mainToggle && listDfToggle) mainToggle.checked = listDfToggle.checked;
    if (mainToggle && mainToggle.checked) DataFiller.enableCapture(); else DataFiller.disableCapture();
  },

  refreshDataFillerSteps: async function () {
    if (!this._screenDataFiller) return;
    var emptyEl = this._screenDataFiller.querySelector('#us-p-df-empty');
    var stepsEl = this._screenDataFiller.querySelector('#us-p-df-steps');
    var tabPage = this._screenDataFiller.querySelector('#us-p-df-tab-page');
    var tabOther = this._screenDataFiller.querySelector('#us-p-df-tab-other');
    if (!stepsEl) return;
    var self = this;
    var currentKey = 'userscripts:features:dataFiller:page:' + encodeURIComponent(window.location.hostname + window.location.pathname);
    var hostname = window.location.hostname;
    var prefix = 'userscripts:features:dataFiller:page:';

    function compareXPathByHierarchy(a, b) {
      var segA = (a || '').split('/');
      var segB = (b || '').split('/');
      for (var i = 0; i < Math.max(segA.length, segB.length); i++) {
        var sa = segA[i] || '';
        var sb = segB[i] || '';
        var c = sa.localeCompare(sb);
        if (c !== 0) return c;
      }
      return 0;
    }
    /* XPath 階層でソート（DOM の並びに近い順。同じ XPath は隣同士になり重複が分かりやすい） */
    var thisPageSteps = (DataFiller.getSteps() || []).map(function (step, i) { return { step: step, originalIndex: i }; });
    thisPageSteps.sort(function (a, b) {
      var c = compareXPathByHierarchy(a.step.xpath, b.step.xpath);
      if (c !== 0) return c;
      return (a.step.logicalName || '').localeCompare(b.step.logicalName || '');
    });

    var otherPages = [];
    try {
      var byPrefix = await RPC.call('storage.getAllByPrefix', [prefix]);
      if (byPrefix && typeof byPrefix === 'object') {
        Object.keys(byPrefix).forEach(function (k) {
          if (k === currentKey) return;
          var decoded = '';
          try { decoded = decodeURIComponent(k.slice(prefix.length)); } catch (e) { return; }
          if (decoded !== hostname && decoded.indexOf(hostname + '/') !== 0) return;
          var val = byPrefix[k];
          if (!val || !Array.isArray(val.steps)) return;
          var pagePath = decoded === hostname ? '/' : decoded.slice(hostname.length) || '/';
          var list = val.steps.map(function (s, idx) { return { step: s, originalIndex: idx }; });
          list.sort(function (a, b) {
            var c = compareXPathByHierarchy(a.step.xpath, b.step.xpath);
            if (c !== 0) return c;
            return (a.step.logicalName || '').localeCompare(b.step.logicalName || '');
          });
          otherPages.push({ pagePath: pagePath, steps: list });
        });
      }
    } catch (e) { console.warn('[DataFiller] getAllByPrefix failed:', e); }
    otherPages.sort(function (a, b) { return (a.pagePath || '').localeCompare(b.pagePath || ''); });

    var otherCount = otherPages.reduce(function (sum, g) { return sum + g.steps.length; }, 0);
    if (tabPage) tabPage.textContent = 'このページ (' + thisPageSteps.length + ')';
    if (tabOther) tabOther.textContent = 'その他 (' + otherCount + ')';
    if (tabPage) tabPage.classList.toggle('active', self._activeDataFillerTab === 'page');
    if (tabOther) tabOther.classList.toggle('active', self._activeDataFillerTab === 'other');

    while (stepsEl.firstChild) stepsEl.removeChild(stepsEl.firstChild);

    function xpathCounts(list) {
      var counts = {};
      list.forEach(function (w) {
        var x = (w.step && w.step.xpath) || '';
        counts[x] = (counts[x] || 0) + 1;
      });
      return counts;
    }

    if (self._activeDataFillerTab === 'page') {
      if (emptyEl) emptyEl.style.display = thisPageSteps.length ? 'none' : 'block';
      var counts = xpathCounts(thisPageSteps);
      var seenXpath = {};
      thisPageSteps.forEach(function (w) {
        var step = w.step;
        var shortX = step.xpath.length > 36 ? '…' + step.xpath.slice(-34) : step.xpath;
        var isFirstOfXpath = !seenXpath[step.xpath];
        seenXpath[step.xpath] = true;
        var isDup = (counts[step.xpath] || 0) > 1 && !isFirstOfXpath;
        var reqCls = step.required === false ? 'us-p-df-step-required.us-p-df-step-req-optional' : 'us-p-df-step-required.us-p-df-step-req-required';
        var reqText = step.required === false ? '任意' : '必須';
        var row = h('div', { class: 'us-p-df-step' + (isDup ? ' us-p-df-step-duplicate' : '') },
          h('span.us-p-df-step-type', step.type),
          isDup ? h('span.us-p-df-step-dup-badge', '重複') : null,
          h('span.us-p-df-step-name', { title: step.logicalName }, step.logicalName),
          h('span.' + reqCls, reqText),
          h('span.us-p-df-step-xpath', { title: step.xpath }, shortX),
          h('button.us-p-df-step-del', { type: 'button', 'data-df-index': String(w.originalIndex), title: '削除' }, '\u2715')
        );
        row.addEventListener('click', function (e) {
          if (e.target.closest('.us-p-df-step-del')) return;
          RPC.call('clipboard.setText', [step.xpath]).catch(function () {});
        });
        var delBtn = row.querySelector('.us-p-df-step-del');
        if (delBtn) delBtn.addEventListener('click', function (e) { e.stopPropagation(); DataFiller.removeStep(w.originalIndex); self.refreshDataFillerSteps(); });
        stepsEl.appendChild(row);
      });
    } else {
      if (emptyEl) emptyEl.style.display = 'none';
      if (otherCount === 0) {
        stepsEl.appendChild(h('span.us-p-empty', '同じドメインの他ページの定義はありません'));
        return;
      }
      var allOther = [];
      otherPages.forEach(function (g) {
        g.steps.forEach(function (w) { allOther.push({ step: w.step, pagePath: g.pagePath }); });
      });
      var otherCounts = {};
      allOther.forEach(function (w) {
        var x = (w.step && w.step.xpath) || '';
        otherCounts[x] = (otherCounts[x] || 0) + 1;
      });
      otherPages.forEach(function (g) {
        stepsEl.appendChild(h('div.us-p-df-other-head', g.pagePath));
        var seenOther = {};
        g.steps.forEach(function (w) {
          var step = w.step;
          var shortX = step.xpath.length > 36 ? '…' + step.xpath.slice(-34) : step.xpath;
          var isFirstOfXpath = !seenOther[step.xpath];
          seenOther[step.xpath] = true;
          var isDup = (otherCounts[step.xpath] || 0) > 1 && !isFirstOfXpath;
          var reqClsOther = step.required === false ? 'us-p-df-step-required.us-p-df-step-req-optional' : 'us-p-df-step-required.us-p-df-step-req-required';
          var reqTextOther = step.required === false ? '任意' : '必須';
          var row = h('div', { class: 'us-p-df-step us-p-df-step-other' + (isDup ? ' us-p-df-step-duplicate' : '') },
            h('span.us-p-df-step-type', step.type),
            isDup ? h('span.us-p-df-step-dup-badge', '重複') : null,
            h('span.us-p-df-step-name', { title: step.logicalName }, step.logicalName),
            h('span.' + reqClsOther, reqTextOther),
            h('span.us-p-df-step-xpath', { title: step.xpath }, shortX)
          );
          row.addEventListener('click', function (e) {
            RPC.call('clipboard.setText', [step.xpath]).catch(function () {});
          });
          stepsEl.appendChild(row);
        });
      });
    }
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
      var dfRow = this._screenList.querySelector('[data-feature="dataFiller"]');
      if (dfRow) {
        dfRow.addEventListener('click', function (e) {
          if (e.target.closest('.us-switch')) return;
          self._showDataFiller();
        });
      }
      var dfListToggle = this._screenList.querySelector('#us-p-feature-dataFiller-toggle');
      if (dfListToggle) {
        dfListToggle.addEventListener('click', function (e) { e.stopPropagation(); });
        dfListToggle.addEventListener('change', function () {
          RPC.call('storage.set', ['userscripts:features:dataFiller:enabled', this.checked]).catch(function () {});
          if (this.checked) DataFiller.enableCapture(); else DataFiller.disableCapture();
        });
      }
      var listToggle = this._screenList.querySelector('#us-p-feature-colorEditor-toggle');
      if (listToggle) {
        listToggle.addEventListener('click', function (e) { e.stopPropagation(); });
        listToggle.checked = EditMode.active;
        listToggle.addEventListener('change', function () {
          if (this.checked) {
            EditMode.enable();
          } else {
            EditMode.disable();
            Tab.setAggregate(false, false);
          }
          var editT = self._screenColorEditor && self._screenColorEditor.querySelector('#us-p-edit-toggle');
          if (editT) editT.checked = EditMode.active;
        });
      }
    }

    if (this._screenColorEditor) {
      var backBtn = this._screenColorEditor.querySelector('.us-p-nav-back');
      if (backBtn) backBtn.addEventListener('click', function () { self._showList(); });
    }
    if (this._screenDataFiller) {
      var dfBack = this._screenDataFiller.querySelector('[data-df-back="1"]');
      if (dfBack) dfBack.addEventListener('click', function () { self._showList(); });
      var dfMainToggle = this._screenDataFiller.querySelector('#us-p-df-main-toggle');
      if (dfMainToggle) dfMainToggle.addEventListener('change', function () {
        var listT = self._screenList && self._screenList.querySelector('#us-p-feature-dataFiller-toggle');
        if (listT) listT.checked = this.checked;
        RPC.call('storage.set', ['userscripts:features:dataFiller:enabled', this.checked]).catch(function () {});
        if (this.checked) DataFiller.enableCapture(); else DataFiller.disableCapture();
      });
      var dfTemplateDl = this._screenDataFiller.querySelector('#us-p-df-template-dl');
      if (dfTemplateDl) dfTemplateDl.addEventListener('click', function () { DataFiller.exportCSVTemplate(); });
      var dfTabPage = this._screenDataFiller.querySelector('#us-p-df-tab-page');
      var dfTabOther = this._screenDataFiller.querySelector('#us-p-df-tab-other');
      if (dfTabPage) dfTabPage.addEventListener('click', function () {
        self._activeDataFillerTab = 'page';
        dfTabPage.classList.add('active');
        if (dfTabOther) dfTabOther.classList.remove('active');
        self.refreshDataFillerSteps();
      });
      if (dfTabOther) dfTabOther.addEventListener('click', function () {
        self._activeDataFillerTab = 'other';
        dfTabOther.classList.add('active');
        if (dfTabPage) dfTabPage.classList.remove('active');
        self.refreshDataFillerSteps();
      });
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
      var listT = self._screenList && self._screenList.querySelector('#us-p-feature-colorEditor-toggle');
      if (listT) listT.checked = EditMode.active;
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

  syncColorEditorToggle: function () {
    var listToggle = this._screenList && this._screenList.querySelector('#us-p-feature-colorEditor-toggle');
    var editToggle = this._screenColorEditor && this._screenColorEditor.querySelector('#us-p-edit-toggle');
    if (listToggle) listToggle.checked = EditMode.active;
    if (editToggle) editToggle.checked = EditMode.active;
    // When panel is open, treat toggle as source of truth: if OFF, force EditMode off
    if (listToggle && !listToggle.checked && EditMode.active) EditMode.disable();
  },

  open: async function () {
    this._create();
    this._showList();
    this.syncColorEditorToggle();
    var dfEnabled = false;
    try { dfEnabled = await RPC.call('storage.get', ['userscripts:features:dataFiller:enabled', false]); } catch (e) {}
    var dfToggle = this._screenList && this._screenList.querySelector('#us-p-feature-dataFiller-toggle');
    var mainToggle = this._screenDataFiller && this._screenDataFiller.querySelector('#us-p-df-main-toggle');
    if (dfToggle) dfToggle.checked = !!dfEnabled;
    if (mainToggle) mainToggle.checked = !!dfEnabled;
    if (dfEnabled) DataFiller.enableCapture(); else DataFiller.disableCapture();

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
// 10b. DataFiller (CSV auto-filler) – module
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
})();

// ESM export (keeps module semantics for jsDelivr)
export { };
