# 007-dependency-audit — 期待値

**自分が `safe_load` を使っていても、依存の奥が守っているとは限りません。**依存ツリーから「YAML を非安全に読むコードパス」を探し、攻撃が本物であることを隔離環境で確かめます。

背景は **CVE-2026-24009**（`docling-core` が `yaml.FullLoader` で信頼できない YAML を読み RCE・成立前提は `pyyaml < 5.4`）です。読者の問いは「自分の依存に古い `pyyaml` と非安全な読み込みが残っていないか」に移ります。

## 走査の仕組み

`audit/scan_deps.py` は **AST（構文木）で** `yaml.load(..., Loader=FullLoader/UnsafeLoader)` / `yaml.load(...)`（Loader 省略）/ `yaml.unsafe_load(...)` を探します。

> 🔵 **grep ではなく AST です。**grep はコメントや文字列内の `unsafe_load` も拾いますが、AST は**実際の呼び出しだけ**を拾います。`fixtures/sample_deps/safe_lib/loader.py` はコメントに「安全」と書いてありますが、`safe_load` の呼び出ししか無いため**検出されません**。

## 測定環境

| 項目 | 値 |
|---|---|
| PyYAML | 6.0.3 |
| 走査対象 | `fixtures/sample_deps/`（決定論的な教材・3 ファイル）|
| replay | `replay/payload.yaml`（**害のないダミー**・echo でマーカーを 1 つ作るだけ・隔離前提）|

> 🔴 **`toolVersions` を突合対象に入れています。**PyYAML を上げると必ず落ちます。落ちたら測り直してください。

## 期待する観測

| キー | 期待値 | 意味 |
|---|---|---|
| `toolVersions` | `PyYAML 6.0.3` | 測った道具の版（**PyYAML だけを突合する**。Python の patch 版は環境ごとに違い観測を変えないため `pythonVersion` に分けて記録する）|
| `pyyamlBelow54` | `False` | CVE-2026-24009 の成立前提（`pyyaml < 5.4`）を満たすか。**6.0.3 は満たさない** |
| `unsafeCallSites` | `config_lib/reader.py:5 load, legacy_lib/parser.py:5 load, legacy_lib/parser.py:9 unsafe_load` | 非安全な呼び出しの場所（file:line pattern）|
| `filesFlagged` | `config_lib/reader.py, legacy_lib/parser.py` | 非安全な呼び出しを含むファイル |
| `filesClean` | `safe_lib/loader.py` | **`safe_load` だけを使うファイル**（コメントに「安全」とあるが AST は文言を見ない）|
| `replaySafeLoad` | `ConstructorError で拒否` | 危険タグを `safe_load` に渡すと**読み込みエラーで止まる** |
| `replayUnsafeLoad` | `命令が走った` | 同じ入力を `unsafe_load` に渡すと**命令が走る**（隔離環境・害のないダミー）|

## 読み方

- 🔴 **`safe_load` を自分で使っていても、`filesFlagged` の依存が外部入力を読めば危険は残る。**これが CVE-2026-24009 の構図（docling が `FullLoader` を呼んでいた）です
- 🔵 **`pyyamlBelow54` が判定の起点**です。`docling-core` の脆弱性は `pyyaml < 5.4` かつ `FullLoader` の組で成立しました。6.0.3 なら `FullLoader` は危険タグを拒否します（[本文の再現](../../README.md)で確認）
- 🔵 **`filesClean` は「コメントで安全と書いてあるから」ではなく「非安全な呼び出しが AST に無いから」clean です。**言葉ではなくコードで判定します
- 🔴 **`replay` は攻撃が机上の話でないことの実証**です。`safe_load` は `ConstructorError` で止まり、`unsafe_load` は命令を走らせます。**同じ入力で結果が正反対**です

## 🔴 このシナリオが weaponize しないこと

- **CVE-2020-14343 の動く gadget は作りません。**`FullLoader` は `apply:os.system` を **6.0.3 でも 5.3.1 でも拒否**します（実測）。CVE-2020-14343 はより複雑な gadget によるもので、本シナリオはそれを再現しません
- 危険の実証は、**明示的に危険な `unsafe_load`** に害のないダミーを渡すことで行います。これは「YAML が命令になりうる」ことを示すのに十分で、かつ悪用の手順を与えません
