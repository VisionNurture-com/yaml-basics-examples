"""PyYAML の版ごとに probe.py を走らせた結果（run.sh が渡す JSON 行）を summary.json にまとめる。"""
import json
import os
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    rows = [json.loads(line) for line in sys.stdin if line.strip()]
    by = {r["pyyaml"]: r for r in rows}
    summary = {
        "scenario": "012-loader-versions",
        "measuredAt": datetime.now(timezone.utc).isoformat(),
        "platform": sys.platform,
        "toolVersions": "PyYAML " + " / ".join(sorted(by)),
        "pythonVersion": sorted({r["python"] for r in rows}),
    }
    for ver, r in sorted(by.items()):
        tag = "v" + ver.replace(".", "_")
        for key, val in r.items():
            if key in ("pyyaml", "python"):
                continue
            if isinstance(val, dict):
                summary[f"{tag}.{key}"] = val["result"]
                summary[f"{tag}.{key}.warnings"] = val["warnings"]
            else:
                summary[f"{tag}.{key}"] = val
    out = os.path.join(HERE, "results", "summary.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
