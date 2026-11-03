// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView() {
  return {
    renderIdentity({ me, devices, sessions } = {}) {
      const element = (tag, text, className) => {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (className) node.className = className;
        return node;
      };
      const value = (input) => typeof input === 'string' && input.length ? input : '확인 불가';
      const deviceState = (status) => status === 'compliant' ? '보안 기준 충족'
        : status === 'noncompliant' ? '보안 기준 미충족' : '확인 불가';
      const sessionState = (status) => status === 'active' ? '활성'
        : status === 'expired' ? '만료' : status === 'revoked' ? '철회됨' : '확인 불가';
      const row = (list, label, text, problem = false) => {
        list.append(element('dt', label), element('dd', text, problem ? 'state state-error' : undefined));
      };
      // Each invocation returns a new tree; no account or response is cached.
      const root = element('div');
      const section = (title, resource, renderData) => {
        const card = element('section', undefined, 'card');
        card.append(element('h4', title));
        const mode = resource?.mode;
        if (mode === 'demo') card.append(element('p', '예제 자료 · 실제 서버 연결이 아닙니다.', 'tag tag-demo'));
        else if (mode === 'disconnected') card.append(element('p', '연결 없음', 'state state-empty'));
        else if (mode !== 'connected') card.append(element('p', '확인 불가', 'state state-empty'));
        if (resource?.status === 'loading') {
          card.append(element('p', '불러오는 중', 'state state-loading'));
        } else if (resource?.status === 'error') {
          card.append(element('p', `연결 실패: ${value(resource.error?.message)}`, 'state state-error'));
        } else if (resource?.status === 'ok') {
          renderData(card, resource.data);
        } else {
          card.append(element('p', '상태 확인 불가', 'state state-empty'));
        }
        root.append(card);
      };
      section('로그인 사용자·현재 기기·현재 세션', me, (card, data) => {
        const list = element('dl', undefined, 'kv');
        row(list, '사용자 이름', value(data?.user?.label));
        row(list, '사용자 ID', value(data?.user?.id));
        row(list, '기기 이름', value(data?.device?.label));
        row(list, '기기 ID', value(data?.device?.id));
        row(list, '기기 상태', deviceState(data?.device?.status), data?.device?.status !== 'compliant');
        row(list, '세션 ID', value(data?.session?.id));
        row(list, '세션 상태', sessionState(data?.session?.status), data?.session?.status !== 'active');
        card.append(list);
      });
      section('내 기기 목록', devices, (card, data) => {
        if (!Array.isArray(data)) { card.append(element('p', '기기 목록 확인 불가', 'state state-error')); return; }
        if (!data.length) { card.append(element('p', '표시할 기기가 없습니다.', 'state state-empty')); return; }
        const list = element('ul', undefined, 'plain-list');
        for (const device of data) {
          const item = element('li');
          item.append(element('p', `${value(device?.label)} · 기기 ID: ${value(device?.id)}`));
          item.append(element('p', deviceState(device?.status), device?.status === 'compliant' ? 'state state-ok' : 'state state-error'));
          list.append(item);
        }
        card.append(list);
      });
      section('내 세션 목록', sessions, (card, data) => {
        if (!Array.isArray(data)) { card.append(element('p', '세션 목록 확인 불가', 'state state-error')); return; }
        if (!data.length) { card.append(element('p', '표시할 세션이 없습니다.', 'state state-empty')); return; }
        const list = element('ul', undefined, 'plain-list');
        for (const session of data) {
          const item = element('li');
          item.append(element('p', `세션 ID: ${value(session?.id)}`));
          item.append(element('p', sessionState(session?.status), session?.status === 'active' ? 'state state-ok' : 'state state-error'));
          list.append(item);
        }
        card.append(list);
      });
      return root;
    },
    renderDecision() { return '학생 구현 대기: 서버의 판정과 이유를 연결하세요.'; },
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
