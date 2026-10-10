"""1 つの PyYAML の版で、書き方ごとの応答を測って JSON を 1 行出す。

run.sh が uv で版ごとに別の環境を作り、このスクリプトを呼ぶ。

🔴 weaponize しない。入力は builtins.len と list だけで、副作用を持たない。
   確かめるのは「構築されるか / 止まるか / 警告が出るか」であって、
   任意コード実行の再現ではない。
"""
import json
import os
import sys
import warnings

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES = os.path.join(HERE, "..", "007-dependency-audit", "fixtures", "sample_deps")

INPUTS = {
    "name": "!!python/name:builtins.len",
    "objectNew": "!!python/object/new:list [[1, 2]]",
}


def probe(fn, doc):
    """戻り値の型名か例外の型名と、出た警告の型名を返す。文言では判定しない。"""
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        try:
            got = type(fn(doc)).__name__
        except Exception as exc:  # 例外の型そのものが観測値
            got = type(exc).__name__
    kinds = sorted({w.category.__name__ for w in caught})
    return {"result": got, "warnings": kinds}


def methods():
    m = {
        "loadWithoutLoader": lambda d: yaml.load(d),
        "safeLoad": yaml.safe_load,
    }
    # full_load / unsafe_load は 5.1 で入った。無い版では「無い」を記録する
    m["fullLoad"] = getattr(yaml, "full_load", None)
    m["unsafeLoad"] = getattr(yaml, "unsafe_load", None)
    return m


def main():
    out = {"pyyaml": yaml.__version__, "python": sys.version.split()[0]}
    for mname, fn in methods().items():
        for iname, doc in INPUTS.items():
            key = f"{mname}.{iname}"
            out[key] = {"result": "absent", "warnings": []} if fn is None else probe(fn, doc)

    # 依存の題材（007 の config_lib/reader.py）は Loader を渡さずに load() を呼ぶ。
    # import の時点で止まるのか、呼んだときに止まるのかを分けて見る。
    sys.path.insert(0, FIXTURES)
    try:
        import config_lib.reader as reader  # noqa: E402
        out["dependency.import"] = "ok"
    except Exception as exc:
        out["dependency.import"] = type(exc).__name__
        reader = None
    out["dependency.call"] = (
        probe(reader.read, "key: value") if reader else {"result": "not-imported", "warnings": []}
    )
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
