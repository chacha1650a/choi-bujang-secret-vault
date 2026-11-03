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
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
