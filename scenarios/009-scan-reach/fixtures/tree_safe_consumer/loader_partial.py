"""実在の書き方（pre-commit の pre_commit/yaml.py と同型）。

yaml.load を functools.partial に渡す。Loader は SafeLoader なので安全だが、
grep で `yaml.load` を探すと引っかかる。
"""
import functools

import yaml

Loader = getattr(yaml, "CSafeLoader", yaml.SafeLoader)
yaml_load = functools.partial(yaml.load, Loader=Loader)
