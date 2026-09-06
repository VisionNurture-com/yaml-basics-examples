// 005-layer-triage — 「YAML は通ったのに動かない」を 4 層で切り分ける。
//
// 層ごとに 1 つだけ欠陥を仕込んだファイルを、3 つの道具に通して
// 「どの層の道具が、どの欠陥を捕まえるか」を測る。
//
//   層 1 構文          … yamllint（字面）
//   層 2 ツールのスキーマ … actionlint（Actions）/ docker compose config -q（Compose の公式経路）/ dclint（Compose のスタイル）
//   層 3 意味は通るが意図と違う … どのスキーマで読むかで結果が割れる
//   層 4 ツール側の仕様  … どの道具も通す。動かして初めて分かる
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, YAML11_SCHEMA } from 'js-yaml';
import { readFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const fx = (n) => resolve(here, 'fixtures', n);
const results = resolve(here, 'results');
mkdirSync(results, { recursive: true });

/** 道具を走らせ、rc と指摘の種類（rule id / kind）を返す。rc 非 0 は「捕まえた」。 */
function run(cmd, args) {
  try {
    const out = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { rc: 0, out };
  } catch (e) {
    return { rc: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

const yamllint = (f) => {
  const r = run('yamllint', ['-d', '{extends: default}', '-f', 'parsable', f]);
  const ids = [...r.out.matchAll(/\(([a-z-]+)\)\s*$/gm)].map((m) => m[1]);
  // 🔴 rc も残す。yamllint は警告だけなら 0 を返すため、「指摘は出たが CI は止まらない」が起きる。
  return { caught: ids.length > 0, ids: [...new Set(ids)].sort(), rc: r.rc };
};

const actionlint = (f) => {
  const r = run('actionlint', ['-no-color', f]);
  const ids = [...r.out.matchAll(/\[([a-z-]+)\]\s*$/gm)].map((m) => m[1]);
  return { caught: ids.length > 0, ids: [...new Set(ids)].sort() };
};

const dclint = (f) => {
  // 🔴 --no-color を必ず渡す。dclint は CI=true で色を有効にするため、付けないと
  //    行末が `\e[2m<rule-id>\e[22m` になり、下の行末正規表現が id を取り落とす。
  //    actionlint に -no-color を渡しているのと同じ理由（2026-09-06・CI で実測）。
  const r = run('npx', ['--no-install', 'dclint', '--no-color', f]);
  const ids = [...r.out.matchAll(/\s([a-z-]+)\s*$/gm)]
    .map((m) => m[1])
    .filter((s) => s.includes('-'));
  return { caught: r.rc !== 0, ids: [...new Set(ids)].sort(), rc: r.rc, out: scrub(r.out).trim() };
};

/** 機種固有パスを剥がす。compose / dclint は相対で渡しても絶対パスで出力する。 */
const repoRoot = resolve(here, '../..');
const scrub = (s) => s.split(repoRoot).join('<repo>');

/** Compose の公式経路。--quiet は「設定の検証だけ行い何も出力しない」。 */
const composeConfig = (f) => {
  const r = run('docker', ['compose', '-f', f, 'config', '-q']);
  return { caught: r.rc !== 0, rc: r.rc, out: scrub(r.out).trim() };
};

/** 層 3 — 同じファイルを 2 つのスキーマで読み、トップレベルのキーが割れるかを見る。 */
function schemaSplit(f) {
  const src = readFileSync(f, 'utf8');
  const core = Object.keys(load(src));
  const y11 = Object.keys(load(src, { schema: YAML11_SCHEMA }));
  return { core, yaml11: y11, split: JSON.stringify(core) !== JSON.stringify(y11) };
}

const cases = [
  { layer: 1, file: 'layer1-ci.yml',      defect: '行末に空白がある（字面）' },
  { layer: 2, file: 'layer2-ci.yml',      defect: 'runner ラベルの綴り違い・未定義のコンテキスト属性・非推奨コマンド' },
  { layer: 2, file: 'layer2-compose.yaml', defect: 'ports を port と綴り違い（Compose のスキーマ）', compose: true },
  { layer: 3, file: 'layer3-ci.yml',      defect: 'on: を引用していない（1.1 系スキーマで真偽値に化ける）' },
  { layer: 4, file: 'layer4-ci.yml',      defect: 'branches が実在しない名前（mian）' },
  { layer: 2, file: 'layer2-compose-style.yaml', defect: 'スキーマは妥当だがスタイルの慣行に反する（射程の差を見る対照）', compose: true },
];

const matrix = cases.map((c) => {
  const f = fx(c.file);
  const yl = yamllint(f);
  const al = c.compose ? { caught: false, ids: [], skipped: true } : actionlint(f);
  const dl = c.compose ? dclint(f) : { caught: false, ids: [], skipped: true };
  const cc = c.compose ? composeConfig(f) : { caught: false, rc: null, skipped: true };
  const s3 = c.compose ? null : schemaSplit(f);
  return {
    layer: c.layer,
    file: c.file,
    defect: c.defect,
    yamllint: yl.caught,
    yamllintIds: yl.ids,
    yamllintRc: yl.rc,
    actionlint: al.caught,
    actionlintIds: al.ids,
    dclint: dl.caught,
    dclintIds: dl.ids,
    composeConfig: cc.caught,
    composeConfigRc: cc.rc,
    schemaSplit: s3 ? s3.split : null,
    topLevelKeysCore: s3 ? s3.core : null,
    topLevelKeysYaml11: s3 ? s3.yaml11 : null,
  };
});

const toolVersions = [
  run('yamllint', ['--version']).out.trim(),
  `actionlint ${run('actionlint', ['-version']).out.trim().split('\n')[0]}`,
  `dclint ${JSON.parse(readFileSync(resolve(here, '../..', 'node_modules/dclint/package.json'), 'utf8')).version}`,
  `js-yaml ${JSON.parse(readFileSync(resolve(here, '../..', 'node_modules/js-yaml/package.json'), 'utf8')).version}`,
].join(' / ');

// 🔴 docker compose の版は突合対象に入れない。ディストリビューションごとに違い
//    （macOS 5.5.0 / Ubuntu 26.04 2.40.3 / GitHub Actions 2.38.2・いずれも実測）、
//    版が変わっても下の composeConfigRc* は変わらないため。007 が Python の patch 版を
//    突合から外しているのと同じ扱い。記録は残す（下の composeVersion）。
const composeVersion = run('docker', ['compose', 'version', '--short']).out.trim();

const summary = {
  scenario: '005-layer-triage',
  measuredAt: new Date().toISOString(),
  platform: `${process.platform} ${process.arch}`,
  toolVersions,
  // 突合対象外（環境で変わる）。観測の再現条件として記録だけ残す。
  composeVersion,
  // 各層で、どの道具が捕まえたか
  caughtByYamllint: matrix.filter((m) => m.yamllint).map((m) => m.file),
  caughtByActionlint: matrix.filter((m) => m.actionlint).map((m) => m.file),
  caughtByDclint: matrix.filter((m) => m.dclint).map((m) => m.file),
  caughtByComposeConfig: matrix.filter((m) => m.composeConfig).map((m) => m.file),
  caughtByNothing: matrix
    .filter((m) => !m.yamllint && !m.actionlint && !m.dclint && !m.composeConfig && !m.schemaSplit)
    .map((m) => m.file),
  // 🔴 射程の重なり — 同じ 1 ファイルを 2 つ以上の道具が捕まえた件。
  //    重なりが 0 なら「別の領域を見ている」と言える（陽性対照は下の 2 行が担う）。
  overlapFiles: matrix
    .filter((m) => [m.yamllint, m.actionlint, m.dclint, m.composeConfig].filter(Boolean).length >= 2)
    .map((m) => m.file),
  // 陽性対照 — 各道具が「動いていない」のではなく「対象外」であることを示す。
  //   compose config は port の綴り違いで rc=1 を返す（生きている）
  //   dclint はスタイルだけの入力でも指摘を出す（生きている）
  composeConfigRcSchemaDefect: String(matrix.find((m) => m.file === 'layer2-compose.yaml').composeConfigRc),
  composeConfigRcStyleOnly: String(matrix.find((m) => m.file === 'layer2-compose-style.yaml').composeConfigRc),
  composeStyleOnlyDclintIds: matrix.find((m) => m.file === 'layer2-compose-style.yaml').dclintIds,
  // 層 2 で actionlint が出した指摘の種類
  layer2ActionlintIds: matrix.find((m) => m.file === 'layer2-ci.yml').actionlintIds,
  // 層 3 は yamllint が truthy で気づかせるが、警告止まりのため終了コードは 0 のまま
  layer3YamllintIds: matrix.find((m) => m.file === 'layer3-ci.yml').yamllintIds,
  layer3YamllintRc: String(matrix.find((m) => m.file === 'layer3-ci.yml').yamllintRc),
  // 層 3 でスキーマによって割れたキー
  layer3CoreKeys: matrix.find((m) => m.file === 'layer3-ci.yml').topLevelKeysCore,
  layer3Yaml11Keys: matrix.find((m) => m.file === 'layer3-ci.yml').topLevelKeysYaml11,
  matrix,
};

writeFileSync(resolve(results, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

// 🔴 生ログも残す。要約だけでは「何をどう測ったか」が復元できない。
//    出力は scrub() 済みで、機種固有パスは <repo> に置き換えてある。
const raw = matrix
  .map((m) => `## ${m.file}\n- yamllint rc=${m.yamllintRc} ids=${JSON.stringify(m.yamllintIds)}\n- actionlint ids=${JSON.stringify(m.actionlintIds)}\n- dclint caught=${m.dclint} ids=${JSON.stringify(m.dclintIds ?? [])}\n- docker compose config -q rc=${m.composeConfigRc}\n`)
  .join('\n');
writeFileSync(resolve(results, 'raw.md'), `# 005-layer-triage 生ログ（${summary.measuredAt} / ${summary.platform}）\n\n道具: ${toolVersions}\n\n${raw}`);
console.log(`道具: ${toolVersions}`);
for (const m of matrix) {
  const who = [m.yamllint && 'yamllint', m.actionlint && 'actionlint', m.composeConfig && 'compose config', m.dclint && 'dclint'].filter(Boolean);
  console.log(`  層${m.layer} ${m.file.padEnd(20)} → ${who.length ? who.join(' + ') : 'どれも捕まえない'}`);
}
console.log(`  重なり: ${summary.overlapFiles.length ? summary.overlapFiles.join(', ') : 'なし'}`);
console.log(`  層3 のキー: core=${JSON.stringify(summary.layer3CoreKeys)} / 1.1=${JSON.stringify(summary.layer3Yaml11Keys)}`);
