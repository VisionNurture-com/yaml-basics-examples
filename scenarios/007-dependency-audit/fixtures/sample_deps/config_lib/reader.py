import yaml

def read(text):
    # 危険: Loader を渡さない古い load()（呼ぶと TypeError だが、コードとしては残っている）
    return yaml.load(text)
