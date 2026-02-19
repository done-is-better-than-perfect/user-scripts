/**
 * UserScript Color Editor Module
 * 
 * Element-based Color Customizer functionality as an ES module
 */

// =========================
// Styles
// =========================
var CSS_STYLES = `
/* === UserScript Color Customizer Styles === */

/* Tab */
#us-cc-tab {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 999999;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  padding: 8px 12px;
  opacity: 0.7;
  transition: all 0.2s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
}

#us-cc-tab:hover {
  opacity: 1;
  transform: scale(1.02);
}

.us-toggle-wrap {
  display: flex;
  align-items: center;
}

.us-switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 20px;
  background-color: #ccc;
  border-radius: 20px;
  transition: background-color 0.2s;
  cursor: pointer;
}

.us-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.us-slider {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s;
}

.us-switch input:checked + .us-slider {
  transform: translateX(20px);
}

.us-switch input:checked ~ * {
  background-color: #4CAF50;
}

.us-cc-tab-icon {
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.us-cc-tab-icon:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.us-cc-tab-icon-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.us-cc-tab-text {
  font-weight: 500;
  color: #333;
}

.us-cc-tab-swatch {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

/* Tab Dark Mode */
.us-theme-dark #us-cc-tab {
  background: rgba(40, 40, 40, 0.95);
  border-color: rgba(255, 255, 255, 0.1);
}

.us-theme-dark .us-cc-tab-text {
  color: #e0e0e0;
}

/* Panel */
.us-cc-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 400px;
  max-width: 90vw;
  max-height: 80vh;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  z-index: 1000000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
}

.us-cc-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  font-weight: 600;
  font-size: 16px;
  color: #333;
}

.us-cc-close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.us-cc-close-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #666;
}

.us-cc-panel-content {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.us-cc-panel-content ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.us-cc-panel-content li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.us-cc-panel-content li:last-child {
  border-bottom: none;
}

.us-cc-remove-rule {
  background: #ff6b6b;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.us-cc-remove-rule:hover {
  background: #ff5252;
}

/* Panel Dark Mode */
.us-theme-dark .us-cc-panel {
  background: rgba(40, 40, 40, 0.98);
  border-color: rgba(255, 255, 255, 0.1);
}

.us-theme-dark .us-cc-panel-header {
  color: #e0e0e0;
  border-color: rgba(255, 255, 255, 0.1);
}

.us-theme-dark .us-cc-panel-content li {
  border-color: rgba(255, 255, 255, 0.05);
}

/* Popover */
.us-cc-popover {
  position: fixed;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  z-index: 1000001;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-width: 200px;
}

.us-cc-popover-header {
  font-weight: 600;
  font-size: 14px;
  color: #333;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.us-cc-color-row {
  display: flex;
  gap: 8px;
}

.us-cc-color-button {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  background: white;
  color: #333;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.us-cc-color-button:hover {
  background: #f5f5f5;
  transform: translateY(-1px);
}

/* Popover Dark Mode */
.us-theme-dark .us-cc-popover {
  background: rgba(40, 40, 40, 0.98);
  border-color: rgba(255, 255, 255, 0.1);
}

.us-theme-dark .us-cc-popover-header {
  color: #e0e0e0;
  border-color: rgba(255, 255, 255, 0.1);
}

.us-theme-dark .us-cc-color-button {
  background: rgba(60, 60, 60, 0.8);
  color: #e0e0e0;
  border-color: rgba(255, 255, 255, 0.2);
}

.us-theme-dark .us-cc-color-button:hover {
  background: rgba(80, 80, 80, 0.9);
}

/* Edit Mode */
body.us-edit-mode * {
  cursor: crosshair !important;
}

body.us-edit-mode *:hover {
  outline: 2px solid #4CAF50 !important;
  outline-offset: 2px !important;
}

/* Hide scrollbars in webkit browsers for panels */
.us-cc-panel-content::-webkit-scrollbar {
  width: 4px;
}

.us-cc-panel-content::-webkit-scrollbar-track {
  background: transparent;
}

.us-cc-panel-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.us-cc-panel-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}
`;

// =========================
// Style Manager
// =========================
var StyleManager = {
  _injected: false,
  
  inject() {
    if (this._injected) return;
    
    var style = document.createElement('style');
    style.setAttribute('data-us-coloreditor', 'styles');
    style.textContent = CSS_STYLES;
    document.head.appendChild(style);
    
    this._injected = true;
    console.log('[StyleManager] CSS styles injected');
  },
  
  remove() {
    var existing = document.querySelector('style[data-us-coloreditor="styles"]');
    if (existing) {
      existing.remove();
      this._injected = false;
    }
  }
};

// =========================
// Theme System
// =========================
var Theme = {
  _theme: 'auto',

  get() { return this._theme; },

  set(theme) {
    this._theme = theme;
    this.apply();
  },

  apply() {
    var isDark = this.isDark();
    document.documentElement.classList.toggle('us-theme-dark', isDark);
    document.documentElement.classList.toggle('us-theme-light', !isDark);
  },

  isDark() {
    if (this._theme === 'dark') return true;
    if (this._theme === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  },

  init() {
    this.apply();
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) {
        mq.addEventListener('change', () => this.apply());
      } else if (mq.addListener) {
        mq.addListener(() => this.apply());
      }
    }
  }
};

// =========================
// Color Utilities
// =========================
var colorUtil = {
  parseRgba(str) {
    if (!str) return null;
    var rgbaMatch = str.match(/rgba?\(([^)]+)\)/);
    if (!rgbaMatch) return null;
    var parts = rgbaMatch[1].split(',').map(s => parseFloat(s.trim()));
    if (parts.length < 3) return null;
    return {
      r: Math.round(parts[0]),
      g: Math.round(parts[1]),
      b: Math.round(parts[2]),
      a: parts[3] !== undefined ? parts[3] : 1
    };
  },

  toRgba({ r, g, b, a }) {
    if (a === undefined || a === 1) return `rgb(${r}, ${g}, ${b})`;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  },

  toHex({ r, g, b }) {
    var hex = (n) => n.toString(16).padStart(2, '0');
    return '#' + hex(r) + hex(g) + hex(b);
  },

  fromHex(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    var r = parseInt(hex.substr(0, 2), 16);
    var g = parseInt(hex.substr(2, 2), 16);
    var b = parseInt(hex.substr(4, 2), 16);
    return { r, g, b, a: 1 };
  },

  contrastRatio(col1, col2) {
    function luminance(c) {
      var srgb = [c.r, c.g, c.b].map(x => {
        x /= 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
    }
    var l1 = luminance(col1) + 0.05;
    var l2 = luminance(col2) + 0.05;
    return Math.max(l1, l2) / Math.min(l1, l2);
  },

  getElementTextColor(el) {
    var style = window.getComputedStyle(el);
    return this.parseRgba(style.color);
  },

  getElementBackgroundColor(el) {
    var style = window.getComputedStyle(el);
    return this.parseRgba(style.backgroundColor);
  }
};

// =========================
// Global helpers from RPC (will be injected)
// =========================
let RPC; // Will be passed in during initialization

// =========================
// Edit Mode
// =========================
var EditMode = {
  _enabled: false,

  isEnabled() { return this._enabled; },

  async enable() {
    this._enabled = true;
    document.body.classList.add('us-edit-mode');
    await this._saveState();
    console.log('[EditMode] Enabled');
  },

  async disable() {
    this._enabled = false;
    document.body.classList.remove('us-edit-mode');
    await this._saveState();
    console.log('[EditMode] Disabled');
  },

  async _saveState() {
    if (!RPC) return;
    await RPC.call('storage.set', ['userscripts:features:colorCustomizer:editMode', this._enabled]);
  },

  init() {
    this._bindGlobalHandler();
  },

  _bindGlobalHandler() {
    var self = this;
    document.addEventListener('click', function (e) {
      if (!self._enabled) return;
      if (e.target.closest('.us-cc-panel, #us-cc-tab, .us-cc-popover')) return;
      e.preventDefault();
      e.stopPropagation();
      ColorPopover.showFor(e.target);
    }, true);
  }
};

// =========================
// Rules Manager
// =========================
var RulesManager = {
  _rules: [],

  async load() {
    if (!RPC) return;
    var stored = await RPC.call('storage.get', ['userscripts:features:colorCustomizer:rules', '[]']);
    try {
      var allRules = JSON.parse(stored);
      this._rules = allRules.filter(rule => 
        this._isRuleForCurrentSite(rule.hostname, rule.pathname)
      );
    } catch (e) {
      console.error('[RulesManager] Failed to parse stored rules:', e);
      this._rules = [];
    }
  },

  async save() {
    if (!RPC) return;
    var stored = await RPC.call('storage.get', ['userscripts:features:colorCustomizer:rules', '[]']);
    try {
      var allRules = JSON.parse(stored);
      allRules = allRules.filter(rule => 
        !this._isRuleForCurrentSite(rule.hostname, rule.pathname)
      );
      allRules.push(...this._rules);
      await RPC.call('storage.set', ['userscripts:features:colorCustomizer:rules', JSON.stringify(allRules)]);
    } catch (e) {
      console.error('[RulesManager] Failed to save rules:', e);
    }
  },

  _isRuleForCurrentSite(hostname, pathname) {
    return hostname === window.location.hostname && 
           pathname === window.location.pathname;
  },

  getRules() {
    return [...this._rules];
  },

  addRule(selector, property, value) {
    var hostname = window.location.hostname;
    var pathname = window.location.pathname;
    var existingIndex = this._rules.findIndex(r => 
      r.selector === selector && r.property === property
    );
    var rule = { hostname, pathname, selector, property, value };
    if (existingIndex >= 0) {
      this._rules[existingIndex] = rule;
    } else {
      this._rules.push(rule);
    }
    this.save();
    StyleApplier.applyAll(this._rules);
  },

  removeRule(selector, property) {
    this._rules = this._rules.filter(r => 
      !(r.selector === selector && r.property === property)
    );
    this.save();
    StyleApplier.applyAll(this._rules);
  }
};

// =========================
// Profile Manager (Simplified)
// =========================
var ProfileManager = {
  _profiles: [],

  async load() {
    if (!RPC) return;
    this._profiles = [];
  },

  getProfiles() {
    return [...this._profiles];
  }
};

// =========================
// Style Applier
// =========================
var StyleApplier = {
  _style: null,

  applyAll(rules) {
    this._removeExisting();
    if (!rules || rules.length === 0) return;
    
    var css = rules.map(rule => 
      `${rule.selector} { ${rule.property}: ${rule.value} !important; }`
    ).join('\n');
    
    this._style = document.createElement('style');
    this._style.setAttribute('data-us-cc', 'rules');
    this._style.textContent = css;
    document.head.appendChild(this._style);
  },

  _removeExisting() {
    if (this._style) {
      this._style.remove();
      this._style = null;
    }
  }
};

// =========================
// Color Popover
// =========================
var ColorPopover = {
  _popover: null,
  _currentTarget: null,

  showFor(target) {
    this.hide();
    this._currentTarget = target;
    this._create(target);
  },

  hide() {
    if (this._popover) {
      this._popover.remove();
      this._popover = null;
    }
    this._currentTarget = null;
  },

  _create(target) {
    var popover = document.createElement('div');
    popover.className = 'us-cc-popover';
    
    var header = document.createElement('div');
    header.className = 'us-cc-popover-header';
    header.textContent = this._getTargetDescription(target);
    
    var colorRow = document.createElement('div');
    colorRow.className = 'us-cc-color-row';
    
    var bgButton = this._createColorButton('背景色', 'backgroundColor');
    var textButton = this._createColorButton('文字色', 'color');
    
    colorRow.appendChild(bgButton);
    colorRow.appendChild(textButton);
    
    popover.appendChild(header);
    popover.appendChild(colorRow);
    
    this._positionPopover(popover, target);
    document.body.appendChild(popover);
    this._popover = popover;
  },

  _getTargetDescription(target) {
    if (target.id) return `#${target.id}`;
    if (target.className) return `.${target.className.split(' ')[0]}`;
    return target.tagName.toLowerCase();
  },

  _createColorButton(label, property) {
    var button = document.createElement('button');
    button.className = 'us-cc-color-button';
    button.textContent = label;
    
    var self = this;
    button.addEventListener('click', function() {
      var input = document.createElement('input');
      input.type = 'color';
      input.addEventListener('change', function() {
        var selector = self._getSelector(self._currentTarget);
        RulesManager.addRule(selector, property, this.value);
        self.hide();
      });
      input.click();
    });
    
    return button;
  },

  _getSelector(target) {
    if (target.id) return `#${target.id}`;
    if (target.className) {
      var className = target.className.split(' ').filter(c => 
        !c.startsWith('us-') && c.trim()
      )[0];
      if (className) return `.${className}`;
    }
    return target.tagName.toLowerCase();
  },

  _positionPopover(popover, target) {
    var rect = target.getBoundingClientRect();
    popover.style.position = 'fixed';
    popover.style.left = rect.left + 'px';
    popover.style.top = (rect.bottom + 5) + 'px';
    popover.style.zIndex = '999999';
  }
};

// =========================
// Panel
// =========================
var Panel = {
  _panel: null,

  open() {
    if (this._panel) return;
    this._create();
  },

  close() {
    if (this._panel) {
      this._panel.remove();
      this._panel = null;
    }
  },

  _create() {
    var panel = document.createElement('div');
    panel.className = 'us-cc-panel';
    
    var header = document.createElement('div');
    header.className = 'us-cc-panel-header';
    header.innerHTML = `
      <span>カラーカスタマイザー</span>
      <button class="us-cc-close-btn">×</button>
    `;
    
    var content = document.createElement('div');
    content.className = 'us-cc-panel-content';
    
    var rules = RulesManager.getRules();
    if (rules.length === 0) {
      content.innerHTML = '<p>ルールがありません。要素をクリックして色を設定してください。</p>';
    } else {
      var list = document.createElement('ul');
      rules.forEach(rule => {
        var item = document.createElement('li');
        item.innerHTML = `
          <span>${rule.selector} { ${rule.property}: ${rule.value} }</span>
          <button class="us-cc-remove-rule" data-selector="${rule.selector}" data-property="${rule.property}">削除</button>
        `;
        list.appendChild(item);
      });
      content.appendChild(list);
    }
    
    panel.appendChild(header);
    panel.appendChild(content);
    
    this._bindEvents(panel);
    document.body.appendChild(panel);
    this._panel = panel;
  },

  _bindEvents(panel) {
    var self = this;
    
    panel.querySelector('.us-cc-close-btn').addEventListener('click', () => {
      self.close();
    });
    
    panel.addEventListener('click', function(e) {
      if (e.target.classList.contains('us-cc-remove-rule')) {
        var selector = e.target.getAttribute('data-selector');
        var property = e.target.getAttribute('data-property');
        RulesManager.removeRule(selector, property);
        self.close();
        setTimeout(() => self.open(), 100);
      }
    });
  }
};

// =========================
// Tab
// =========================
var Tab = {
  el: null,
  _tabEditCheck: null,

  create: function () {
    if (this.el) return;

    function h(tag, attrs, content) {
      var parts = tag.split(/([.#][^.#]+)/);
      var tagName = parts[0] || 'div';
      var el = document.createElement(tagName);
      parts.slice(1).forEach(function(part) {
        if (part.startsWith('.')) el.classList.add(part.slice(1));
        else if (part.startsWith('#')) el.id = part.slice(1);
      });
      if (attrs) Object.keys(attrs).forEach(key => el.setAttribute(key, attrs[key]));
      if (content) el.textContent = content;
      return el;
    }

    var toggleWrap = h('div.us-toggle-wrap', { title: 'Edit Mode切替' });
    var tabEditCheck = h('input', { type: 'checkbox', id: 'us-tab-edit-check' });
    var switchLabel = h('label.us-switch', { 'for': 'us-tab-edit-check' });
    switchLabel.appendChild(h('span.us-slider'));
    toggleWrap.appendChild(switchLabel);

    var iconWrap = h('div.us-cc-tab-icon', { title: 'ツール 設定' });
    var row = h('div.us-cc-tab-icon-row', {});
    var textSpan = h('span.us-cc-tab-text', {});
    textSpan.appendChild(document.createTextNode('あAa'));
    row.appendChild(textSpan);
    row.appendChild(h('div.us-cc-tab-swatch', { 'aria-hidden': 'true' }));
    iconWrap.appendChild(row);

    var tab = h('div', { id: 'us-cc-tab', 'data-us-cc': 'tab' });
    tab.appendChild(toggleWrap);
    tab.appendChild(iconWrap);

    toggleWrap.addEventListener('click', function (e) { e.stopPropagation(); });
    switchLabel.addEventListener('click', function (e) { e.stopPropagation(); });
    tabEditCheck.addEventListener('change', function () {
      if (this.checked) EditMode.enable(); else EditMode.disable();
    });

    iconWrap.addEventListener('click', function () {
        ColorPopover.hide();
        Panel.open();
      });

    document.body.appendChild(tab);
    this.el = tab;
    this._tabEditCheck = tabEditCheck;
  },

  setActive: function (active) {
    if (!this.el) return;
    if (active) {
      this.el.classList.add('us-tab-active');
    } else {
      this.el.classList.remove('us-tab-active');
    }
    if (this._tabEditCheck) this._tabEditCheck.checked = !!active;
  }
};

// =========================
// Feature Interface
// =========================
var ColorCustomizerFeature = {
  _initialized: false,

  async init(rpcInstance) {
    if (this._initialized) return true;
    
    // Inject RPC dependency
    RPC = rpcInstance;
    
    try {
      // Inject CSS styles first
      StyleManager.inject();
      
      await RulesManager.load();
      await ProfileManager.load();
      StyleApplier.applyAll(RulesManager.getRules());
      Tab.create();
      EditMode.init();
      Theme.init();
      
      // Restore Edit Mode state (with error handling)
      try {
        console.log('[ColorCustomizer] Checking edit mode state...');
        var editState = await RPC.call('storage.get', ['userscripts:features:colorCustomizer:editMode', false]);
        console.log('[ColorCustomizer] Edit state result:', editState);
        if (editState) {
          EditMode.enable();
        }
      } catch (editStateError) {
        console.warn('[ColorCustomizer] Failed to load edit state, continuing without it:', editStateError.message);
        // Don't fail the entire initialization for this non-critical feature
      }
      this._initialized = true;
      console.log('[ColorCustomizer] Initialized – ' + RulesManager.getRules().length + ' rule(s), ' + ProfileManager.getProfiles().length + ' profile(s) for ' + window.location.hostname + window.location.pathname);
      return true;
    } catch (e) {
      console.error('[ColorCustomizer] Init failed:', e);
      return false;
    }
  },

  enable: function () {
    EditMode.enable();
  },

  disable: function () {
    EditMode.disable();
  }
};

// Export the feature
export default ColorCustomizerFeature;