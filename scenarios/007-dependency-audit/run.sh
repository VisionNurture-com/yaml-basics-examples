#!/usr/bin/env bash
# mode: M1
# 要るもの: PyYAML（pip install PyYAML==6.0.3）と Python 3
#
# 007-dependency-audit — 依存の奥に潜む非安全な YAML 読み込みを探し、
# 攻撃が本物であることを隔離環境で確かめる。
#
# 🔴 replay/ は害のないダミー（echo でマーカーを 1 つ作るだけ）。隔離環境でのみ実行する。
# fixtures/sample_deps/ は走査対象の教材。measure.py は書き換えない。
set -euo pipefail
cd "$(dirname "$0")/../.."
python3 -c "import yaml" 2>/dev/null || { echo "PyYAML がありません: pip install PyYAML==6.0.3" >&2; exit 2; }
python3 scenarios/007-dependency-audit/measure.py
