"""YAML を読むが safe_load しか使わない。"""
import yaml


def read(path):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)
