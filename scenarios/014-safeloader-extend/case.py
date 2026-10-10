"""独自タグを読みたいときの 2 通りの足し方を、1 プロセスに 1 通りずつ試す。

  inherit: SafeLoader を継承したクラスに add_constructor する
  direct : SafeLoader そのものに add_constructor する

足したあと、(1) 足した側の Loader で読めるか (2) 素の yaml.safe_load の応答が変わるか を見る。
引数で受けたケース名の結果を JSON 1 行で出す。
"""
import json
import sys

import yaml

DOC = "port: !port 8080"


def port(loader, node):
    return int(loader.construct_scalar(node))


def probe(fn):
    try:
        return type(fn(DOC)["port"]).__name__
    except Exception as exc:  # 例外の型そのものが観測値
        return type(exc).__name__


def main(case):
    before = probe(yaml.safe_load)
    if case == "inherit":
        class PortLoader(yaml.SafeLoader):
            pass

        PortLoader.add_constructor("!port", port)
        extended = probe(lambda d: yaml.load(d, Loader=PortLoader))
    elif case == "direct":
        yaml.SafeLoader.add_constructor("!port", port)
        extended = probe(lambda d: yaml.load(d, Loader=yaml.SafeLoader))
    else:
        raise SystemExit(f"unknown case: {case}")
    after = probe(yaml.safe_load)
    print(json.dumps({"case": case, "safeLoadBefore": before,
                      "extendedLoader": extended, "safeLoadAfter": after}))


if __name__ == "__main__":
    main(sys.argv[1])
