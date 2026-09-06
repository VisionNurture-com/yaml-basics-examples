// check-provenance.mjs — expected.md に書いた値と results/summary.json を突合する。
//
// 🔴 「実行できた」ことは PASS の根拠にならない。突合が 0 件なら FAIL とする。
//    比較する対象が無いまま緑を返すのは、検出器が黙っているのと同じである。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(repo, 'scenarios');
const only = process.argv.includes('--prefix')
  ? process.argv[process.argv.indexOf('--prefix') + 1]
  : null;

/**
 * expected.md の「期待する観測」表から key → 期待値 を読む。
 *
 * 🔴 節の終端（次の `## `）で必ず切る。切らないと後続の表まで読み込み、
 *    存在しないキーを「summary.json にありません」と report してしまう。
 * 空の配列は `（なし）` と書く。空欄では「書き忘れ」と区別できない。
 */
const EMPTY = '（なし）';

function parseExpected(md) {
  const out = new Map();
  const after = md.split(/^##\s+期待する観測\s*$/m)[1];
  if (!after) return out;
  const sec = after.split(/^##\s+/m)[0];
  for (const line of sec.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const key = cells[0].replace(/`/g, '');
    if (!key || key === 'キー' || /^-+$/.test(key)) continue;
    const raw = cells[1].trim();
    out.set(key, raw === EMPTY ? [] : raw.split(',').map((v) => v.trim().replace(/`/g, '')));
  }
  return out;
}

const actualToStrings = (v) => (Array.isArray(v) ? v.map(String) : [String(v)]);

let compared = 0;
let bad = 0;
let scenarios = 0;

for (const id of readdirSync(dir).sort()) {
  if (only && !id.startsWith(only)) continue;
  const exp = resolve(dir, id, 'expected.md');
  const sum = resolve(dir, id, 'results', 'summary.json');
  if (!existsSync(exp)) continue;
  scenarios++;
  if (!existsSync(sum)) {
    console.log(`❌ ${id}: results/summary.json がありません（run.sh を実行してください）`);
    bad++;
    continue;
  }
  const expected = parseExpected(readFileSync(exp, 'utf8'));
  const actual = JSON.parse(readFileSync(sum, 'utf8'));
  if (expected.size === 0) {
    console.log(`❌ ${id}: expected.md の「期待する観測」表を読めませんでした`);
    bad++;
    continue;
  }
  for (const [key, want] of expected) {
    if (!(key in actual)) {
      console.log(`❌ ${id}.${key}: summary.json にキーがありません`);
      bad++;
      continue;
    }
    const got = actualToStrings(actual[key]);
    compared++;
    const ok = want.length === got.length && want.every((w, i) => w === got[i]);
    if (ok) console.log(`✅ ${id}.${key} = ${got.length ? got.join(', ') : EMPTY}`);
    else {
      console.log(
        `❌ ${id}.${key}: 期待 [${want.length ? want.join(', ') : EMPTY}] / 実測 [${got.length ? got.join(', ') : EMPTY}]`,
      );
      bad++;
    }
  }
  // 測った条件を必ず添える。値そのものは上の突合が見るので、ここは presence だけを見る。
  //
  // 🔴 版を要求するのは、同じキーでも道具の版が変われば別の観測になるため。
  //    xml-basics-examples は M1 でブラウザの版を要求していたが、本リポは
  //    ブラウザを使わないため toolVersions（測った道具の版）に置き換えている。
  for (const k of ['measuredAt', 'platform', 'toolVersions']) {
    if (!actual[k]) {
      console.log(`❌ ${id}: summary.json に ${k} がありません（測った条件を添えること）`);
      bad++;
    }
  }
}

console.log('');
if (scenarios === 0) {
  console.log('⏸ 突合できるシナリオが 0 件です（PASS ではありません）');
  process.exit(3);
}
if (compared === 0) {
  console.log('⏸ 突合した項目が 0 件です（PASS ではありません）');
  process.exit(3);
}
if (bad > 0) {
  console.log(`❌ FAIL: 不一致 ${bad} 件 / 突合 ${compared} 件（シナリオ ${scenarios} 本）`);
  process.exit(1);
}
console.log(`✅ PASS: 突合 ${compared} 件すべて一致（シナリオ ${scenarios} 本）`);
