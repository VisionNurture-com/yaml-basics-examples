# 013-tool-reach — 期待値

**依存の奥の非安全な YAML 読み込みを探す道具は、どれも「どの書き方を危ないと見なすか」を自分で決めています。**その決め方には PyYAML の版の前提が埋め込まれていて、向きが道具ごとに違います。同じ題材 3 つに 5 つの道具を当て、拾う書き方と拾わない書き方を並べます。

| 道具 | 判定の向き（ソース・ルールで確認・2026-10-07） |
|---|---|
| `grep`（2026-10-08 追加） | 文字列 `yaml.load(` / `full_load(` / `FullLoader` を探す。探す語は、NVD の CVE-2020-14343 の説明が名指しする `full_load` / `FullLoader` に `yaml.load(` を加えた 3 つ。**`unsafe_load` は探す語に入っていない**。コメントも、別のライブラリの同じ名前も拾う |
| [`scan_deps.py`](../007-dependency-audit/audit/scan_deps.py)（007） | 危ない Loader・関数の**名前**で探す（拒否リスト） |
| Bandit B506 | 関数名が `load` で、`Loader` が `SafeLoader` / `CSafeLoader` でないもの（許可リスト）。`unsafe_load` / `full_load` は判定に入らない |
| Ruff S506 | `yaml.load` の呼び出し（Bandit と同じ規則） |
| Semgrep `avoid-pyyaml-load` | **PyYAML 5.4 以降を前提に**、`unsafe_load` と `Loader=yaml.Loader / UnsafeLoader / CLoader` だけ |

## 題材

| 題材 | 中身 |
|---|---|
| `sampleDeps` = [`007-dependency-audit/fixtures/sample_deps`](../007-dependency-audit/fixtures/sample_deps/) | `config_lib/reader.py:5` = Loader なしの `load()` / `legacy_lib/parser.py:5` = `Loader=yaml.FullLoader` / `legacy_lib/parser.py:9` = `unsafe_load` / `safe_lib/loader.py` = `safe_load` だけ |
| `indirect` = [`009-scan-reach/fixtures/indirect`](../009-scan-reach/fixtures/indirect/) | `indirect.py:11` = `functools.partial(yaml.load, Loader=yaml.FullLoader)` / `:18` = `Loader` を変数で渡す / `:26` = `unsafe_load` を別名で import して呼ぶ |
| `grepFp` = [`fixtures/grep_fp`](fixtures/grep_fp/)（2026-10-08 追加） | **文字列では危なく見えるが危なくない** 2 つ。`safe_loader.py:6` = `yaml.load(s, Loader=yaml.SafeLoader)` / `ruamel_var.py:7` = ruamel.yaml の `YAML(typ="safe")` を `yaml` という変数に入れて `yaml.load(s)` |

## 測定環境

| 項目 | 値 |
|---|---|
| Bandit | 1.9.4（`-t B506`） |
| Ruff | 0.16.10（`--select S506 --isolated`） |
| Semgrep | 1.179.0（ルールは `semgrep/semgrep-rules` の SHA `46a0ecfd` から実行時に取得・`--metrics off`） |
| 入れ方 | 使い捨ての venv（Python 3.13）に `uv pip install` |

> 🔴 **`toolVersions` を突合対象に入れています。**道具の版を変えると落ちます。とくに Ruff は週次で版が進みます。Bandit には `unsafe_load` / `full_load` も拾う拡張の提案（PR #1300）が開いていて、取り込まれれば結果が変わります。

## 期待する観測

| キー | 期待値 | 意味 |
|---|---|---|
| `toolVersions` | `bandit 1.9.4 / ruff 0.16.10 / semgrep 1.179.0` | 測った道具の版 |
| `sampleDeps.grep` | config_lib/reader.py:5, legacy_lib/parser.py:4, legacy_lib/parser.py:5 | :4 は**コメント**の `FullLoader`。🔴 **`unsafe_load`（:9）を拾わない**（探す語に無い） |
| `sampleDeps.scanDeps` | config_lib/reader.py:5, legacy_lib/parser.py:5, legacy_lib/parser.py:9 | 名前で探すので 3 つとも拾う |
| `sampleDeps.bandit` | config_lib/reader.py:5, legacy_lib/parser.py:5 | 🔴 **`unsafe_load`（:9）を拾わない** |
| `sampleDeps.ruff` | config_lib/reader.py:5, legacy_lib/parser.py:5 | Bandit と同じ |
| `sampleDeps.semgrep` | legacy_lib/parser.py:9 | 🔴 **`FullLoader`（:5）と Loader なしの `load()`（reader.py:5）を拾わない**（5.4 以降を前提にしているため） |
| `indirect.grep` | indirect.py:11, indirect.py:18 | 文字列なので `partial` の中も変数で渡す形も拾う。別名の `_u(s)`（:26）は拾わない |
| `indirect.scanDeps` | （なし） | 3 つとも名前の形が崩れていて見えない |
| `indirect.bandit` | indirect.py:18 | `Loader` が `SafeLoader` でないので、変数でも拾う |
| `indirect.ruff` | indirect.py:18 | Bandit と同じ |
| `indirect.semgrep` | indirect.py:26 | 別名の import を解決して `unsafe_load` を拾う |
| `grepFp.grep` | ruamel_var.py:7, safe_loader.py:6 | 🔴 **2 つとも偽陽性**（危なくないのに拾う） |
| `grepFp.scanDeps` | ruamel_var.py:7 | 🔴 名前で探すので、別のライブラリの `yaml` という変数を拾う（偽陽性） |
| `grepFp.bandit` | （なし） | `SafeLoader` は許可リストに入っている。ruamel の変数は `yaml` モジュールではないので見ない |
| `grepFp.ruff` | （なし） | Bandit と同じ |
| `grepFp.semgrep` | （なし） | どちらもルールのパターンに当たらない |

## 読み方

- 🔴 **`grep` は見逃しが少ないかわりに、拾ったものの多くが危なくありません。**この 3 つの題材の危ない 6 か所に対して 4 か所を拾い（`unsafe_load` の 2 か所は探す語に無い）、同時にコメント 1 行と危なくない書き方 2 つも拾います。件数ではなく、1 行ずつ開いて読む前提の道具です
- 🔴 **4 つの道具の結果は、どれも「0 件なら安全」と読めません。**拾う書き方の組み合わせが道具ごとに違い、`functools.partial` で渡す形（`indirect.py:11`）は 4 つとも拾いません
- 🔴 **CVE-2026-24009 の形（依存が `FullLoader` を呼び、手元の PyYAML が 5.4 より前）は、Semgrep の既定ルールでは拾えません。**ルールが 5.4 以降を前提にしているためで、ルールの欠陥ではなく前提の違いです。**自分の環境の PyYAML の版を先に確かめてから、道具の結果を読みます**（版ごとの挙動は [`012-loader-versions`](../012-loader-versions/)）
- 🔵 逆に、`unsafe_load` の直接呼び出しは Bandit と Ruff が拾いません。この 2 つの題材の 6 か所に対して、Bandit（または Ruff）と Semgrep を併用すると 5 か所、Bandit（または Ruff）と `scan_deps.py` を併用すると 4 か所を拾います（`scan_deps.py` は別名の `indirect.py:26` を拾わない）
