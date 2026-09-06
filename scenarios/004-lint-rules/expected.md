# 004-lint-rules — 期待値

yamllint の各ルールが「**どの事故を防ぐか**」を、ルールごとに違反する YAML を当てて対応づけます。

測り方はルールごとに 2 通りです。

| 走らせ方 | 設定 | 何が分かるか |
|---|---|---|
| **A** | そのルールだけを有効化 | 用意した YAML が本当にそのルールに触れるか（材料の健全性）|
| **B** | `extends: default` | **既定でそのルールが有効か・どの level で出るか** |

**A と B の差が「既定は何を見逃すか」**で、`.yamllint` を設計するときに要る材料そのものです。

## 測定環境

| 項目 | 値 |
|---|---|
| yamllint | 1.38.0 |
| 実行 | `bash scenarios/004-lint-rules/run.sh` |
| fixtures | `measure.mjs` が毎回書き出す（手で編集しない）|

> 🔴 **`toolVersions` を突合対象に入れています。**yamllint を上げると必ずここで落ちます。落ちたら測り直してください。**版が変われば別の観測**であり、黙って通ってはいけません。

## 期待する観測

| キー | 期待値 | 意味 |
|---|---|---|
| `toolVersions` | `yamllint 1.38.0` | 測った道具の版 |
| `rulesTotal` | `23` | yamllint 1.38.0 が持つルールの総数 |
| `singleRuleUndetected` | （なし） | **A で違反しなかった fixture**。1 件でもあれば材料が壊れている |
| `defaultMissed` | `document-end, empty-values, float-values, key-ordering, octal-values, quoted-strings` | **`extends: default` が見逃す 6 ルール**（既定で無効）|
| `defaultWarningRules` | `comments, comments-indentation, document-start, truthy` | **既定が警告止まりの 4 ルール**（`yamllint` の終了コードは 0 のまま）|
| `defaultErrorRules` | `anchors, braces, brackets, colons, commas, empty-lines, hyphens, indentation, key-duplicates, line-length, new-line-at-end-of-file, new-lines, trailing-spaces` | 既定でエラーになる 13 ルール |
| `droppedFullySilent` | `anchors, braces, brackets, colons, commas, comments, comments-indentation, document-end, document-start, empty-lines, empty-values, float-values, hyphens, indentation, key-duplicates, key-ordering, line-length, new-line-at-end-of-file, new-lines, octal-values, quoted-strings, trailing-spaces, truthy` | **C 条件**: そのルールを既定から落とすと、その材料で**何も鳴らなくなる**ルール（= 別のルールが肩代わりしない）|
| `droppedStillCaught` | （なし） | 落としても別のルールが鳴るルール |
| `leverIgnoreTargetSilenced` | `true` | `ignore` に載せたファイルでは、そのルールが黙る |
| `leverIgnoreOtherStillCaught` | `true` | **載せていないファイルでは同じ違反がまだ鳴る**（`ignore` はファイル単位）|
| `leverCommentBlockInsideSilenced` | `true` | `# yamllint disable rule:` 〜 `enable` の内側が黙る |
| `leverCommentBlockOutsideStillCaught` | `true` | `enable` の外側は鳴る |
| `leverCommentLineSilenced` | `true` | `# yamllint disable-line rule:` はその行だけ黙らせる |
| `leverCommentLineNextStillCaught` | `true` | 次の行は鳴る |
| `leverCommentFileAllSilenced` | `true` | `# yamllint disable-file` はファイル全体を黙らせる |
| `leverCommentFileExitCode` | `0` | そのとき終了コードは 0（CI が止まらない）|
| `leverCommentFileSilencesSyntaxError` | `true` | 🔴 **`disable-file` は構文エラーまで黙らせる** |
| `leverCommentSyntaxCaughtWithoutComment` | `true` | 陽性対照: コメントが無ければ同じ材料で `syntax` が鳴る |
| `truthyOnActionsDetected` | `true` | GitHub Actions の `on:` を `truthy` が拾う |
| `truthyOnActionsLevel` | `warning` | ただし level は警告 |
| `truthyOnActionsExitCodeDefault` | `0` | 🔴 **既定のままなら終了コード 0 —— CI は止まらない** |
| `truthyOnActionsExitCodeAsError` | `1` | `level: error` にすると 1 になる |
| `truthyOnActionsExitCodeStrict` | `2` | 🔴 **`-s`（`--strict`）を付けると、警告しか出ていなくても終了コードが `2` になる**。`level: error` の `1` とも別の値 |
| `truthyDefaultKeyOnCaught` | `true` | 陽性対照: 既定ではキーの `on:` が鳴る |
| `truthyDefaultKeyYesCaught` | `true` | 陽性対照: 既定ではキーの `yes:` も鳴る |
| `truthyDefaultValueCaught` | `true` | 陽性対照: 既定では値の `DEBUG: yes` も鳴る |
| `truthyAllowedValuesOnSilenced` | `true` | `allowed-values` に `on` を足すと `on` は黙る |
| `truthyAllowedValuesKeyYesStillCaught` | `true` | 🔴 **ただしキーの `yes:` は鳴ったまま**（許すのは `on` という語だけ）|
| `truthyAllowedValuesValueStillCaught` | `true` | 値の `DEBUG: yes` も鳴ったまま |
| `truthyCheckKeysOffOnSilenced` | `true` | `check-keys: false` でも `on:` は黙る |
| `truthyCheckKeysOffKeyYesSilenced` | `true` | 🔴 **こちらはキーの `yes:` まで黙る**（= 開く範囲が広い）|
| `truthyCheckKeysOffValueStillCaught` | `true` | 値の `DEBUG: yes` は鳴ったまま（キー側だけを外す指定のため）|

## 読み方

- 既定で拾うのは **23 中 17**（エラー 13 + 警告 4）です
- 🔴 **見逃す 6 ルールのうち `octal-values` と `truthy` は型の事故に直結します。**`truthy` は既定でも拾いますが**警告止まり**のため、`level: error` に上げないと CI は止まりません
- 🔴 **`quoted-strings` と `empty-values` は既定で完全に無効**です。「引用符の要否」「値の書き忘れ」をチームで揃えたいなら、明示的に有効化する必要があります
- `details[]` に各ルールの `accident`（防ぐ事故）と、A / B / C それぞれの結果が入っています
- 🔴 **`truthy` を黙らせる 2 手段は、同じ「鳴らなくなった」でも開く範囲が違います。**`allowed-values` は `on` という**語**だけを許すのに対し、`check-keys: false` は**キーであれば何でも**通します。差が出るのは `truthyAllowedValuesKeyYesStillCaught` ⟷ `truthyCheckKeysOffKeyYesSilenced` の 1 対で、**キーの `yes:` を材料に同居させておかないとこの差は観測できません**
- 🔴 **`-s` はルールを選ばずに全部の警告を失敗扱いにします。**`level` がルールごとの選択であるのに対し、`-s` は実行時の一括指定で、終了コードも `1` ではなく `2` です

## C 条件（M1）の読み方と限界

`droppedFullySilent` が **23 件すべて**であることは、**ルール同士が互いを肩代わりしない**ことを示します。1 つ落とせば、そのぶんだけ穴が開きます。

🔴 **ただし限界があります。**各 fixture は**そのルールだけに違反する**よう作ってあります。したがってこの結果が言えるのは「**その違反に対して、他のどのルールも反応しない**」までで、「実ファイルで複数の欠陥が同居したときに何が起きるか」は測っていません。

## レバーの読み方

`.yamllint` 側に書くレバーと、YAML ファイル側に書くレバーは**置き場が違います**。

| # | レバー | 置き場 | 効く範囲 |
|---|---|---|---|
| 1 | `disable` | `.yamllint` | プロジェクト全体 |
| 2 | `level: warning` / `error` | `.yamllint` | プロジェクト全体（鳴るが終了コードが変わる）|
| 3 | `ignore:` | `.yamllint`（ルールごと）| **一致したファイルだけ**（`leverIgnoreOtherStillCaught` が裏づけ）|
| 4 | `# yamllint disable...` | **YAML ファイル側** | ブロック / 行 / ファイル |

🔴 **レバー 4 の `disable-file` は構文エラーまで黙らせます。**壊れた YAML がそのまま lint を通過します（`leverCommentFileSilencesSyntaxError` = `true`・陽性対照つき）。
