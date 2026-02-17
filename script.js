/**
 * UserScript - Web Color Customizer
 * Provides comprehensive color customization capabilities for web pages
 */

(function () {
  'use strict';

  // =========================
  // RPC Client (based on README.md specs)
  // =========================
  var REQ_FLAG = '__US_RPC__';
  var REP_FLAG = '__US_RPC_REPLY__';

  function makeId() {
    return 'rpc_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
  }

  function rpcCall(token, method, params, timeoutMs) {
    timeoutMs = typeof timeoutMs === 'number' ? timeoutMs : 15000;
    var id = makeId();

    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        cleanup();
        reject(new Error('RPC timeout: ' + method));
      }, timeoutMs);

      function onMsg(ev) {
        if (ev.source !== window) return;
        var d = ev.data;
        if (!d || d[REP_FLAG] !== true || d.id !== id) return;
        cleanup();
        if (d.ok) resolve(d.result);
        else reject(new Error(d.error || ('RPC error: ' + method)));
      }

      function cleanup() {
        clearTimeout(timer);
        window.removeEventListener('message', onMsg);
      }

      window.addEventListener('message', onMsg);

      window.postMessage(
        {
          [REQ_FLAG]: true,
          id: id,
          token: token,
          method: method,
          params: params || []
        },
        '*'
      );
    });
  }

  async function handshake() {
    var id = makeId();
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        cleanup();
        reject(new Error('RPC timeout: core.handshake'));
      }, 8000);

      function onMsg(ev) {
        if (ev.source !== window) return;
        var d = ev.data;
        if (!d || d[REP_FLAG] !== true || d.id !== id) return;
        cleanup();
        if (d.ok) resolve(d.result);
        else reject(new Error(d.error || 'RPC error: core.handshake'));
      }

      function cleanup() {
        clearTimeout(timer);
        window.removeEventListener('message', onMsg);
      }

      window.addEventListener('message', onMsg);

      window.postMessage(
        {
          [REQ_FLAG]: true,
          id: id,
          token: '',
          method: 'core.handshake',
          params: []
        },
        '*'
      );
    });
  }

  // RPC API wrapper
  var RPC = {
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

  // =========================
  // Preset Themes
  // =========================
  var PRESET_THEMES = {
    default: {
      id: 'default',
      name: 'デフォルト（リセット）',
      colors: {
        background: '',
        text: '',
        link: '',
        linkVisited: '',
        linkHover: '',
        border: '',
        code: '',
        codeBackground: ''
      }
    },
    dark: {
      id: 'dark',
      name: 'ダークモード',
      colors: {
        background: '#1a1a1a',
        text: '#e0e0e0',
        link: '#4fc3f7',
        linkVisited: '#ba68c8',
        linkHover: '#29b6f6',
        border: '#333333',
        code: '#ffeb3b',
        codeBackground: '#2d2d2d'
      }
    },
    light: {
      id: 'light',
      name: 'ライトモード',
      colors: {
        background: '#ffffff',
        text: '#333333',
        link: '#1976d2',
        linkVisited: '#7b1fa2',
        linkHover: '#1565c0',
        border: '#e0e0e0',
        code: '#d84315',
        codeBackground: '#f5f5f5'
      }
    },
    sepia: {
      id: 'sepia',
      name: 'セピア（目に優しい）',
      colors: {
        background: '#f4f3e0',
        text: '#5d4e37',
        link: '#8b4513',
        linkVisited: '#a0522d',
        linkHover: '#cd853f',
        border: '#ddd8c0',
        code: '#b22222',
        codeBackground: '#faf8e7'
      }
    },
    highContrast: {
      id: 'highContrast',
      name: 'ハイコントラスト',
      colors: {
        background: '#000000',
        text: '#ffffff',
        link: '#00ff00',
        linkVisited: '#ff00ff',
        linkHover: '#00ffff',
        border: '#ffffff',
        code: '#ffff00',
        codeBackground: '#333333'
      }
    }
  };

  // =========================
  // Color Customizer Core
  // =========================
  var ColorCustomizer = {
    currentDomain: window.location.hostname,
    currentSettings: null,
    
    // Storage key patterns (per README.md recommendations)
    getStorageKey: function(key) {
      return 'userscripts:features:colorCustomizer:' + key;
    },

    getSiteKey: function(domain) {
      // Clean domain and create storage key
      domain = domain || this.currentDomain;
      return this.getStorageKey('site:' + domain);
    },

    async loadSettings() {
      try {
        var siteKey = this.getSiteKey();
        var settings = await RPC.call('storage.get', [siteKey, null]);
        
        // If site-specific settings exist, use them; otherwise use default
        if (settings && settings.colors) {
          this.currentSettings = settings;
        } else {
          this.currentSettings = this.createDefaultSettings();
        }
        
        return this.currentSettings;
      } catch (e) {
        console.warn('[ColorCustomizer] Failed to load settings:', e);
        this.currentSettings = this.createDefaultSettings();
        return this.currentSettings;
      }
    },

    async saveSettings(settings) {
      try {
        settings = settings || this.currentSettings;
        if (!settings) return false;

        var siteKey = this.getSiteKey();
        await RPC.call('storage.set', [siteKey, settings]);
        this.currentSettings = settings;
        return true;
      } catch (e) {
        console.error('[ColorCustomizer] Failed to save settings:', e);
        return false;
      }
    },

    createDefaultSettings: function() {
      return {
        enabled: true,
        theme: 'default',
        colors: Object.assign({}, PRESET_THEMES.default.colors),
        lastModified: Date.now()
      };
    },

    applyTheme: function(themeId) {
      var theme = PRESET_THEMES[themeId];
      if (!theme) {
        console.warn('[ColorCustomizer] Unknown theme:', themeId);
        return false;
      }

      this.currentSettings = this.currentSettings || this.createDefaultSettings();
      this.currentSettings.theme = themeId;
      this.currentSettings.colors = Object.assign({}, theme.colors);
      this.currentSettings.lastModified = Date.now();

      this.applyStyles();
      return true;
    },

    applyColorChange: function(colorType, value) {
      this.currentSettings = this.currentSettings || this.createDefaultSettings();
      this.currentSettings.colors = this.currentSettings.colors || {};
      this.currentSettings.colors[colorType] = value;
      this.currentSettings.theme = 'custom'; // Mark as custom when manually changed
      this.currentSettings.lastModified = Date.now();

      this.applyStyles();
    },

    generateCSS: function(colors) {
      colors = colors || (this.currentSettings && this.currentSettings.colors) || {};
      var css = '/* UserScript Color Customizer */\n';

      // Only add rules for non-empty color values
      if (colors.background) {
        css += '*, *::before, *::after { background-color: ' + colors.background + ' !important; }\n';
        css += 'body, html { background-color: ' + colors.background + ' !important; }\n';
      }

      if (colors.text) {
        css += '*, *::before, *::after { color: ' + colors.text + ' !important; }\n';
      }

      if (colors.link) {
        css += 'a, a:link { color: ' + colors.link + ' !important; }\n';
      }

      if (colors.linkVisited) {
        css += 'a:visited { color: ' + colors.linkVisited + ' !important; }\n';
      }

      if (colors.linkHover) {
        css += 'a:hover, a:focus { color: ' + colors.linkHover + ' !important; }\n';
      }

      if (colors.border) {
        css += '*, *::before, *::after { border-color: ' + colors.border + ' !important; }\n';
      }

      if (colors.code) {
        css += 'code, kbd, samp, pre { color: ' + colors.code + ' !important; }\n';
      }

      if (colors.codeBackground) {
        css += 'code, kbd, samp, pre { background-color: ' + colors.codeBackground + ' !important; }\n';
      }

      return css;
    },

    async applyStyles() {
      try {
        var styleId = this.getStorageKey('runtime');
        var css = '';
        
        if (this.currentSettings && this.currentSettings.enabled) {
          css = this.generateCSS(this.currentSettings.colors);
        }

        await RPC.call('style.add', [css, { id: styleId, replace: true }]);
      } catch (e) {
        console.error('[ColorCustomizer] Failed to apply styles:', e);
      }
    },

    async reset() {
      this.currentSettings = this.createDefaultSettings();
      await this.saveSettings();
      await this.applyStyles();
    },

    async toggle() {
      this.currentSettings = this.currentSettings || this.createDefaultSettings();
      this.currentSettings.enabled = !this.currentSettings.enabled;
      await this.saveSettings();
      await this.applyStyles();
      return this.currentSettings.enabled;
    }
  };

  // =========================
  // UI Components
  // =========================
  var UI = {
    modal: null,
    isVisible: false,

    createModal: function() {
      if (this.modal) return this.modal;

      // Create modal container
      var modal = document.createElement('div');
      modal.setAttribute('data-userscripts-color-customizer', 'modal');
      modal.style.cssText = [
        'position: fixed !important',
        'top: 0 !important',
        'left: 0 !important',
        'width: 100vw !important',
        'height: 100vh !important',
        'background-color: rgba(0, 0, 0, 0.7) !important',
        'z-index: 999999 !important',
        'display: none !important',
        'align-items: center !important',
        'justify-content: center !important'
      ].join(';');

      // Create modal content
      var content = document.createElement('div');
      content.style.cssText = [
        'background: white !important',
        'border-radius: 8px !important',
        'padding: 20px !important',
        'max-width: 500px !important',
        'width: 90% !important',
        'max-height: 80vh !important',
        'overflow-y: auto !important',
        'color: black !important',
        'font-family: system-ui, -apple-system, sans-serif !important',
        'font-size: 14px !important',
        'line-height: 1.4 !important'
      ].join(';');

      content.innerHTML = this.getModalHTML();
      
      modal.appendChild(content);
      document.body.appendChild(modal);

      // Event listeners
      modal.addEventListener('click', function(e) {
        if (e.target === modal) UI.hide();
      });

      this.bindEvents(content);
      this.modal = modal;
      return modal;
    },

    getModalHTML: function() {
      return [
        '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px;">',
          '<h3 style="margin: 0; color: black !important; font-size: 18px;">カラーカスタマイザー</h3>',
          '<button id="color-customizer-close" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">&times;</button>',
        '</div>',
        
        '<div style="margin-bottom: 15px;">',
          '<label style="display: block; margin-bottom: 5px; font-weight: 500; color: black !important;">プリセットテーマ:</label>',
          '<select id="color-customizer-theme" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; color: black !important;">',
            Object.keys(PRESET_THEMES).map(function(id) {
              return '<option value="' + id + '">' + PRESET_THEMES[id].name + '</option>';
            }).join(''),
          '</select>',
        '</div>',

        '<div style="margin-bottom: 20px;">',
          '<h4 style="margin: 10px 0 10px 0; color: black !important; font-size: 14px;">カスタム色設定:</h4>',
          this.createColorInput('background', '背景色'),
          this.createColorInput('text', 'テキスト色'),
          this.createColorInput('link', 'リンク色'),
          this.createColorInput('linkVisited', '訪問済みリンク色'),
          this.createColorInput('linkHover', 'リンクホバー色'),
          this.createColorInput('border', 'ボーダー色'),
          this.createColorInput('code', 'コード文字色'),
          this.createColorInput('codeBackground', 'コード背景色'),
        '</div>',

        '<div style="display: flex; gap: 10px; justify-content: space-between;">',
          '<button id="color-customizer-reset" style="padding: 10px 15px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">リセット</button>',
          '<div style="display: flex; gap: 10px;">',
            '<button id="color-customizer-toggle" style="padding: 10px 15px; background: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">ON/OFF</button>',
            '<button id="color-customizer-save" style="padding: 10px 15px; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">保存</button>',
          '</div>',
        '</div>'
      ].join('');
    },

    createColorInput: function(colorType, label) {
      return [
        '<div style="display: flex; align-items: center; margin-bottom: 8px;">',
          '<label style="flex: 1; color: black !important; font-size: 13px;">' + label + ':</label>',
          '<input type="color" id="color-customizer-' + colorType + '" style="width: 50px; height: 30px; border: none; cursor: pointer;">',
          '<input type="text" id="color-customizer-' + colorType + '-text" placeholder="#000000" style="width: 80px; padding: 4px; margin-left: 8px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; color: black !important;">',
          '<button type="button" onclick="document.getElementById(\'color-customizer-' + colorType + '\').value=\'\'; document.getElementById(\'color-customizer-' + colorType + '-text\').value=\'\'; UI.handleColorChange(\'' + colorType + '\', \'\');" style="margin-left: 5px; padding: 2px 6px; font-size: 11px; background: #999; color: white; border: none; border-radius: 2px; cursor: pointer;">✕</button>',
        '</div>'
      ].join('');
    },

    bindEvents: function(container) {
      var self = this;

      // Close button
      container.querySelector('#color-customizer-close').addEventListener('click', function() {
        self.hide();
      });

      // Theme selector
      container.querySelector('#color-customizer-theme').addEventListener('change', function() {
        var themeId = this.value;
        ColorCustomizer.applyTheme(themeId);
        self.updateForm();
      });

      // Color inputs
      var colorTypes = ['background', 'text', 'link', 'linkVisited', 'linkHover', 'border', 'code', 'codeBackground'];
      colorTypes.forEach(function(colorType) {
        var colorInput = container.querySelector('#color-customizer-' + colorType);
        var textInput = container.querySelector('#color-customizer-' + colorType + '-text');

        if (colorInput) {
          colorInput.addEventListener('input', function() {
            textInput.value = this.value;
            self.handleColorChange(colorType, this.value);
          });
        }

        if (textInput) {
          textInput.addEventListener('input', function() {
            if (this.value && /^#[0-9a-fA-F]{6}$/.test(this.value)) {
              colorInput.value = this.value;
            }
            self.handleColorChange(colorType, this.value);
          });
        }
      });

      // Action buttons
      container.querySelector('#color-customizer-reset').addEventListener('click', function() {
        if (confirm('設定をリセットしますか？')) {
          ColorCustomizer.reset().then(function() {
            self.updateForm();
          });
        }
      });

      container.querySelector('#color-customizer-toggle').addEventListener('click', function() {
        ColorCustomizer.toggle().then(function(enabled) {
          this.textContent = enabled ? 'ON' : 'OFF';
        }.bind(this));
      });

      container.querySelector('#color-customizer-save').addEventListener('click', function() {
        ColorCustomizer.saveSettings().then(function(success) {
          if (success) {
            alert('設定を保存しました');
          } else {
            alert('保存に失敗しました');
          }
        });
      });
    },

    handleColorChange: function(colorType, value) {
      ColorCustomizer.applyColorChange(colorType, value);
    },

    updateForm: function() {
      if (!this.modal || !ColorCustomizer.currentSettings) return;

      var settings = ColorCustomizer.currentSettings;
      
      // Update theme selector
      var themeSelect = this.modal.querySelector('#color-customizer-theme');
      if (themeSelect) {
        themeSelect.value = settings.theme || 'default';
      }

      // Update color inputs
      var colors = settings.colors || {};
      Object.keys(colors).forEach(function(colorType) {
        var colorInput = this.modal.querySelector('#color-customizer-' + colorType);
        var textInput = this.modal.querySelector('#color-customizer-' + colorType + '-text');
        
        var value = colors[colorType] || '';
        if (colorInput) colorInput.value = value;
        if (textInput) textInput.value = value;
      }.bind(this));

      // Update toggle button
      var toggleBtn = this.modal.querySelector('#color-customizer-toggle');
      if (toggleBtn) {
        toggleBtn.textContent = settings.enabled ? 'ON' : 'OFF';
      }
    },

    async show() {
      if (!this.modal) {
        this.createModal();
      }

      await ColorCustomizer.loadSettings();
      this.updateForm();

      this.modal.style.display = 'flex';
      this.isVisible = true;
    },

    hide: function() {
      if (this.modal) {
        this.modal.style.display = 'none';
      }
      this.isVisible = false;
    },

    toggle: function() {
      if (this.isVisible) {
        this.hide();
      } else {
        this.show();
      }
    }
  };

  // =========================
  // Feature Interface for external access
  // =========================
  var ColorCustomizerFeature = {
    async init() {
      try {
        await RPC.init();
        await ColorCustomizer.loadSettings();
        await ColorCustomizer.applyStyles();
        
        // Add keyboard shortcut (Ctrl+Shift+C)
        document.addEventListener('keydown', function(e) {
          if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            UI.toggle();
          }
        });

        console.log('[ColorCustomizer] Initialized successfully for domain:', ColorCustomizer.currentDomain);
        return true;
      } catch (e) {
        console.error('[ColorCustomizer] Failed to initialize:', e);
        return false;
      }
    },

    showUI() {
      return UI.show();
    },

    hideUI() {
      return UI.hide();
    },

    toggleUI() {
      return UI.toggle();
    },

    applyTheme(themeId) {
      return ColorCustomizer.applyTheme(themeId);
    },

    reset() {
      return ColorCustomizer.reset();
    },

    getPresetThemes() {
      return PRESET_THEMES;
    },

    getCurrentSettings() {
      return ColorCustomizer.currentSettings;
    }
  };

  // =========================
  // Global API
  // =========================
  window.US = window.US || {};
  window.US.rpc = RPC;
  
  // Features namespace
  window.UserScripts = window.UserScripts || {};
  window.UserScripts.features = window.UserScripts.features || {};
  window.UserScripts.features.colorCustomizer = ColorCustomizerFeature;

  // Global init function
  window.UserScripts.init = function() {
    console.log('[UserScripts] Core initialized');
    // Additional global initialization can go here
  };

})();
