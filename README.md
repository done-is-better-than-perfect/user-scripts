# UserScripts

Web ページの要素カスタマイズやフォームデータ取得を行うモジュール式 UserScript フレームワーク。

**CDN (jsDelivr)**:
```
https://cdn.jsdelivr.net/gh/done-is-better-than-perfect/userScripts@<tag-or-branch>/script.js
```
- 最新: `@main/script.js`
- バージョン固定: `@v1.7.0/script.js`

---

## ファイル構成

```
userScripts/
├── script.js                  エントリポイント（Panel管理・Feature初期化）
├── load.js                    Safari用ローダー + RPCブリッジ
├── load.tampermonkey.js       Chrome Tampermonkey用ローダー + RPCブリッジ
├── vcp.sh                     バージョン管理スクリプト
├── modules/
│   ├── util.js                RPCクライアント・DOM helper (h, makeSvg, createGearNode)
│   ├── base.js                BasePanelFeature 抽象クラス
│   ├── colorEditor.js         色カスタマイズ機能
│   └── dataFiller.js          フォームデータ取得機能
└── docs/
    └── dataFiller-spec.md     dataFiller 機能仕様書
```

---

## アーキテクチャ

### 全体像

```
Content World (load.js / load.tampermonkey.js)
└── RPCサーバー（GM_* APIブリッジ）
    Handshakeトークン認証 → storage / net / style / clipboard / log

        ↕ postMessage RPC

Page World (script.js + modules/)
├── RPC Client (modules/util.js)
├── Panel Manager (設定サイドバー)
└── Feature Manager
    ├── ColorEditorFeature (modules/colorEditor.js)
    │   ├── SelectorEngine    CSS セレクタ生成
    │   ├── RulesManager      ルール永続化
    │   ├── StyleApplier      CSS 注入
    │   ├── EditMode          キャプチャ ON/OFF
    │   └── ColorPopover      カラーピッカー UI
    └── DataFillerFeature (modules/dataFiller.js)
        ├── XPath 生成        フォーム要素の位置特定
        ├── ラベル抽出        label/span/div からの項目名取得
        ├── CSV エクスポート   テンプレート出力
        └── Popover UI        ホバー/クリックでの登録
```

### Content / Page World 分離

- **Content World**: ローダー（`load.js` / `load.tampermonkey.js`）が動く。GM_* API にアクセスできる isolated な環境。
- **Page World**: `script.js` + `modules/` が ES Module として動く。Web ページの JS と同じコンテキスト。
- 両者は `postMessage` ベースの RPC で通信する。Page 側は GM_* を直接呼ばない。

### Loader

| ファイル | 対象環境 | 外部 script の読み込み方式 |
|----------|----------|--------------------------|
| `load.js` | Safari (Userscripts 等) | `type="module"` / `@inject-into content` |
| `load.tampermonkey.js` | Chrome Tampermonkey | `type="text/javascript"` |

いずれも同一の RPC 仕様に従い、`script.js` は両ローダーからそのまま利用可能。

### Feature の追加方法

1. `BasePanelFeature`（`modules/base.js`）を継承したクラスを作成
2. `init(deps)` / `getListRow()` / `getScreen()` を実装
3. `script.js` で import し、`featureInstances` 配列に追加

### ストレージ prefix 規約

キー空間の衝突を避けるため、以下の prefix を使用する:

- `userscripts:` — 全体共通
- `userscripts:features:<featureName>:` — 機能別
- `userscripts:features:colorCustomizer:page:<host+path>` — ColorEditor のサイト別ルール
- `userscripts:features:dataFiller:page:<host+path>` — DataFiller のページ別定義

---

## 機能

### ColorEditor

ページ上の要素をクリックして色をカスタマイズする機能。ルールはサイト単位で永続化され、再訪時に自動適用される。

- CSS セレクタの自動生成（SelectorEngine）
- カラーピッカー UI（ColorPopover）
- Edit Mode トグルでキャプチャ ON/OFF

### DataFiller

フォーム要素にホバー/クリックで項目名を定義し、CSV テンプレートとしてエクスポートする機能。

- XPath によるフォーム要素の位置特定
- `<label>` / `<span>` / `<div>` からの項目名の自動抽出
- radio/checkbox のグループ検出・選択肢ラベル取得
- 必須/任意フラグ
- 同一ドメイン他ページの定義一覧
- BOM 付き UTF-8 CSV テンプレートのダウンロード

詳細は `docs/dataFiller-spec.md` を参照。

---

## バージョン管理

### バージョニング

セマンティックバージョニング `v1.7.x` で管理する。`script.js` 内の `US_VERSION` が正のバージョン。

### vcp.sh

バージョン bump・commit・push・tag・main マージを自動化するスクリプト。

```bash
./vcp.sh v       # script.js の US_VERSION をインクリメント
./vcp.sh c       # commit（メッセージ省略時はバージョン番号）
./vcp.sh c "msg" # 任意のコミットメッセージで commit
./vcp.sh p       # push → タグ作成・push → main にマージ・push
./vcp.sh all     # v → c → p の順で実行（引数省略時も all）
```

jsDelivr はタグを参照するため、`p` でタグ `vX.Y.Z` を作成して push する。

---

## RPC 仕様

Page World（`script.js`）から Content World（ローダー）へ `window.postMessage` で呼び出す RPC の仕様。

### 用語

- **page**: `<script src="...">` で読み込まれる外部 `script.js` が動く世界
- **content**: UserScript 本体が動く世界（GM_* が利用可能 / isolated）
- **RPC**: `postMessage` による request/reply 形式のメソッド呼び出し

### チャネル

- request フラグ: `__US_RPC__ === true`
- reply フラグ: `__US_RPC_REPLY__ === true`
- 受信側は `event.source === window` を確認（同一ウィンドウ限定）

### メッセージフォーマット

**Request**:
```json
{
  "__US_RPC__": true,
  "id": "<相関ID>",
  "token": "<handshakeで取得したトークン>",
  "method": "<メソッド名>",
  "params": []
}
```

**Reply (成功)**:
```json
{
  "__US_RPC_REPLY__": true,
  "id": "<相関ID>",
  "ok": true,
  "result": {}
}
```

**Reply (エラー)**:
```json
{
  "__US_RPC_REPLY__": true,
  "id": "<相関ID>",
  "ok": false,
  "error": "<エラーメッセージ>"
}
```

### セキュリティ: Handshake Token

1. Content 側は起動時にランダムトークンを生成
2. Page 側は `core.handshake` を呼び出してトークンを取得
3. 以後の全 RPC はトークン必須（不一致/未設定は `ok=false` で拒否）

### メソッド一覧

#### core

| メソッド | params | result |
|----------|--------|--------|
| `core.handshake` | `[]` | `{ token, version, capabilities }` |

`capabilities.gm` には `getValue`, `setValue`, `listValues`, `deleteValue`, `addStyle`, `xmlHttpRequest`, `setClipboard` の各 boolean が含まれる。

#### storage

| メソッド | params | result |
|----------|--------|--------|
| `storage.get` | `[key, defaultValue]` | `any` |
| `storage.set` | `[key, value]` | `true` |
| `storage.delete` | `[key]` | `true` |
| `storage.listKeys` | `[]` | `string[]` |
| `storage.getAllByPrefix` | `[prefix]` | `{ [key]: value }` |
| `storage.setMany` | `[{ key, value }[]]` | `true` |

#### net

| メソッド | params | result |
|----------|--------|--------|
| `net.request` | `[NetRequestOptions]` | `NetResponse` |

**NetRequestOptions**: `{ url, method?, headers?, data?, responseType?, timeoutMs?, withCredentials? }`
**NetResponse**: `{ status, statusText?, finalUrl?, headers?, responseText?, responseJson? }`

#### style

| メソッド | params | result |
|----------|--------|--------|
| `style.add` | `[cssText, meta?]` | `{ styleId }` |
| `style.remove` | `[styleIdOrMetaId]` | `true` |
| `style.clearByPrefix` | `[prefix]` | `number`（削除件数） |

`meta`: `{ id?: string, replace?: boolean }`。`id` 指定時に `replace=true` なら同一 ID の style を置換。

#### clipboard

| メソッド | params | result |
|----------|--------|--------|
| `clipboard.setText` | `[text]` | `true \| false` |

#### log

| メソッド | params | result |
|----------|--------|--------|
| `log` | `[{ level, message, data? }]` | `true` |

`level`: `"debug"` / `"info"` / `"warn"` / `"error"`

### 運用上の前提

- Page 側は GM_* を直接呼ばない（呼べない環境があるため）
- 特権はすべて `storage.*` / `net.*` / `style.*` / `clipboard.*` を経由
- メソッド追加は可能だが、既存メソッドのシグネチャ変更は互換性を壊すため避ける
