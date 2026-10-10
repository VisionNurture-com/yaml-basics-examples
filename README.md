# yaml-basics-examples

YAML の検証・切り分け・依存の安全性を、**その場で測って出す**シナリオ集です。

記事を読まなくても、ここだけで動きます。逆に、記事だけ読んでも判断はできるように書いてあります。ここは**自分の環境で測り直したい人**のための場所です。

## 動かす

Node.js 22 以上が要ります。形の検査だけなら、これだけで動きます。

<!-- repro:setup -->
```bash
npm run check:structure
npm run check:provenance
```

`check:provenance` は、各シナリオの `expected.md` に書いた値と `results/summary.json` を突き合わせます。**食い違えば落ちます。**

測り直すときは、シナリオの `run.sh` を実行します。**そのシナリオが使う道具は手元に要ります。**何が要るかは各 `run.sh` の先頭の `# 要るもの:` が正本で、下の表の「要るもの」欄はその要約です。

```bash
npm ci
pip install yamllint==1.38.0
bash scenarios/004-lint-rules/run.sh
npm run check:provenance
```

## シナリオ

| ID | 測ること | 要るもの | mode |
|---|---|---|:---:|
| [`004-lint-rules`](scenarios/004-lint-rules/) | yamllint の **23 ルールを、単独有効 / `extends: default` / そのルールだけ落とす の 3 通りで測る**。**落とすと他のどのルールも肩代わりしない**ことと、**黙らせ方 4 段**（`disable` / `level` / `ignore` / コメント制御）の効き方。**`disable-file` は構文エラーまで黙らせる** | yamllint 1.38.0 | M1 |
| [`005-layer-triage`](scenarios/005-layer-triage/) | **「YAML は通ったのに動かない」を 4 層で切り分ける**。層ごとに欠陥を 1 つ仕込み、字面の道具とツールのスキーマを知る道具のどちらが捕まえるかを測る | yamllint 1.38.0 / actionlint 1.7.12 / `npm ci` | M1 |
| [`007-dependency-audit`](scenarios/007-dependency-audit/) | **依存の奥の非安全な YAML 読み込みを AST で探し、攻撃が本物であることを隔離環境で確かめる**。`safe_load` を自分で使っていても依存が守っているとは限らない（CVE-2026-24009 の構図）| PyYAML 6.0.3 | M1 |
| [`008-loader-surface`](scenarios/008-loader-surface/) | **`FullLoader` が何を許し何を拒むか**を 8 種のタグで面として測る。「安全 / 危険」の二分法では表せない差（`safe_load` と応答が違うのは 8 種中 4 種）| PyYAML 6.0.3 | M1 |
| [`009-scan-reach`](scenarios/009-scan-reach/) | **走査の「0 件」が持つ 2 つの意味**（対象が居ない / 実際に安全）と、**静的走査が届かない 3 つの書き方** | PyYAML 6.0.3 | M1 |
| [`010-jvm-limits`](scenarios/010-jvm-limits/) | **SnakeYAML の「量の制限」の既定**（コレクションの alias 数 50 / code point 数 3 MiB）。PyYAML と js-yaml には対応する既定が無い | JDK 17 以上 / curl | M1 |
| [`011-schema-reach`](scenarios/011-schema-reach/) | **字面（lint）と構造（JSON Schema）の射程を同じ 2 題材で測り分ける**。陽性対照つきの 2 × 2 で重なりが 0 件であること、`format` 4 形式が既定で検証されること、**`--disable-formats` は値を取るオプションであること** | yamllint 1.38.0 / check-jsonschema 0.38.0 | M1 |
| [`012-loader-versions`](scenarios/012-loader-versions/) | **PyYAML の版の区切り（5.1 / 5.4 / 6.0）で、同じ書き方の応答がどう変わるか**。`Loader` を省いた `load()` は 5.3.1 で組み立て・5.4.1 で拒み・6.0.3 で `TypeError`。依存の中のこの書き方は 6.0.3 では**呼んだ時点で**止まる | uv（PyYAML 5.3.1 / 5.4.1 / 6.0.3 を Python 3.9 の一時 venv に入れる） | M1 |
| [`013-tool-reach`](scenarios/013-tool-reach/) | **依存の奥を探す道具 5 つ（`grep` / `scan_deps.py` / Bandit B506 / Ruff S506 / Semgrep）が、同じ題材のどの書き方を拾い、どれを拾わないか**。判定に埋め込まれた PyYAML の版の前提が道具ごとに逆向き | uv / curl（Bandit 1.9.4 / Ruff 0.16.10 / Semgrep 1.179.0） | M1 |
| [`014-safeloader-extend`](scenarios/014-safeloader-extend/) | **独自タグを足すとき、`SafeLoader` を継承するか直接足すかで、素の `yaml.safe_load` まで変わるか** | PyYAML 6.0.3 | M1 |

## mode の意味

| mode | 意味 |
|---|---|
| **M0** | 追加の道具が要らない。clean clone で必ず動く |
| **M1** | 道具を入れて測り直す。CI でも走り、`expected.md` と突き合わせる |
| **M2** | 機械や配布元に依存するため CI では走らせない。コミット済みの `results/` に対して突合する |

## 測った値の扱い

- `expected.md` の「期待する観測」表が**期待値の正本**です
- 🔴 **`toolVersions` を突合対象に入れています。**道具の版を上げると必ず落ちます。落ちたら測り直してください。**版が変われば別の観測**であり、黙って通ってはいけません
- `results/summary.json` は `run.sh` が書き出します。手で編集しないでください

## 検査

| コマンド | 見るもの |
|---|---|
| `npm run check:structure` | シナリオが決まった形か（`run.sh` / `expected.md` / mode / 要るもの / `set -euo pipefail`）|
| `npm run check:provenance` | `expected.md` の値と `results/summary.json` が一致するか |
| `npm run check:neutrality` | 公開に適さない語が混じっていないか |

## ライセンス

MIT。[LICENSE](LICENSE) を参照してください。
