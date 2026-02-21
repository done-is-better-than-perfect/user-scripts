/**
 * DataFiller module – CSV auto-filler (form field capture + template export).
 * Factory: createDataFiller(RPC, h, getPanel) where getPanel() returns Panel.
 */
(function (global) {
  'use strict';

  function createDataFiller(RPC, h, getPanel) {

  function getXPath(el) {
    if (!el || !el.ownerDocument) return '';
    if (el.id) return '//*[@id="' + el.id + '"]';
    var parts = [];
    var current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      var idx = 1;
      var sibling = current.previousSibling;
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === current.tagName) idx++;
        sibling = sibling.previousSibling;
      }
      var tag = current.tagName.toLowerCase();
      var part = idx > 1 ? tag + '[' + idx + ']' : tag;
      parts.unshift(part);
      current = current.parentNode;
    }
    return '/' + parts.join('/');
  }

  function getElementType(el) {
    if (!el || !el.tagName) return 'unknown';
    var tag = el.tagName.toLowerCase();
    if (tag === 'input') {
      var t = (el.type || 'text').toLowerCase();
      if (t === 'checkbox' || t === 'radio') return t;
      if (t === 'file') return 'file';
      if (t === 'submit' || t === 'button' || t === 'image') return 'button';
      return 'text';
    }
    if (tag === 'select') return 'select';
    if (tag === 'textarea') return 'textarea';
    if (tag === 'button') return 'button';
    return 'unknown';
  }

  /** プレフィル用: フォーム要素に紐づく <label> の textContent のみ取得。最大10世代親を遡り、兄弟および兄弟の子孫の label を検索。
   *  label に for がある場合は、その値が el.id と一致するときのみ採用。for が無い場合は従来どおり。span/div は対象にしない。
   *  input type=radio / checkbox の場合は、「この input を包む label」と「for が el.id と一致する label」のみ対象外とし、それ以外の label（例: グループ見出し）はプレフィルに使用する。 */
  function getLabelNearElement(el) {
    if (!el || !el.ownerDocument) return '';
    var doc = el.ownerDocument;
    var maxLen = 80;
    var maxAncestors = 10;
    var isRadioOrCheckbox = el.tagName && el.tagName.toLowerCase() === 'input' && (el.type === 'radio' || el.type === 'checkbox');
    function trim(s) {
      if (typeof s !== 'string') return '';
      return s.replace(/\s+/g, ' ').trim().slice(0, maxLen);
    }
    function isLabelRelevant(labelEl) {
      if (!labelEl || labelEl.tagName.toLowerCase() !== 'label') return true;
      if (labelEl.contains && labelEl.contains(el)) return false;
      var forId = labelEl.getAttribute('for');
      if (isRadioOrCheckbox) {
        if (labelEl === el.parentElement) return false;
        if (forId != null && forId !== '') return false;
        if (labelEl.querySelector && labelEl.querySelector('input, select, textarea')) return false;
        return true;
      }
      if (forId == null || forId === '') return true;
      return el.id === forId;
    }
    function labelTextFromNode(container) {
      if (!container || !container.querySelectorAll) return '';
      var labels = container.querySelectorAll('label');
      for (var i = 0; i < labels.length; i++) {
        var lb = labels[i];
        if (!isLabelRelevant(lb)) continue;
        if (lb.textContent) return trim(lb.textContent);
      }
      return '';
    }
    var id = el.id;
    if (id && !isRadioOrCheckbox) {
      try {
        var labelFor = doc.querySelector('label[for="' + id.replace(/"/g, '\\"') + '"]');
        if (labelFor && labelFor.textContent) return trim(labelFor.textContent);
      } catch (e) {}
    }
    var node = el;
    for (var gen = 0; gen < maxAncestors && node; gen++) {
      if (node.tagName && node.tagName.toLowerCase() === 'label') {
        if (!isLabelRelevant(node)) { node = node.parentElement || node.parentNode; continue; }
        var clone = node.cloneNode(true);
        var input = clone.querySelector('input, select, textarea');
        if (input) input.remove();
        if (clone.textContent) return trim(clone.textContent);
      }
      var prev = node.previousElementSibling;
      if (prev) {
        var t = '';
        if (prev.tagName && prev.tagName.toLowerCase() === 'label') {
          if (isLabelRelevant(prev)) t = trim(prev.textContent);
        } else {
          t = labelTextFromNode(prev);
        }
        if (t) return t;
      }
      var next = node.nextElementSibling;
      if (next) {
        var t = '';
        if (next.tagName && next.tagName.toLowerCase() === 'label') {
          if (isLabelRelevant(next)) t = trim(next.textContent);
        } else {
          t = labelTextFromNode(next);
        }
        if (t) return t;
      }
      node = node.parentElement || node.parentNode;
    }
    return '';
  }

  /** 要素の直接の子であるテキストノードのみを連結（子要素の textContent は含めない）。 */
  function getDirectText(el) {
    if (!el || !el.childNodes || !el.childNodes.length) return '';
    var parts = [];
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n && n.nodeType === Node.TEXT_NODE && n.textContent) parts.push(n.textContent);
    }
    return parts.join('').replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  /** フォーム要素から最大10階層遡り、span / div からテキスト候補を収集。select 内（option）は除外。span/div は直接のテキストのみ。
   *  includeLabelInCandidates が true のときのみ label も候補に含める（プレフィル取得できなかった場合に呼び出し側で true を渡す）。
   *  label に for がある場合は、その値が hover したフォームの id と一致するときのみ候補に含める。
   *  div の兄弟として見つかった div については、その子孫の span（および includeLabel 時は label）も候補に含める。 */
  function getTextCandidatesFromForm(formEl, includeLabelInCandidates) {
    if (!formEl || !formEl.ownerDocument) return [];
    var maxLen = 80;
    var maxAncestors = 10;
    var includeLabel = !!includeLabelInCandidates;
    function trim(s) {
      if (typeof s !== 'string') return '';
      return s.replace(/\s+/g, ' ').trim().slice(0, maxLen);
    }
    function skipNode(node) {
      return node.closest && node.closest('select');
    }
    function isLabelRelevant(labelEl) {
      if (!labelEl || labelEl.tagName.toLowerCase() !== 'label') return true;
      var forId = labelEl.getAttribute('for');
      var isRadioOrCheckbox = formEl.tagName && formEl.tagName.toLowerCase() === 'input' && (formEl.type === 'radio' || formEl.type === 'checkbox');
      if (isRadioOrCheckbox) {
        if (labelEl.contains && labelEl.contains(formEl)) return false;
        if (labelEl === formEl.parentElement) return false;
        if (forId != null && forId !== '' && formEl.id === forId) return false;
        if (labelEl.querySelector && labelEl.querySelector('input, select, textarea')) return false;
        return true;
      }
      if (forId == null || forId === '') return true;
      return formEl.id === forId;
    }
    function getTextForNode(nd, tag) {
      if (!nd || !nd.tagName) return '';
      var tagName = nd.tagName.toLowerCase();
      if (tagName !== tag) return '';
      if (skipNode(nd)) return '';
      if (tag === 'label') return trim((nd.textContent || '').slice(0, maxLen));
      return trim(getDirectText(nd));
    }
    function addCandidatesFromDiv(container) {
      if (!container || container.tagName.toLowerCase() !== 'div') return;
      if (skipNode(container)) return;
      var spans = container.querySelectorAll('span');
      var i;
      for (i = 0; i < spans.length; i++) {
        var st = trim((spans[i].textContent || '').slice(0, maxLen));
        if (st && !seen[st]) { seen[st] = true; withType.push({ text: st, type: 'span' }); }
      }
      if (includeLabel) {
        var labels = container.querySelectorAll('label');
        for (i = 0; i < labels.length; i++) {
          var lb = labels[i];
          if (!isLabelRelevant(lb)) continue;
          var lt = trim((lb.textContent || '').slice(0, maxLen));
          if (lt && !seen[lt]) { seen[lt] = true; withType.push({ text: lt, type: 'label' }); }
        }
      }
    }
    var seen = {};
    var withType = [];
    var node = formEl;
    for (var level = 0; level <= maxAncestors && node; level++) {
      if (skipNode(node)) { node = node.parentElement || node.parentNode; continue; }
      var tag = node.tagName && node.tagName.toLowerCase();
      if (tag === 'label' || tag === 'span' || tag === 'div') {
        if (tag === 'label') {
          if (!includeLabel || !isLabelRelevant(node)) continue;
        }
        var t = getTextForNode(node, tag);
        if (t && !seen[t]) { seen[t] = true; withType.push({ text: t, type: tag }); }
        if (tag === 'div') addCandidatesFromDiv(node);
      }
      var prev = node.previousElementSibling;
      if (prev && !skipNode(prev) && prev.tagName && /^(label|span|div)$/i.test(prev.tagName)) {
        if (prev.tagName.toLowerCase() === 'label') {
          if (includeLabel && isLabelRelevant(prev)) {
            var tp = getTextForNode(prev, 'label');
            if (tp && !seen[tp]) { seen[tp] = true; withType.push({ text: tp, type: 'label' }); }
          }
        } else {
          var tp = getTextForNode(prev, prev.tagName.toLowerCase());
          if (tp && !seen[tp]) { seen[tp] = true; withType.push({ text: tp, type: prev.tagName.toLowerCase() }); }
        }
        if (prev.tagName && prev.tagName.toLowerCase() === 'div') addCandidatesFromDiv(prev);
      }
      var next = node.nextElementSibling;
      if (next && !skipNode(next) && next.tagName && /^(label|span|div)$/i.test(next.tagName)) {
        if (next.tagName.toLowerCase() === 'label') {
          if (includeLabel && isLabelRelevant(next)) {
            var tn = getTextForNode(next, 'label');
            if (tn && !seen[tn]) { seen[tn] = true; withType.push({ text: tn, type: 'label' }); }
          }
        } else {
          var tn = getTextForNode(next, next.tagName.toLowerCase());
          if (tn && !seen[tn]) { seen[tn] = true; withType.push({ text: tn, type: next.tagName.toLowerCase() }); }
        }
        if (next.tagName && next.tagName.toLowerCase() === 'div') addCandidatesFromDiv(next);
      }
      node = node.parentElement || node.parentNode;
    }
    var order = { label: 0, span: 1, div: 2 };
    withType.sort(function (a, b) { return (order[a.type] || 3) - (order[b.type] || 3); });
    return withType.map(function (x) { return x.text; });
  }

  /** label 要素から紐づくフォーム要素を取得（子または for 先）。 */
  function getControlFromLabel(labelEl) {
    if (!labelEl || !labelEl.tagName || labelEl.tagName.toLowerCase() !== 'label') return null;
    var doc = labelEl.ownerDocument;
    var forId = labelEl.getAttribute('for');
    if (forId) {
      var ctrl = doc.getElementById(forId);
      if (ctrl && /^(input|select|textarea)$/i.test(ctrl.tagName)) return ctrl;
    }
    return labelEl.querySelector('input, select, textarea') || null;
  }

  /** radio / checkbox の同一グループ内の取り得る値（各選択肢のラベル文字列）を配列で返す。 */
  function getRadioCheckboxOptions(el) {
    if (!el || !el.ownerDocument) return [];
    var tag = el.tagName && el.tagName.toLowerCase();
    var type = (el.type || '').toLowerCase();
    if (tag !== 'input' || (type !== 'radio' && type !== 'checkbox')) return [];
    var name = el.name;
    if (name == null || name === '') return [];
    var doc = el.ownerDocument;
    var all = doc.querySelectorAll('input[type="' + type + '"]');
    var inputs = [];
    for (var k = 0; k < all.length; k++) { if (all[k].name === name) inputs.push(all[k]); }
    var maxLen = 80;
    function trim(s) {
      if (typeof s !== 'string') return '';
      return s.replace(/\s+/g, ' ').trim().slice(0, maxLen);
    }
    var seen = {};
    var options = [];
    for (var i = 0; i < inputs.length; i++) {
      var inp = inputs[i];
      var text = '';
      var labelEl = null;
      if (inp.id) {
        try {
          labelEl = doc.querySelector('label[for="' + inp.id.replace(/"/g, '\\"') + '"]');
        } catch (e) {}
      }
      if (labelEl && labelEl.textContent) {
        text = trim(labelEl.textContent);
      } else if (inp.parentElement && inp.parentElement.tagName && inp.parentElement.tagName.toLowerCase() === 'label') {
        var clone = inp.parentElement.cloneNode(true);
        var ctrl = clone.querySelector('input, select, textarea');
        if (ctrl) ctrl.remove();
        if (clone.textContent) text = trim(clone.textContent);
      }
      if (text === '') text = (inp.value != null && inp.value !== '') ? trim(String(inp.value)) : '';
      if (text !== '' && !seen[text]) { seen[text] = true; options.push(text); }
    }
    return options;
  }

  function _storageKey() {
    return 'userscripts:features:dataFiller:page:' + encodeURIComponent(window.location.hostname + window.location.pathname);
  }

  /** select にラベルがないときの項目名フォールバック: 第一 option のテキスト、なければ 'select'。 */
  function getSelectSuggestedFallback(selectEl) {
    if (!selectEl || selectEl.tagName.toLowerCase() !== 'select') return 'select';
    var first = selectEl.options && selectEl.options[0];
    var t = first && (first.textContent || first.text);
    if (typeof t === 'string' && t.trim()) return t.replace(/\s+/g, ' ').trim().slice(0, 80);
    return 'select';
  }

  function refreshPanel() {
    var panel = getPanel();
    if (panel && panel._screenDataFiller) panel.refreshDataFillerSteps();
  }

  return {
    _boundClick: null,

    getSteps: function () { return this._steps || []; },
    _steps: [],

    load: async function () {
      try {
        var data = await RPC.call('storage.get', [_storageKey(), null]);
        this._steps = (data && Array.isArray(data.steps)) ? data.steps : [];
        return this._steps;
      } catch (e) {
        console.warn('[DataFiller] load failed:', e);
        this._steps = [];
        return this._steps;
      }
    },

    save: async function (steps) {
      this._steps = steps || this._steps;
      try {
        await RPC.call('storage.set', [_storageKey(), { steps: this._steps }]);
      } catch (e) {
        console.warn('[DataFiller] save failed:', e);
      }
    },

    _promptEl: null,

    _showLogicalNamePrompt: function (suggested, onOk, onCancel) {
      var self = this;
      var backdrop = h('div', { class: 'us-df-prompt-backdrop', 'data-us-cc': 'df-prompt' });
      var box = h('div', { class: 'us-df-prompt-box' },
        h('div', { class: 'us-df-prompt-title' }, '項目名'),
        h('input', { type: 'text', class: 'us-df-prompt-input', placeholder: '例: メールアドレス', value: suggested || '' }),
        h('div', { class: 'us-df-prompt-actions' },
          h('button', { type: 'button', class: 'us-df-prompt-btn us-df-prompt-cancel' }, 'キャンセル'),
          h('button', { type: 'button', class: 'us-df-prompt-btn us-df-prompt-ok' }, 'OK')
        )
      );
      backdrop.appendChild(box);
      var input = box.querySelector('.us-df-prompt-input');
      var okBtn = box.querySelector('.us-df-prompt-ok');
      var cancelBtn = box.querySelector('.us-df-prompt-cancel');

      function finish(confirmed, value) {
        if (!backdrop.parentNode) return;
        backdrop.removeEventListener('click', onBackdropClick);
        okBtn.removeEventListener('click', onOkClick);
        cancelBtn.removeEventListener('click', onCancelClick);
        document.removeEventListener('keydown', onKeydown);
        backdrop.classList.remove('us-df-prompt-visible');
        setTimeout(function () {
          if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        }, 200);
        if (confirmed) onOk(value !== undefined ? value : '');
        else onCancel();
      }

      function onBackdropClick(e) {
        if (e.target === backdrop) finish(false);
      }
      function onOkClick() {
        var val = (input.value || '').trim();
        finish(true, val);
      }
      function onCancelClick() {
        finish(false);
      }
      function onKeydown(e) {
        if (e.key === 'Escape') finish(false);
        if (e.key === 'Enter') onOkClick();
      }

      backdrop.addEventListener('click', onBackdropClick);
      okBtn.addEventListener('click', onOkClick);
      cancelBtn.addEventListener('click', onCancelClick);
      document.addEventListener('keydown', onKeydown);
      document.body.appendChild(backdrop);
      requestAnimationFrame(function () {
        backdrop.classList.add('us-df-prompt-visible');
        input.focus();
        input.select();
      });
      this._promptEl = backdrop;
    },

    _showAlert: function (message, onClose) {
      var backdrop = h('div', { class: 'us-df-prompt-backdrop', 'data-us-cc': 'df-prompt' });
      var actions = h('div', { class: 'us-df-prompt-actions' },
        h('button', { type: 'button', class: 'us-df-prompt-btn us-df-prompt-ok' }, 'OK')
      );
      var box = h('div', { class: 'us-df-prompt-box' },
        h('div', { class: 'us-df-dialog-message' }, message),
        actions
      );
      backdrop.appendChild(box);
      var okBtn = box.querySelector('.us-df-prompt-ok');
      function close() {
        if (!backdrop.parentNode) return;
        backdrop.removeEventListener('click', onBackdropClick);
        okBtn.removeEventListener('click', onOkClick);
        document.removeEventListener('keydown', onKeydown);
        backdrop.classList.remove('us-df-prompt-visible');
        setTimeout(function () {
          if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        }, 200);
        if (onClose) onClose();
      }
      function onBackdropClick(e) { if (e.target === backdrop) close(); }
      function onOkClick() { close(); }
      function onKeydown(e) { if (e.key === 'Escape' || e.key === 'Enter') close(); }
      backdrop.addEventListener('click', onBackdropClick);
      okBtn.addEventListener('click', onOkClick);
      document.addEventListener('keydown', onKeydown);
      document.body.appendChild(backdrop);
      requestAnimationFrame(function () { backdrop.classList.add('us-df-prompt-visible'); okBtn.focus(); });
    },

    _showConfirm: function (existingName, newName, onConfirm, onCancel) {
      var msg = h('div', { class: 'us-df-dialog-message' });
      msg.appendChild(h('div', { class: 'us-df-dialog-line us-df-dialog-intro' }, 'すでに違う項目名で登録済みです。'));
      msg.appendChild(h('div', { class: 'us-df-dialog-label' }, '登録済みの項目名'));
      msg.appendChild(h('div', { class: 'us-df-dialog-value' }, existingName || ''));
      msg.appendChild(h('div', { class: 'us-df-dialog-label' }, '登録しようとしている項目名'));
      msg.appendChild(h('div', { class: 'us-df-dialog-value' }, newName || ''));
      msg.appendChild(h('div', { class: 'us-df-dialog-line us-df-dialog-final' }, '上書きしますか？'));
      var backdrop = h('div', { class: 'us-df-prompt-backdrop', 'data-us-cc': 'df-prompt' });
      var box = h('div', { class: 'us-df-prompt-box' },
        msg,
        h('div', { class: 'us-df-prompt-actions' },
          h('button', { type: 'button', class: 'us-df-prompt-btn us-df-prompt-cancel' }, 'キャンセル'),
          h('button', { type: 'button', class: 'us-df-prompt-btn us-df-prompt-ok' }, '上書き')
        )
      );
      backdrop.appendChild(box);
      var okBtn = box.querySelector('.us-df-prompt-ok');
      var cancelBtn = box.querySelector('.us-df-prompt-cancel');
      function finish(confirmed) {
        if (!backdrop.parentNode) return;
        backdrop.removeEventListener('click', onBackdropClick);
        okBtn.removeEventListener('click', onOkClick);
        cancelBtn.removeEventListener('click', onCancelClick);
        document.removeEventListener('keydown', onKeydown);
        backdrop.classList.remove('us-df-prompt-visible');
        setTimeout(function () {
          if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        }, 200);
        if (confirmed) onConfirm(); else onCancel();
      }
      function onBackdropClick(e) { if (e.target === backdrop) finish(false); }
      function onOkClick() { finish(true); }
      function onCancelClick() { finish(false); }
      function onKeydown(e) { if (e.key === 'Escape') finish(false); if (e.key === 'Enter') finish(true); }
      backdrop.addEventListener('click', onBackdropClick);
      okBtn.addEventListener('click', onOkClick);
      cancelBtn.addEventListener('click', onCancelClick);
      document.addEventListener('keydown', onKeydown);
      document.body.appendChild(backdrop);
      requestAnimationFrame(function () { backdrop.classList.add('us-df-prompt-visible'); cancelBtn.focus(); });
    },

    addStep: function (el, suggestedNameOverride) {
      var self = this;
      var xpath = getXPath(el);
      var type = getElementType(el);
      var suggested = (suggestedNameOverride != null && suggestedNameOverride !== '')
        ? String(suggestedNameOverride).replace(/\s+/g, ' ').trim().slice(0, 80)
        : (getLabelNearElement(el) || (type === 'text' ? 'テキスト' : (type === 'select' ? getSelectSuggestedFallback(el) : type)));
      this._showLogicalNamePrompt(suggested, function (logicalName) {
        if (logicalName == null) return;
        logicalName = String(logicalName).trim() || type;
        var step = { xpath: xpath, type: type, logicalName: logicalName };
        var options = getRadioCheckboxOptions(el);
        if (options.length) step.options = options;
        self._steps = self._steps || [];
        var existingIndex = -1;
        for (var i = 0; i < self._steps.length; i++) {
          if (self._steps[i].xpath === xpath) { existingIndex = i; break; }
        }
        if (existingIndex >= 0) {
          var existing = self._steps[existingIndex];
          if (existing.logicalName === logicalName) {
            self._showAlert('すでに同じ項目名で取得済みです。', function () {
              refreshPanel();
            });
            return;
          }
          self._showConfirm(existing.logicalName, logicalName, function () {
            self._steps[existingIndex] = step;
            self.save(self._steps);
            refreshPanel();
          }, function () {});
          return;
        }
        self._steps.push(step);
        self.save(self._steps);
        refreshPanel();
      }, function () {});
    },

    removeStep: function (index) {
      if (index < 0 || index >= (this._steps || []).length) return;
      this._steps.splice(index, 1);
      this.save(this._steps);
    },

    moveStep: function (fromIndex, toIndex) {
      var s = this._steps || [];
      if (fromIndex < 0 || fromIndex >= s.length || toIndex < 0 || toIndex >= s.length) return;
      var item = s.splice(fromIndex, 1)[0];
      s.splice(toIndex, 0, item);
      this.save(this._steps);
    },

    _hoverPopover: null,
    _hoverEl: null,
    _hoverHideTimer: null,
    _hoverSuggestedName: '',

    _createHoverPopover: function () {
      if (this._hoverPopover) return this._hoverPopover;
      var self = this;
      var box = h('div', { class: 'us-df-hover-box', 'data-us-cc': 'df-hover' });
      box.style.display = 'none';
      var labelEl = h('div', { class: 'us-df-hover-label' }, '項目名');
      var inputWrap = h('div', { class: 'us-df-hover-input-wrap' });
      var inputEl = h('input', { type: 'text', class: 'us-df-hover-input', placeholder: '例: メールアドレス' });
      var dropdownBtn = h('button', { type: 'button', class: 'us-df-hover-dropdown-btn', title: '候補から選択' }, '\u25BC');
      var dropdownEl = h('div', { class: 'us-df-hover-dropdown' });
      dropdownEl.style.display = 'none';
      inputWrap.appendChild(inputEl);
      inputWrap.appendChild(dropdownBtn);
      inputWrap.appendChild(dropdownEl);
      var requiredWrap = h('div', { class: 'us-df-hover-required-wrap' });
      var requiredRadio = h('input', { type: 'radio', name: 'us-df-hover-required', value: 'required', id: 'us-df-hover-required' });
      var optionalRadio = h('input', { type: 'radio', name: 'us-df-hover-required', value: 'optional', id: 'us-df-hover-optional' });
      requiredRadio.checked = true;
      requiredWrap.appendChild(h('label', { for: 'us-df-hover-required' }, requiredRadio, document.createTextNode('必須')));
      requiredWrap.appendChild(h('label', { for: 'us-df-hover-optional' }, optionalRadio, document.createTextNode('任意')));
      var msgEl = h('div', { class: 'us-df-hover-msg' }, '');
      var actionsEl = h('div', { class: 'us-df-hover-actions' });
      var addBtn = h('button', { type: 'button', class: 'us-df-hover-btn us-df-hover-btn-add' }, '追加');
      var cancelBtn = h('button', { type: 'button', class: 'us-df-hover-btn us-df-hover-btn-cancel' }, 'キャンセル');
      actionsEl.appendChild(addBtn);
      actionsEl.appendChild(cancelBtn);
      box.appendChild(labelEl);
      box.appendChild(inputWrap);
      box.appendChild(requiredWrap);
      box.appendChild(msgEl);
      box.appendChild(actionsEl);
      addBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var el = self._hoverEl;
        var name = (self._hoverInput && self._hoverInput.value) ? self._hoverInput.value.trim() : '';
        var required = !optionalRadio.checked;
        if (el) self._addStepWithName(el, name || self._hoverSuggestedName, required);
        self._hideHoverPopover();
      });
      cancelBtn.addEventListener('click', function (e) { e.stopPropagation(); self._hideHoverPopover(); });
      dropdownBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (self._hoverInput.readOnly) return;
        self._toggleHoverDropdown();
      });
      box.addEventListener('mouseenter', function () {
        if (self._hoverHideTimer) clearTimeout(self._hoverHideTimer);
        self._hoverHideTimer = null;
      });
      box.addEventListener('mouseleave', function () {
        self._scheduleHideHover();
      });
      document.body.appendChild(box);
      this._hoverPopover = box;
      this._hoverInput = inputEl;
      this._hoverRequiredRadio = requiredRadio;
      this._hoverOptionalRadio = optionalRadio;
      this._hoverMsgEl = msgEl;
      this._hoverActionsEl = actionsEl;
      this._hoverDropdownEl = dropdownEl;
      this._hoverDropdownBtn = dropdownBtn;
      return box;
    },

    _toggleHoverDropdown: function () {
      var list = this._hoverDropdownEl;
      if (!list) return;
      if (list.style.display === 'block') {
        list.style.display = 'none';
        return;
      }
      while (list.firstChild) list.removeChild(list.firstChild);
      var candidates = this._hoverCandidates || [];
      var self = this;
      if (candidates.length === 0) {
        var empty = h('button', { type: 'button', class: 'us-df-hover-dropdown-item', disabled: true }, '候補なし');
        list.appendChild(empty);
      } else {
        candidates.forEach(function (text) {
          var item = h('button', { type: 'button', class: 'us-df-hover-dropdown-item' }, text);
          item.addEventListener('click', function (e) {
            e.stopPropagation();
            if (self._hoverInput) self._hoverInput.value = text;
            list.style.display = 'none';
          });
          list.appendChild(item);
        });
      }
      list.style.display = 'block';
    },

    _scheduleHideHover: function () {
      var self = this;
      if (this._hoverHideTimer) clearTimeout(this._hoverHideTimer);
      this._hoverHideTimer = setTimeout(function () { self._hideHoverPopover(); }, 150);
    },

    _hideHoverPopover: function () {
      if (this._hoverHideTimer) { clearTimeout(this._hoverHideTimer); this._hoverHideTimer = null; }
      if (this._hoverDropdownEl) this._hoverDropdownEl.style.display = 'none';
      if (this._hoverPopover) this._hoverPopover.style.display = 'none';
      this._hoverEl = null;
    },

    _addStepWithName: function (el, logicalName, required) {
      var self = this;
      var xpath = getXPath(el);
      var type = getElementType(el);
      logicalName = String(logicalName || '').trim() || (type === 'text' ? 'テキスト' : type);
      var step = { xpath: xpath, type: type, logicalName: logicalName };
      if (required !== undefined) step.required = required !== false;
      var options = getRadioCheckboxOptions(el);
      if (options.length) step.options = options;
      this._steps = this._steps || [];
      var existingIndex = -1;
      for (var i = 0; i < this._steps.length; i++) {
        if (this._steps[i].xpath === xpath) { existingIndex = i; break; }
      }
      if (existingIndex >= 0) {
        var existing = this._steps[existingIndex];
        if (existing.logicalName === logicalName) return;
        this._showConfirm(existing.logicalName, logicalName, function () {
          self._steps[existingIndex] = step;
          self.save(self._steps);
          refreshPanel();
        }, function () {});
        return;
      }
      this._steps.push(step);
      this.save(this._steps);
      refreshPanel();
    },

    enableCapture: function () {
      var self = this;
      if (this._boundMouseOver) return;
      this._createHoverPopover();
      this._boundMouseOver = function (e) {
        if (e.target.closest && e.target.closest('[data-us-cc]')) return;
        var el = e.target;
        var suggestedFromLabel = '';
        if (el.tagName && el.tagName.toLowerCase() === 'label') {
          var control = getControlFromLabel(el);
          if (control) {
            suggestedFromLabel = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
            el = control;
          }
        }
        if (el.tagName && el.tagName.toLowerCase() === 'option') {
          el = el.closest ? el.closest('select') : null;
          if (!el && e.target.parentNode) el = e.target.parentNode;
          if (!el || el.tagName.toLowerCase() !== 'select') return;
        }
        var type = getElementType(el);
        if (type === 'unknown' || type === 'button') return;
        if (!/^(input|select|textarea)$/i.test(el.tagName)) return;
        var labelPrefill = getLabelNearElement(el);
        var isRadioOrCheckbox = el.tagName && el.tagName.toLowerCase() === 'input' && (el.type === 'radio' || el.type === 'checkbox');
        var typeFallback = type === 'text' ? 'テキスト' : (type === 'select' ? getSelectSuggestedFallback(el) : type);
        var suggested = isRadioOrCheckbox
          ? (labelPrefill || typeFallback)
          : ((suggestedFromLabel !== '') ? suggestedFromLabel : (labelPrefill || typeFallback));
        var includeLabelInCandidates = isRadioOrCheckbox ? true : (!labelPrefill && suggestedFromLabel === '');
        var xpath = getXPath(el);
        var existing = null;
        var steps = self._steps || [];
        for (var i = 0; i < steps.length; i++) {
          if (steps[i].xpath === xpath) { existing = steps[i]; break; }
        }
        if (self._hoverHideTimer) clearTimeout(self._hoverHideTimer);
        self._hoverHideTimer = null;
        self._hoverEl = el;
        self._hoverSuggestedName = suggested;
        self._hoverCandidates = getTextCandidatesFromForm(el, includeLabelInCandidates);
        self._hoverInput.value = existing ? (existing.logicalName || '') : (suggested || '');
        self._hoverInput.readOnly = !!existing;
        self._hoverInput.style.background = existing ? 'rgba(0,0,0,0.05)' : '#fff';
        if (self._hoverRequiredRadio && self._hoverOptionalRadio) {
          var req = existing ? (existing.required !== false) : true;
          self._hoverRequiredRadio.checked = req;
          self._hoverOptionalRadio.checked = !req;
        }
        self._hoverMsgEl.textContent = existing ? 'すでに登録済みです' : '';
        self._hoverMsgEl.style.display = existing ? 'block' : 'none';
        self._hoverMsgEl.style.visibility = existing ? 'visible' : 'hidden';
        self._hoverActionsEl.style.display = existing ? 'none' : 'flex';
        var rect = el.getBoundingClientRect();
        self._hoverPopover.style.display = 'block';
        self._hoverPopover.style.left = Math.max(4, rect.left) + 'px';
        self._hoverPopover.style.top = (rect.bottom + 6) + 'px';
      };
      this._boundMouseOut = function (e) {
        if (e.relatedTarget && self._hoverPopover && self._hoverPopover.contains(e.relatedTarget)) return;
        self._scheduleHideHover();
      };
      document.addEventListener('mouseover', this._boundMouseOver, true);
      document.addEventListener('mouseout', this._boundMouseOut, true);
    },

    disableCapture: function () {
      this._hideHoverPopover();
      if (this._boundMouseOver) {
        document.removeEventListener('mouseover', this._boundMouseOver, true);
        this._boundMouseOver = null;
      }
      if (this._boundMouseOut) {
        document.removeEventListener('mouseout', this._boundMouseOut, true);
        this._boundMouseOut = null;
      }
    },

    exportCSVTemplate: function () {
      var steps = this._steps || [];
      var header = steps.map(function (s) { return (s.logicalName || '').replace(/"/g, '""'); }).join(',');
      var csv = '\uFEFF' + header + '\n';
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'dataFiller_template_' + (new Date().toISOString().slice(0, 10)) + '.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  };
  }

  /**
   * Build the DataFiller panel screen DOM and logic.
   * Returns { el, refreshSteps }. Call refreshSteps() to update the steps list.
   * callbacks: { onBack }
   */
  function createDataFillerScreen(h, dataFillerInstance, RPC, callbacks) {
    var onBack = callbacks && callbacks.onBack;
    var _activeTab = 'page';

    var dfMainToggleLabel = document.createElement('label');
    dfMainToggleLabel.className = 'us-switch';
    dfMainToggleLabel.setAttribute('data-us-cc', 'switch');
    dfMainToggleLabel.appendChild(h('input', { type: 'checkbox', id: 'us-p-df-main-toggle' }));
    dfMainToggleLabel.appendChild(h('span.us-slider'));
    var dfDetailIcon = h('div.us-p-detail-icon', document.createTextNode('CSV'));
    var dfTabPage = h('button.us-p-tab-btn.active', { id: 'us-p-df-tab-page', type: 'button', 'data-df-tab': 'page' }, 'このページ (0)');
    var dfTabOther = h('button.us-p-tab-btn', { id: 'us-p-df-tab-other', type: 'button', 'data-df-tab': 'other' }, 'その他 (0)');
    var screenEl = h('div', { class: 'us-p-screen', 'data-us-cc': 'screen-dataFiller' },
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

    async function refreshSteps() {
      var emptyEl = screenEl.querySelector('#us-p-df-empty');
      var stepsEl = screenEl.querySelector('#us-p-df-steps');
      var tabPageEl = screenEl.querySelector('#us-p-df-tab-page');
      var tabOtherEl = screenEl.querySelector('#us-p-df-tab-other');
      if (!stepsEl) return;
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
      var thisPageSteps = (dataFillerInstance.getSteps() || []).map(function (step, i) { return { step: step, originalIndex: i }; });
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

      function renderSteps() {
        var otherCount = otherPages.reduce(function (sum, g) { return sum + g.steps.length; }, 0);
        if (tabPageEl) tabPageEl.textContent = 'このページ (' + thisPageSteps.length + ')';
        if (tabOtherEl) tabOtherEl.textContent = 'その他 (' + otherCount + ')';
        if (tabPageEl) tabPageEl.classList.toggle('active', _activeTab === 'page');
        if (tabOtherEl) tabOtherEl.classList.toggle('active', _activeTab === 'other');
        while (stepsEl.firstChild) stepsEl.removeChild(stepsEl.firstChild);

        function xpathCounts(list) {
          var counts = {};
          list.forEach(function (w) {
            var x = (w.step && w.step.xpath) || '';
            counts[x] = (counts[x] || 0) + 1;
          });
          return counts;
        }

        if (_activeTab === 'page') {
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
            if (delBtn) delBtn.addEventListener('click', function (e) { e.stopPropagation(); dataFillerInstance.removeStep(w.originalIndex); refreshSteps(); });
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
      }
      renderSteps();
    }

    screenEl.querySelector('[data-df-back="1"]').addEventListener('click', function () { if (onBack) onBack(); });
    var dfMainToggle = screenEl.querySelector('#us-p-df-main-toggle');
    if (dfMainToggle) dfMainToggle.addEventListener('change', function () {
      RPC.call('storage.set', ['userscripts:features:dataFiller:enabled', this.checked]).catch(function () {});
      if (this.checked) dataFillerInstance.enableCapture(); else dataFillerInstance.disableCapture();
    });
    screenEl.querySelector('#us-p-df-template-dl').addEventListener('click', function () { dataFillerInstance.exportCSVTemplate(); });
    screenEl.querySelector('#us-p-df-tab-page').addEventListener('click', function () {
      _activeTab = 'page';
      dfTabPage.classList.add('active');
      if (dfTabOther) dfTabOther.classList.remove('active');
      refreshSteps();
    });
    screenEl.querySelector('#us-p-df-tab-other').addEventListener('click', function () {
      _activeTab = 'other';
      dfTabOther.classList.add('active');
      if (dfTabPage) dfTabPage.classList.remove('active');
      refreshSteps();
    });

    return { el: screenEl, refreshSteps: refreshSteps };
  }

  var STORAGE_KEY_ENABLED = 'userscripts:features:dataFiller:enabled';

  /**
   * Returns panel feature descriptor: { listRow, screen, onPanelOpen }.
   * All dataFiller strings (labels, ids, storage keys) live here.
   */
  function createPanelFeature(h, dataFillerInstance, RPC, callbacks) {
    var onBack = callbacks && callbacks.onBack;
    var switchLabel = document.createElement('label');
    switchLabel.className = 'us-switch';
    switchLabel.setAttribute('data-us-cc', 'switch');
    switchLabel.appendChild(h('input', { type: 'checkbox', id: 'us-p-feature-df-toggle' }));
    switchLabel.appendChild(h('span.us-slider'));
    var icon = h('div.us-p-feature-icon', document.createTextNode('CSV'));
    var label = h('span.us-p-feature-label', 'data', h('span.us-title-editor', 'Filler'));
    var listRow = h('div', { class: 'us-p-feature-row' },
      icon, label,
      h('div.us-p-feature-right', switchLabel, h('span.us-p-feature-chevron', '\u203A'))
    );
    var toggleEl = listRow.querySelector('#us-p-feature-df-toggle');
    toggleEl.addEventListener('click', function (e) { e.stopPropagation(); });
    toggleEl.addEventListener('change', function () {
      RPC.call('storage.set', [STORAGE_KEY_ENABLED, this.checked]).catch(function () {});
      if (this.checked) dataFillerInstance.enableCapture(); else dataFillerInstance.disableCapture();
    });

    var screenResult = createDataFillerScreen(h, dataFillerInstance, RPC, { onBack: onBack });
    function onShow() {
      var mainToggle = screenResult.el.querySelector('#us-p-df-main-toggle');
      if (mainToggle && toggleEl) mainToggle.checked = toggleEl.checked;
      dataFillerInstance.load().then(function () { screenResult.refreshSteps(); });
    }
    function onPanelOpen() {
      RPC.call('storage.get', [STORAGE_KEY_ENABLED, false]).then(function (val) {
        var enabled = !!val;
        if (toggleEl) toggleEl.checked = enabled;
        if (enabled) dataFillerInstance.enableCapture(); else dataFillerInstance.disableCapture();
      }).catch(function () {
        if (toggleEl) toggleEl.checked = false;
        dataFillerInstance.disableCapture();
      });
    }
    return {
      listRow: listRow,
      screen: { el: screenResult.el, onShow: onShow },
      onPanelOpen: onPanelOpen
    };
  }

  global.createDataFiller = createDataFiller;
  global.createDataFillerScreen = createDataFillerScreen;
  global.createDataFillerPanelFeature = createPanelFeature;
  if (typeof __US_registerPanelFeature === 'function') { console.log('[UserScripts] dataFiller: calling __US_registerPanelFeature (injected)'); __US_registerPanelFeature('dataFiller', createPanelFeature); }
  else if (typeof global.__US_registerPanelFeature === 'function') { console.log('[UserScripts] dataFiller: calling global.__US_registerPanelFeature'); global.__US_registerPanelFeature('dataFiller', createPanelFeature); }
  else { console.log('[UserScripts] dataFiller: no registrar (__US_registerPanelFeature=', typeof __US_registerPanelFeature, 'global=', typeof (global && global.__US_registerPanelFeature), ')'); }
})(typeof window !== 'undefined' ? window : this);
