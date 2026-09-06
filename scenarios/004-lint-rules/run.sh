#!/usr/bin/env bash
# mode: M1
# 要るもの: yamllint（pip install yamllint）と Node.js 22 以上
#
# 004-lint-rules — yamllint の各ルールが「どの事故を防ぐか」を実測で対応づける。
# fixtures/ は measure.mjs が毎回書き出すため、手で編集しない。
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v yamllint >/dev/null || { echo "yamllint がありません: pip install yamllint" >&2; exit 2; }
# 🔴 測り直す前に前回の出力を消す。測定が途中で失敗しても前回の summary.json が
#    残っていれば、直後の突合ゲートは前回の値で緑を返す（MEASURE-01 手順 4）。
rm -f scenarios/004-lint-rules/results/summary.json
node scenarios/004-lint-rules/measure.mjs
