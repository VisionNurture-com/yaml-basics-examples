"""007-dependency-audit のまとめ。scan_deps と replay を走らせ summary.json を書く。"""
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))


def version_tuple(v):
    return tuple(int(x) for x in v.split(".")[:3] if x.isdigit())


def main():
    # 1) 依存の走査（fixtures を決定論的な対象にする）
    scan_out = subprocess.check_output(
        [sys.executable, os.path.join(HERE, "audit", "scan_deps.py"),
         os.path.join(HERE, "fixtures", "sample_deps")],
        text=True,
    )
    findings = json.loads(scan_out)
    call_sites = [f"{f['file']}:{f['line']} {f['pattern']}" for f in findings]
    flagged = sorted({f["file"] for f in findings})
    all_py = []
    for dp, _d, fs in os.walk(os.path.join(HERE, "fixtures", "sample_deps")):
        for fn in fs:
            if fn.endswith(".py"):
                all_py.append(os.path.relpath(os.path.join(dp, fn),
                                              os.path.join(HERE, "fixtures", "sample_deps")))
    clean = sorted(set(all_py) - set(flagged))

    # 2) 攻撃再現（隔離前提・害のないダミー）
    replay = subprocess.run(
        [sys.executable, os.path.join(HERE, "replay", "replay.py")],
        capture_output=True, text=True,
    )
    replay_lines = {}
    for line in replay.stdout.strip().splitlines():
        if ": " in line:
            k, v = line.split(": ", 1)
            replay_lines[k.strip()] = v.strip()

    # 3) 版と CVE-2026-24009 の前提（pyyaml < 5.4）
    below_54 = version_tuple(yaml.__version__) < (5, 4)

    summary = {
        "scenario": "007-dependency-audit",
        "measuredAt": datetime.now(timezone.utc).isoformat(),
        "platform": f"{sys.platform}",
        # 突合対象は PyYAML だけにする。Python の patch 版は環境ごとに違い、
        # これらの観測を変えないため、記録はするが突合には入れない。
        "toolVersions": f"PyYAML {yaml.__version__}",
        "pythonVersion": sys.version.split()[0],
        "pyyamlBelow54": str(below_54),  # CVE-2026-24009 の成立前提
        # 走査結果（AST ベースなのでコメント・文字列は拾わない）
        "unsafeCallSites": call_sites,
        "filesFlagged": flagged,
        "filesClean": clean,
        # 攻撃再現（safe_load は拒否・unsafe_load は実行）
        "replaySafeLoad": replay_lines.get("safe_load", "?").strip(),
        "replayUnsafeLoad": replay_lines.get("unsafe_load", "?").strip(),
    }
    out = os.path.join(HERE, "results", "summary.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"PyYAML {yaml.__version__}（pyyaml<5.4: {below_54}）")
    print(f"  非安全な呼び出し {len(call_sites)} 件 / flagged {len(flagged)} ファイル / clean {len(clean)} ファイル")
    for c in call_sites:
        print(f"    - {c}")
    print(f"  再現: safe_load={summary['replaySafeLoad']} / unsafe_load={summary['replayUnsafeLoad']}")


if __name__ == "__main__":
    main()
