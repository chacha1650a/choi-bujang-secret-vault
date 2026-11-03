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

export function createStudentView() {
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
    renderStatus(input) { return buildStatus(input); },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    // 17단계: 입력은 { status, mode, data?, error?, checkedAt, explanationAccepted } 입니다.
    renderAiConnection(input) { return buildAiConnection(input); },
    // 18단계: 입력은 { event, explanation, checkedAt } 입니다.
    renderExplanation(input) { return buildExplanation(input); },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
