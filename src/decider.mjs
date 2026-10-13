// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기입니다.
// 규칙을 하나씩 추가합니다. 규칙에 해당하지 않는 요청은 모두 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['device_registered']);

const respond = (request, decision, reasonCode, ruleIds) => ({
  schema: 'aleph.decision.v1',
  requestId: request.requestId,
  decision,
  reasonCode,
  ruleIds,
});

export async function decide(request) {
  // 6단계: 엔진이 확인한 기기 등록 여부가 정확히 true일 때만 허용합니다. 값이 없거나 true가 아니면 거부합니다.
  if (request?.deviceRegistered !== true) {
    return respond(request ?? {}, 'deny', 'device_not_registered', ['device_registered']);
  }
  return respond(request, 'allow', 'approved', ['device_registered']);
}
