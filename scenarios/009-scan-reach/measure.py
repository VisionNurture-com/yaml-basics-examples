"""走査の「0 件」が何を意味するか、そして走査が届かない範囲を測る。

007 の走査は「非安全な読み込みの呼び出し」を AST で探す。だが 0 件という
結果は 2 つの状態を区別しない ——
  (a) YAML を読むコードが 1 つも無い（対象が居ない）
  (b) YAML を読んでいるが、すべて安全な書き方だった

対照として「yaml を import しているファイル数」を並べれば区別できる。
あわせて、静的走査が構造上届かない 3 つの書き方を測る。

🔴 走査の実装は 007 の scan_deps.py を import して使う（別実装にしない）。
"""
import ast
import json
import os
import sys
from datetime import datetime, timezone

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIT = os.path.join(os.path.dirname(HERE), "007-dependency-audit", "audit")
sys.path.insert(0, AUDIT)
import scan_deps  # noqa: E402


def imports_yaml(src):
    """そのファイルが yaml を import しているか（AST で見る。文字列は拾わない）。"""
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return False
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            if any(a.name == "yaml" or a.name.startswith("yaml.") for a in node.names):
                return True
        elif isinstance(node, ast.ImportFrom):
            if node.module == "yaml" or (node.module or "").startswith("yaml."):
                return True
    return False


def walk_tree(root):
    files, importers, hits = 0, 0, []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for fn in sorted(filenames):
            if not fn.endswith(".py") or fn.startswith("."):
                continue
            p = os.path.join(dirpath, fn)
            files += 1
            try:
                src = open(p, encoding="utf-8").read()
            except (UnicodeDecodeError, OSError):
                continue
            if imports_yaml(src):
                importers += 1
            for h in scan_deps.scan_file(p):
                hits.append(f"{os.path.relpath(p, root)}:{h['line']} {h['pattern']}")
    return files, importers, sorted(hits)


def main():
    fx = os.path.join(HERE, "fixtures")
    no_files, no_imp, no_hits = walk_tree(os.path.join(fx, "tree_no_consumer"))
    sc_files, sc_imp, sc_hits = walk_tree(os.path.join(fx, "tree_safe_consumer"))
    in_files, in_imp, in_hits = walk_tree(os.path.join(fx, "indirect"))

    summary = {
        "scenario": "009-scan-reach",
        "measuredAt": datetime.now(timezone.utc).isoformat(),
        "platform": sys.platform,
        "toolVersions": f"PyYAML {yaml.__version__}",
        "pythonVersion": sys.version.split()[0],
        # (a) 対象が居ない木
        "noConsumerFiles": str(no_files),
        "noConsumerYamlImporters": str(no_imp),
        "noConsumerHits": no_hits,
        # (b) 対象は居るが安全な木
        "safeConsumerFiles": str(sc_files),
        "safeConsumerYamlImporters": str(sc_imp),
        "safeConsumerHits": sc_hits,
        # 射程の外に出る 3 形
        "indirectFiles": str(in_files),
        "indirectYamlImporters": str(in_imp),
        "indirectHits": in_hits,
        "indirectFormsMissed": ["functools.partial", "variable-Loader", "aliased-import"],
    }
    out = os.path.join(HERE, "results", "summary.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"PyYAML {yaml.__version__}")
    print(f"  対象が居ない木  : {no_files} ファイル / yaml を import {no_imp} / 検出 {len(no_hits)} 件")
    print(f"  安全に使う木    : {sc_files} ファイル / yaml を import {sc_imp} / 検出 {len(sc_hits)} 件")
    print(f"  間接化した 3 形 : {in_files} ファイル / yaml を import {in_imp} / 検出 {len(in_hits)} 件")
    print("  → 同じ 0 件でも、yaml を import する数を並べないと読めない")


if __name__ == "__main__":
    main()
