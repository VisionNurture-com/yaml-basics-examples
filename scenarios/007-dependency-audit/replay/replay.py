"""信頼できない YAML を非安全な経路で読むと、読んだだけで命令が走ることを観察する。

🔴 隔離環境でのみ実行すること。命令は「マーカーファイルを 1 つ作る」だけに限定する。
"""
import os
import sys

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
marker = os.path.join(HERE, "replay_marker.txt")
if os.path.exists(marker):
    os.remove(marker)

with open(os.path.join(HERE, "payload.yaml"), encoding="utf-8") as f:
    src = f.read()

# safe_load は危険タグを ConstructorError で拒否する（実行されない）
try:
    yaml.safe_load(src)
    safe_result = "読めた（想定外）"
except yaml.constructor.ConstructorError:
    safe_result = "ConstructorError で拒否"

# unsafe_load は危険タグを解釈する = 命令が走る
yaml.unsafe_load(src.replace("replay_marker.txt", marker))
unsafe_executed = os.path.exists(marker)
if os.path.exists(marker):
    os.remove(marker)

print(f"pyyaml={yaml.__version__}")
print(f"safe_load: {safe_result}")
print(f"unsafe_load: {'命令が走った' if unsafe_executed else '走らなかった'}")

# 呼び出し側（measure）へは終了コードで返す
sys.exit(0 if unsafe_executed and safe_result.startswith("Constructor") else 1)
