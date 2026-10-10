"""case.py の 2 行（inherit / direct）を summary.json にまとめる。"""
import json
import os
import sys
from datetime import datetime, timezone

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    rows = {r["case"]: r for r in (json.loads(l) for l in sys.stdin if l.strip())}
    summary = {
        "scenario": "014-safeloader-extend",
        "measuredAt": datetime.now(timezone.utc).isoformat(),
        "platform": sys.platform,
        "toolVersions": f"PyYAML {yaml.__version__}",
        "pythonVersion": sys.version.split()[0],
    }
    for case in ("inherit", "direct"):
        for k in ("safeLoadBefore", "extendedLoader", "safeLoadAfter"):
            summary[f"{case}.{k}"] = rows[case][k]
    out = os.path.join(HERE, "results", "summary.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
