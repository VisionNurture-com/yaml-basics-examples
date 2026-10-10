// 004-lint-rules — yamllint の各ルールが「どの事故を防ぐか」を実測で対応づける。
//
// ルールごとに、そのルールだけに違反する YAML を用意し、次の 2 通りで測る。
//   A: そのルールだけを有効にした設定  → 用意した YAML が本当にそのルールに触れるか
//   B: extends: default                → 既定でそのルールが有効か・どの level で出るか
//
// A と B の差が「既定は何を見逃すか」であり、.yamllint を設計するときに要る材料そのもの。
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(here, 'fixtures');
const results = resolve(here, 'results');
mkdirSync(fixtures, { recursive: true });
mkdirSync(results, { recursive: true });

// 単独有効化で違反させるために設定が要るルールは config に書く。
// 書かないルールは `enable`（＝そのルールの既定値）で違反する。
const RULES = [
  { name: 'anchors',                 accident: 'エイリアスの参照先が無い（コピペで定義だけ消した）',       body: 'a: 1\nb: *nowhere\n' },
  { name: 'braces',                  accident: 'フロー記法の内側の空白が人によって割れる',                 body: 'a: { b: 1 }\n' },
  { name: 'brackets',                accident: 'フロー配列の内側の空白が人によって割れる',                 body: 'a: [ 1, 2 ]\n' },
  { name: 'colons',                  accident: 'コロンの前に空白が混じる',                                 body: 'a : 1\n' },
  { name: 'commas',                  accident: 'カンマの前後の空白が割れる',                               body: 'a: [1 , 2]\n' },
  { name: 'comments',                accident: 'コメントが値にくっついて読みにくい',                       body: 'a: 1 # too close\n' },
  { name: 'comments-indentation',    accident: 'コメントが直後の行と別の階層に見える',                     body: 'a:\n    # misaligned\n  b: 1\n' },
  { name: 'document-end',            accident: '文書の終端 `...` の有無がファイルごとに割れる',            body: '---\na: 1\n' },
  { name: 'document-start',          accident: '先頭の `---` の有無がファイルごとに割れる',                body: 'a: 1\n' },
  { name: 'empty-lines',             accident: '空行が積もってレビューの差分が膨らむ',                     body: 'a: 1\n\n\n\n\nb: 2\n' },
  { name: 'empty-values',            accident: '値の書き忘れが null として通る',                            config: '{forbid-in-block-mappings: true}', body: 'a:\nb: 2\n' },
  { name: 'float-values',            accident: '`.inf` や `.nan` が設定値として紛れ込む',                    config: '{forbid-inf: true}',              body: 'a: .inf\n' },
  { name: 'hyphens',                 accident: 'リストのハイフン後の空白が割れる',                          body: '-  a\n' },
  { name: 'indentation',             accident: 'インデント幅が途中で変わる',                                body: 'a:\n  b: 1\nc:\n    d: 2\n' },
  { name: 'key-duplicates',          accident: '同じキーを 2 回書き、後ろが黙って勝つ',                     body: 'a: 1\na: 2\n' },
  { name: 'key-ordering',            accident: 'キーの並び順がファイルごとに割れる',                        body: 'b: 1\na: 2\n' },
  { name: 'line-length',             accident: '長い行が折り返され差分が読めなくなる',                      body: `a: ${'x'.repeat(100)}\n` },
  { name: 'new-line-at-end-of-file', accident: '末尾に改行が無く、次の追記が同じ行に入る',                  body: 'a: 1' },
  { name: 'new-lines',               accident: '改行コードが CRLF のまま混ざる',                            body: 'a: 1\r\nb: 2\r\n' },
  { name: 'octal-values',            accident: '先頭ゼロの数値が八進数として読まれる',                      config: '{forbid-implicit-octal: true}',   body: 'a: 010\n' },
  { name: 'quoted-strings',          accident: '引用符の要否が人によって割れる',                            config: '{required: true}',                body: 'a: plain\n' },
  { name: 'trailing-spaces',         accident: '行末の空白が差分に紛れる',                                  body: 'a: 1 \n' },
  { name: 'truthy',                  accident: '`yes` / `on` が真偽値に化ける（Norway problem の親戚）',    body: 'a: yes\n' },
];

/** yamllint を走らせ、指定ルールの指摘だけを返す。rc は捨てる（level は出力から読む）。 */
function lint(configData, file, ruleName) {
  let out = '';
  try {
    out = execFileSync('yamllint', ['-d', configData, '-f', 'parsable', file], { encoding: 'utf8' });
  } catch (e) {
    out = e.stdout ?? '';
  }
  const hits = out
    .split('\n')
    .filter((l) => l.includes(`(${ruleName})`))
    .map((l) => l.match(/\[(warning|error)\]/)?.[1] ?? 'unknown');
  return hits.length ? { detected: true, level: hits[0] } : { detected: false, level: null };
}

/** yamllint を走らせ、全ルールの指摘を {rule, line, level} で返す。 */
function lintAll(configData, file) {
  let out = '';
  try {
    out = execFileSync('yamllint', ['-d', configData, '-f', 'parsable', file], { encoding: 'utf8' });
  } catch (e) {
    out = e.stdout ?? '';
  }
  return out
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/:(\d+):(\d+): \[(warning|error)\] .*\((\S+)\)$/);
      return m ? { line: Number(m[1]), level: m[3], rule: m[4] } : null;
    })
    .filter(Boolean);
}

/** 先頭に `---` を足す。CRLF の材料には CRLF の `---` を足す。 */
function withDocStart(body) {
  return body.includes('\r\n') ? `---\r\n${body}` : `---\n${body}`;
}

/** yamllint の終了コードだけを返す（0 = CI が止まらない）。extraArgs で `-s` 等を足せる。 */
function exitCode(configData, file, extraArgs = []) {
  try {
    execFileSync('yamllint', [...extraArgs, '-d', configData, '-f', 'parsable', file], { encoding: 'utf8' });
    return 0;
  } catch (e) {
    return e.status ?? -1;
  }
}

const toolVersions = execFileSync('yamllint', ['--version'], { encoding: 'utf8' }).trim();

const details = [];
for (const r of RULES) {
  const file = resolve(fixtures, `${r.name}.yaml`);
  // 🔴 `---` を前置して document-start の環境ノイズを消す（C 条件の判定を汚さないため）。
  //    document-start だけは `---` が無いことが違反そのものなので前置しない。
  const body = r.name === 'document-start' ? r.body : withDocStart(r.body);
  writeFileSync(file, body);
  const single = lint(`{rules: {${r.name}: ${r.config ?? 'enable'}}}`, file, r.name);
  const def = lint('{extends: default}', file, r.name);

  // C 条件（M1）: そのルールだけを既定から落とし、fixture 全体で何が残るかを見る。
  // 🔴 「そのルールの検出が消えるか」では足りない。別のルールが同じ違反を拾うなら
  //    決定表の「落としたら通る」は嘘になる。
  const dropped = lintAll(`{extends: default, rules: {${r.name}: disable}}`, file);
  const droppedOther = [...new Set(dropped.map((h) => h.rule))].sort();

  details.push({
    rule: r.name,
    accident: r.accident,
    needsConfigToTrip: Boolean(r.config),
    singleDetected: single.detected,
    singleLevel: single.level,
    defaultDetected: def.detected,
    defaultLevel: def.level,
    droppedRemainingRules: droppedOther,
    droppedFullySilent: droppedOther.length === 0,
  });
}

// ---------------------------------------------------------------------------
// M2 / M3 / M6 — 「黙らせ方」のレバーと、代表例の再現
// ---------------------------------------------------------------------------

// M2: `ignore:` はルール単位・ファイル単位で効く。
//     同じ違反を持つ 2 ファイルを用意し、片方だけを ignore に載せる。
const ignHit = resolve(fixtures, 'lever-ignore-target.yaml');
const ignMiss = resolve(fixtures, 'lever-ignore-other.yaml');
writeFileSync(ignHit, '---\na: 1\na: 2\n');   // key-duplicates + （行末空白なし）
writeFileSync(ignMiss, '---\na: 1\na: 2\n');
const ignoreConf = "{extends: default, rules: {key-duplicates: {ignore: 'lever-ignore-target.yaml'}}}";
const leverIgnore = {
  // ignore に載せたファイル: key-duplicates が黙るか
  targetSilenced: !lintAll(ignoreConf, ignHit).some((h) => h.rule === 'key-duplicates'),
  // 載せていないファイル: 同じ違反がまだ鳴るか（＝ ignore はファイル単位）
  otherStillCaught: lintAll(ignoreConf, ignMiss).some((h) => h.rule === 'key-duplicates'),
};

// M3: コメント制御は「.yamllint 側」ではなく「YAML ファイル側」に書く機構
//     3 種を個別に測る。
const cmtBlock = resolve(fixtures, 'lever-comment-block.yaml');
writeFileSync(cmtBlock, '---\n# yamllint disable rule:colons\na : 1\nb : 2\n# yamllint enable rule:colons\nc : 3\n');
const cmtLine = resolve(fixtures, 'lever-comment-line.yaml');
writeFileSync(cmtLine, '---\na : 1  # yamllint disable-line rule:colons\nb : 2\n');
const cmtFile = resolve(fixtures, 'lever-comment-file.yaml');
writeFileSync(cmtFile, '# yamllint disable-file\na : 1\nb: 2 \n');
// 🔴 disable-file が「構文エラー」まで黙らせるかを測る（予測 P4 の検証）。
const cmtSyntax = resolve(fixtures, 'lever-comment-file-syntax.yaml');
writeFileSync(cmtSyntax, '# yamllint disable-file\na: [1, 2\n');
const cmtSyntaxBare = resolve(fixtures, 'lever-comment-file-syntax-bare.yaml');
writeFileSync(cmtSyntaxBare, '---\na: [1, 2\n');   // 陽性対照: コメント無しなら鳴るか

const def = '{extends: default}';
const leverComment = {
  // ブロック: disable〜enable の内側だけ黙り、外側は鳴る
  blockInsideSilenced: !lintAll(def, cmtBlock).some((h) => h.rule === 'colons' && h.line < 5),
  blockOutsideStillCaught: lintAll(def, cmtBlock).some((h) => h.rule === 'colons' && h.line >= 5),
  // 行: その行だけ黙り、次の行は鳴る
  lineSilenced: !lintAll(def, cmtLine).some((h) => h.rule === 'colons' && h.line === 2),
  lineNextStillCaught: lintAll(def, cmtLine).some((h) => h.rule === 'colons' && h.line === 3),
  // ファイル: 全部黙る
  fileAllSilenced: lintAll(def, cmtFile).length === 0,
  fileExitCode: exitCode(def, cmtFile),
  // 🔴 構文エラーまで黙るか（陽性対照つき）
  fileSilencesSyntaxError: lintAll(def, cmtSyntax).length === 0,
  syntaxErrorCaughtWithoutComment: lintAll(def, cmtSyntaxBare).some((h) => h.rule === 'syntax'),
};

// M6: `truthy` × GitHub Actions の `on:`（本家 Issue #430 の土俵）
const ci = resolve(fixtures, 'lever-actions-on.yaml');
writeFileSync(ci, '---\nname: ci\non: [push]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n');
const ciHits = lintAll(def, ci);
const truthyOnActions = {
  detected: ciHits.some((h) => h.rule === 'truthy'),
  level: ciHits.find((h) => h.rule === 'truthy')?.level ?? null,
  exitCodeDefault: exitCode(def, ci),
  exitCodeAsError: exitCode('{extends: default, rules: {truthy: {level: error}}}', ci),
};

// M7: `truthy` を黙らせる 2 手段の射程差（記事 sec03 の 🔍 が比べている当のもの）と、
//     警告をまとめて失敗扱いにする `-s`（記事 sec02）。いずれも突合の外に置かない。
//     材料はキー側（`on:` / `yes:`）と値側（`DEBUG: yes`）を 1 ファイルに同居させ、
//     「キーだけ外す」と「語だけ許す」の差が出る形にする。
const truthyMix = resolve(fixtures, 'lever-truthy-mix.yaml');
writeFileSync(truthyMix, '---\nname: ci\non: [push]\nyes: 1\nDEBUG: yes\n');
const allowOn = "{extends: default, rules: {truthy: {allowed-values: ['true', 'false', 'on']}}}";
const checkKeysOff = '{extends: default, rules: {truthy: {check-keys: false}}}';
const truthyLineHit = (cfg, line) =>
  lintAll(cfg, truthyMix).some((h) => h.rule === 'truthy' && h.line === line);

const truthySilencing = {
  // 陽性対照: 既定ではキー 2 件（`on:` 3 行目 / `yes:` 4 行目）と値 1 件（5 行目）が鳴る
  defaultKeyOnCaught: truthyLineHit(def, 3),
  defaultKeyYesCaught: truthyLineHit(def, 4),
  defaultValueCaught: truthyLineHit(def, 5),
  // allowed-values に `on` を足す: `on` という語だけが静かになる
  allowedValuesOnSilenced: !truthyLineHit(allowOn, 3),
  allowedValuesKeyYesStillCaught: truthyLineHit(allowOn, 4),
  allowedValuesValueStillCaught: truthyLineHit(allowOn, 5),
  // check-keys: false: キーであれば何でも静かになる（= 開く範囲が広い）
  checkKeysOffOnSilenced: !truthyLineHit(checkKeysOff, 3),
  checkKeysOffKeyYesSilenced: !truthyLineHit(checkKeysOff, 4),
  checkKeysOffValueStillCaught: truthyLineHit(checkKeysOff, 5),
};

// M8: `-s`（--strict）は警告だけでも終了コードを変える（記事 sec02 の A-1）
const strictExit = {
  default: exitCode(def, ci),
  strict: exitCode(def, ci, ['-s']),
};

const summary = {
  scenario: '004-lint-rules',
  measuredAt: new Date().toISOString(),
  platform: `${process.platform} ${process.arch}`,
  toolVersions,
  rulesTotal: details.length,
  // 用意した YAML が、そのルール単独でちゃんと違反しているか（fixture の健全性）
  singleRuleUndetected: details.filter((d) => !d.singleDetected).map((d) => d.rule),
  // extends: default で拾われるルール / 拾われないルール
  defaultCaught: details.filter((d) => d.defaultDetected).map((d) => d.rule),
  defaultMissed: details.filter((d) => !d.defaultDetected).map((d) => d.rule),
  defaultWarningRules: details.filter((d) => d.defaultLevel === 'warning').map((d) => d.rule),
  defaultErrorRules: details.filter((d) => d.defaultLevel === 'error').map((d) => d.rule),
  // M1（C 条件）: そのルールを既定から落としたとき、fixture 全体で何も鳴らなくなるルール
  droppedFullySilent: details.filter((d) => d.droppedFullySilent).map((d) => d.rule),
  // 落としても別のルールが鳴るルール（＝「落としたら通る」と書いてはいけない）
  droppedStillCaught: details.filter((d) => !d.droppedFullySilent).map((d) => d.rule),
  // 🔴 突合は平坦なキーでしか効かない（check-provenance はネストを配列として読めない）。
  //    記事へ載せる値は必ずこの平坦キー側に置く。
  leverIgnoreTargetSilenced: leverIgnore.targetSilenced,
  leverIgnoreOtherStillCaught: leverIgnore.otherStillCaught,
  leverCommentBlockInsideSilenced: leverComment.blockInsideSilenced,
  leverCommentBlockOutsideStillCaught: leverComment.blockOutsideStillCaught,
  leverCommentLineSilenced: leverComment.lineSilenced,
  leverCommentLineNextStillCaught: leverComment.lineNextStillCaught,
  leverCommentFileAllSilenced: leverComment.fileAllSilenced,
  leverCommentFileExitCode: leverComment.fileExitCode,
  leverCommentFileSilencesSyntaxError: leverComment.fileSilencesSyntaxError,
  leverCommentSyntaxCaughtWithoutComment: leverComment.syntaxErrorCaughtWithoutComment,
  truthyOnActionsDetected: truthyOnActions.detected,
  truthyOnActionsLevel: truthyOnActions.level,
  truthyOnActionsExitCodeDefault: truthyOnActions.exitCodeDefault,
  truthyOnActionsExitCodeAsError: truthyOnActions.exitCodeAsError,
  truthyOnActionsExitCodeStrict: strictExit.strict,
  truthyDefaultKeyOnCaught: truthySilencing.defaultKeyOnCaught,
  truthyDefaultKeyYesCaught: truthySilencing.defaultKeyYesCaught,
  truthyDefaultValueCaught: truthySilencing.defaultValueCaught,
  truthyAllowedValuesOnSilenced: truthySilencing.allowedValuesOnSilenced,
  truthyAllowedValuesKeyYesStillCaught: truthySilencing.allowedValuesKeyYesStillCaught,
  truthyAllowedValuesValueStillCaught: truthySilencing.allowedValuesValueStillCaught,
  truthyCheckKeysOffOnSilenced: truthySilencing.checkKeysOffOnSilenced,
  truthyCheckKeysOffKeyYesSilenced: truthySilencing.checkKeysOffKeyYesSilenced,
  truthyCheckKeysOffValueStillCaught: truthySilencing.checkKeysOffValueStillCaught,
  truthySilencing,
  strictExit,
  leverIgnore,
  leverComment,
  truthyOnActions,
  details,
};

writeFileSync(resolve(results, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`ルール ${summary.rulesTotal} 件を測りました（${toolVersions}）`);
console.log(`  既定で拾う   : ${summary.defaultCaught.length} 件`);
console.log(`  既定で見逃す : ${summary.defaultMissed.length} 件 → ${summary.defaultMissed.join(', ')}`);
console.log(`  既定が警告止まり: ${summary.defaultWarningRules.length} 件 → ${summary.defaultWarningRules.join(', ')}`);
if (summary.singleRuleUndetected.length) {
  console.log(`⚠️ 単独有効でも違反しなかった fixture: ${summary.singleRuleUndetected.join(', ')}`);
}
console.log(`  落とすと全く鳴らなくなる: ${summary.droppedFullySilent.length} 件 → ${summary.droppedFullySilent.join(', ') || '（なし）'}`);
console.log(`  落としても別が鳴る      : ${summary.droppedStillCaught.length} 件 → ${summary.droppedStillCaught.join(', ') || '（なし）'}`);
console.log(`  ignore: 対象 ${leverIgnore.targetSilenced ? '黙る' : '鳴る'} / 対象外 ${leverIgnore.otherStillCaught ? '鳴る' : '黙る'}`);
console.log(`  disable-file が構文エラーを黙らせる: ${leverComment.fileSilencesSyntaxError}（コメント無しでは ${leverComment.syntaxErrorCaughtWithoutComment ? '鳴る' : '鳴らない'}）`);
console.log(`  truthy × Actions on: 検出=${truthyOnActions.detected} level=${truthyOnActions.level} rc(既定)=${truthyOnActions.exitCodeDefault} rc(error)=${truthyOnActions.exitCodeAsError}`);
console.log(`  -s（strict）: rc(既定)=${strictExit.default} → rc(-s)=${strictExit.strict}`);
console.log(`  allowed-values: on=${truthySilencing.allowedValuesOnSilenced ? '黙る' : '鳴る'} / キー yes=${truthySilencing.allowedValuesKeyYesStillCaught ? '鳴る' : '黙る'} / 値=${truthySilencing.allowedValuesValueStillCaught ? '鳴る' : '黙る'}`);
console.log(`  check-keys:false: on=${truthySilencing.checkKeysOffOnSilenced ? '黙る' : '鳴る'} / キー yes=${truthySilencing.checkKeysOffKeyYesSilenced ? '黙る' : '鳴る'} / 値=${truthySilencing.checkKeysOffValueStillCaught ? '鳴る' : '黙る'}`);
