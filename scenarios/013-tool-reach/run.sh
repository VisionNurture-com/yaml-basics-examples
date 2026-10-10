#!/usr/bin/env bash
# mode: M1
# 要るもの: uv / curl（Bandit 1.9.4・Ruff 0.16.10・Semgrep 1.179.0 を使い捨ての venv に入れる）
#
# 013-tool-reach — 依存の奥の非安全な YAML 読み込みを探す道具 5 つ
# （grep / 007 の scan_deps.py / Bandit B506 / Ruff S506 / Semgrep avoid-pyyaml-load）を
# 同じ題材 3 つに当て、どの書き方を拾い、どれを拾わないかを並べる。
# grep の探す語は、NVD の CVE-2020-14343 の説明が名指しする full_load / FullLoader に yaml.load( を加えた 3 つ。
#
# 🔴 Semgrep のルールは公開リポジトリに同梱しない（Semgrep Rules License v1.0）。
#    実行時に固定した SHA から取得する。--metrics off で結果を外へ送らない。
# 🔴 Ruff は --isolated で、このリポジトリの設定ファイルを読ませない。
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v uv >/dev/null || { echo "uv がありません: https://docs.astral.sh/uv/" >&2; exit 2; }
command -v curl >/dev/null || { echo "curl がありません" >&2; exit 2; }
S=scenarios/013-tool-reach
RULE_SHA=46a0ecfdf78f86a6409677c58417f845ef9eae9a
RULE_URL="https://raw.githubusercontent.com/semgrep/semgrep-rules/$RULE_SHA/python/lang/security/deserialization/avoid-pyyaml-load.yaml"

rm -f "$S/results/summary.json"
rm -rf "$S/results/raw"
mkdir -p "$S/results/raw"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

uv venv --quiet --python 3.13 "$work/tools"
uv pip install --quiet -p "$work/tools/bin/python" bandit==1.9.4 ruff==0.16.10 semgrep==1.179.0
curl -fsSL "$RULE_URL" -o "$work/avoid-pyyaml-load.yaml"

T=$work/tools/bin
"$T/python" - > "$S/results/raw/versions.json" <<'PY'
import json, importlib.metadata as m
print(json.dumps({k: m.version(k) for k in ("bandit", "ruff", "semgrep")}))
PY

for name in sampleDeps indirect grepFp; do
  case $name in
    sampleDeps) dir=scenarios/007-dependency-audit/fixtures/sample_deps ;;
    indirect)   dir=scenarios/009-scan-reach/fixtures/indirect ;;
    grepFp)     dir=$S/fixtures/grep_fp ;;
  esac
  # grep は一致が無いと終了コード 1 を返す。0 件も結果として読むので、ここでは止めない
  grep -rnE 'yaml\.load\(|full_load\(|FullLoader' --include='*.py' "$dir" \
    > "$S/results/raw/grep.$name.txt" || [ $? -eq 1 ]
  python3 scenarios/007-dependency-audit/audit/scan_deps.py "$dir" > "$S/results/raw/scan_deps.$name.json"
  # Bandit と Ruff は検出があると終了コード 1 を返す。検出は結果として読むので、ここでは止めない
  "$T/bandit" -q -r "$dir" -t B506 -f json -o "$S/results/raw/bandit.$name.json" || [ $? -eq 1 ]
  "$T/ruff" check --isolated --no-cache --select S506 --output-format json "$dir" \
    > "$S/results/raw/ruff.$name.json" || [ $? -eq 1 ]
  "$T/semgrep" scan --metrics off --quiet --disable-version-check \
    --config "$work/avoid-pyyaml-load.yaml" --json "$dir" > "$S/results/raw/semgrep.$name.json"
done
python3 "$S/measure.py"
