#!/usr/bin/env bash
# mode: M1
# 要るもの: yamllint / actionlint / docker compose / Node.js 22 以上と npm ci（dclint と js-yaml を使う）
#
# 005-layer-triage — 「YAML は通ったのに動かない」を 4 層で切り分ける。
# fixtures/ は手で書いた教材のため、measure.mjs は書き換えない。
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v yamllint   >/dev/null || { echo "yamllint がありません: pip install yamllint" >&2; exit 2; }
command -v actionlint >/dev/null || { echo "actionlint がありません: brew install actionlint / go install" >&2; exit 2; }
[ -d node_modules/dclint ] || { echo "dclint がありません: npm ci" >&2; exit 2; }
docker compose version >/dev/null 2>&1 || { echo "docker compose がありません: Docker Desktop / docker-compose-plugin を入れてください" >&2; exit 2; }
node scenarios/005-layer-triage/measure.mjs
