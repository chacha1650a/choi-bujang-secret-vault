import config from '../aleph.config.json' with { type: 'json' };
import verifiedPolicy from '../policy/verified-policy.json' with { type: 'json' };
import { RULE_IDS } from '../src/decider.mjs';
import { CHECK_CASES, runAllRuleChecks, runRuleCheck } from '../src/rule-check.mjs';

// 12단계 탈환 작전실용 점검 API. 고정된 가상 입력으로 판정기·탐지 규칙·정책 사본을 지금 실행해 결과만 돌려줍니다.
// ?case=<고정 ID> 하나만 받고, 다른 입력은 실행하지 않습니다. 메모·토큰·기기 정보는 다루지 않습니다.
const policy = { snapshot: verifiedPolicy, config };

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
    const cases = await runAllRuleChecks({ policy });
    response.status(200).json({
      checkedAt: new Date().toISOString(), commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
      rules: [...RULE_IDS], policyRevision: verifiedPolicy.policyRevision,
      total: cases.length, ready: cases.filter((item) => item.ready).length, cases,
    });
  } catch {
    response.status(500).json({ error: 'SERVER_ERROR' });
  }
}
