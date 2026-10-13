import { createHash } from 'node:crypto';

// 10단계: 안전 정책 사본 검증·비교·되돌리기의 순수 함수입니다. 파일을 읽거나 쓰지 않습니다.
// 시험 정책 = aleph.config.json의 allowedRoutes(경로·구역 표) + src/decider.mjs의 RULE_IDS(규칙 이름).
export const routeKey = (r) => `${r.service} ${r.method} ${r.pathPattern}`;
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
