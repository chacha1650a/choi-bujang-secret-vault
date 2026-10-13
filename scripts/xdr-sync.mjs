import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// XDR 보너스: xdr/<moduleKey>/patterns.json 의 패턴을 xdr/<moduleKey>/decide.mjs 맨 위 상수로 옮겨 적습니다.
// 심판은 인터넷 없이 decide.mjs 한 파일만 불러오므로, 만든 decide.mjs 에는 import 문이 없고 파일을 읽거나 쓰지 않습니다.
// 사용법: npm run xdr:sync (패턴을 고친 뒤 다시 실행합니다. --check 는 decide.mjs 가 patterns.json 과 같은지만 봅니다.)
export const MODULE_KEYS = ['brute-force', 'web-injection', 'known-cve', 'persistence', 'privilege', 'exfiltration'];
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const ENGINE = String.raw`
// 경보 값 꺼내기: 'data.count' 처럼 점으로 이어진 경로를 따라갑니다.
function valueAt(alert, path) {
  return String(path).split('.').reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), alert);
}
function toNumber(value) {
  if (typeof value === 'number') return value;
  return typeof value === 'string' && /^\s*\d+(\.\d+)?\s*$/u.test(value) ? Number(value) : Number.NaN;
}
function listLength(value) {
  if (Array.isArray(value)) return value.length;
  return typeof value === 'string' ? value.split(',').filter((item) => item.trim()).length : 0;
}
const REGEX = new Map();
function regexOf(source) {
  if (!REGEX.has(source)) REGEX.set(source, new RegExp(source, 'iu'));
  return REGEX.get(source);
}

// 패턴의 찾는 조건(when)을 경보에 맞춰 봅니다. all·any·not 과 필드 조건(regex·gte·listGte·includesAny·exists)만 씁니다.
function matches(cond, alert) {
  if (!cond || typeof cond !== 'object') return false;
  if (Array.isArray(cond.all)) return cond.all.every((item) => matches(item, alert));
  if (Array.isArray(cond.any)) return cond.any.some((item) => matches(item, alert));
  if (cond.not) return !matches(cond.not, alert);
  const fields = Array.isArray(cond.fields) ? cond.fields : [cond.field];
  return fields.some((field) => {
    const value = valueAt(alert, field);
    if (typeof cond.regex === 'string') {
      return (typeof value === 'string' || typeof value === 'number') && regexOf(cond.regex).test(String(value));
    }
    if (typeof cond.gte === 'number') return toNumber(value) >= cond.gte;
    if (typeof cond.listGte === 'number') return listLength(value) >= cond.listGte;
    if (Array.isArray(cond.includesAny)) return Array.isArray(value) && value.some((item) => cond.includesAny.includes(item));
    if (cond.exists === true) return value !== undefined && value !== null && String(value).trim() !== '';
    return false;
  });
}

// 확신도: 경보가 패턴과 얼마나 뚜렷하게 맞는지를 0~1 로 매깁니다.
// - strong(뚜렷한 공격 형태): Wazuh 수준 10 이상이면 0.88~0.98, 수준이 낮으면 사람 확인이 필요해 0.6~0.78
// - medium(공격 조각·한 번뿐인 시도): 수준 5 이상이면 0.6~0.8, 수준이 낮으면 0.3
// - weak(Wazuh 가 이 공격 기법으로 분류한 사건): 수준 5 이상이면 0.5~0.58
// - 맞는 패턴 없음: 0.02~0.3
function confidenceOf(tier, level) {
  const lv = Number.isFinite(level) ? level : 0;
  if (tier === 'strong') return lv >= 10 ? Math.min(0.98, 0.88 + 0.02 * (lv - 10)) : lv >= 5 ? 0.78 : 0.6;
  if (tier === 'medium') return lv >= 5 ? Math.min(0.8, 0.6 + 0.04 * (lv - 5)) : 0.3;
  if (tier === 'weak') return lv >= 5 ? 0.5 + 0.02 * Math.min(lv - 5, 4) : 0.2;
  return Math.min(0.3, 0.02 + 0.03 * Math.max(0, lv));
}

const TIER_RANK = { strong: 3, medium: 2, weak: 1 };

export function decide(alert) {
  if (!alert || typeof alert !== 'object') return { action: 'record', confidence: 0, reason: '경보 형식이 아니라 기록만 합니다' };
  const level = toNumber(alert.rule?.level);
  let best = null;
  const hits = [];
  for (const pattern of PATTERNS) {
    let hit = false;
    try { hit = matches(pattern.when, alert); } catch { hit = false; }
    if (!hit) continue;
    hits.push(pattern);
    if (!best || TIER_RANK[pattern.tier] > TIER_RANK[best.tier]) best = pattern;
  }
  const confidence = Math.round(confidenceOf(best?.tier, level) * 100) / 100;
  const action = confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record';
  const names = hits.filter((pattern) => pattern.tier === best?.tier).map((pattern) => pattern.name);
  const levelText = Number.isFinite(level) ? ' · Wazuh 수준 ' + level : '';
  const reason = names.length ? names.join(', ') + levelText : '맞는 공격 패턴 없음' + levelText;
  return { action, confidence, reason };
}
`;

export function renderDecide(spec) {
  const head = [
    `// XDR 보너스 「${spec.moduleKey}」 판단 모듈입니다(학생 작성). 제공 엔진(ALEPH SDP 엔진)의 판정기를 대신하지 않고, 확인 단계 하나를 더하는 부품입니다.`,
    '// 심판은 인터넷 없이 이 파일 하나만 불러와 경보마다 decide(alert) 를 부릅니다. 그래서 import 가 없고, 파일을 읽거나 쓰지 않으며, 바깥에 묻지 않습니다.',
    `// 아래 PATTERNS 는 xdr/${spec.moduleKey}/patterns.json 을 그대로 옮겨 적은 상수입니다(npm run xdr:sync). 패턴을 고칠 때는 patterns.json 을 고친 뒤 다시 옮깁니다.`,
    '// 반환: { action: block(확신도 0.85 이상) | alert(0.5 이상) | record(그 아래), confidence, reason(근거 패턴 이름) }',
    '',
    `export const MODULE_KEY = ${JSON.stringify(spec.moduleKey)};`,
    `export const MITRE = Object.freeze(${JSON.stringify(spec.mitre)});`,
    `export const PATTERNS = Object.freeze(${JSON.stringify(spec.patterns, null, 2)});`,
  ].join('\n');
  return `${head}\n${ENGINE}`;
}

export async function syncModule(moduleKey, { check = false } = {}) {
  const spec = JSON.parse(await readFile(join(root, 'xdr', moduleKey, 'patterns.json'), 'utf8'));
  if (spec.schema !== 'aleph.xdr.patterns.v1' || spec.moduleKey !== moduleKey || !Array.isArray(spec.patterns)) {
    throw new Error(`${moduleKey}: patterns.json 형식이 아닙니다.`);
  }
  for (const pattern of spec.patterns) {
    for (const key of ['id', 'name', 'tier', 'condition', 'evidence']) {
      if (typeof pattern[key] !== 'string' || !pattern[key].trim()) throw new Error(`${moduleKey}: 패턴 ${pattern.id ?? '?'} 에 ${key} 가 없습니다.`);
    }
    if (!['strong', 'medium', 'weak'].includes(pattern.tier)) throw new Error(`${moduleKey}: 패턴 ${pattern.id} 의 tier 가 틀렸습니다.`);
  }
  const target = join(root, 'xdr', moduleKey, 'decide.mjs');
  const text = renderDecide(spec);
  if (check) {
    const current = await readFile(target, 'utf8').catch(() => '');
    return current.replace(/\r\n/gu, '\n') === text;
  }
  await writeFile(target, text, 'utf8');
  return true;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const check = process.argv.includes('--check');
  const keys = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  let ok = true;
  for (const moduleKey of keys.length ? keys : MODULE_KEYS) {
    const same = await syncModule(moduleKey, { check });
    if (check && !same) { ok = false; console.error(`${moduleKey}: decide.mjs 가 patterns.json 과 다릅니다. npm run xdr:sync 를 실행하세요.`); }
    if (!check) console.log(`${moduleKey}: decide.mjs 에 패턴 ${JSON.parse(await readFile(join(root, 'xdr', moduleKey, 'patterns.json'), 'utf8')).patterns.length}개를 옮겨 적었습니다.`);
  }
  if (!ok) process.exitCode = 1;
}
