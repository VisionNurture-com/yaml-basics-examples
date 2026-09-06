"""YAML を一切読まないモジュール（走査の対象が居ない木の代表）。"""
import json


def load_settings(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)
