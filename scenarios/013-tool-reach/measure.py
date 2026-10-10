"""同じ題材に 5 つの道具を当て、どの書き方を拾い、どれを拾わないかを並べる。

run.sh が道具ごとの JSON 出力を results/raw/ に置き、このスクリプトが
「題材:行」の一覧へそろえて summary.json にまとめる。

道具ごとの判定の向き（2026-10-07 に各道具のソース・ルールを開いて確認・grep は 2026-10-08 に追加）:
  - grep: 文字列 yaml.load( / full_load( / FullLoader を探す（コメントも、別のライブラリも拾う）
  - scan_deps.py（007）: 危ない Loader / 関数の「名前」で探す（拒否リスト）
  - Bandit B506: 関数名が load で、Loader が SafeLoader / CSafeLoader でないもの（許可リスト）
  - Ruff S506: yaml.load の呼び出し（Bandit と同じ規則）
  - Semgrep avoid-pyyaml-load: PyYAML 5.4 以降を前提に unsafe_load / Loader / UnsafeLoader / CLoader だけ
"""
import json
import os
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "results", "raw")
ROOT = os.path.dirname(os.path.dirname(HERE))
TARGETS = {
    "sampleDeps": "scenarios/007-dependency-audit/fixtures/sample_deps",
    "indirect": "scenarios/009-scan-reach/fixtures/indirect",
    "grepFp": "scenarios/013-tool-reach/fixtures/grep_fp",
}


def rel(path, target):
    """道具が返したパスを、題材の根からの相対パスにそろえる。"""
    p = os.path.relpath(os.path.join(ROOT, path) if not os.path.isabs(path) else path,
                        os.path.join(ROOT, TARGETS[target]))
    return p.replace(os.sep, "/")


def load(name):
    with open(os.path.join(RAW, name), encoding="utf-8") as f:
        return json.load(f)


def hits_grep(target):
    """grep -rn の出力（パス:行:本文）から「題材:行」を取る。"""
    with open(os.path.join(RAW, f"grep.{target}.txt"), encoding="utf-8") as f:
        rows = [line.split(":", 2) for line in f if line.strip()]
    return sorted({f"{rel(path, target)}:{num}" for path, num, _ in rows})


def hits_scan(target):
    return sorted({f"{d['file']}:{d['line']}" for d in load(f"scan_deps.{target}.json")})


def hits_bandit(target):
    data = load(f"bandit.{target}.json")
    return sorted({f"{rel(r['filename'], target)}:{r['line_number']}"
                   for r in data["results"] if r["test_id"] == "B506"})


def hits_ruff(target):
    data = load(f"ruff.{target}.json")
    return sorted({f"{rel(r['filename'], target)}:{r['location']['row']}"
                   for r in data if r["code"] == "S506"})


def hits_semgrep(target):
    data = load(f"semgrep.{target}.json")
    return sorted({f"{rel(r['path'], target)}:{r['start']['line']}"
                   for r in data["results"]})


def main():
    versions = load("versions.json")
    summary = {
        "scenario": "013-tool-reach",
        "measuredAt": datetime.now(timezone.utc).isoformat(),
        "platform": sys.platform,
        "toolVersions": " / ".join(f"{k} {v}" for k, v in versions.items()),
    }
    for target in TARGETS:
        for tool, fn in (("grep", hits_grep), ("scanDeps", hits_scan), ("bandit", hits_bandit),
                         ("ruff", hits_ruff), ("semgrep", hits_semgrep)):
            summary[f"{target}.{tool}"] = fn(target)
    out = os.path.join(HERE, "results", "summary.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
