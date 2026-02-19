# UserScripts – Module-based Architecture (v2.0.4)

**リポジトリ**: `userScripts`  
**CDN（jsDelivr）**: `https://cdn.jsdelivr.net/gh/done-is-better-than-perfect/userScripts@<tag-or-branch>/script.js`  
例: 最新 main … `@main/script.js`、安定版 … `@v2.0.4/script.js`

## 🆕 Version 2.0.4 の修正内容

### 🐛 デバッグ強化 + jQuery競合修正
- **包括的ログ追加**: Tab・EditMode・ColorPopoverの動作トレース  
- **URL Hash クリーンアップ**: version=x.x.xを削除してjQuery競合エラーを回避
- **UI動作検証**: 各コンポーネントのイベント処理確認機能
- **input要素修正**: Tab toggleでcheckbox要素を適切にDOM追加

### 修正されたエラー  
```
Uncaught Error: Syntax error, unrecognized expression: #version=v2.0.3
```

## Version 2.0.3 の修正内容

### 🐛 構文エラー修正（緊急修正）
- **SyntaxError解決**: 余分な閉じ括弧`}`を削除
- **スクリプト読み込み修復**: JavaScriptパーサーエラーを解決
- **appendChild実行エラー**: 構文問題によるDOM操作失敗を修正

### 修正されたエラー
```
script.js:127 Uncaught SyntaxError: Failed to execute 'appendChild' on 'Node': Unexpected token ';'
```

## Version 2.0.2 の修正内容

### 🔐 RPC認証システム修正  
- **Handshake認証**: 適切なToken取得プロセスを実装
- **認証エラー解決**: `Unauthorized`エラーとRPCタイムアウトを修正
- **デバッグログ強化**: RPC通信の詳細トレースを追加
- **エラーハンドリング**: Edit Mode状態取得の耐障害性を向上

### 修正されたエラー
```
[ColorCustomizer] Init failed: Error: RPC timeout: storage.get
Unauthorized
```

### 技術的改善
- RPC.init()でcore.handshakeを実行しているTokenを取得  
- 固定文字列`'auto'`トークンから動的トークン認証に変更
- 非クリティカル機能のエラーで全体初期化を停止させない設計

## Version 2.0.1 の修正内容

### 🐛 Critical Bug Fixes
- **RPC通信エラー修正**: `params`/`token` パラメータ形式をload.jsに合わせて修正
- **ModuleLoader改善**: jsDelivr CDNでのbaseURL検出精度を向上
- **エラーログ強化**: デバッグ情報とエラーハンドリングを改善

### 修正されたエラー
```
[ColorCustomizer] Init failed: Error: RPC timeout: storage.get
```

## Version 2.0 の主な変更点

### モジュールベースアーキテクチャ
- colorEditor機能をES Moduleとして独立したファイル（`modules/colorEditor.js`）に分離
- 右端タブ名を「colorEditor」から「ツール」に変更し、階層を抽象化
- `FeatureManager`による機能の動的読み込みシステムを導入
- コードの保守性と拡張性を向上

### アーキテクチャ概要
```
script.js (Core)
├── RPC Client
├── SelectorEngine  
├── ModuleLoader
└── FeatureManager
    └── modules/colorEditor.js (ES Module)
        ├── Theme System
        ├── Color Utilities
        ├── Edit Mode
        ├── Rules Manager
        ├── Style Applier
        └── UI Components
```

---
---

## RPC 仕様

本仕様は、**page world（外部 `script.js`）** から **content world（UserScript本体）** へ `window.postMessage` で呼び出す RPC を定義する。

### Loader ファイル

| ファイル | 対象 |
|----------|------|
| `load.js` | Safari（Userscripts 等）。`@inject-into content` 使用。外部 script は `type="module"` で読み込み。 |
| `load.tampermonkey.js` | Chrome Tampermonkey。メタデータは Tampermonkey 用。外部 script は `type="text/javascript"` で読み込み。 |

いずれも同じ RPC 仕様に従い、`script.js` は両方の loader からそのまま利用可能。

---

## 1. 用語

* **page**: `<script src="...">` で読み込まれる外部 `script.js` が動く世界（WebページのJSと同じ）
* **content**: UserScript本体が動く世界（GM_* が利用可能なことが多い / isolated）
* **RPC**: `postMessage` による request/reply 形式のメソッド呼び出し

---

## 2. チャネル定義

### 2.1 フラグ

* request フラグ: `__US_RPC__ === true`
* reply フラグ: `__US_RPC_REPLY__ === true`

### 2.2 宛先

* request: `window.postMessage(req, "*")`
* reply: `window.postMessage(rep, "*")`
* 受信側は `event.source === window` を必ず確認する（同一ウィンドウ限定）

---

## 3. メッセージフォーマット

### 3.1 Request

```json
{
  "__US_RPC__": true,
  "id": "string",
  "token": "string",
  "method": "string",
  "params": []
}
```

* `id`: 相関ID（ユニーク）
* `token`: `core.handshake` で払い出されたトークン
* `method`: メソッド名（例: `storage.get`）
* `params`: JSON シリアライズ可能な値のみ（関数/DOM/循環参照は禁止）

### 3.2 Reply

```json
{
  "__US_RPC_REPLY__": true,
  "id": "string",
  "ok": true,
  "result": {}
}
```

またはエラー時:

```json
{
  "__US_RPC_REPLY__": true,
  "id": "string",
  "ok": false,
  "error": "string"
}
```

---

## 4. セキュリティ要件（必須）

### 4.1 handshake token

* content 側は起動時にランダムトークンを生成する
* page 側は `core.handshake` を最初に呼び出して `token` を取得する
* **以後の全 RPC は token 必須**
* token 不一致 / 未設定の場合、content 側は `ok=false` で拒否する

> 目的: 任意サイト上の他スクリプトから勝手に `storage.*` / `net.*` を叩かれるリスク低減

---

## 5. JSON Schema 風の型定義

以降は「JSON Schema 風（擬似）」の定義。実装は JS だが、引数・戻り値の形を固定する。

### 5.1 共通型

#### `RpcError`

```json
{
  "type": "object",
  "required": ["code", "message"],
  "properties": {
    "code": { "type": "string" },
    "message": { "type": "string" },
    "detail": {}
  }
}
```

※ reply の `error` は最小 `string` で返すが、将来 `result.error` に拡張する余地を残す。

---

## 6. メソッド一覧（確定）

### 6.1 core

#### `core.handshake`

* params: `[]`
* result:

```json
{
  "type": "object",
  "required": ["token", "version", "capabilities"],
  "properties": {
    "token": { "type": "string" },
    "version": { "type": "string" },
    "capabilities": {
      "type": "object",
      "properties": {
        "gm": {
          "type": "object",
          "properties": {
            "getValue": { "type": "boolean" },
            "setValue": { "type": "boolean" },
            "listValues": { "type": "boolean" },
            "deleteValue": { "type": "boolean" },
            "addStyle": { "type": "boolean" },
            "xmlHttpRequest": { "type": "boolean" },
            "setClipboard": { "type": "boolean" }
          }
        }
      }
    }
  }
}
```

* 備考:

  * `capabilities` は「この環境で何が使えるか」の判定用
  * `version` は UserScriptローダー側（またはブリッジ側）のバージョン

---

### 6.2 storage

キー空間の衝突を避けるため、推奨 prefix:

* `userscripts:`（全体）
* `userscripts:features:<featureName>:`（機能別）
* `userscripts:features:colorCustomizer:`（例）

#### `storage.get`

* params: `[key: string, defaultValue: any]`
* result: `any`

#### `storage.set`

* params: `[key: string, value: any]`
* result: `true`

#### `storage.delete`

* params: `[key: string]`
* result: `true`

#### `storage.listKeys`

* params: `[]`
* result:

```json
{
  "type": "array",
  "items": { "type": "string" }
}
```

#### `storage.getAllByPrefix`

* params: `[prefix: string]`
* result:

```json
{
  "type": "object",
  "additionalProperties": true
}
```

#### `storage.setMany`

* params:

```json
[
  {
    "type": "array",
    "items": {
      "type": "object",
      "required": ["key", "value"],
      "properties": {
        "key": { "type": "string" },
        "value": {}
      }
    }
  }
]
```

* result: `true`

---

### 6.3 net

#### `NetRequestOptions`

```json
{
  "type": "object",
  "required": ["url"],
  "properties": {
    "url": { "type": "string" },
    "method": { "type": "string", "enum": ["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"] },
    "headers": { "type": "object", "additionalProperties": { "type": "string" } },
    "data": { "type": "string" },
    "responseType": { "type": "string", "enum": ["text","json","arraybuffer","blob"] },
    "timeoutMs": { "type": "number" },
    "withCredentials": { "type": "boolean" }
  },
  "additionalProperties": false
}
```

#### `NetResponse`

```json
{
  "type": "object",
  "required": ["status"],
  "properties": {
    "status": { "type": "number" },
    "statusText": { "type": "string" },
    "finalUrl": { "type": "string" },
    "headers": { "type": "string" },
    "responseText": { "type": "string" },
    "responseJson": {}
  }
}
```

#### `net.request`

* params: `[options: NetRequestOptions]`
* result: `NetResponse`

> 注: `arraybuffer/blob` は postMessage 転送負荷が高いので、初期実装は `text/json` 中心でも良い（その場合 `responseType` を拒否 or `responseText` のみ返す）

---

### 6.4 style

#### `style.add`

* params: `[cssText: string, meta?: { id?: string, replace?: boolean }]`
* result:

```json
{
  "type": "object",
  "required": ["styleId"],
  "properties": {
    "styleId": { "type": "string" }
  }
}
```

ルール:

* `meta.id` が指定されている場合:

  * `replace=true` なら同一 `meta.id` の style を置換
  * `replace=false` なら存在する場合はそのまま返す（または新規生成しない）
* `meta.id` が無い場合:

  * content 側が一意の `styleId` を発行する

#### `style.remove`

* params: `[styleIdOrMetaId: string]`
* result: `true`

#### `style.clearByPrefix`

* params: `[prefix: string]`
* result: `number`（削除件数）

---

### 6.5 clipboard

#### `clipboard.setText`

* params: `[text: string]`
* result: `true | false`（環境依存で失敗あり）

---

### 6.6 log

#### `log`

* params:

```json
[
  {
    "type": "object",
    "required": ["level", "message"],
    "properties": {
      "level": { "type": "string", "enum": ["debug","info","warn","error"] },
      "message": { "type": "string" },
      "data": {}
    }
  }
]
```

* result: `true`

---

## 7. 実装（page 側 / 外部 script.js 用の rpc クライアント）

以下は page world で動く **共通 RPC クライアント**。
外部 `script.js` はこれを内包し、以後 `US.rpc.*` の形で呼ぶ。

```javascript
(function () {
  'use strict';

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
    // handshakeは token 不要なので token を空にして呼ぶ（content側が例外扱い）
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

  // 外部script.jsから使うAPI（例）
  window.US = window.US || {};
  window.US.rpc = {
    handshake: handshake,
    call: rpcCall
  };
})();
```

---

## 8. 実装（content 側 / UserScriptローダー内の RPC サーバ）

以下は content world に置く **RPC サーバ（ブリッジ）**。
（あなたのローダーに組み込む想定。ここだけが GM_* を直接触る。）

```javascript
(function () {
  'use strict';

  var REQ_FLAG = '__US_RPC__';
  var REP_FLAG = '__US_RPC_REPLY__';

  // ---- token ----
  var TOKEN = (function () {
    // できるだけ予測困難に（cryptoが無い環境もあるのでフォールバック）
    try {
      var a = new Uint8Array(16);
      crypto.getRandomValues(a);
      return Array.from(a).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    } catch (e) {
      return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
    }
  })();

  var VERSION = 'bridge-0.1.0';

  // ---- style registry (meta.id / styleId 管理) ----
  var styleMap = new Map(); // key: id or styleId, value: { el, metaId, styleId }

  function hasGM(name) {
    if (typeof GM !== 'undefined' && GM[name]) return true;
    return false;
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

  function reply(id, ok, payload) {
    var msg = Object.assign({ [REP_FLAG]: true, id: id, ok: ok }, payload);
    window.postMessage(msg, '*');
  }

  function ensureToken(method, token) {
    if (method === 'core.handshake') return true;
    return token && token === TOKEN;
  }

  function safeJson(x) {
    return x == null ? x : JSON.parse(JSON.stringify(x));
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
      // GM.addStyleは要素を返す実装が多いが、依存しない
      GM.addStyle(cssText);
      return Promise.resolve();
    }
    if (typeof GM_addStyle === 'function') {
      GM_addStyle(cssText);
      return Promise.resolve();
    }
    // fallback
    var style = document.createElement('style');
    style.textContent = String(cssText || '');
    (document.head || document.documentElement).appendChild(style);
    return Promise.resolve();
  }

  function gmXhr(options) {
    if (typeof GM !== 'undefined' && GM.xmlHttpRequest) {
      return GM.xmlHttpRequest(options);
    }
    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise(function (resolve, reject) {
        var o = Object.assign({}, options);
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
    } catch (e) {}
    return false;
  }

  function parseHeaders(raw) {
    // raw: "k: v\nk2: v2\n..."
    return typeof raw === 'string' ? raw : '';
  }

  function genStyleId() {
    return 'style_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
  }

  async function handle(method, params) {
    // ---- core ----
    if (method === 'core.handshake') {
      return { token: TOKEN, version: VERSION, capabilities: caps() };
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
      var res = await gmXhr({
        url: opt.url,
        method: opt.method || 'GET',
        headers: opt.headers || {},
        data: opt.data,
        timeout: opt.timeoutMs,
        responseType: opt.responseType, // 環境により未対応あり
        withCredentials: opt.withCredentials
      });

      // 返す内容は最小限（巨大化を避ける）
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
        // metaId をキーに置換/再利用
        var existing = styleMap.get(metaId);
        if (existing) {
          if (replace) {
            existing.el.textContent = css;
          }
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
      if (rec && rec.el && rec.el.parentNode) {
        rec.el.parentNode.removeChild(rec.el);
      }
      // 可能なら metaId / styleId 両方掃除
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
      // metaIdで管理されてるものだけ掃除したいので、metaId優先で走査
      Array.from(styleMap.keys()).forEach(function (k) {
        if (k && k.indexOf(pfx) === 0) {
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

  window.addEventListener('message', function (ev) {
    if (ev.source !== window) return;
    var data = ev.data;
    if (!data || data[REQ_FLAG] !== true) return;

    var id = data.id;
    var token = data.token;
    var method = data.method;
    var params = data.params || [];

    if (!ensureToken(method, token)) {
      reply(id, false, { error: 'Unauthorized' });
      return;
    }

    Promise.resolve()
      .then(function () { return handle(method, params); })
      .then(function (result) { reply(id, true, { result: safeJson(result) }); })
      .catch(function (e) { reply(id, false, { error: String(e && e.message ? e.message : e) }); });
  });
})();
```

---

## 9. 利用例（page 側 / 外部 script.js）

### 9.1 初期化（handshake）

```javascript
(async function () {
  const hs = await window.US.rpc.handshake();
  const token = hs.token;

  // 例: 設定取得
  const v = await window.US.rpc.call(token, 'storage.get', ['userscripts:foo', null]);

  // 例: CSS注入（機能別prefix推奨）
  await window.US.rpc.call(token, 'style.add', [
    '.some { color: red; }',
    { id: 'userscripts:features:colorCustomizer:runtime', replace: true }
  ]);

  // 例: 外部API
  const res = await window.US.rpc.call(token, 'net.request', [
    { url: 'https://example.com/api', method: 'GET', responseType: 'json' }
  ]);

  // 例: クリップボード
  await window.US.rpc.call(token, 'clipboard.setText', [JSON.stringify({ hello: 'world' })]);
})();
```

---

## 10. 運用上の前提（この仕様で固定するもの）

* **page 側は GM_* を直接呼ばない**（呼べない環境があるため）
* 特権は **すべて `storage.* / net.* / style.* / clipboard.*` を経由**
* 外部 `script.js` は今後増える前提だが、特権APIはこの RPC 層に集約する
* メソッド追加は可能だが、既存メソッドのシグネチャ変更は互換性を壊すため避ける
