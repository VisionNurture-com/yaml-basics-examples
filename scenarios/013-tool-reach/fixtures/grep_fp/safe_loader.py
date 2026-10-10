"""文字列では危なく見えるが、Loader が安全側の書き方。"""
import yaml


def read(s):
    return yaml.load(s, Loader=yaml.SafeLoader)
