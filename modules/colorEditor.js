// Color Editor Module (v2.0.8 Complete Implementation)
// Global reference for RPC calls
let RPC;

// Utility function for DOM creation
function h(tag, attrs = {}) {
  const parts = tag.split(/([.#][^.#]*)/);
  const tagName = parts[0] || 'div';
  const el = document.createElement(tagName);
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith('.')) {
      el.classList.add(part.slice(1));
    } else if (part.startsWith('#')) {
      el.id = part.slice(1);
    }
  }
  
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'class' || key === 'className') {
      el.className += ' ' + value;
    } else {
      el.setAttribute(key, value);
    }
  });
  
  for (let i = 2; i < arguments.length; i++) {
    const child = arguments[i];
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child) {
      el.appendChild(child);
    }
  }
  
  return el;
}

// =========================
// SelectorEngine
// =========================
const SelectorEngine = {
  generate(el) {
    if (!el || !el.tagName) return '';
    const parts = [];
    let current = el;
    const root = document.documentElement;
    
    while (current && current !== root) {
      let tag = current.tagName.toLowerCase();
      const parent = current.parentElement;
      
      if (current.id && !/\d/.test(current.id) && document.querySelectorAll('#' + CSS.escape(current.id)).length === 1) {
        parts.unshift('#' + current.id);
        break;
      } else if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) {
          const idx = siblings.indexOf(current) + 1;
          tag += ':nth-of-type(' + idx + ')';
        }
      }
      parts.unshift(tag);
      current = parent;
    }
    
    if (parts.length === 0) return el.tagName.toLowerCase();
    return parts.join(' > ');
  },

  find(selector) {
    try { return document.querySelector(selector); } catch (e) { return null; }
  },

  findAll(selector) {
    try {
      const list = document.querySelectorAll(selector);
      return Array.prototype.slice.call(list);
    } catch (e) {
      return [];
    }
  }
};

// =========================
// RulesManager
// =========================
const RulesManager = {
  _storagePrefix: 'userscripts:features:colorCustomizer:page:',
  _pageKey: window.location.hostname + window.location.pathname,
  _rules: [],

  _key() {
    return this._storagePrefix + encodeURIComponent(this._pageKey);
  },

  async load() {
    try {
      console.log('[ColorCustomizer] Loading rules for:', this._pageKey);
      const data = await RPC.call('storage.get', [this._key(), null]);
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

  async save() {
    try {
      console.log('[ColorCustomizer] Saving rules for:', this._pageKey);
      await RPC.call('storage.set', [this._key(), {
        origin: this._pageKey,
        rules: this._rules,
        updatedAt: Date.now()
      }]);
    } catch (e) {
      console.error('[ColorCustomizer] Failed to save rules:', e);
    }
  },

  getRules() {
    return this._rules.slice();
  },

  async addRule(selector, property, value, mode = 'inline') {
    const idx = this._rules.findIndex(r => r.selector === selector && r.property === property);
    const rule = { selector, property, value, mode };
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
    const idx = this._rules.findIndex(r => r.selector === selector && r.property === property);
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

// =========================
// StyleApplier
// =========================
const StyleApplier = {
  _applied: [], // { el, property, originalValue }

  applyAll(rules) {
    this.clearAll();
    rules.forEach(rule => {
      if (rule.mode === 'inline') {
        this.applyOne(rule);
      }
    });
  },

  applyOne(rule) {
    const el = SelectorEngine.find(rule.selector);
    if (!el) return;
    const original = el.style.getPropertyValue(rule.property);
    this._applied.push({ el, property: rule.property, originalValue: original });
    el.style.setProperty(rule.property, rule.value, 'important');
  },

  clearAll() {
    this._applied.forEach(rec => {
      try {
        if (rec.originalValue) {
          rec.el.style.setProperty(rec.property, rec.originalValue);
        } else {
          rec.el.style.removeProperty(rec.property);
        }
      } catch (e) {
        console.warn('[ColorCustomizer] Failed to restore style:', e);
      }
    });
    this._applied = [];
  },

  previewOne(el, property, value) {
    if (el) el.style.setProperty(property, value, 'important');
  },

  removeRuleFromPage(selector, property) {
    const elements = SelectorEngine.findAll(selector);
    elements.forEach(el => {
      el.style.removeProperty(property);
    });
  }
};

// =========================
// ProfileManager
// =========================
const ProfileManager = {
  _storageKey: 'userscripts:features:colorCustomizer:profiles',
  _profiles: [],

  async load() {
    try {
      const data = await RPC.call('storage.get', [this._storageKey, null]);
      this._profiles = (data && Array.isArray(data)) ? data : [];
    } catch (e) {
      console.warn('[ColorCustomizer] Failed to load profiles:', e);
      this._profiles = [];
    }
    return this._profiles;
  },

  async save() {
    try {
      await RPC.call('storage.set', [this._storageKey, this._profiles]);
    } catch (e) {
      console.error('[ColorCustomizer] Failed to save profiles:', e);
    }
  },

  getProfiles() {
    return this._profiles.slice();
  },

  async addProfile(name, colors) {
    const profile = {
      id: 'prof_' + Math.random().toString(36).slice(2, 10),
      name: name || 'Untitled',
      colors: colors || [{ value: '#3b82f6', name: '' }]
    };
    this._profiles.push(profile);
    await this.save();
    return profile;
  },

  async updateProfile(id, name, colors) {
    const p = this._profiles.find(x => x.id === id);
    if (!p) return null;
    p.name = name;
    p.colors = colors;
    await this.save();
    return p;
  },

  async deleteProfile(id) {
    this._profiles = this._profiles.filter(x => x.id !== id);
    await this.save();
  }
};

// =========================
// EditMode
// =========================
const EditMode = {
  active: false,
  _highlighted: null,
  _boundHover: null,
  _boundClick: null,

  enable() {
    if (this.active) return;
    this.active = true;
    this._boundHover = e => this._onHover(e);
    this._boundClick = e => this._onClick(e);
    document.addEventListener('mouseover', this._boundHover, true);
    document.addEventListener('mouseout', () => this._clearHighlight(), true);
    document.addEventListener('click', this._boundClick, true);
    Tab.setActive(true);
    this._persist(true);
  },

  disable() {
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

  _isOurUI(el) {
    return !!(el && el.closest && el.closest('[data-us-cc]'));
  },

  _onHover(e) {
    if (!this.active) return;
    const el = e.target;
    if (this._isOurUI(el)) { 
      this._clearHighlight(); 
      return; 
    }
    if (el === this._highlighted) return;
    this._clearHighlight();
    el.classList.add('us-cc-highlight');
    this._highlighted = el;
  },

  _onClick(e) {
    if (!this.active) return;
    const el = e.target;
    if (this._isOurUI(el)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    this._clearHighlight();
    console.log('[ColorCustomizer] Element clicked:', el.tagName, el.className);
    try {
      ColorPopover.show(el);
    } catch (err) {
      console.error('[ColorCustomizer] Popover show failed:', err);
    }
  },

  _clearHighlight() {
    if (this._highlighted) {
      this._highlighted.classList.remove('us-cc-highlight');
      this._highlighted = null;
    }
  },

  async _persist(active) {
    try {
      await RPC.call('storage.set', ['userscripts:features:colorCustomizer:editMode', active]);
    } catch (e) {
      console.error('[ColorCustomizer] Failed to save EditMode state:', e);
    }
  }
};

// =========================
// ColorPopover
// =========================
const PROP_LIST = [
  { key: 'background-color', label: '背景' },
  { key: 'color', label: '文字' },
  { key: 'border-color', label: 'ボーダー' }
];

const ColorPopover = {
  el: null,
  _currentTarget: null,

  _create() {
    if (this.el) return;
    console.log('[ColorCustomizer] Creating popover DOM');

    const propsContainer = h('div', { id: 'us-pop-props' });
    PROP_LIST.forEach(p => {
      const swatch = h('span', { 'data-role': 'preview-swatch', title: 'クリックで色を選択' });
      swatch.style.setProperty('background', '#000000', 'important');
      const input = h('input', { type: 'text', 'data-role': 'flexible', placeholder: '#000000' });
      const rowMain = h('div.us-pop-prop-row-main', swatch, input);
      propsContainer.appendChild(
        h('div.us-pop-prop-row', { 'data-prop-key': p.key },
          h('span.us-pop-prop-label', p.label),
          rowMain
        )
      );
    });

    const pop = h('div', { id: 'us-cc-popover', 'data-us-cc': 'popover' },
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
  },

  _bindEvents() {
    const rows = this.el.querySelectorAll('.us-pop-prop-row');
    rows.forEach(row => {
      const flexible = row.querySelector('[data-role="flexible"]');
      const previewSwatch = row.querySelector('[data-role="preview-swatch"]');
      const propKey = row.getAttribute('data-prop-key');

      const updatePreview = hexVal => {
        if (previewSwatch && /^#[0-9a-fA-F]{6}$/.test(hexVal)) {
          previewSwatch.style.setProperty('background', hexVal, 'important');
        }
      };

      flexible.addEventListener('input', () => {
        const value = flexible.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(value)) {
          updatePreview(value);
          this._previewOne(row);
        }
      });

      flexible.addEventListener('blur', async () => {
        const value = flexible.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(value)) {
          await this._saveRule(propKey, value);
        }
      });
    });

    this.el.querySelector('#us-pop-cancel').addEventListener('click', () => this.hide());
  },

  show(el) {
    this._create();
    this._currentTarget = el;

    const selector = SelectorEngine.generate(el);
    this.el.querySelector('#us-pop-sel').textContent = selector;
    this.el.querySelector('#us-pop-sel').title = selector;

    const rows = this.el.querySelectorAll('.us-pop-prop-row');
    rows.forEach(row => {
      const propKey = row.getAttribute('data-prop-key');
      const computed = getComputedStyle(el).getPropertyValue(propKey);
      const hexVal = this._rgbToHex(computed);
      row.querySelector('[data-role="flexible"]').value = hexVal;
      const ps = row.querySelector('[data-role="preview-swatch"]');
      if (ps) ps.style.setProperty('background', hexVal, 'important');
    });

    const rect = el.getBoundingClientRect();
    const popW = 280;
    const popH = 320;
    let left = Math.min(rect.left, window.innerWidth - popW - 16);
    let top = rect.bottom + 8;
    if (top + popH > window.innerHeight) {
      top = Math.max(8, rect.top - popH - 8);
    }
    left = Math.max(8, left);

    this.el.style.setProperty('left', left + 'px', 'important');
    this.el.style.setProperty('top', top + 'px', 'important');
    this.el.classList.add('us-visible');
  },

  hide() {
    if (this.el) this.el.classList.remove('us-visible');
    this._currentTarget = null;
  },

  _previewOne(row) {
    if (!this._currentTarget) return;
    const key = row.getAttribute('data-prop-key');
    const flexible = row.querySelector('[data-role="flexible"]');
    const val = flexible && /^#[0-9a-fA-F]{6}$/.test(flexible.value) ? flexible.value : '';
    StyleApplier.previewOne(this._currentTarget, key, val);
  },

  async _saveRule(prop, val) {
    if (!this._currentTarget || !val) return;
    const selector = SelectorEngine.generate(this._currentTarget);
    if (selector) {
      await RulesManager.addRule(selector, prop, val, 'inline');
      Panel.refreshRules();
    }
  },

  _rgbToHex(rgb) {
    if (!rgb) return '#000000';
    if (rgb.charAt(0) === '#') return rgb;
    const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!m) return '#000000';
    return '#' + [m[1], m[2], m[3]].map(x => 
      parseInt(x, 10).toString(16).padStart(2, '0')
    ).join('');
  }
};

// =========================
// Tab
// =========================
const Tab = {
  el: null,

  create() {
    if (this.el) return;
    this.el = h('div', { id: 'us-cc-tab', 'data-us-cc': 'tab' },
      h('div.us-cc-tab-icon',
        h('div.us-cc-tab-icon-row',
          h('div.us-cc-tab-text', 'ツール'),
          h('div.us-cc-tab-swatch')
        )
      )
    );
    
    this.el.addEventListener('click', () => Panel.toggle());
    document.body.appendChild(this.el);
  },

  setActive(active) {
    if (this.el) {
      this.el.classList.toggle('us-tab-active', active);
    }
  }
};

// =========================
// Panel
// =========================
const Panel = {
  el: null,
  backdrop: null,
  _open: false,

  _create() {
    if (this.el) return;

    this.backdrop = h('div', { id: 'us-cc-backdrop', 'data-us-cc': 'backdrop' });
    this.backdrop.addEventListener('click', () => this.close());

    const header = h('div.us-p-header',
      h('div.us-p-title',
        h('span.us-title-editor', 'Color '),
        'Customizer'
      ),
      h('div.us-p-version', 'v2.0.8'),
      h('label.us-switch.us-p-header-toggle',
        h('input', { type: 'checkbox', id: 'us-p-edit-toggle' }),
        h('span.us-slider')
      )
    );

    const rules = h('div.us-p-rules', { id: 'us-p-rules' },
      h('span.us-p-empty', 'カラールールはまだありません\n要素をクリックしてカスタマイズしましょう')
    );

    const footer = h('div.us-p-footer',
      h('div.us-p-footer-row',
        h('button.us-btn.us-btn-danger', { id: 'us-p-clear' }, '全削除'),
        h('button.us-btn.us-btn-secondary', { id: 'us-p-export' }, 'エクスポート'),
        h('button.us-btn.us-btn-secondary', { id: 'us-p-import' }, 'インポート')
      )
    );

    this.el = h('div', { id: 'us-cc-panel', 'data-us-cc': 'panel' }, header, rules, footer);
    
    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.el);
    this._bindEvents();
  },

  _bindEvents() {
    // Toggle switch
    const toggleEl = this.el.querySelector('#us-p-edit-toggle');
    if (toggleEl) {
      toggleEl.addEventListener('change', function() {
        if (this.checked) {
          EditMode.enable();
        } else {
          EditMode.disable();
        }
      });
    }

    // Clear rules
    const clearEl = this.el.querySelector('#us-p-clear');
    if (clearEl) {
      clearEl.addEventListener('click', async () => {
      await RulesManager.clearRules();
      StyleApplier.clearAll();
      this.refreshRules();
    });

    }

    // Export
    const exportEl = this.el.querySelector('#us-p-export');
    if (exportEl) {
      exportEl.addEventListener('click', () => {
      const data = {
        version: '2.0.8',
        exportedAt: new Date().toISOString(),
        page: window.location.hostname + window.location.pathname,
        rules: RulesManager.getRules(),
        profiles: ProfileManager.getProfiles()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const a = document.createElement('a');
      a.href = url;
      a.download = `color-customizer-${window.location.hostname}-${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
    }

    // Import
    const importEl = this.el.querySelector('#us-p-import');
    if (importEl) {
      importEl.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          
          let rulesCount = 0;
          let profilesCount = 0;
          
          // Import rules
          if (Array.isArray(data.rules)) {
            for (const rule of data.rules) {
              if (rule.selector && rule.property && rule.value) {
                await RulesManager.addRule(rule.selector, rule.property, rule.value, rule.mode || 'inline');
                rulesCount++;
              }
            }
          }
          
          // Import profiles
          if (Array.isArray(data.profiles)) {
            for (const profile of data.profiles) {
              if (profile.name && Array.isArray(profile.colors)) {
                await ProfileManager.addProfile(profile.name, profile.colors);
                profilesCount++;
              }
            }
          }
          
          StyleApplier.clearAll();
          StyleApplier.applyAll(RulesManager.getRules());
          this.refreshRules();
          
          console.log(`[ColorCustomizer] Import complete: ${rulesCount} rules, ${profilesCount} profiles`);
          alert(`インポート完了:\nルール: ${rulesCount}件\nプロファイル: ${profilesCount}件`);
        } catch (e) {
          console.error('[ColorCustomizer] Import failed:', e);
          alert('インポートに失敗しました: ' + e.message);
        }
      });
      input.click();
    });

      });
    }

    // Delete rules
    const rulesEl = this.el.querySelector('#us-p-rules');
    if (rulesEl) {
      rulesEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-rule-idx]');
      if (!btn) return;
      const idx = parseInt(btn.getAttribute('data-rule-idx'), 10);
      const rules = RulesManager.getRules();
      const rule = rules[idx];
      if (rule) {
        await RulesManager.removeRule(idx);
        StyleApplier.removeRuleFromPage(rule.selector, rule.property);
        StyleApplier.clearAll();
        StyleApplier.applyAll(RulesManager.getRules());
        this.refreshRules();
      }
      });
    }
  },

  open() {
    this._create();
    this.refreshRules();
    const toggleEl = this.el.querySelector('#us-p-edit-toggle');
    if (toggleEl) {
      toggleEl.checked = EditMode.active;
    }
    
    this.backdrop.style.display = 'block';
    void this.backdrop.offsetWidth;
    this.backdrop.classList.add('us-visible');
    this.el.classList.add('us-open');
    this._open = true;
  },

  close() {
    if (this.el) this.el.classList.remove('us-open');
    if (this.backdrop) this.backdrop.classList.remove('us-visible');
    setTimeout(() => {
      if (this.backdrop && !this._open) this.backdrop.style.display = 'none';
    }, 250);
    this._open = false;
  },

  toggle() {
    if (this._open) {
      this.close();
    } else {
      this.open();
    }
  },

  refreshRules() {
    if (!this.el) return;
    const container = this.el.querySelector('#us-p-rules');
    const rules = RulesManager.getRules();
    
    while (container.firstChild) container.removeChild(container.firstChild);

    if (rules.length === 0) {
      container.appendChild(h('span.us-p-empty', 'ルールがありません'));
      return;
    }

    rules.forEach((r, i) => {
      const shortSel = r.selector.length > 28 ? '…' + r.selector.slice(-26) : r.selector;
      const swatch = h('span.us-rule-swatch');
      swatch.style.setProperty('background', r.value, 'important');
      container.appendChild(
        h('div.us-rule-item',
          swatch,
          h('span.us-rule-info',
            h('span.us-rule-selector', { title: r.selector }, shortSel),
            h('span.us-rule-prop', r.property)
          ),
          h('button.us-rule-del', { 'data-rule-idx': String(i), title: '削除' }, '✕')
        )
      );
    });
  }
};

export default {
  async init(rpcInstance) {
    console.log('[ColorCustomizer] Module initialized');
    
    // Set global RPC reference from parent
    if (rpcInstance) {
      RPC = rpcInstance;
    } else if (window.US && window.US.rpc) {
      RPC = window.US.rpc;
    } else if (window.RPC) {
      RPC = window.RPC;
    } else {
      console.error('[ColorCustomizer] RPC not available');
      return false;
    }
    
    // Wait for DOM ready
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve);
      });
    }
    
    try {
      // Initialize managers
      await RulesManager.load();
      await ProfileManager.load();
      
      // Create UI
      this.injectStyles();
      Tab.create();
      
      // Apply existing rules
      StyleApplier.applyAll(RulesManager.getRules());
      
      // Restore edit mode state
      const editState = await RPC.call('storage.get', ['userscripts:features:colorCustomizer:editMode', false]);
      if (editState) {
        EditMode.enable();
      }
      
      console.log('[ColorCustomizer] Initialized – ' + RulesManager.getRules().length + ' rule(s), ' + ProfileManager.getProfiles().length + ' profile(s) for ' + window.location.hostname + window.location.pathname);
      return true;
    } catch (e) {
      console.error('[ColorCustomizer] Init failed:', e);
      return false;
    }
  },

  injectStyles() {
    if (document.querySelector('[data-us-cc-styles]')) {
      console.log('[ColorCustomizer] Styles already injected');
      return;
    }
    
    const style = document.createElement('style');
    style.setAttribute('data-us-cc-styles', '1');
    style.textContent = this.getCSS();
    (document.head || document.documentElement).appendChild(style);
    console.log('[ColorCustomizer] Styles injected');
  },

  getCSS() {
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
      '  display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; gap: 1px !important;',
      '  transition: width 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease !important;',
      '}',
      '#us-cc-tab:hover { width: 62px !important; background: rgba(255,255,255,0.16) !important; }',
      '#us-cc-tab .us-cc-tab-icon {',
      '  color: rgba(0,0,0,0.55) !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;',
      '  font-size: 11px !important; font-weight: 600 !important; letter-spacing: 0.02em !important;',
      '  flex: 1 !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; gap: 2px !important;',
      '  min-height: 0 !important; cursor: pointer !important; padding: 1px 0 1px !important; overflow: visible !important;',
      '}',
      '#us-cc-tab .us-cc-tab-icon:hover { color: rgba(0,0,0,0.75) !important; }',
      '#us-cc-tab .us-cc-tab-icon-row {',
      '  display: flex !important; flex-direction: column !important; align-items: stretch !important; gap: 1px !important; transform: translateY(-29px) !important;',
      '  width: fit-content !important; font-size: 11px !important; line-height: 1.2 !important;',
      '}',
      '#us-cc-tab .us-cc-tab-text { writing-mode: horizontal-tb !important; text-orientation: mixed !important; }',
      '#us-cc-tab .us-cc-tab-swatch {',
      '  display: block !important; visibility: visible !important; width: 100% !important; height: 0.5em !important; min-height: 4px !important;',
      '  border-radius: 4px !important; flex-shrink: 0 !important;',
      '  background: linear-gradient(to right, #f44336 0%, #e91e63 12.5%, #9c27b0 25%, #2196f3 37.5%, #00bcd4 50%, #4caf50 62.5%, #ffeb3b 75%, #ff9800 87.5%, #f44336 100%) !important;',
      '  border: none !important; box-sizing: border-box !important;',
      '}',
      '#us-cc-tab.us-tab-active .us-cc-tab-swatch { opacity: 1 !important; }',
      '#us-cc-tab.us-tab-active {',
      '  border-color: rgba(59,130,246,0.4) !important;',
      '  background: rgba(255,255,255,0.18) !important;',
      '  box-shadow: -4px 0 24px rgba(59,130,246,0.12), inset 0 1px 0 rgba(255,255,255,0.2) !important;',
      '}',
      '#us-cc-tab.us-tab-active .us-cc-tab-icon { color: rgba(0,0,0,0.55) !important; }',
      '.us-cc-tab-toggle-wrap {',
      '  flex-shrink: 0 !important; padding: 1px 0 1px !important; min-height: 0 !important; overflow: visible !important;',
      '  display: flex !important; align-items: center !important; justify-content: center !important;',
      '  transform: translateY(47px) scale(0.7) !important; transform-origin: center center !important; }',

      /* ── Edit-mode highlight ── */
      '.us-cc-highlight {',
      '  outline: 2px solid rgba(59,130,246,0.8) !important;',
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
      '#us-cc-popover .us-pop-btn-apply:hover { background: rgba(59,130,246,0.35) !important; }'
    ].join('\n');
  }
};