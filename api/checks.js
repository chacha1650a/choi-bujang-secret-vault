import config from '../aleph.config.json' with { type: 'json' };
import verifiedPolicy from '../policy/verified-policy.json' with { type: 'json' };
import { runAttackChecks } from '../src/attack-check.mjs';
import { RULE_IDS } from '../src/decider.mjs';
import { CHECK_CASES, runRuleCheck } from '../src/rule-check.mjs';
import { SOURCE_OF, SOURCES } from '../src/sources.mjs';

// 12단계 탈환 작전실의 서버 점검 기록입니다.
// - ?case=<고정 ID>: 고정된 가상 입력 하나로 판정기·탐지 규칙·정책 사본을 지금 실행한 결과.
// - 인자 없음: npm run bundle과 같은 점검(src/attack-check.mjs)을 이 배포에 실제로 보내 센 수치와 각 결과.
//   실제 응답이 없는 점검은 미실행으로 세고, 없는 결과를 계산해 채우지 않습니다. 반복 호출 부담을 줄이려고 60초 동안 기억합니다.
// 메모·토큰·기기 정보는 다루지 않습니다.
const policy = { snapshot: verifiedPolicy, config };
const CACHE_MS = 60 * 1000;
let cached = null;

async function serverRecord() {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.record;
  const attempts = await runAttackChecks(config.publicAppUrl);
  const count = (result) => attempts.filter((item) => item.result === result).length;
  const record = {
    checkedAt: new Date().toISOString(), commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
    target: config.publicAppUrl, rules: [...RULE_IDS], policyRevision: verifiedPolicy.policyRevision,
    total: attempts.length, blocked: count('blocked'), failed: count('breached'), notRun: count('not_run'),
    recordSource: SOURCE_OF.attackCheck, sources: SOURCES,
    attempts,
  };
  cached = { at: Date.now(), record };
  return record;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  try {
    const caseId = request.query?.case;
    if (caseId !== undefined) {
      const known = typeof caseId === 'string' && CHECK_CASES.some((item) => item.id === caseId);
      if (!known) {
        response.status(400).json({ error: 'unknown_check' });
        return;
      }
      response.status(200).json(await runRuleCheck(caseId, { policy }));
      return;
    }
    response.status(200).json(await serverRecord());
  } catch {
    response.status(503).json({ error: 'checks_unavailable', message: '서버 점검 기록을 만들지 못했습니다.' });
  }
}
