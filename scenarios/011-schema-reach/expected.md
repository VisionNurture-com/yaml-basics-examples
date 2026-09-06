# 011-schema-reach — 期待値

lint（**字面**）と JSON Schema（**構造**）の射程を、**同じ 2 題材**で測り分けます。

🔴 **陽性対照を必ず置きます。**「`yamllint` が構造の壊れを 0 件で通す」だけを測ると「lint が動いていない」と読めてしまいます。**別の題材で `yamllint` が実際に鳴ることを先に示して初めて「動いているが対象外」が確定します。**

## 測定環境

| 項目 | 値 |
|---|---|
| yamllint | 1.38.0 |
| check-jsonschema | 0.38.0 |
| 実行 | `bash scenarios/011-schema-reach/run.sh` |
| fixtures | `measure.mjs` が毎回書き出す（手で編集しない）|

> 🔴 **`toolVersions` を突合対象に入れています。**どちらかを上げると必ずここで落ちます。落ちたら測り直してください。

## 期待する観測

| キー | 期待値 | 意味 |
|---|---|---|
| `toolVersions` | `yamllint 1.38.0 / check-jsonschema 0.38.0` | 測った道具の版（`,` は突合の区切りと衝突するため正規化）|
| `caughtCells` | `字面を壊した×yamllint, 構造を壊した×check-jsonschema` | **2 × 2 のうち捕まえた組み合わせ** |
| `missedCells` | `字面を壊した×check-jsonschema, 構造を壊した×yamllint` | 通した組み合わせ |
| `positiveControlsHold` | `true` | 陽性対照が立っている（字面 → lint / 構造 → schema が実際に鳴る）|
| `schemaRcValid` | `0` | 正しい YAML は通る |
| `schemaRcRequired` | `1` | 必須キーの欠落を弾く |
| `schemaRcAdditionalProperties` | `1` | `additionalProperties: false` が綴り間違い（`relicas`）を弾く |
| `schemaRcType` | `1` | 型違い（`replicas: "3"`）を弾く |
| `schemaRcEnum` | `1` | enum 外（`environment: production`）を弾く |
| `schemaRcFormat` | `1` | **`format` は既定で検証される** |
| `schemaRcFormatDisableAll` | `0` | `--disable-formats '*'` で全 format が無効になる |
| `schemaRcFormatDisableEmailOnly` | `0` | `--disable-formats email` で当該形式だけ無効になる |
| `schemaRcFormatDisableBareFlag` | `2` | 🔴 **素のフラグとして書くと使い方の誤り**（後続のファイル名を値として食う）|
| `formatsCheckedByDefault` | `email, date, ipv4, uuid` | **既定で検証される形式（4 つとも実測）** |
| `formatsSilencedIndividually` | `email, date, ipv4, uuid` | 形式ごとに個別無効化できる |

## 読み方

- **2 × 2 の対角線が立ち、重なりは 0 件**です。`yamllint` は字面を、`check-jsonschema` は構造を見ており、**どちらかがもう一方の劣化版ということはありません**
- したがって読者に渡す判断は「**どちらを選ぶか**」ではなく「**両方入れて担当を分ける**」になります
- 🔴 **`--disable-formats` は値を取るオプションです。**素のフラグとして書くと後続のファイル名を値として食い、`Error: Invalid value for '--disable-formats'` で **rc=2** になります。`'*'`（全部）か形式名（`email` 等）を渡します
- 🔴 **4 形式すべてを測っています**（`email` / `date` / `ipv4` / `uuid`）。**測った分だけ記事に書きます**

## 題材

| 題材 | 壊し方 | 構造としては |
|---|---|---|
| `style-broken.yaml` | 行末の空白 + コロン前の空白 | **正しい** |
| `structure-broken.yaml` | 型違い（`replicas: "3"`）+ enum 外（`production`）+ 綴り間違い（`relicas`）+ format 違反 | **壊れている** |
