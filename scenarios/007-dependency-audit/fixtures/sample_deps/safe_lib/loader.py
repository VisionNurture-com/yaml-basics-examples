import yaml

def load_config(text):
    # 安全: safe_load を使っている
    return yaml.safe_load(text)
