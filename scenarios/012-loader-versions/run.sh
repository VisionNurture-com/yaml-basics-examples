#!/usr/bin/env bash
# mode: M1
# 要るもの: uv（Python 3.9 と PyYAML 5.3.1 / 5.4.1 / 6.0.3 を一時環境に入れる）
#
# 012-loader-versions — PyYAML の版の区切り（5.1 / 5.4 / 6.0）で、
# Loader を省いた load()・full_load・safe_load・unsafe_load の応答がどう変わるかを測る。
#
# 🔴 3 つの版を同じ Python（3.9）で測る。5.3.1 / 5.4.1 は新しい Python 向けの wheel が無い。
# 🔴 版ごとに使い捨ての venv を作り、終わったら消す。手元の Python には何も入れない。
# 🔴 arm64 の macOS では 5.x を sdist から作る。Cython 3 では作れないため build-constraints.txt で抑える。
#    （uv run --with には build constraint が効かなかったため、uv venv + uv pip install で入れる）
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v uv >/dev/null || { echo "uv がありません: https://docs.astral.sh/uv/" >&2; exit 2; }
S=scenarios/012-loader-versions
rm -f "$S/results/summary.json"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
for v in 5.3.1 5.4.1 6.0.3; do
  # 1 つでも失敗したらここで止まり、summary.json は書かれない（部分的な結果で突合させない）
  uv venv --quiet --python 3.9 "$work/$v"
  uv pip install --quiet -p "$work/$v/bin/python" \
    --build-constraint "$S/build-constraints.txt" "PyYAML==$v"
  "$work/$v/bin/python" "$S/probe.py" >> "$work/rows.jsonl"
done
python3 "$S/measure.py" < "$work/rows.jsonl"
