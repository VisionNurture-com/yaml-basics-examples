#!/usr/bin/env bash
# mode: M1
# 要るもの: JDK 17 以上（java コマンド・単一ファイル実行）と curl
#
# 010-jvm-limits — SnakeYAML の「量の制限」の既定を測る。
#
# jar は Maven Central から版を固定して取り、sha1 を照合してから使う。
# 実行時 API では版が取れない（Implementation-Version がマニフェストに無い）ため、
# 版の根拠を sha1 とマニフェストの Bundle-Version の 2 つで担保する。
set -euo pipefail
cd "$(dirname "$0")/../.."
HERE="scenarios/010-jvm-limits"
VER="2.7"
JAR="$HERE/vendor/snakeyaml-$VER.jar"
BASE="https://repo1.maven.org/maven2/org/yaml/snakeyaml/$VER"

command -v java >/dev/null || { echo "java がありません（JDK 17 以上）" >&2; exit 2; }

mkdir -p "$HERE/vendor"
[ -f "$JAR" ] || curl -fsSL -o "$JAR" "$BASE/snakeyaml-$VER.jar"

want="$(curl -fsSL "$BASE/snakeyaml-$VER.jar.sha1" | tr -d '[:space:]')"
got="$(shasum -a 1 "$JAR" 2>/dev/null | awk '{print $1}' || sha1sum "$JAR" | awk '{print $1}')"
if [ "$want" != "$got" ]; then
  echo "jar の sha1 が Maven Central と一致しません（期待 $want / 実際 $got）" >&2
  exit 1
fi

java -cp "$JAR" "$HERE/Measure.java" "$HERE" "$got"
