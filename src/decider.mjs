// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기입니다.
// 규칙을 하나씩 추가합니다. 규칙에 해당하지 않는 요청은 모두 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['device_registered', 'resource_zone', 'step_up_required']);

// 8단계: 구역별로 허용하는 정확한 경로입니다. 표에 없는 메서드·경로는 모두 거부합니다.
// 경로는 자료 ID 한 칸만 고르고, 쿼리로 기능을 고르지 않습니다. 메모의 소유자는 자료 API가 다시 확인합니다.
// 강사 공지 구역(/notices)은 강사 역할이 이 계약에 없어서 판정기에서는 읽기·수정 모두 허용하지 않습니다.
const SEGMENT = '[A-Za-z0-9_-]{1,64}';
const NOTE_SERVICE = 'notes';
const ZONES = Object.freeze({
  'GET /notes': { zone: 'note', path: /^\/notes$/u },
  'POST /notes': { zone: 'note', path: /^\/notes$/u },
  'GET /notes/:id': { zone: 'note', path: new RegExp(`^/notes/${SEGMENT}$`, 'u') },
  'PUT /notes/:id': { zone: 'note', path: new RegExp(`^/notes/${SEGMENT}$`, 'u') },
  'DELETE /notes/:id': { zone: 'note', path: new RegExp(`^/notes/${SEGMENT}$`, 'u') },
});
const stripApi = (value) => value.replace(/^\/api(?=\/)/u, '');
// :id 자리에 오면 안 되는 기능 이름입니다. 자료 ID가 아니라 다른 구역·여러 사람 자료를 고르는 경로로 봅니다.
const FUNCTION_SEGMENTS = new Set(['export', 'exports', 'download', 'all', 'list', 'search', 'bulk',
  'batch', 'share', 'shared', 'public', 'admin', 'backup', 'dump', 'import', 'sync', 'raw', 'query',
  'count', 'report', 'stats', 'owner', 'owners', 'user', 'users', 'others', 'any', 'notices', 'notes']);
const idOf = (path) => path.split('/')[2];

// 7단계: 평소와 다른 접속의 기준입니다. 새벽 시각, 처음 보는 네트워크, 다른 지역, 짧은 시간의 많은 사건.
const USUAL_REGIONS = new Set(['local', 'unknown']);
const USUAL_NETWORKS = new Set(['usual', 'unknown']);
const UNUSUAL_HOURS = new Set([0, 1, 2, 3, 4, 5]);
const BURST_WINDOW_SECONDS = 600;
const BURST_COUNT = 10;
// 다시 로그인한 지 이 시간 안이어야 추가 확인을 마친 것으로 봅니다.
const STEP_UP_MAX_AGE_SECONDS = 300;

const respond = (request, decision, reasonCode, ruleIds) => ({
  schema: 'aleph.decision.v1',
  requestId: request.requestId,
  decision,
  reasonCode,
  ruleIds,
});

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isCount = (value) => Number.isInteger(value) && value >= 0;

// 제작 1: 엔진이 넘긴 접속 정보의 출처를 구분합니다. 형식이 틀리거나 출처가 불명확하면
// 정상값으로 채우지 않고 '확인할 수 없음'으로 돌려줍니다. 브라우저 헤더 값은 이 함수에 들어오지 않습니다.
function readSignals(signals) {
  if (!isObject(signals) || typeof signals.source !== 'string') return { verified: false };
  // 실제 경로: 위치 정보가 없다는 뜻입니다. 정상이라고 가정하지도, 이상이라고 단정하지도 않습니다.
  if (signals.source === 'none') return { verified: true, anomalies: [] };
  // 심판의 가상 사건만 읽습니다. 이 값은 추가 확인을 요구하는 근거로만 쓰고 허용 근거로는 쓰지 않습니다.
  if (signals.source !== 'judge_fixture') return { verified: false };
  const { region, network, hour } = signals;
  if (typeof region !== 'string' || typeof network !== 'string'
      || !(hour === null || (Number.isInteger(hour) && hour >= 0 && hour <= 23))) {
    return { verified: false };
  }
  const anomalies = [];
  if (!USUAL_REGIONS.has(region)) anomalies.push('region_changed');
  if (!USUAL_NETWORKS.has(network)) anomalies.push('new_network');
  if (hour !== null && UNUSUAL_HOURS.has(hour)) anomalies.push('unusual_hour');
  return { verified: true, anomalies };
}

function readEvents(events) {
  if (!Array.isArray(events) || events.length > 12) return { verified: false };
  let recent = 0;
  for (const event of events) {
    if (!isObject(event) || typeof event.kind !== 'string'
        || !isCount(event.ageSeconds) || !isCount(event.count)) {
      return { verified: false };
    }
    if (event.ageSeconds <= BURST_WINDOW_SECONDS) recent += event.count;
  }
  return { verified: true, anomalies: recent >= BURST_COUNT ? ['burst_activity'] : [] };
}

// 8단계: 엔진이 확인한 사용자·기기·메서드·경로·자원 경로 모양이 구역 표와 정확히 맞는지 봅니다.
function zoneOf(request) {
  const { subjectId, deviceId, service, method, path, route, queryLength } = request;
  if (service !== NOTE_SERVICE) return null;
  if (typeof subjectId !== 'string' || !subjectId || typeof deviceId !== 'string'
      || !/^[0-9a-f]{16}$/u.test(deviceId) || typeof method !== 'string'
      || typeof path !== 'string' || typeof route !== 'string' || queryLength !== 0) {
    return null;
  }
  const space = route.indexOf(' ');
  if (space < 0 || route.slice(0, space) !== method) return null;
  const key = `${method} ${stripApi(route.slice(space + 1))}`;
  const rule = Object.hasOwn(ZONES, key) ? ZONES[key] : null;
  const target = stripApi(path);
  if (!rule || !rule.path.test(target)) return null;
  // 자료 ID 자리에 기능 이름(export 등)이 오면 거부합니다. 대소문자를 바꿔도 같습니다.
  const id = idOf(target);
  if (id !== undefined && FUNCTION_SEGMENTS.has(id.toLowerCase())) return null;
  return rule.zone;
}

// 제작 3: 엔진이 검증한 재로그인 정보(stepUp)만 봅니다. 확인했다는 표시와 최근 로그인 시각이 모두 맞아야 합니다.
function steppedUp(stepUp) {
  return isObject(stepUp) && stepUp.verified === true
    && Number.isInteger(stepUp.authAgeSeconds)
    && stepUp.authAgeSeconds >= 0 && stepUp.authAgeSeconds <= STEP_UP_MAX_AGE_SECONDS;
}

export async function decide(request) {
  // 6단계: 엔진이 확인한 기기 등록 여부가 정확히 true일 때만 허용합니다. 값이 없거나 true가 아니면 거부합니다.
  if (request?.deviceRegistered !== true) {
    return respond(request ?? {}, 'deny', 'device_not_registered', ['device_registered']);
  }
  // 8단계: 구역 표에 없는 요청(다른 구역, 공지 수정, 기능 경로, 쿼리 사용)은 거부합니다.
  if (!zoneOf(request)) {
    return respond(request, 'deny', 'resource_zone_denied', ['resource_zone']);
  }
  // 7단계: 평소와 다른 접속이거나 접속 정보를 확인할 수 없으면 추가 확인을 요구합니다.
  // 영구 차단하지 않고, 새로 로그인한 뒤의 요청은 다시 판정해 허용합니다.
  const signals = readSignals(request.signals);
  const events = readEvents(request.recentEvents);
  const unusual = !signals.verified || !events.verified
    || signals.anomalies.length > 0 || events.anomalies.length > 0;
  if (unusual) {
    if (steppedUp(request.stepUp)) {
      return respond(request, 'allow', 'approved', ['device_registered', 'resource_zone', 'step_up_required']);
    }
    return respond(request, 'step_up', 'step_up_required', ['step_up_required']);
  }
  return respond(request, 'allow', 'approved', ['device_registered', 'resource_zone']);
}
