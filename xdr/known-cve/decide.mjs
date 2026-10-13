// XDR 보너스 「known-cve」 판단 모듈입니다(학생 작성). 제공 엔진(ALEPH SDP 엔진)의 판정기를 대신하지 않고, 확인 단계 하나를 더하는 부품입니다.
// 심판은 인터넷 없이 이 파일 하나만 불러와 경보마다 decide(alert) 를 부릅니다. 그래서 import 가 없고, 파일을 읽거나 쓰지 않으며, 바깥에 묻지 않습니다.
// 아래 PATTERNS 는 xdr/known-cve/patterns.json 을 그대로 옮겨 적은 상수입니다(npm run xdr:sync). 패턴을 고칠 때는 patterns.json 을 고친 뒤 다시 옮깁니다.
// 반환: { action: block(확신도 0.85 이상) | alert(0.5 이상) | record(그 아래), confidence, reason(근거 패턴 이름) }

export const MODULE_KEY = "known-cve";
export const MITRE = Object.freeze(["T1190"]);
export const PATTERNS = Object.freeze([
  {
    "id": "kc-jndi-lookup",
    "name": "원격 조회 구문(CVE-2021-44228 형태)",
    "tier": "strong",
    "condition": "요청 머리글이나 인자에 완전한 원격 조회 구문(${jndi:프로토콜:...} 또는 중첩 표기)이 있음",
    "evidence": "CVE-2021-44228(Log4Shell)·MITRE ATT&CK T1190: 로그에 남는 값의 원격 조회 구문으로 서버가 바깥 코드를 불러오게 하는 공격",
    "when": {
      "fields": [
        "data.url",
        "data.useragent",
        "data.header",
        "data.referer"
      ],
      "regex": "\\$\\{\\s*jndi\\s*:\\s*(ldaps?|rmi|dns|iiop|nis|nds|corba|https?)\\s*:|\\$\\{[^\\s]{0,60}\\$\\{(lower|upper|env|sys|::-)[^}]*\\}"
    }
  },
  {
    "id": "kc-cve-trace",
    "name": "취약점 이름·조회 단어·점검 도구 흔적만 있음",
    "tier": "medium",
    "condition": "취약점 번호·jndi·log4j·lookup 같은 단어나 점검 도구 이름은 있지만 완전한 조회 구문은 없음",
    "evidence": "CVE-2021-44228·MITRE ATT&CK T1190: 취약점 이름 검색·문서 열람·점검 도구 흔적은 정찰일 수도 수업일 수도 있어 사람이 확인해야 함",
    "when": {
      "any": [
        {
          "fields": [
            "data.url",
            "data.useragent"
          ],
          "regex": "\\bcve\\b|cve-\\d{4}|\\bjndi\\b|jndi-|log4j|log4shell|lookup|\\$\\{|nuclei|nikto|sqlmap|masscan|zgrab|acunetix|nessus|openvas"
        },
        {
          "field": "rule.description",
          "regex": "CVE-|jndi|조회 형태|중괄호|점검 도구|라이브러리|취약점 (목록|이름)"
        }
      ]
    }
  },
  {
    "id": "kc-wazuh-level",
    "name": "Wazuh 알려진 취약점 경보 등급",
    "tier": "weak",
    "condition": "Wazuh 규칙 수준 5 이상이고 rule.mitre 에 T1190 이 붙음",
    "evidence": "Wazuh 규칙 수준(rule.level)과 MITRE ATT&CK T1190 표시: 경보 원천이 공개 앱 취약점 악용 시도로 분류한 사건",
    "when": {
      "all": [
        {
          "field": "rule.level",
          "gte": 5
        },
        {
          "field": "rule.mitre",
          "includesAny": [
            "T1190"
          ]
        }
      ]
    }
  }
]);

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
