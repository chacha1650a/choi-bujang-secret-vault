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
// 3단계에서는 아직 소유자 검사를 하지 않습니다. 로그인한 누구나 id를 알면 다른 사람의 메모를
// 읽고 고치고 지울 수 있습니다. 이 허점은 4단계에서 고칩니다.
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
    await guarded(request, response, ['GET', 'PUT', 'DELETE'], async () => {
      const id = String(request.query?.id ?? '');
      if (!UUID.test(id)) {
        send(response, 404, { error: 'NOT_FOUND' });
        return;
      }
      if (request.method === 'GET') {
        const { data, error } = await supabase.from('notes').select('id, title, body')
          .eq('id', id).maybeSingle();
        if (error) throw error;
        if (!data) send(response, 404, { error: 'NOT_FOUND' });
        else send(response, 200, publicNote(data));
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
        const changes = {};
        if (input.title !== undefined) changes.title = input.title;
        if (input.body !== undefined) changes.body = input.body;
        const { data, error } = await supabase.from('notes').update(changes)
          .eq('id', id).select('id, title, body').maybeSingle();
        if (error) throw error;
        if (!data) send(response, 404, { error: 'NOT_FOUND' });
        else send(response, 200, publicNote(data));
        return;
      }
      const { data, error } = await supabase.from('notes').delete()
        .eq('id', id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) send(response, 404, { error: 'NOT_FOUND' });
      else response.status(204).end();
    });
  }

  return { collection, item };
}
