"""FullLoader が「何を許し、何を拒むか」を面として測る。

「safe_load は安全 / load は危険」の二分法では、FullLoader の位置が表せない。
ここでは同じ 8 種のタグを safe_load と full_load に通し、応答の違いを列挙する。

🔴 weaponize しない。確かめるのは「そのタグ族の構築が許されるか」であって、
   任意コード実行の再現ではない。対象は list / builtins.len / collections など
   副作用を持たないものだけに限定する。
"""
import json
import os
import sys
from datetime import datetime, timezone

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))

# タグ名 -> 無害な入力。値は「構築されるか」を見るためだけのもの。
CASES = {
    "python/bytes": "!!python/bytes YWJj",
    "python/complex": "!!python/complex 1+2j",
    "python/module": "!!python/module:collections",
    "python/name": "!!python/name:builtins.len",
    "python/object": "!!python/object:collections.OrderedDict {}",
    "python/object/apply": "!!python/object/apply:builtins.len [[1, 2]]",
    "python/object/new": "!!python/object/new:list [[1, 2]]",
    "python/tuple": "!!python/tuple [1, 2]",
}


def probe(fn, doc):
    """構築されたら型名、拒まれたら例外クラス名を返す。"""
    try:
        return True, type(fn(doc)).__name__
    except Exception as exc:  # 例外の種類そのものが観測値
        return False, type(exc).__name__


def main():
    safe_accepts, full_accepts, full_rejects = [], [], []
    reject_kinds = set()

    for tag in sorted(CASES):
        doc = CASES[tag]
        ok_safe, _ = probe(yaml.safe_load, doc)
        ok_full, what_full = probe(yaml.full_load, doc)
        if ok_safe:
            safe_accepts.append(tag)
        if ok_full:
            full_accepts.append(tag)
        else:
            full_rejects.append(tag)
            reject_kinds.add(what_full)

    # 「名前の解決は許すが構築は拒む」を 1 つの値で示す
    _, name_type = probe(yaml.full_load, CASES["python/name"])
    # Loader を省略した load() は現行版では読み込みに至らない
    _, omitted = probe(lambda d: yaml.load(d), CASES["python/object/new"])
    # 同じ入力を unsafe_load に渡すと構築が通る（対照）
    ok_unsafe, _ = probe(yaml.unsafe_load, CASES["python/object/new"])

    summary = {
        "scenario": "008-loader-surface",
        "measuredAt": datetime.now(timezone.utc).isoformat(),
        "platform": sys.platform,
        "toolVersions": f"PyYAML {yaml.__version__}",
        "pythonVersion": sys.version.split()[0],
        "tagsProbed": sorted(CASES),
        "safeLoadAccepts": safe_accepts,
        "fullLoadAccepts": full_accepts,
        "fullLoadRejects": full_rejects,
        "fullLoadRejectKinds": sorted(reject_kinds),
        "fullLoadNameReturnsType": name_type,
        "loaderOmittedResult": omitted,
        "unsafeLoadAcceptsObjectNew": str(ok_unsafe),
    }
    out = os.path.join(HERE, "results", "summary.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"PyYAML {yaml.__version__}")
    print(f"  safe_load が許す: {safe_accepts or '（なし）'}")
    print(f"  full_load が許す: {full_accepts}")
    print(f"  full_load が拒む: {full_rejects}")
    print(f"  full_load の python/name は {name_type} を返す")


if __name__ == "__main__":
    main()
