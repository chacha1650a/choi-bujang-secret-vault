// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
const DEVICE_LABELS = { compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가' };
const SESSION_LABELS = { active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가' };
const MODE_LABELS = { demo: '예제 자료', disconnected: '연결 없음', unknown: '확인 불가' };
const BAD_STATES = new Set(['noncompliant', 'expired', 'revoked']);

const text = (value) => (typeof value === 'string' && value.trim() !== '' ? value : null);
const label = (labels, key) => (typeof key === 'string' && Object.hasOwn(labels, key) ? labels[key] : '확인 불가');

function node(tag, content, className) {
  const element = document.createElement(tag);
  if (content != null) element.textContent = content;
  if (className) element.className = className;
  return element;
}

// 상태 글자 + 정상처럼 보이지 않게 하는 표시(색에만 기대지 않고 앞에 글자를 붙입니다).
function stateLine(name, labels, key) {
  const line = node('p', null, 'identity-state');
  const bad = BAD_STATES.has(key);
  const unknownLike = !bad && label(labels, key) === '확인 불가';
  line.dataset.state = typeof key === 'string' && Object.hasOwn(labels, key) ? key : 'unknown';
  line.textContent = `${name}: ${bad ? '주의 · ' : unknownLike ? '확인 필요 · ' : ''}${label(labels, key)}`;
  return line;
}

function modeNote(mode) {
  if (mode === 'connected') return null;
  return node('p', `자료 출처: ${label(MODE_LABELS, mode)}`, 'identity-mode');
}

function section(title, resource, body) {
  const box = node('section', null, 'identity-section');
  box.dataset.resource = title;
  box.append(node('h4', title));
  const mode = modeNote(resource?.mode);
  if (resource?.status === 'loading') {
    box.append(node('p', '불러오는 중'));
    if (mode) box.append(mode);
  } else if (resource?.status === 'error') {
    box.append(node('p', `연결 실패: ${text(resource.error?.message) ?? '확인 불가'}`, 'identity-error'));
    if (mode) box.append(mode);
  } else if (resource?.status === 'ok') {
    if (mode) box.append(mode);
    body(box, resource.data);
  } else {
    box.append(node('p', '확인 불가'));
    if (mode) box.append(mode);
  }
  return box;
}

function buildIdentity(input) {
  const { me, devices, sessions } = input ?? {};
  const root = node('div', null, 'identity-view');
  root.append(
    section('사용자', me, (box, data) => {
      const user = data?.user;
      box.append(node('p', `사용자: ${text(user?.label) ?? '확인 불가'}`));
      const device = data?.device;
      box.append(node('p', `현재 기기: ${text(device?.label) ?? '확인 불가'}`));
      box.append(stateLine('현재 기기 상태', DEVICE_LABELS, device?.status));
      box.append(stateLine('현재 세션 상태', SESSION_LABELS, data?.session?.status));
    }),
    section('기기', devices, (box, data) => {
      if (!Array.isArray(data) || data.length === 0) return box.append(node('p', '표시할 기기가 없습니다.'));
      const list = node('ul');
      for (const device of data) {
        const item = node('li', null);
        item.append(node('span', `${text(device?.label) ?? text(device?.id) ?? '이름 없음'} `), stateLine('상태', DEVICE_LABELS, device?.status));
        list.append(item);
      }
      box.append(list);
    }),
    section('세션', sessions, (box, data) => {
      if (!Array.isArray(data) || data.length === 0) return box.append(node('p', '표시할 세션이 없습니다.'));
      const list = node('ul');
      for (const session of data) {
        const item = node('li', null);
        item.append(node('span', `${text(session?.id) ?? '식별자 없음'} `), stateLine('상태', SESSION_LABELS, session?.status));
        list.append(item);
      }
      box.append(list);
    }),
  );
  return root;
}

// allow 는 정책상 허용일 뿐 앱 접속 성공이 아니고, challenge 는 이 앱이 추가 인증을 대신 해 준다는 뜻이 아닙니다.
const DECISION_LABELS = {
  allow: { text: '접근 허용', note: '정책상 접근이 허용되었습니다. 실제 앱 접속 성공을 뜻하지는 않습니다.' },
  deny: { text: '접근 거부', note: '정책에 따라 이 앱 접근이 거부되었습니다.' },
  challenge: { text: '추가 인증 또는 확인 필요', note: '추가 확인이 끝나기 전에는 접근이 허용되지 않습니다. 이 앱이 확인 절차를 대신하지 않습니다.' },
  unknown: { text: '판정 확인 불가', note: '판정을 확인할 수 없습니다. 허용되지 않은 것으로 다룹니다.' },
};

function decisionField(list, name, value) {
  list.append(node('dt', name), node('dd', value));
}

function buildDecision(input) {
  const { status, mode, data, error, appId } = input ?? {};
  const root = node('div', null, 'decision-view');
  root.dataset.status = typeof status === 'string' ? status : 'unknown';
  const targetApp = text(data?.appId) ?? text(appId);
  // 요청 전에는 서버 응답이 없어 모드도 없으므로 출처 안내를 붙이지 않습니다.
  const note = typeof mode === 'string' ? modeNote(mode) : null;
  if (status === 'idle') {
    root.append(node('p', '업무 앱을 하나 골라 접근을 요청하세요. 아직 요청한 판정이 없습니다.'));
  } else if (status === 'loading') {
    root.append(node('p', `판정 확인 중${targetApp ? ` · 앱 ID: ${targetApp}` : ''}`));
  } else if (status === 'error') {
    root.append(
      node('p', `요청 실패: ${text(error?.message) ?? '확인 불가'}`, 'decision-error'),
      node('p', '서버의 거부 판정이 아니라 요청 자체가 실패한 것입니다. 접근 허용 여부는 확인되지 않았습니다.'),
    );
    if (targetApp) root.append(node('p', `앱 ID: ${targetApp}`));
  } else if (status === 'ok') {
    const raw = text(data?.decision);
    const known = raw && Object.hasOwn(DECISION_LABELS, raw) ? raw : 'unknown';
    root.dataset.decision = known;
    const view = DECISION_LABELS[known];
    // 목록에 없는 값도 확인 불가로 다루고, 받은 원래 값은 따로 적어 둡니다.
    const headline = known === raw ? `판정: ${view.text}(${known})` : `판정: ${view.text}(unknown) · 받은 값: ${raw ?? '없음'}`;
    root.append(node('p', `${known === 'allow' ? '' : known === 'deny' ? '거부 · ' : '주의 · '}${headline}`, `decision-headline decision-${known}`));
    root.append(node('p', view.note));
    const list = node('dl');
    decisionField(list, '앱 ID', targetApp ?? '확인 불가');
    decisionField(list, '판정 이유(reason)', text(data?.reason) ?? '서버가 이유를 보내지 않았습니다.');
    decisionField(list, '판정 시각(checkedAt)', text(data?.checkedAt) ?? '확인 불가');
    root.append(list);
  } else {
    root.append(node('p', '판정 확인 불가(unknown) · 허용되지 않은 것으로 다룹니다.'));
  }
  if (note) root.append(note);
  return root;
}

export function createStudentView() {
  return {
    // 13단계: 로그인 사용자·기기·세션을 상태별로 보여 줍니다. 입력은 { me, devices, sessions } 이고 각각 { status, mode, data?, error? } 입니다.
    // 다시 불러오면 제공 UI가 새 입력으로 이 함수를 다시 부르고, 이전 DOM은 새 요소로 통째로 바뀝니다. 이전 값은 보관하지 않습니다.
    renderIdentity(input) { return buildIdentity(input); },
    // 14단계: 선택한 업무 앱 한 개의 접근 판정·이유·시각을 보여 줍니다. 입력은 { status, mode, data?, error?, appId } 입니다.
    // 요청 실패(error)는 거부 판정과, 확인 불가(unknown)는 허용과 섞이지 않게 글자로 구분합니다.
    renderDecision(input) { return buildDecision(input); },
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
