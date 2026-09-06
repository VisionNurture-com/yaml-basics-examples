#!/usr/bin/env bash
# mode: M1
# 要るもの: yamllint（pip install yamllint）と check-jsonschema（pip install check-jsonschema）と Node.js 22 以上
#
# 011-schema-reach — lint（字面）と JSON Schema（構造）の射程を、同じ 2 題材で測り分ける。
# fixtures/ は measure.mjs が毎回書き出すため、手で編集しない。
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v yamllint >/dev/null || { echo "yamllint がありません: pip install yamllint" >&2; exit 2; }
command -v check-jsonschema >/dev/null || { echo "check-jsonschema がありません: pip install check-jsonschema" >&2; exit 2; }
# 🔴 測り直す前に前回の出力を消す（MEASURE-01 手順 4）。
rm -f scenarios/011-schema-reach/results/summary.json
node scenarios/011-schema-reach/measure.mjs
