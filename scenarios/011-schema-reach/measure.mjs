// 011-schema-reach — lint（字面）と JSON Schema（構造）の射程を測り分ける。
//
// 🔴 陽性対照を必ず置く。「yamllint が構造の壊れを 0 件で通す」だけを測ると
//    「lint が動いていない」と読めてしまう。別の題材で yamllint が実際に鳴ることを
//    先に示して初めて「動いているが対象外」が確定する。
//    （knowledge/thinking-patterns.md「2 つのツールの射程は重なりを実測してから語る」）
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(here, 'fixtures');
const results = resolve(here, 'results');
mkdirSync(fixtures, { recursive: true });
mkdirSync(results, { recursive: true });

/** コマンドを走らせ、終了コードと標準出力・標準エラーを返す。 */
function run(cmd, args) {
  try {
    const out = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

const yamllint = (file) => run('yamllint', ['-d', '{extends: default}', '-f', 'parsable', file]);
const schema = (file, ...extra) =>
  run('check-jsonschema', ['--schemafile', resolve(fixtures, 'app-schema.json'), ...extra, file]);

// --- スキーマ（lint が届かない範囲を受け持つ側）------------------------------
writeFileSync(
  resolve(fixtures, 'app-schema.json'),
  `${JSON.stringify(
    {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      additionalProperties: false,
      required: ['name', 'replicas', 'environment', 'admin_email'],
      properties: {
        name: { type: 'string' },
        replicas: { type: 'integer' },
        environment: { type: 'string', enum: ['dev', 'stg', 'prod'] },
        admin_email: { type: 'string', format: 'email' },
      },
    },
    null,
    2,
  )}\n`,
);

// --- 2 × 2 の題材 ------------------------------------------------------------
// A: 字面を壊した（行末空白・コロン前の空白）が、構造としては正しい
const styleBroken = resolve(fixtures, 'style-broken.yaml');
writeFileSync(
  styleBroken,
  '---\nname : app  \nreplicas: 3\nenvironment: prod\nadmin_email: ops@example.com\n',
);
// B: 字面は整っているが、構造が壊れている（型違い・enum 外・綴り間違い・format 違反）
const structureBroken = resolve(fixtures, 'structure-broken.yaml');
writeFileSync(
  structureBroken,
  '---\nname: app\nreplicas: "3"\nenvironment: production\nrelicas: 3\nadmin_email: not-an-email\n',
);

const cell = (label, file, tool) => {
  const r = tool === 'yamllint' ? yamllint(file) : schema(file);
  const hits =
    tool === 'yamllint'
      ? r.out.split('\n').filter((l) => /\[(warning|error)\]/.test(l)).length
      : r.code === 0
        ? 0
        : 1; // check-jsonschema は件数を機械可読に出さないため「弾いたか」で数える
  return { label, tool, exitCode: r.code, caught: hits > 0 };
};

const matrix = [
  cell('字面を壊した', styleBroken, 'yamllint'),
  cell('字面を壊した', styleBroken, 'check-jsonschema'),
  cell('構造を壊した', structureBroken, 'yamllint'),
  cell('構造を壊した', structureBroken, 'check-jsonschema'),
];

// --- M4: schema の 3 キーワードを個別に測る ----------------------------------
const one = (name, body) => {
  const f = resolve(fixtures, `${name}.yaml`);
  writeFileSync(f, body);
  return f;
};
const base = 'name: app\nreplicas: 3\nenvironment: prod\nadmin_email: ops@example.com\n';
const fRequired = one('only-required', '---\nname: app\nreplicas: 3\nenvironment: prod\n');
const fAdditional = one('only-additional', `---\n${base}relicas: 3\n`);
const fFormat = one('only-format', `---\n${base.replace('ops@example.com', 'not-an-email')}`);
const fType = one('only-type', `---\n${base.replace('replicas: 3', 'replicas: "3"')}`);
const fEnum = one('only-enum', `---\n${base.replace('environment: prod', 'environment: production')}`);
const fOk = one('valid', `---\n${base}`);

const keywords = {
  valid: schema(fOk).code,
  required: schema(fRequired).code,
  additionalProperties: schema(fAdditional).code,
  type: schema(fType).code,
  enum: schema(fEnum).code,
  // 🔴 format は既定で検証されるか。
  format: schema(fFormat).code,
  // 🔴 `--disable-formats` は「値を取るオプション」で、素のフラグではない。
  //    引数なしで書くと後続のファイル名を値として食い、rc=2（使い方の誤り）になる。
  formatDisableAll: schema(fFormat, '--disable-formats', '*').code,
  formatDisableEmailOnly: schema(fFormat, '--disable-formats', 'email').code,
  formatDisableBareFlag: schema(fFormat, '--disable-formats').code,
};

// --- M4b: 4 形式それぞれを、通る値と落ちる値の対で測る ---------------------
// 1 形式だけ測って残りも同じだと決めると、既定で検証される範囲を取り違える。
const FORMATS = [
  { name: 'email', good: 'ops@example.com', bad: 'not-an-email' },
  { name: 'date', good: '2026-09-05', bad: '2026-13-45' },
  { name: 'ipv4', good: '192.0.2.1', bad: '999.1.1.1' },
  { name: 'uuid', good: '123e4567-e89b-12d3-a456-426614174000', bad: 'not-a-uuid' },
];
const formatChecks = {};
for (const f of FORMATS) {
  const schemaFile = resolve(fixtures, `format-${f.name}-schema.json`);
  writeFileSync(
    schemaFile,
    `${JSON.stringify(
      { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', properties: { v: { type: 'string', format: f.name } } },
      null,
      2,
    )}\n`,
  );
  const goodFile = one(`format-${f.name}-good`, `---\nv: "${f.good}"\n`);
  const badFile = one(`format-${f.name}-bad`, `---\nv: "${f.bad}"\n`);
  const s2 = (file, ...extra) => run('check-jsonschema', ['--schemafile', schemaFile, ...extra, file]);
  formatChecks[f.name] = {
    valid: s2(goodFile).code,          // 正しい値は通るか（陽性対照の裏返し）
    invalid: s2(badFile).code,         // 誤った値は弾かれるか
    disabled: s2(badFile, '--disable-formats', f.name).code, // その形式だけ無効化したら通るか
  };
}

// 🔴 突合は `,` で値を分割するため、版文字列にカンマを残さない。
//    check-jsonschema --version は "check-jsonschema, version 0.38.0" と返すので正規化する。
const cjsVersion = run('check-jsonschema', ['--version']).out.trim().replace(/,\s*version\s*/, ' ');
const toolVersions = [run('yamllint', ['--version']).out.trim(), cjsVersion].join(' / ');

const summary = {
  scenario: '011-schema-reach',
  measuredAt: new Date().toISOString(),
  platform: `${process.platform} ${process.arch}`,
  toolVersions,
  // 2 × 2 のうち、その道具が捕まえた組み合わせ
  caughtCells: matrix.filter((m) => m.caught).map((m) => `${m.label}×${m.tool}`),
  missedCells: matrix.filter((m) => !m.caught).map((m) => `${m.label}×${m.tool}`),
  // 陽性対照が立っているか（字面 → yamllint が鳴る / 構造 → schema が鳴る）
  positiveControlsHold:
    matrix.find((m) => m.label === '字面を壊した' && m.tool === 'yamllint').caught &&
    matrix.find((m) => m.label === '構造を壊した' && m.tool === 'check-jsonschema').caught,
  // 🔴 突合は平坦なキーでしか効かない。記事へ載せる値はこちらに置く。
  schemaRcValid: keywords.valid,
  schemaRcRequired: keywords.required,
  schemaRcAdditionalProperties: keywords.additionalProperties,
  schemaRcType: keywords.type,
  schemaRcEnum: keywords.enum,
  schemaRcFormat: keywords.format,
  schemaRcFormatDisableAll: keywords.formatDisableAll,
  schemaRcFormatDisableEmailOnly: keywords.formatDisableEmailOnly,
  // 🔴 素のフラグとして書くと後続のファイル名を値として食い、使い方の誤り（2）になる
  schemaRcFormatDisableBareFlag: keywords.formatDisableBareFlag,
  schemaExitCodes: keywords,
  // 既定で検証される format（誤った値が rc=1 で弾かれるもの）
  formatsCheckedByDefault: Object.entries(formatChecks).filter(([, v]) => v.invalid === 1).map(([k]) => k),
  // その形式だけ無効化すると通るもの
  formatsSilencedIndividually: Object.entries(formatChecks).filter(([, v]) => v.disabled === 0).map(([k]) => k),
  formatChecks,
  matrix,
};

writeFileSync(resolve(results, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`射程を測りました（${toolVersions}）`);
for (const m of matrix) console.log(`  ${m.label} × ${m.tool.padEnd(17)} → ${m.caught ? '捕まえた' : '通した'}（rc=${m.exitCode}）`);
console.log(`  陽性対照: ${summary.positiveControlsHold ? '立っている' : '🔴 立っていない'}`);
console.log(`  schema rc: ${JSON.stringify(keywords)}`);
console.log(`  既定で検証される format: ${summary.formatsCheckedByDefault.join(', ') || '（なし）'}`);
console.log(`  個別無効化で通る format: ${summary.formatsSilencedIndividually.join(', ') || '（なし）'}`);
