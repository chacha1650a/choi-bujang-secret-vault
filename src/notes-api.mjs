import { randomUUID } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const MAX_TITLE = 200;
const MAX_BODY = 5000;

const send = (response, status, body) => response.status(status).json(body);
const publicNote = (row) => ({ id: row.id, title: row.title, body: row.body });

function readBody(request) {
  const raw = request.body;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to the invalid-body answer
    }
  }
  return null;
}

function checkText(value, label, max, { required }) {
  if (value === undefined && !required) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    return `${label}은(는) 1~${max}자의 글자여야 합니다.`;
  }
  return null;
}

// 서버가 확인한 로그인 정보(verifyLogin)만 믿습니다. 브라우저가 보낸 userId·role은 읽지 않습니다.
// 4단계: 모든 읽기·추가·수정·삭제는 서버가 검증한 사용자 ID와 DB의 owner_id가 같을 때만 허용합니다.
// 요청 주소·본문의 userId·owner_id는 믿지 않습니다.
export function createNotesApi({ verifyLogin, supabase }) {
  async function authenticate(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    const who = await verifyLogin(request.headers?.authorization);
    if (!who) {
      response.setHeader('WWW-Authenticate', 'Bearer');
      send(response, 401, { error: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' });
      return null;
    }
    return who;
  }

  async function guarded(request, response, allowed, run) {
    try {
      if (!allowed.includes(request.method)) {
        response.setHeader('Allow', allowed.join(', '));
        send(response, 405, { error: 'METHOD_NOT_ALLOWED' });
        return;
      }
      const who = await authenticate(request, response);
      if (!who) return;
      await run(who);
    } catch {
      // 오류 내용에 주소·키가 섞일 수 있어서 응답과 로그에 자세히 남기지 않습니다.
      send(response, 500, { error: 'SERVER_ERROR' });
    }
  }

  async function collection(request, response) {
    await guarded(request, response, ['GET', 'POST'], async (who) => {
      if (request.method === 'GET') {
        const { data, error } = await supabase.from('notes').select('id, title, body')
          .eq('owner_id', who.userId).order('created_at');
        if (error) throw error;
        send(response, 200, data.map(publicNote));
        return;
      }
      const input = readBody(request);
      const problem = !input ? '요청 본문은 JSON 객체여야 합니다.'
        : checkText(input.title, 'title', MAX_TITLE, { required: true })
          ?? checkText(input.body, 'body', MAX_BODY, { required: true })
          ?? (input.id !== undefined && !UUID.test(String(input.id)) ? 'id는 UUID여야 합니다.' : null);
      if (problem) {
        send(response, 400, { error: 'INVALID_REQUEST', message: problem });
        return;
      }
      const id = input.id ? String(input.id).toLowerCase() : randomUUID();
      const { error } = await supabase.from('notes')
        .insert({ id, owner_id: who.userId, title: input.title, body: input.body });
      if (error?.code === '23505') {
        send(response, 409, { error: 'ID_EXISTS' });
        return;
      }
      if (error) throw error;
      send(response, 201, { id });
    });
  }

  async function item(request, response) {
    await guarded(request, response, ['GET', 'PUT', 'DELETE'], async (who) => {
      const id = String(request.query?.id ?? '');
      if (!UUID.test(id)) {
        send(response, 404, { error: 'NOT_FOUND' });
        return;
      }
      // 4단계: 주소의 id는 믿지 않습니다. 먼저 DB의 owner_id를 읽어 검증된 사용자와 비교하고,
      // 주인이 아니면(주인이 없는 옛 행 포함) 본문 없이 거부합니다. 기본은 거부입니다.
      const existing = await supabase.from('notes').select('id, title, body, owner_id')
        .eq('id', id).maybeSingle();
      if (existing.error) throw existing.error;
      if (!existing.data) {
        send(response, 404, { error: 'NOT_FOUND' });
        return;
      }
      if (existing.data.owner_id !== who.userId) {
        send(response, 403, { error: 'FORBIDDEN', message: '내 메모만 접근할 수 있습니다.' });
        return;
      }
      if (request.method === 'GET') {
        send(response, 200, publicNote(existing.data));
        return;
      }
      if (request.method === 'PUT') {
        const input = readBody(request);
        const problem = !input ? '요청 본문은 JSON 객체여야 합니다.'
          : checkText(input.title, 'title', MAX_TITLE, { required: false })
            ?? checkText(input.body, 'body', MAX_BODY, { required: false })
            ?? (input.title === undefined && input.body === undefined ? '고칠 title 또는 body가 필요합니다.' : null);
        if (problem) {
          send(response, 400, { error: 'INVALID_REQUEST', message: problem });
          return;
        }
        // 새 행의 주인이 본인이 아니게 되는 요청(소유자 변경)은 거부합니다. owner_id는 절대 쓰지 않습니다.
        const requestedOwner = input.owner_id ?? input.ownerId;
        if (requestedOwner !== undefined && requestedOwner !== who.userId) {
          send(response, 403, { error: 'FORBIDDEN', message: '소유자는 바꿀 수 없습니다.' });
          return;
        }
        const changes = {};
        if (input.title !== undefined) changes.title = input.title;
        if (input.body !== undefined) changes.body = input.body;
        const { data, error } = await supabase.from('notes').update(changes)
          .eq('id', id).eq('owner_id', who.userId).select('id, title, body').maybeSingle();
        if (error) throw error;
        if (!data) send(response, 404, { error: 'NOT_FOUND' });
        else send(response, 200, publicNote(data));
        return;
      }
      const { data, error } = await supabase.from('notes').delete()
        .eq('id', id).eq('owner_id', who.userId).select('id').maybeSingle();
      if (error) throw error;
      if (!data) send(response, 404, { error: 'NOT_FOUND' });
      else response.status(204).end();
    });
  }

  return { collection, item };
}
