# 012-loader-versions — 期待値

**同じ書き方でも、PyYAML の版によって応答が変わります。**`Loader` を省いた `load()`・`full_load`・`safe_load`・`unsafe_load` を、版の区切り（5.1 / 5.4 / 6.0）をまたぐ 3 つの版で同じ入力に通し、応答を並べます。

あわせて、`Loader` を渡さずに `load()` を呼ぶ依存（[`007-dependency-audit`](../007-dependency-audit/) の題材 `config_lib/reader.py`）が、版によってどう止まるかを見ます。

## 何を確かめないか

🔴 **weaponize しません。**入力は `!!python/name:builtins.len` と `!!python/object/new:list [[1, 2]]` の 2 つだけで、副作用を持ちません。確かめるのは「**組み立てられるか / 止まるか / 警告が出るか**」です。

## 測定環境

| 項目 | 値 |
|---|---|
| PyYAML | 5.3.1 / 5.4.1 / 6.0.3（版ごとに使い捨ての venv） |
| Python | 3.9（3 つの版を同じ Python で測る） |
| 入れ方 | `uv venv` + `uv pip install --build-constraint build-constraints.txt`（arm64 の macOS では 5.x を sdist から作るため `Cython<3` に抑える） |

> 🔴 **`toolVersions` を突合対象に入れています。**版を変えると落ちます。

## 期待する観測

| キー | 期待値 | 意味 |
|---|---|---|
| `toolVersions` | `PyYAML 5.3.1 / 5.4.1 / 6.0.3` | 測った 3 つの版 |
| `v5_3_1.loadWithoutLoader.name` | builtin_function_or_method | 5.3.1: `Loader` を省くと `FullLoader` で読み、名前を解決する |
| `v5_3_1.loadWithoutLoader.name.warnings` | YAMLLoadWarning | 5.1 から、省くと警告が出る（止まりはしない） |
| `v5_3_1.loadWithoutLoader.objectNew` | list | 🔴 **5.3.1: 省いた `load()` が `!!python/object/new` を組み立てる**（CVE-2020-14343 の族） |
| `v5_3_1.fullLoad.objectNew` | list | 5.3.1: `full_load` も組み立てる |
| `v5_3_1.safeLoad.objectNew` | ConstructorError | `safe_load` はこの版でも拒む |
| `v5_3_1.dependency.import` | ok | 依存は import できる |
| `v5_3_1.dependency.call` | dict | 依存を呼ぶと読めてしまう |
| `v5_3_1.dependency.call.warnings` | YAMLLoadWarning | 呼んだときに警告が出るだけ |
| `v5_4_1.loadWithoutLoader.name` | builtin_function_or_method | 5.4.1: 名前の解決はまだ通る |
| `v5_4_1.loadWithoutLoader.name.warnings` | YAMLLoadWarning | 警告は 5.4.1 でも出る |
| `v5_4_1.loadWithoutLoader.objectNew` | ConstructorError | 🔴 **5.4.1: 同じ入力を拒む**（`FullLoader` の修正が入った版） |
| `v5_4_1.fullLoad.objectNew` | ConstructorError | `full_load` も拒む |
| `v5_4_1.unsafeLoad.objectNew` | list | 対照 —— `unsafe_load` は組み立てる |
| `v5_4_1.dependency.call` | dict | 依存を呼ぶと、警告つきで読める |
| `v5_4_1.dependency.call.warnings` | YAMLLoadWarning | 止まらない |
| `v6_0_3.loadWithoutLoader.name` | TypeError | 🔴 **6.0.3: `Loader` を省いた `load()` は読み込みに至らない** |
| `v6_0_3.loadWithoutLoader.objectNew` | TypeError | 入力によらず止まる |
| `v6_0_3.fullLoad.name` | builtin_function_or_method | `full_load` は名前の解決を許す（[`008-loader-surface`](../008-loader-surface/) と同じ） |
| `v6_0_3.fullLoad.objectNew` | ConstructorError | `full_load` は構築を拒む |
| `v6_0_3.unsafeLoad.objectNew` | list | 対照 —— `unsafe_load` は組み立てる |
| `v6_0_3.dependency.import` | ok | 🔴 **依存の import は通る** |
| `v6_0_3.dependency.call` | TypeError | 🔴 **呼んだときに初めて止まる** |
| `v6_0_3.dependency.call.warnings` | （なし） | 6.0.3 では警告ではなく例外になる |

## 読み方

- 🔴 **`Loader` を省いた `load()` は、版で 3 通りに分かれます。**5.3.1 は警告を出して組み立て、5.4.1 は警告を出して `!!python/object/new` を拒み、6.0.3 は `TypeError` で止まります
- 🔴 **依存の中に `Loader` を省いた `load()` が残っていると、6.0.3 では import ではなく呼び出しの時点で止まります。**その書き方は、6.0 より前の挙動（警告を出して動く）のまま書き換えられていないということです。読者の手元で `TypeError` が出たときは、**自分のコードではなく、依存の中のこの書き方**を疑う手がかりになります
- 🔵 `safe_load` は 3 つの版すべてで同じ応答です
- 🔵 版ごとの安全性の行列は、Semgrep のブログ（2022-10-06「Fully loaded: testing vulnerable PyYAML versions」）が tox で測って公開しています。本シナリオは、それに「**止まり方**（警告 / 例外）」と「**依存の中で止まる時点**」を足したものです
