// 자료실 화면 코드입니다. 콘텐츠 보안 정책(CSP)으로 인라인 스크립트를 막기 위해 별도 파일로 둡니다.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';

// 이 두 값은 브라우저에 넣어도 되는 공개용입니다. 서버 전용 키는 이 파일에 없습니다.
const SUPABASE_URL = 'https://qnhghbipylyhzoyhkkgl.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_0ob3zQmenT9MOOcxmrpaHw_ri91--ge';

// 11단계: 로그인 토큰을 브라우저 저장소(localStorage 등)에 넣지 않고 이 창의 메모리에만 둡니다.
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
});
const $ = (id) => document.getElementById(id);
let editingId = null;

const say = (text) => { $('message').textContent = text; };

async function api(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(path, {
    ...options,
    cache: 'no-store',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  });
  if (response.status === 204) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.error || `요청 실패 (HTTP ${response.status})`);
  return result;
}

function resetEditor() {
  editingId = null;
  $('editor').reset();
  $('save').textContent = '추가';
  $('cancel').hidden = true;
}

async function loadNotes() {
  const notes = await api('/api/my/notes');
  const items = notes.map((note) => {
    const li = document.createElement('li');
    li.className = 'card';
    const title = document.createElement('strong');
    const body = document.createElement('span');
    title.textContent = note.title;
    body.textContent = note.body;
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = '수정';
    edit.addEventListener('click', () => {
      editingId = note.id;
      $('title').value = note.title;
      $('body').value = note.body;
      $('save').textContent = '저장';
      $('cancel').hidden = false;
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.textContent = '삭제';
    remove.addEventListener('click', async () => {
      try { await api(`/api/notes/${note.id}`, { method: 'DELETE' }); await loadNotes(); say('삭제했습니다.'); }
      catch (error) { say(error.message); }
    });
    li.append(title, body, edit, remove);
    return li;
  });
  if (!items.length) {
    const empty = document.createElement('li');
    empty.textContent = '아직 메모가 없습니다. 위에서 추가해 보세요.';
    items.push(empty);
  }
  $('notes').replaceChildren(...items);
}

// 11단계: 서버가 이 기기를 승인된 기기로 확인한 뒤에만 자료실(메모)을 엽니다.
// 승인 여부는 서버 응답으로만 판단하고, 기기 ID는 자바스크립트가 읽을 수 없는 쿠키로만 서버와 주고받습니다.
async function checkDevice() {
  $('vault').hidden = true;
  $('notes').replaceChildren();
  const status = await api('/api/device/status');
  const messages = {
    device_approved: '서버가 이 기기를 승인했습니다. 자료실을 엽니다.',
    approval_pending: '승인 요청을 보냈습니다. 강사가 서버에서 승인하기 전에는 자료가 열리지 않습니다.',
    device_revoked: '이 기기의 승인이 회수됐습니다. 자료를 열 수 없습니다.',
    device_not_registered: '이 기기는 아직 승인되지 않았습니다. 승인 전에는 메모를 보여 주지 않습니다.',
  };
  $('device-state').textContent = messages[status.reason] ?? '이 기기의 승인 여부를 확인하지 못했습니다.';
  $('device-request').hidden = status.approved || status.reason !== 'device_not_registered';
  $('device-refresh').hidden = status.approved;
  if (!status.approved) return;
  $('vault').hidden = false;
  await loadNotes();
}

async function render(session) {
  const loggedIn = Boolean(session);
  $('login').hidden = loggedIn;
  $('session').hidden = !loggedIn;
  if (!loggedIn) { $('vault').hidden = true; $('notes').replaceChildren(); resetEditor(); return; }
  $('who').textContent = `${session.user.email} 로 로그인했습니다.`;
  try { await checkDevice(); } catch (error) { say(error.message); }
}

$('device-request').addEventListener('click', async () => {
  try { await api('/api/device/request', { method: 'POST' }); await checkDevice(); }
  catch (error) { say(error.message); }
});
$('device-refresh').addEventListener('click', async () => {
  try { await checkDevice(); } catch (error) { say(error.message); }
});

$('login').addEventListener('submit', async (event) => {
  event.preventDefault();
  say('');
  const { error } = await supabase.auth.signInWithPassword({ email: $('email').value, password: $('password').value });
  if (error) say(`로그인하지 못했습니다: ${error.message}`);
  $('password').value = '';
});
$('signup').addEventListener('click', async () => {
  say('');
  if (!$('login').reportValidity()) return;
  const { data, error } = await supabase.auth.signUp({ email: $('email').value, password: $('password').value });
  $('password').value = '';
  if (error) say(`가입하지 못했습니다: ${error.message}`);
  else if (!data.session) say('가입했습니다. 확인 메일의 링크를 누른 뒤 로그인해 주세요.');
});
$('logout').addEventListener('click', async () => { await supabase.auth.signOut(); say('로그아웃했습니다.'); });
$('cancel').addEventListener('click', resetEditor);
$('editor').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = JSON.stringify({ title: $('title').value, body: $('body').value });
  try {
    if (editingId) await api(`/api/notes/${editingId}`, { method: 'PUT', body: payload });
    else await api('/api/notes', { method: 'POST', body: payload });
    resetEditor();
    await loadNotes();
    say('저장했습니다.');
  } catch (error) { say(error.message); }
});

// 설치형 웹앱: 서비스 워커는 오프라인 안내 화면만 저장합니다(메모·API 응답은 저장하지 않음).
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

supabase.auth.onAuthStateChange((_event, session) => { render(session); });
render((await supabase.auth.getSession()).data.session);
