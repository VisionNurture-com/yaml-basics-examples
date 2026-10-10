"""PyYAML ではないライブラリの読み込み。変数名が yaml なので、名前で探すと PyYAML に見える。"""
from ruamel.yaml import YAML


def read(s):
    yaml = YAML(typ="safe")
    return yaml.load(s)
