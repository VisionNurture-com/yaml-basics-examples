"""静的走査の射程の外に出る 3 つの書き方。

いずれも「読むと危ない」側に倒れうるが、AST 上の yaml.<attr>(...) 呼び出しに
現れないため、走査からは見えない。走査の欠陥ではなく射程である。
"""
import functools

import yaml

# 形 1: 呼び出しではなく引数として渡す
danger_partial = functools.partial(yaml.load, Loader=yaml.FullLoader)

# 形 2: Loader を変数で渡す（書かれた名前は UnsafeLoader で終わらない）
L = yaml.UnsafeLoader


def read_var(s):
    return yaml.load(s, Loader=L)


# 形 3: 別名で import する（yaml. 始まりの属性呼び出しにならない）
from yaml import unsafe_load as _u


def read_alias(s):
    return _u(s)
