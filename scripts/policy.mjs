import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 10단계: 침해 전에 검증한 안전 정책 사본(policy/verified-policy.json)과 지금 시험 정책을 비교하고 되돌립니다.
// 시험 정책 = aleph.config.json의 allowedRoutes(경로·구역 표) + src/decider.mjs의 RULE_IDS(규칙 이름).
// 실제 운영 정책(반 엔진·Supabase)은 건드리지 않습니다. 비밀값은 읽지도 쓰지도 않습니다.

const root = resolve(import.meta.dirname, '..');
const SNAPSHOT = join(root, 'policy', 'verified-policy.json');
const AUDIT = join(root, 'policy', 'audit.jsonl');
const CONFIG = join(root, 'aleph.config.json');

const routeKey = (r) => `${r.service} ${r.method} ${r.pathPattern}`;
const sortRoutes = (routes) => [...routes].map((r) => ({
  service: r.service, method: r.method, pathPattern: r.pathPattern, zone: r.zone,
})).sort((a, b) => routeKey(a).localeCompare(routeKey(b)));
const canonical = (policy) => JSON.stringify({
  policyRevision: policy.policyRevision, rules: [...policy.rules].sort(), routes: sortRoutes(policy.routes),
});
export const policyHash = (policy) => createHash('sha256').update(canonical(policy), 'utf8').digest('hex');

export function currentPolicy(config, ruleIds, policyRevision) {
  return { policyRevision, rules: [...ruleIds], routes: sortRoutes(config.allowedRoutes ?? []) };
}

// 사본을 읽어 검증합니다. 없거나, 형식이 틀리거나, 해시가 맞지 않으면 예외로 멈춥니다.
export function verifySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || !Number.isInteger(snapshot.policyRevision)
      || !Array.isArray(snapshot.rules) || !Array.isArray(snapshot.routes)
      || typeof snapshot.sha256 !== 'string') {
    throw new Error('검증한 정책 사본의 형식이 틀려 중단합니다.');
  }
  if (policyHash(snapshot) !== snapshot.sha256) throw new Error('정책 사본 해시가 맞지 않아 중단합니다.');
  return snapshot;
}

// 사본과 지금 정책의 차이만 돌려줍니다. 사본에 없는 서비스의 경로는 비교·복원 대상이 아닙니다.
export function diffPolicy(snapshot, current) {
  const services = new Set(snapshot.routes.map((r) => r.service));
  const want = new Map(snapshot.routes.map((r) => [routeKey(r), r]));
  const have = new Map(current.routes.filter((r) => services.has(r.service)).map((r) => [routeKey(r), r]));
  const routes = [];
  for (const [key, r] of want) {
    if (!have.has(key)) routes.push({ change: 'add', ...r });
    else if (have.get(key).zone !== r.zone) routes.push({ change: 'zone', ...r, from: have.get(key).zone });
  }
  for (const [key, r] of have) if (!want.has(key)) routes.push({ change: 'remove', ...r });
  const rules = {
    missing: snapshot.rules.filter((id) => !current.rules.includes(id)),
    extra: current.rules.filter((id) => !snapshot.rules.includes(id)),
  };
  return { policyRevision: snapshot.policyRevision, routes, rules,
    clean: routes.length === 0 && rules.missing.length === 0 && rules.extra.length === 0 };
}

// 경로 표만 사본대로 되돌립니다. 사본에 없는 서비스의 경로는 그대로 둡니다.
// 규칙 이름(RULE_IDS)이 다르면 코드 변경이므로 자동으로 고치지 않고 멈춥니다(git으로 되돌립니다).
export function restoreRoutes(config, snapshot) {
  const services = new Set(snapshot.routes.map((r) => r.service));
  const kept = (config.allowedRoutes ?? []).filter((r) => !services.has(r.service));
  return { ...config, allowedRoutes: [...sortRoutes(snapshot.routes), ...kept] };
}

async function loadCurrent() {
  const config = JSON.parse(readFileSync(CONFIG, 'utf8'));
  const { RULE_IDS } = await import(pathToFileURL(join(root, 'src', 'decider.mjs')).href);
  return { config, ruleIds: RULE_IDS };
}

function printDiff(diff) {
  process.stdout.write(`복원할 정책 버전: ${diff.policyRevision}\n`);
  if (diff.clean) { process.stdout.write('차이 없음: 지금 시험 정책이 검증한 사본과 같습니다.\n'); return; }
  for (const r of diff.routes) {
    const label = { add: '되살릴 경로', remove: '지울 경로', zone: '구역 바꿀 경로' }[r.change];
    process.stdout.write(`- ${label}: ${r.service} ${r.method} ${r.pathPattern} (구역 ${r.zone}${r.from ? `, 지금 ${r.from}` : ''})\n`);
  }
  if (diff.rules.missing.length) process.stdout.write(`- 빠진 규칙: ${diff.rules.missing.join(', ')}\n`);
  if (diff.rules.extra.length) process.stdout.write(`- 사본에 없는 규칙: ${diff.rules.extra.join(', ')}\n`);
}

async function main(command, args) {
  const { config, ruleIds } = await loadCurrent();
  if (command === 'snapshot') {
    if (existsSync(SNAPSHOT)) throw new Error('검증한 정책 사본이 이미 있습니다. 덮어쓰지 않습니다.');
    const policy = currentPolicy(config, ruleIds, Number(args[0] ?? 1));
    writeFileSync(SNAPSHOT, `${JSON.stringify({ ...policy, sha256: policyHash(policy) }, null, 2)}\n`);
    process.stdout.write(`정책 사본을 만들었습니다: 버전 ${policy.policyRevision}\n`);
    return;
  }
  if (!existsSync(SNAPSHOT)) throw new Error('검증한 정책 사본이 없어 중단합니다.');
  const snapshot = verifySnapshot(JSON.parse(readFileSync(SNAPSHOT, 'utf8')));
  const diff = diffPolicy(snapshot, currentPolicy(config, ruleIds, snapshot.policyRevision));
  printDiff(diff);
  if (command === 'diff') return;
  if (command !== 'restore') throw new Error('명령은 snapshot, diff, restore 중 하나입니다.');
  if (diff.clean) return;
  if (diff.rules.missing.length || diff.rules.extra.length) {
    throw new Error('판정기 규칙 이름이 사본과 달라 자동 복원을 멈춥니다. git으로 src/decider.mjs를 되돌린 뒤 다시 실행하세요.');
  }
  if (!args.includes('--apply')) {
    process.stdout.write('위 항목만 바뀝니다. 적용하려면 npm run policy:restore -- --apply 를 실행하세요.\n');
    return;
  }
  writeFileSync(CONFIG, `${JSON.stringify(restoreRoutes(config, snapshot), null, 2)}\n`);
  // 감사 기록은 덧붙이기만 합니다.
  appendFileSync(AUDIT, `${JSON.stringify({ at: new Date().toISOString(), action: 'policy_restore',
    policyRevision: snapshot.policyRevision, sha256: snapshot.sha256, changes: diff.routes.length })}\n`);
  process.stdout.write(`시험 정책 경로 표를 버전 ${snapshot.policyRevision}로 되돌렸습니다. 감사 기록에 한 줄 더했습니다.\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main(process.argv[2], process.argv.slice(3));
  } catch (error) {
    process.stderr.write(`정책 도구 첫 오류: ${error.message}\n`);
    process.exitCode = 1;
  }
}
