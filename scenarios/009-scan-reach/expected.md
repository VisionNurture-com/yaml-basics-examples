# 009-scan-reach — 期待値

**走査の「0 件」は、2 つの違う状態を同じ顔で返します。**

- (a) **YAML を読むコードが 1 つも無い**（対象が居ない）
- (b) **YAML を読んでいるが、すべて安全な書き方だった**

検出件数だけを見ると (a) と (b) は区別できません。対照として「**`yaml` を import しているファイル数**」を並べれば区別できます。あわせて、静的走査が構造上届かない 3 つの書き方を測ります。

> 走査の実装は 007 の `audit/scan_deps.py` を import して使います（別実装にしません）。

## 測定環境

| 項目 | 値 |
|---|---|
| PyYAML | 6.0.3 |
| 走査対象 | `fixtures/` の 3 つの木（決定論的な教材・計 7 ファイル）|

> 🔴 **`toolVersions` を突合対象に入れています。**PyYAML を上げると必ず落ちます。落ちたら測り直してください。

## 期待する観測

| キー | 期待値 | 意味 |
|---|---|---|
| `toolVersions` | `PyYAML 6.0.3` | 測った道具の版 |
| `noConsumerFiles` | 3 | (a) の木のファイル数 |
| `noConsumerYamlImporters` | 0 | 🔴 **(a) は `yaml` を import するファイルが 0** |
| `noConsumerHits` | （なし） | (a) の検出は 0 件 |
| `safeConsumerFiles` | 3 | (b) の木のファイル数 |
| `safeConsumerYamlImporters` | 3 | 🔴 **(b) は 3 ファイルとも `yaml` を import している** |
| `safeConsumerHits` | （なし） | (b) の検出も 0 件 |
| `indirectFiles` | 1 | 間接化した 3 形を書いたファイル数 |
| `indirectYamlImporters` | 1 | `yaml` は import している |
| `indirectHits` | （なし） | 🔴 **危ない側に倒れうる 3 形が 1 件も検出されない** |
| `indirectFormsMissed` | functools.partial, variable-Loader, aliased-import | 届かない 3 形の名前 |

## 読み方

- 🔴 **`noConsumerHits` と `safeConsumerHits` はどちらも 0 件ですが、意味が違います。**前者は「測っていない」に近く、後者は「実際に安全」です。**`yamlImporters` を並べて初めて読めます**
- 🔴 **`indirectHits` が 0 件なのは走査の欠陥ではなく射程です。**動的に決まる呼び出しは、実行するまで確定しません
  - `functools.partial(yaml.load, ...)` —— `yaml.load` が**呼び出しではなく引数**として現れる
  - `L = yaml.UnsafeLoader` → `yaml.load(s, Loader=L)` —— 走査は `Loader=` に**書かれた名前**を見る。変数名 `L` は `UnsafeLoader` で終わらない
  - `from yaml import unsafe_load as _u` → `_u(s)` —— `yaml.` 始まりの属性呼び出しにならない
- 🔵 **`fixtures/tree_safe_consumer/loader_partial.py` は実在の書き方です。**`functools.partial(yaml.load, Loader=SafeLoader)` は `grep yaml.load` に引っかかりますが、渡している Loader は安全です。**grep で探すと、この種の安全な実装が偽陽性として大量に出ます**
- 🔴 **したがって「走査して 0 件だった」は「安全だ」を意味しません。**言えるのは「**この走査の射程の中では見つからなかった**」までです
