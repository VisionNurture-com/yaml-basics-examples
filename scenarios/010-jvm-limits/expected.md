# 010-jvm-limits — 期待値

**コード実行を止めることと、量を止めることは別の層です。**PyYAML と js-yaml は alias の展開に既定の上限を持ちません。**SnakeYAML だけが既定で 2 つの上限を持ちます** —— コレクションの alias 数と、入力の code point 数です。

ここでは 60 連の alias を 1 段だけ置いた入力で、既定と明示設定の応答を測ります。

## 何を確かめないか

🔴 **爆発はさせません。**入力は `&x [1, 2, 3]` を 1 つ置き、それを 60 回参照するだけの 62 行です。指数展開（アンカー爆弾）は起こしません。確かめるのは**上限が既定でどこにあるか**です。

## 測定環境

| 項目 | 値 |
|---|---|
| SnakeYAML | 2.7（Maven Central から版を固定して取得）|
| JDK | 17 以上（単一ファイル実行）|

> 🔴 **版の根拠を 2 つ持っています。**`Yaml.class.getPackage().getImplementationVersion()` は **`null` を返します**（マニフェストに `Implementation-Version` が無い）。そのため **jar の sha1 を Maven Central の `.sha1` と照合**し、あわせてマニフェストの `Bundle-Version` を読んでいます。
> 🔴 **`toolVersions` を突合対象に入れています。**SnakeYAML を上げると必ず落ちます。落ちたら測り直してください。

## 期待する観測

| キー | 期待値 | 意味 |
|---|---|---|
| `toolVersions` | `SnakeYAML 2.7` | 測った道具の版（マニフェストの `Bundle-Version` 由来）|
| `jarSha1` | 47713fda569f07641538ff7f2fa9cb3ead4603e5 | Maven Central の `.sha1` と一致した値 |
| `bundleVersion` | 2.7.0 | マニフェストの表記（Maven 座標の `2.7` と同じもの）|
| `implementationVersionFromApi` | null | 🔴 **実行時 API からは版が取れない** |
| `defaultMaxAliasesForCollections` | 50 | コレクションの alias 数の既定上限 |
| `defaultCodePointLimit` | 3145728 | 🔴 **入力の code point 数の既定上限（3 MiB）** |
| `aliases60Default` | YAMLException | 既定の `new Yaml()` は 60 連を止める |
| `aliases60Max100` | LinkedHashMap | 上限を 100 へ上げると読み込める |
| `aliases60Max10` | YAMLException | 上限を 10 へ下げると 10 で止まる |
| `globalTagDefault` | ComposerException | `!!java.io.File` は既定で拒まれる |

## 読み方

- 🔴 **上限は「ある / ない」ではなく「いくつか」で効きます。**同じ入力が `max=50`（既定）で止まり、`max=100` で通り、`max=10` で止まります。**止まったこと自体は安全の証明になりません** —— 上限を上げれば通ります
- 🔴 **PyYAML と js-yaml には対応する既定がありません。**同じ 60 連を渡すと展開されます。**言語を変えると、三層目（量の制限）の既定が変わります**
- 🔵 **`codePointLimit` は入力の大きさそのものの上限**です。alias の数とは別の軸で、2 つ合わせて量を絞っています
- 🔵 **グローバルタグは既定で拒まれます**（`ComposerException`）。これは一層目（安全な読み込み）の話で、量の制限とは別です。**同じライブラリの中でも層が分かれています**
- 🔴 **判定は例外クラス名と型名で行っています。**文言は実装が差し替えることがあるため、突合の対象にしていません
