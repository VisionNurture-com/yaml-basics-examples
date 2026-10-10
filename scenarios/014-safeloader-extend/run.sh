#!/usr/bin/env bash
# mode: M1
# 要るもの: PyYAML（pip install PyYAML==6.0.3）と Python 3
#
# 014-safeloader-extend — safe_load で読めない独自タグを足すとき、
# SafeLoader を継承して足すのと、SafeLoader そのものに足すのとで、
# 素の yaml.safe_load の応答が変わるかを測る。
#
# 🔴 2 通りは別々のプロセスで試す。同じプロセスで続けると、先の足し方が後の結果を汚す。
set -euo pipefail
cd "$(dirname "$0")/../.."
python3 -c "import yaml" 2>/dev/null || { echo "PyYAML がありません: pip install PyYAML==6.0.3" >&2; exit 2; }
S=scenarios/014-safeloader-extend
rm -f "$S/results/summary.json"
{ python3 "$S/case.py" inherit; python3 "$S/case.py" direct; } | python3 "$S/measure.py"
