// XDR 보너스: 내 ZTNA 판정기에 「XDR 차단 확인」 단계 하나를 더하는 부품입니다(학생 작성).
// - xdr/<moduleKey>/respond.mjs 가 decide 결과 가운데 block 만 골라 거부 규칙(xdr/deny-rules.json)을 만듭니다.
// - 규칙은 바깥 출발 주소 하나만 막고, 만료 시각과 근거 경보 번호를 붙입니다. 계정(사용자)은 막지 않습니다.
// - 판정기(src/decider.mjs)의 기존 규칙과 RULE_IDS 는 고치지 않습니다. 판정 계약(docs/DECIDER_REQUEST.md)에는 출발 주소가 없어서,
//   주소를 아는 쪽(ALEPH SDP 엔진·자료실 서버)이 withXdrGate(decide) 로 감싼 판정기에 sourceIp 를 함께 넘길 때만 이 단계가 적용됩니다.
export const DENY_RULES_SCHEMA = 'aleph.xdr.deny-rules.v1';
export const XDR_RULE_ID = 'xdr_block';
export const XDR_REASON_CODE = 'route_not_allowed';
export const DEFAULT_TTL_MINUTES = 60;
export const MAX_TTL_MINUTES = 24 * 60;

const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`^${OCTET}\\.${OCTET}\\.${OCTET}\\.${OCTET}$`, 'u');

// 정상 사용자를 막지 않으려고 바깥의 한 주소만 규칙으로 만듭니다. 대역·내부·루프백·링크 로컬·멀티캐스트 주소는 거절합니다.
export function isBlockableIp(value) {
  if (typeof value !== 'string' || !IPV4.test(value)) return false;
  const [a, b] = value.split('.').map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  return true;
}

export function clampTtl(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_TTL_MINUTES;
  return Math.min(Math.max(Math.floor(value), 1), MAX_TTL_MINUTES);
}

// items: [{ alertId, srcip, decision }] (decision 은 decide.mjs 의 반환값)
// block 인 경보만 규칙이 되고, 같은 묶음에서 정상(record)으로 판단된 이벤트에 나온 주소는 막지 않습니다.
export function buildDenyRules(moduleKey, items, { now = new Date(), ttlMinutes = DEFAULT_TTL_MINUTES } = {}) {
  const at = now instanceof Date ? now : new Date(now);
  const ttl = clampTtl(ttlMinutes);
  const normal = new Set(items.filter((item) => item.decision?.action === 'record').map((item) => item.srcip));
  const bySource = new Map();
  for (const item of items) {
    if (item.decision?.action !== 'block') continue;
    if (!isBlockableIp(item.srcip) || normal.has(item.srcip)) continue;
    const rule = bySource.get(item.srcip) ?? {
      id: `${XDR_RULE_ID}.${moduleKey}.${item.srcip}`,
      moduleKey, action: 'deny', ruleId: XDR_RULE_ID, sourceIp: item.srcip,
      createdAt: at.toISOString(), expiresAt: new Date(at.getTime() + ttl * 60_000).toISOString(),
      evidenceAlertIds: [], reasons: [],
    };
    if (item.alertId && !rule.evidenceAlertIds.includes(item.alertId)) rule.evidenceAlertIds.push(item.alertId);
    if (item.decision.reason && !rule.reasons.includes(item.decision.reason)) rule.reasons.push(String(item.decision.reason).slice(0, 200));
    bySource.set(item.srcip, rule);
  }
  return [...bySource.values()];
}

// 모듈 하나의 규칙만 바꾸고 다른 모듈의 규칙과 만료되지 않은 규칙은 그대로 둡니다.
export function mergeDenyRules(existing, moduleKey, rules) {
  const kept = (existing?.schema === DENY_RULES_SCHEMA && Array.isArray(existing.rules) ? existing.rules : [])
    .filter((rule) => rule?.moduleKey !== moduleKey);
  return { schema: DENY_RULES_SCHEMA, rules: [...kept, ...rules] };
}

export function activeRule(rules, sourceIp, at = new Date()) {
  const now = (at instanceof Date ? at : new Date(at)).getTime();
  if (typeof sourceIp !== 'string' || !Number.isFinite(now)) return null;
  return (Array.isArray(rules) ? rules : []).find((rule) => rule?.sourceIp === sourceIp && rule.action === 'deny'
    && Date.parse(rule.createdAt) <= now && now < Date.parse(rule.expiresAt)) ?? null;
}

// 판정기 앞에 XDR 차단 확인을 끼웁니다. 막힌 주소면 판정 계약 모양의 deny 를, 아니면 원래 판정기의 답을 그대로 돌려줍니다.
export function withXdrGate(decide, getRules) {
  return async function decideWithXdr(request, context = {}) {
    const rule = activeRule(typeof getRules === 'function' ? getRules() : getRules, context.sourceIp, request?.at ?? new Date());
    if (rule) {
      return { schema: 'aleph.decision.v1', requestId: request?.requestId, decision: 'deny', reasonCode: XDR_REASON_CODE, ruleIds: [XDR_RULE_ID] };
    }
    return decide(request);
  };
}
