#!/usr/bin/env bash
# mode: M1
# 要るもの: PyYAML（pip install PyYAML==6.0.3）と Python 3
#
# 009-scan-reach — 走査の「0 件」が持つ 2 つの意味と、静的走査が届かない範囲を測る。
#
# 走査の実装は 007 の audit/scan_deps.py を import して使う（別実装にしない）。
set -euo pipefail
cd "$(dirname "$0")/../.."
python3 -c "import yaml" 2>/dev/null || { echo "PyYAML がありません: pip install PyYAML==6.0.3" >&2; exit 2; }
python3 scenarios/009-scan-reach/measure.py
