# 005-layer-triage — 期待値

**「YAML は通ったのに動かない」を 4 層で切り分けます。**層ごとに欠陥を 1 つだけ仕込んだファイルを 3 つの道具に通し、**どの層の道具が、どの欠陥を捕まえるか**を測ります。

| 層 | 見るもの | 道具 |
|---|---|---|
| **1 構文** | 字面（インデント・空白・改行）| `yamllint` |
| **2 ツールのスキーマ** | キーの語彙と型 | `actionlint`（Actions）/ `docker compose config -q`（Compose の**公式経路**）/ `dclint`（Compose の**スタイル**）|
| **3 意味は通るが意図と違う** | どのスキーマで読むかで結果が割れる | パーサーのスキーマ切替 |
| **4 ツール側の仕様** | どの道具も通す。動かして初めて分かる | （なし）|

## 測定環境

| 項目 | 値 |
|---|---|
| 道具 | yamllint 1.38.0 / actionlint 1.7.12 / dclint 3.1.0 / js-yaml 5.4.1 / docker compose 5.5.0 |
| 実行 | `npm ci && bash scenarios/005-layer-triage/run.sh` |
| fixtures | **手で書いた教材**。`measure.mjs` は書き換えない |
| 生ログ | `results/raw.md`（道具ごとの rc と指摘 id。**機種固有パスは `<repo>` へ置換済**）|

> 🔴 **`toolVersions` を突合対象に入れています。**どれか 1 つでも版を上げると必ず落ちます。落ちたら測り直してください。
>
> 🔴 **`docker compose` の版だけは突合対象に入れません。**ディストリビューションごとに違い（macOS 5.5.0 / Ubuntu 26.04 2.40.3 / GitHub Actions 2.38.2・いずれも実測）、版が変わっても `composeConfigRcSchemaDefect` / `composeConfigRcStyleOnly` は変わらないためです。007 が Python の patch 版を突合から外しているのと同じ扱いで、値は `composeVersion` に記録します。

## 期待する観測

| キー | 期待値 | 意味 |
|---|---|---|
| `toolVersions` | `yamllint 1.38.0 / actionlint 1.7.12 / dclint 3.1.0 / js-yaml 5.4.1` | 測った道具の版（**`docker compose` は環境で変わるため突合しない**。値は `composeVersion` に記録）|
| `caughtByYamllint` | `layer1-ci.yml, layer3-ci.yml` | 字面の道具が拾ったファイル |
| `caughtByActionlint` | `layer2-ci.yml` | **Actions のスキーマを知る道具だけ**が拾った |
| `caughtByDclint` | `layer2-compose.yaml, layer2-compose-style.yaml` | **スキーマ違反もスタイル違反も**拾う |
| `caughtByComposeConfig` | `layer2-compose.yaml` | **公式経路はスキーマ違反だけ**を拾う |
| `overlapFiles` | `layer2-compose.yaml` | 🔴 **2 つ以上の道具が同じファイルを捕まえた件**。重なるのは Compose 側の 1 件だけ |
| `composeConfigRcSchemaDefect` | `1` | 陽性対照 —— 公式経路は**生きている**（スキーマ違反で非ゼロを返す）|
| `composeConfigRcStyleOnly` | `0` | 🔴 **スタイルだけの入力は通す**。動いていないのではなく**対象外** |
| `composeStyleOnlyDclintIds` | `no-unbound-port-interfaces, require-project-name-field, require-quotes-in-ports, services-alphabetical-order` | 同じ入力で dclint が出した指摘（**射程の差**）|
| `caughtByNothing` | `layer4-ci.yml` | **どの道具も通した**。動かして初めて分かる |
| `layer2ActionlintIds` | `deprecated-commands, expression, runner-label` | 層 2 で actionlint が出した指摘の種類 |
| `layer3CoreKeys` | `name, on, jobs` | 1.2 コアスキーマで読んだトップレベルのキー |
| `layer3Yaml11Keys` | `name, true, jobs` | **1.1 系スキーマで読むと `on` が `true` に化ける** |
| `layer3YamllintIds` | `truthy` | 層 3 で yamllint が出した指摘 |
| `layer3YamllintRc` | `0` | 🔴 **警告は出るが終了コードは 0**。CI は止まらない |

## 読み方

- 🔴 **層 2 の 2 ファイルは `yamllint` が完全にクリーン**です（`caughtByYamllint` に入っていません）。字面は正しいのに、ツールの語彙では壊れています。**これが「構文とスキーマは別の層」の実物**です
- 🔴 **層 3 は `yamllint` の `truthy` が気づかせますが、`layer3YamllintRc` が `0`** です。指摘は出るのに CI は止まりません（`truthy` が既定で警告止まりであることは [004](../004-lint-rules/expected.md) で測っています）
- 🔵 **層 3 は同じファイルを 2 つのスキーマで読み比べて確かめています。**ライブラリを跨がずに `on` が `true` へ化けます。割れるのはライブラリの優劣ではなく、**どのスキーマを選ぶか**です
- 🔴 **重なりは Compose 側の 1 件だけです。**`layer2-compose.yaml`（`ports` を `port`）は **`docker compose config -q` と `dclint` の両方**が捕まえます。一方 Actions 側は重なりが **0** —— `yamllint` は行末空白（層 1）を、`actionlint` はスキーマ（層 2）を見ており、**同じファイルを両方が挙げた件は 1 つもありません**
- 🔵 **公式経路とスタイル lint の差は、スタイルだけの入力で出ます。**`layer2-compose-style.yaml` はスキーマとして妥当なため `docker compose config -q` が **rc=0** で通し、`dclint` は 4 件を挙げます。**片方が黙るのは壊れているからではなく、見ている領域が違うため**です（同じ `config -q` が `layer2-compose.yaml` では rc=1 を返すことが、その陽性対照になります）
- 🔴 **層 4 はどの道具も通します。**`branches: [mian]` は綴りが違うだけで、YAML としても Actions のスキーマとしても正しいためです。**道具を増やしても届かない層がある**ことを、この 1 件が示します
