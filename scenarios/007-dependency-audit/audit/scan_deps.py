"""依存ツリーの中から「YAML を非安全に読むコードパス」を探す。

自分が safe_load を使っていても、依存ライブラリが FullLoader や unsafe_load を
呼んでいれば、外部入力 YAML を渡す経路の奥で危険が残る。ここでは決まった
fixtures/ を走査し、どのファイルのどの行がどのパターンに当たるかを列挙する。

出力は JSON（stdout）。measure が summary.json へまとめる。
"""
import ast
import json
import os
import sys

# 非安全とみなす呼び出し。key は分類名。
UNSAFE_CALLS = {
    "unsafe_load": ("yaml", "unsafe_load"),
    "load_full": ("yaml", "load"),  # Loader=FullLoader / UnsafeLoader / 省略 は下で判定
}


def unsafe_loader_arg(call):
    """yaml.load(...) の Loader= が安全でない、または省略されているか。"""
    for kw in call.keywords:
        if kw.arg == "Loader":
            name = ast.unparse(kw.value)
            return name.endswith("FullLoader") or name.endswith("UnsafeLoader"), name
    # Loader を渡していない load() は、古い版では既定が unsafe（現行版は TypeError）
    return True, "(省略)"


def scan_file(path):
    hits = []
    try:
        src = open(path, encoding="utf-8").read()
    except (UnicodeDecodeError, OSError):
        # 依存ツリーには非 UTF-8 や生成物が混じる。Python として読めない
        # ファイルは走査対象にならないため、静かに飛ばす。
        return hits
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return hits
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if not isinstance(func, ast.Attribute):
            continue
        attr = func.attr
        base = ast.unparse(func.value)
        if base != "yaml":
            continue
        if attr == "unsafe_load":
            hits.append({"line": node.lineno, "pattern": "unsafe_load", "detail": "yaml.unsafe_load"})
        elif attr == "load":
            unsafe, loader = unsafe_loader_arg(node)
            if unsafe:
                hits.append({"line": node.lineno, "pattern": "load", "detail": f"Loader={loader}"})
    return hits


def main():
    root = sys.argv[1]
    findings = []
    for dirpath, _dirs, files in os.walk(root):
        for fn in sorted(files):
            if not fn.endswith(".py"):
                continue
            if fn.startswith("."):
                # AppleDouble（._foo.py）などの sidecar を除く
                continue
            path = os.path.join(dirpath, fn)
            for h in scan_file(path):
                findings.append({"file": os.path.relpath(path, root), **h})
    findings.sort(key=lambda f: (f["file"], f["line"]))
    print(json.dumps(findings, ensure_ascii=False))


if __name__ == "__main__":
    main()
