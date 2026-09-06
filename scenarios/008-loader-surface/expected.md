# 008-loader-surface — 期待値

**「`safe_load` は安全 / `load` は危険」の二分法では `FullLoader` の位置が表せません。**同じ 8 種のタグを `safe_load` と `full_load` に通し、応答の違いを面として見ます。

背景は **CVE-2020-14343**（PyYAML < 5.4・`full_load` バイパス RCE）です。5.4 で修正されたあとの `FullLoader` が「何を許し、何を拒むか」は、危険か安全かの 2 択では表せません。

## 何を確かめないか

🔴 **weaponize しません。**確かめるのは「**そのタグ族の構築が許されるか**」であって、任意コード実行の再現ではありません。対象は `list` / `builtins.len` / `collections` など**副作用を持たないもの**だけです。動く gadget は作りません。

## 測定環境

| 項目 | 値 |
|---|---|
| PyYAML | 6.0.3 |
| 対象タグ | 8 種（`python/bytes` / `python/complex` / `python/module` / `python/name` / `python/object` / `python/object/apply` / `python/object/new` / `python/tuple`）|

> 🔴 **`toolVersions` を突合対象に入れています。**PyYAML を上げると必ず落ちます。落ちたら測り直してください。

## 期待する観測

| キー | 期待値 | 意味 |
|---|---|---|
| `toolVersions` | `PyYAML 6.0.3` | 測った道具の版 |
| `tagsProbed` | python/bytes, python/complex, python/module, python/name, python/object, python/object/apply, python/object/new, python/tuple | 通した 8 種 |
| `safeLoadAccepts` | （なし） | **`safe_load` は 8 種すべてを拒む** |
| `fullLoadAccepts` | python/bytes, python/complex, python/name, python/tuple | 🔴 **`full_load` が許す 4 種** |
| `fullLoadRejects` | python/module, python/object, python/object/apply, python/object/new | `full_load` が拒む 4 種 |
| `fullLoadRejectKinds` | ConstructorError | 拒み方は 1 種類（例外の型で判定・文言では判定しない）|
| `fullLoadNameReturnsType` | `builtin_function_or_method` | 🔴 **`!!python/name:` は生きた関数オブジェクトを返す**（呼びはしない）|
| `loaderOmittedResult` | TypeError | `Loader` を省略した `yaml.load()` は読み込みに至らない |
| `unsafeLoadAcceptsObjectNew` | True | 対照 —— 同じ入力を `unsafe_load` に渡すと構築が通る |

## 読み方

- 🔴 **機構は 1 行で言えます —— `FullLoader` は「オブジェクトの構築」を拒み、「名前の解決」は許します。**`python/object` / `python/object/new` / `python/object/apply` / `python/module` は拒まれ、`python/name` / `python/tuple` / `python/complex` / `python/bytes` は通ります
- 🔴 **`safe_load` と `FullLoader` は同じではありません。**同じ入力に対する応答が **8 種中 4 種で違います**。「どちらも安全」とまとめると、この差が消えます
- 🔵 **CVE-2020-14343 の実体である `python/object/new` は、6.0.3 の `full_load` が拒みます。**5.4 の修正が効いていることを、CVE の族そのもので確認できます
- 🔵 **`python/name` が返すのは呼び出し可能なオブジェクトです。**それ自体が実行されるわけではありませんが、`safe_load` が同じ入力を拒むことと合わせて読んでください
