import yaml

def parse(text):
    # 危険: Loader を省略しない古い書き方でも FullLoader を明示している
    return yaml.load(text, Loader=yaml.FullLoader)

def parse_untrusted(text):
    # 危険: unsafe_load を外部入力に使っている
    return yaml.unsafe_load(text)
