# 014-safeloader-extend — 期待値

**`safe_load` で読めない独自タグ（例: `!port 8080`）を足したいとき、足し方によって、ほかの場所の `yaml.safe_load` の応答まで変わります。**`SafeLoader` を継承したクラスに足す場合と、`SafeLoader` そのものに足す場合を、別々のプロセスで比べます。

## 測定環境

| 項目 | 値 |
|---|---|
| PyYAML | 6.0.3 |
| 入力 | `port: !port 8080`（`!port` を整数として組み立てるコンストラクタを足す） |

> 🔴 **`toolVersions` を突合対象に入れています。**PyYAML を上げると落ちます。

## 期待する観測

| キー | 期待値 | 意味 |
|---|---|---|
| `toolVersions` | `PyYAML 6.0.3` | 測った道具の版 |
| `inherit.safeLoadBefore` | ConstructorError | 足す前の `safe_load` は `!port` を知らない |
| `inherit.extendedLoader` | int | 継承したクラスで読むと整数になる |
| `inherit.safeLoadAfter` | ConstructorError | 🔴 **素の `yaml.safe_load` は変わらない** |
| `direct.safeLoadBefore` | ConstructorError | 足す前は同じ |
| `direct.extendedLoader` | int | `SafeLoader` で読むと整数になる |
| `direct.safeLoadAfter` | int | 🔴 **素の `yaml.safe_load` まで `!port` を受け入れるようになる** |

## 読み方

- 🔴 **`yaml.SafeLoader.add_constructor(...)` は、同じプロセスの中のすべての `safe_load` を書き換えます。**自分のコードのためだけに足したつもりでも、同じプロセスで動く依存ライブラリの `safe_load` にも効きます
- 🔵 **継承したクラスに足せば、素の `safe_load` は変わりません。**独自タグが要るときは `class MyLoader(yaml.SafeLoader): pass` を作ってそこへ足し、`yaml.load(text, Loader=MyLoader)` で読みます
- 🔵 この扱いは PyYAML の Issue #221（隔離した SafeLoader を作る簡単な方法が無い）でも議論されています
