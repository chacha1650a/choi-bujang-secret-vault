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

const KIND_LABELS = { access: '접속', xdr: 'XDR 경보' };
const ACCESS_LABELS = { allowed: '허용됨', denied: '거부됨', unknown: '확인 불가' };
const FILTERS = [
  { key: 'kind', name: '기록 종류', pick: (event) => event?.kind, show: (value) => `${KIND_LABELS[value] ?? '확인 불가'}(${value})` },
  { key: 'appId', name: '업무 앱', pick: (event) => event?.appId, show: (value) => value },
  { key: 'access', name: '접속 상태', pick: (event) => event?.state?.access, show: (value) => `${ACCESS_LABELS[value] ?? '확인 불가'}(${value})` },
];

// 한국어 설명과 원래 값을 함께 적습니다. 목록에 없는 값은 확인 불가로 둡니다.
const coded = (labels, value) => {
  const raw = text(value);
  if (!raw) return '확인 불가(unknown)';
  return Object.hasOwn(labels, raw) ? `${labels[raw]}(${raw})` : `확인 불가(unknown) · 받은 값: ${raw}`;
};

const KST = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'medium' });
function eventTime(at) {
  const raw = text(at);
  if (!raw) return '시각 확인 불가';
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? `${KST.format(new Date(ms))} (한국 시각) · ${raw}` : `시각 확인 불가 · 받은 값: ${raw}`;
}

// 원본 배열은 그대로 두고 복사본을 at 최신순으로 정렬합니다. 시각을 읽을 수 없는 기록은 맨 뒤에 둡니다.
function sortEvents(list) {
  const time = (event) => { const ms = Date.parse(event?.at); return Number.isFinite(ms) ? ms : -Infinity; };
  return [...list].sort((a, b) => time(b) - time(a));
}

function pairList(title, items) {
  const box = node('div', null, 'event-detail-part');
  box.append(node('h5', title));
  if (!Array.isArray(items) || items.length === 0) {
    box.append(node('p', `${title}: 서버가 보낸 항목이 없습니다.`));
    return box;
  }
  const list = node('ul');
  for (const item of items) list.append(node('li', `${text(item?.id) ?? 'ID 없음'}: ${text(item?.text) ?? '내용 없음'}`));
  box.append(list);
  return box;
}

function eventDetail(event) {
  const id = String(event.id);
  const box = node('section', null, 'event-detail');
  box.dataset.studentEventDetail = id;
  box.setAttribute('aria-label', `${id} 상세`);
  box.append(node('h4', `${id} 상세`));
  const facts = node('dl');
  decisionField(facts, '사건 ID', id);
  decisionField(facts, '앱 ID(appId)', text(event.appId) ?? '앱을 확인할 수 없습니다(appId 없음)');
  decisionField(facts, '접속 상태(state.access)', coded(ACCESS_LABELS, event.state?.access));
  decisionField(facts, '세션 상태(state.session)', coded(SESSION_LABELS, event.state?.session));
  decisionField(facts, '기기 상태(state.device)', coded(DEVICE_LABELS, event.state?.device));
  box.append(facts, pairList('근거(evidence)', event.evidence), pairList('규칙(rules)', event.rules));
  // supportedActions 가 비어 있으면 조치 버튼을 만들지 않습니다. 실제 조치 버튼은 만들지 않고 미지원 안내만 둡니다.
  const pending = unsupportedActions(event.supportedActions);
  if (pending) box.append(pending);
  return box;
}

function createEventsView() {
  const filters = { kind: 'all', appId: 'all', access: 'all' };

  function render(input) {
    const { status, mode, data, error } = input ?? {};
    // 새 자료마다 이전 목록과 상세를 버리고 새 요소를 만듭니다.
    const root = node('div', null, 'events-view');
    root.dataset.status = typeof status === 'string' ? status : 'unknown';
    const note = typeof mode === 'string' ? modeNote(mode) : null;
    if (note) root.append(note);
    if (status === 'loading') {
      root.append(node('p', '기록을 불러오는 중'));
      return root;
    }
    if (status === 'error') {
      const mismatch = error?.code === 'CONTRACT_MISMATCH';
      root.append(node('p', `${mismatch ? '기록을 확인할 수 없습니다(확인 불가)' : '기록을 불러오지 못했습니다'}: ${text(error?.message) ?? '확인 불가'}`, 'events-error'));
      root.append(node('p', '이전 목록은 지웠습니다. 기록이 없다는 뜻이 아닙니다. 다시 불러오기를 눌러 주세요.'));
      return root;
    }
    if (status !== 'ok' || !Array.isArray(data)) {
      root.append(node('p', '기록을 확인할 수 없습니다(확인 불가).', 'events-error'));
      return root;
    }
    root.append(node('p', '내 최근 기록(최대 40건)입니다. 전체 직원 기록이나 실시간 전체 탐지가 아닙니다. XDR 경보는 서버에 저장된 것만 보입니다.'));
    if (data.length === 0) {
      root.append(node('p', '표시할 기록이 없습니다. 조회는 성공했고 해당 기록이 0건입니다.', 'events-empty'));
      return root;
    }

    const sorted = sortEvents(data);
    const controls = node('div', null, 'events-filters');
    const count = node('p', null, 'events-count');
    const list = node('ul', null, 'events-list');
    const detail = node('div', null, 'events-detail-slot');
    let selected = null;

    const visible = () => sorted.filter((event) => FILTERS.every((f) => filters[f.key] === 'all' || f.pick(event) === filters[f.key]));

    function drawDetail() {
      detail.replaceChildren();
      const event = selected === null ? null : visible().find((item) => String(item?.id) === selected);
      if (event) detail.append(eventDetail(event));
      else detail.append(node('p', '상세 버튼을 누르면 근거·규칙·세 상태가 여기에 보입니다.'));
    }

    function drawList() {
      const rows = visible();
      count.textContent = `표시 ${rows.length}건 / 받은 기록 ${sorted.length}건`;
      list.replaceChildren();
      if (rows.length === 0) list.append(node('li', '선택한 필터에 맞는 기록이 없습니다.'));
      for (const event of rows) {
        const id = String(event?.id ?? '');
        const row = node('li', null, 'event-row');
        row.dataset.studentEventId = id;
        row.append(
          node('p', `사건 ID: ${id || 'ID 없음'}`),
          node('p', `시각: ${eventTime(event?.at)}`),
          node('p', `종류: ${coded(KIND_LABELS, event?.kind)}`),
          node('p', `앱: ${text(event?.appId) ?? '앱을 확인할 수 없습니다(appId 없음)'}`),
          node('p', `요약: ${text(event?.summary) ?? '요약 없음'}`),
        );
        const button = node('button', `${id} 상세`);
        button.type = 'button';
        button.setAttribute('aria-label', `${id} 상세`);
        button.setAttribute('aria-pressed', String(selected === id));
        button.addEventListener('click', () => { selected = id; drawList(); drawDetail(); });
        row.append(button);
        list.append(row);
      }
    }

    for (const filter of FILTERS) {
      const values = [...new Set(sorted.map(filter.pick).filter((value) => typeof value === 'string' && value !== ''))].sort();
      // 새 자료에 없는 값으로 걸러져 있으면 전체로 되돌립니다.
      if (filters[filter.key] !== 'all' && !values.includes(filters[filter.key])) filters[filter.key] = 'all';
      const id = `student-events-filter-${filter.key}`;
      const labelEl = node('label', filter.name);
      labelEl.htmlFor = id;
      const select = node('select');
      select.id = id;
      select.setAttribute('aria-label', filter.name);
      const all = node('option', '전체');
      all.value = 'all';
      select.append(all);
      for (const value of values) {
        const option = node('option', filter.show(value));
        option.value = value;
        select.append(option);
      }
      select.value = filters[filter.key];
      select.addEventListener('change', () => {
        filters[filter.key] = select.value;
        drawList();
        drawDetail();
      });
      controls.append(labelEl, select);
    }

    drawList();
    drawDetail();
    root.append(controls, count, list, detail);
    return root;
  }

  return { render };
}

// 16단계: 기기·세션·알림·도움정보를 보여 줍니다. 다시 시도는 사용자가 위쪽 「다시 불러오기」를 누를 때만 일어나고, 여기서 자동으로 다시 요청하지 않습니다.
const RESOURCE_LABELS = { me: '로그인 정보', devices: '등록 기기', sessions: '현재 세션', apps: '업무 앱', events: '보안 기록', diagnostics: '도움정보', access: '접속 판정' };
const RETRY_NOTE = '다시 시도는 위쪽 「다시 불러오기」 버튼을 직접 누르세요. 자동으로 다시 요청하지 않습니다.';
const TIMEOUT_CODES = new Set(['TIMEOUT', 'ENGINE_TIMEOUT', 'REQUEST_TIMEOUT']);
// 도움정보에는 아래 여섯 값만 씁니다. 열쇠·토큰·주소 같은 다른 값은 화면과 복사 내용에 넣지 않습니다.
const DIAGNOSTIC_FIELDS = [
  ['requestId', (d) => d?.requestId],
  ['component', (d) => d?.component],
  ['version', (d) => d?.version],
  ['checkedAt', (d) => d?.checkedAt],
  ['engine.mode', (d) => d?.engine?.mode],
  ['engine.code', (d) => d?.engine?.code],
];
const SAFE_VALUE = /^[\w.:+\-]{1,80}$/u;

function failureLines(box, what, error) {
  const code = text(error?.code);
  const timedOut = code !== null && TIMEOUT_CODES.has(code);
  box.append(
    node('p', `${what} 불러오기 실패${timedOut ? '(시간 초과)' : ''}:${text(error?.message) ?? '확인 불가'}${code ? ` · 코드: ${code}` : ''}`, 'status-error'),
    node('p', RETRY_NOTE),
  );
}

function resourceBox(title, resource, emptyText, drawItem, scopeNote) {
  const box = node('section', null, 'status-section');
  box.dataset.resource = title;
  box.append(node('h4', title));
  if (scopeNote) box.append(node('p', scopeNote));
  const status = resource?.status;
  if (status === 'loading') box.append(node('p', `${title} 불러오는 중`));
  else if (status === 'error') failureLines(box, title, resource.error);
  else if (status === 'ok' && Array.isArray(resource.data)) {
    if (resource.data.length === 0) box.append(node('p', emptyText, 'status-empty'));
    else {
      const list = node('ul');
      for (const item of resource.data) list.append(drawItem(item));
      box.append(list);
    }
  } else box.append(node('p', `${title}: 아직 불러오지 않았거나 확인 불가입니다.`));
  const note = typeof resource?.mode === 'string' ? modeNote(resource.mode) : null;
  if (note) box.append(note);
  return box;
}

function safeDiagnostics(data) {
  const pairs = [];
  for (const [name, pick] of DIAGNOSTIC_FIELDS) {
    const value = pick(data);
    pairs.push([name, typeof value === 'string' && SAFE_VALUE.test(value) ? value : '확인 불가']);
  }
  return pairs;
}

function diagnosticsBox(resource) {
  const box = node('section', null, 'status-section');
  box.dataset.resource = '도움정보';
  box.append(node('h4', '도움정보'));
  const status = resource?.status;
  let pairs = null;
  if (status === 'loading') box.append(node('p', '도움정보 불러오는 중'));
  else if (status === 'error') failureLines(box, '도움정보', resource.error);
  else if (status === 'ok') {
    pairs = safeDiagnostics(resource.data);
    const list = node('dl');
    for (const [name, value] of pairs) decisionField(list, name, value);
    box.append(list);
  } else box.append(node('p', '도움정보를 아직 불러오지 않았습니다. 제공 화면의 「도움정보 불러오기」를 누르면 여기에 보입니다.'));

  // 도움 요청에 붙일 수 있게, 사용자가 누를 때만 위의 안전한 값만 복사합니다.
  const result = node('p', null, 'status-copy-result');
  const button = node('button', '도움정보 복사');
  button.type = 'button';
  button.disabled = pairs === null;
  button.addEventListener('click', async () => {
    if (pairs === null) return;
    try {
      await navigator.clipboard.writeText(pairs.map(([name, value]) => `${name}: ${value}`).join('\n'));
      result.textContent = '도움정보를 복사했습니다. 비밀번호·토큰·API 키는 들어 있지 않습니다.';
    } catch {
      result.textContent = '복사하지 못했습니다. 위 값을 직접 옮겨 적어 주세요.';
    }
  });
  box.append(node('p', '「도움정보 복사」는 강사·담당자에게 도움을 요청할 때 붙일 값(요청 ID·구성 요소·버전·확인 시각·엔진 상태)만 복사합니다.'), button, result);
  return box;
}

function buildStatus(input) {
  const { devices, sessions, notifications, diagnostics, mode } = input ?? {};
  const root = node('div', null, 'status-view');
  const note = typeof mode === 'string' ? modeNote(mode) : null;
  if (note) root.append(note);

  const alerts = node('section', null, 'status-section');
  alerts.append(node('h4', '알림'));
  if (!Array.isArray(notifications) || notifications.length === 0) alerts.append(node('p', '주의할 알림이 없습니다.'));
  else {
    const list = node('ul');
    for (const item of notifications) {
      const resource = text(item?.resource);
      const code = text(item?.code);
      list.append(node('li', `[${resource ? `${RESOURCE_LABELS[resource] ?? '확인 불가'}(${resource})` : '자료 확인 불가'}] ${code && SAFE_VALUE.test(code) ? `${code} · ` : ''}${text(item?.message) ?? '내용 없음'}`));
    }
    alerts.append(list);
  }

  root.append(
    alerts,
    resourceBox('등록 기기', devices, '등록된 기기가 없습니다.', (device) => {
      const item = node('li');
      item.append(node('span', `${text(device?.label) ?? text(device?.id) ?? '이름 없음'} `), stateLine('상태', DEVICE_LABELS, device?.status), node('span', ` 원래 값: ${text(device?.status) ?? 'unknown'}`));
      return item;
    }),
    resourceBox('현재 세션', sessions, '현재 연결이 없습니다.', (session) => {
      const item = node('li');
      item.append(node('span', `${text(session?.id) ?? '식별자 없음'} `), stateLine('상태', SESSION_LABELS, session?.status), node('span', ` 원래 값: ${text(session?.status) ?? 'unknown'}`));
      return item;
    }, '세션은 지금 검증된 연결 하나만 보입니다. 지난 세션 목록이 아닙니다.'),
    diagnosticsBox(diagnostics),
  );
  return root;
}

// 16단계: 연결되지 않은 조치는 요청을 보내지 않는 비활성 안내 버튼으로만 둡니다. supportedActions 가 비어 있으면 아무것도 만들지 않습니다.
function unsupportedActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) return null;
  const box = node('div', null, 'event-unsupported-actions');
  box.append(node('p', '아래 조치는 아직 지원하지 않습니다. 조치 실행 연결은 준비 중이며, 버튼을 눌러도 요청을 보내지 않습니다.'));
  for (const action of actions) {
    const name = text(action) ?? '알 수 없는 조치';
    const button = node('button', `${name} 미지원`);
    button.type = 'button';
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
    box.append(button);
  }
  return box;
}

// 17단계: 앱 서버를 거친 AI 연결 점검 결과를 보여 줍니다. 모델 목록 응답은 연결 점검일 뿐 사건 설명이 아닙니다.
// 오류는 제공 화면이 정리한 안전한 code·message 만 쓰고, 원문 오류·열쇠는 화면에 쓰지 않습니다. 자동으로 다시 점검하지 않습니다.
const AI_RETRY_NOTE = '다시 점검은 「현재 API 연결 점검」 버튼을 직접 누르세요. 자동으로 다시 점검하지 않습니다.';
const AI_CAUSES = [
  { codes: ['ON_AI_PROVISIONING_PENDING', 'AI_REQUEST_UNVERIFIED', 'ON_AI_AUTHORIZATION_CHANGED', 'SUBJECT_SCOPE_UNVERIFIED'], cause: '권한 준비 중·확인 불가', guide: '학생 잘못이 아닙니다. 담당자에게 계정 연결과 앱 권한 확인을 요청하세요.' },
  { codes: ['WB_CLCO_AUTH_REQUIRED'], cause: '인증 실패', guide: '계정 연결을 다시 확인하고, 계속되면 담당자에게 확인하세요. Workbench 열쇠를 복사하지 마세요.' },
  { codes: ['WB_CLCO_ACCESS_BLOCKED'], cause: '접근 제한', guide: '계정 연결을 다시 확인하고, 운영 중지 여부와 이용 권한을 담당자에게 확인하세요.' },
  { codes: ['WB_CLCO_COHORT_BUDGET_EXHAUSTED', 'WB_CLCO_LIMIT_REACHED'], cause: '반 사용량·이용 한도', guide: '담당자에게 사용량과 한도를 확인하세요.' },
  { codes: ['WB_CLCO_SESSION_CLOSED'], cause: '이용 시간 아님', guide: 'AI 이용 시간을 확인한 뒤 직접 다시 점검하세요.' },
  { codes: ['WB_CLCO_RATE_LIMITED', 'WB_CLCO_TIMEOUT', 'REQUEST_TIMEOUT', 'ENGINE_TIMEOUT', 'TIMEOUT', 'NETWORK_ERROR'], cause: '요청 제한·시간 초과·네트워크', guide: '잠시 뒤 직접 다시 점검하세요.' },
  { codes: ['WB_CLCO_CANCELLED', 'CANCELLED', 'REQUEST_CANCELLED'], cause: '취소', guide: '점검을 취소했습니다. 이전 결과는 현재 결과가 아닙니다.' },
  { codes: ['ON_AI_MODEL_LIST_EMPTY', 'MODEL_NOT_CONFIGURED'], cause: '쓸 수 있는 모델 없음', guide: '담당자에게 모델 허용 설정 확인을 요청하세요.' },
];
const AUDIENCE_LABELS = { test: '시험 연결 점검(test)', verified: '앱 권한 확인 후 점검(verified)' };

function aiCause(code) {
  const raw = text(code);
  return AI_CAUSES.find((row) => raw && row.codes.includes(raw)) ?? { cause: '확인 불가', guide: 'AI 연결 상태를 확인할 수 없습니다. 담당자에게 확인하세요.' };
}

function buildAiConnection(input) {
  const { status, mode, data, error, checkedAt } = input ?? {};
  // 매번 새 요소를 만들어 이전 점검 결과·오류 안내를 남기지 않습니다.
  const root = node('div', null, 'ai-connection-view');
  root.dataset.status = typeof status === 'string' ? status : 'unknown';
  if (status === 'loading') {
    root.append(node('p', 'AI 연결 점검 중'), node('p', '점검을 취소하면 늦게 온 응답은 현재 결과로 쓰지 않습니다.'));
  } else if (status === 'ok') {
    const audience = text(data?.audienceAuthorization);
    root.append(
      node('p', `AI 연결 점검 완료: ${audience && Object.hasOwn(AUDIENCE_LABELS, audience) ? AUDIENCE_LABELS[audience] : '확인 불가(unknown)'}`),
      node('p', `사용할 수 있는 모델 수(modelCount): ${Number.isInteger(data?.modelCount) ? data.modelCount : '확인 불가'}`),
      node('p', `점검 시각(checkedAt): ${text(checkedAt) ?? '확인 불가'}`),
      node('p', '연결만 점검했습니다. 사건 설명은 아직 실행하지 않았습니다. 사건 설명은 보안 기록에서 사건을 골라 따로 요청합니다.', 'ai-not-explained'),
    );
    if (audience === 'test') root.append(node('p', '시험 연결입니다. 앱 권한 확인(verified)이 끝난 연결이 아닙니다.'));
  } else if (status === 'error') {
    const code = text(error?.code) ?? 'AI_REQUEST_UNVERIFIED';
    const row = aiCause(code);
    root.append(
      node('p', `AI 연결 점검 실패 · 원인: ${row.cause}`, 'ai-error'),
      node('p', `코드: ${code} · ${text(error?.message) ?? '확인 불가'}`),
      node('p', row.guide),
      node('p', AI_RETRY_NOTE),
    );
  } else {
    // idle(계정을 다시 연결한 경우 포함)이면 이전 점검 결과를 지우고 점검 전으로 둡니다.
    root.append(node('p', 'AI 연결 점검 전'), node('p', '계정 연결과 AI 연결 승인을 마친 뒤 「현재 API 연결 점검」을 누르세요. 앱 주소나 열쇠를 입력하는 칸은 없습니다.'));
  }
  const note = typeof mode === 'string' ? modeNote(mode) : null;
  if (note) root.append(note);
  return root;
}

// 18단계: 선택한 기록의 AI 설명을 그 기록의 근거·규칙·현재 상태와 이어서 보여 줍니다. 입력은 { event, explanation, checkedAt } 입니다.
// AI 설명은 참고용 해석이고, 사실 판단은 근거 글과 연동 시스템이 알려 준 상태로 합니다. 실행 버튼은 만들지 않습니다.
// 매번 새 요소를 만들므로 다른 기록을 고르거나 다시 불러오면 이전 설명과 성공 표식이 함께 사라집니다.
const STATE_PARTS = [['access', '접속'], ['session', '세션'], ['device', '기기']];

function explanationFailure(root, title, code, message, eventId) {
  root.append(
    node('p', `${title}${eventId ? ` · 사건 ID: ${eventId}` : ''}`, 'explanation-error'),
    node('p', `코드: ${code ?? 'AI_REQUEST_UNVERIFIED'} · ${message ?? '확인 불가'}`),
    node('p', '기록은 그대로입니다. 설명만 쓸 수 없으며 과제 실패가 아닙니다. 업무 앱 판정과 보안 기록은 계속 쓸 수 있습니다.'),
  );
  return root;
}

// 설명이 이 기록에 맞는지 확인합니다. 맞지 않으면 그 까닭을 돌려주고, 내용을 지어내 맞추지 않습니다.
function explanationProblem(event, data) {
  if (data?.executed !== false) return 'AI가 이미 실행했다고 답한 설명은 쓸 수 없습니다(실행 상태가 executed:false 가 아님).';
  if (!Array.isArray(data?.evidenceIds) || data.evidenceIds.length === 0) return '설명이 인용한 근거 ID가 없어 근거가 맞지 않습니다.';
  const known = new Set((Array.isArray(event?.evidence) ? event.evidence : []).map((row) => row?.id));
  const missing = data.evidenceIds.filter((id) => !known.has(id));
  if (missing.length > 0) return `선택한 기록에 없는 근거 ID(${missing.map(String).join(', ')})를 인용해 근거가 맞지 않습니다.`;
  for (const proposal of Array.isArray(data.proposals) ? data.proposals : []) {
    const refs = Array.isArray(proposal?.evidenceIds) ? proposal.evidenceIds : [];
    if (refs.some((id) => !known.has(id))) return `제안(${text(proposal?.action) ?? '이름 없음'})이 선택한 기록에 없는 근거를 인용해 근거가 맞지 않습니다.`;
  }
  return null;
}

function buildExplanation(input) {
  const { event, explanation, checkedAt } = input ?? {};
  const root = node('div', null, 'explanation-view');
  const eventId = text(event?.id);
  const status = explanation?.status;

  // 실패는 event 가 없어도 먼저 보여 줍니다.
  if (status === 'error') {
    return explanationFailure(root, 'AI 설명 실패', text(explanation.error?.code), text(explanation.error?.message), eventId);
  }
  if (!eventId) {
    root.append(node('p', '보안 기록에서 기록을 먼저 고르세요. 고른 기록이 있어야 AI 설명을 요청할 수 있습니다.'));
    return root;
  }
  if (status === 'loading') {
    root.append(node('p', `AI 설명 요청 중 · 사건 ID: ${eventId}`));
    return root;
  }
  if (status !== 'ok') {
    root.append(node('p', `사건 ID: ${eventId} · 아직 AI 설명을 요청하지 않았습니다.`));
    return root;
  }

  const data = explanation.data;
  const problem = explanationProblem(event, data);
  if (problem) {
    // 근거가 맞지 않는 설명에는 성공 표식을 붙이지 않습니다.
    root.append(node('p', problem));
    return explanationFailure(root, 'AI 설명을 쓸 수 없습니다', text(explanation.error?.code) ?? 'ON_AI_INVALID_OUTPUT', '선택한 기록에 쓸 수 없는 설명입니다.', eventId);
  }

  root.dataset.studentExplanationEvent = eventId;
  root.append(node('p', `사건 ID: ${eventId}`), node('h4', 'AI 설명(참고용)'), node('p', text(data.summary) ?? '설명 없음'));
  if (text(checkedAt)) root.append(node('p', `설명 시각: ${checkedAt}`));

  const evidence = node('ul');
  for (const id of data.evidenceIds) {
    const row = event.evidence.find((item) => item?.id === id);
    evidence.append(node('li', `${id} — ${text(row?.text) ?? '근거 글 없음'}`));
  }
  root.append(node('h5', '인용한 근거'), evidence);

  const rules = node('ul');
  const ruleRows = Array.isArray(event.rules) ? event.rules : [];
  if (ruleRows.length === 0) rules.append(node('li', '이 기록에 연결된 규칙이 없습니다.'));
  for (const rule of ruleRows) rules.append(node('li', `${text(rule?.id) ?? 'ID 없음'} — ${text(rule?.text) ?? '규칙 글 없음'}`));
  root.append(node('h5', '규칙'), rules);

  // unknown 은 확인 불가이며 정상·안전으로 바꾸지 않습니다. 값이 없거나 목록에 없는 값도 확인 불가로 둡니다.
  const unknowns = node('ul');
  const labels = { access: ACCESS_LABELS, session: SESSION_LABELS, device: DEVICE_LABELS };
  for (const [key, name] of STATE_PARTS) {
    const raw = text(event.state?.[key]);
    if (!raw || raw === 'unknown' || !Object.hasOwn(labels[key], raw)) unknowns.append(node('li', `${name}: 확인 불가(${raw ?? 'unknown'})`));
  }
  if (unknowns.children.length === 0) unknowns.append(node('li', '없음'));
  root.append(node('h5', '확인 불가 상태'), unknowns);

  const proposals = Array.isArray(data.proposals) ? data.proposals : [];
  root.append(node('h5', '조치 제안'));
  if (proposals.length === 0) {
    const supported = Array.isArray(event.supportedActions) ? event.supportedActions : [];
    root.append(node('p', supported.length === 0 ? '연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상).' : 'AI가 제안한 조치가 없습니다.'));
  } else {
    const list = node('ul');
    for (const proposal of proposals) {
      list.append(node('li', `${text(proposal?.action) ?? '이름 없음'}: ${text(proposal?.reason) ?? '이유 없음'} · 사람 확인이 필요하며 실행되지 않았습니다.`));
    }
    root.append(list);
  }
  root.append(node('p', 'AI 설명과 제안만으로 보안 조치가 실행되지는 않습니다.'));
  return root;
}

// 19단계: AI 제안·사람 확인·서버 접수(ACK)·실제 효과 관측을 나눠 보여 줍니다. 입력은
// { status, event, actionId, target, receipt, observation, message, confirmationExpiresAt?, error? } 입니다.
// 버튼·POST 요청·확인 티켓은 만들지 않습니다. 조치 준비·집행·재조회·취소는 제공 화면 버튼으로만 합니다.
const ACTION_VIEWS = {
  idle: '아직 미실행(idle)',
  loading: '조치 준비 또는 결과 조회 중(loading) · 미실행이며 결과가 아직 확인되지 않았습니다',
  prepared: '준비됨·미실행(prepared) · 사람 확인 전에는 서버에 전달되지 않습니다',
  executing: '서버에 전달 중(executing) · 결과가 아직 없습니다. 완료 아님',
  pending: '서버 접수·처리 중(pending) · 서버가 받았다는 것(ACK)은 효과가 아닙니다. 완료 아님',
  succeeded: '효과 확인(succeeded)',
  denied: '거절(denied) · 연동 시스템이 조치를 거절했습니다',
  failed: '실패(failed) · 연동 시스템이 조치를 처리하지 못했습니다',
  unknown: '결과 불명(unknown) · 성공으로도 효과 없음으로도 판단하지 마세요',
  expired: '확인 기한 지남(expired) · 제공 화면의 「조치 준비」로 다시 준비하세요',
  error: '요청 처리 안 됨(error)',
};
const ACTION_GUIDE = {
  idle: '지금 기록에는 연동 시스템이 지원하는 조치가 없어(supportedActions 빈 배열) 「조치 준비」 버튼이 나오지 않는 것이 정상입니다.',
  prepared: '대상과 조치를 확인했다면 제공 화면의 「대상과 조치를 확인했으며 집행합니다」를 직접 누르세요. 자동으로 실행하지 않습니다.',
  executing: '결과는 제공 화면의 「연동 시스템 결과만 재조회」로 확인하세요.',
  pending: '결과는 제공 화면의 「연동 시스템 결과만 재조회」로 확인하세요. 같은 조치를 다시 보내지 마세요.',
  unknown: '제공 화면의 「연동 시스템 결과만 재조회」로 결과만 다시 확인하세요. 같은 조치를 다시 보내지 마세요.',
  error: '요청이 처리되지 않았습니다. 필요하면 제공 화면에서 직접 다시 준비하세요.',
};

function actionField(list, name, value) {
  if (value === undefined || value === null || value === '') return;
  decisionField(list, name, String(value));
}

function buildAction(input) {
  const { event, actionId, target, receipt, observation, message, confirmationExpiresAt, error } = input ?? {};
  let status = typeof input?.status === 'string' && Object.hasOwn(ACTION_VIEWS, input.status) ? input.status : 'unknown';
  const eventId = text(event?.id);
  const root = node('div', null, 'action-view');
  const notes = [];

  // 서버 영수증이 지금 고른 사건·조치와 다르면 이 화면의 결과로 쓰지 않고 결과 불명으로 둡니다.
  const mismatch = receipt && ((text(receipt.eventId) && eventId && receipt.eventId !== eventId)
    || (text(receipt.actionId) && text(actionId) && receipt.actionId !== actionId));
  if (mismatch) {
    status = 'unknown';
    notes.push('서버 영수증이 지금 고른 사건·조치와 맞지 않아 이 결과를 쓰지 않습니다.');
  }
  // 효과 확인은 연동 시스템이 effectApplied:true 를 관측했을 때만입니다. 아니면 결과 불명입니다.
  if (status === 'succeeded' && observation?.effectApplied !== true) {
    status = 'unknown';
    notes.push('succeeded 를 받았지만 effectApplied:true 관측이 없어 효과를 확인하지 못했습니다.');
  }

  root.dataset.status = status;
  root.append(node('p', ACTION_VIEWS[status], `action-headline action-${status}`));
  for (const note of notes) root.append(node('p', note));

  const facts = node('dl');
  actionField(facts, '사건 ID(event.id)', eventId);
  const evidenceIds = Array.isArray(event?.evidence) ? event.evidence.map((row) => text(row?.id)).filter(Boolean) : [];
  actionField(facts, '근거 ID', evidenceIds.length ? evidenceIds.join(', ') : null);
  actionField(facts, '조치(actionId)', text(actionId));
  actionField(facts, '실제 대상(target.id)', text(target?.id));
  actionField(facts, '대상 세대(target.generation)', target?.generation);
  if (status === 'prepared') actionField(facts, '확인 기한(confirmationExpiresAt)', text(confirmationExpiresAt) ?? '확인 불가');
  actionField(facts, '요청 ID(requestId)', text(receipt?.requestId));
  actionField(facts, '영수증 ID(receiptId)', text(receipt?.receiptId));
  actionField(facts, '버전(version)', receipt?.version);
  if (status === 'succeeded') {
    actionField(facts, '관측 시각(observedAt)', text(observation.observedAt) ?? '확인 불가');
    actionField(facts, '효과 관측', 'effectApplied: true');
  }
  if (facts.children.length > 0) root.append(facts);

  // 같은 요청이 다시 들어오면 서버는 이전 영수증을 돌려줍니다. 새 조치가 한 번 더 실행된 것이 아닙니다.
  if (receipt?.replayed === true) root.append(node('p', '이미 접수된 같은 요청의 영수증입니다(replayed). 조치가 한 번 더 실행된 것이 아닙니다.'));
  if (receipt?.superseded === true) root.append(node('p', '더 새 요청으로 대체된 영수증입니다(superseded). 현재 결과로 쓰지 않습니다.'));

  if (status === 'denied' || status === 'failed') root.append(node('p', `서버 메시지: ${text(message) ?? text(error?.message) ?? '확인 불가'}`));
  if (status === 'error' || status === 'expired') {
    root.append(node('p', `코드: ${text(error?.code) ?? '확인 불가'} · ${text(error?.message) ?? text(message) ?? '확인 불가'}`));
  } else if (text(message) && status !== 'denied' && status !== 'failed') root.append(node('p', `안내: ${message}`));
  if (ACTION_GUIDE[status]) root.append(node('p', ACTION_GUIDE[status]));
  root.append(node('p', 'AI 제안만으로는 조치가 실행되지 않습니다. 「조치 화면 취소」는 이미 서버에 전달된 효과를 되돌리지 않습니다.'));

  // 이 화면이 지금 사건·요청에 대해 그린 것일 때만 표식을 붙입니다.
  if (eventId && !mismatch) root.dataset.studentActionEvent = eventId;
  if (text(receipt?.requestId) && !mismatch) root.dataset.studentActionRequest = receipt.requestId;
  return root;
}

// 20단계: package-lock.json 과 설치된 node_modules 에서 확인한 정확한 버전을 OSV 조회 결과와 함께 보여 줍니다.
// 조회 실패·미조회는 "취약점 없음"이 아니고, none_found 도 조회 범위에서 알려진 항목이 없다는 뜻일 뿐 안전 보장이 아닙니다.
const SCAN_LABELS = {
  complete: '모두 조회',
  partial: '일부 조회 실패',
  not_checked: '아직 조회 안 함(승인된 공개 조회 대상 없음)',
  not_configured: '조회 준비 미완료(조회 대상 프로젝트 설정 필요)',
  unverifiable: 'lock 파일 확인 불가',
};
const PACKAGE_LABELS = { known_vulnerabilities: '알려진 항목 있음', none_found: '알려진 항목 없음', unverifiable: '조회 확인 불가' };
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

function packageRow(pkg) {
  const name = text(pkg?.name) ?? '이름 없음';
  const rawVersion = text(pkg?.version);
  // ^1.2.0 같은 범위는 설치 버전이 아니므로 그대로 쓰지 않습니다.
  const version = rawVersion && EXACT_VERSION.test(rawVersion) ? rawVersion : null;
  const status = text(pkg?.status);
  const findings = Array.isArray(pkg?.vulnerabilities) ? pkg.vulnerabilities : [];
  const row = node('li', null, 'package-row');
  row.dataset.studentPackageName = name;
  row.dataset.studentPackageVersion = version ?? 'unknown';
  row.append(
    node('p', `패키지: ${name}`),
    node('p', `설치된 정확한 버전: ${version ?? `확인 불가${rawVersion ? ` · 받은 값: ${rawVersion}` : ''}`}`),
    node('p', `조회 결과: ${status && Object.hasOwn(PACKAGE_LABELS, status) ? `${PACKAGE_LABELS[status]}(${status})` : `확인 불가(${status ?? 'unknown'})`}`),
    node('p', `출처: ${text(pkg?.source) ?? '확인 불가'} · 조회 시각: ${text(pkg?.checkedAt) ?? '확인 불가'}`),
  );
  if (status === 'none_found') row.append(node('p', '조회 범위에서 알려진 취약점 항목이 없다는 뜻입니다. 안전을 보장하지 않습니다.'));
  if (status === 'unverifiable') {
    row.append(node('p', findings.length > 0
      ? '일부 확인·전체 조회 확인 불가: 아래 받은 취약점 ID 는 그대로 두며, 나머지는 확인하지 못했습니다. 취약점 없음이 아닙니다.'
      : '조회를 확인하지 못했습니다. 취약점 없음이 아닙니다.'));
  }
  if (findings.length > 0) {
    const list = node('ul');
    for (const finding of findings) list.append(node('li', `취약점 ID: ${text(finding?.id) ?? 'ID 없음'} · 수정 시각(modified): ${text(finding?.modified) ?? '확인 불가'}`));
    row.append(list);
  }
  return row;
}

function buildVulnerabilities(input) {
  const { status, mode, data, error } = input ?? {};
  // 매번 새 요소를 만들어 조회 중·오류일 때 이전 표가 현재 결과처럼 남지 않게 합니다.
  const root = node('div', null, 'vulnerabilities-view');
  root.dataset.status = typeof status === 'string' ? status : 'unknown';
  const note = typeof mode === 'string' ? modeNote(mode) : null;
  if (note) root.append(note);
  if (status === 'idle') {
    root.append(node('p', '조회 전 · 보호 현황의 설치 패키지 조회를 직접 누르면 결과가 여기에 보입니다.'));
    return root;
  }
  if (status === 'loading') {
    root.append(node('p', '조회 중 · 이전 결과는 현재 결과가 아닙니다.'));
    return root;
  }
  if (status === 'error') {
    root.append(
      node('p', `조회 실패: ${text(error?.message) ?? '확인 불가'}${text(error?.code) ? ` · 코드: ${error.code}` : ''}`, 'vulnerabilities-error'),
      node('p', '조회하지 못했습니다. 취약점 없음이 아닙니다. 다시 조회는 제공 화면의 조회 버튼을 직접 누르세요.'),
    );
    return root;
  }
  if (status !== 'ok' || !data) {
    root.append(node('p', '조회 결과를 확인할 수 없습니다(확인 불가). 취약점 없음이 아닙니다.'));
    return root;
  }

  const scan = text(data.status);
  root.append(node('p', `전체 조회 상태: ${scan && Object.hasOwn(SCAN_LABELS, scan) ? `${SCAN_LABELS[scan]}(${scan})` : `확인 불가(${scan ?? 'unknown'})`}`));
  const facts = node('dl');
  actionField(facts, 'lock 파일 버전(lockfileVersion)', data.lockfileVersion);
  actionField(facts, 'lock 파일 해시(lockfileHash)', text(data.lockfileHash));
  actionField(facts, '조회 시각(checkedAt)', text(data.checkedAt));
  if (Number.isInteger(data.excluded?.count)) actionField(facts, '조회에서 뺀 패키지 수', data.excluded.count);
  if (facts.children.length > 0) root.append(facts);
  root.append(node('p', '설치 버전은 package-lock.json 과 설치된 node_modules 정보를 대조한 정확한 버전입니다. OSV 조회는 담당자가 허용한 공개 패키지만 합니다.'));

  if (scan === 'not_checked' || scan === 'not_configured' || scan === 'unverifiable') {
    root.append(node('p', '조회하지 않았거나 확인하지 못했습니다. 취약점 없음이 아닙니다. 대상 경로·허용 패키지는 담당자가 준비합니다.'));
  }
  if (scan === 'partial') root.append(node('p', '일부 패키지 조회에 실패했습니다. 이미 받은 취약점 ID 는 그대로 보여 줍니다.'));

  const packages = Array.isArray(data.packages) ? data.packages : [];
  if (packages.length === 0) {
    root.append(node('p', '표시할 패키지 조회 결과가 없습니다.'));
    return root;
  }
  const list = node('ul', null, 'package-list');
  for (const pkg of packages) list.append(packageRow(pkg));
  root.append(list);
  return root;
}

// 총공세: 내 PC 보안 대시보드(관제 대시보드형). 맨 위 상태 카드 4개, 아래 네트워크·이벤트와 이 창의 조회 기록을 둡니다.
// 값은 제공 서버의 읽기 전용 경로 /api/pc/status 만 씁니다. 사용자가 「다시 조회」를 누를 때만 읽고, 화면을 그릴 때나 자동으로 읽지 않습니다.
// 앱은 설정을 바꾸지 않습니다. 종합 점수나 정상 추정을 만들지 않고, 읽지 못한 값은 확인 불가로 둡니다.
const PC_PATH = '/api/pc/status';
const PC_SCHEMA = 'aleph.on.pc-status.v1';
const PC_MAX_AGE_MS = 60000;
const PC_HISTORY_LIMIT = 10;
const PC_REASONS = {
  permission_denied: '읽기 권한이 없습니다. 관리자 권한으로 바꾸기 전에 담당자에게 확인하세요.',
  unsupported: '이 운영체제에서는 이 항목을 조회하지 않습니다.',
  timeout: '조회 시간이 초과됐습니다. 잠시 뒤 「다시 조회」를 누르세요.',
};
const PC_LEVELS = {
  ok: { text: '정상', className: 'state state-ok' },
  warn: { text: '주의', className: 'state state-error' },
  unknown: { text: '확인 불가', className: 'state state-empty' },
};
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isCount = (value) => Number.isSafeInteger(value) && value >= 0;
const gigabytes = (value) => `${(value / 1024 ** 3).toFixed(1)} GB`;

function pcUnknown(title, metric) {
  return { title, level: 'unknown', value: '확인 불가', note: PC_REASONS[metric?.reason] ?? '이번 조회에서 값을 읽지 못했습니다. 정상으로 판단하지 마세요.' };
}

function memoryPercent(metric) {
  const valid = metric?.state === 'ok' && isNumber(metric.usedBytes) && isNumber(metric.totalBytes) && metric.totalBytes > 0 && metric.usedBytes <= metric.totalBytes;
  return valid ? Math.round(metric.usedBytes / metric.totalBytes * 1000) / 10 : null;
}

function cpuPercent(metric) {
  return metric?.state === 'ok' && isNumber(metric.usagePercent) && metric.usagePercent <= 100 ? metric.usagePercent : null;
}

function cpuCard(metric) {
  const usage = cpuPercent(metric);
  if (usage === null) return pcUnknown('CPU', metric);
  const high = usage >= 90;
  return { title: 'CPU', level: high ? 'warn' : 'ok', value: `${usage.toFixed(1)}% 사용`, note: high ? '사용률이 높습니다. 사용 중인 앱을 확인하세요.' : '짧은 구간의 실측값입니다.' };
}

function memoryCard(metric) {
  const percent = memoryPercent(metric);
  if (percent === null) return pcUnknown('메모리', metric);
  const high = percent >= 85;
  return { title: '메모리', level: high ? 'warn' : 'ok', value: `${percent.toFixed(1)}% 사용 (${gigabytes(metric.usedBytes)} / ${gigabytes(metric.totalBytes)})`, note: high ? '사용량이 높습니다. 필요 없는 앱을 닫아 보세요.' : '이 PC 전체 사용량입니다.' };
}

function diskCard(metric) {
  const valid = metric?.state === 'ok' && isNumber(metric.freeBytes) && isNumber(metric.totalBytes) && metric.totalBytes > 0 && metric.freeBytes <= metric.totalBytes;
  if (!valid) return pcUnknown('디스크', metric);
  const low = metric.freeBytes / metric.totalBytes < 0.1;
  return { title: '디스크', level: low ? 'warn' : 'ok', value: `${gigabytes(metric.freeBytes)} 여유 / ${gigabytes(metric.totalBytes)}`, note: low ? '남은 공간이 10% 아래입니다. 파일을 정리해 보세요.' : '앱이 있는 드라이브 기준입니다.' };
}

function firewallCard(metric) {
  const profiles = metric?.state === 'ok' && Array.isArray(metric.profiles) ? metric.profiles : null;
  const valid = profiles && ['Domain', 'Private', 'Public'].every((name) => profiles.some((row) => row?.name === name && typeof row.enabled === 'boolean'));
  if (!valid) return pcUnknown('Windows 방화벽', metric);
  const off = profiles.filter((row) => !row.enabled).map((row) => row.name);
  return {
    title: 'Windows 방화벽',
    level: off.length ? 'warn' : 'ok',
    value: profiles.map((row) => `${row.name} ${row.enabled ? '켜짐' : '꺼짐'}`).join(' · '),
    note: off.length ? `${off.join('·')} 프로필이 꺼져 있습니다. 다른 보안 프로그램이 맡고 있는지 확인하세요. 앱은 설정을 바꾸지 않습니다.` : '설정을 읽기만 했습니다. 앱은 설정을 바꾸지 않습니다.',
  };
}

function networkRow(metric) {
  if (metric?.state !== 'ok' || !isCount(metric.interfaceCount) || !isCount(metric.ipv4Count)) return pcUnknown('네트워크 구성', metric);
  return { title: '네트워크 구성', level: 'ok', value: `인터페이스 ${metric.interfaceCount}개 · IPv4 구성 ${metric.ipv4Count}개`, note: '로컬 구성 개수입니다. 인터넷 접속이 된다는 뜻은 아닙니다.' };
}

function eventsRow(metric) {
  if (metric?.state !== 'ok' || !isCount(metric.warningCount) || !isCount(metric.errorCount)) return pcUnknown('Windows 기록', metric);
  return {
    title: 'Windows 기록',
    level: metric.errorCount > 0 ? 'warn' : 'ok',
    value: `최근 24시간 경고 ${metric.warningCount}건 · 오류 ${metric.errorCount}건${metric.truncated ? ' (일부 집계)' : ''}`,
    note: 'System·Application 기록의 건수만 읽습니다. 기록 내용은 읽지 않습니다.',
  };
}

function pcCard(card) {
  const box = node('article', null, 'card');
  box.dataset.studentPcCard = card.title;
  box.dataset.level = card.level;
  box.append(node('h4', card.title), node('p', card.value), node('p', `상태: ${PC_LEVELS[card.level].text}`, PC_LEVELS[card.level].className), node('p', card.note));
  return box;
}

function readPcResult(result) {
  if (!result?.ok) return { error: { code: text(result?.error?.code) ?? 'PC_STATUS_UNVERIFIED', message: text(result?.error?.message) ?? '내 PC 상태를 읽지 못했습니다.' } };
  const data = result.data;
  const measured = Date.parse(data?.measuredAt);
  if (data?.schema !== PC_SCHEMA || data.source !== 'local-pc' || !Number.isFinite(measured)) {
    return { error: { code: 'PC_STATUS_UNVERIFIED', message: '응답 형식을 확인할 수 없어 값을 쓰지 않습니다.' } };
  }
  if (Math.abs(Date.now() - measured) > PC_MAX_AGE_MS) return { error: { code: 'PC_STATUS_STALE', message: '측정 시각이 1분 넘게 지나 현재 값으로 쓰지 않습니다.' } };
  return { data };
}

function createPcDashboard(api) {
  const canRead = typeof api?.get === 'function';
  const history = [];
  let state = { status: 'idle' };
  let generation = 0;

  const element = node('section', null, 'pc-dashboard');
  element.setAttribute('aria-label', '내 PC 보안 대시보드');
  const button = node('button', '다시 조회', 'btn');
  button.type = 'button';
  button.disabled = !canRead;
  const status = node('p', null, 'state');
  status.setAttribute('role', 'status');
  const body = node('div');
  element.append(node('h3', '내 PC 보안 대시보드'), node('p', '이 PC에서 앱 서버가 잰 값입니다. 다른 곳으로 보내지 않고, 설정도 바꾸지 않습니다.'), button, status, body);

  function historyTable() {
    const table = node('table');
    table.append(node('caption', '이 창에서 조회한 기록(최근 10번, 새로고침하면 지워짐)'));
    const head = node('tr');
    for (const name of ['측정 시각', 'CPU', '메모리', '경고', '오류']) {
      const cell = node('th', name);
      cell.scope = 'col';
      head.append(cell);
    }
    table.append(head);
    for (const row of history) {
      const line = node('tr');
      line.dataset.studentPcHistory = row.at;
      line.append(node('td', eventTime(row.at)));
      for (const value of [row.cpu, row.memory]) {
        const cell = node('td');
        if (value === null) cell.textContent = '확인 불가';
        else {
          const bar = node('progress');
          bar.max = 100;
          bar.value = value;
          bar.setAttribute('aria-label', `${value.toFixed(1)}%`);
          cell.append(bar, node('span', ` ${value.toFixed(1)}%`));
        }
        line.append(cell);
      }
      line.append(node('td', row.warnings === null ? '확인 불가' : String(row.warnings)), node('td', row.errors === null ? '확인 불가' : String(row.errors)));
      table.append(line);
    }
    return table;
  }

  function draw() {
    element.setAttribute('aria-busy', String(state.status === 'loading'));
    button.textContent = state.status === 'idle' ? '조회' : '다시 조회';
    body.replaceChildren();
    if (!canRead) {
      status.className = 'state state-empty';
      status.textContent = '이 앱에서는 학생 조회 경로를 쓸 수 없습니다. 위쪽 제공 카드 「내 PC 상태」를 보세요.';
      return;
    }
    if (state.status === 'idle') {
      status.className = 'state state-empty';
      status.textContent = '아직 조회하지 않았습니다. 「조회」를 누르면 지금 값을 읽습니다.';
    } else if (state.status === 'loading') {
      status.className = 'state state-loading';
      status.textContent = '이 PC에서 읽는 중입니다.';
    } else if (state.status === 'error') {
      status.className = 'state state-error';
      status.textContent = `조회 실패: ${state.error.message} · 코드: ${state.error.code}`;
      body.append(node('p', '지금 값을 읽지 못했습니다. 정상이라는 뜻이 아닙니다. 앱이 켜져 있는지 확인한 뒤 「다시 조회」를 직접 누르세요. 자동으로 다시 읽지 않습니다.'));
    } else {
      const metrics = state.data.metrics;
      const cards = [cpuCard(metrics?.cpu), memoryCard(metrics?.memory), diskCard(metrics?.disk), firewallCard(metrics?.firewall)];
      const rows = [networkRow(metrics?.network), eventsRow(metrics?.events)];
      const all = [...cards, ...rows];
      const count = (level) => all.filter((item) => item.level === level).length;
      status.className = `state ${count('warn') ? 'state-error' : count('unknown') ? 'state-empty' : 'state-ok'}`;
      status.textContent = `실측값(이 PC) · 측정 시각: ${eventTime(state.data.measuredAt)} · 주의 ${count('warn')}개 · 확인 불가 ${count('unknown')}개 · 정상 ${count('ok')}개`;
      const grid = node('div', null, 'grid-2');
      grid.append(...cards.map(pcCard));
      const details = node('dl');
      for (const row of rows) decisionField(details, `${row.title} (${PC_LEVELS[row.level].text})`, `${row.value} · ${row.note}`);
      body.append(grid, details);
    }
    if (history.length > 0) {
      if (state.status !== 'ok') body.append(node('p', '아래 기록은 지난 조회 값이며 현재 값이 아닙니다.'));
      body.append(historyTable());
    }
  }

  async function read() {
    const own = ++generation;
    state = { status: 'loading' };
    draw();
    const result = await api.get(PC_PATH).catch(() => null);
    // 늦게 온 응답은 쓰지 않습니다.
    if (own !== generation) return;
    const { data, error } = readPcResult(result);
    if (error) {
      state = { status: 'error', error };
    } else {
      state = { status: 'ok', data };
      const metrics = data.metrics;
      const events = metrics?.events?.state === 'ok' ? metrics.events : null;
      history.unshift({ at: data.measuredAt, cpu: cpuPercent(metrics?.cpu), memory: memoryPercent(metrics?.memory), warnings: isCount(events?.warningCount) ? events.warningCount : null, errors: isCount(events?.errorCount) ? events.errorCount : null });
      history.length = Math.min(history.length, PC_HISTORY_LIMIT);
    }
    draw();
  }

  button.addEventListener('click', () => { if (canRead) void read(); });
  draw();

  // 제공 화면이 학생 칸을 다시 그려도 대시보드 요소와 조회 기록은 그대로 옮겨 붙입니다.
  function attach(root) {
    const focused = element.contains(document.activeElement);
    root.prepend(element);
    if (focused) queueMicrotask(() => button.focus());
    return root;
  }

  return { attach };
}

export function createStudentView({ api } = {}) {
  const pc = createPcDashboard(api);
  // 필터 선택은 이 화면 안에서만 기억하고, 상세 선택은 새 자료가 올 때마다 지웁니다.
  const events = createEventsView();
  return {
    // 13단계: 로그인 사용자·기기·세션을 상태별로 보여 줍니다. 입력은 { me, devices, sessions } 이고 각각 { status, mode, data?, error? } 입니다.
    // 다시 불러오면 제공 UI가 새 입력으로 이 함수를 다시 부르고, 이전 DOM은 새 요소로 통째로 바뀝니다. 이전 값은 보관하지 않습니다.
    renderIdentity(input) { return buildIdentity(input); },
    // 14단계: 선택한 업무 앱 한 개의 접근 판정·이유·시각을 보여 줍니다. 입력은 { status, mode, data?, error?, appId } 입니다.
    // 요청 실패(error)는 거부 판정과, 확인 불가(unknown)는 허용과 섞이지 않게 글자로 구분합니다.
    renderDecision(input) { return buildDecision(input); },
    // 15단계: 본인 접속 기록·저장된 XDR 경보 목록, 필터 세 개, 상세 보기. 입력은 { status, mode, data?, error? } 입니다.
    renderEvents: events.render,
    // 16단계: 입력은 { devices, sessions, notifications, diagnostics, mode } 입니다.
    renderStatus(input) { return pc.attach(buildStatus(input)); },
    // 20단계: 입력은 { status, mode, data?, error? } 입니다.
    renderVulnerabilities(input) { return buildVulnerabilities(input); },
    // 17단계: 입력은 { status, mode, data?, error?, checkedAt, explanationAccepted } 입니다.
    renderAiConnection(input) { return buildAiConnection(input); },
    // 18단계: 입력은 { event, explanation, checkedAt } 입니다.
    renderExplanation(input) { return buildExplanation(input); },
    // 19단계: 새 값이 올 때마다 새 요소를 만들어 이전 대상·요청·결과를 남기지 않습니다.
    renderAction(input) { return buildAction(input); },
  };
}
