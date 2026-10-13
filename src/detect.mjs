// 9단계: 반 엔진이 검증해 넘긴 가상 조회 사건에서 도플갱어(폭주 조회)를 찾아 권한 회수를 제안합니다.
// 사건 계약(docs/DETECT_EVENTS.md)대로 시각(at)·요청 종류(method)·가명 사용자(identity.sub) 세 값만 읽습니다.
// 메모 내용·토큰·실명은 읽지도, 저장하거나 출력하지도 않습니다. 브라우저가 보낸 사용자 번호는 받지 않습니다.
// 결과는 접속 허용/거부 응답(decider)과 별도이며, 회수를 직접 집행하지 않고 제안만 합니다.

const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 120;

// 제작 1: 사건 하나에서 필요한 값만 꺼냅니다. 형식이 틀린 사건은 세지 않습니다.
function readEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  const sub = event.identity?.sub;
  const at = typeof event.at === 'string' ? Date.parse(event.at) : Number.NaN;
  if (typeof sub !== 'string' || !sub || !Number.isFinite(at) || event.method !== 'GET') return null;
  return { sub, at };
}

// 제작 2: 같은 사용자의 조회가 어느 10분 구간에서든 120건을 넘을 때만 의심으로 봅니다(정확히 120건은 아님).
// 계약에 없는 지역·네트워크 값은 근거로 쓰지 않고, 지역 하나만으로는 확정하지 않습니다.
function burstWindow(reads) {
  reads.sort((a, b) => a.at - b.at);
  let start = 0;
  for (let end = 0; end < reads.length; end += 1) {
    while (reads[end].at - reads[start].at >= WINDOW_MS) start += 1;
    if (end - start + 1 > LIMIT) return true;
  }
  return false;
}

export function detect(events) {
  if (!Array.isArray(events)) throw new TypeError('invalid_detection_events');
  const bySubject = new Map();
  for (const raw of events) {
    const event = readEvent(raw);
    if (!event) continue;
    if (!bySubject.has(event.sub)) bySubject.set(event.sub, []);
    bySubject.get(event.sub).push(event);
  }
  // 제작 3: 의심 대상 한 명(가명 사용자)과 이유 코드만 담아 회수를 제안합니다. 다른 사용자의 사건은 합산하지 않습니다.
  for (const [sub, reads] of bySubject) {
    if (burstWindow(reads)) return { action: 'propose_revocation', reasonCode: 'burst_read', subject: sub };
  }
  return { action: 'observe' };
}
