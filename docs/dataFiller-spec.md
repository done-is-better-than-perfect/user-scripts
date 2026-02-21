# dataFiller 仕様書

フォーム要素にホバー／クリックで「項目名」を定義し、同一ページまたは同一ドメイン他ページの定義を一覧・管理する機能。CSV テンプレートのエクスポートに対応する。

---

## 1. ストレージ

- **キー**: `userscripts:features:dataFiller:page:` + `encodeURIComponent(hostname + pathname)`
  - 例: `userscripts:features:dataFiller:page:example.com%2Fform`
- **値**: `{ steps: Step[] }`
- **取得**: `storage.get(key, null)` で現在ページの定義を取得
- **保存**: `storage.set(key, { steps })` で上書き保存
- **他ページ一覧**: `storage.getAllByPrefix('userscripts:features:dataFiller:page:')` で同一ドメインの他ページ定義を取得（「その他」タブ用）

---

## 2. Step（1件の定義）のデータ構造

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `xpath` | string | ✓ | フォーム要素の XPath |
| `type` | string | ✓ | `'text'` / `'radio'` / `'checkbox'` / `'select'` / `'textarea'` 等 |
| `logicalName` | string | ✓ | 項目名（CSV ヘッダ・一覧表示に使用） |
| `required` | boolean | - | `true` = 必須、`false` = 任意。未指定時は表示上「必須」扱い |
| `options` | string[] | - | radio/checkbox のみ。同一 name の選択肢ラベル文字列の配列（例: `['なし', 'あり']`） |

---

## 3. UI 構成

### 3.1 一覧画面（設定パネル内）

- **場所**: 設定パネル → 「data Filler」行をクリックで表示
- **タブ**
  - **このページ**: 現在の URL に紐づく定義のみ表示。行クリックで XPath をクリップボードにコピー。削除ボタンで削除可。
  - **その他**: 同一ドメインの他ページの定義をキーごとにグループ表示（削除は不可）
- **各行の表示**: タイプ | 重複バッジ（同一 XPath が複数ある場合） | 項目名 | **必須/任意** | XPath（短縮） | 削除ボタン（このページのみ）
- **空時**: 「dataFillerをONにしてフォーム要素をクリックすると追加されます」または「同じドメインの他ページの定義はありません」
- **ソート**: XPath 階層でソート（同一 XPath は隣に並び重複が分かりやすい）

### 3.2 ホバーポップオーバー（キャプチャ ON 時）

- **表示条件**: `input` / `select` / `textarea` にホバーしたとき、要素直下に表示
- **内容**
  - 項目名入力（テキスト）
  - 候補ドロップダウン（▼）：候補から選択可能
  - **必須 / 任意** のラジオ（デフォルトは「必須」）
  - 既に同一 XPath で登録済みの場合は「すでに登録済みです」表示、入力は読み取り専用
  - **追加** / **キャンセル** ボタン
- **追加**: 項目名＋必須/任意を step として保存。同一 XPath が既にある場合は上書き確認ダイアログ

### 3.3 クリック追加（キャプチャ ON 時）

- フォーム要素をクリック → 項目名プロンプト（モーダル）を表示
- 初期値: `getLabelNearElement(el)` または type のフォールバック（例: テキストなら「テキスト」）
- OK で step を追加（この経路では `required` は未設定＝表示上は「必須」）
- radio/checkbox の場合は `getRadioCheckboxOptions(el)` で `options` を付与

### 3.4 その他 UI

- **メイントグル**: dataFiller 画面内の ON/OFF。ON でホバー／クリックによるキャプチャが有効
- **CSVテンプレートをダウンロード**: 現在ページの step の `logicalName` をヘッダにした 1 行の CSV（BOM 付き）をダウンロード

---

## 4. 項目名（プレフィル・候補）の取得ルール

### 4.1 プレフィルに使うもの（項目名の初期値）

- **取得元は `<label>` の textContent を優先**。`<label>` が見つからなかった場合は、同じ走査パターンで近傍の `<span>` テキスト（直接の子テキストノードのみ）をフォールバックとして使用する。
- **`<label>` の採用条件**
  - 次のいずれかに該当する label は**採用しない**:
    - 対象フォーム要素を**子に含む** label（`label.contains(el)`）
    - **input type=radio / checkbox の場合の追加除外**:
      - その input を**包んでいる** label（`el.parentElement === label` または label が el を含む）
      - `for` 属性がある label（for 一致の「選択肢ラベル」は使わない）
      - 子に `input` / `select` / `textarea` を持つ label（選択肢ごとのラベル）
  - 上記以外の label は採用（例: グループ見出しの「掲載終了日時」など）。
- **id がある場合（radio/checkbox 以外）**: `document.querySelector('label[for="id"]')` で一致する label があれば、その textContent を最優先で使用。
- **走査**: 対象要素から最大 10 世代親へ遡り、各階層で label → span の順にチェック。最も近い階層で見つかったテキストを返す（近い span は遠い label に優先する）。
- **radio/checkbox**: 上記の除外を適用したうえで、**グループ見出し**のような「それ以外の label」だけをプレフィルに使用。選択肢の「なし」「あり」などの label は使わない。
- **`<span>` チェック**: 各階層で label が見つからなかった場合、同じ階層の前後の兄弟とその子孫から `<span>` の `getDirectText` を検索する。`<select>` 内の span は除外。

### 4.2 候補に使うもの（ドロップダウンで選べるテキスト）

- **常に含める**: `<span>` と `<div>` から取得したテキスト
  - span/div は**直接の子テキストノードのみ**（`getDirectText`）。select 内（option）は対象外。
  - 遡りで見つかった **div の子孫**の span（および後述の条件で label）も候補に追加する。
- **label を候補に含める条件**
  - **プレフィルが取得できなかったときだけ** label も候補に含める（`includeLabelInCandidates === true`）。
  - **radio/checkbox のとき**は常に label を候補に含める（グループ見出しを候補で選べるようにする）。
- **label を候補から除外する条件**
  - `for` 属性があり、その値が**ホバーしたフォームの id と一致しない**場合は候補に含めない。
  - radio/checkbox のときは、次の label は候補に含めない:
    - その input を子に含む label
    - その input の親である label
    - `for` がその input の id と一致する label
    - 子に input/select/textarea を持つ label（選択肢ラベル）

### 4.3 ホバー時のプレフィル・候補の決定フロー

1. `labelPrefill = getLabelNearElement(el)` でプレフィル用テキストを取得（label 優先、なければ span フォールバック）。
2. **radio/checkbox**: `suggested = labelPrefill || (type のフォールバック)`。`suggestedFromLabel`（label クリックで得たテキスト）は使わない。
3. **それ以外**: `suggested = suggestedFromLabel || labelPrefill || (type のフォールバック)`。
4. `includeLabelInCandidates`: radio/checkbox のときは常に `true`。それ以外は `!labelPrefill && suggestedFromLabel === ''` のときのみ `true`。
5. `getTextCandidatesFromForm(el, includeLabelInCandidates)` で候補配列を取得し、ドロップダウンに表示。

---

## 5. radio / checkbox の「取り得る値」（options）

- **対象**: `input type="radio"` または `input type="checkbox"` で、`name` が存在するもの。
- **取得**: 同一 `name` の全 input について、次の優先順で「選択肢の表示テキスト」を取得し、重複を除いて配列化する。
  1. `label[for="当該inputのid"]` の textContent
  2. 親が `<label>` の場合、その label から input を除いた textContent
  3. 上記が無い場合は `input.value`
- **保存**: step 追加時（ホバー「追加」またはクリックプロンプト OK）に `getRadioCheckboxOptions(el)` を実行し、1 件以上あれば `step.options` に格納。

---

## 6. 要素タイプ（type）

- `getElementType(el)` で判定: `text` / `radio` / `checkbox` / `select` / `textarea` / `file` / `button` 等。
- `button` および `unknown` はキャプチャ対象外（ホバーしてもポップオーバーを出さない）。

---

## 7. CSV エクスポート

- 現在ページの `steps` の `logicalName` をカラムにした 1 行の CSV。
- ダブルクォートは `""` にエスケープ。
- BOM 付き UTF-8。ファイル名例: `dataFiller_template_2026-02-21.csv`。

---

## 8. 用語・補足

- **項目名**: step の `logicalName`。ユーザーが編集可能で、CSV ヘッダや一覧の「項目名」列に使う。
- **プレフィル**: ホバー時やプロンプト表示時の項目名入力欄の初期値。label を優先し、見つからなければ span をフォールバックとして使用。
- **候補**: ホバー時のドロップダウンに表示する選択肢。span / div を常に含め、条件を満たすとき label も含める。
- **必須/任意**: step の `required`。ホバー時のみラジオで指定可能。未指定は「必須」表示。
