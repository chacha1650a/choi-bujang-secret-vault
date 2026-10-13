import { randomUUID } from 'node:crypto';
import { RULE_IDS, decide } from './decider.mjs';
import { detect } from './detect.mjs';
import { currentPolicy, diffPolicy, verifySnapshot } from './policy-snapshot.mjs';

// 12단계: 고정된 가상 입력으로 학생 판정기·탐지 규칙·정책 사본을 실제로 실행합니다.
// 사용자 입력을 코드로 실행하지 않고, 실제 세션·메모·기기 상태는 읽거나 바꾸지 않습니다.
// 결과의 ready는 "그 가상 조건에서 기대한 판정이 나왔다"는 뜻일 뿐, 실제 기기 승인이나 심판 판정이 아닙니다.

const base = () => ({
  schema: 'aleph.decision.v1', requestId: randomUUID(), classId: 'class_check', projectId: 'project_check',
  subjectId: 'learner_check', deviceId: 'a'.repeat(16), service: 'notes', method: 'GET',
  path: '/api/notes/demo', route: 'GET /api/notes/:id', queryLength: 0,
  querySha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  at: new Date().toISOString(), policyRevision: 1, deviceRegistered: true,
  stepUp: { verified: false, authAgeSeconds: null }, recentEvents: [],
  signals: { source: 'judge_fixture', region: 'local', network: 'usual', hour: 14 },
});

const reads = (count, sub) => Array.from({ length: count }, (_, index) => ({
  at: new Date(Date.UTC(2026, 9, 1) + index * 2000).toISOString(), method: 'GET', identity: { sub },
}));

// [caseId, 단계, 종류(정상/금지), 기대, 입력 만들기, 기대 결과]
const DECIDE_CASES = [
  ['s06-registered', 6, '정상', '등록 기기의 내 메모 읽기 허용', () => base(), 'allow'],
  ['s06-unregistered', 6, '금지', '미등록 기기 거부', () => ({ ...base(), deviceRegistered: false }), 'deny'],
  ['s07-compound', 7, '금지', '복합 이상 접속은 추가 확인', () => ({ ...base(),
    signals: { source: 'judge_fixture', region: 'foreign', network: 'unusual', hour: 3 } }), 'step_up'],
  ['s07-stepped-up', 7, '정상', '다시 로그인한 복합 이상 접속 허용', () => ({ ...base(),
    signals: { source: 'judge_fixture', region: 'foreign', network: 'unusual', hour: 3 },
    stepUp: { verified: true, authAgeSeconds: 60 } }), 'allow'],
  ['s08-unknown-route', 8, '금지', '모르는 경로 거부', () => ({ ...base(), path: '/__unknown__', route: 'GET /__unknown__' }), 'deny'],
  ['s08-all-notes', 8, '금지', '전체 메모 목록 거부', () => ({ ...base(), path: '/api/notes', route: 'GET /api/notes' }), 'deny'],
  ['s08-write-notice', 8, '금지', '반 공지 쓰기 거부', () => ({ ...base(), method: 'PUT',
    path: '/api/notices/demo', route: 'PUT /api/notices/:id' }), 'deny'],
  ['s08-own-list', 8, '정상', '내 메모 목록 허용', () => ({ ...base(), path: '/api/my/notes', route: 'GET /api/my/notes' }), 'allow'],
];
const DETECT_CASES = [
  ['s09-burst-read', 9, '금지', '10분 안 121건 조회는 회수 제안', () => reads(121, 'check_user'), 'propose_revocation'],
  ['s09-normal-read', 9, '정상', '10분 안 120건 조회는 유지', () => reads(120, 'check_user'), 'observe'],
];

export const CHECK_CASES = Object.freeze([
  ...DECIDE_CASES.map(([id, stage, kind, expected]) => ({ id, stage, kind, expected })),
  ...DETECT_CASES.map(([id, stage, kind, expected]) => ({ id, stage, kind, expected })),
  { id: 's10-policy-verified', stage: 10, kind: '정상', expected: '검증한 정책 사본과 지금 정책이 같음' },
]);

export async function runRuleCheck(caseId, { policy } = {}) {
  const decideCase = DECIDE_CASES.find(([id]) => id === caseId);
  if (decideCase) {
    const result = await decide(decideCase[4]());
    return { caseId, ready: result.decision === decideCase[5], decision: result.decision, reasonCode: result.reasonCode };
  }
  const detectCase = DETECT_CASES.find(([id]) => id === caseId);
  if (detectCase) {
    const result = detect(detectCase[4]());
    return { caseId, ready: result.action === detectCase[5], action: result.action };
  }
  if (caseId === 's10-policy-verified') {
    try {
      const snapshot = verifySnapshot(policy?.snapshot);
      const diff = diffPolicy(snapshot, currentPolicy(policy.config, RULE_IDS, snapshot.policyRevision));
      return { caseId, ready: diff.clean, policyRevision: snapshot.policyRevision };
    } catch {
      return { caseId, ready: false, policyRevision: null };
    }
  }
  return null;
}

export async function runAllRuleChecks(options) {
  const results = [];
  for (const item of CHECK_CASES) results.push({ ...item, ...(await runRuleCheck(item.id, options)) });
  return results;
}
