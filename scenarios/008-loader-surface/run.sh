#!/usr/bin/env bash
# mode: M1
# 要るもの: PyYAML（pip install PyYAML==6.0.3）と Python 3
#
# 008-loader-surface — FullLoader が「何を許し、何を拒むか」を面として測る。
#
# 🔴 無害な対象（list / builtins.len / collections）しか使わない。
#    確かめるのはタグ族の構築可否であって、任意コード実行の再現ではない。
set -euo pipefail
cd "$(dirname "$0")/../.."
python3 -c "import yaml" 2>/dev/null || { echo "PyYAML がありません: pip install PyYAML==6.0.3" >&2; exit 2; }
python3 scenarios/008-loader-surface/measure.py
