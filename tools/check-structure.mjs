// check-structure.mjs — シナリオが決まった形を保っているかを見る。
//
// 見るのは形だけで、値は check-provenance.mjs が見る。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(repo, 'scenarios');

const REQUIRED = ['run.sh', 'expected.md'];
let bad = 0;
let n = 0;

for (const id of readdirSync(dir).sort()) {
  const p = resolve(dir, id);
  if (!statSync(p).isDirectory()) continue;
  n++;
  for (const f of REQUIRED) {
    if (!existsSync(resolve(p, f))) {
      console.log(`❌ ${id}: ${f} がありません`);
      bad++;
    }
  }
  const runPath = resolve(p, 'run.sh');
  if (existsSync(runPath)) {
    const run = readFileSync(runPath, 'utf8');
    // M0 … 追加の道具が要らない / M1 … CI で道具を入れて測る / M2 … 機械依存で CI では測らない
    if (!/^#\s*mode:\s*M[0-2]\s*$/m.test(run)) {
      console.log(`❌ ${id}/run.sh: "# mode: M0|M1|M2" のヘッダがありません`);
      bad++;
    }
    // 何が手元に要るかを run.sh 自身に書く（README の表はその要約であって正本ではない）
    if (!/^#\s*要るもの:/m.test(run)) {
      console.log(`❌ ${id}/run.sh: "# 要るもの:" の宣言がありません`);
      bad++;
    }
    if (!/set -euo pipefail/.test(run)) {
      console.log(`❌ ${id}/run.sh: set -euo pipefail がありません（失敗が伝播しません）`);
      bad++;
    }
  }
  const expPath = resolve(p, 'expected.md');
  if (existsSync(expPath) && !/^##\s+期待する観測\s*$/m.test(readFileSync(expPath, 'utf8'))) {
    console.log(`❌ ${id}/expected.md: 「期待する観測」の節がありません`);
    bad++;
  }
}

console.log('');
if (n === 0) {
  console.log('⏸ シナリオが 0 本です（PASS ではありません）');
  process.exit(3);
}
if (bad > 0) {
  console.log(`❌ FAIL: ${bad} 件（シナリオ ${n} 本）`);
  process.exit(1);
}
console.log(`✅ PASS: シナリオ ${n} 本すべてが決まった形です`);
